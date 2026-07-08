import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { enforceRateLimit } from '@/lib/rate-limiter';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = requireRole(req, ['owner', 'cashier']);
  if (forbidden) return forbidden;

  const rateLimited = enforceRateLimit(req, 'API_WRITE', '/api/customers/pay-debt');
  if (rateLimited) return rateLimited;

  const userId = req.headers.get('x-user-id');
  const { id } = await params;
  try {
    const { amount, note } = await req.json();
    const payAmount = Number(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      return NextResponse.json({ error: 'Jumlah pembayaran harus lebih besar dari 0.' }, { status: 400 });
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Fetch customer
      const custRes = await client.query(
        'SELECT id, name, current_debt FROM warung.customers WHERE id = $1 AND is_active = true FOR UPDATE',
        [id]
      );
      if (custRes.rowCount === 0) {
        throw new Error('Pelanggan tidak ditemukan atau tidak aktif.');
      }

      const customer = custRes.rows[0];
      const currentDebt = Number(customer.current_debt);

      if (currentDebt < payAmount) {
        throw new Error(`Jumlah pembayaran (Rp ${payAmount.toLocaleString()}) melebihi jumlah hutang saat ini (Rp ${currentDebt.toLocaleString()}).`);
      }

      const newDebt = currentDebt - payAmount;

      // Update customer debt
      await client.query(
        'UPDATE warung.customers SET current_debt = $1, updated_at = NOW() WHERE id = $2',
        [newDebt, id]
      );

      // Record in debt ledger
      await client.query(
        `INSERT INTO warung.debt_ledger (customer_id, entry_type, amount, balance_after, note, created_by)
         VALUES ($1, 'debt_paid', $2, $3, $4, $5)`,
         [id, payAmount, newDebt, note?.trim() || 'Pembayaran hutang', userId]
      );

      await client.query('COMMIT');
      return NextResponse.json({ success: true, newDebt });
    } catch (e) {
      await client.query('ROLLBACK');
      const error = e as Error;
      return NextResponse.json({ error: error.message || 'Gagal memproses pembayaran.' }, { status: 400 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('pay-debt POST error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
