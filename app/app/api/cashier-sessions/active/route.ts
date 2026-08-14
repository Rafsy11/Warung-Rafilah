import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/rbac';

export async function GET(req: NextRequest) {
  const { errorResponse, userId: cashierId } = requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { rows } = await db.query(
      `SELECT id, cashier_id, opened_at, starting_cash, status 
       FROM warung.cashier_sessions 
       WHERE cashier_id = $1 AND status = 'open' 
       ORDER BY opened_at DESC 
       LIMIT 1`,
      [cashierId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ session: null });
    }

    return NextResponse.json({ session: rows[0] });
  } catch (err) {
    console.error('active session GET error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
