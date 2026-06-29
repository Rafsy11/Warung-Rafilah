import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const isSummary = searchParams.get('summary') === 'true';

  try {
    if (isSummary) {
      // Group by supplier name and calculate unpaid debt
      const { rows } = await db.query(
        `SELECT 
           supplier_name,
           SUM(qty_sold)::float as total_sold_qty,
           SUM(CASE WHEN status = 'unpaid' THEN total_owed ELSE 0 END)::float as total_unpaid_owed,
           SUM(CASE WHEN status = 'paid' THEN total_owed ELSE 0 END)::float as total_paid_owed
         FROM warung.consignment_ledger
         GROUP BY supplier_name
         ORDER BY supplier_name ASC`
      );
      return NextResponse.json({ summary: rows });
    } else {
      // Fetch detailed logs
      const { rows } = await db.query(
        `SELECT 
           cl.id, 
           cl.supplier_name, 
           cl.qty_sold::float as qty_sold, 
           cl.cost_share::float as cost_share, 
           cl.total_owed::float as total_owed, 
           cl.status, 
           cl.paid_at, 
           cl.created_at, 
           p.name as product_name,
           p.unit as product_unit
         FROM warung.consignment_ledger cl 
         JOIN warung.products p ON cl.product_id = p.id 
         ORDER BY cl.created_at DESC 
         LIMIT 200`
      );
      return NextResponse.json({ logs: rows });
    }
  } catch (err) {
    console.error('Error fetching consignment ledger:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userRole = req.headers.get('x-user-role');
  if (userRole !== 'owner') {
    return NextResponse.json(
      { error: 'Akses ditolak. Hanya owner yang diizinkan.' },
      { status: 403 }
    );
  }

  try {
    const { supplier_name } = await req.json();
    if (!supplier_name || supplier_name.trim() === '') {
      return NextResponse.json({ error: 'Nama supplier/penitip wajib ditentukan.' }, { status: 400 });
    }

    const { rowCount } = await db.query(
      `UPDATE warung.consignment_ledger 
       SET status = 'paid', paid_at = now() 
       WHERE supplier_name = $1 AND status = 'unpaid'`,
      [supplier_name.trim()]
    );

    return NextResponse.json({
      success: true,
      message: `Berhasil melunasi setoran barang titipan untuk ${supplier_name.trim()}.`,
      updatedRows: rowCount
    });
  } catch (err) {
    console.error('Error settling consignment:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
