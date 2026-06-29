import { z } from 'zod';

// Auth validation schemas
export const loginSchema = z.object({
  username: z.string()
    .min(3, 'Username minimal 3 karakter')
    .max(50, 'Username maksimal 50 karakter')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username hanya boleh huruf, angka, underscore dan dash'),
  pin: z.string()
    .min(4, 'PIN minimal 4 karakter')
    .max(6, 'PIN maksimal 6 karakter')
    .regex(/^\d+$/, 'PIN hanya boleh angka')
});

// Product validation schemas
export const productCreateSchema = z.object({
  barcode: z.string()
    .min(1, 'Barcode wajib diisi')
    .max(50, 'Barcode maksimal 50 karakter')
    .regex(/^[a-zA-Z0-9-]+$/, 'Barcode tidak valid'),
  name: z.string()
    .min(1, 'Nama produk wajib diisi')
    .max(200, 'Nama produk maksimal 200 karakter')
    .trim(),
  category: z.string()
    .max(100, 'Kategori maksimal 100 karakter')
    .optional(),
  unit: z.string()
    .max(20, 'Unit maksimal 20 karakter')
    .optional(),
  cost_price: z.number()
    .min(0, 'Harga modal tidak boleh negatif')
    .max(1000000000, 'Harga modal terlalu besar'),
  sell_price: z.number()
    .min(0, 'Harga jual tidak boleh negatif')
    .max(1000000000, 'Harga jual terlalu besar'),
  stock_qty: z.number()
    .int('Stok harus bilangan bulat')
    .min(0, 'Stok tidak boleh negatif')
    .max(1000000, 'Stok terlalu besar'),
  reorder_threshold: z.number()
    .int('Threshold harus bilangan bulat')
    .min(0, 'Threshold tidak boleh negatif')
    .optional()
});

export const productUpdateSchema = productCreateSchema.partial();

// Sale validation schemas
export const saleItemSchema = z.object({
  product_id: z.string().uuid('Product ID tidak valid'),
  qty: z.number()
    .int('Qty harus bilangan bulat')
    .min(1, 'Qty minimal 1')
    .max(10000, 'Qty terlalu besar'),
  unit_price: z.number()
    .min(0, 'Harga tidak boleh negatif')
    .max(1000000000, 'Harga terlalu besar')
});

export const createSaleSchema = z.object({
  items: z.array(saleItemSchema)
    .min(1, 'Minimal 1 item dalam transaksi')
    .max(100, 'Maksimal 100 item per transaksi'),
  payment_method: z.enum(['cash', 'qris', 'transfer'] as const, {
    message: 'Payment method tidak valid'
  }),
  payment_received: z.number()
    .min(0, 'Pembayaran tidak boleh negatif')
    .optional(),
  customer_change: z.number()
    .min(0, 'Kembalian tidak boleh negatif')
    .optional()
});

// Agent transaction validation schemas
export const agentTransactionSchema = z.object({
  service_type: z.string()
    .min(1, 'Jenis layanan wajib diisi')
    .max(50, 'Jenis layanan terlalu panjang'),
  provider: z.string()
    .min(1, 'Provider wajib diisi')
    .max(50, 'Provider terlalu panjang'),
  customer_phone: z.string()
    .regex(/^(\+62|62|0)[0-9]{9,12}$/, 'Format nomor telepon tidak valid')
    .optional(),
  amount: z.number()
    .min(1, 'Jumlah minimal Rp 1')
    .max(10000000, 'Jumlah maksimal Rp 10 juta'),
  admin_fee: z.number()
    .min(0, 'Biaya admin tidak boleh negatif')
    .max(100000, 'Biaya admin terlalu besar')
    .optional(),
  agent_commission: z.number()
    .min(0, 'Komisi tidak boleh negatif')
    .max(100000, 'Komisi terlalu besar')
    .optional()
});

// Stock adjustment validation
export const stockAdjustmentSchema = z.object({
  product_id: z.string().uuid('Product ID tidak valid'),
  adjustment_type: z.enum(['in', 'out', 'correction'] as const, {
    message: 'Tipe adjustment tidak valid'
  }),
  qty_change: z.number()
    .int('Perubahan qty harus bilangan bulat')
    .min(1, 'Perubahan qty minimal 1')
    .max(10000, 'Perubahan qty terlalu besar'),
  note: z.string()
    .max(500, 'Catatan maksimal 500 karakter')
    .optional()
});

// Float balance adjustment
export const floatAdjustmentSchema = z.object({
  amount: z.number()
    .min(1, 'Jumlah minimal Rp 1')
    .max(100000000, 'Jumlah terlalu besar'),
  entry_type: z.enum(['deposit_in', 'deposit_out', 'commission_earned', 'fee_deducted'] as const, {
    message: 'Tipe entry tidak valid'
  }),
  note: z.string()
    .max(500, 'Catatan maksimal 500 karakter')
    .optional()
});

// Helper function untuk validate request body
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  try {
    const parsed = schema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      return { 
        success: false, 
        error: firstError.message 
      };
    }
    return { 
      success: false, 
      error: 'Invalid input data' 
    };
  }
}
