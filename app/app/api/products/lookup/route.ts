import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';

const querySchema = z.object({
  barcode: z.string().min(1)
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barcode = searchParams.get('barcode');
    
    const parsed = querySchema.safeParse({ barcode });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid or missing barcode parameter' }, { status: 400 });
    }

    const result = await db.query(
      `SELECT id, name, category, sell_price AS price, stock_qty AS stock, barcode, is_active,
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
       WHERE barcode = $1 AND is_active = true 
       LIMIT 1`,
      [parsed.data.barcode]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ data: result.rows[0] });
  } catch (error) {
    console.error('DB Error in lookup:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
