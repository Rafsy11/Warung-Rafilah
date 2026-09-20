import { createHash, randomUUID } from 'node:crypto';
import { beginTransaction } from '@/lib/transaction';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { requireRole, requireAuth } from '@/lib/rbac';

const digitalDetailsSchema = z.object({
  service_type: z.enum(['e_wallet_topup', 'bill_payment', 'qris_deposit', 'cash_withdrawal', 'transfer']),
  customer_phone: z.string().optional(),
  amount: z.number().positive(),
  admin_fee: z.number().nonnegative(),
  agent_commission: z.number().nonnegative(),
});

const saleItemSchema = z.object({
  product_id: z.string().uuid().optional(),
  quantity:   z.number().int().positive(),
  unit_price: z.number().nonnegative(),
  subtotal:   z.number().nonnegative(),
  is_agent:   z.boolean().optional(),
  barcode:    z.string().optional(),
  name:       z.string().optional(),
  digital_details: digitalDetailsSchema.optional(),
});

const saleRequestSchema = z.object({
  checkout_key: z.string().uuid(),
  total_amount:     z.number().nonnegative(),
  discount:         z.number().nonnegative().optional().default(0),
  payment_method:   z.enum(['CASH', 'QRIS', 'transfer', 'SPLIT', 'DEBT', 'debt']),
  payment_received: z.number().nonnegative().default(0),
  change_given:     z.number().nonnegative().default(0),
  items:            z.array(saleItemSchema).min(1).max(200),
  split_cash_amount: z.number().nonnegative().optional(),
  split_qris_amount: z.number().nonnegative().optional(),
  customer_id:       z.string().uuid().optional(),
});

/** GET /api/sales?date=YYYY-MM-DD&limit=50 */
export async function GET(req: NextRequest) {
  const forbidden = requireRole(req, ['owner', 'cashier']);
  if (forbidden) return forbidden;

  const { searchParams } = req.nextUrl;
  const date  = searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);

  try {
    const { rows } = await db.query(
      `SELECT id, transaction_code, total_amount, payment_method, status, created_at
       FROM warung.sales
       WHERE date_trunc('day', created_at AT TIME ZONE 'Asia/Jakarta') = $1::date
         AND status = 'completed'
       ORDER BY created_at DESC
       LIMIT $2`,
      [date, limit]
    );
    return NextResponse.json({ items: rows, total: rows.length });
  } catch (err) {
    console.error('sales GET error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { errorResponse, userId: cashier_id } = requireAuth(request);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const parsed = saleRequestSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request data', details: parsed.error.issues }, { status: 400 });
    }
    
    const { 
      total_amount: submittedTotal,
      checkout_key,
      discount = 0,
      payment_method, 
      payment_received, 
      change_given, 
      items,
      split_cash_amount,
      split_qris_amount,
      customer_id
    } = parsed.data;

    if (discount > submittedTotal) {
      return NextResponse.json({ error: 'Discount cannot be greater than subtotal' }, { status: 400 });
    }

    const client = await db.connect();
    
    try {
      await beginTransaction(client);

      const requestHash = createHash('sha256').update(JSON.stringify(parsed.data)).digest('hex');
      const previous = await client.query('SELECT cashier_id, request_hash, receipt_snapshot, status FROM warung.sales WHERE checkout_key=$1', [checkout_key]);
      if (previous.rows.length) {
        const old = previous.rows[0];
        if (old.cashier_id !== cashier_id || old.request_hash !== requestHash) throw new Error('Identitas checkout sudah digunakan untuk permintaan berbeda.');
        await client.query('COMMIT');
        return NextResponse.json({ ...old.receipt_snapshot, status: old.status }, { status: 200 });
      }
      let total_amount = 0;
      const seen = new Set<string>();
      const validatedPrices = new Map<string, number>();
      const receiptItems: { name: string; qty: number; unit_price: number; subtotal: number }[] = [];
      for (const item of items) {
        if (item.is_agent) {
          if (!item.digital_details || item.product_id || item.quantity !== 1) throw new Error('Detail layanan digital tidak valid.');
          const unitPrice = item.digital_details.amount + item.digital_details.admin_fee;
          total_amount += unitPrice;
          receiptItems.push({ name: item.name || 'Layanan agen', qty: 1, unit_price: unitPrice, subtotal: unitPrice });
        } else {
          if (!item.product_id || item.digital_details || seen.has(item.product_id)) throw new Error('Produk kosong atau duplikat dalam keranjang.');
          seen.add(item.product_id);
          const product = await client.query('SELECT name, sell_price FROM warung.products WHERE id=$1 AND is_active=true FOR UPDATE', [item.product_id]);
          if (!product.rows.length) throw new Error('Produk tidak tersedia.');
          const tier = await client.query('SELECT tier_price FROM warung.product_pricing_tiers WHERE product_id=$1 AND min_qty <= $2 ORDER BY min_qty DESC LIMIT 1', [item.product_id, item.quantity]);
          let unitPrice = Number(tier.rows[0]?.tier_price ?? product.rows[0].sell_price);
          const promotion = await client.query("SELECT value_type,discount_value FROM warung.discounts WHERE product_id=$1 AND is_active=true ORDER BY created_at,id LIMIT 1", [item.product_id]);
          if (promotion.rows.length) {
            const promo = promotion.rows[0];
            unitPrice = Math.round(Math.max(0, promo.value_type === 'percentage' ? unitPrice * (1 - Number(promo.discount_value) / 100) : unitPrice - Number(promo.discount_value)));
          }
          validatedPrices.set(item.product_id, unitPrice);
          const subtotal = Math.round(unitPrice * item.quantity * 100) / 100;
          total_amount += subtotal;
          receiptItems.push({ name: product.rows[0].name, qty: item.quantity, unit_price: unitPrice, subtotal });
        }
      }
      total_amount = Math.round(total_amount * 100) / 100;
      if (Math.abs(total_amount - submittedTotal) > 0.005 || receiptItems.some((row, i) => Math.abs(row.unit_price - items[i].unit_price) > 0.005)) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Harga berubah. Keranjang diperbarui; periksa pembayaran lalu coba lagi.', items: receiptItems }, { status: 409 });
      }
      const payable = Math.round((total_amount - discount) * 100) / 100;
      if (payable < 0) throw new Error('Diskon melebihi total.');
      if (['CASH', 'QRIS', 'transfer'].includes(payment_method) && payment_received < payable) throw new Error('Pembayaran kurang dari tagihan.');
      if (['DEBT','debt'].includes(payment_method) && payment_received > payable) throw new Error('DP melebihi tagihan.');
      if (payment_method === 'SPLIT' && (split_cash_amount === undefined || split_qris_amount === undefined || split_cash_amount > payable || Math.abs(split_cash_amount + split_qris_amount - payable) > 0.005)) throw new Error('Pembagian pembayaran tidak sesuai total.');
      const expectedChange = ['CASH','QRIS','transfer'].includes(payment_method) ? Math.round((payment_received - payable) * 100) / 100 : 0;
      if (Math.abs(change_given - expectedChange) > 0.005) throw new Error('Kembalian tidak sesuai pembayaran.');

      // Check active cashier session
      const sessionRes = await client.query(
        `SELECT id FROM warung.cashier_sessions 
         WHERE cashier_id = $1 AND status = 'open' 
         ORDER BY opened_at DESC LIMIT 1 FOR UPDATE`,
        [cashier_id]
      );

      if (sessionRes.rows.length === 0) {
        throw new Error('Anda harus membuka sesi kasir (shift) terlebih dahulu sebelum mencatat transaksi.');
      }

      const session_id = sessionRes.rows[0].id;

      // Buat transaction_code unik
      const transaction_code = `WRG-${randomUUID().replaceAll('-', '').slice(0, 24)}`;

      let finalAmount = total_amount - discount;
      let qrisSuffix = 0;
      let saleStatus = 'completed';

      if (payment_method === 'QRIS' || payment_method === 'SPLIT') {
        saleStatus = 'pending';
        qrisSuffix = 0;
        finalAmount = total_amount - discount;
      }

      if (payment_method.toLowerCase() === 'debt') {
        if (!customer_id) {
          throw new Error('Pelanggan harus dipilih untuk transaksi hutang (bon).');
        }

        // Lock and fetch customer record
        const custRes = await client.query(
          'SELECT current_debt, credit_limit, name FROM warung.customers WHERE id = $1 AND is_active = true FOR UPDATE',
          [customer_id]
        );
        if (custRes.rowCount === 0) {
          throw new Error('Pelanggan tidak ditemukan atau tidak aktif.');
        }

        const customer = custRes.rows[0];
        const currentDebt = Number(customer.current_debt);
        const creditLimit = Number(customer.credit_limit);

        const debtAdded = (total_amount - discount) - (payment_received || 0);

        if (currentDebt + debtAdded > creditLimit) {
          throw new Error(`Batas limit kredit terlampaui. Saldo hutang saat ini: Rp ${currentDebt.toLocaleString('id-ID')}, Limit: Rp ${creditLimit.toLocaleString('id-ID')}. Transaksi ini membutuhkan tambahan hutang Rp ${debtAdded.toLocaleString('id-ID')} (Total akumulasi: Rp ${(currentDebt + debtAdded).toLocaleString('id-ID')})`);
        }

        // Increase current debt by net debt added
        await client.query(
          'UPDATE warung.customers SET current_debt = current_debt + $1 WHERE id = $2',
          [debtAdded, customer_id]
        );
      }

      const dbSplitCash = payment_method === 'SPLIT' ? (split_cash_amount || 0) : 0;
      const dbSplitQris = payment_method === 'SPLIT' ? (finalAmount - dbSplitCash) : 0;

      const saleResult = await client.query(
        `INSERT INTO warung.sales 
         (transaction_code, cashier_id, subtotal, discount, total_amount, payment_method, payment_received, change_given, status, split_cash_amount, split_qris_amount, customer_id, session_id, checkout_key, request_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id`,
        [
          transaction_code, 
          cashier_id, 
          total_amount, // subtotal
          discount,
          finalAmount, // total_amount
          payment_method.toLowerCase(), 
          payment_method === 'SPLIT' ? dbSplitCash : (payment_method === 'QRIS' ? (payment_received > 0 ? payment_received : finalAmount) : payment_received), 
          change_given, 
          saleStatus,
          dbSplitCash,
          dbSplitQris,
          customer_id || null,
          session_id, checkout_key, requestHash
        ]
      );
      
      const saleId = saleResult.rows[0].id;

      if (payment_method.toLowerCase() === 'debt') {
        const custRes = await client.query('SELECT current_debt FROM warung.customers WHERE id = $1', [customer_id]);
        const newDebt = Number(custRes.rows[0].current_debt);
        const debtAdded = (total_amount - discount) - (payment_received || 0);

        await client.query(
          `INSERT INTO warung.debt_ledger (customer_id, sale_id, entry_type, amount, balance_after, note, created_by)
           VALUES ($1, $2, 'debt_added', $3, $4, $5, $6)`,
          [
            customer_id,
            saleId,
            debtAdded,
            newDebt,
            payment_received > 0
              ? `Penambahan sisa hutang setelah DP Rp ${payment_received.toLocaleString('id-ID')} dari transaksi ritel ${transaction_code}`
              : `Penambahan hutang dari transaksi ritel ${transaction_code}`,
            cashier_id
          ]
        );
      }

      for (const item of items) {
        if (item.is_agent && item.digital_details) {
          const { service_type, customer_phone, amount, admin_fee, agent_commission } = item.digital_details;

          // 1. Generate unique AGT transaction code
          const agtTxCode = `AGT-${randomUUID().replaceAll('-', '').slice(0, 24)}`;

          // 2. Insert into agent.transactions
          const txResult = await client.query(
            `INSERT INTO agent.transactions 
            (transaction_code, operator_id, service_type, customer_phone, amount, admin_fee, agent_commission, status, provider_ref_id) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8) RETURNING id`,
            [agtTxCode, cashier_id, service_type, customer_phone || null, amount, admin_fee, agent_commission, transaction_code]
          );
          const txId = txResult.rows[0].id;

          // 3. Deduct float balance
          const ledgerResult = await client.query(
            'SELECT balance_after FROM agent.float_ledger ORDER BY id DESC LIMIT 1 FOR UPDATE'
          );
          let currentFloat = ledgerResult.rows.length > 0 ? parseFloat(ledgerResult.rows[0].balance_after) : 0;
          
          if (currentFloat < amount) {
            throw new Error(`Saldo float agen tidak mencukupi untuk transaksi ${item.name}`);
          }
          currentFloat -= amount;

          await client.query(
            `INSERT INTO agent.float_ledger (entry_type, amount, balance_after, reference_id, note)
             VALUES ($1, $2, $3, $4, $5)`,
            ['deposit_out', amount, currentFloat, txId, `Pemotongan modal untuk ${item.name} via ${transaction_code}`]
          );

        } else if (item.product_id) {
          // Ambil detail produk (cost_price, sell_price, dan status konsinyasi)
          const prodResult = await client.query(
            'SELECT name, cost_price, sell_price, is_consignment, consignment_supplier_name, consignment_cost_share FROM warung.products WHERE id = $1 AND is_active = true',
            [item.product_id]
          );
          if (prodResult.rows.length === 0) {
            throw new Error(`Produk tidak ditemukan atau tidak aktif: ${item.product_id}`);
          }
          const cost_price = Number(prodResult.rows[0].cost_price);
          const isConsignment = prodResult.rows[0].is_consignment;
          const supplierName = prodResult.rows[0].consignment_supplier_name;
          const costShare = Number(prodResult.rows[0].consignment_cost_share || 0);

          const expectedUnitPrice = validatedPrices.get(item.product_id)!;

          const realSubtotal = item.quantity * expectedUnitPrice;

          const saleItemRes = await client.query(
            'INSERT INTO warung.sale_items (sale_id, product_id, qty, unit_price, cost_price_snapshot, subtotal, product_name_snapshot, consignment_cost_snapshot) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
            [saleId, item.product_id, item.quantity, expectedUnitPrice, isConsignment ? costShare : cost_price, realSubtotal, prodResult.rows[0].name, isConsignment ? costShare : null]
          );
          const saleItemId = saleItemRes.rows[0].id;

          // Catat kewajiban setoran jika merupakan barang titipan (konsinyasi)
          if (isConsignment && supplierName) {
            const totalOwed = item.quantity * costShare;
            await client.query(
              `INSERT INTO warung.consignment_ledger (sale_item_id, product_id, supplier_name, qty_sold, cost_share, total_owed, status)
               VALUES ($1, $2, $3, $4, $5, $6, 'unpaid')`,
              [saleItemId, item.product_id, supplierName, item.quantity, costShare, totalOwed]
            );
          }

          // Auto-convert from parent packaging if retail stock is insufficient
          const currentStockRes = await client.query(
            'SELECT stock_qty FROM warung.products WHERE id = $1 FOR UPDATE',
            [item.product_id]
          );
          const currentStock = Number(currentStockRes.rows[0]?.stock_qty || 0);

          if (currentStock < item.quantity) {
            const deficit = item.quantity - currentStock;

            const convRes = await client.query(
              `SELECT cm.id, cm.source_product_id, cm.conversion_ratio, sp.name as source_name, sp.stock_qty as source_stock
               FROM warung.product_conversion_map cm
               JOIN warung.products sp ON cm.source_product_id = sp.id AND sp.is_active = true
               WHERE cm.dest_product_id = $1 AND cm.auto_convert = true
               ORDER BY sp.stock_qty DESC
               LIMIT 1 FOR UPDATE OF sp`,
              [item.product_id]
            );

            if (convRes.rows.length > 0) {
              const conv = convRes.rows[0];
              const ratio = Number(conv.conversion_ratio);
              const sourceStock = Number(conv.source_stock);
              const unitsNeeded = Math.ceil(deficit / ratio);

              if (sourceStock >= unitsNeeded) {
                // Deduct source packaging stock
                await client.query(
                  'UPDATE warung.products SET stock_qty = stock_qty - $1 WHERE id = $2 AND stock_qty >= $1',
                  [unitsNeeded, conv.source_product_id]
                );
                // Add converted units to destination retail stock
                const convertedQty = unitsNeeded * ratio;
                await client.query(
                  'UPDATE warung.products SET stock_qty = stock_qty + $1 WHERE id = $2',
                  [convertedQty, item.product_id]
                );
                // Record stock movements for the auto-conversion
                const convNote = `Auto-konversi: ${unitsNeeded} ${conv.source_name} → ${convertedQty} unit eceran (checkout)`;
                await client.query(
                  `INSERT INTO warung.stock_movements (product_id, movement_type, qty_change, note, created_by)
                   VALUES ($1, 'adjustment', $2, $3, $4)`,
                  [conv.source_product_id, -unitsNeeded, convNote, cashier_id]
                );
                await client.query(
                  `INSERT INTO warung.stock_movements (product_id, movement_type, qty_change, note, created_by)
                   VALUES ($1, 'adjustment', $2, $3, $4)`,
                  [item.product_id, convertedQty, convNote, cashier_id]
                );
              }
            }
          }

          const stockUpdateResult = await client.query(
            'UPDATE warung.products SET stock_qty = stock_qty - $1 WHERE id = $2 AND stock_qty >= $1 RETURNING id',
            [item.quantity, item.product_id]
          );

          await client.query("INSERT INTO warung.stock_movements(product_id,movement_type,qty_change,reference_id,note,created_by) VALUES ($1,'sale',$2,$3,$4,$5)", [item.product_id,-item.quantity,saleId,transaction_code,cashier_id]);
          if (stockUpdateResult.rowCount === 0) {
            throw new Error(`Stok produk tidak mencukupi atau produk tidak valid untuk ID: ${item.product_id}`);
          }
        }
      }

      const cashier = await client.query('SELECT full_name FROM core.users WHERE id=$1', [cashier_id]);
      const response = {
        saleId, transaction_code, status: saleStatus, total_amount: finalAmount,
        split_cash_amount: dbSplitCash, split_qris_amount: dbSplitQris,
        receipt: { type: 'warung', transaction_code, cashier: cashier.rows[0]?.full_name || 'Kasir',
          items: receiptItems, total: finalAmount, discount, payment_method: payment_method.toUpperCase(),
          payment_received: payment_method === 'SPLIT' ? dbSplitCash : payment_received,
          split_cash_amount: dbSplitCash, split_qris_amount: dbSplitQris, change: expectedChange, timestamp: new Date().toISOString() }
      };
      await client.query('UPDATE warung.sales SET receipt_snapshot=$1::jsonb WHERE id=$2', [JSON.stringify(response),saleId]);
      await client.query('COMMIT');

      // Auto-trigger WhatsApp Debt Alert asynchronously
      if (payment_method.toLowerCase() === 'debt' && customer_id) {
        db.query('SELECT name, phone, current_debt, credit_limit FROM warung.customers WHERE id = $1', [customer_id])
          .then(async (cRes) => {
            if (cRes.rows.length > 0) {
              const customer = cRes.rows[0];
              if (customer.phone && customer.phone.trim() !== '') {
                await fetch('http://n8n:5678/webhook/BrtxwMY3malrlZKW/webhook/send-debt-alert', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name: customer.name,
                    phone: customer.phone,
                    current_debt: customer.current_debt,
                    credit_limit: customer.credit_limit,
                    amount: total_amount - discount,
                    type: 'new_debt'
                  })
                }).catch(err => console.error('Failed to trigger auto debt alert:', err));
              }
            }
          })
          .catch(err => console.error('Error fetching customer for auto alert:', err));
      }

      return NextResponse.json(response, { status: 201 });
      
    } catch (dbError) {
      await client.query('ROLLBACK');
      const err = dbError as { message?: string };
      console.error('Transaction rollback. Error:', dbError);
      
      return NextResponse.json(
        { error: 'Transaction failed', details: err.message || 'Unknown error' }, 
        { status: dbError && typeof dbError === 'object' && 'code' in dbError ? 503 : 400 }
      );
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Sales endpoint error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
