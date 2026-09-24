import { z } from 'zod';
import type { PoolClient } from 'pg';

export const productFields = z.object({
  barcode: z.string().trim().min(1).max(64), name: z.string().trim().min(1).max(200),
  category: z.string().max(100).nullable().optional(), unit: z.string().max(20).nullable().optional(),
  cost_price: z.number().finite().min(0).max(1e9), sell_price: z.number().finite().min(0).max(1e9),
  stock_qty: z.number().finite().min(0).max(1e6), reorder_threshold: z.number().finite().min(0).max(1e6).nullable().optional(),
  is_consignment: z.boolean().nullable().optional(), consignment_supplier_name: z.string().max(100).nullable().optional(),
  consignment_cost_share: z.number().finite().min(0).max(1e9).nullable().optional(),
  nearest_expiry_date: z.string().nullable().optional().transform(val => {
    if (!val) return null;
    const match = val.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
  }),
});

export async function logStockChange(client: PoolClient, id: string, before: number, after: number, userId: string | null, note: string) {
  if (before !== after) await client.query(`INSERT INTO warung.stock_movements
    (product_id,movement_type,qty_change,note,created_by) VALUES ($1,'adjustment',$2,$3,$4)`, [id,after-before,note,userId]);
}
