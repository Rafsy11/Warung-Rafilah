import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';

export async function GET(req: NextRequest) {
  const denied = requireRole(req, ['owner', 'cashier']);
  if (denied) return denied;
  const key = req.nextUrl.searchParams.get('key');
  if (key && !/^[0-9a-f-]{36}$/i.test(key)) return NextResponse.json({ error: 'ID tidak valid.' }, { status: 400 });
  const { rows } = await db.query(`SELECT s.*, u.full_name FROM warung.sales s
    JOIN core.users u ON u.id=s.cashier_id
    WHERE s.cashier_id=$1 AND ${key ? 's.checkout_key=$2' : "s.status='pending'"}
    ORDER BY s.created_at ASC LIMIT 1`, key ? [req.headers.get('x-user-id'),key] : [req.headers.get('x-user-id')]);
  if (!rows.length) return NextResponse.json({ sale: null });
  const sale = rows[0];
  if (sale.receipt_snapshot) return NextResponse.json({ sale: { ...sale.receipt_snapshot, status: sale.status } });
  const items = await db.query(`SELECT COALESCE(si.product_name_snapshot,p.name) as name,
    si.qty::float as qty, si.unit_price::float as unit_price, si.subtotal::float as subtotal
    FROM warung.sale_items si JOIN warung.products p ON p.id=si.product_id WHERE sale_id=$1`, [sale.id]);
  return NextResponse.json({ sale: { saleId: sale.id, transaction_code: sale.transaction_code,
    status: sale.status, total_amount: Number(sale.total_amount),
    receipt: { type: 'warung', transaction_code: sale.transaction_code, cashier: sale.full_name,
      items: items.rows, total: Number(sale.total_amount), discount: Number(sale.discount),
      payment_method: sale.payment_method.toUpperCase(), payment_received: Number(sale.payment_received),
      split_cash_amount: Number(sale.split_cash_amount), split_qris_amount: Number(sale.split_qris_amount),
      change: Number(sale.change_given), timestamp: sale.created_at }
  } });
}
