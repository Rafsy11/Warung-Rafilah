-- Update warung.v_daily_summary view to correct double counting and subtract discount from gross_margin.

CREATE OR REPLACE VIEW warung.v_daily_summary AS
WITH sale_totals AS (
    SELECT
        id,
        created_at,
        total_amount,
        payment_method,
        split_cash_amount,
        split_qris_amount,
        discount
    FROM warung.sales
    WHERE status = 'completed'
),
item_totals AS (
    SELECT
        sale_id,
        SUM(subtotal - (cost_price_snapshot * qty)) AS items_margin
    FROM warung.sale_items
    GROUP BY sale_id
)
SELECT
    date_trunc('day', s.created_at)                                AS sale_date,
    COUNT(DISTINCT s.id)                                           AS transaction_count,
    SUM(s.total_amount)                                            AS gross_revenue,
    SUM(CASE WHEN s.payment_method = 'cash' THEN s.total_amount WHEN s.payment_method = 'split' THEN s.split_cash_amount ELSE 0 END) AS cash_revenue,
    SUM(CASE WHEN s.payment_method = 'qris' THEN s.total_amount WHEN s.payment_method = 'split' THEN s.split_qris_amount ELSE 0 END) AS qris_revenue,
    SUM(CASE WHEN s.payment_method = 'transfer' THEN s.total_amount ELSE 0 END) AS transfer_revenue,
    SUM(COALESCE(i.items_margin, 0)) - SUM(s.discount)             AS gross_margin
FROM sale_totals s
LEFT JOIN item_totals i ON s.id = i.sale_id
GROUP BY 1
ORDER BY 1 DESC;
