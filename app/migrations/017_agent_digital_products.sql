-- ============================================================
-- 017: Katalog Produk Digital Agen + Detail Transaksi
-- ============================================================

-- 1. Buat tabel katalog produk digital
CREATE TABLE IF NOT EXISTS agent.digital_products (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category            VARCHAR(30) NOT NULL,
    product_name        VARCHAR(80) NOT NULL,
    product_code        VARCHAR(30) UNIQUE NOT NULL,
    admin_fee           NUMERIC(10,2) NOT NULL DEFAULT 0,
    agent_commission    NUMERIC(10,2) NOT NULL DEFAULT 0,
    icon_emoji          VARCHAR(10) DEFAULT '📱',
    is_active           BOOLEAN NOT NULL DEFAULT true,
    sort_order          INT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_digital_products_category ON agent.digital_products (category, is_active);

-- 2. Tambah kolom product di tabel transaksi
ALTER TABLE agent.transactions
    ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES agent.digital_products(id),
    ADD COLUMN IF NOT EXISTS product_name VARCHAR(80);

-- 3. Update CHECK constraint service_type agar mendukung kategori baru
-- Hapus constraint lama
ALTER TABLE agent.transactions DROP CONSTRAINT IF EXISTS transactions_service_type_check;
ALTER TABLE agent.service_providers DROP CONSTRAINT IF EXISTS service_providers_service_type_check;

-- Tambah constraint baru dengan kategori lengkap
ALTER TABLE agent.transactions ADD CONSTRAINT transactions_service_type_check
    CHECK (service_type IN (
        'e_wallet_topup', 'bill_payment', 'qris_deposit', 'cash_withdrawal', 'transfer',
        'listrik', 'bpjs', 'pajak', 'e_wallet', 'pulsa_data', 'topup_game',
        'air_pdam', 'transfer_bank', 'tarik_tunai', 'tv_internet', 'asuransi'
    ));

ALTER TABLE agent.service_providers ADD CONSTRAINT service_providers_service_type_check
    CHECK (service_type IN (
        'e_wallet_topup', 'bill_payment', 'qris_deposit', 'cash_withdrawal', 'transfer',
        'listrik', 'bpjs', 'pajak', 'e_wallet', 'pulsa_data', 'topup_game',
        'air_pdam', 'transfer_bank', 'tarik_tunai', 'tv_internet', 'asuransi'
    ));

-- 4. Seed data produk digital populer
INSERT INTO agent.digital_products (category, product_name, product_code, admin_fee, agent_commission, icon_emoji, sort_order) VALUES
    -- Listrik
    ('listrik', 'Token PLN Prabayar',      'PLN_TOKEN',     2500, 2000, '⚡', 10),
    ('listrik', 'Tagihan PLN Pascabayar',   'PLN_PASCA',     2500, 2000, '⚡', 11),

    -- BPJS
    ('bpjs', 'BPJS Kesehatan',             'BPJS_KES',      2500, 1500, '🏥', 20),
    ('bpjs', 'BPJS Ketenagakerjaan',       'BPJS_TK',       2500, 1500, '🏥', 21),

    -- Pajak
    ('pajak', 'PBB (Pajak Bumi Bangunan)', 'PBB',           2500, 2000, '🏛️', 30),
    ('pajak', 'Samsat / PKB',              'SAMSAT',         2500, 2000, '🏛️', 31),

    -- E-Wallet
    ('e_wallet', 'Dana',                   'EWALLET_DANA',   1000, 1500, '💳', 40),
    ('e_wallet', 'GoPay',                  'EWALLET_GOPAY',  1000, 1500, '💳', 41),
    ('e_wallet', 'OVO',                    'EWALLET_OVO',    1000, 1500, '💳', 42),
    ('e_wallet', 'ShopeePay',              'EWALLET_SPAY',   1000, 1500, '💳', 43),
    ('e_wallet', 'LinkAja',                'EWALLET_LAJA',   1000, 1500, '💳', 44),

    -- Pulsa & Data
    ('pulsa_data', 'Telkomsel',            'PULSA_TSEL',     1000, 1500, '📶', 50),
    ('pulsa_data', 'XL Axiata',            'PULSA_XL',       1000, 1500, '📶', 51),
    ('pulsa_data', 'Indosat Ooredoo',      'PULSA_ISAT',     1000, 1500, '📶', 52),
    ('pulsa_data', 'Tri (3)',              'PULSA_TRI',      1000, 1500, '📶', 53),
    ('pulsa_data', 'Axis',                 'PULSA_AXIS',     1000, 1500, '📶', 54),
    ('pulsa_data', 'Smartfren',            'PULSA_SMART',    1000, 1500, '📶', 55),

    -- Top-Up Game
    ('topup_game', 'Mobile Legends',       'GAME_MLBB',      1000, 1000, '🎮', 60),
    ('topup_game', 'Free Fire',            'GAME_FF',         1000, 1000, '🎮', 61),
    ('topup_game', 'PUBG Mobile',          'GAME_PUBG',       1000, 1000, '🎮', 62),
    ('topup_game', 'Genshin Impact',       'GAME_GENSHIN',    1000, 1000, '🎮', 63),
    ('topup_game', 'Valorant',             'GAME_VALO',       1000, 1000, '🎮', 64),
    ('topup_game', 'Honor of Kings',       'GAME_HOK',        1000, 1000, '🎮', 65),

    -- Air / PDAM
    ('air_pdam', 'PDAM',                   'PDAM',            2500, 1500, '💧', 70),

    -- TV & Internet
    ('tv_internet', 'Telkom IndiHome',     'INDIHOME',        2500, 2000, '📺', 80),
    ('tv_internet', 'Biznet',              'BIZNET',          2500, 2000, '📺', 81),
    ('tv_internet', 'MNC Vision',          'MNC_VISION',      2500, 2000, '📺', 82),

    -- Transfer Bank
    ('transfer_bank', 'Transfer Bank',     'TRANSFER_BANK',   3000, 2500, '🏦', 90),

    -- Tarik Tunai
    ('tarik_tunai', 'Tarik Tunai',         'TARIK_TUNAI',     5000, 3000, '💵', 100)

ON CONFLICT (product_code) DO NOTHING;
