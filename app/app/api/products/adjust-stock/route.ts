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
    const { productId, movementType, qtyChange, note } = await req.json();

    if (!productId || !movementType || qtyChange === undefined || isNaN(Number(qtyChange))) {
      return NextResponse.json(
        { error: { code: 'bad_request', message: 'Parameter tidak lengkap atau tidak valid.' } },
        { status: 400 }
      );
    }

    if (!['restock', 'adjustment', 'damaged', 'expired', 'stolen'].includes(movementType)) {
      return NextResponse.json(
        { error: { code: 'bad_request', message: 'Tipe penyesuaian tidak valid.' } },
        { status: 400 }
      );
    }

    const finalQtyChange = ['damaged', 'expired', 'stolen'].includes(movementType) 
      ? -Math.abs(Number(qtyChange)) 
      : Number(qtyChange);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Fetch and validate product stock
      const prodRes = await client.query(
        'SELECT stock_qty, unit FROM warung.products WHERE id = $1 AND is_active = true FOR UPDATE',
        [productId]
      );
      if (prodRes.rows.length === 0) {
        throw new Error('Produk tidak ditemukan atau tidak aktif.');
      }

      const currentStock = Number(prodRes.rows[0].stock_qty);
      const unit = prodRes.rows[0].unit;

      if (currentStock + finalQtyChange < 0) {
        throw new Error(`Stok tidak mencukupi untuk melakukan penyesuaian. Stok saat ini: ${currentStock} ${unit}`);
      }

      // Update product stock
      await client.query(
        `UPDATE warung.products 
         SET stock_qty = stock_qty + $1 
         WHERE id = $2 AND is_active = true`,
        [finalQtyChange, productId]
      );

      // Record stock movement
      await client.query(
        `INSERT INTO warung.stock_movements (product_id, movement_type, qty_change, note, created_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [productId, movementType, finalQtyChange, note || '', userId]
      );

      await client.query('COMMIT');
      return NextResponse.json({ success: true, message: 'Stok berhasil disesuaikan.' });
    } catch (e) {
      await client.query('ROLLBACK');
      const error = e as Error;
      return NextResponse.json(
        { error: { code: 'transaction_failed', message: error.message || 'Gagal menyimpan perubahan stok.' } },
        { status: 400 }
      );
    } finally {
      client.release();
    }
  } catch (err) {
    const error = err as Error;
    console.error('Error adjusting stock:', error);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Gagal memproses penyesuaian stok.' } },
      { status: 500 }
    );
  }
}
