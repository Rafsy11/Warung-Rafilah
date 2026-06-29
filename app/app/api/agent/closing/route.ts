import { NextResponse } from 'next/server';
import { db as pool } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { closed_by, closing_date, opening_float, closing_float, total_transactions, total_commission, total_admin_fee } = await req.json();

    const { rows } = await pool.query(
      `INSERT INTO agent.daily_closing (closing_date, opening_float, closing_float, total_transactions, total_commission, total_admin_fee, closed_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'closed') RETURNING *`,
      [closing_date, opening_float, closing_float, total_transactions, total_commission, total_admin_fee, closed_by]
    );

    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    const error = err as { code?: string };
    if (error.code === '23505') { // unique_violation
      return NextResponse.json({ error: { code: 'already_closed', message: 'Agent register already closed for this date' } }, { status: 409 });
    }
    return NextResponse.json({ error: { code: 'internal_error', message: 'Database error' } }, { status: 500 });
  }
}
