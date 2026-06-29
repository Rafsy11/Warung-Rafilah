import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';

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
  unit_price: z.number().positive(),
  subtotal:   z.number().positive(),
  is_agent:   z.boolean().optional(),
  barcode:    z.string().optional(),
  name:       z.string().optional(),
  digital_details: digitalDetailsSchema.optional(),
});

const saleRequestSchema = z.object({
  total_amount:     z.number().positive(),
  payment_method:   z.enum(['CASH', 'QRIS', 'transfer', 'SPLIT', 'DEBT', 'debt']),
  payment_received: z.number().nonnegative().default(0),
  change_given:     z.number().nonnegative().default(0),
  items:            z.array(saleItemSchema).min(1),
  split_cash_amount: z.number().nonnegative().optional(),
  split_qris_amount: z.number().nonnegative().optional(),
  customer_id:       z.string().uuid().optional(),
});

/** GET /api/sales?date=YYYY-MM-DD&limit=50 */
export async function GET(req: NextRequest) {
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
  try {
    const body = await request.json();
    const parsed = saleRequestSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request data', details: parsed.error.issues }, { status: 400 });
    }
    
    const { 
      total_amount, 
      payment_method, 
      payment_received, 
      change_given, 
      items,
      split_cash_amount,
      split_qris_amount,
      customer_id
    } = parsed.data;

    const client = await db.connect();
    
    try {
      await client.query('BEGIN');

      // Pakai cashier ID dari JWT header yang di-set middleware
      let cashier_id = request.headers.get('x-user-id');
      if (!cashier_id) {
        // Fallback dev-only: ambil user pertama
        const userResult = await client.query('SELECT id FROM core.users LIMIT 1');
        if (userResult.rows.length === 0) throw new Error('No user found to act as cashier');
        cashier_id = userResult.rows[0].id;
      }

      // Check active cashier session
      const sessionRes = await client.query(
        `SELECT id FROM warung.cashier_sessions 
         WHERE cashier_id = $1 AND status = 'open' 
         ORDER BY opened_at DESC LIMIT 1`,
        [cashier_id]
      );

      if (sessionRes.rows.length === 0) {
        throw new Error('Anda harus membuka sesi kasir (shift) terlebih dahulu sebelum mencatat transaksi.');
      }

      const session_id = sessionRes.rows[0].id;

      // Buat transaction_code unik
      const transaction_code = `WRG-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      let finalAmount = total_amount;
      let qrisSuffix = 0;
      let saleStatus = 'completed';

      if (payment_method === 'QRIS' || payment_method === 'SPLIT') {
        saleStatus = 'pending';
        let isUnique = false;
        let attempts = 0;
        const qrisPart = payment_method === 'QRIS' ? total_amount : (split_qris_amount || 0);
        const cashPart = payment_method === 'SPLIT' ? (split_cash_amount || 0) : 0;

        while (!isUnique && attempts < 10) {
          qrisSuffix = Math.floor(Math.random() * 900) + 100; // 100 - 999
          const candidateQrisAmount = qrisPart + qrisSuffix;
          const candidateTotalAmount = cashPart + candidateQrisAmount;

          const checkRes = await client.query(
            "SELECT id FROM warung.sales WHERE status = 'pending' AND total_amount = $1",
            [candidateTotalAmount]
          );
          if (checkRes.rows.length === 0) {
            finalAmount = candidateTotalAmount;
            isUnique = true;
          }
          attempts++;
        }
        if (!isUnique) {
          finalAmount = total_amount + Math.floor(Math.random() * 1000);
        }
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

        const debtAdded = total_amount - (payment_received || 0);

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
         (transaction_code, cashier_id, subtotal, total_amount, payment_method, payment_received, change_given, status, split_cash_amount, split_qris_amount, customer_id, session_id) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
        [
          transaction_code, 
          cashier_id, 
          total_amount, 
          finalAmount, 
          payment_method.toLowerCase(), 
          payment_method === 'SPLIT' ? dbSplitCash : (payment_method === 'QRIS' ? 0 : payment_received), 
          change_given, 
          saleStatus,
          dbSplitCash,
          dbSplitQris,
          customer_id || null,
          session_id
        ]
      );
      
      const saleId = saleResult.rows[0].id;

      if (payment_method.toLowerCase() === 'debt') {
        const custRes = await client.query('SELECT current_debt FROM warung.customers WHERE id = $1', [customer_id]);
        const newDebt = Number(custRes.rows[0].current_debt);
        const debtAdded = total_amount - (payment_received || 0);

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
          const agtTxCode = `AGT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

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
            'SELECT cost_price, sell_price, is_consignment, consignment_supplier_name, consignment_cost_share FROM warung.products WHERE id = $1 AND is_active = true',
            [item.product_id]
          );
          if (prodResult.rows.length === 0) {
            throw new Error(`Produk tidak ditemukan atau tidak aktif: ${item.product_id}`);
          }
          const cost_price = Number(prodResult.rows[0].cost_price);
          const defaultSellPrice = Number(prodResult.rows[0].sell_price);
          const isConsignment = prodResult.rows[0].is_consignment;
          const supplierName = prodResult.rows[0].consignment_supplier_name;
          const costShare = Number(prodResult.rows[0].consignment_cost_share || 0);

          // Cari tier harga terbaik yang memenuhi syarat min_qty <= quantity
          const tierResult = await client.query(
            `SELECT tier_price 
             FROM warung.product_pricing_tiers 
             WHERE product_id = $1 AND min_qty <= $2 
             ORDER BY min_qty DESC 
             LIMIT 1`,
            [item.product_id, item.quantity]
          );
          
          const expectedUnitPrice = tierResult.rows.length > 0 
            ? Number(tierResult.rows[0].tier_price) 
            : defaultSellPrice;

          const realSubtotal = item.quantity * expectedUnitPrice;

          const saleItemRes = await client.query(
            'INSERT INTO warung.sale_items (sale_id, product_id, qty, unit_price, cost_price_snapshot, subtotal) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [saleId, item.product_id, item.quantity, expectedUnitPrice, cost_price, realSubtotal]
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
               LIMIT 1`,
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
                  'UPDATE warung.products SET stock_qty = stock_qty - $1 WHERE id = $2',
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

          if (stockUpdateResult.rowCount === 0) {
            throw new Error(`Stok produk tidak mencukupi atau produk tidak valid untuk ID: ${item.product_id}`);
          }
        }
      }

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
                    amount: total_amount,
                    type: 'new_debt'
                  })
                }).catch(err => console.error('Failed to trigger auto debt alert:', err));
              }
            }
          })
          .catch(err => console.error('Error fetching customer for auto alert:', err));
      }

      return NextResponse.json({ 
        message: saleStatus === 'pending' ? 'Transaction pending QRIS payment' : 'Transaction completed successfully', 
        saleId,
        transaction_code,
        status: saleStatus,
        total_amount: finalAmount,
        split_cash_amount: dbSplitCash,
        split_qris_amount: dbSplitQris
      }, { status: 201 });
      
    } catch (dbError) {
      await client.query('ROLLBACK');
      const err = dbError as { message?: string };
      console.error('Transaction rollback. Error:', dbError);
      
      return NextResponse.json(
        { error: 'Transaction failed', details: err.message || 'Unknown error' }, 
        { status: 400 }
      );
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Sales endpoint error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
