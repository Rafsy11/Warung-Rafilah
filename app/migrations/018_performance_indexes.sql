-- Migration 018: Performance Indexes for POS Database
-- Accelerates barcode scanning, product lookups, sale reports, and debt queries

CREATE INDEX IF NOT EXISTS idx_products_barcode ON warung.products (barcode) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_products_name ON warung.products (name) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sales_created_status ON warung.sales (created_at DESC, status);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON warung.sale_items (sale_id);
CREATE INDEX IF NOT EXISTS idx_customers_debt ON warung.customers (current_debt DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_cashier_sessions_status ON warung.cashier_sessions (status);
