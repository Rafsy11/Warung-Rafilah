import { NextResponse } from 'next/server';
import { db as pool } from '@/lib/db';

export async function POST(req: Request) {
  const userRole = req.headers.get('x-user-role');
  if (userRole !== 'owner') {
    return NextResponse.json(
      { error: { code: 'forbidden', message: 'Akses ditolak. Hanya owner yang diizinkan.' } },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: { code: 'bad_request', message: 'Parameter ids tidak lengkap atau tidak valid.' } },
        { status: 400 }
      );
    }

    const { rowCount } = await pool.query(
      `UPDATE warung.products 
       SET is_active = false 
       WHERE id = ANY($1)`,
      [ids]
    );

    return NextResponse.json({
      success: true,
      message: `${rowCount} produk berhasil dinonaktifkan secara massal.`
    });
  } catch (err) {
    const error = err as Error;
    console.error('Error in bulk-delete products:', error);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Gagal memproses penonaktifan produk.' } },
      { status: 500 }
    );
  }
}
