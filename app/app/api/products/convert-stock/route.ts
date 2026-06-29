import { NextResponse } from 'next/server';
import { db as pool } from '@/lib/db';

export async function POST(req: Request) {
  const userRole = req.headers.get('x-user-role');
  const userId = req.headers.get('x-user-id');
  if (userRole !== 'owner') {
    return NextResponse.json(
      { error: { code: 'forbidden', message: 'Akses ditolak. Hanya owner yang diizinkan.' } },
      { status: 403 }
    );
  }

  try {
    const { sourceProductId, destProductId, sourceQty, ratio, note } = await req.json();

    if (!sourceProductId || !destProductId || !sourceQty || !ratio) {
      return NextResponse.json(
        { error: { code: 'bad_request', message: 'Parameter tidak lengkap atau tidak valid.' } },
        { status: 400 }
      );
    }

    const sQty = Number(sourceQty);
    const cRatio = Number(ratio);

    if (isNaN(sQty) || sQty <= 0 || isNaN(cRatio) || cRatio <= 0) {
      return NextResponse.json(
        { error: { code: 'bad_request', message: 'Jumlah konversi dan rasio harus lebih besar dari 0.' } },
        { status: 400 }
      );
    }

    if (sourceProductId === destProductId) {
      return NextResponse.json(
        { error: { code: 'bad_request', message: 'Produk sumber dan produk tujuan tidak boleh sama.' } },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Fetch and verify source product stock
      const sourceRes = await client.query(
        'SELECT id, name, stock_qty FROM warung.products WHERE id = $1 AND is_active = true FOR UPDATE',
        [sourceProductId]
      );

      if (sourceRes.rowCount === 0) {
        throw new Error('Produk sumber tidak ditemukan atau tidak aktif.');
      }

      const sourceProduct = sourceRes.rows[0];
      const currentStock = Number(sourceProduct.stock_qty);

      if (currentStock < sQty) {
        throw new Error(`Stok produk sumber tidak mencukupi. Stok saat ini: ${currentStock}`);
      }

      // 2. Fetch and verify destination product
      const destRes = await client.query(
        'SELECT id, name FROM warung.products WHERE id = $1 AND is_active = true FOR UPDATE',
        [destProductId]
      );

      if (destRes.rowCount === 0) {
        throw new Error('Produk tujuan tidak ditemukan atau tidak aktif.');
      }

      const destProduct = destRes.rows[0];

      // 3. Decrease source product stock
      await client.query(
        'UPDATE warung.products SET stock_qty = stock_qty - $1 WHERE id = $2',
        [sQty, sourceProductId]
      );

      // 4. Increase destination product stock
      const totalDestQty = sQty * cRatio;
      await client.query(
        'UPDATE warung.products SET stock_qty = stock_qty + $1 WHERE id = $2',
        [totalDestQty, destProductId]
      );

      // 5. Insert stock movements
      const defaultNote = `Konversi produk: ${sQty} bungkus ke ${totalDestQty} batang`;
      const finalNote = note ? note.trim() : defaultNote;

      // Source movement (negative change)
      await client.query(
        `INSERT INTO warung.stock_movements (product_id, movement_type, qty_change, note, created_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [sourceProductId, 'adjustment', -sQty, `${finalNote} (Produk Asal)`, userId]
      );

      // Destination movement (positive change)
      await client.query(
        `INSERT INTO warung.stock_movements (product_id, movement_type, qty_change, note, created_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [destProductId, 'adjustment', totalDestQty, `${finalNote} (Produk Tujuan)`, userId]
      );

      await client.query('COMMIT');
      return NextResponse.json({ success: true, message: 'Konversi produk berhasil diselesaikan.' });
    } catch (e) {
      await client.query('ROLLBACK');
      const error = e as Error;
      return NextResponse.json(
        { error: { code: 'transaction_failed', message: error.message || 'Gagal memproses konversi.' } },
        { status: 400 }
      );
    } finally {
      client.release();
    }
  } catch (err) {
    const error = err as Error;
    console.error('Error in convert-stock endpoint:', error);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Gagal memproses konversi produk.' } },
      { status: 500 }
    );
  }
}
