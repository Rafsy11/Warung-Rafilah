-- ============================================================
-- WARUNG LOCAL MASTER PRODUCTS & INVENTORY SCHEMA MIGRATION
-- Schema: warung
-- Purpose: Sub-5ms Offline Local Master Product Dictionary & Active Inventory
-- ============================================================

-- 1. LOCAL MASTER PRODUCTS (Kamus Produk Lokal)
CREATE TABLE IF NOT EXISTS warung.local_master_products (
    barcode         VARCHAR(64) PRIMARY KEY,
    nama_barang     VARCHAR(150) NOT NULL,
    kategori        VARCHAR(50) NOT NULL DEFAULT 'Umum',
    brand           VARCHAR(50) DEFAULT 'Generik',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- B-Tree Index for high-speed pattern lookups & autocomplete
CREATE INDEX IF NOT EXISTS idx_local_master_nama ON warung.local_master_products (nama_barang);
CREATE INDEX IF NOT EXISTS idx_local_master_kategori ON warung.local_master_products (kategori);

-- Trigger for updated_at bookkeeping
CREATE TRIGGER trg_local_master_products_updated_at
    BEFORE UPDATE ON warung.local_master_products
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- 2. ACTIVE STORE INVENTORIES (Stok Aktif Toko)
-- Ensures strict UNIQUE constraint on barcode field to prevent duplicate stock records
CREATE TABLE IF NOT EXISTS warung.store_inventories (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    barcode         VARCHAR(64) UNIQUE NOT NULL REFERENCES warung.local_master_products(barcode) ON DELETE CASCADE,
    harga_beli      NUMERIC(12,2) NOT NULL DEFAULT 0,
    harga_jual      NUMERIC(12,2) NOT NULL DEFAULT 0,
    stok            INT NOT NULL DEFAULT 0,
    batas_min_stok  INT NOT NULL DEFAULT 5,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- High-performance Indexing for sub-5ms queries
CREATE UNIQUE INDEX IF NOT EXISTS uq_store_inventories_barcode ON warung.store_inventories (barcode);
CREATE INDEX IF NOT EXISTS idx_store_inventories_stok ON warung.store_inventories (stok);

-- Trigger for updated_at bookkeeping
CREATE TRIGGER trg_store_inventories_updated_at
    BEFORE UPDATE ON warung.store_inventories
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
