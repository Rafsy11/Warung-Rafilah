import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = requireRole(req, ['owner', 'cashier']);
  if (forbidden) return forbidden;

  const { id } = await params;
  try {
    // Fetch debt ledger entries
    const { rows: ledger } = await db.query(
      `SELECT dl.id, dl.entry_type, dl.amount, dl.balance_after, dl.note, dl.created_at, u.full_name as created_by_name
       FROM warung.debt_ledger dl
       LEFT JOIN core.users u ON dl.created_by = u.id
       WHERE dl.customer_id = $1
       ORDER BY dl.created_at DESC`,
      [id]
    );

    // Fetch sales linked to customer
    const { rows: sales } = await db.query(
      `SELECT id, transaction_code, total_amount, payment_method, status, created_at
       FROM warung.sales
       WHERE customer_id = $1
       ORDER BY created_at DESC`,
      [id]
    );

    return NextResponse.json({ ledger, sales });
  } catch (err) {
    console.error('customer history GET error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
