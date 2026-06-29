import { NextResponse } from 'next/server';
import { db as pool } from '@/lib/db';

export async function GET(req: Request) {
  const userRole = req.headers.get('x-user-role');
  if (userRole !== 'owner') {
    return NextResponse.json(
      { error: { code: 'forbidden', message: 'Akses ditolak. Hanya owner yang diizinkan.' } },
      { status: 403 }
    );
  }

  try {
    const { rows } = await pool.query(
      `SELECT ac.id, ac.closing_date, ac.opening_float, ac.closing_float, ac.total_transactions,
              ac.total_commission, ac.total_admin_fee, ac.status, ac.created_at,
              u.full_name as closed_by_name
       FROM agent.daily_closing ac
       LEFT JOIN core.users u ON ac.closed_by = u.id
       ORDER BY ac.closing_date DESC
       LIMIT 50`
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching closing history:', error);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Gagal mengambil data histori tutup kas.' } },
      { status: 500 }
    );
  }
}
