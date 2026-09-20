-- Additive upgrade: existing balances, sales and ledger entries are preserved.
CREATE TABLE IF NOT EXISTS core.sessions (
    token_hash TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES core.users(id),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON core.sessions(expires_at);

ALTER TABLE warung.sales ADD COLUMN IF NOT EXISTS checkout_key UUID;
ALTER TABLE warung.sales ADD COLUMN IF NOT EXISTS request_hash TEXT;
ALTER TABLE warung.sales ADD COLUMN IF NOT EXISTS receipt_snapshot JSONB;
CREATE UNIQUE INDEX IF NOT EXISTS sales_checkout_key ON warung.sales(checkout_key);

ALTER TABLE warung.debt_ledger ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES warung.cashier_sessions(id);
ALTER TABLE warung.debt_ledger ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE warung.stock_movements ADD COLUMN IF NOT EXISTS cost_price_snapshot NUMERIC(12,2);
ALTER TABLE warung.sale_items ADD COLUMN IF NOT EXISTS product_name_snapshot TEXT;
ALTER TABLE warung.sale_items ADD COLUMN IF NOT EXISTS consignment_cost_snapshot NUMERIC(12,2);

-- Historical loss costs cannot be reconstructed: leave NULL, expose as unknown.
CREATE OR REPLACE FUNCTION warung.snapshot_movement_cost() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.cost_price_snapshot IS NULL THEN
        SELECT cost_price INTO NEW.cost_price_snapshot FROM warung.products WHERE id = NEW.product_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_movement_cost ON warung.stock_movements;
CREATE TRIGGER trg_movement_cost BEFORE INSERT ON warung.stock_movements
FOR EACH ROW EXECUTE FUNCTION warung.snapshot_movement_cost();

CREATE OR REPLACE FUNCTION warung.fn_log_price_change() RETURNS TRIGGER AS $$
DECLARE change_source TEXT;
BEGIN
    change_source := COALESCE(NULLIF(current_setting('app.price_change_source', true), ''), 'manual');
    IF change_source NOT IN ('manual','ai_command','quick_add','reactivation','bulk_update') THEN
        change_source := 'manual';
    END IF;
    IF OLD.sell_price IS DISTINCT FROM NEW.sell_price OR OLD.cost_price IS DISTINCT FROM NEW.cost_price THEN
        INSERT INTO warung.product_price_history
            (product_id,old_sell_price,new_sell_price,old_cost_price,new_cost_price,source)
        VALUES (NEW.id,OLD.sell_price,NEW.sell_price,OLD.cost_price,NEW.cost_price,change_source);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Validate new writes without rejecting or rewriting pre-existing anomalous rows.
ALTER TABLE warung.products ADD CONSTRAINT products_valid_amounts_v22
    CHECK (cost_price >= 0 AND sell_price >= 0 AND stock_qty >= 0 AND reorder_threshold >= 0
           AND COALESCE(consignment_cost_share,0) >= 0) NOT VALID;
ALTER TABLE warung.sales ADD CONSTRAINT sales_valid_amounts_v22
    CHECK (subtotal >= 0 AND discount >= 0 AND total_amount = subtotal - discount
           AND total_amount >= 0 AND payment_received >= 0 AND change_given >= 0
           AND COALESCE(split_cash_amount,0) >= 0 AND COALESCE(split_qris_amount,0) >= 0) NOT VALID;

-- Revoke existing sessions when credentials, role or active state change.
CREATE OR REPLACE FUNCTION core.revoke_user_sessions() RETURNS TRIGGER AS $$
BEGIN
    IF OLD.pin_hash IS DISTINCT FROM NEW.pin_hash OR OLD.role IS DISTINCT FROM NEW.role
       OR OLD.is_active IS DISTINCT FROM NEW.is_active THEN
        DELETE FROM core.sessions WHERE user_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_revoke_user_sessions ON core.users;
CREATE TRIGGER trg_revoke_user_sessions AFTER UPDATE ON core.users
FOR EACH ROW EXECUTE FUNCTION core.revoke_user_sessions();

-- Reporting definition only; no historical records are rewritten.
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
        SUM(subtotal - (COALESCE(consignment_cost_snapshot, (SELECT cl.cost_share FROM warung.consignment_ledger cl WHERE cl.sale_item_id=warung.sale_items.id LIMIT 1), cost_price_snapshot) * qty)) AS items_margin
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
