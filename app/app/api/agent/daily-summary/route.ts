import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/agent/daily-summary?date=YYYY-MM-DD
 * Returns aggregate of agent transactions for a given day (default: today).
 * Also returns per-service-type breakdown.
 *
 * @example GET /api/agent/daily-summary?date=2025-06-22
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const date = searchParams.get('date') ?? new Date().toISOString().slice(0, 10);

  try {
    // Aggregate totals for the day
    const totalsResult = await db.query(
      `SELECT
          COUNT(*)::int                         AS transaction_count,
          COALESCE(SUM(amount), 0)              AS gross_volume,
          COALESCE(SUM(agent_commission), 0)    AS total_commission,
          COALESCE(SUM(admin_fee), 0)           AS total_admin_fee
       FROM agent.transactions
       WHERE date_trunc('day', created_at AT TIME ZONE 'Asia/Jakarta') = $1::date
         AND status IN ('pending','success')`,
      [date]
    );

    // Per-service breakdown
    const breakdownResult = await db.query(
      `SELECT
          service_type,
          COUNT(*)::int                         AS count,
          COALESCE(SUM(amount), 0)              AS volume,
          COALESCE(SUM(agent_commission), 0)    AS commission
       FROM agent.transactions
       WHERE date_trunc('day', created_at AT TIME ZONE 'Asia/Jakarta') = $1::date
         AND status IN ('pending','success')
       GROUP BY service_type
       ORDER BY volume DESC`,
      [date]
    );

    // Check if already closed today
    const closingResult = await db.query(
      `SELECT id, status, closing_float, total_commission
       FROM agent.daily_closing
       WHERE closing_date = $1`,
      [date]
    );

    const totals = totalsResult.rows[0];
    return NextResponse.json({
      date,
      transaction_count:  totals.transaction_count,
      gross_volume:       totals.gross_volume,
      total_commission:   totals.total_commission,
      total_admin_fee:    totals.total_admin_fee,
      breakdown:          breakdownResult.rows,
      closing:            closingResult.rows[0] ?? null,
    });
  } catch (err) {
    console.error('agent/daily-summary error:', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Database error' } },
      { status: 500 }
    );
  }
}
