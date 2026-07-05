-- Create warung.discounts table to support product-specific and global discounts (fixed or percentage).

CREATE TABLE warung.discounts (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                VARCHAR(100) NOT NULL,
    discount_type       VARCHAR(20) NOT NULL CHECK (discount_type IN ('global', 'product')),
    value_type          VARCHAR(20) NOT NULL CHECK (value_type IN ('fixed', 'percentage')),
    discount_value      NUMERIC(12,2) NOT NULL,
    product_id          UUID REFERENCES warung.products(id) ON DELETE CASCADE,
    min_purchase_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_discounts_active ON warung.discounts (is_active) WHERE is_active = true;
CREATE INDEX idx_discounts_product ON warung.discounts (product_id) WHERE product_id IS NOT NULL;

CREATE TRIGGER trg_discounts_updated_at
    BEFORE UPDATE ON warung.discounts
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
