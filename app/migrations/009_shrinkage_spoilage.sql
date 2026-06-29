-- ============================================================
-- MIGRATION: 009_shrinkage_spoilage.sql
-- Description: Updates stock_movements constraint to allow damaged, expired, stolen.
-- ============================================================

-- Drop the old constraint if it exists (standard inline constraint name)
ALTER TABLE warung.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;

-- Add updated check constraint to allow new shrinkage types
ALTER TABLE warung.stock_movements ADD CONSTRAINT stock_movements_movement_type_check 
    CHECK (movement_type IN ('sale', 'restock', 'adjustment', 'void_return', 'damaged', 'expired', 'stolen'));
