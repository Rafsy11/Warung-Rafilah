import { NextResponse } from 'next/server';
import { db as pool } from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search');
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  try {
    let query = `
      SELECT id, barcode, name, category, unit, cost_price, sell_price, stock_qty, reorder_threshold,
             is_consignment, consignment_supplier_name, consignment_cost_share, nearest_expiry_date,
             COALESCE(
               (SELECT json_agg(t ORDER BY min_qty) 
                FROM warung.product_pricing_tiers t 
                WHERE t.product_id = warung.products.id), 
               '[]'::json
             ) as pricing_tiers,
             (SELECT json_build_object(
                'id', d.id,
                'name', d.name,
                'discount_type', d.discount_type,
                'value_type', d.value_type,
                'discount_value', d.discount_value::float
              )
              FROM warung.discounts d
              WHERE d.product_id = warung.products.id AND d.is_active = true
              LIMIT 1
             ) as active_discount
      FROM warung.products 
      WHERE is_active = true`;
    const params: unknown[] = [];
    if (search) {
      query += ` AND (name ILIKE $1 OR barcode ILIKE $1)`;
      params.push(`%${search}%`);
    }
    query += ` LIMIT $${params.length + 1}`;
    params.push(limit);

    const { rows } = await pool.query(query, params);
    return NextResponse.json({ items: rows, total: rows.length });
  } catch {
    return NextResponse.json({ error: { code: 'internal_error', message: 'Database error' } }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const userRole = req.headers.get('x-user-role');
  if (userRole !== 'owner') {
    return NextResponse.json({ error: { code: 'forbidden', message: 'Only owner can perform this action' } }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { 
      barcode, name, category, unit, cost_price, sell_price, stock_qty, reorder_threshold,
      is_consignment, consignment_supplier_name, consignment_cost_share, nearest_expiry_date
    } = body;

    const { rows: existing } = await pool.query('SELECT id, is_active FROM warung.products WHERE barcode = $1', [barcode]);
    if (existing.length > 0) {
      const prod = existing[0];
      if (prod.is_active) {
        return NextResponse.json({ error: { code: 'barcode_exists', message: 'A product with this barcode already exists.' } }, { status: 409 });
      } else {
        // Reactivate and update the soft-deleted product
        const { rows } = await pool.query(
          `UPDATE warung.products 
           SET name = $1, category = $2, unit = $3, cost_price = $4, sell_price = $5, stock_qty = $6, reorder_threshold = $7,
               is_consignment = $8, consignment_supplier_name = $9, consignment_cost_share = $10, nearest_expiry_date = $11,
               is_active = true, updated_at = now()
           WHERE id = $12 RETURNING *`,
          [
            name, category, unit, cost_price, sell_price, stock_qty, reorder_threshold,
            is_consignment || false, consignment_supplier_name || null, consignment_cost_share || 0,
            nearest_expiry_date || null, prod.id
          ]
        );
        return NextResponse.json(rows[0], { status: 201 });
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO warung.products 
       (barcode, name, category, unit, cost_price, sell_price, stock_qty, reorder_threshold, is_consignment, consignment_supplier_name, consignment_cost_share, nearest_expiry_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [
        barcode, name, category, unit, cost_price, sell_price, stock_qty, reorder_threshold,
        is_consignment || false, consignment_supplier_name || null, consignment_cost_share || 0,
        nearest_expiry_date || null
      ]
    );

    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("Product Create Error:", err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Database error' } }, { status: 500 });
  }
}
