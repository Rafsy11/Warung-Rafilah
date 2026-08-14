import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/rbac';

export async function POST(req: NextRequest) {
  const { errorResponse, userId: cashierId } = requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { actualCash, notes } = await req.json();
    const actualCashNum = Number(actualCash);

    if (isNaN(actualCashNum) || actualCashNum < 0) {
      return NextResponse.json({ error: 'Jumlah uang fisik aktual tidak valid.' }, { status: 400 });
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // 1. Fetch active session
      const activeRes = await client.query(
        `SELECT id, starting_cash, opened_at FROM warung.cashier_sessions 
         WHERE cashier_id = $1 AND status = 'open' 
         ORDER BY opened_at DESC LIMIT 1 FOR UPDATE`,
        [cashierId]
      );

      if (activeRes.rows.length === 0) {
        throw new Error('Tidak ditemukan sesi kasir aktif untuk ditutup.');
      }

      const session = activeRes.rows[0];
      const sessionId = session.id;
      const startingCash = Number(session.starting_cash);
      const openedAt = session.opened_at;

      // 2. Fetch sales summary grouped by payment method
      const salesRes = await client.query(
        `SELECT payment_method, 
                SUM(total_amount) as total, 
                SUM(payment_received) as payment_received,
                SUM(change_given) as change_given,
                SUM(split_cash_amount) as split_cash, 
                SUM(split_qris_amount) as split_qris 
         FROM warung.sales 
         WHERE session_id = $1 AND status = 'completed' 
         GROUP BY payment_method`,
        [sessionId]
      );

      let cashSales = 0;
      let qrisSales = 0;
      let debtSales = 0;
      let qrisCashChange = 0;

      for (const row of salesRes.rows) {
        const method = row.payment_method;
        const total = Number(row.total);
        const paymentReceived = Number(row.payment_received || 0);
        const changeGiven = Number(row.change_given || 0);
        const splitCash = Number(row.split_cash || 0);
        const splitQris = Number(row.split_qris || 0);

        if (method === 'cash') {
          cashSales += total;
        } else if (method === 'qris') {
          qrisSales += (paymentReceived > 0 ? paymentReceived : total);
          qrisCashChange += changeGiven;
        } else if (method === 'split') {
          cashSales += splitCash;
          qrisSales += splitQris;
        } else if (method === 'debt') {
          debtSales += total;
          cashSales += paymentReceived;
        }
      }

      // Fetch debt payments received during this session
      const debtPaidRes = await client.query(
        `SELECT COALESCE(SUM(amount), 0) as total 
         FROM warung.debt_ledger 
         WHERE entry_type = 'debt_paid' AND created_at >= $1`,
        [openedAt]
      );
      const totalDebtPaid = Number(debtPaidRes.rows[0].total);

      const expectedCash = startingCash + cashSales + totalDebtPaid - qrisCashChange;
      const cashDifference = actualCashNum - expectedCash;

      // 3. Update session
      const updateRes = await client.query(
        `UPDATE warung.cashier_sessions 
         SET status = 'closed', 
             closed_at = NOW(), 
             expected_cash = $1, 
             actual_cash = $2, 
             cash_difference = $3, 
             total_cash_sales = $4, 
             total_qris_sales = $5, 
             total_debt_sales = $6, 
             notes = $7 
         WHERE id = $8 
         RETURNING id, closed_at, expected_cash, actual_cash, cash_difference`,
        [
          expectedCash, 
          actualCashNum, 
          cashDifference, 
          cashSales, 
          qrisSales, 
          debtSales, 
          notes?.trim() || null, 
          sessionId
        ]
      );

      await client.query('COMMIT');

      // Auto-trigger n8n Daily Closing Recap webhook asynchronously
      fetch('http://n8n:5678/webhook/daily-closing-recap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
      }).catch(err => console.error('Failed to trigger daily closing recap:', err));

      return NextResponse.json({ success: true, session: updateRes.rows[0] });
    } catch (e) {
      await client.query('ROLLBACK');
      const error = e as Error;
      return NextResponse.json({ error: error.message || 'Gagal menutup sesi.' }, { status: 400 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('close session POST error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
