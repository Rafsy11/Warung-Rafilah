-- ============================================================
-- MIGRATION: 006_cashier_sessions.sql
-- Description: Creates cashier session (shift) and cash reconciliation.
-- ============================================================

CREATE TABLE IF NOT EXISTS warung.cashier_sessions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cashier_id          UUID NOT NULL REFERENCES core.users(id),
    opened_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at           TIMESTAMPTZ,
    starting_cash       NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    expected_cash       NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    actual_cash         NUMERIC(12,2),
    cash_difference     NUMERIC(12,2),
    total_cash_sales    NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_qris_sales    NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_debt_sales    NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    status              VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
    notes               TEXT
);

-- Index for querying session history
CREATE INDEX IF NOT EXISTS idx_cashier_sessions_cashier ON warung.cashier_sessions (cashier_id, opened_at DESC);

-- Link sales to a cashier session
ALTER TABLE warung.sales ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES warung.cashier_sessions(id) ON DELETE SET NULL;
