import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const days = Number(req.nextUrl.searchParams.get('days') || '7');

  try {
    const { rows } = await db.query(
      `SELECT id, barcode, name, category, unit, stock_qty, nearest_expiry_date,
              (nearest_expiry_date - CURRENT_DATE) as days_until_expiry
       FROM warung.products
       WHERE is_active = true
         AND nearest_expiry_date IS NOT NULL
         AND nearest_expiry_date <= CURRENT_DATE + $1::int
       ORDER BY nearest_expiry_date ASC`,
      [days]
    );

    return NextResponse.json({ items: rows, count: rows.length });
  } catch (err) {
    console.error('Error fetching expiring products:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
