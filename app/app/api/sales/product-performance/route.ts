import { NextResponse } from 'next/server';
import { db as pool } from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const userRole = req.headers.get('x-user-role');

  if (userRole !== 'owner') {
    return NextResponse.json(
      { error: { code: 'forbidden', message: 'Akses ditolak. Hanya owner yang diizinkan.' } },
      { status: 403 }
    );
  }

  try {
    const { rows } = await pool.query(
      `SELECT p.name, p.barcode, p.category, p.unit,
              SUM(si.qty) as total_qty,
              SUM(si.subtotal) as total_revenue,
              SUM(si.subtotal - (si.cost_price_snapshot * si.qty)) as total_margin
       FROM warung.sales s
       JOIN warung.sale_items si ON si.sale_id = s.id
       JOIN warung.products p ON si.product_id = p.id
       WHERE s.status = 'completed'
         AND date_trunc('day', s.created_at) = $1
       GROUP BY p.id, p.name, p.barcode, p.category, p.unit
       ORDER BY total_revenue DESC`,
      [date]
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching product performance:', error);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Gagal mengambil data kinerja produk.' } },
      { status: 500 }
    );
  }
}
