import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { requireRole } from '@/lib/rbac';
import { enforceRateLimit } from '@/lib/rate-limiter';
import { ensureCupsProxy } from '@/lib/print/proxy';

const execAsync = promisify(exec);

/**
 * ESC/POS cash drawer open command.
 * Format: ESC p pin T1 T2
 *   - 0x1B = ESC
 *   - 0x70 = p  (drawer kick)
 *   - 0x00 = pin 2 (use 0x01 for pin 5 if drawer does not open)
 *   - 0x19 = T1 on-time  = 25ms
 *   - 0x19 = T2 off-time = 25ms
 */
const DRAWER_CMD = Buffer.from([0x1b, 0x70, 0x00, 0x19, 0x19]);

/**
 * POST /api/cash-drawer
 * Kirim sinyal buka laci kasir ke thermal printer via CUPS proxy secara RAW.
 */
export async function POST(req: Request) {
  const forbidden = requireRole(req, ['owner', 'cashier']);
  if (forbidden) return forbidden;

  const rateLimited = enforceRateLimit(req, 'API_WRITE', '/api/cash-drawer');
  if (rateLimited) return rateLimited;

  // Pastikan proxy TCP ke CUPS host aktif
  ensureCupsProxy();

  try {
    // Tulis drawer kick command ke file sementara
    const tempPath = `/tmp/drawer-${Date.now()}-${Math.floor(Math.random() * 1000)}.bin`;
    await fs.writeFile(tempPath, DRAWER_CMD);

    try {
      // Kirim perintah kick ke printer default CUPS di host via proxy local secara RAW
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
    // Log error tapi jangan crash — transaksi sudah berhasil
    console.error('cash-drawer: gagal membuka laci via CUPS proxy:', err);
    return NextResponse.json(
      { ok: false, reason: String(err) },
      { status: 500 }
    );
  }
}
