import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { enforceRateLimit } from '@/lib/rate-limiter';

export async function POST(req: NextRequest) {
  const forbidden = requireRole(req, ['owner']);
  if (forbidden) return forbidden;

  const rateLimited = enforceRateLimit(req, 'API_WRITE', '/api/sales/cancel');
  if (rateLimited) return rateLimited;

  try {
    const body = await req.json();
    const { saleId } = body;

    if (!saleId) {
      return NextResponse.json({ error: 'Missing sale ID' }, { status: 400 });
    }

    const client = await db.connect();
    
    try {
      await client.query('BEGIN');

      // Lock sale row
      const saleRes = await client.query(
        "SELECT id, transaction_code, status, payment_method FROM warung.sales WHERE id = $1 FOR UPDATE",
        [saleId]
      );

      if (saleRes.rows.length === 0) {
        throw new Error('Sale transaction not found');
      }

      const sale = saleRes.rows[0];

      if (sale.status !== 'pending') {
        throw new Error(`Cannot cancel a sale with status '${sale.status}'`);
      }

      // 1. Restore stock for physical items
      const itemsRes = await client.query(
        "SELECT product_id, qty FROM warung.sale_items WHERE sale_id = $1",
        [saleId]
      );

      for (const item of itemsRes.rows) {
        await client.query(
          "UPDATE warung.products SET stock_qty = stock_qty + $1 WHERE id = $2",
          [Number(item.qty), item.product_id]
        );
      }

      // 2. Cancel and refund any agent transactions associated with this sale
      const agentTxRes = await client.query(
        "SELECT id, amount, status FROM agent.transactions WHERE provider_ref_id = $1 AND status = 'pending' FOR UPDATE",
        [sale.transaction_code]
      );

      for (const tx of agentTxRes.rows) {
        // Set transaction status to failed
        await client.query(
          "UPDATE agent.transactions SET status = 'failed' WHERE id = $1",
          [tx.id]
        );

        // Fetch last float ledger balance
        const ledgerResult = await client.query(
          'SELECT balance_after FROM agent.float_ledger ORDER BY id DESC LIMIT 1 FOR UPDATE'
        );
        let currentFloat = ledgerResult.rows.length > 0 ? Number(ledgerResult.rows[0].balance_after) : 0;
        const refundAmount = Number(tx.amount);
        currentFloat += refundAmount;

        // Refund float ledger
        await client.query(
          `INSERT INTO agent.float_ledger (entry_type, amount, balance_after, reference_id, note)
           VALUES ($1, $2, $3, $4, $5)`,
          ['deposit_in', refundAmount, currentFloat, tx.id, `Refund modal karena pembatalan transaksi POS ${sale.transaction_code}`]
        );
      }

      // 3. Set sale status to 'voided'
      await client.query(
        "UPDATE warung.sales SET status = 'voided' WHERE id = $1",
        [saleId]
      );

      await client.query('COMMIT');
      return NextResponse.json({ success: true, message: 'Sale cancelled successfully and stock/float restored.' });

    } catch (txError) {
      await client.query('ROLLBACK');
      const err = txError as { message?: string };
      return NextResponse.json({ error: 'Cancellation failed', details: err.message || 'Unknown error' }, { status: 400 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error cancelling sale:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
