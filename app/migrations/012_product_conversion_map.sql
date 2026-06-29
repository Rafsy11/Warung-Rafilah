-- ============================================================
-- MIGRATION: 012_product_conversion_map.sql
-- Description: Maps parent packaging products to their retail
--              units (e.g. 1 bungkus rokok → 12 batang) for
--              automatic stock splitting during checkout.
-- ============================================================

CREATE TABLE IF NOT EXISTS warung.product_conversion_map (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_product_id   UUID NOT NULL REFERENCES warung.products(id) ON DELETE CASCADE,
    dest_product_id     UUID NOT NULL REFERENCES warung.products(id) ON DELETE CASCADE,
    conversion_ratio    INT NOT NULL CHECK (conversion_ratio > 0),
    auto_convert        BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_conversion_pair UNIQUE (source_product_id, dest_product_id),
    CONSTRAINT chk_no_self_convert CHECK (source_product_id <> dest_product_id)
);

CREATE INDEX IF NOT EXISTS idx_conversion_map_dest ON warung.product_conversion_map (dest_product_id);
