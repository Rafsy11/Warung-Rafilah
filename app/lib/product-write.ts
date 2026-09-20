import { z } from 'zod';
import type { PoolClient } from 'pg';

export const productFields = z.object({
  barcode: z.string().trim().min(1).max(50), name: z.string().trim().min(1).max(200),
  category: z.string().max(100).nullable().optional(), unit: z.string().min(1).max(20).optional(),
  cost_price: z.number().finite().min(0).max(1e9), sell_price: z.number().finite().min(0).max(1e9),
  stock_qty: z.number().finite().min(0).max(1e6), reorder_threshold: z.number().finite().min(0).max(1e6).optional(),
  is_consignment: z.boolean().optional(), consignment_supplier_name: z.string().max(100).nullable().optional(),
  consignment_cost_share: z.number().finite().min(0).max(1e9).optional(),
  nearest_expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export async function logStockChange(client: PoolClient, id: string, before: number, after: number, userId: string | null, note: string) {
  if (before !== after) await client.query(`INSERT INTO warung.stock_movements
    (product_id,movement_type,qty_change,note,created_by) VALUES ($1,'adjustment',$2,$3,$4)`, [id,after-before,note,userId]);
}
