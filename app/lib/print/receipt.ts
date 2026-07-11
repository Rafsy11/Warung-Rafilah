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

const STORE_NAME   = 'Warung Rafilah';
const STORE_ADDR   = 'Jl. Mawar No.2335, RT 08, RW 02, Kelurahan Sukajaya, Kecamatan Sukarami';
const STORE_PHONE  = '082339176569';

function formatRp(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

function buildWarungHtml(d: WarungReceiptData): string {
  const ts = d.timestamp;
  const dateStr = ts.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = ts.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  const itemLines = d.items.map(i => `
    <div class="row-item">
      <div class="item-name">${i.name}</div>
      <div class="item-details">
        <span>${i.qty} x ${formatRp(i.unit_price)}</span>
        <span class="bold">${formatRp(i.subtotal)}</span>
      </div>
    </div>
  `).join('');

  const isQris = d.payment_method === 'QRIS';
  const isSplit = d.payment_method === 'SPLIT';
  const isDebt = d.payment_method === 'DEBT';

  let paymentDetailsHtml = '';
  if (isSplit) {
    paymentDetailsHtml = `
      <div class="row">
        <span>Bayar:</span>
        <span class="bold">SPLIT</span>
      </div>
      <div class="row" style="font-size: 8.5px; opacity: 0.8; padding-left: 2mm;">
        <span>- Tunai (Cash):</span>
        <span>${formatRp(d.split_cash_amount || 0)}</span>
      </div>
      <div class="row" style="font-size: 8.5px; opacity: 0.8; padding-left: 2mm;">
        <span>- QRIS:</span>
        <span>${formatRp(d.split_qris_amount || 0)}</span>
      </div>
    `;
  } else if (isDebt) {
    paymentDetailsHtml = `
      <div class="row">
        <span>Bayar:</span>
        <span class="bold" style="color: #d32f2f;">HUTANG (BON)</span>
      </div>
      ${d.payment_received > 0 ? `
      <div class="row" style="font-size: 8.5px; opacity: 0.8; padding-left: 2mm;">
        <span>- Bayar Tunai (DP):</span>
        <span>${formatRp(d.payment_received)}</span>
      </div>
      <div class="row" style="font-size: 8.5px; opacity: 0.8; padding-left: 2mm;">
        <span>- Sisa Hutang:</span>
        <span>${formatRp(d.total - d.payment_received)}</span>
      </div>
      ` : ''}
    `;
  } else {
    paymentDetailsHtml = `
      <div class="row">
        <span>Bayar:</span>
        <span>${isQris ? 'QRIS' : formatRp(d.payment_received)}</span>
      </div>
      ${!isQris ? `
      <div class="row bold">
        <span>Kembali:</span>
        <span>${formatRp(d.change)}</span>
      </div>` : ''}
    `;
  }

  return `
<div class="receipt">
  <div class="center title">${STORE_NAME}</div>
  ${STORE_ADDR ? `<div class="center subtitle">${STORE_ADDR}</div>` : ''}
  ${STORE_PHONE ? `<div class="center subtitle">Tel: ${STORE_PHONE}</div>` : ''}
  
  <div class="divider"></div>
  
  <div class="row"><span>Tanggal:</span><span>${dateStr} ${timeStr}</span></div>
  <div class="row"><span>Kasir:</span><span>${d.cashier}</span></div>
  <div class="row"><span>No:</span><span>${d.transaction_code}</span></div>
  
  <div class="divider"></div>
  
  <div class="items-list">
    ${itemLines}
  </div>
  
  <div class="divider"></div>
  
  ${d.discount && d.discount > 0 ? `
  <div class="row" style="font-size: 8.5px; opacity: 0.85; margin-bottom: 0.5mm;">
    <span>Subtotal:</span>
    <span>${formatRp(d.total + d.discount)}</span>
  </div>
  <div class="row" style="font-size: 8.5px; opacity: 0.85; margin-bottom: 0.5mm;">
    <span>Diskon:</span>
    <span class="bold">-${formatRp(d.discount)}</span>
  </div>
  ` : ''}
  
  <div class="row bold" style="font-size: 12px; margin-top: 1mm;">
    <span>TOTAL</span>
    <span>${formatRp(d.total)}</span>
  </div>
  ${paymentDetailsHtml}
  
  <div class="divider-double"></div>
  
  <div class="center subtitle" style="margin-top: 1.5mm; font-weight: bold;">Terima kasih atas kunjungan Anda!</div>
  <div class="center subtitle" style="font-size: 8px; opacity: 0.6; margin-top: 0.5mm;">${d.transaction_code}</div>
  <div class="feed"></div>
</div>`;
}

function buildAgentHtml(d: AgentReceiptData): string {
  const ts = d.timestamp;
  const dateStr = ts.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = ts.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  return `
<div class="receipt">
  <div class="center title">${STORE_NAME}</div>
  ${STORE_ADDR ? `<div class="center subtitle">${STORE_ADDR}</div>` : ''}
  
  <div class="divider"></div>
  
  <div class="center bold" style="font-size: 11px; margin: 1mm 0; letter-spacing: 0.5px;">
    STRUK LAYANAN AGEN
  </div>
  <div class="center bold" style="font-size: 12px; margin-bottom: 1.5mm; text-transform: uppercase;">
    ${d.service_label}
  </div>
  
  <div class="divider"></div>
  
  <div class="row"><span>Tanggal:</span><span>${dateStr} ${timeStr}</span></div>
  <div class="row"><span>Operator:</span><span>${d.operator}</span></div>
  <div class="row"><span>No:</span><span>${d.transaction_code}</span></div>
  
  <div class="divider"></div>
  
  <div class="row">
    <span>Nominal:</span>
    <span>${formatRp(d.amount)}</span>
  </div>
  <div class="row">
    <span>Biaya Admin:</span>
    <span>${formatRp(d.admin_fee)}</span>
  </div>
  ${d.customer_phone ? `
  <div class="row">
    <span>No. HP:</span>
    <span>${d.customer_phone}</span>
  </div>` : ''}
  
  <div class="divider"></div>
  
  <div class="row bold" style="font-size: 12px; margin-top: 1mm;">
    <span>TOTAL BAYAR</span>
    <span>${formatRp(d.total_charge)}</span>
  </div>
  
  <div class="divider-double"></div>
  
  <div class="center subtitle" style="font-weight: bold; margin-top: 1.5mm;">Status: PENDING</div>
  <div class="center subtitle" style="font-size: 9px; opacity: 0.8;">Simpan struk sebagai bukti transaksi</div>
  <div class="center subtitle" style="font-size: 8px; opacity: 0.6; margin-top: 0.5mm;">${d.transaction_code}</div>
  <div class="feed"></div>
</div>`;
}

const RECEIPT_STYLE_ID = 'receipt-print-style';

/**
 * CSS struk — seluruhnya di dalam @media print agar tidak mempengaruhi tampilan POS di layar.
 * Lebar 48mm sesuai printable area driver HaoYin DT-58D (Printer POS58 v2.1).
 */
const RECEIPT_STYLE = `
  #receipt-print-area {
    display: none !important;
  }
  @media print {
    @page {
      margin: 0;
      size: 48mm auto;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: 48mm !important;
      height: auto !important;
      overflow: visible !important;
      background: #fff !important;
    }
    #pos-main-layout {
      display: none !important;
    }
    #receipt-print-area {
      display: block !important;
      margin: 0;
      padding: 0;
      width: 48mm;
    }
    #receipt-print-area * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    #receipt-print-area .receipt {
      padding: 1mm 2mm;
      width: 48mm;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 9.5px;
      color: #000;
      line-height: 1.3;
    }
    #receipt-print-area .center { text-align: center; }
    #receipt-print-area .bold  { font-weight: bold; }
    #receipt-print-area .title {
      font-size: 11.5px;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 2px;
      letter-spacing: 0.5px;
    }
    #receipt-print-area .subtitle { font-size: 8px; opacity: 0.8; margin-bottom: 2px; }
    #receipt-print-area .divider  { border-top: 1px dashed #000; margin: 1.5mm 0; }
    #receipt-print-area .divider-double { border-top: 3px double #000; margin: 1.5mm 0; }
    #receipt-print-area .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      margin-bottom: 0.8mm;
    }
    #receipt-print-area .row-item {
      display: flex;
      flex-direction: column;
      margin-bottom: 1.5mm;
    }
    #receipt-print-area .item-name    { word-break: break-word; font-weight: bold; }
    #receipt-print-area .item-details {
      display: flex;
      justify-content: space-between;
      font-size: 8.5px;
      margin-top: 0.3mm;
    }
    #receipt-print-area .feed { height: 10mm; }
  }
`;

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
