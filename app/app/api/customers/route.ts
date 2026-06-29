import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const search = searchParams.get('search') ?? '';
    const query = search 
      ? `SELECT id, name, phone, address, credit_limit, current_debt FROM warung.customers WHERE is_active = true AND name ILIKE $1 ORDER BY name ASC`
      : `SELECT id, name, phone, address, credit_limit, current_debt FROM warung.customers WHERE is_active = true ORDER BY name ASC`;
    const params = search ? [`%${search}%`] : [];
    const { rows } = await db.query(query, params);
    return NextResponse.json({ items: rows });
  } catch (err) {
    console.error('customers GET error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userRole = req.headers.get('x-user-role');
  if (userRole !== 'owner') {
    return NextResponse.json({ error: 'Akses ditolak. Hanya owner yang diizinkan.' }, { status: 403 });
  }
  try {
    const { name, phone, address, credit_limit } = await req.json();
    if (!name) {
      return NextResponse.json({ error: 'Nama pelanggan wajib diisi.' }, { status: 400 });
    }
    const limit = credit_limit ? Number(credit_limit) : 500000.00;
    const { rows } = await db.query(
      `INSERT INTO warung.customers (name, phone, address, credit_limit) 
       VALUES ($1, $2, $3, $4) RETURNING id, name, phone, address, credit_limit, current_debt`,
      [name.trim(), phone?.trim() || null, address?.trim() || null, limit]
    );
    return NextResponse.json({ success: true, customer: rows[0] }, { status: 201 });
  } catch (err) {
    console.error('customers POST error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
