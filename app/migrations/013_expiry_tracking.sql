-- ============================================================
-- MIGRATION: 013_expiry_tracking.sql
-- Description: Adds nearest expiry date tracking to products
--              for proactive expiry alerts.
-- ============================================================

ALTER TABLE warung.products
    ADD COLUMN IF NOT EXISTS nearest_expiry_date DATE;

CREATE INDEX IF NOT EXISTS idx_products_expiry
    ON warung.products (nearest_expiry_date)
    WHERE nearest_expiry_date IS NOT NULL AND is_active = true;
