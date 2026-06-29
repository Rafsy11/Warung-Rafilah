import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { rows } = await db.query(
      `SELECT s.id, s.opened_at, s.closed_at, s.starting_cash, s.expected_cash, s.actual_cash, s.cash_difference, 
              s.total_cash_sales, s.total_qris_sales, s.total_debt_sales, s.status, s.notes, u.username as cashier_name 
       FROM warung.cashier_sessions s 
       JOIN core.users u ON s.cashier_id = u.id 
       ORDER BY s.opened_at DESC 
       LIMIT 100`
    );

    return NextResponse.json({ items: rows });
  } catch (err) {
    console.error('cashier sessions list GET error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
