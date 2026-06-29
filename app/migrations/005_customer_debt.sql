-- ============================================================
-- MIGRATION: 005_customer_debt.sql
-- Description: Adds customer database, credit limits, and debt tracking.
-- ============================================================

-- 1. Create customers table
CREATE TABLE IF NOT EXISTS warung.customers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(100) NOT NULL,
    phone           VARCHAR(20),
    address         TEXT,
    credit_limit    NUMERIC(12,2) NOT NULL DEFAULT 500000.00,
    current_debt    NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Add trigger for updated_at on customers
CREATE TRIGGER trg_customers_updated_at
    BEFORE UPDATE ON warung.customers
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

-- 3. Modify sales table check constraint and add customer relationship
ALTER TABLE warung.sales DROP CONSTRAINT IF EXISTS sales_payment_method_check;
ALTER TABLE warung.sales DROP CONSTRAINT IF EXISTS sales_payment_method_check1;
ALTER TABLE warung.sales ADD CONSTRAINT sales_payment_method_check CHECK (payment_method IN ('cash','qris','transfer','split','debt'));

ALTER TABLE warung.sales ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES warung.customers(id) ON DELETE SET NULL;

-- 4. Create debt ledger table
CREATE TABLE IF NOT EXISTS warung.debt_ledger (
    id              BIGSERIAL PRIMARY KEY,
    customer_id     UUID NOT NULL REFERENCES warung.customers(id) ON DELETE CASCADE,
    sale_id         UUID REFERENCES warung.sales(id) ON DELETE SET NULL,
    entry_type      VARCHAR(20) NOT NULL CHECK (entry_type IN ('debt_added', 'debt_paid')),
    amount          NUMERIC(12,2) NOT NULL,
    balance_after   NUMERIC(12,2) NOT NULL,
    note            TEXT,
    created_by      UUID REFERENCES core.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Create index on debt ledger
CREATE INDEX IF NOT EXISTS idx_debt_ledger_customer ON warung.debt_ledger (customer_id, created_at DESC);
