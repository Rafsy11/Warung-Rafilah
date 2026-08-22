import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const userRole = req.headers.get('x-user-role');
  if (userRole !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const searchParams = req.nextUrl.searchParams;
  const startDate = searchParams.get('startDate') || searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const endDate = searchParams.get('endDate') || startDate;

  try {
    // 1. Gross Revenue & COGS for completed sales within date range
    const marginRes = await db.query(
      `SELECT COALESCE(SUM(si.subtotal - (si.cost_price_snapshot * si.qty)), 0)::float as gross_margin,
              COALESCE(SUM(si.subtotal), 0)::float as gross_revenue,
              COALESCE(SUM(si.cost_price_snapshot * si.qty), 0)::float as total_cogs,
              COALESCE(COUNT(DISTINCT s.id), 0)::int as total_transactions
       FROM warung.sale_items si
       JOIN warung.sales s ON si.sale_id = s.id
       WHERE s.status = 'completed'
         AND date_trunc('day', s.created_at AT TIME ZONE 'Asia/Jakarta') >= $1::date
         AND date_trunc('day', s.created_at AT TIME ZONE 'Asia/Jakarta') <= $2::date`,
      [startDate, endDate]
    );

    const discountRes = await db.query(
      `SELECT COALESCE(SUM(discount), 0)::float as total_discounts
       FROM warung.sales
       WHERE status = 'completed'
         AND date_trunc('day', created_at AT TIME ZONE 'Asia/Jakarta') >= $1::date
         AND date_trunc('day', created_at AT TIME ZONE 'Asia/Jakarta') <= $2::date`,
      [startDate, endDate]
    );

    const totalDiscounts = discountRes.rows[0].total_discounts;
    const grossMargin = Math.max(0, marginRes.rows[0].gross_margin - totalDiscounts);
    const grossRevenue = Math.max(0, marginRes.rows[0].gross_revenue - totalDiscounts);
    const totalCogs = marginRes.rows[0].total_cogs;
    const totalTransactions = marginRes.rows[0].total_transactions;

    // 2. Sales by Payment Method
    const paymentMethodRes = await db.query(
      `SELECT payment_method,
              COALESCE(SUM(total_amount), 0)::float as total_amount,
              COALESCE(COUNT(id), 0)::int as count
       FROM warung.sales
       WHERE status = 'completed'
         AND date_trunc('day', created_at AT TIME ZONE 'Asia/Jakarta') >= $1::date
         AND date_trunc('day', created_at AT TIME ZONE 'Asia/Jakarta') <= $2::date
       GROUP BY payment_method`,
      [startDate, endDate]
    );

    // 3. Agent PPOB Transactions & Commission
    const commRes = await db.query(
      `SELECT COALESCE(SUM(agent_commission), 0)::float as total_commission,
              COALESCE(SUM(amount), 0)::float as total_volume,
              COALESCE(COUNT(id), 0)::int as total_agent_tx
       FROM agent.transactions
       WHERE status = 'success'
         AND date_trunc('day', created_at AT TIME ZONE 'Asia/Jakarta') >= $1::date
         AND date_trunc('day', created_at AT TIME ZONE 'Asia/Jakarta') <= $2::date`,
      [startDate, endDate]
    );
    const agentCommission = commRes.rows[0].total_commission;
    const agentVolume = commRes.rows[0].total_volume;
    const totalAgentTx = commRes.rows[0].total_agent_tx;

    // 4. Shrinkage Loss (damaged, expired, stolen)
    const shrinkRes = await db.query(
      `SELECT COALESCE(SUM(ABS(sm.qty_change) * p.cost_price), 0)::float as shrinkage_loss,
              json_agg(json_build_object(
                'type', sm.movement_type,
                'product_name', p.name,
                'qty', ABS(sm.qty_change),
                'loss', ABS(sm.qty_change) * p.cost_price,
                'created_at', sm.created_at
              )) FILTER (WHERE sm.id IS NOT NULL) as shrinkage_details
       FROM warung.stock_movements sm
       JOIN warung.products p ON sm.product_id = p.id
       WHERE sm.movement_type IN ('damaged', 'expired', 'stolen')
         AND date_trunc('day', sm.created_at AT TIME ZONE 'Asia/Jakarta') >= $1::date
         AND date_trunc('day', sm.created_at AT TIME ZONE 'Asia/Jakarta') <= $2::date`,
      [startDate, endDate]
    );
    const shrinkageLoss = shrinkRes.rows[0].shrinkage_loss;
    const shrinkageDetails = shrinkRes.rows[0].shrinkage_details || [];

    // 5. Consignment Costs
    const consignRes = await db.query(
      `SELECT COALESCE(SUM(total_owed), 0)::float as consignment_cost
       FROM warung.consignment_ledger
       WHERE status = 'paid'
         AND date_trunc('day', paid_at AT TIME ZONE 'Asia/Jakarta') >= $1::date
         AND date_trunc('day', paid_at AT TIME ZONE 'Asia/Jakarta') <= $2::date`,
      [startDate, endDate]
    );
    const consignmentCost = consignRes.rows[0].consignment_cost;

    // 6. Net Profit Calculation
    const netProfit = grossMargin + agentCommission - shrinkageLoss - consignmentCost;

    // 7. Balance Sheet / Asset Valuation Snapshot
    const floatRes = await db.query(
      'SELECT balance_after::float FROM agent.float_ledger ORDER BY id DESC LIMIT 1'
    );
    const currentFloat = floatRes.rows.length > 0 ? Number(floatRes.rows[0].balance_after) : 0;

    const debtRes = await db.query(
      'SELECT COALESCE(SUM(current_debt), 0)::float as total_receivable FROM warung.customers WHERE is_active = true'
    );
    const totalReceivable = Number(debtRes.rows[0].total_receivable);

    const inventoryRes = await db.query(
      `SELECT COALESCE(SUM(stock_qty * cost_price), 0)::float as total_inventory_valuation,
              COALESCE(COUNT(id), 0)::int as total_active_items,
              COALESCE(SUM(CASE WHEN stock_qty <= reorder_threshold THEN 1 ELSE 0 END), 0)::int as low_stock_count
       FROM warung.products 
       WHERE is_active = true`
    );
    const totalInventoryValuation = Number(inventoryRes.rows[0].total_inventory_valuation);
    const totalActiveItems = Number(inventoryRes.rows[0].total_active_items);
    const lowStockCount = Number(inventoryRes.rows[0].low_stock_count);

    return NextResponse.json({
      startDate,
      endDate,
      gross_revenue: grossRevenue,
      total_cogs: totalCogs,
      gross_margin: grossMargin,
      total_discounts: totalDiscounts,
      total_transactions: totalTransactions,
      agent_commission: agentCommission,
      agent_volume: agentVolume,
      total_agent_tx: totalAgentTx,
      shrinkage_loss: shrinkageLoss,
      shrinkage_details: shrinkageDetails,
      consignment_cost: consignmentCost,
      net_profit: netProfit,
      payment_methods: paymentMethodRes.rows,
      balance_sheet: {
        current_float: currentFloat,
        total_receivable: totalReceivable,
        total_inventory_valuation: totalInventoryValuation,
        total_active_items: totalActiveItems,
        low_stock_count: lowStockCount,
        total_store_wealth: currentFloat + totalReceivable + totalInventoryValuation
      }
    });
  } catch (err) {
    console.error('Error in net-profit report API:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
