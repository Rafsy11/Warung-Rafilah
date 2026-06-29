import { NextResponse } from 'next/server';
import { db as pool } from '@/lib/db';

export async function GET() {
  try {
    const { rows } = await pool.query(
      `SELECT id, entry_type, amount, balance_after, note, created_at 
       FROM agent.float_ledger 
       ORDER BY id DESC 
       LIMIT 20`
    );
    return NextResponse.json({ items: rows });
  } catch {
    return NextResponse.json({ error: { code: 'internal_error', message: 'Database error' } }, { status: 500 });
  }
}
