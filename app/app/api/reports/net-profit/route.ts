import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const userRole = req.headers.get('x-user-role');
  if (userRole !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const date = req.nextUrl.searchParams.get('date') || new Date().toISOString().slice(0, 10);

  try {
    // 1. Gross Margin Ritel (sell - cost for completed sales on date)
    const marginRes = await db.query(
      `SELECT COALESCE(SUM(si.subtotal - (si.cost_price_snapshot * si.qty)), 0)::float as gross_margin,
              COALESCE(SUM(si.subtotal), 0)::float as gross_revenue,
              COALESCE(SUM(si.cost_price_snapshot * si.qty), 0)::float as total_cogs
       FROM warung.sale_items si
       JOIN warung.sales s ON si.sale_id = s.id
       WHERE s.status = 'completed'
         AND date_trunc('day', s.created_at AT TIME ZONE 'Asia/Jakarta') = $1::date`,
      [date]
    );

    const grossMargin = marginRes.rows[0].gross_margin;
    const grossRevenue = marginRes.rows[0].gross_revenue;
    const totalCogs = marginRes.rows[0].total_cogs;

    // 2. Agent Commission
    const commRes = await db.query(
      `SELECT COALESCE(SUM(agent_commission), 0)::float as total_commission
       FROM agent.transactions
       WHERE status = 'success'
         AND date_trunc('day', created_at AT TIME ZONE 'Asia/Jakarta') = $1::date`,
      [date]
    );
    const agentCommission = commRes.rows[0].total_commission;

    // 3. Shrinkage Loss (damaged, expired, stolen)
    const shrinkRes = await db.query(
      `SELECT COALESCE(SUM(ABS(sm.qty_change) * p.cost_price), 0)::float as shrinkage_loss,
              json_agg(json_build_object(
                'type', sm.movement_type,
                'product_name', p.name,
                'qty', ABS(sm.qty_change),
                'loss', ABS(sm.qty_change) * p.cost_price
              )) FILTER (WHERE sm.id IS NOT NULL) as shrinkage_details
       FROM warung.stock_movements sm
       JOIN warung.products p ON sm.product_id = p.id
       WHERE sm.movement_type IN ('damaged', 'expired', 'stolen')
         AND date_trunc('day', sm.created_at AT TIME ZONE 'Asia/Jakarta') = $1::date`,
      [date]
    );
    const shrinkageLoss = shrinkRes.rows[0].shrinkage_loss;
    const shrinkageDetails = shrinkRes.rows[0].shrinkage_details || [];

    // 4. Consignment Costs (paid on this date)
    const consignRes = await db.query(
      `SELECT COALESCE(SUM(total_owed), 0)::float as consignment_cost
       FROM warung.consignment_ledger
       WHERE status = 'paid'
         AND date_trunc('day', paid_at AT TIME ZONE 'Asia/Jakarta') = $1::date`,
      [date]
    );
    const consignmentCost = consignRes.rows[0].consignment_cost;

    // 5. Calculate Net Profit
    const netProfit = grossMargin + agentCommission - shrinkageLoss - consignmentCost;

    return NextResponse.json({
      date,
      gross_revenue: grossRevenue,
      total_cogs: totalCogs,
      gross_margin: grossMargin,
      agent_commission: agentCommission,
      shrinkage_loss: shrinkageLoss,
      shrinkage_details: shrinkageDetails,
      consignment_cost: consignmentCost,
      net_profit: netProfit,
    });
  } catch (err) {
    console.error('Error in net-profit API:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
