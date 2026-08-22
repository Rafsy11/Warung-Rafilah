import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const cashierId = req.headers.get('x-user-id');
  if (!cashierId) {
    return NextResponse.json({ error: 'Pengguna tidak terautentikasi.' }, { status: 401 });
  }


  try {
    // 1. Get active cashier session
    const sessionRes = await db.query(
      `SELECT id, starting_cash::float as starting_cash 
       FROM warung.cashier_sessions 
       WHERE cashier_id = $1 AND status = 'open' 
       ORDER BY opened_at DESC LIMIT 1`,
      [cashierId]
    );

    if (sessionRes.rows.length === 0) {
      return NextResponse.json({ 
        active_session: false,
        message: 'Buka sesi kasir terlebih dahulu untuk memantau status kas vs digital.' 
      });
    }

    const session = sessionRes.rows[0];
    const sessionId = session.id;
    const startingCash = session.starting_cash;

    // 2. Fetch sales summary for cash sales
    const salesRes = await db.query(
      `SELECT payment_method, 
              SUM(total_amount)::float as total, 
              SUM(payment_received)::float as payment_received,
              SUM(split_cash_amount)::float as split_cash
       FROM warung.sales 
       WHERE session_id = $1 AND (status = 'completed' OR status = 'pending')
       GROUP BY payment_method`,
      [sessionId]
    );

    let cashSales = 0;
    for (const row of salesRes.rows) {
      if (row.payment_method === 'cash') {
        cashSales += row.total;
      } else if (row.payment_method === 'split') {
        cashSales += row.split_cash || 0;
      } else if (row.payment_method === 'debt') {
        cashSales += row.payment_received || 0;
      }
    }

    // 3. Sum up cash withdrawals during this session
    // Agent transactions are linked to sales provider_ref_id via sales.transaction_code
    const withdrawalsRes = await db.query(
      `SELECT COALESCE(SUM(at.amount), 0)::float as total_withdrawals
       FROM agent.transactions at
       JOIN warung.sales s ON at.provider_ref_id = s.transaction_code
       WHERE s.session_id = $1 AND at.service_type = 'cash_withdrawal' AND at.status = 'success'`,
      [sessionId]
    );
    const totalWithdrawals = withdrawalsRes.rows[0].total_withdrawals;

    // 4. Calculate current cash in drawer
    const currentCash = startingCash + cashSales - totalWithdrawals;

    // 5. Get current float balance
    const floatRes = await db.query(
      'SELECT balance_after::float FROM agent.float_ledger ORDER BY id DESC LIMIT 1'
    );
    const currentFloat = floatRes.rows.length > 0 ? floatRes.rows[0].balance_after : 0;

    const totalLiquidity = currentCash + currentFloat;

    // 6. Generate alerts and recommendations
    const alerts: string[] = [];
    const recommendations: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    if (currentFloat < 200000) {
      status = 'critical';
      alerts.push('SALDO FLOAT PPOB KRITIS: Sisa saldo digital sangat sedikit (< Rp 200.000). Anda terancam tidak bisa melayani transaksi top-up atau transfer.');
      recommendations.push('Segera lakukan Top-up saldo float digital.');
    }

    if (currentCash < 100000) {
      status = 'critical';
      alerts.push('KAS LACI FISIK KRITIS: Uang fisik di laci sangat sedikit (< Rp 100.000). Anda terancam tidak bisa memberikan kembalian belanja ritel atau melayani penarikan tunai.');
      recommendations.push('Tambahkan modal kas fisik (uang kembalian) ke laci kasir.');
    }

    // Check imbalance
    if (totalLiquidity > 0) {
      const cashRatio = currentCash / totalLiquidity;
      
      if (cashRatio > 0.75 && currentFloat < 300000) {
        if (status === 'healthy') status = 'warning';
        alerts.push('KETIDAKSEIMBANGAN KAS: Proporsi uang tunai di laci terlalu tinggi (> 75%), sedangkan saldo digital menipis.');
        recommendations.push('Disarankan menyetor sebagian kas fisik laci untuk melakukan top-up digital saldo float.');
      } else if (cashRatio < 0.20 && currentCash < 150000 && currentFloat > 500000) {
        if (status === 'healthy') status = 'warning';
        alerts.push('KETIDAKSEIMBANGAN KAS: Proporsi saldo digital terlalu tinggi (> 80%), sedangkan uang kas fisik di laci sangat tipis.');
        recommendations.push('Disarankan melakukan penarikan sebagian saldo float digital ke rekening bank/cash out untuk menambah uang fisik laci.');
      }
    }

    return NextResponse.json({
      active_session: true,
      current_cash: currentCash,
      current_float: currentFloat,
      total_liquidity: totalLiquidity,
      status,
      alerts,
      recommendations
    });
  } catch (err) {
    console.error('Error in rebalance status API:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
