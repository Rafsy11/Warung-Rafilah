import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userRole = req.headers.get('x-user-role');
  if (userRole !== 'owner') {
    return NextResponse.json({ error: 'Akses ditolak. Hanya owner yang diizinkan.' }, { status: 403 });
  }
  const { id } = await params;
  try {
    const { name, phone, address, credit_limit } = await req.json();
    if (!name) {
      return NextResponse.json({ error: 'Nama pelanggan wajib diisi.' }, { status: 400 });
    }
    const limit = credit_limit ? Number(credit_limit) : 500000.00;
    const { rowCount } = await db.query(
      `UPDATE warung.customers 
       SET name = $1, phone = $2, address = $3, credit_limit = $4, updated_at = NOW() 
       WHERE id = $5 AND is_active = true`,
      [name.trim(), phone?.trim() || null, address?.trim() || null, limit, id]
    );
    if (rowCount === 0) {
      return NextResponse.json({ error: 'Pelanggan tidak ditemukan atau tidak aktif.' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('customer PATCH error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userRole = req.headers.get('x-user-role');
  if (userRole !== 'owner') {
    return NextResponse.json({ error: 'Akses ditolak. Hanya owner yang diizinkan.' }, { status: 403 });
  }
  const { id } = await params;
  try {
    const { rowCount } = await db.query(
      `UPDATE warung.customers SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [id]
    );
    if (rowCount === 0) {
      return NextResponse.json({ error: 'Pelanggan tidak ditemukan.' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('customer DELETE error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
