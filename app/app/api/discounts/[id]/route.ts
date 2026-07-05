import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';

const discountUpdateSchema = z.object({
  name: z.string().min(1, 'Nama diskon wajib diisi').optional(),
  discount_type: z.enum(['global', 'product']).optional(),
  value_type: z.enum(['fixed', 'percentage']).optional(),
  discount_value: z.number().positive('Nilai diskon harus lebih besar dari 0').optional(),
  product_id: z.string().uuid().nullable().optional(),
  min_purchase_amount: z.number().nonnegative().optional(),
  is_active: z.boolean().optional(),
});

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userRole = req.headers.get('x-user-role');
  if (userRole !== 'owner') {
    return NextResponse.json({ error: 'Akses ditolak. Hanya owner yang diizinkan.' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = discountUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Data tidak valid', details: parsed.error.issues }, { status: 400 });
    }

    // Get current record to perform dependency validation if type changes
    const curRes = await db.query('SELECT * FROM warung.discounts WHERE id = $1', [id]);
    if (curRes.rows.length === 0) {
      return NextResponse.json({ error: 'Diskon tidak ditemukan.' }, { status: 404 });
    }
    const current = curRes.rows[0];

    const updates = parsed.data;
    const finalType = updates.discount_type ?? current.discount_type;
    const finalProductId = 'product_id' in updates ? updates.product_id : current.product_id;

    if (finalType === 'product' && !finalProductId) {
      return NextResponse.json({ error: 'Diskon produk wajib menentukan produk.' }, { status: 400 });
    }

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        setClauses.push(`${key} = $${idx}`);
        // Handle database specific inputs
        if (key === 'product_id' && finalType === 'global') {
          values.push(null);
        } else {
          values.push(value);
        }
        idx++;
      }
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: 'Tidak ada perubahan yang dikirim.' }, { status: 400 });
    }

    values.push(id);
    const query = `
      UPDATE warung.discounts 
      SET ${setClauses.join(', ')}, updated_at = NOW() 
      WHERE id = $${idx} 
      RETURNING id, name, discount_type, value_type, discount_value::float as discount_value, product_id, min_purchase_amount::float as min_purchase_amount, is_active
    `;

    const { rows } = await db.query(query, values);
    return NextResponse.json({ success: true, discount: rows[0] });
  } catch (err) {
    console.error('discounts PUT error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userRole = req.headers.get('x-user-role');
  if (userRole !== 'owner') {
    return NextResponse.json({ error: 'Akses ditolak. Hanya owner yang diizinkan.' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const { rows } = await db.query('DELETE FROM warung.discounts WHERE id = $1 RETURNING *', [id]);
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Diskon tidak ditemukan.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Diskon berhasil dihapus.' });
  } catch (err) {
    console.error('discounts DELETE error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
