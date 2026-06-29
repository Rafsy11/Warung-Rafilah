-- ============================================================
-- MIGRATION: 010_pricing_tiers.sql
-- Description: Creates table for wholesale/tiered pricing rules.
-- ============================================================

CREATE TABLE IF NOT EXISTS warung.product_pricing_tiers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id      UUID NOT NULL REFERENCES warung.products(id) ON DELETE CASCADE,
    min_qty         NUMERIC(12,2) NOT NULL CHECK (min_qty > 0),
    tier_price      NUMERIC(12,2) NOT NULL CHECK (tier_price >= 0.00),
    name            VARCHAR(50) NOT NULL, -- e.g. 'Grosir', 'Renteng', 'Dus'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(product_id, min_qty)
);

CREATE INDEX IF NOT EXISTS idx_product_pricing_tiers_lookup ON warung.product_pricing_tiers (product_id, min_qty DESC);
