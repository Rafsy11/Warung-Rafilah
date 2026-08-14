import { NextResponse } from 'next/server';
import { db as pool } from '@/lib/db';
import { requireRole } from '@/lib/rbac';

/**
 * 3-STEP AUTO-LEARN & FALLBACK MASTER PRODUCT CONTROLLER
 * ------------------------------------------------------
 * GET  /api/check-master-product?barcode=[VALUE]
 * POST /api/check-master-product (Simultaneous Save & Learn)
 */

export async function GET(req: Request) {
  const forbidden = requireRole(req, ['owner', 'cashier']);
  if (forbidden) return forbidden;

  const { searchParams } = new URL(req.url);
  const barcode = searchParams.get('barcode')?.trim();

  if (!barcode) {
    return NextResponse.json(
      { error: { code: 'bad_request', message: 'Parameter barcode wajib diisi.' } },
      { status: 400 }
    );
  }

  const startTime = performance.now();

  try {
    // ── STEP 1: Query Active Store Inventory First ───────────────────────────
    const activeQuery = `
      SELECT id, barcode, name AS nama_barang, category AS kategori, unit, cost_price, sell_price, stock_qty, reorder_threshold
      FROM warung.products
      WHERE barcode = $1 AND is_active = true
      LIMIT 1
    `;
    const { rows: activeRows } = await pool.query(activeQuery, [barcode]);

    if (activeRows.length > 0) {
      const queryTimeMs = (performance.now() - startTime).toFixed(2);
      return NextResponse.json({
        status: 'ada_di_stok',
        source: 'store_inventories',
        query_time_ms: Number(queryTimeMs),
        product: activeRows[0],
        message: 'Produk sudah ada di stok aktif toko (Restock/Edit Harga).'
      });
    }

    // ── STEP 2: Fallback to Local Master Product Dictionary ─────────────────
    const masterQuery = `
      SELECT barcode, nama_barang, kategori, brand
      FROM warung.local_master_products
      WHERE barcode = $1
      LIMIT 1
    `;
    const { rows: masterRows } = await pool.query(masterQuery, [barcode]);

    if (masterRows.length > 0) {
      const queryTimeMs = (performance.now() - startTime).toFixed(2);
      return NextResponse.json({
        status: 'ada_di_kamus',
        source: 'local_master_products',
        query_time_ms: Number(queryTimeMs),
        preset: masterRows[0],
        message: 'Produk ditemukan di Kamus Master Lokal! Form diisi otomatis.'
      });
    }

    // ── STEP 3: Completely Missing from Both Tables ──────────────────────────
    const queryTimeMs = (performance.now() - startTime).toFixed(2);
    return NextResponse.json({
      status: 'baru_total',
      source: 'none',
      query_time_ms: Number(queryTimeMs),
      preset: null,
      message: 'Barcode baru_total. Silakan masukkan Nama Barang & Kategori baru.'
    });

  } catch (err: any) {
    console.error('Error in check-master-product controller:', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Gagal mengecek database kamus produk.' } },
      { status: 500 }
    );
  }
}

/**
 * SIMULTANEOUS AUTO-LEARN SAVE HANDLER (POST)
 * Writes to BOTH active inventory AND local master products dictionary in a single transaction.
 */
export async function POST(req: Request) {
  const forbidden = requireRole(req, ['owner', 'cashier']);
  if (forbidden) return forbidden;

  const client = await pool.connect();
  try {
    const body = await req.json();
    const {
      barcode,
      name,
      category = 'General',
      unit = 'pcs',
      cost_price = 0,
      sell_price = 0,
      stock_qty = 0,
      reorder_threshold = 5,
      brand = 'Generik'
    } = body;

    if (!barcode || !name) {
      return NextResponse.json(
        { error: { code: 'bad_request', message: 'Barcode dan Nama Barang wajib diisi.' } },
        { status: 400 }
      );
    }

    await client.query('BEGIN');

    // 1. Write/Learn to Local Master Product Dictionary
    const learnMasterQuery = `
      INSERT INTO warung.local_master_products (barcode, nama_barang, kategori, brand)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (barcode) DO UPDATE SET
        nama_barang = EXCLUDED.nama_barang,
        kategori = EXCLUDED.kategori,
        brand = EXCLUDED.brand,
        updated_at = now()
    `;
    await client.query(learnMasterQuery, [barcode.trim(), name.trim(), category.trim(), brand.trim()]);

    // 2. Write to Active Store Inventory
    const insertInventoryQuery = `
      INSERT INTO warung.products 
      (barcode, name, category, unit, cost_price, sell_price, stock_qty, reorder_threshold)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (barcode) DO UPDATE SET
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        unit = EXCLUDED.unit,
        cost_price = EXCLUDED.cost_price,
        sell_price = EXCLUDED.sell_price,
        stock_qty = warung.products.stock_qty + EXCLUDED.stock_qty,
        is_active = true,
        updated_at = now()
      RETURNING *
    `;
    const { rows: inventoryRows } = await client.query(insertInventoryQuery, [
      barcode.trim(),
      name.trim(),
      category.trim(),
      unit.trim(),
      Number(cost_price),
      Number(sell_price),
      Number(stock_qty),
      Number(reorder_threshold)
    ]);

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: '✓ Produk berhasil disimpan ke Stok Toko dan dipelajari ke Kamus Lokal.',
      product: inventoryRows[0]
    }, { status: 201 });

  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Error auto-learning master product:', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Gagal menyimpan dan mempelajari produk baru.' } },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
