import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { enforceRateLimit } from '@/lib/rate-limiter';

export async function POST(req: NextRequest) {
  const forbidden = requireRole(req, ['owner', 'cashier']);
  if (forbidden) return forbidden;

  const rateLimited = enforceRateLimit(req, 'API_WRITE', '/api/sales/confirm-manual');
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
        "SELECT id, transaction_code, status, total_amount FROM warung.sales WHERE id = $1 FOR UPDATE",
        [saleId]
      );

      if (saleRes.rows.length === 0) {
        throw new Error('Sale transaction not found');
      }

      const sale = saleRes.rows[0];

      if (sale.status !== 'pending') {
        throw new Error(`Cannot manually confirm a sale with status '${sale.status}'`);
      }

      // 1. Update sale status to 'completed' and set payment_received
      await client.query(
        "UPDATE warung.sales SET status = 'completed', payment_received = CASE WHEN payment_received > 0 THEN payment_received ELSE total_amount END WHERE id = $1",
        [saleId]
      );

      // 2. Find associated agent transactions (where provider_ref_id is the POS transaction_code)
      const agentTxRes = await client.query(
        "SELECT id, amount, agent_commission, status FROM agent.transactions WHERE provider_ref_id = $1 AND status = 'pending' FOR UPDATE",
        [sale.transaction_code]
      );

      for (const tx of agentTxRes.rows) {
        const commission = Number(tx.agent_commission);
        if (commission > 0) {
          // Fetch last float ledger balance
          const ledgerResult = await client.query(
            'SELECT balance_after FROM agent.float_ledger ORDER BY id DESC LIMIT 1 FOR UPDATE'
          );
          let currentFloat = ledgerResult.rows.length > 0 ? Number(ledgerResult.rows[0].balance_after) : 0;
          currentFloat += commission;

          // Add commission to float ledger
          await client.query(
            `INSERT INTO agent.float_ledger (entry_type, amount, balance_after, reference_id, note)
             VALUES ($1, $2, $3, $4, $5)`,
            ['commission_earned', commission, currentFloat, tx.id, `Penerimaan komisi layanan (Laba Warung) via Konfirmasi Manual POS ${sale.transaction_code}`]
          );
        }

        // Set associated transaction status to success and set settled_at
        await client.query(
          "UPDATE agent.transactions SET status = 'success', settled_at = now() WHERE id = $1",
          [tx.id]
        );
      }

      await client.query('COMMIT');
      return NextResponse.json({ success: true, message: 'Sale confirmed manually.' });

    } catch (txError) {
      await client.query('ROLLBACK');
      const err = txError as { message?: string };
      return NextResponse.json({ error: 'Manual confirmation failed', details: err.message || 'Unknown error' }, { status: 400 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error in confirm-manual:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
