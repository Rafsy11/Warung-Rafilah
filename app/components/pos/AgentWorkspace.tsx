"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Phone, DollarSign, CheckCircle2, XCircle, Clock, ChevronRight,
  ChevronLeft, Loader2, User, LogOut, AlertCircle,
} from 'lucide-react';
import { printReceipt } from '@/lib/print/receipt';
import FloatBalanceWidget from '@/components/pos/FloatBalanceWidget';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DigitalProduct {
  id: string;
  category: string;
  product_name: string;
  product_code: string;
  admin_fee: string;
  agent_commission: string;
  icon_emoji: string;
}

interface CategoryGroup {
  category: string;
  icon: string;
  products: DigitalProduct[];
}

interface RecentTx {
  id:               string;
  transaction_code: string;
  service_type:     string;
  product_name:     string | null;
  amount:           string;
  status:           string;
  created_at:       string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  listrik:       'Listrik',
  bpjs:          'BPJS',
  pajak:         'Pajak',
  e_wallet:      'E-Wallet',
  pulsa_data:    'Pulsa & Data',
  topup_game:    'Top-Up Game',
  air_pdam:      'Air / PDAM',
  tv_internet:   'TV & Internet',
  transfer_bank: 'Transfer Bank',
  tarik_tunai:   'Tarik Tunai',
  asuransi:      'Asuransi',
  // Legacy
  e_wallet_topup:  'E-Wallet',
  bill_payment:    'Tagihan',
  qris_deposit:    'QRIS',
  cash_withdrawal: 'Tarik Tunai',
  transfer:        'Transfer',
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  success:  <CheckCircle2 size={14} className="text-emerald-400" />,
  pending:  <Clock        size={14} className="text-amber-400"   />,
  failed:   <XCircle      size={14} className="text-error"       />,
  reversed: <XCircle      size={14} className="text-on-surface-variant" />,
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function CategoryTile({ cat, onClick }: { cat: CategoryGroup; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-3 rounded-xl border-2 bg-surface-container border-outline-variant hover:bg-surface-container-high hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 transition-all active:scale-[0.97]"
    >
      <div className="text-2xl leading-none">{cat.icon}</div>
      <div className="font-label-md text-label-md font-semibold text-on-surface text-center leading-tight">
        {CATEGORY_LABELS[cat.category] ?? cat.category}
      </div>
      <div className="font-label-sm text-[10px] text-on-surface-variant">
        {cat.products.length} produk
      </div>
    </button>
  );
}

function ProductTile({ product, selected, onClick }: {
  product: DigitalProduct;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
        selected
          ? 'bg-primary-container border-primary shadow-lg shadow-primary/20 scale-[1.01]'
          : 'bg-surface-container border-outline-variant hover:bg-surface-container-high hover:border-primary/40'
      }`}
    >
      <div className={`text-xl shrink-0 ${selected ? '' : 'opacity-70'}`}>
        {product.icon_emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`font-label-md text-label-md font-semibold truncate ${selected ? 'text-on-primary-container' : 'text-on-surface'}`}>
          {product.product_name}
        </div>
        <div className={`font-label-sm text-[10px] leading-tight ${selected ? 'text-on-primary-container/70' : 'text-on-surface-variant'}`}>
          Admin: Rp {Number(product.admin_fee).toLocaleString('id-ID')} · Komisi: Rp {Number(product.agent_commission).toLocaleString('id-ID')}
        </div>
      </div>
    </button>
  );
}

function RecentRow({ tx }: { tx: RecentTx }) {
  const label = tx.product_name ?? CATEGORY_LABELS[tx.service_type] ?? tx.service_type;
  const date  = new Date(tx.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="flex items-center gap-3 py-2 border-b border-outline-variant/30 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="font-label-md text-label-md text-on-surface truncate">{label}</div>
        <div className="font-label-sm text-label-sm text-on-surface-variant">{tx.transaction_code} · {date}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-label-md text-label-md text-on-surface">
          Rp {Number(tx.amount).toLocaleString('id-ID')}
        </div>
        <div className="flex items-center justify-end gap-1 capitalize font-label-sm text-label-sm text-on-surface-variant">
          {STATUS_ICON[tx.status]}
          {tx.status}
        </div>
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

interface AgentWorkspaceProps {
  onToast: (msg: string, type: 'success' | 'error') => void;
}

interface DailySummary {
  transaction_count: number;
  gross_volume:      string;
  total_commission:  string;
  total_admin_fee:   string;
  closing:           { status: string } | null;
}

export default function AgentWorkspace({ onToast }: AgentWorkspaceProps) {
  // Product catalog state
  const [categories, setCategories]       = useState<CategoryGroup[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [selectedCat, setSelectedCat]     = useState<CategoryGroup | null>(null);
  const [selectedProd, setSelectedProd]   = useState<DigitalProduct | null>(null);

  // Form state
  const [phone, setPhone]           = useState('');
  const [amountStr, setAmountStr]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [floatBalance, setFloatBalance] = useState(0);
  const [recentTxs, setRecentTxs]   = useState<RecentTx[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(true);
  const amountRef = useRef<HTMLInputElement>(null);

  // Closing state
  const [showClosingModal, setShowClosingModal] = useState(false);
  const [dailySummary, setDailySummary]         = useState<DailySummary | null>(null);
  const [loadingClosing, setLoadingClosing]     = useState(false);
  const [closing, setClosing]                   = useState(false);
  const [alreadyClosed, setAlreadyClosed]       = useState(false);
  const operatorRef = useRef<string>('');

  const amount       = parseInt(amountStr.replace(/\D/g, ''), 10) || 0;
  const adminFee     = selectedProd ? Number(selectedProd.admin_fee) : 0;
  const commission   = selectedProd ? Number(selectedProd.agent_commission) : 0;
  const totalCharge  = amount + adminFee;
  const canSubmit    = amount > 0 && selectedProd && !submitting && floatBalance >= amount;

  // ── Fetch operator name ────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      operatorRef.current = d.id ?? '';
    }).catch(() => {});
  }, []);

  // ── Fetch digital product catalog ─────────────────────────────────────────
  useEffect(() => {
    setLoadingCatalog(true);
    fetch('/api/agent/products?grouped=true')
      .then(r => r.json())
      .then(data => {
        setCategories(data.categories ?? []);
      })
      .catch(() => {
        onToast('Gagal memuat katalog produk digital.', 'error');
      })
      .finally(() => setLoadingCatalog(false));
  }, [onToast]);

  // ── Fetch recent transactions ──────────────────────────────────────────────
  const fetchRecent = useCallback(async () => {
    setLoadingTxs(true);
    try {
      const res = await fetch('/api/agent/transactions?limit=5');
      if (!res.ok) return;
      const data = await res.json();
      setRecentTxs(data.items ?? []);
    } catch {
      // silent
    } finally {
      setLoadingTxs(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { fetchRecent(); }, 0);
    return () => clearTimeout(timer);
  }, [fetchRecent]);

  // ── Open closing modal ─────────────────────────────────────────────────────
  const handleOpenClosing = useCallback(async () => {
    setLoadingClosing(true);
    setShowClosingModal(true);
    try {
      const res = await fetch('/api/agent/daily-summary');
      if (res.ok) {
        const data: DailySummary = await res.json();
        setDailySummary(data);
        setAlreadyClosed(data.closing?.status === 'closed');
      }
    } catch { /* silent */ } finally {
      setLoadingClosing(false);
    }
  }, []);

  // ── Submit daily closing ───────────────────────────────────────────────────
  const handleSubmitClosing = useCallback(async () => {
    if (!dailySummary || closing) return;
    setClosing(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const balanceRes = await fetch('/api/agent/float-balance');
      const { balance: closingFloat } = balanceRes.ok ? await balanceRes.json() : { balance: 0 };

      const res = await fetch('/api/agent/closing', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          closing_date:       today,
          opening_float:      closingFloat,
          closing_float:      closingFloat,
          total_transactions: dailySummary.transaction_count,
          total_commission:   Number(dailySummary.total_commission),
          total_admin_fee:    Number(dailySummary.total_admin_fee),
          closed_by:          operatorRef.current || null,
        }),
      });

      if (res.status === 409) {
        setAlreadyClosed(true);
        onToast('Kas agen hari ini sudah ditutup sebelumnya.', 'error');
        return;
      }
      if (!res.ok) {
        onToast('Gagal menutup kas. Coba lagi.', 'error');
        return;
      }

      onToast(`✓ Kas berhasil ditutup. Komisi hari ini: Rp ${Number(dailySummary.total_commission).toLocaleString('id-ID')}`, 'success');
      setShowClosingModal(false);
    } catch {
      onToast('Koneksi bermasalah saat tutup kas.', 'error');
    } finally {
      setClosing(false);
    }
  }, [dailySummary, closing, onToast]);

  // ── Select category ────────────────────────────────────────────────────────
  const selectCategory = useCallback((cat: CategoryGroup) => {
    setSelectedCat(cat);
    setSelectedProd(null);
    setAmountStr('');
    setPhone('');
  }, []);

  const goBackToCategories = useCallback(() => {
    setSelectedCat(null);
    setSelectedProd(null);
    setAmountStr('');
    setPhone('');
  }, []);

  // ── Select product ─────────────────────────────────────────────────────────
  const selectProduct = useCallback((prod: DigitalProduct) => {
    setSelectedProd(prod);
    setAmountStr('');
    setTimeout(() => amountRef.current?.focus(), 50);
  }, []);

  // ── Submit transaction ─────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !selectedProd) return;
    setSubmitting(true);

    const txCode = `AGT-${Date.now()}`;

    try {
      const payload = {
        transaction_code: txCode,
        service_type:     selectedProd.category,
        product_id:       selectedProd.id,
        product_name:     selectedProd.product_name,
        customer_phone:   phone.trim() || undefined,
        amount,
        admin_fee:        adminFee,
        agent_commission: commission,
      };

      const res = await fetch('/api/agent/transactions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        onToast(err.details || err.error?.message || 'Transaksi agen gagal.', 'error');
        return;
      }

      const result = await res.json();
      onToast(
        `✓ Sukses! ${selectedProd.product_name} — Rp ${amount.toLocaleString('id-ID')} | Saldo baru: Rp ${Number(result.new_balance).toLocaleString('id-ID')}`,
        'success'
      );

      if (window.confirm('Cetak struk belanja?')) {
        printReceipt({
          type:             'agent',
          transaction_code: txCode,
          operator:         operatorRef.current || 'Operator',
          service_label:    selectedProd.product_name,
          customer_phone:   phone.trim() || undefined,
          amount,
          admin_fee:        adminFee,
          total_charge:     amount + adminFee,
          commission,
          timestamp:        new Date(),
        });
      }

      setAmountStr('');
      setPhone('');
      fetchRecent();
    } catch {
      onToast('Koneksi bermasalah. Periksa server.', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, selectedProd, phone, amount, adminFee, commission, onToast, fetchRecent]);

  return (
    <div className="flex-1 flex gap-3.5 overflow-hidden">

      {/* ── Closing Modal ─────────────────────────────────────────────────── */}
      {showClosingModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-container rounded-2xl border border-outline-variant p-6 w-full max-w-sm mx-4 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center gap-2">
              <LogOut size={18} className="text-secondary" />
              <h3 className="font-label-lg text-label-lg font-bold text-on-surface">Tutup Kas Agen</h3>
            </div>

            {loadingClosing ? (
              <div className="flex items-center justify-center py-8 text-on-surface-variant">
                <Loader2 size={20} className="animate-spin mr-2" /> Memuat ringkasan...
              </div>
            ) : alreadyClosed ? (
              <div className="flex items-center gap-2 bg-error-container text-on-error-container rounded-lg p-3">
                <AlertCircle size={16} className="shrink-0" />
                <span className="font-body-md text-body-md">Kas agen hari ini sudah ditutup.</span>
              </div>
            ) : dailySummary ? (
              <div className="flex flex-col gap-2 bg-surface-dim rounded-xl border border-outline-variant/50 p-4">
                <div className="flex justify-between font-label-sm text-label-sm text-on-surface-variant">
                  <span>Total Transaksi</span>
                  <span className="text-on-surface font-semibold">{dailySummary.transaction_count}x</span>
                </div>
                <div className="flex justify-between font-label-sm text-label-sm text-on-surface-variant">
                  <span>Gross Volume</span>
                  <span className="text-on-surface">Rp {Number(dailySummary.gross_volume).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between font-label-sm text-label-sm text-on-surface-variant">
                  <span>Total Admin Fee</span>
                  <span className="text-on-surface">Rp {Number(dailySummary.total_admin_fee).toLocaleString('id-ID')}</span>
                </div>
                <div className="border-t border-outline-variant/40 pt-2 flex justify-between font-label-md text-label-md">
                  <span className="text-on-surface-variant">Total Komisi Kamu</span>
                  <span className="text-emerald-400 font-bold">+ Rp {Number(dailySummary.total_commission).toLocaleString('id-ID')}</span>
                </div>
              </div>
            ) : null}

            <div className="flex gap-2">
              <button
                onClick={() => setShowClosingModal(false)}
                className="flex-1 bg-surface-container-highest hover:bg-surface-container-high border border-outline-variant text-on-surface font-label-md text-label-md rounded-lg py-2.5 transition-colors"
              >
                Batal
              </button>
              {!alreadyClosed && (
                <button
                  onClick={handleSubmitClosing}
                  disabled={closing || loadingClosing || !dailySummary}
                  className="flex-1 bg-secondary-container hover:bg-secondary-container/80 text-on-secondary-container font-label-md text-label-md rounded-lg py-2.5 flex items-center justify-center gap-2 border border-secondary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {closing ? <><Loader2 size={14} className="animate-spin" /> Menutup...</> : 'Tutup Kas'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── LEFT: Catalog + Form ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-gutter overflow-y-auto pr-1">

        {/* Float Balance */}
        <FloatBalanceWidget onBalanceLoad={setFloatBalance} />

        {/* Category / Product selector */}
        <div className="bg-surface-container rounded-xl border border-outline-variant p-4 flex flex-col gap-3">

          {!selectedCat ? (
            <>
              {/* ── Level 1: Pilih Kategori ── */}
              <div className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                Pilih Kategori Layanan
              </div>
              {loadingCatalog ? (
                <div className="flex items-center justify-center py-8 text-on-surface-variant">
                  <Loader2 size={20} className="animate-spin mr-2" /> Memuat katalog...
                </div>
              ) : categories.length === 0 ? (
                <div className="text-center py-6 text-on-surface-variant font-body-md text-body-md">
                  Belum ada produk digital. Jalankan migrasi database terlebih dahulu.
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-2">
                  {categories.map(cat => (
                    <CategoryTile
                      key={cat.category}
                      cat={cat}
                      onClick={() => selectCategory(cat)}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {/* ── Level 2: Pilih Produk ── */}
              <div className="flex items-center gap-2">
                <button
                  onClick={goBackToCategories}
                  className="p-1.5 rounded-lg bg-surface-container-highest hover:bg-surface-dim border border-outline-variant transition-colors"
                >
                  <ChevronLeft size={16} className="text-on-surface-variant" />
                </button>
                <div className="text-lg leading-none">{selectedCat.icon}</div>
                <div className="font-label-md text-label-md text-on-surface font-semibold">
                  {CATEGORY_LABELS[selectedCat.category] ?? selectedCat.category}
                </div>
                <div className="font-label-sm text-label-sm text-on-surface-variant">
                  — Pilih produk
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {selectedCat.products.map(prod => (
                  <ProductTile
                    key={prod.id}
                    product={prod}
                    selected={selectedProd?.id === prod.id}
                    onClick={() => selectProduct(prod)}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Transaction form — only show when product is selected */}
        {selectedProd && (
          <form
            onSubmit={handleSubmit}
            className="bg-surface-container rounded-xl border border-outline-variant p-4 flex flex-col gap-4"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{selectedProd.icon_emoji}</span>
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                {selectedProd.product_name}
              </span>
            </div>

            {/* Phone / Customer ID */}
            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                <Phone size={12} />
                No. HP / ID Pelanggan <span className="normal-case text-on-surface-variant/50">(opsional)</span>
              </label>
              <input
                id="agent-customer-phone-input"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="0812xxxxxxxx / No. Meter"
                className="bg-surface-dim border border-outline-variant rounded-lg px-3 py-2.5 text-on-surface font-label-md text-label-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors placeholder:text-on-surface-variant/40"
                disabled={submitting}
              />
            </div>

            {/* Amount */}
            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign size={12} />
                Nominal Transaksi
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-label-md text-label-md">Rp</span>
                <input
                  ref={amountRef}
                  type="text"
                  value={amountStr ? Number(amountStr.replace(/[^0-9]/g, '')).toLocaleString('id-ID') : ''}
                  onChange={e => setAmountStr(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="0"
                  className="w-full bg-surface-dim border border-outline-variant rounded-lg px-3 py-2.5 pl-10 text-on-surface font-label-md text-label-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors placeholder:text-on-surface-variant/40"
                  disabled={submitting}
                />
              </div>
            </div>

            {/* Fee breakdown */}
            {amount > 0 && (
              <div className="bg-surface-dim rounded-lg border border-outline-variant/50 p-3 flex flex-col gap-2">
                <div className="flex justify-between font-label-sm text-label-sm text-on-surface-variant">
                  <span>Modal (keluar dari float)</span>
                  <span className="text-on-surface">Rp {amount.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between font-label-sm text-label-sm text-on-surface-variant">
                  <span>Biaya Admin (ditagih ke pelanggan)</span>
                  <span className="text-on-surface">Rp {adminFee.toLocaleString('id-ID')}</span>
                </div>
                <div className="border-t border-outline-variant/30 pt-2 flex justify-between font-label-md text-label-md">
                  <span className="text-on-surface-variant">Total diterima dari pelanggan</span>
                  <span className="text-secondary font-bold">Rp {totalCharge.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between font-label-sm text-label-sm">
                  <span className="text-on-surface-variant">Komisi kamu</span>
                  <span className="text-emerald-400 font-semibold">+ Rp {commission.toLocaleString('id-ID')}</span>
                </div>
                {floatBalance < amount && (
                  <div className="text-error font-label-sm text-label-sm mt-1">
                    ⚠ Saldo float tidak cukup (tersedia Rp {floatBalance.toLocaleString('id-ID')})
                  </div>
                )}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-primary-container hover:bg-primary-container/80 text-on-primary-container font-label-lg text-label-lg rounded-xl py-3.5 flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md shadow-primary/10 border border-primary/30 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <><Loader2 size={18} className="animate-spin" /> Memproses...</>
              ) : (
                <><ChevronRight size={18} /> PROSES {selectedProd.product_name.toUpperCase()} [ENTER]</>
              )}
            </button>
          </form>
        )}
      </div>

      {/* ── RIGHT: Recent transactions ─────────────────────────────────────── */}
      <div className="w-72 shrink-0 flex flex-col gap-gutter">

        {/* Tutup Kas button */}
        <button
          onClick={handleOpenClosing}
          className="w-full bg-surface-container border border-outline-variant hover:bg-error-container/20 hover:border-error/40 text-on-surface-variant hover:text-error font-label-md text-label-md rounded-xl py-2.5 flex items-center justify-center gap-2 transition-all"
        >
          <LogOut size={15} />
          TUTUP KAS HARIAN
        </button>

        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 flex flex-col gap-3 flex-1 overflow-hidden">
          <div className="flex items-center justify-between shrink-0">
            <div className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              Transaksi Terakhir
            </div>
            <User size={14} className="text-on-surface-variant" />
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingTxs ? (
              <div className="flex items-center justify-center h-24 text-on-surface-variant">
                <Loader2 size={18} className="animate-spin" />
              </div>
            ) : recentTxs.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-on-surface-variant font-body-md text-body-md text-center">
                Belum ada transaksi hari ini
              </div>
            ) : (
              recentTxs.map(tx => <RecentRow key={tx.id} tx={tx} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
