import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  let cashierId = req.headers.get('x-user-id');
  if (!cashierId) {
    // Dev fallback
    const userResult = await db.query('SELECT id FROM core.users LIMIT 1');
    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }
    cashierId = userResult.rows[0].id;
  }

  try {
    const { startingCash } = await req.json();
    const startingCashNum = Number(startingCash);

    if (isNaN(startingCashNum) || startingCashNum < 0) {
      return NextResponse.json({ error: 'Modal awal tidak valid.' }, { status: 400 });
    }

    // Check if there is an active session
    const activeRes = await db.query(
      `SELECT id FROM warung.cashier_sessions WHERE cashier_id = $1 AND status = 'open'`,
      [cashierId]
    );

    if (activeRes.rows.length > 0) {
      return NextResponse.json({ error: 'Anda sudah memiliki sesi kasir yang sedang aktif.' }, { status: 400 });
    }

    const { rows } = await db.query(
      `INSERT INTO warung.cashier_sessions (cashier_id, starting_cash, status) 
       VALUES ($1, $2, 'open') 
       RETURNING id, cashier_id, opened_at, starting_cash, status`,
      [cashierId, startingCashNum]
    );

    return NextResponse.json({ success: true, session: rows[0] }, { status: 201 });
  } catch (err) {
    console.error('open session POST error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
