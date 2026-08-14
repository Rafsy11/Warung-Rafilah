import { NextResponse } from 'next/server';
import { db as pool } from '@/lib/db';
import { requireRole } from '@/lib/rbac';

export async function GET(req: Request) {
  const forbidden = requireRole(req, ['owner', 'cashier']);
  if (forbidden) return forbidden;
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  
  try {
    let query = `SELECT sale_date, transaction_count, gross_revenue, cash_revenue, qris_revenue, transfer_revenue, gross_margin FROM warung.v_daily_summary`;
    const params: unknown[] = [];
    if (date) {
      query += ` WHERE sale_date = $1`;
      params.push(date);
    } else {
      query += ` ORDER BY sale_date DESC LIMIT 1`;
    }
    
    const { rows } = await pool.query(query, params);
    if (rows.length === 0) {
      return NextResponse.json({ 
        sale_date: date, 
        transaction_count: 0, 
        gross_revenue: "0.00", 
        cash_revenue: "0.00", 
        qris_revenue: "0.00", 
        transfer_revenue: "0.00", 
        gross_margin: "0.00" 
      });
    }
    return NextResponse.json(rows[0]);
  } catch {
    return NextResponse.json({ error: { code: 'internal_error', message: 'Database error' } }, { status: 500 });
  }
}
