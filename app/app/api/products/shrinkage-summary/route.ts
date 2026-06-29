import { NextResponse } from 'next/server';
import { db as pool } from '@/lib/db';

export async function GET(req: Request) {
  const userRole = req.headers.get('x-user-role');
  if (userRole !== 'owner') {
    return NextResponse.json(
      { error: { code: 'forbidden', message: 'Akses ditolak. Hanya owner yang diizinkan.' } },
      { status: 403 }
    );
  }

  try {
    const { rows } = await pool.query(
      `SELECT 
         sm.movement_type,
         COUNT(*)::int as total_occurrences,
         SUM(ABS(sm.qty_change))::float as total_qty,
         SUM(ABS(sm.qty_change) * p.cost_price)::float as total_loss
       FROM warung.stock_movements sm
       JOIN warung.products p ON sm.product_id = p.id
       WHERE sm.movement_type IN ('damaged', 'expired', 'stolen')
       GROUP BY sm.movement_type`
    );

    return NextResponse.json({ summary: rows });
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching shrinkage summary:', error);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Gagal memproses ringkasan penyusutan.' } },
      { status: 500 }
    );
  }
}
