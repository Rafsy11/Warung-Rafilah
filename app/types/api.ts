export interface CashSession { id: string; cashier_id: string; opened_at: string; starting_cash: string; status: 'open' | 'closed'; }
export interface SessionHistory extends CashSession { cashier_name: string; closed_at: string | null; expected_cash: string; actual_cash: string; cash_difference: string; total_cash_sales: string; total_qris_sales: string; total_debt_sales: string; notes: string | null; }
export interface Discount { id: string; name: string; discount_type: 'global' | 'product'; value_type: 'fixed' | 'percentage'; discount_value: number; min_purchase_amount: number; }
export interface DebtEntry { id: string; entry_type: string; amount: string; balance_after: string; note: string | null; created_at: string; created_by_name: string | null; }
export interface CustomerSale { id: string; transaction_code: string; total_amount: string; payment_method: string; created_at: string; }
export interface ShrinkageSummary { movement_type: string; total_occurrences: number; total_qty: number; total_loss: number | null; }
export interface ConsignmentSummary { supplier_name: string; total_sold_qty: number; total_unpaid_owed: number; total_paid_owed: number; }
export interface ConsignmentLog { id: string; supplier_name: string; product_name: string; product_unit: string; qty_sold: number; cost_share: number; total_owed: number; status: string; paid_at: string | null; created_at: string; }
export interface PricingTier { id?: string; product_id?: string; min_qty: number | string; tier_price: number | string; name: string; }
export interface ProcurementItem { id: string; name: string; barcode: string; stock_qty: number; reorder_threshold: number; suggested_qty: number; cost_price: number; estimated_cost: number; unit: string; category: string; }
export interface ConversionMap { id: string; source_product_id: string; dest_product_id: string; source_name: string; source_barcode: string; source_unit: string; source_stock: string; dest_name: string; dest_barcode: string; dest_unit: string; dest_stock: string; conversion_ratio: number; auto_convert: boolean; }
