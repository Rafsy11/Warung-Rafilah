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
      `SELECT sm.id, sm.movement_type, sm.qty_change, sm.reference_id, sm.note, sm.created_at,
              p.name as product_name, p.barcode as product_barcode, p.cost_price, u.full_name as user_name
       FROM warung.stock_movements sm
       JOIN warung.products p ON sm.product_id = p.id
       LEFT JOIN core.users u ON sm.created_by = u.id
       ORDER BY sm.created_at DESC
       LIMIT 100`
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching stock movements:', error);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Gagal mengambil data riwayat stok.' } },
      { status: 500 }
    );
  }
}
