import { beginTransaction } from '@/lib/transaction';
import { logStockChange } from '@/lib/product-write';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { requireRole } from '@/lib/rbac';

const quickAddSchema = z.object({
  barcode:    z.string().min(1),
  name:       z.string().min(1).max(200),
  sell_price: z.number().positive(),
  cost_price: z.number().nonnegative(),
  stock_qty: z.number().int().positive(),
  category:   z.string().max(50).optional().default('Lainnya'),
});

export async function POST(request: NextRequest) {
  const forbidden = requireRole(request, ['owner', 'cashier']);
  if (forbidden) return forbidden;

  try {
    const body = await request.json();
    const parsed = quickAddSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'validation_error', message: 'Data tidak valid', details: parsed.error.issues } },
        { status: 400 }
      );
    }

    const { barcode, name, sell_price, cost_price, stock_qty, category } = parsed.data;

    const client = await db.connect();
    try {
    await beginTransaction(client);
    // Check for existing barcode (active or soft-deleted)
    const { rows: existing } = await client.query(
      'SELECT id, is_active, stock_qty FROM warung.products WHERE barcode = $1 FOR UPDATE',
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
      await client.query(`SELECT set_config('app.price_change_source', 'quick_add', true)`);
      const { rows } = await client.query(
        `UPDATE warung.products
         SET name = $1, sell_price = $2, category = $3,
             cost_price = $5, stock_qty = $6, is_active = true, updated_at = now()
         WHERE id = $4
         RETURNING id, barcode, name, sell_price, category, stock_qty`,
        [name, sell_price, category, prod.id, cost_price, stock_qty]
      );
      await logStockChange(client, rows[0].id, existing.length ? Number(existing[0].stock_qty) : 0, Number(rows[0].stock_qty), request.headers.get('x-user-id'), 'Stok awal / reaktivasi');
        await client.query('COMMIT');
        return NextResponse.json(rows[0], { status: 201 });
    }

    // Initial stock and cost must be supplied by the cashier.
    const REORDER_DEFAULT  = 5;

    // Simultaneously learn to local_master_products dictionary
    await client.query(
      `INSERT INTO warung.local_master_products (barcode, nama_barang, kategori)
       VALUES ($1, $2, $3)
       ON CONFLICT (barcode) DO UPDATE SET
         nama_barang = EXCLUDED.nama_barang,
         kategori = EXCLUDED.kategori,
         updated_at = now()`,
      [barcode, name, category]
    );

    const { rows } = await client.query(
      `INSERT INTO warung.products
         (barcode, name, category, unit, cost_price, sell_price, stock_qty, reorder_threshold)
       VALUES ($1, $2, $3, 'pcs', $4, $5, $6, $7)
       RETURNING id, barcode, name, sell_price, category, stock_qty`,
      [barcode, name, category, cost_price, sell_price, stock_qty, REORDER_DEFAULT]
    );

    await logStockChange(client, rows[0].id, existing.length ? Number(existing[0].stock_qty) : 0, Number(rows[0].stock_qty), request.headers.get('x-user-id'), 'Stok awal / reaktivasi');
        await client.query('COMMIT');
        return NextResponse.json(rows[0], { status: 201 });
    } finally { await client.query('ROLLBACK'); client.release(); }
  } catch (err) {
    console.error('Quick-add product error:', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Gagal menyimpan produk.' } },
      { status: 500 }
    );
  }
}
