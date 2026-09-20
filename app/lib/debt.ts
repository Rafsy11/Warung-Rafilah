import type { PoolClient } from 'pg';

// Caller must hold the financial transaction lock.
export async function payDebt(client: PoolClient, customerId: string, amount: number, userId: string, note: string, method = 'cash') {
  if (!Number.isFinite(amount) || amount <= 0 || !['cash', 'transfer', 'qris'].includes(method)) {
    throw new Error('Nominal atau metode pembayaran hutang tidak valid.');
  }
  const session = await client.query(`SELECT id FROM warung.cashier_sessions
    WHERE cashier_id=$1 AND status='open' ORDER BY opened_at DESC LIMIT 1 FOR UPDATE`, [userId]);
  if (!session.rows.length) throw new Error('Buka shift sebelum menerima pembayaran hutang.');
  const result = await client.query('SELECT current_debt FROM warung.customers WHERE id=$1 AND is_active=true FOR UPDATE', [customerId]);
  if (!result.rows.length) throw new Error('Pelanggan tidak ditemukan.');
  const remaining = Number(result.rows[0].current_debt) - amount;
  if (remaining < 0) throw new Error('Pembayaran melebihi sisa hutang.');
  await client.query('UPDATE warung.customers SET current_debt=$1 WHERE id=$2', [remaining, customerId]);
  await client.query(`INSERT INTO warung.debt_ledger
    (customer_id,entry_type,amount,balance_after,note,created_by,session_id,payment_method)
    VALUES ($1,'debt_paid',$2,$3,$4,$5,$6,$7)`, [customerId,amount,remaining,note,userId,session.rows[0].id,method]);
  return remaining;
}
