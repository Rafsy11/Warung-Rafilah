import { payDebt } from '@/lib/debt';
import { beginTransaction } from '@/lib/transaction';
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
    const { amount, note, payment_method = 'cash' } = await req.json();
    const payAmount = Number(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      return NextResponse.json({ error: 'Jumlah pembayaran harus lebih besar dari 0.' }, { status: 400 });
    }

    const client = await db.connect();
    try {
      await beginTransaction(client);

      const newDebt = await payDebt(client, id, payAmount, userId!, note?.trim() || 'Pembayaran hutang', payment_method);

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
