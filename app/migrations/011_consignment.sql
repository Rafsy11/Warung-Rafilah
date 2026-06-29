-- ============================================================
-- MIGRATION: 011_consignment.sql
-- Description: Adds columns to products table and creates consignment ledger table.
-- ============================================================

-- Add columns to warung.products table
ALTER TABLE warung.products 
ADD COLUMN IF NOT EXISTS is_consignment BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS consignment_supplier_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS consignment_cost_share NUMERIC(12,2) DEFAULT 0.00;

-- Create warung.consignment_ledger table
CREATE TABLE IF NOT EXISTS warung.consignment_ledger (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_item_id    BIGINT NOT NULL REFERENCES warung.sale_items(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES warung.products(id),
    supplier_name   VARCHAR(100) NOT NULL,
    qty_sold        NUMERIC(12,2) NOT NULL,
    cost_share      NUMERIC(12,2) NOT NULL, -- bagi hasil per unit
    total_owed      NUMERIC(12,2) NOT NULL, -- qty_sold * cost_share
    status          VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid')),
    paid_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_consignment_ledger_lookup ON warung.consignment_ledger (supplier_name, status);
CREATE INDEX IF NOT EXISTS idx_consignment_ledger_created ON warung.consignment_ledger (created_at DESC);
