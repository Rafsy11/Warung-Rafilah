import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';

/** GET /api/agent/transactions?status=pending&limit=20 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const status = searchParams.get('status');
    const limit  = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);

    const conditions: string[] = [];
    const params: unknown[]    = [];

    if (status) {
      params.push(status);
      conditions.push(`t.status = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit);

    const { rows } = await db.query(
      `SELECT t.id, t.transaction_code, t.service_type, t.product_name,
              t.customer_phone, t.amount, t.admin_fee,
              t.agent_commission, t.status, t.created_at
       FROM agent.transactions t
       ${where}
       ORDER BY t.created_at DESC
       LIMIT $${params.length}`,
      params
    );

    return NextResponse.json({ items: rows, total: rows.length });
  } catch {
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Database error' } },
      { status: 500 }
    );
  }
}



const agentTxSchema = z.object({
  transaction_code: z.string(),
  operator_id: z.string().uuid().optional(),
  service_type: z.enum([
    'e_wallet_topup', 'bill_payment', 'qris_deposit', 'cash_withdrawal', 'transfer',
    'listrik', 'bpjs', 'pajak', 'e_wallet', 'pulsa_data', 'topup_game',
    'air_pdam', 'transfer_bank', 'tarik_tunai', 'tv_internet', 'asuransi',
  ]),
  product_id: z.string().uuid().optional(),
  product_name: z.string().optional(),
  customer_phone: z.string().optional(),
  amount: z.number().positive(),
  admin_fee: z.number().nonnegative(),
  agent_commission: z.number().nonnegative().optional().default(0)
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = agentTxSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request data', details: parsed.error.issues }, { status: 400 });
    }
    
    const { transaction_code, service_type, product_id, product_name, customer_phone, amount, admin_fee, agent_commission } = parsed.data;

    const client = await db.connect();
    
    try {
      await client.query('BEGIN');

      let operator_id = request.headers.get('x-user-id');
      if (!operator_id) {
        const userResult = await client.query('SELECT id FROM core.users LIMIT 1');
        if (userResult.rows.length === 0) throw new Error('No user found to act as operator');
        operator_id = userResult.rows[0].id;
      }

      // 1. Catat master transaksi AmarthaFin dengan status pending
      const txResult = await client.query(
        `INSERT INTO agent.transactions 
        (transaction_code, operator_id, service_type, product_id, product_name, customer_phone, amount, admin_fee, agent_commission, status) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending') RETURNING id`,
        [transaction_code, operator_id, service_type, product_id || null, product_name || null, customer_phone, amount, admin_fee, agent_commission]
      );
      
      const txId = txResult.rows[0].id;

      // Dapatkan saldo agen terakhir (lock for update untuk mencegah race condition)
      const ledgerResult = await client.query(
        'SELECT balance_after FROM agent.float_ledger ORDER BY id DESC LIMIT 1 FOR UPDATE'
      );
      let currentFloat = ledgerResult.rows.length > 0 ? Number(ledgerResult.rows[0].balance_after) : 0;

      if (currentFloat < amount) {
        throw new Error('Insufficient agent float balance');
      }

      // 2. EKSPLISIT: Pencatatan pemotongan modal (mengurangi saldo agen)
      currentFloat -= amount;
      await client.query(
        `INSERT INTO agent.float_ledger (entry_type, amount, balance_after, reference_id, note)
         VALUES ($1, $2, $3, $4, $5)`,
        ['deposit_out', amount, currentFloat, txId, 'Pemotongan modal untuk transaksi layanan']
      );

      await client.query('COMMIT');

      return NextResponse.json({ 
        id: txId,
        transaction_code,
        status: 'pending',
        admin_fee,
        agent_commission,
        new_balance: currentFloat,
        message: 'Agent transaction created as pending'
      }, { status: 201 });
      
    } catch (dbError) {
      await client.query('ROLLBACK');
      console.error('Agent transaction rollback. Error:', dbError);
      const err = dbError as { message?: string };
      
      return NextResponse.json(
        { error: 'Transaction failed', details: err.message || 'Unknown error' }, 
        { status: 400 }
      );
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Agent transaction endpoint error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
