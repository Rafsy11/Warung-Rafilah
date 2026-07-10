import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';

const quickAddSchema = z.object({
  barcode:    z.string().min(1),
  name:       z.string().min(1).max(200),
  sell_price: z.number().positive(),
  category:   z.string().max(50).optional().default('Lainnya'),
});

/**
 * POST /api/products/quick-add
 * Lightweight product creation for the checkout flow.
 * Unlike POST /api/products (owner-only), this is accessible by any cashier
 * so they can register unknown barcodes without leaving the POS screen.
 *
 * Only creates minimal records — cost_price defaults to 0, stock defaults to 999.
 * Owner can refine details later via Admin panel.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = quickAddSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'validation_error', message: 'Data tidak valid', details: parsed.error.issues } },
        { status: 400 }
      );
    }

    const { barcode, name, sell_price, category } = parsed.data;

    // Check for existing barcode (active or soft-deleted)
    const { rows: existing } = await db.query(
      'SELECT id, is_active FROM warung.products WHERE barcode = $1',
      [barcode]
    );

    if (existing.length > 0) {
      const prod = existing[0];
      if (prod.is_active) {
        return NextResponse.json(
          { error: { code: 'barcode_exists', message: 'Produk dengan barcode ini sudah terdaftar.' } },
          { status: 409 }
        );
      }

      // Reactivate soft-deleted product with new data
      const { rows } = await db.query(
        `UPDATE warung.products
         SET name = $1, sell_price = $2, category = $3,
             is_active = true, updated_at = now()
         WHERE id = $4
         RETURNING id, barcode, name, sell_price, category`,
        [name, sell_price, category, prod.id]
      );
      return NextResponse.json(rows[0], { status: 201 });
    }

    // Insert new product with sensible defaults
    const STOCK_DEFAULT    = 999;
    const COST_DEFAULT     = 0;
    const REORDER_DEFAULT  = 5;

    const { rows } = await db.query(
      `INSERT INTO warung.products
         (barcode, name, category, unit, cost_price, sell_price, stock_qty, reorder_threshold)
       VALUES ($1, $2, $3, 'pcs', $4, $5, $6, $7)
       RETURNING id, barcode, name, sell_price, category`,
      [barcode, name, category, COST_DEFAULT, sell_price, STOCK_DEFAULT, REORDER_DEFAULT]
    );

    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error('Quick-add product error:', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Gagal menyimpan produk.' } },
      { status: 500 }
    );
  }
}
