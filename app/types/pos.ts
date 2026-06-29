/** Shared POS types — single source of truth for CartItem */
export interface CartItem {
  /** Product UUID from warung.products, or PPOB service code */
  id: string;
  barcode: string;
  name: string;
  qty: number;
  /** Sell price (warung) or customer charge (agent) */
  price: number;
  subtotal: number;
  basePrice?: number;
  appliedTierName?: string;
  pricingTiers?: {
    id: string;
    product_id: string;
    min_qty: number;
    tier_price: number;
    name: string;
  }[];
  /** True when item belongs to Agent (PPOB) mode */
  isAgent?: boolean;
  /** Agent modal/cost price — used for ledger separation */
  modal_price?: number;
  /** AmarthaFin digital service details for unified checkout */
  digitalDetails?: {
    service_type: 'e_wallet_topup' | 'bill_payment' | 'qris_deposit' | 'cash_withdrawal' | 'transfer';
    customer_phone?: string;
    amount: number;
    admin_fee: number;
    agent_commission: number;
  };
}
