import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';

/**
 * ESC/POS cash drawer open command.
 * Format: ESC p pin T1 T2
 *   - 0x1B = ESC
 *   - 0x70 = p  (drawer kick)
 *   - 0x00 = pin 2 (use 0x01 for pin 5 jika drawer tidak terbuka)
 *   - 0x19 = T1 on-time  = 25ms
 *   - 0x19 = T2 off-time = 25ms
 */
const DRAWER_CMD = Buffer.from([0x1b, 0x70, 0x00, 0x19, 0x19]);

/**
 * POST /api/cash-drawer
 * Kirim sinyal buka laci kasir ke thermal printer via ESC/POS.
 * Printer kemudian meneruskan sinyal ke laci lewat kabel RJ12.
 */
export async function POST() {
  const device = process.env.CASH_DRAWER_DEVICE;

  if (!device) {
    console.warn('cash-drawer: CASH_DRAWER_DEVICE tidak dikonfigurasi di .env');
    // Gagal diam-diam agar tidak mengganggu alur transaksi
    return NextResponse.json({ ok: false, reason: 'not_configured' });
  }

  try {
    await writeFile(device, DRAWER_CMD);
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Log error tapi jangan crash — transaksi sudah berhasil
    console.error(`cash-drawer: gagal membuka laci via ${device}:`, err);
    return NextResponse.json(
      { ok: false, reason: String(err) },
      { status: 500 }
    );
  }
}
