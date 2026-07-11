import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { requireRole } from '@/lib/rbac';
import { enforceRateLimit } from '@/lib/rate-limiter';
import { ensureCupsProxy } from '@/lib/print/proxy';

const execAsync = promisify(exec);

function alignLeftRight(left: string, right: string, width = 32): string {
  const spacesNeeded = width - left.length - right.length;
  if (spacesNeeded <= 0) {
    return left + ' ' + right;
  }
  return left + ' '.repeat(spacesNeeded) + right;
}

function wrapText(text: string, width = 32): string[] {
  if (!text) return [];
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + (currentLine ? ' ' : '') + word).length <= width) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function buildRawReceiptText(d: any): Buffer {
  const width = 32;
  const parts: Buffer[] = [];

  const STORE_NAME = 'Warung Rafilah';
  const STORE_ADDR = 'Jl. Mawar No.2335, RT 08, RW 02, Kelurahan Sukajaya, Kecamatan Sukarami';
  const STORE_PHONE = '082339176569';

  // Helper untuk menulis teks
  const addLine = (text: string) => {
    parts.push(Buffer.from(text + '\n', 'utf-8'));
  };

  // ESC/POS Alignment Commands
  const alignCenter = () => parts.push(Buffer.from([0x1B, 0x61, 0x01]));
  const alignLeft = () => parts.push(Buffer.from([0x1B, 0x61, 0x00]));

  // Inisialisasi printer
  parts.push(Buffer.from([0x1B, 0x40]));

  // Buka laci kasir jika metode pembayaran TUNAI (CASH) atau SPLIT
  const method = d.payment_method?.toUpperCase();
  if (d.type === 'warung' && (method === 'CASH' || method === 'SPLIT')) {
    // ESC p 0 25 25 (Pin 2 kick drawer)
    parts.push(Buffer.from([0x1B, 0x70, 0x00, 0x19, 0x19]));
  }

  // 1. Header (Rata Tengah Hardware)
  alignCenter();
  addLine('='.repeat(width));
  addLine(STORE_NAME);
  
  const wrappedAddr = wrapText(STORE_ADDR, width);
  for (const line of wrappedAddr) {
    addLine(line);
  }
  if (STORE_PHONE) {
    addLine(`Telp: ${STORE_PHONE}`);
  }
  addLine('='.repeat(width));

  // 2. Metadata Transaksi (Rata Kiri Hardware)
  alignLeft();
  
  const ts = new Date(d.timestamp);
  const dateStr = ts.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = ts.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  if (d.type === 'warung') {
    addLine(alignLeftRight(`Tgl   : ${dateStr} ${timeStr}`, '', width));
    addLine(alignLeftRight(`Kasir : ${d.cashier}`, '', width));
    addLine(alignLeftRight(`Struk : ${d.transaction_code}`, '', width));
    addLine('-'.repeat(width));

    // Items
    for (const item of d.items) {
      const wrappedName = wrapText(item.name, width);
      for (const nameLine of wrappedName) {
        addLine(nameLine);
      }
      const details = `  ${item.qty} x ${item.unit_price.toLocaleString('id-ID')}`;
      const subtotal = item.subtotal.toLocaleString('id-ID');
      addLine(alignLeftRight(details, subtotal, width));
    }
    addLine('-'.repeat(width));

    // Totals
    if (d.discount && d.discount > 0) {
      const subTotalVal = d.total + d.discount;
      addLine(alignLeftRight('Subtotal', subTotalVal.toLocaleString('id-ID'), width));
      addLine(alignLeftRight('Diskon', `-${d.discount.toLocaleString('id-ID')}`, width));
      addLine('-'.repeat(width));
    }
    
    addLine(alignLeftRight('TOTAL', `Rp ${d.total.toLocaleString('id-ID')}`, width));
    addLine('-'.repeat(width));

    // Payment details
    const method = d.payment_method?.toUpperCase();
    if (method === 'SPLIT') {
      addLine(alignLeftRight('Bayar (SPLIT)', '', width));
      addLine(alignLeftRight('  - Tunai', (d.split_cash_amount || 0).toLocaleString('id-ID'), width));
      addLine(alignLeftRight('  - QRIS', (d.split_qris_amount || 0).toLocaleString('id-ID'), width));
      addLine(alignLeftRight('Kembali', d.change.toLocaleString('id-ID'), width));
    } else if (method === 'DEBT') {
      addLine(alignLeftRight('Bayar (BON/HUTANG)', '', width));
      if (d.payment_received > 0) {
        addLine(alignLeftRight('  - DP Tunai', d.payment_received.toLocaleString('id-ID'), width));
        addLine(alignLeftRight('  - Sisa Bon', (d.total - d.payment_received).toLocaleString('id-ID'), width));
      } else {
        addLine(alignLeftRight('  - Sisa Bon', d.total.toLocaleString('id-ID'), width));
      }
    } else {
      const label = method === 'QRIS' ? 'Bayar (QRIS)' : 'Bayar (TUNAI)';
      const receivedVal = method === 'QRIS' ? 'QRIS' : d.payment_received.toLocaleString('id-ID');
      addLine(alignLeftRight(label, receivedVal, width));
      if (method !== 'QRIS') {
        addLine(alignLeftRight('Kembali', d.change.toLocaleString('id-ID'), width));
      }
    }

  } else {
    // Agent receipt
    alignCenter();
    addLine('STRUK LAYANAN AGEN');
    addLine(d.service_label.toUpperCase());
    alignLeft();
    addLine('-'.repeat(width));
    
    addLine(alignLeftRight(`Tgl   : ${dateStr} ${timeStr}`, '', width));
    addLine(alignLeftRight(`Opr   : ${d.operator}`, '', width));
    addLine(alignLeftRight(`Struk : ${d.transaction_code}`, '', width));
    addLine('-'.repeat(width));

    addLine(alignLeftRight('Nominal', d.amount.toLocaleString('id-ID'), width));
    addLine(alignLeftRight('Biaya Admin', d.admin_fee.toLocaleString('id-ID'), width));
    if (d.customer_phone) {
      addLine(alignLeftRight('No. HP', d.customer_phone, width));
    }
    addLine('-'.repeat(width));
    
    addLine(alignLeftRight('TOTAL BAYAR', `Rp ${d.total_charge.toLocaleString('id-ID')}`, width));
    addLine('-'.repeat(width));
    
    alignCenter();
    addLine('Status: PENDING');
    addLine('Simpan struk sebagai');
    addLine('bukti transaksi yang sah');
  }

  // 3. Footer (Rata Tengah Hardware)
  alignCenter();
  addLine('='.repeat(width));
  addLine('Terima Kasih');
  addLine('Atas Kunjungan Anda!');
  alignLeft();
  
  // Perintah potong kertas otomatis (GS V 66 0)
  parts.push(Buffer.from([0x1D, 0x56, 0x42, 0x00]));

  return Buffer.concat(parts);
}

export async function POST(req: Request) {
  const forbidden = requireRole(req, ['owner', 'cashier']);
  if (forbidden) return forbidden;

  const rateLimited = enforceRateLimit(req, 'API_WRITE', '/api/print');
  if (rateLimited) return rateLimited;

  // Pastikan proxy TCP ke CUPS host aktif
  ensureCupsProxy();

  try {
    const data = await req.json();
    const buffer = buildRawReceiptText(data);
    
    // Tulis buffer ke file sementara
    const tempPath = `/tmp/receipt-${Date.now()}-${Math.floor(Math.random() * 1000)}.bin`;
    await fs.writeFile(tempPath, buffer);

    try {
      // Cetak ke printer default CUPS di host melalui proxy local secara RAW (raw bytes)
      await execAsync(`lp -o raw ${tempPath}`, {
        env: {
          ...process.env,
          CUPS_SERVER: '127.0.0.1:8631'
        }
      });
      return NextResponse.json({ ok: true });
    } finally {
      // Bersihkan file sementara
      await fs.unlink(tempPath).catch(() => {});
    }
  } catch (err) {
    console.error('API print error:', err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
