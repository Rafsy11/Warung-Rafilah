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
      // ── Path A: Confirmed execution ───────────────────────────────────────
      if (productId && passedAction && confirmed) {

        // DELETE_PRODUCT_EXEC
        if (passedAction === 'DELETE_PRODUCT_EXEC') {
          await client.query(`UPDATE warung.products SET is_active = false WHERE id = $1`, [productId]);
          return NextResponse.json({ success: true, message: `✅ Produk *${body.productName || 'tersebut'}* berhasil dinonaktifkan dan tidak akan muncul di kasir.` });
        }

        // SETTLE_DEBT_EXEC
        if (passedAction === 'SETTLE_DEBT_EXEC') {
          const cRes = await client.query(`SELECT name, current_debt FROM warung.customers WHERE id = $1`, [productId]);
          if (!cRes.rows.length) return NextResponse.json({ success: false, message: 'Pelanggan tidak ditemukan.' });
          const cust = cRes.rows[0];
          const payment = Math.min(Number(passedQty), Number(cust.current_debt));
          await client.query(`UPDATE warung.customers SET current_debt = current_debt - $1 WHERE id = $2`, [payment, productId]);
          const remaining = Number(cust.current_debt) - payment;
          return NextResponse.json({ success: true, message: `✅ Hutang *${cust.name}* berkurang *${idr(payment)}*.\nSisa hutang: *${idr(remaining)}*${remaining === 0 ? ' — LUNAS! 🎉' : ''}` });
        }

        // RESTOCK / REDUCE stock mutation
        if (passedQty) {
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

      // ── Path C: AI classification (Claude / Gemini) ─────────────────────
      const aiBaseUrl = process.env.AI_BASE_URL;
      const aiApiKey = process.env.AI_API_KEY;
      const aiModel = process.env.AI_MODEL || 'claude-opus-4-8';
      const geminiKey = process.env.GEMINI_API_KEY;

      if (!aiBaseUrl && !geminiKey) {
        return NextResponse.json({ error: { code: 'config_missing', message: 'Konfigurasi AI belum siap.' } }, { status: 500 });
      }

      // Build conversation history context
      const historyBlock = (history as HistoryEntry[]).slice(-6).map(h =>
        `[${h.role === 'user' ? 'Owner' : 'Asisten'}]: ${h.text}`
      ).join('\n');

      const systemPrompt = `Kamu adalah *Velo* — Asisten AI resmi POS Warung Rafilah. Nama kamu adalah Velo.
Kamu dilatih khusus untuk membantu Owner mengelola seluruh operasional POS warung.
Jika owner menanyakan nama kamu, jawab: "Saya Velo, asisten AI Warung Rafilah."

${historyBlock ? `KONTEKS PERCAKAPAN TERAKHIR:\n${historyBlock}\n\n` : ''}
PESAN OWNER: "${prompt}"

Tentukan action yang paling tepat berdasarkan pesan owner. Pilih SATU action:

=== STOK ===
1. RESTOCK — tambah stok produk
2. REDUCE — kurangi stok (rusak/hilang/expired/shrinkage)

=== PRODUK ===
3. INQUIRY_PRODUCT — info stok/harga produk spesifik atau daftar semua
4. INQUIRY_LOW_STOCK — stok kritis / hampir habis
5. INQUIRY_EXPIRY — produk mendekati kadaluarsa
6. INQUIRY_CONSIGNMENT — daftar produk konsinyasi
7. INQUIRY_STOCK_HISTORY — riwayat mutasi stok produk tertentu
8. ADD_PRODUCT — tambah produk baru (butuh: barcode, nama, satuan, harga jual, harga modal, stok awal)
9. EDIT_PRODUCT_PRICE — ubah harga jual/modal produk
10. EDIT_PRODUCT_REORDER — ubah batas reorder/minimum stok produk
11. DELETE_PRODUCT — hapus/nonaktifkan produk

=== PENJUALAN & KEUANGAN ===
12. INQUIRY_SALES — ringkasan penjualan hari ini
13. INQUIRY_SALES_BREAKDOWN — rincian per metode bayar (cash/qris/split/transfer)
14. INQUIRY_PROFIT — profit/margin hari ini
15. INQUIRY_TOP_PRODUCTS — produk terlaris hari ini
16. INQUIRY_SESSION — info sesi kasir aktif sekarang

=== PELANGGAN & HUTANG ===
17. INQUIRY_DEBT — daftar hutang semua pelanggan
18. INQUIRY_DEBT_CUSTOMER — hutang pelanggan spesifik
19. INQUIRY_CUSTOMERS — daftar semua pelanggan aktif
20. ADD_CUSTOMER — tambah pelanggan baru
21. EDIT_CUSTOMER_LIMIT — ubah limit kredit pelanggan
22. SETTLE_DEBT — tandai hutang pelanggan sebagai lunas/bayar sebagian

=== DISKON & PROMO ===
23. INQUIRY_DISCOUNTS — lihat semua diskon/promo yang ada
24. ADD_DISCOUNT — buat diskon/promo baru
25. TOGGLE_DISCOUNT — aktifkan/nonaktifkan diskon
26. DELETE_DISCOUNT — hapus diskon

=== AGEN ===
27. INQUIRY_FLOAT — saldo float agen
28. INQUIRY_AGENT_SALES — transaksi agen hari ini

=== UMUM ===
29. HELP — penjelasan kemampuan asisten
30. GREET — sapaan ringan
31. UNKNOWN — topik sama sekali di luar POS/warung

Kembalikan HANYA JSON (tanpa markdown, tanpa komentar):
{
  "action": "<action dari daftar di atas>",
  "product_query": "<kata kunci nama/barcode produk, kosong jika tidak ada>",
  "customer_query": "<nama pelanggan, kosong jika tidak ada>",
  "quantity": <angka, 0 jika tidak ada>,
  "reason": "<damaged|expired|stolen|loss|kosong>",
  "payment_filter": "<cash|qris|split|transfer|kosong>",
  "new_sell_price": <angka harga jual baru, 0 jika tidak diubah>,
  "new_cost_price": <angka harga modal baru, 0 jika tidak diubah>,
  "new_reorder_threshold": <angka batas reorder baru, -1 jika tidak diubah>,
  "new_credit_limit": <angka limit kredit baru, 0 jika tidak diubah>,
  "customer_phone": "<nomor HP pelanggan baru, kosong jika tidak ada>",
  "barcode": "<barcode produk baru, kosong jika tidak ada>",
  "unit": "<satuan produk baru (pcs/bungkus/botol/slop/kg/dll), kosong jika tidak ada>",
  "category": "<kategori produk (makanan/minuman/rokok/sembako/dll), kosong jika tidak ada>",
  "discount_name": "<nama diskon/promo, kosong jika tidak ada>",
  "discount_type": "<global|product|kosong>",
  "discount_value_type": "<fixed|percentage|kosong>",
  "discount_value": <angka nilai diskon, 0 jika tidak ada>,
  "discount_min_purchase": <angka minimum pembelian untuk promo, 0 jika tidak ada>,
  "toggle_active": <true jika mengaktifkan, false jika menonaktifkan, null jika tidak relevan>,
  "settle_amount": <angka nominal pembayaran hutang, 0 jika lunas penuh>,
  "direct_response": "<jawaban langsung untuk GREET/HELP/UNKNOWN>"
}`;

      let rawText = '';
      if (aiBaseUrl && aiApiKey) {
        const url = `${aiBaseUrl.replace(/\/$/, '')}/chat/completions`;
        const aiRes = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${aiApiKey}`
          },
          body: JSON.stringify({
            model: aiModel,
            messages: [{ role: 'user', content: systemPrompt }],
            temperature: 0.1,
            response_format: { type: 'json_object' }
          })
        });

        if (!aiRes.ok) {
          throw new Error(`AI Proxy API error: ${aiRes.status} ${await aiRes.text()}`);
        }
        const aiJson = await aiRes.json();
        rawText = aiJson.choices?.[0]?.message?.content || '';
      } else {
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
        rawText = gemJson.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }

      if (!rawText) throw new Error('Model AI tidak mengembalikan respons.');

      // Strip markdown code blocks if present
      const cleanJsonStr = rawText.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
      const p = JSON.parse(cleanJsonStr);
      const {
        action, product_query, customer_query, quantity, reason, payment_filter, direct_response,
        new_sell_price, new_cost_price, new_reorder_threshold, new_credit_limit,
        customer_phone, barcode, unit, category,
        discount_name, discount_type, discount_value_type, discount_value, discount_min_purchase,
        toggle_active, settle_amount,
      } = p;

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
          `SELECT COALESCE(SUM(si.subtotal - (si.cost_price_snapshot * si.qty)), 0) - COALESCE((SELECT SUM(discount) FROM warung.sales WHERE status = 'completed' AND created_at >= CURRENT_DATE AND created_at < CURRENT_DATE + INTERVAL '1 day'), 0) as margin
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


      // ── ADD_PRODUCT ───────────────────────────────────────────────────────
      if (action === 'ADD_PRODUCT') {
        if (!product_query || !unit || !new_sell_price) {
          return NextResponse.json({ success: false, message: 'Untuk menambah produk, sebutkan: nama produk, satuan, dan harga jual. Contoh: "tambah produk Kopi Kapal Api, satuan bungkus, harga jual 3000, modal 2500, stok awal 50"' });
        }
        const barcodeVal = barcode || `MANUAL-${Date.now()}`;
        const existRes = await client.query(`SELECT id FROM warung.products WHERE barcode = $1`, [barcodeVal]);
        if (existRes.rows.length > 0) return NextResponse.json({ success: false, message: `Barcode *${barcodeVal}* sudah terdaftar.` });
        await client.query(
          `INSERT INTO warung.products (barcode, name, category, unit, cost_price, sell_price, stock_qty, reorder_threshold)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [barcodeVal, product_query.trim(), category || 'Lainnya', unit, Number(new_cost_price) || 0, Number(new_sell_price), Number(quantity) || 0, 5]
        );
        return NextResponse.json({ success: true, message: `✅ Produk *${product_query}* berhasil ditambahkan.\n• Satuan: *${unit}* | Harga Jual: *${idr(Number(new_sell_price))}* | Modal: *${idr(Number(new_cost_price) || 0)}*\n• Stok Awal: *${Number(quantity) || 0} ${unit}*` });
      }

      // ── EDIT_PRODUCT_PRICE ────────────────────────────────────────────────
      if (action === 'EDIT_PRODUCT_PRICE') {
        if (!product_query) return NextResponse.json({ success: false, message: 'Sebutkan nama produk yang ingin diubah harganya.' });
        if (!new_sell_price && !new_cost_price) return NextResponse.json({ success: false, message: 'Sebutkan harga baru. Contoh: "ubah harga jual Aqua jadi 4000"' });
        const r = await client.query(`SELECT id, name, sell_price, cost_price, unit FROM warung.products WHERE name ILIKE $1 AND is_active=true`, [`%${product_query}%`]);
        if (!r.rows.length) return NextResponse.json({ success: false, message: `Produk "${product_query}" tidak ditemukan.` });
        if (r.rows.length > 1) return NextResponse.json({ success: false, message: `Ditemukan ${r.rows.length} produk: ${r.rows.map((x: any) => x.name).join(', ')}. Sebutkan nama lebih spesifik.` });
        const prod = r.rows[0];
        const updates: string[] = [];
        const vals: unknown[] = [];
        if (new_sell_price && Number(new_sell_price) > 0) { updates.push(`sell_price = $${vals.length + 1}`); vals.push(Number(new_sell_price)); }
        if (new_cost_price && Number(new_cost_price) > 0) { updates.push(`cost_price = $${vals.length + 1}`); vals.push(Number(new_cost_price)); }
        vals.push(prod.id);
        await client.query(`UPDATE warung.products SET ${updates.join(', ')} WHERE id = $${vals.length}`, vals);
        const changes = [];
        if (new_sell_price && Number(new_sell_price) > 0) changes.push(`Harga Jual: *${idr(Number(prod.sell_price))}* → *${idr(Number(new_sell_price))}*`);
        if (new_cost_price && Number(new_cost_price) > 0) changes.push(`Modal: *${idr(Number(prod.cost_price))}* → *${idr(Number(new_cost_price))}*`);
        return NextResponse.json({ success: true, message: `✅ Harga *${prod.name}* berhasil diperbarui.\n${changes.join('\n')}` });
      }

      // ── EDIT_PRODUCT_REORDER ──────────────────────────────────────────────
      if (action === 'EDIT_PRODUCT_REORDER') {
        if (!product_query) return NextResponse.json({ success: false, message: 'Sebutkan nama produk.' });
        if (new_reorder_threshold === undefined || Number(new_reorder_threshold) < 0) return NextResponse.json({ success: false, message: 'Sebutkan batas reorder baru. Contoh: "batas reorder Kopi jadi 20"' });
        const r = await client.query(`SELECT id, name, unit, reorder_threshold FROM warung.products WHERE name ILIKE $1 AND is_active=true LIMIT 1`, [`%${product_query}%`]);
        if (!r.rows.length) return NextResponse.json({ success: false, message: `Produk "${product_query}" tidak ditemukan.` });
        const prod = r.rows[0];
        await client.query(`UPDATE warung.products SET reorder_threshold = $1 WHERE id = $2`, [Number(new_reorder_threshold), prod.id]);
        return NextResponse.json({ success: true, message: `✅ Batas reorder *${prod.name}* diubah dari *${prod.reorder_threshold}* menjadi *${new_reorder_threshold} ${prod.unit}*.` });
      }

      // ── DELETE_PRODUCT ────────────────────────────────────────────────────
      if (action === 'DELETE_PRODUCT') {
        if (!product_query) return NextResponse.json({ success: false, message: 'Sebutkan nama produk yang ingin dihapus.' });
        const r = await client.query(`SELECT id, name FROM warung.products WHERE name ILIKE $1 AND is_active=true LIMIT 1`, [`%${product_query}%`]);
        if (!r.rows.length) return NextResponse.json({ success: false, message: `Produk "${product_query}" tidak ditemukan.` });
        const prod = r.rows[0];
        return NextResponse.json({
          success: false,
          need_confirmation: true,
          message: `⚠️ Yakin ingin menonaktifkan produk *${prod.name}*?\nProduk tidak akan bisa dijual lagi.`,
          confirmation_data: { action: 'DELETE_PRODUCT_EXEC', productId: prod.id, productName: prod.name, quantity: 0, unit: '', prompt },
        });
      }

      // ── ADD_CUSTOMER ──────────────────────────────────────────────────────
      if (action === 'ADD_CUSTOMER') {
        if (!customer_query) return NextResponse.json({ success: false, message: 'Sebutkan nama pelanggan. Contoh: "tambah pelanggan Budi, HP 08123456789, limit 500000"' });
        const existRes = await client.query(`SELECT id FROM warung.customers WHERE name ILIKE $1 AND is_active=true`, [customer_query.trim()]);
        if (existRes.rows.length > 0) return NextResponse.json({ success: false, message: `Pelanggan *${customer_query}* sudah terdaftar.` });
        const limitVal = Number(new_credit_limit) > 0 ? Number(new_credit_limit) : 500000;
        const { rows } = await client.query(
          `INSERT INTO warung.customers (name, phone, credit_limit) VALUES ($1, $2, $3) RETURNING id, name`,
          [customer_query.trim(), customer_phone?.trim() || null, limitVal]
        );
        return NextResponse.json({ success: true, message: `✅ Pelanggan *${rows[0].name}* berhasil didaftarkan.\n• HP: *${customer_phone || '-'}*\n• Limit Kredit: *${idr(limitVal)}*` });
      }

      // ── INQUIRY_CUSTOMERS ─────────────────────────────────────────────────
      if (action === 'INQUIRY_CUSTOMERS') {
        const r = await client.query(`SELECT name, phone, current_debt, credit_limit FROM warung.customers WHERE is_active=true ORDER BY name ASC LIMIT 30`);
        if (!r.rows.length) return NextResponse.json({ success: true, message: 'Belum ada pelanggan terdaftar.' });
        const lines = r.rows.map((c: any) => `• *${c.name}*${c.phone ? ` (${c.phone})` : ''} — Hutang: ${idr(Number(c.current_debt))} | Limit: ${idr(Number(c.credit_limit))}`);
        return NextResponse.json({ success: true, message: `👥 *Daftar Pelanggan (${r.rows.length})*\n\n${lines.join('\n')}` });
      }

      // ── EDIT_CUSTOMER_LIMIT ───────────────────────────────────────────────
      if (action === 'EDIT_CUSTOMER_LIMIT') {
        if (!customer_query) return NextResponse.json({ success: false, message: 'Sebutkan nama pelanggan.' });
        if (!new_credit_limit || Number(new_credit_limit) <= 0) return NextResponse.json({ success: false, message: 'Sebutkan limit baru. Contoh: "ubah limit Budi jadi 1000000"' });
        const r = await client.query(`SELECT id, name, credit_limit FROM warung.customers WHERE name ILIKE $1 AND is_active=true LIMIT 1`, [`%${customer_query}%`]);
        if (!r.rows.length) return NextResponse.json({ success: false, message: `Pelanggan "${customer_query}" tidak ditemukan.` });
        const c = r.rows[0];
        await client.query(`UPDATE warung.customers SET credit_limit = $1 WHERE id = $2`, [Number(new_credit_limit), c.id]);
        return NextResponse.json({ success: true, message: `✅ Limit kredit *${c.name}* diubah dari *${idr(Number(c.credit_limit))}* menjadi *${idr(Number(new_credit_limit))}*.` });
      }

      // ── SETTLE_DEBT ───────────────────────────────────────────────────────
      if (action === 'SETTLE_DEBT') {
        if (!customer_query) return NextResponse.json({ success: false, message: 'Sebutkan nama pelanggan yang melunasi hutang.' });
        const r = await client.query(`SELECT id, name, current_debt FROM warung.customers WHERE name ILIKE $1 AND is_active=true LIMIT 1`, [`%${customer_query}%`]);
        if (!r.rows.length) return NextResponse.json({ success: false, message: `Pelanggan "${customer_query}" tidak ditemukan.` });
        const c = r.rows[0];
        const debt = Number(c.current_debt);
        if (debt <= 0) return NextResponse.json({ success: true, message: `*${c.name}* tidak memiliki hutang.` });
        const payment = Number(settle_amount) > 0 ? Math.min(Number(settle_amount), debt) : debt;
        return NextResponse.json({
          success: false,
          need_confirmation: true,
          message: `Konfirmasi: Catat pembayaran hutang *${c.name}* sebesar *${idr(payment)}*?\n(Hutang saat ini: *${idr(debt)}* | Sisa: *${idr(debt - payment)}*)`,
          confirmation_data: { action: 'SETTLE_DEBT_EXEC', productId: c.id, productName: c.name, quantity: payment, unit: 'Rp', prompt },
        });
      }

      // ── INQUIRY_DISCOUNTS ─────────────────────────────────────────────────
      if (action === 'INQUIRY_DISCOUNTS') {
        const r = await client.query(`SELECT d.name, d.discount_type, d.value_type, d.discount_value, d.is_active, d.min_purchase_amount, p.name as product_name FROM warung.discounts d LEFT JOIN warung.products p ON p.id = d.product_id ORDER BY d.is_active DESC, d.created_at DESC`);
        if (!r.rows.length) return NextResponse.json({ success: true, message: 'Belum ada diskon/promo yang dibuat.' });
        const lines = r.rows.map((d: any) => {
          const val = d.value_type === 'percentage' ? `${d.discount_value}%` : idr(Number(d.discount_value));
          const scope = d.discount_type === 'product' ? ` (Produk: ${d.product_name})` : '';
          const status = d.is_active ? '🟢' : '🔴';
          const min = Number(d.min_purchase_amount) > 0 ? ` | Min. beli: ${idr(Number(d.min_purchase_amount))}` : '';
          return `${status} *${d.name}*: ${val}${scope}${min}`;
        });
        return NextResponse.json({ success: true, message: `🏷️ *Daftar Diskon/Promo*\n\n${lines.join('\n')}` });
      }

      // ── ADD_DISCOUNT ──────────────────────────────────────────────────────
      if (action === 'ADD_DISCOUNT') {
        if (!discount_name || !discount_value || !discount_value_type) return NextResponse.json({ success: false, message: 'Contoh: "buat promo Diskon Weekend 10% untuk semua produk" atau "buat diskon Kopi Tubruk 500 rupiah"' });
        const isGlobal = !product_query || discount_type === 'global';
        let productId: string | null = null;
        if (!isGlobal && product_query) {
          const pr = await client.query(`SELECT id FROM warung.products WHERE name ILIKE $1 AND is_active=true LIMIT 1`, [`%${product_query}%`]);
          if (!pr.rows.length) return NextResponse.json({ success: false, message: `Produk "${product_query}" tidak ditemukan untuk diskon produk.` });
          productId = pr.rows[0].id;
        }
        await client.query(
          `INSERT INTO warung.discounts (name, discount_type, value_type, discount_value, product_id, min_purchase_amount, is_active) VALUES ($1, $2, $3, $4, $5, $6, true)`,
          [discount_name.trim(), isGlobal ? 'global' : 'product', discount_value_type, Number(discount_value), productId, Number(discount_min_purchase) || 0]
        );
        const scope = isGlobal ? 'semua transaksi' : `produk *${product_query}*`;
        const val = discount_value_type === 'percentage' ? `${discount_value}%` : idr(Number(discount_value));
        return NextResponse.json({ success: true, message: `✅ Diskon *${discount_name}* berhasil dibuat!\n• Nilai: *${val}*\n• Berlaku untuk: *${scope}*\n• Status: *Aktif*` });
      }

      // ── TOGGLE_DISCOUNT ───────────────────────────────────────────────────
      if (action === 'TOGGLE_DISCOUNT') {
        if (!discount_name) return NextResponse.json({ success: false, message: 'Sebutkan nama diskon yang ingin diaktifkan/dinonaktifkan.' });
        const r = await client.query(`SELECT id, name, is_active FROM warung.discounts WHERE name ILIKE $1 LIMIT 1`, [`%${discount_name}%`]);
        if (!r.rows.length) return NextResponse.json({ success: false, message: `Diskon "${discount_name}" tidak ditemukan.` });
        const d = r.rows[0];
        const newStatus = toggle_active !== null && toggle_active !== undefined ? Boolean(toggle_active) : !d.is_active;
        await client.query(`UPDATE warung.discounts SET is_active = $1 WHERE id = $2`, [newStatus, d.id]);
        return NextResponse.json({ success: true, message: `✅ Diskon *${d.name}* sekarang *${newStatus ? 'Aktif 🟢' : 'Nonaktif 🔴'}*.` });
      }

      // ── DELETE_DISCOUNT ───────────────────────────────────────────────────
      if (action === 'DELETE_DISCOUNT') {
        if (!discount_name) return NextResponse.json({ success: false, message: 'Sebutkan nama diskon yang ingin dihapus.' });
        const r = await client.query(`SELECT id, name FROM warung.discounts WHERE name ILIKE $1 LIMIT 1`, [`%${discount_name}%`]);
        if (!r.rows.length) return NextResponse.json({ success: false, message: `Diskon "${discount_name}" tidak ditemukan.` });
        const d = r.rows[0];
        await client.query(`DELETE FROM warung.discounts WHERE id = $1`, [d.id]);
        return NextResponse.json({ success: true, message: `✅ Diskon *${d.name}* berhasil dihapus.` });
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
    const isNetworkErr = 
      error.message?.includes('fetch failed') || 
      error.message?.includes('ENOTFOUND') || 
      error.message?.includes('ETIMEDOUT') ||
      error.message?.includes('ECONNREFUSED');
      
    const msg = isNetworkErr
      ? '🌐 Asisten AI (Velo) membutuhkan koneksi internet. Sistem saat ini beroperasi dalam Mode Offline — transaksi POS & data lokal tetap berjalan normal!'
      : (error.message || 'Gagal memproses perintah.');

    return NextResponse.json({ error: { code: 'internal_error', message: msg } }, { status: 500 });
  }
}
