/** Thermal receipt printer via browser window.print() */

export interface WarungReceiptData {
  type: 'warung';
  transaction_code: string;
  cashier: string;
  items: { name: string; qty: number; unit_price: number; subtotal: number }[];
  total: number;
  discount?: number;
  payment_method: 'CASH' | 'QRIS' | 'SPLIT' | 'DEBT';
  payment_received: number;
  split_cash_amount?: number;
  split_qris_amount?: number;
  change: number;
  timestamp: Date;
}

export interface AgentReceiptData {
  type: 'agent';
  transaction_code: string;
  operator: string;
  service_label: string;
  customer_phone?: string;
  amount: number;
  admin_fee: number;
  total_charge: number;
  commission: number;
  timestamp: Date;
}

export type ReceiptData = WarungReceiptData | AgentReceiptData;

/**
 * Cetak struk ke thermal printer dengan mengirimkan data ke backend API /api/print.
 * Backend akan memproses data menjadi teks terformat 32 karakter dan mencetaknya
 * langsung menggunakan CUPS (lp) di host Linux Mint.
 *
 * Ini adalah solusi terbaik dan paling andal karena:
 * 1. Bekerja secara otomatis dan senyap (silent printing) tanpa membuka dialog cetak browser.
 * 2. Menghindari pemblokiran popup/print dialog di Firefox secara permanen.
 * 3. Menghindari bug konversi file grafis/PDF di CUPS (karena kita mencetak teks mentah langsung).
 *
 * @param data - Typed receipt data (warung or agent)
 */
export function printReceipt(data: ReceiptData): void {
  fetch('/api/print', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(res => {
    if (!res.ok) {
      console.error('printReceipt: Gagal mengirim perintah cetak ke server API');
    }
  })
  .catch(err => {
    console.error('printReceipt error:', err);
  });
}
