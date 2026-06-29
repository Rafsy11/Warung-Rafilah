import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/** GET: List all conversion mappings */
export async function GET() {
  try {
    const { rows } = await db.query(
      `SELECT cm.id, cm.source_product_id, cm.dest_product_id, cm.conversion_ratio, cm.auto_convert,
              sp.name as source_name, sp.barcode as source_barcode, sp.unit as source_unit, sp.stock_qty as source_stock,
              dp.name as dest_name, dp.barcode as dest_barcode, dp.unit as dest_unit, dp.stock_qty as dest_stock
       FROM warung.product_conversion_map cm
       JOIN warung.products sp ON cm.source_product_id = sp.id AND sp.is_active = true
       JOIN warung.products dp ON cm.dest_product_id = dp.id AND dp.is_active = true
       ORDER BY sp.name, dp.name`
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    console.error('Error fetching conversion map:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/** POST: Create a new conversion mapping */
export async function POST(req: NextRequest) {
  const userRole = req.headers.get('x-user-role');
  if (userRole !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { source_product_id, dest_product_id, conversion_ratio, auto_convert } = await req.json();

    if (!source_product_id || !dest_product_id || !conversion_ratio) {
      return NextResponse.json({ error: 'Parameter tidak lengkap.' }, { status: 400 });
    }

    if (source_product_id === dest_product_id) {
      return NextResponse.json({ error: 'Produk sumber dan tujuan tidak boleh sama.' }, { status: 400 });
    }

    const ratio = Number(conversion_ratio);
    if (isNaN(ratio) || ratio <= 0) {
      return NextResponse.json({ error: 'Rasio konversi harus lebih besar dari 0.' }, { status: 400 });
    }

    const { rows } = await db.query(
      `INSERT INTO warung.product_conversion_map (source_product_id, dest_product_id, conversion_ratio, auto_convert)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (source_product_id, dest_product_id) 
       DO UPDATE SET conversion_ratio = $3, auto_convert = $4
       RETURNING *`,
      [source_product_id, dest_product_id, ratio, auto_convert !== false]
    );

    return NextResponse.json({ success: true, item: rows[0] });
  } catch (err) {
    console.error('Error creating conversion map:', err);
    return NextResponse.json({ error: 'Gagal menyimpan peta konversi.' }, { status: 500 });
  }
}

/** DELETE: Remove a conversion mapping */
export async function DELETE(req: NextRequest) {
  const userRole = req.headers.get('x-user-role');
  if (userRole !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'ID diperlukan.' }, { status: 400 });
    }

    await db.query('DELETE FROM warung.product_conversion_map WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error deleting conversion map:', err);
    return NextResponse.json({ error: 'Gagal menghapus peta konversi.' }, { status: 500 });
  }
}
