import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { rows } = await db.query(
      `SELECT id, product_id, min_qty::float as min_qty, tier_price::float as tier_price, name 
       FROM warung.product_pricing_tiers 
       WHERE product_id = $1 
       ORDER BY min_qty ASC`,
      [id]
    );

    return NextResponse.json({ tiers: rows });
  } catch (err) {
    console.error('Error fetching tiers:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userRole = req.headers.get('x-user-role');
  
  if (userRole !== 'owner') {
    return NextResponse.json(
      { error: 'Akses ditolak. Hanya owner yang diizinkan.' },
      { status: 403 }
    );
  }

  const client = await db.connect();
  try {
    const body = await req.json();
    const { tiers } = body; // Array of { min_qty: number, tier_price: number, name: string }

    if (!Array.isArray(tiers)) {
      return NextResponse.json({ error: 'Format data tidak valid. Tiers harus berupa array.' }, { status: 400 });
    }

    // Validate tiers structure
    for (const t of tiers) {
      if (t.min_qty === undefined || isNaN(Number(t.min_qty)) || Number(t.min_qty) <= 0) {
        return NextResponse.json({ error: 'Kuantitas minimum harus berupa angka positif.' }, { status: 400 });
      }
      if (t.tier_price === undefined || isNaN(Number(t.tier_price)) || Number(t.tier_price) < 0) {
        return NextResponse.json({ error: 'Harga tingkatan harus berupa angka positif.' }, { status: 400 });
      }
      if (!t.name || t.name.trim() === '') {
        return NextResponse.json({ error: 'Nama tingkatan harga wajib diisi.' }, { status: 400 });
      }
    }

    await client.query('BEGIN');

    // Remove existing tiers
    await client.query(
      'DELETE FROM warung.product_pricing_tiers WHERE product_id = $1',
      [id]
    );

    // Insert new tiers
    for (const t of tiers) {
      await client.query(
        `INSERT INTO warung.product_pricing_tiers (product_id, min_qty, tier_price, name)
         VALUES ($1, $2, $3, $4)`,
        [id, Number(t.min_qty), Number(t.tier_price), t.name.trim()]
      );
    }

    await client.query('COMMIT');
    return NextResponse.json({ success: true, message: 'Pricing tiers successfully saved.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error saving tiers:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  } finally {
    client.release();
  }
}
