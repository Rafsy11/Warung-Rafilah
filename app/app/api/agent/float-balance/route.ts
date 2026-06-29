import { NextResponse } from 'next/server';
import { db as pool } from '@/lib/db';

export async function GET() {
  try {
    const { rows } = await pool.query(
      `SELECT balance_after FROM agent.float_ledger ORDER BY id DESC LIMIT 1`
    );
    const balance = rows.length > 0 ? parseFloat(rows[0].balance_after) : 0;
    return NextResponse.json({ balance });
  } catch {
    return NextResponse.json({ error: { code: 'internal_error', message: 'Database error' } }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const userRole = req.headers.get('x-user-role');
  if (userRole !== 'owner') {
    return NextResponse.json({ error: { code: 'forbidden', message: 'Only owner can adjust float balance' } }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { amount, note } = body;

    const amountNum = parseFloat(amount);
    if (amountNum === 0 || isNaN(amountNum)) {
      return NextResponse.json({ error: { code: 'bad_request', message: 'Jumlah nominal penyesuaian harus valid dan bukan nol' } }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const ledgerResult = await client.query(
        'SELECT balance_after FROM agent.float_ledger ORDER BY id DESC LIMIT 1 FOR UPDATE'
      );
      const currentFloat = ledgerResult.rows.length > 0 ? parseFloat(ledgerResult.rows[0].balance_after) : 0;
      const newFloat = currentFloat + amountNum;

      if (newFloat < 0) {
        throw new Error('Penyesuaian menyebabkan saldo akhir negatif');
      }

      // If amount is positive, it's deposit_in. If negative, it's deposit_out.
      const entryType = amountNum > 0 ? 'deposit_in' : 'deposit_out';

      await client.query(
        `INSERT INTO agent.float_ledger (entry_type, amount, balance_after, note)
         VALUES ($1, $2, $3, $4)`,
        [entryType, Math.abs(amountNum), newFloat, note || 'Penyesuaian manual oleh Admin']
      );

      await client.query('COMMIT');
      return NextResponse.json({ success: true, newBalance: newFloat });
    } catch (e) {
      await client.query('ROLLBACK');
      const msg = e instanceof Error ? e.message : 'Transaksi database gagal';
      return NextResponse.json({ error: { code: 'bad_request', message: msg } }, { status: 400 });
    } finally {
      client.release();
    }
  } catch {
    return NextResponse.json({ error: { code: 'internal_error', message: 'Gagal memproses data' } }, { status: 500 });
  }
}
