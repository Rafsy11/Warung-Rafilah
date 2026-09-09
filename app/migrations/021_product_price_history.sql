-- Migration 021: Product Price History
-- Tracks every sell_price and cost_price change automatically via trigger.
-- Guarantees capture from ALL mutation vectors: Admin UI, AI Command, Quick Add, etc.

BEGIN;

-- ── Table: price change audit trail ──────────────────────────────────
CREATE TABLE IF NOT EXISTS warung.product_price_history (
    id              BIGSERIAL PRIMARY KEY,
    product_id      UUID NOT NULL REFERENCES warung.products(id) ON DELETE CASCADE,
    old_sell_price  NUMERIC(12,2),
    new_sell_price  NUMERIC(12,2),
    old_cost_price  NUMERIC(12,2),
    new_cost_price  NUMERIC(12,2),
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    source          VARCHAR(30) NOT NULL DEFAULT 'manual'
        CHECK (source IN ('manual', 'ai_command', 'quick_add', 'reactivation', 'bulk_update'))
);

-- ── Index: fast lookups by product, most recent first ────────────────
CREATE INDEX IF NOT EXISTS idx_price_history_product_time
ON warung.product_price_history (product_id, changed_at DESC);

-- ── Trigger function: auto-log price changes on UPDATE ───────────────
CREATE OR REPLACE FUNCTION warung.fn_log_price_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log when sell_price OR cost_price actually changed
    IF (OLD.sell_price IS DISTINCT FROM NEW.sell_price)
       OR (OLD.cost_price IS DISTINCT FROM NEW.cost_price) THEN
        INSERT INTO warung.product_price_history
            (product_id, old_sell_price, new_sell_price, old_cost_price, new_cost_price, source)
        VALUES (
            NEW.id,
            OLD.sell_price,
            NEW.sell_price,
            OLD.cost_price,
            NEW.cost_price,
            COALESCE(current_setting('app.price_change_source', true), 'manual')
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Trigger: fires AFTER UPDATE on products table ────────────────────
DROP TRIGGER IF EXISTS trg_log_price_change ON warung.products;
CREATE TRIGGER trg_log_price_change
    AFTER UPDATE OF sell_price, cost_price ON warung.products
    FOR EACH ROW
    EXECUTE FUNCTION warung.fn_log_price_change();

-- ── Record migration ─────────────────────────────────────────────────
INSERT INTO warung.schema_migrations (filename) VALUES ('021_product_price_history.sql')
ON CONFLICT DO NOTHING;

COMMIT;
