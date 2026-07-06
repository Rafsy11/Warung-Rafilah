-- Migration 016: Tambahkan 'pending' ke sales_status_check constraint
-- Diperlukan untuk alur pembayaran QRIS yang membutuhkan status intermediate

BEGIN;

-- Drop constraint lama
ALTER TABLE warung.sales DROP CONSTRAINT IF EXISTS sales_status_check;

-- Tambahkan constraint baru yang mengizinkan 'pending'
ALTER TABLE warung.sales 
  ADD CONSTRAINT sales_status_check 
  CHECK (status IN ('completed', 'voided', 'pending'));

COMMIT;
