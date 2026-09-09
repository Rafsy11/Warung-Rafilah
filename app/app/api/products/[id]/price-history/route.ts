import { NextResponse } from 'next/server';
import { db as pool } from '@/lib/db';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { rows } = await pool.query(
      `SELECT
         id, product_id,
         old_sell_price, new_sell_price,
         old_cost_price, new_cost_price,
         changed_at, source
       FROM warung.product_price_history
       WHERE product_id = $1
       ORDER BY changed_at DESC
       LIMIT 50`,
      [id]
    );

    return NextResponse.json({ history: rows });
  } catch (err) {
    console.error('Price history fetch error:', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Database error' } },
      { status: 500 }
    );
  }
}
