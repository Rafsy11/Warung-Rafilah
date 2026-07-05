import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';

const discountSchema = z.object({
  name: z.string().min(1, 'Nama diskon wajib diisi'),
  discount_type: z.enum(['global', 'product']),
  value_type: z.enum(['fixed', 'percentage']),
  discount_value: z.number().positive('Nilai diskon harus lebih besar dari 0'),
  product_id: z.string().uuid().nullable().optional(),
  min_purchase_amount: z.number().nonnegative().optional().default(0),
  is_active: z.boolean().optional().default(true),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const activeOnly = searchParams.get('active') === 'true';

    let query = `
      SELECT d.id, d.name, d.discount_type, d.value_type, d.discount_value::float as discount_value, 
             d.product_id, d.min_purchase_amount::float as min_purchase_amount, d.is_active, d.created_at, 
             p.name as product_name, p.barcode as product_barcode
      FROM warung.discounts d
      LEFT JOIN warung.products p ON d.product_id = p.id
    `;
    
    if (activeOnly) {
      query += ` WHERE d.is_active = true`;
    }

    query += ` ORDER BY d.created_at DESC`;

    const { rows } = await db.query(query);
    return NextResponse.json({ items: rows });
  } catch (err) {
    console.error('discounts GET error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userRole = req.headers.get('x-user-role');
  if (userRole !== 'owner') {
    return NextResponse.json({ error: 'Akses ditolak. Hanya owner yang diizinkan.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = discountSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Data tidak valid', details: parsed.error.issues }, { status: 400 });
    }

    const { name, discount_type, value_type, discount_value, product_id, min_purchase_amount, is_active } = parsed.data;

    // Validation: Product discount must specify product_id
    if (discount_type === 'product' && !product_id) {
      return NextResponse.json({ error: 'Diskon produk wajib menentukan produk.' }, { status: 400 });
    }

    const { rows } = await db.query(
      `INSERT INTO warung.discounts (name, discount_type, value_type, discount_value, product_id, min_purchase_amount, is_active) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING id, name, discount_type, value_type, discount_value::float as discount_value, product_id, min_purchase_amount::float as min_purchase_amount, is_active`,
      [
        name.trim(), 
        discount_type, 
        value_type, 
        discount_value, 
        discount_type === 'product' ? product_id : null, 
        discount_type === 'global' ? min_purchase_amount : 0, 
        is_active
      ]
    );

    return NextResponse.json({ success: true, discount: rows[0] }, { status: 201 });
  } catch (err) {
    console.error('discounts POST error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
