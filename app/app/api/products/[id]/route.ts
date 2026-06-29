import { NextResponse } from 'next/server';
import { db as pool } from '@/lib/db';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userRole = req.headers.get('x-user-role');
  if (userRole !== 'owner') {
    return NextResponse.json({ error: { code: 'forbidden', message: 'Only owner can perform this action' } }, { status: 403 });
  }

  const { id } = await params;
  try {
    const body = await req.json();
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(body)) {
      updates.push(`${key} = $${idx}`);
      values.push(value);
      idx++;
    }

    if (updates.length === 0) return NextResponse.json({ error: { code: 'bad_request', message: 'No updates provided' } }, { status: 400 });

    values.push(id);
    const query = `UPDATE warung.products SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`;
    
    const { rows } = await pool.query(query, values);
    if (rows.length === 0) return NextResponse.json({ error: { code: 'not_found', message: 'Product not found' } }, { status: 404 });
    
    return NextResponse.json(rows[0]);
  } catch {
    return NextResponse.json({ error: { code: 'internal_error', message: 'Database error' } }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userRole = req.headers.get('x-user-role');
  if (userRole !== 'owner') {
    return NextResponse.json({ error: { code: 'forbidden', message: 'Only owner can perform this action' } }, { status: 403 });
  }

  const { id } = await params;
  try {
    const { rows } = await pool.query(`UPDATE warung.products SET is_active = false WHERE id = $1 RETURNING *`, [id]);
    if (rows.length === 0) return NextResponse.json({ error: { code: 'not_found', message: 'Product not found' } }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: { code: 'internal_error', message: 'Database error' } }, { status: 500 });
  }
}
