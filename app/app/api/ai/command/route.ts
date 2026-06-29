import { NextResponse } from 'next/server';
import { db as pool } from '@/lib/db';

// ── Types ────────────────────────────────────────────────────────────────────
interface HistoryEntry { role: 'user' | 'model'; text: string; }

// ── Helpers ──────────────────────────────────────────────────────────────────
const idr = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

// ── Server-side rate limiter (20 req / 60 s per userId) ──────────────────────
const rlMap = new Map<string, number[]>();
function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const WINDOW = 60_000;
  const MAX = 20;
  const times = (rlMap.get(userId) ?? []).filter(t => t > now - WINDOW);
  if (times.length >= MAX) return true;
  times.push(now);
  rlMap.set(userId, times);
  return false;
}

// ── Prompt sanitizer ─────────────────────────────────────────────────────────
function sanitize(s: string): string {
  return s.replace(/[<>{}[\]]/g, '').replace(
    /\b(ignore previous|forget all|act as|you are now|system:|assistant:|SYSTEM:|HUMAN:)/gi, ''
  ).trim().slice(0, 500);
}

export async function POST(req: Request) {
  const userRole = req.headers.get('x-user-role');
  const userId   = req.headers.get('x-user-id') ?? 'unknown';

  if (userRole !== 'owner') {
    return NextResponse.json({ error: { code: 'forbidden', message: 'Akses ditolak. Hanya owner.' } }, { status: 403 });
  }

  if (isRateLimited(userId)) {
    return NextResponse.json({ error: { code: 'rate_limited', message: 'Terlalu banyak permintaan. Coba lagi sebentar.' } }, { status: 429 });
  }

  try {
    const body = await req.json();
    const {
      prompt: rawPrompt,
      history = [],
      productId,
      action: passedAction,
      quantity: passedQty,
      confirmed = false,
    } = body;

    if (!rawPrompt || typeof rawPrompt !== 'string') {
      return NextResponse.json({ error: { code: 'bad_request', message: 'Prompt tidak boleh kosong.' } }, { status: 400 });
    }

    const prompt = sanitize(rawPrompt);
    const client = await pool.connect();

    try {
      // ── Path A: Confirmed stock mutation execution ────────────────────────
      if (productId && passedAction && passedQty && confirmed) {
        const prodRes = await client.query(
          `SELECT name, stock_qty, unit FROM warung.products WHERE id = $1 AND is_active = true FOR UPDATE`,
          [productId]
        );
        if (!prodRes.rows.length) return NextResponse.json({ success: false, message: 'Produk tidak ditemukan.' });

        const prod = prodRes.rows[0];
        const cur  = Number(prod.stock_qty);
        let qty    = Number(passedQty);
        if (passedAction === 'REDUCE') qty = -Math.abs(qty);
        if (cur + qty < 0) return NextResponse.json({ success: false, message: `Stok tidak mencukupi. Saat ini: ${cur} ${prod.unit}.` });

        const mt = passedAction === 'RESTOCK' ? 'restock' : 'adjustment';
        await client.query('BEGIN');
        await client.query(`UPDATE warung.products SET stock_qty = stock_qty + $1 WHERE id = $2`, [qty, productId]);
        await client.query(
          `INSERT INTO warung.stock_movements (product_id, movement_type, qty_change, note, created_by) VALUES ($1,$2,$3,$4,$5)`,
          [productId, mt, qty, `Asisten AI (dikonfirmasi): "${prompt}"`, userId]
        );
        await client.query('COMMIT');

        const ns = cur + qty;
        return NextResponse.json({
          success: true,
          message: `✅ Stok *${prod.name}* ${passedAction === 'RESTOCK' ? 'bertambah' : 'berkurang'} *${Math.abs(qty)} ${prod.unit}*.\nStok sekarang: *${ns} ${prod.unit}*.`
        });
      }

      // ── Path B: Clarification-selected product → confirmation ────────────
      if (productId && passedAction && passedQty && !confirmed) {
        const prodRes = await client.query(
          `SELECT id, name, stock_qty, unit FROM warung.products WHERE id = $1 AND is_active = true`,
          [productId]
        );
        if (!prodRes.rows.length) return NextResponse.json({ success: false, message: 'Produk tidak ditemukan.' });
        const p = prodRes.rows[0];
        const verb = passedAction === 'RESTOCK' ? 'menambah' : 'mengurangi';
        return NextResponse.json({
          success: false,
          need_confirmation: true,
          message: `Konfirmasi: *${verb}* stok *${p.name}* sebanyak *${passedQty} ${p.unit}*?\n(Stok saat ini: ${p.stock_qty} ${p.unit})`,
          confirmation_data: {
            action: passedAction,
            productId: p.id,
            productName: p.name,
            quantity: passedQty,
            unit: p.unit,
            prompt,
          },
        });
      }

      // ── Path C: Gemini classification ────────────────────────────────────
      const geminiKey = process.env.GEMINI_API_KEY;
      if (!geminiKey) return NextResponse.json({ error: { code: 'config_missing', message: 'GEMINI_API_KEY belum dikonfigurasi.' } }, { status: 500 });

      // Build conversation history context
      const historyBlock = (history as HistoryEntry[]).slice(-6).map(h =>
        `[${h.role === 'user' ? 'Owner' : 'Asisten'}]: ${h.text}`
      ).join('\n');

      const systemPrompt = `Kamu adalah *Velo* — Asisten AI resmi POS Warung Rafilah. Nama kamu adalah Velo.
Kamu dilatih khusus untuk membantu Owner mengelola stok, memantau bisnis, dan menjawab pertanyaan seputar warung.
Jika owner menanyakan nama kamu, jawab: "Saya Velo, asisten AI Warung Rafilah."

${historyBlock ? `KONTEKS PERCAKAPAN TERAKHIR (3 pesan):\n${historyBlock}\n\n` : ''}

ARSITEKTUR POS WARUNG RAFILAH:
SCHEMA DATABASE:
- warung.products: id, barcode, sku, name, category, unit, cost_price, sell_price, stock_qty, reorder_threshold, is_active, nearest_expiry_date, is_consignment, consignment_supplier_name
- warung.sales: id, transaction_code, cashier_id, customer_id, session_id, subtotal, discount, total_amount, payment_method (cash/qris/transfer/split), payment_received, change_given, status (completed/voided), split_cash_amount, split_qris_amount
- warung.sale_items: sale_id, product_id, qty, unit_price, cost_price_snapshot, subtotal
- warung.stock_movements: product_id, movement_type (sale/restock/adjustment/void_return/damaged/expired/stolen), qty_change, note, created_by
- warung.customers: id, name, phone, address, credit_limit, current_debt, is_active
- warung.cashier_sessions: cashier_id, opened_at, closed_at, starting_cash, expected_cash, actual_cash, cash_difference, total_cash_sales, total_qris_sales, total_debt_sales, status (open/closed)
- warung.consignment_ledger: riwayat barang konsinyasi
- warung.product_pricing_tiers: harga bertingkat berdasarkan jumlah pembelian
- warung.product_conversion_map: konversi satuan (misal: 1 slop = 10 bungkus)
- agent.transactions: layanan agen (e_wallet_topup, bill_payment, qris_deposit, cash_withdrawal, transfer)
- agent.float_ledger: saldo modal float agen
- agent.daily_closing: rekap harian agen
- core.users: id, username, full_name, role (owner/cashier/agent_operator)

PESAN OWNER: "${prompt}"

Tentukan action yang paling tepat:
1. RESTOCK — tambah stok
2. REDUCE — kurangi stok (rusak/hilang/expired/shrinkage)
3. INQUIRY_PRODUCT — info stok/harga produk spesifik atau daftar semua
4. INQUIRY_LOW_STOCK — stok kritis / hampir habis
5. INQUIRY_EXPIRY — produk mendekati kadaluarsa
6. INQUIRY_SALES — ringkasan penjualan hari ini
7. INQUIRY_SALES_BREAKDOWN — rincian per metode bayar (cash/qris/split/transfer)
8. INQUIRY_PROFIT — profit/margin hari ini
9. INQUIRY_DEBT — daftar hutang semua pelanggan
10. INQUIRY_DEBT_CUSTOMER — hutang pelanggan spesifik
11. INQUIRY_FLOAT — saldo float agen
12. INQUIRY_AGENT_SALES — transaksi agen hari ini
13. INQUIRY_TOP_PRODUCTS — produk terlaris hari ini
14. INQUIRY_SESSION — info sesi kasir aktif sekarang
15. INQUIRY_CONSIGNMENT — produk konsinyasi
16. INQUIRY_STOCK_HISTORY — riwayat mutasi stok produk tertentu
17. HELP — penjelasan kemampuan asisten
18. GREET — sapaan ringan
19. UNKNOWN — topik sama sekali tidak berkaitan dengan warung/POS/kasir/stok/penjualan/keuangan warung

Kembalikan HANYA JSON:
{
  "action": "<action>",
  "product_query": "<kata kunci nama produk, kosong jika tidak ada>",
  "customer_query": "<nama pelanggan, kosong jika tidak ada>",
  "quantity": <angka, 0 jika tidak ada>,
  "reason": "<damaged|expired|stolen|loss|kosong>",
  "payment_filter": "<cash|qris|split|transfer|kosong>",
  "direct_response": "<jawaban langsung untuk GREET/HELP/UNKNOWN>"
}`;

      const gemRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
          }),
        }
      );

      if (!gemRes.ok) throw new Error(`Gemini API error: ${await gemRes.text()}`);
      const gemJson = await gemRes.json();
      const rawText = gemJson.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('Gemini tidak mengembalikan respons.');

      const p = JSON.parse(rawText);
      const { action, product_query, customer_query, quantity, reason, payment_filter, direct_response } = p;

      // ── Direct text responses ─────────────────────────────────────────────
      if (['UNKNOWN', 'HELP', 'GREET'].includes(action)) {
        return NextResponse.json({
          success: action !== 'UNKNOWN',
          message: direct_response || 'Maaf, saya hanya membantu hal-hal seputar POS Warung Rafilah.'
        });
      }

      // ── Low stock ─────────────────────────────────────────────────────────
      if (action === 'INQUIRY_LOW_STOCK') {
        const r = await client.query(
          `SELECT name, stock_qty, reorder_threshold, unit FROM warung.products
           WHERE is_active = true AND stock_qty <= reorder_threshold ORDER BY stock_qty ASC LIMIT 20`
        );
        if (!r.rows.length) return NextResponse.json({ success: true, message: '✅ Semua stok masih aman, tidak ada yang kritis.' });
        const lines = r.rows.map(x => `⚠️ *${x.name}*: ${x.stock_qty} ${x.unit} (batas reorder: ${x.reorder_threshold} ${x.unit})`);
        return NextResponse.json({ success: true, message: `Produk stok kritis:\n\n${lines.join('\n')}` });
      }

      // ── Expiry ────────────────────────────────────────────────────────────
      if (action === 'INQUIRY_EXPIRY') {
        const r = await client.query(
          `SELECT name, stock_qty, unit, nearest_expiry_date FROM warung.products
           WHERE is_active = true AND nearest_expiry_date IS NOT NULL
             AND nearest_expiry_date <= CURRENT_DATE + INTERVAL '30 days'
           ORDER BY nearest_expiry_date ASC LIMIT 20`
        );
        if (!r.rows.length) return NextResponse.json({ success: true, message: '✅ Tidak ada produk kadaluarsa dalam 30 hari ke depan.' });
        const lines = r.rows.map(x => `• *${x.name}*: exp. *${fmtDate(x.nearest_expiry_date)}* (stok: ${x.stock_qty} ${x.unit})`);
        return NextResponse.json({ success: true, message: `Produk mendekati kadaluarsa (≤30 hari):\n\n${lines.join('\n')}` });
      }

      // ── Sales summary ─────────────────────────────────────────────────────
      if (action === 'INQUIRY_SALES') {
        const r = await client.query(
          `SELECT COUNT(*) FILTER (WHERE status='completed') as trx,
                  COALESCE(SUM(total_amount) FILTER (WHERE status='completed'), 0) as omset,
                  COALESCE(SUM(discount) FILTER (WHERE status='completed'), 0) as diskon,
                  COUNT(*) FILTER (WHERE status='voided') as voided
           FROM warung.sales
           WHERE created_at >= CURRENT_DATE AND created_at < CURRENT_DATE + INTERVAL '1 day'`
        );
        const d = r.rows[0];
        return NextResponse.json({
          success: true,
          message: `📊 *Penjualan Hari Ini*\n\n• Transaksi: *${d.trx} transaksi*\n• Omset: *${idr(Number(d.omset))}*\n• Diskon: *${idr(Number(d.diskon))}*\n• Void: *${d.voided} transaksi*`
        });
      }

      // ── Sales breakdown ───────────────────────────────────────────────────
      if (action === 'INQUIRY_SALES_BREAKDOWN') {
        const r = await client.query(
          `SELECT
             COALESCE(SUM(CASE WHEN payment_method='cash' THEN total_amount WHEN payment_method='split' THEN split_cash_amount ELSE 0 END),0) as cash_t,
             COALESCE(SUM(CASE WHEN payment_method='qris' THEN total_amount WHEN payment_method='split' THEN split_qris_amount ELSE 0 END),0) as qris_t,
             COALESCE(SUM(CASE WHEN payment_method='transfer' THEN total_amount ELSE 0 END),0) as tf_t,
             COUNT(*) FILTER (WHERE payment_method='cash') as cash_n,
             COUNT(*) FILTER (WHERE payment_method='qris') as qris_n,
             COUNT(*) FILTER (WHERE payment_method='split') as split_n,
             COUNT(*) FILTER (WHERE payment_method='transfer') as tf_n
           FROM warung.sales
           WHERE status='completed' AND created_at >= CURRENT_DATE AND created_at < CURRENT_DATE + INTERVAL '1 day'`
        );
        const d = r.rows[0];
        const all = [
          `💵 Cash: *${idr(Number(d.cash_t))}* (${d.cash_n} trx)`,
          `📱 QRIS: *${idr(Number(d.qris_t))}* (${d.qris_n} trx)`,
          `🔀 Split: *${d.split_n} trx*`,
          `🏦 Transfer: *${idr(Number(d.tf_t))}* (${d.tf_n} trx)`,
        ];
        const filterMap: Record<string, string> = { cash: all[0], qris: all[1], split: all[2], transfer: all[3] };
        const msg = payment_filter && filterMap[payment_filter]
          ? `Hari ini — ${filterMap[payment_filter]}`
          : `📊 *Rincian Metode Bayar Hari Ini*\n\n${all.join('\n')}`;
        return NextResponse.json({ success: true, message: msg });
      }

      // ── Profit ────────────────────────────────────────────────────────────
      if (action === 'INQUIRY_PROFIT') {
        const r = await client.query(
          `SELECT COALESCE(SUM(si.subtotal - (si.cost_price_snapshot * si.qty)), 0) as margin
           FROM warung.sales s
           JOIN warung.sale_items si ON si.sale_id = s.id
           WHERE s.status = 'completed'
             AND s.created_at >= CURRENT_DATE AND s.created_at < CURRENT_DATE + INTERVAL '1 day'`
        );
        return NextResponse.json({ success: true, message: `💹 *Estimasi Profit Hari Ini*\n\nGross Margin: *${idr(Number(r.rows[0].margin))}*\n\n_(Belum termasuk biaya operasional & pajak)_` });
      }

      // ── Debt list ─────────────────────────────────────────────────────────
      if (action === 'INQUIRY_DEBT') {
        const r = await client.query(
          `SELECT name, phone, current_debt, credit_limit FROM warung.customers
           WHERE is_active = true AND current_debt > 0 ORDER BY current_debt DESC LIMIT 20`
        );
        if (!r.rows.length) return NextResponse.json({ success: true, message: '✅ Tidak ada pelanggan yang berhutang.' });
        const lines = r.rows.map(c => `• *${c.name}*${c.phone ? ` (${c.phone})` : ''}: *${idr(Number(c.current_debt))}* / limit ${idr(Number(c.credit_limit))}`);
        const total = r.rows.reduce((s, c) => s + Number(c.current_debt), 0);
        return NextResponse.json({ success: true, message: `💰 *Hutang Pelanggan*\n\n${lines.join('\n')}\n\n*Total: ${idr(total)}*` });
      }

      // ── Debt specific ─────────────────────────────────────────────────────
      if (action === 'INQUIRY_DEBT_CUSTOMER') {
        if (!customer_query) return NextResponse.json({ success: false, message: 'Sebutkan nama pelanggan.' });
        const r = await client.query(
          `SELECT name, phone, current_debt, credit_limit FROM warung.customers
           WHERE is_active = true AND name ILIKE $1`,
          [`%${customer_query}%`]
        );
        if (!r.rows.length) return NextResponse.json({ success: false, message: `Pelanggan "${customer_query}" tidak ditemukan.` });
        const lines = r.rows.map(c =>
          `• *${c.name}*${c.phone ? ` (${c.phone})` : ''}\n  Hutang: *${idr(Number(c.current_debt))}* | Limit: ${idr(Number(c.credit_limit))}`
        );
        return NextResponse.json({ success: true, message: `👤 *Info Hutang*\n\n${lines.join('\n\n')}` });
      }

      // ── Float ─────────────────────────────────────────────────────────────
      if (action === 'INQUIRY_FLOAT') {
        const r = await client.query(`SELECT balance_after FROM agent.float_ledger ORDER BY id DESC LIMIT 1`);
        const bal = r.rows.length ? Number(r.rows[0].balance_after) : 0;
        return NextResponse.json({ success: true, message: `💵 *Saldo Float Agen*\n\n*${idr(bal)}*` });
      }

      // ── Agent sales ───────────────────────────────────────────────────────
      if (action === 'INQUIRY_AGENT_SALES') {
        const r = await client.query(
          `SELECT service_type, COUNT(*) as n, COALESCE(SUM(amount),0) as amt, COALESCE(SUM(agent_commission),0) as comm
           FROM agent.transactions
           WHERE status='success' AND created_at >= CURRENT_DATE AND created_at < CURRENT_DATE + INTERVAL '1 day'
           GROUP BY service_type ORDER BY amt DESC`
        );
        if (!r.rows.length) return NextResponse.json({ success: true, message: 'Belum ada transaksi agen hari ini.' });
        const lines = r.rows.map(x => `• *${x.service_type}*: ${x.n} trx — *${idr(Number(x.amt))}* (komisi: ${idr(Number(x.comm))})`);
        return NextResponse.json({ success: true, message: `🤝 *Transaksi Agen Hari Ini*\n\n${lines.join('\n')}` });
      }

      // ── Top products ──────────────────────────────────────────────────────
      if (action === 'INQUIRY_TOP_PRODUCTS') {
        const r = await client.query(
          `SELECT p.name, SUM(si.qty) as sold, SUM(si.subtotal) as rev
           FROM warung.sale_items si
           JOIN warung.products p ON p.id = si.product_id
           JOIN warung.sales s ON s.id = si.sale_id
           WHERE s.status='completed' AND s.created_at >= CURRENT_DATE AND s.created_at < CURRENT_DATE + INTERVAL '1 day'
           GROUP BY p.id, p.name ORDER BY sold DESC LIMIT 10`
        );
        if (!r.rows.length) return NextResponse.json({ success: true, message: 'Belum ada penjualan hari ini.' });
        const lines = r.rows.map((x, i) => `${i + 1}. *${x.name}*: terjual *${x.sold}* — *${idr(Number(x.rev))}*`);
        return NextResponse.json({ success: true, message: `🏆 *Produk Terlaris Hari Ini*\n\n${lines.join('\n')}` });
      }

      // ── Cashier session ───────────────────────────────────────────────────
      if (action === 'INQUIRY_SESSION') {
        const r = await client.query(
          `SELECT cs.*, u.full_name FROM warung.cashier_sessions cs
           JOIN core.users u ON u.id = cs.cashier_id
           WHERE cs.status='open' ORDER BY cs.opened_at DESC LIMIT 1`
        );
        if (!r.rows.length) return NextResponse.json({ success: true, message: 'Tidak ada sesi kasir yang sedang buka.' });
        const s = r.rows[0];
        const dur = Math.floor((Date.now() - new Date(s.opened_at).getTime()) / 60000);
        return NextResponse.json({
          success: true,
          message: `🕐 *Sesi Kasir Aktif*\n\n• Kasir: *${s.full_name}*\n• Buka: *${new Date(s.opened_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}*\n• Durasi: *${Math.floor(dur / 60)}j ${dur % 60}m*\n• Modal Awal: *${idr(Number(s.starting_cash))}*\n• Omset Cash: *${idr(Number(s.total_cash_sales))}*\n• Omset QRIS: *${idr(Number(s.total_qris_sales))}*\n• Hutang: *${idr(Number(s.total_debt_sales))}*`
        });
      }

      // ── Consignment ───────────────────────────────────────────────────────
      if (action === 'INQUIRY_CONSIGNMENT') {
        const r = await client.query(
          `SELECT name, stock_qty, unit, consignment_supplier_name, sell_price
           FROM warung.products WHERE is_active=true AND is_consignment=true ORDER BY name ASC`
        );
        if (!r.rows.length) return NextResponse.json({ success: true, message: 'Tidak ada produk konsinyasi terdaftar.' });
        const lines = r.rows.map(x => `• *${x.name}* — Stok: ${x.stock_qty} ${x.unit}, Harga: ${idr(Number(x.sell_price))}, Supplier: *${x.consignment_supplier_name || '-'}*`);
        return NextResponse.json({ success: true, message: `📦 *Produk Konsinyasi*\n\n${lines.join('\n')}` });
      }

      // ── Stock history ─────────────────────────────────────────────────────
      if (action === 'INQUIRY_STOCK_HISTORY') {
        if (!product_query) return NextResponse.json({ success: false, message: 'Sebutkan nama produk.' });
        const r = await client.query(
          `SELECT sm.movement_type, sm.qty_change, sm.created_at, u.full_name
           FROM warung.stock_movements sm
           JOIN warung.products pr ON pr.id = sm.product_id
           LEFT JOIN core.users u ON u.id = sm.created_by
           WHERE pr.name ILIKE $1 AND pr.is_active = true
           ORDER BY sm.created_at DESC LIMIT 10`,
          [`%${product_query}%`]
        );
        if (!r.rows.length) return NextResponse.json({ success: false, message: `Tidak ada riwayat stok untuk "${product_query}".` });
        const lines = r.rows.map(x => {
          const sign = Number(x.qty_change) > 0 ? '+' : '';
          const d = new Date(x.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
          return `• [${d}] *${x.movement_type}*: ${sign}${x.qty_change}${x.full_name ? ` — ${x.full_name}` : ''}`;
        });
        return NextResponse.json({ success: true, message: `📋 *Riwayat Stok — ${product_query}*\n\n${lines.join('\n')}` });
      }

      // ── Product inquiry ───────────────────────────────────────────────────
      if (action === 'INQUIRY_PRODUCT') {
        if (product_query) {
          const r = await client.query(
            `SELECT name, stock_qty, sell_price, cost_price, unit, is_consignment, nearest_expiry_date
             FROM warung.products WHERE (name ILIKE $1 OR barcode=$2 OR sku=$2) AND is_active=true`,
            [`%${product_query}%`, product_query]
          );
          if (!r.rows.length) return NextResponse.json({ success: false, message: `Produk "${product_query}" tidak ditemukan.` });
          const lines = r.rows.map(x => {
            let info = `• *${x.name}*\n  Stok: *${x.stock_qty} ${x.unit}* | Jual: *${idr(Number(x.sell_price))}* | Modal: *${idr(Number(x.cost_price))}*`;
            if (x.is_consignment) info += ' | 📦 Konsinyasi';
            if (x.nearest_expiry_date) info += ` | Exp: *${fmtDate(x.nearest_expiry_date)}*`;
            return info;
          });
          return NextResponse.json({ success: true, message: `Informasi Produk:\n\n${lines.join('\n\n')}` });
        }
        const r = await client.query(
          `SELECT name, stock_qty, sell_price, unit FROM warung.products WHERE is_active=true ORDER BY name ASC LIMIT 30`
        );
        if (!r.rows.length) return NextResponse.json({ success: true, message: 'Belum ada produk terdaftar.' });
        const lines = r.rows.map(x => `• *${x.name}* — ${x.stock_qty} ${x.unit} | ${idr(Number(x.sell_price))}`);
        return NextResponse.json({ success: true, message: `Daftar Produk (${r.rows.length}):\n\n${lines.join('\n')}` });
      }

      // ── Stock mutation: first find product → return confirmation ──────────
      if (!['RESTOCK', 'REDUCE'].includes(action) || !product_query || !quantity) {
        return NextResponse.json({ success: false, message: 'Maaf, perintah tidak dipahami.\n\nCoba: "tambah stok Kopi 10" atau "omset hari ini?"' });
      }

      const srch = await client.query(
        `SELECT id, name, stock_qty, unit FROM warung.products
         WHERE (name ILIKE $1 OR barcode=$2 OR sku=$2) AND is_active=true`,
        [`%${product_query}%`, product_query]
      );

      if (!srch.rows.length) return NextResponse.json({ success: false, message: `Produk "${product_query}" tidak ditemukan.` });

      if (srch.rows.length > 1) {
        return NextResponse.json({
          success: false,
          need_clarification: true,
          matches: srch.rows.map(r => ({ id: r.id, name: r.name, stock: Number(r.stock_qty), unit: r.unit })),
          message: `Ditemukan ${srch.rows.length} produk yang mirip. Pilih salah satu:`,
        });
      }

      // Exactly 1 product found → ask for confirmation before executing
      const found = srch.rows[0];
      const verb = action === 'RESTOCK' ? 'menambah' : 'mengurangi';
      return NextResponse.json({
        success: false,
        need_confirmation: true,
        message: `Konfirmasi: *${verb}* stok *${found.name}* sebanyak *${quantity} ${found.unit}*?\n(Stok saat ini: *${found.stock_qty} ${found.unit}*)`,
        confirmation_data: {
          action,
          productId: found.id,
          productName: found.name,
          quantity: Number(quantity),
          unit: found.unit,
          prompt,
          movementType: action === 'RESTOCK' ? 'restock'
            : reason === 'damaged' ? 'damaged'
            : reason === 'expired' ? 'expired'
            : reason === 'stolen' ? 'stolen'
            : 'adjustment',
        },
      });

    } finally {
      client.release();
    }
  } catch (err) {
    const error = err as Error;
    console.error('AI command error:', error);
    return NextResponse.json({ error: { code: 'internal_error', message: error.message || 'Gagal memproses perintah.' } }, { status: 500 });
  }
}
