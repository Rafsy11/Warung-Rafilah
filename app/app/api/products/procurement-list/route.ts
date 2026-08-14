import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';

export async function GET(req: NextRequest) {
  const forbidden = requireRole(req, ['owner', 'cashier']);
  if (forbidden) return forbidden;
  try {
    const { rows } = await db.query(
      `SELECT id, barcode, name, category, unit, cost_price, stock_qty, reorder_threshold,
              (reorder_threshold * 2 - stock_qty) as suggested_qty,
              (cost_price * (reorder_threshold * 2 - stock_qty)) as estimated_cost
       FROM warung.products
       WHERE is_active = true
         AND reorder_threshold > 0
         AND stock_qty <= reorder_threshold
       ORDER BY stock_qty ASC, name ASC`
    );

    const totalEstimatedCost = rows.reduce(
      (sum: number, r: { estimated_cost: string | number }) => sum + Math.max(0, Number(r.estimated_cost)),
      0
    );

    return NextResponse.json({
      items: rows,
      count: rows.length,
      total_estimated_cost: totalEstimatedCost,
    });
  } catch (err) {
    console.error('Error fetching procurement list:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
