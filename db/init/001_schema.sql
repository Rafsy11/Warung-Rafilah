-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- SCHEMAS
-- ============================================================
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS warung;
CREATE SCHEMA IF NOT EXISTS agent;
CREATE SCHEMA IF NOT EXISTS n8n;

-- ============================================================
-- SHARED TRIGGER FUNCTION (updated_at bookkeeping)
-- ============================================================
CREATE OR REPLACE FUNCTION core.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- CORE SCHEMA — identity, audit
-- ============================================================
CREATE TABLE core.users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username        VARCHAR(50) UNIQUE NOT NULL,
    pin_hash        TEXT NOT NULL,
    full_name       VARCHAR(100) NOT NULL,
    role            VARCHAR(20) NOT NULL CHECK (role IN ('owner','cashier','agent_operator')),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON core.users
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

CREATE TABLE core.audit_log (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID REFERENCES core.users(id),
    action          VARCHAR(100) NOT NULL,
    entity_table    VARCHAR(100),
    entity_id       TEXT,
    metadata        JSONB,
    ip_address      INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_created_at ON core.audit_log (created_at DESC);
CREATE INDEX idx_audit_log_user_id ON core.audit_log (user_id);

-- ============================================================
-- WARUNG SCHEMA — physical retail
-- ============================================================
CREATE TABLE warung.products (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    barcode             VARCHAR(64) NOT NULL,
    sku                 VARCHAR(32),
    name                VARCHAR(150) NOT NULL,
    category            VARCHAR(50) NOT NULL DEFAULT 'general',
    unit                VARCHAR(20) NOT NULL DEFAULT 'pcs',
    cost_price          NUMERIC(12,2) NOT NULL DEFAULT 0,
    sell_price          NUMERIC(12,2) NOT NULL,
    stock_qty           NUMERIC(12,2) NOT NULL DEFAULT 0,
    reorder_threshold   NUMERIC(12,2) NOT NULL DEFAULT 5,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Critical hot-path index: every barcode scan hits this.
CREATE UNIQUE INDEX uq_products_barcode ON warung.products (barcode);
CREATE INDEX idx_products_name ON warung.products (name);
CREATE INDEX idx_products_active_lowstock
    ON warung.products (is_active, stock_qty)
    WHERE is_active = true;

CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON warung.products
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

CREATE TABLE warung.sales (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_code    VARCHAR(30) UNIQUE NOT NULL,
    cashier_id          UUID NOT NULL REFERENCES core.users(id),
    subtotal            NUMERIC(12,2) NOT NULL,
    discount            NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_amount        NUMERIC(12,2) NOT NULL,
    payment_method      VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash','qris','transfer','split')),
    payment_received    NUMERIC(12,2) NOT NULL DEFAULT 0,
    change_given        NUMERIC(12,2) NOT NULL DEFAULT 0,
    status              VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','voided')),
    split_cash_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
    split_qris_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sales_created_at ON warung.sales (created_at DESC);
CREATE INDEX idx_sales_cashier ON warung.sales (cashier_id);

CREATE TABLE warung.sale_items (
    id                      BIGSERIAL PRIMARY KEY,
    sale_id                 UUID NOT NULL REFERENCES warung.sales(id) ON DELETE CASCADE,
    product_id              UUID NOT NULL REFERENCES warung.products(id),
    qty                     NUMERIC(12,2) NOT NULL,
    unit_price              NUMERIC(12,2) NOT NULL,
    cost_price_snapshot     NUMERIC(12,2) NOT NULL,
    subtotal                NUMERIC(12,2) NOT NULL
);

CREATE INDEX idx_sale_items_sale_id ON warung.sale_items (sale_id);
CREATE INDEX idx_sale_items_product_id ON warung.sale_items (product_id);

CREATE TABLE warung.stock_movements (
    id              BIGSERIAL PRIMARY KEY,
    product_id      UUID NOT NULL REFERENCES warung.products(id),
    movement_type   VARCHAR(20) NOT NULL CHECK (movement_type IN ('sale','restock','adjustment','void_return')),
    qty_change      NUMERIC(12,2) NOT NULL,
    reference_id    TEXT,
    note            TEXT,
    created_by      UUID REFERENCES core.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_movements_product_id ON warung.stock_movements (product_id, created_at DESC);

-- ============================================================
-- AGENT SCHEMA — AmarthaFin virtual float
-- ============================================================
CREATE TABLE agent.service_providers (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_type        VARCHAR(30) NOT NULL CHECK (service_type IN
                            ('e_wallet_topup','bill_payment','qris_deposit','cash_withdrawal','transfer')),
    provider_name       VARCHAR(50) NOT NULL,
    admin_fee           NUMERIC(10,2) NOT NULL DEFAULT 0,
    agent_commission    NUMERIC(10,2) NOT NULL DEFAULT 0,
    is_active           BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE agent.transactions (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_code        VARCHAR(30) UNIQUE NOT NULL,
    operator_id             UUID NOT NULL REFERENCES core.users(id),
    service_provider_id     UUID REFERENCES agent.service_providers(id),
    service_type            VARCHAR(30) NOT NULL,
    customer_phone          VARCHAR(20),
    amount                  NUMERIC(12,2) NOT NULL,
    admin_fee               NUMERIC(10,2) NOT NULL DEFAULT 0,
    agent_commission        NUMERIC(10,2) NOT NULL DEFAULT 0,
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','success','failed','reversed')),
    provider_ref_id         VARCHAR(100),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    settled_at              TIMESTAMPTZ
);

CREATE INDEX idx_agent_tx_status_created ON agent.transactions (status, created_at DESC);
CREATE INDEX idx_agent_tx_provider_ref ON agent.transactions (provider_ref_id);

CREATE TABLE agent.float_ledger (
    id              BIGSERIAL PRIMARY KEY,
    entry_type      VARCHAR(20) NOT NULL CHECK (entry_type IN
                        ('deposit_in','deposit_out','commission_earned','settlement','manual_adjustment')),
    amount          NUMERIC(12,2) NOT NULL,
    balance_after   NUMERIC(12,2) NOT NULL,
    reference_id    UUID,
    note            TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_float_ledger_created_at ON agent.float_ledger (created_at DESC);

CREATE TABLE agent.daily_closing (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    closing_date            DATE UNIQUE NOT NULL,
    opening_float           NUMERIC(12,2) NOT NULL,
    closing_float           NUMERIC(12,2) NOT NULL,
    total_transactions      INT NOT NULL DEFAULT 0,
    total_commission        NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_admin_fee         NUMERIC(12,2) NOT NULL DEFAULT 0,
    closed_by               UUID REFERENCES core.users(id),
    status                  VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agent.webhook_events (
    id                  BIGSERIAL PRIMARY KEY,
    event_id            VARCHAR(150) UNIQUE NOT NULL,
    provider            VARCHAR(50) NOT NULL,
    payload             JSONB NOT NULL,
    signature_valid     BOOLEAN NOT NULL DEFAULT false,
    processed           BOOLEAN NOT NULL DEFAULT false,
    related_tx_id       UUID REFERENCES agent.transactions(id),
    received_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at         TIMESTAMPTZ
);

CREATE INDEX idx_webhook_events_processed ON agent.webhook_events (processed, received_at);

-- ============================================================
-- REPORTING VIEWS — kept deliberately separate, never joined
-- ============================================================
CREATE OR REPLACE VIEW warung.v_daily_summary AS
SELECT
    date_trunc('day', s.created_at)                                AS sale_date,
    COUNT(DISTINCT s.id)                                           AS transaction_count,
    SUM(s.total_amount)                                            AS gross_revenue,
    SUM(CASE WHEN s.payment_method = 'cash' THEN s.total_amount WHEN s.payment_method = 'split' THEN s.split_cash_amount ELSE 0 END) AS cash_revenue,
    SUM(CASE WHEN s.payment_method = 'qris' THEN s.total_amount WHEN s.payment_method = 'split' THEN s.split_qris_amount ELSE 0 END) AS qris_revenue,
    SUM(CASE WHEN s.payment_method = 'transfer' THEN s.total_amount ELSE 0 END) AS transfer_revenue,
    SUM(si.subtotal - (si.cost_price_snapshot * si.qty))           AS gross_margin
FROM warung.sales s
JOIN warung.sale_items si ON si.sale_id = s.id
WHERE s.status = 'completed'
GROUP BY 1
ORDER BY 1 DESC;

CREATE OR REPLACE VIEW agent.v_daily_summary AS
SELECT
    date_trunc('day', t.created_at)    AS tx_date,
    t.service_type,
    COUNT(*)                            AS transaction_count,
    SUM(t.amount)                       AS gross_volume,
    SUM(t.agent_commission)             AS commission_earned,
    SUM(t.admin_fee)                    AS admin_fee_collected
FROM agent.transactions t
WHERE t.status = 'success'
GROUP BY 1, 2
ORDER BY 1 DESC;

-- ============================================================
-- SEED: single admin owner account
-- ============================================================
INSERT INTO core.users (username, pin_hash, full_name, role)
VALUES ('admin', crypt('123456', gen_salt('bf', 12)), 'Store Owner', 'owner')
ON CONFLICT (username) DO NOTHING;
