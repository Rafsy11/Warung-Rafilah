import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';

export async function GET(req: NextRequest) {
  const forbidden = requireRole(req, ['owner', 'cashier']);
  if (forbidden) return forbidden;
  const { searchParams } = req.nextUrl;
  const id = searchParams.get('id');
  
  if (!id) {
    return NextResponse.json({ error: 'Missing sale ID' }, { status: 400 });
  }

  try {
    const res = await db.query(
      'SELECT id, transaction_code, status, total_amount, payment_method FROM warung.sales WHERE id = $1',
      [id]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      id: res.rows[0].id,
      transaction_code: res.rows[0].transaction_code,
      status: res.rows[0].status, 
      total_amount: Number(res.rows[0].total_amount),
      payment_method: res.rows[0].payment_method
    });
  } catch (err) {
    console.error('Error fetching sale status:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
