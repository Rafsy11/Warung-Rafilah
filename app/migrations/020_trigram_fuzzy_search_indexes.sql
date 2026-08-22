-- Migration 020: PostgreSQL Trigram Fuzzy Search & Extended Indexes
-- Supercharges product searching with typo-tolerance and accelerates session sales aggregation

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN Trigram index for lightning-fast fuzzy name search
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON warung.products USING gin (name gin_trgm_ops) WHERE is_active = true;

-- Indexes for fast session sales calculation and product lookup
CREATE INDEX IF NOT EXISTS idx_sales_session_id ON warung.sales (session_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON warung.sale_items (product_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON warung.products (category) WHERE is_active = true;
