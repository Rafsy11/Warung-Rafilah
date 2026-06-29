import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';

const patchSchema = z.object({
  status: z.enum(['success', 'failed', 'reversed']),
  provider_ref_id: z.string().optional()
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Validate request body
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request data', details: parsed.error.issues }, { status: 400 });
    }

    const { status, provider_ref_id } = parsed.data;

    // Get the user ID from headers (set by middleware)
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await db.connect();
    
    try {
      await client.query('BEGIN');

      // 1. Fetch current transaction (lock for update to prevent concurrent updates)
      const txRes = await client.query(
        'SELECT id, status, amount, agent_commission FROM agent.transactions WHERE id = $1 FOR UPDATE',
        [id]
      );
      if (txRes.rows.length === 0) {
        throw new Error('Transaction not found');
      }
      const tx = txRes.rows[0];

      // Prevent re-processing finalized transactions
      if (tx.status !== 'pending') {
        throw new Error('Transaction is already finalized');
      }

      // Fetch last ledger balance (lock for update)
      const ledgerResult = await client.query(
        'SELECT balance_after FROM agent.float_ledger ORDER BY id DESC LIMIT 1 FOR UPDATE'
      );
      let currentFloat = ledgerResult.rows.length > 0 ? Number(ledgerResult.rows[0].balance_after) : 0;

      if (status === 'success') {
        // Credit commission
        const commission = Number(tx.agent_commission);
        if (commission > 0) {
          currentFloat += commission;
          await client.query(
            `INSERT INTO agent.float_ledger (entry_type, amount, balance_after, reference_id, note)
             VALUES ($1, $2, $3, $4, $5)`,
            ['commission_earned', commission, currentFloat, id, 'Penerimaan komisi layanan (Laba Warung)']
          );
        }
      } else if (status === 'failed' || status === 'reversed') {
        // Refund principal amount
        const principal = Number(tx.amount);
        currentFloat += principal;
        await client.query(
          `INSERT INTO agent.float_ledger (entry_type, amount, balance_after, reference_id, note)
           VALUES ($1, $2, $3, $4, $5)`,
          ['deposit_in', principal, currentFloat, id, `Refund modal karena transaksi ${status === 'failed' ? 'gagal' : 'di-reverse'}`]
        );
      }

      // Update the transaction status
      const updateResult = await client.query(
        `UPDATE agent.transactions 
         SET status = $1::varchar, provider_ref_id = COALESCE($2, provider_ref_id), settled_at = CASE WHEN $1::varchar = 'success' THEN now() ELSE settled_at END
         WHERE id = $3
         RETURNING id, status, settled_at`,
        [status, provider_ref_id || null, id]
      );

      // Write to audit log
      await client.query(
        `INSERT INTO core.audit_log (user_id, action, entity_table, entity_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          `manual_reconciliation_${status}`,
          'agent.transactions',
          id,
          JSON.stringify({ status, provider_ref_id, previous_status: tx.status })
        ]
      );

      await client.query('COMMIT');

      return NextResponse.json(updateResult.rows[0], { status: 200 });
      
    } catch (dbError) {
      await client.query('ROLLBACK');
      console.error('Manual reconciliation failed:', dbError);
      const err = dbError as { message?: string };
      
      if (err.message === 'Transaction not found') {
        return NextResponse.json({ error: err.message }, { status: 404 });
      }
      if (err.message === 'Transaction is already finalized') {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      return NextResponse.json(
        { error: 'Transaction failed', details: err.message || 'Unknown error' }, 
        { status: 400 }
      );
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('PATCH endpoint error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
