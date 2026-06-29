"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Smartphone, FileText, QrCode, ArrowDownCircle, ArrowRightLeft,
  Phone, DollarSign, CheckCircle2, XCircle, Clock, ChevronRight,
  Loader2, User, LogOut, AlertCircle,
} from 'lucide-react';
import { printReceipt } from '@/lib/print/receipt';
import FloatBalanceWidget from '@/components/pos/FloatBalanceWidget';

// ─── Types ──────────────────────────────────────────────────────────────────

type ServiceType = 'e_wallet_topup' | 'bill_payment' | 'qris_deposit' | 'cash_withdrawal' | 'transfer';

interface ServiceDef {
  type:       ServiceType;
  label:      string;
  Icon:       React.ElementType;
  adminFee:   number;
  commission: number;
}

interface RecentTx {
  id:               string;
  transaction_code: string;
  service_type:     string;
  amount:           string;
  status:           string;
  created_at:       string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SERVICES: ServiceDef[] = [
  { type: 'e_wallet_topup',  label: 'E-Wallet Topup',  Icon: Smartphone,       adminFee: 1_000, commission: 1_500 },
  { type: 'bill_payment',    label: 'Bayar Tagihan',    Icon: FileText,         adminFee: 2_500, commission: 2_000 },
  { type: 'qris_deposit',    label: 'QRIS Deposit',     Icon: QrCode,           adminFee: 0,     commission: 500   },
  { type: 'cash_withdrawal', label: 'Tarik Tunai',      Icon: ArrowDownCircle,  adminFee: 5_000, commission: 3_000 },
  { type: 'transfer',        label: 'Transfer Dana',    Icon: ArrowRightLeft,   adminFee: 3_000, commission: 2_500 },
];

const STATUS_ICON: Record<string, React.ReactNode> = {
  success:  <CheckCircle2 size={14} className="text-emerald-400" />,
  pending:  <Clock        size={14} className="text-amber-400"   />,
  failed:   <XCircle      size={14} className="text-error"       />,
  reversed: <XCircle      size={14} className="text-on-surface-variant" />,
};

const SERVICE_LABEL: Record<string, string> = {
  e_wallet_topup:  'E-Wallet',
  bill_payment:    'Tagihan',
  qris_deposit:    'QRIS',
  cash_withdrawal: 'Tarik Tunai',
  transfer:        'Transfer',
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function ServiceTile({ svc, selected, onClick }: {
  svc: ServiceDef;
  selected: boolean;
  onClick: () => void;
}) {
  const { Icon, label, commission } = svc;
  return (
    <button
      onClick={onClick}
      className={`flex flex-col gap-2 p-3 rounded-xl border-2 text-left transition-all ${
        selected
          ? 'bg-primary-container border-primary shadow-lg shadow-primary/20 scale-[1.02]'
          : 'bg-surface-container border-outline-variant hover:bg-surface-container-high hover:border-primary/40'
      }`}
    >
      <div className={`p-2 rounded-lg w-fit ${selected ? 'bg-on-primary-container/10' : 'bg-surface-container-highest'}`}>
        <Icon size={20} className={selected ? 'text-on-primary-container' : 'text-on-surface-variant'} />
      </div>
      <div className={`font-label-md text-label-md font-semibold ${selected ? 'text-on-primary-container' : 'text-on-surface'}`}>
        {label}
      </div>
      <div className={`font-label-sm text-[10px] leading-tight ${selected ? 'text-on-primary-container/70' : 'text-on-surface-variant'}`}>
        Komisi: Rp {commission.toLocaleString('id-ID')}
      </div>
    </button>
  );
}

function RecentRow({ tx }: { tx: RecentTx }) {
  const label = SERVICE_LABEL[tx.service_type] ?? tx.service_type;
  const date  = new Date(tx.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="flex items-center gap-3 py-2 border-b border-outline-variant/30 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="font-label-md text-label-md text-on-surface truncate">{tx.transaction_code}</div>
        <div className="font-label-sm text-label-sm text-on-surface-variant">{label} · {date}</div>
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

// ── Closing modal types ──────────────────────────────────────────────────────

interface DailySummary {
  transaction_count: number;
  gross_volume:      string;
  total_commission:  string;
  total_admin_fee:   string;
  closing:           { status: string } | null;
}

export default function AgentWorkspace({ onToast }: AgentWorkspaceProps) {
  const [selected, setSelected]     = useState<ServiceDef>(SERVICES[0]);
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

  const amount    = parseInt(amountStr.replace(/\D/g, ''), 10) || 0;
  const adminFee  = selected.adminFee;
  const commission = selected.commission;
  const totalCharge = amount + adminFee;
  const canSubmit  = amount > 0 && !submitting && floatBalance >= amount;

  // ── Fetch operator name ────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      operatorRef.current = d.id ?? '';
    }).catch(() => {});
  }, []);

  // ── Fetch recent transactions ──────────────────────────────────────────────
  const fetchRecent = useCallback(async () => {
    setLoadingTxs(true);
    try {
      const res = await fetch('/api/agent/transactions?limit=5');
      if (!res.ok) return;
      const data = await res.json();
      setRecentTxs(data.items ?? []);
    } catch {
      // silent — recent list is non-critical
    } finally {
      setLoadingTxs(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRecent();
    }, 0);
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
          opening_float:      closingFloat, // simplified: no opening ledger lookup
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

  // Focus amount when service changes
  const selectService = useCallback((svc: ServiceDef) => {
    setSelected(svc);
    setAmountStr('');
    setTimeout(() => amountRef.current?.focus(), 50);
  }, []);

  // ── Submit transaction ─────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);

    const txCode = `AGT-${Date.now()}`;

    try {
      const payload = {
        transaction_code: txCode,
        service_type:     selected.type,
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
        `✓ Sukses! ${selected.label} — Rp ${amount.toLocaleString('id-ID')} | Saldo baru: Rp ${Number(result.new_balance).toLocaleString('id-ID')}`,
        'success'
      );

      // Print agent receipt
      printReceipt({
        type:             'agent',
        transaction_code: txCode,
        operator:         operatorRef.current || 'Operator',
        service_label:    selected.label,
        customer_phone:   phone.trim() || undefined,
        amount,
        admin_fee:        adminFee,
        total_charge:     amount + adminFee,
        commission,
        timestamp:        new Date(),
      });

      setAmountStr('');
      setPhone('');
      fetchRecent();
    } catch {
      onToast('Koneksi bermasalah. Periksa server.', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, selected, phone, amount, adminFee, commission, onToast, fetchRecent]);

  return (
    <div className="flex-1 flex gap-gutter overflow-hidden">

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

      {/* ── LEFT: Service selector + Form ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-gutter overflow-y-auto pr-1">

        {/* Float Balance */}
        <FloatBalanceWidget onBalanceLoad={setFloatBalance} />

        {/* Service grid */}
        <div className="bg-surface-container rounded-xl border border-outline-variant p-4 flex flex-col gap-3">
          <div className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
            Pilih Layanan
          </div>
          <div className="grid grid-cols-5 gap-2">
            {SERVICES.map(svc => (
              <ServiceTile
                key={svc.type}
                svc={svc}
                selected={selected.type === svc.type}
                onClick={() => selectService(svc)}
              />
            ))}
          </div>
        </div>

        {/* Transaction form */}
        <form
          onSubmit={handleSubmit}
          className="bg-surface-container rounded-xl border border-outline-variant p-4 flex flex-col gap-4"
        >
          <div className="flex items-center gap-2">
            <selected.Icon size={18} className="text-primary" />
            <span className="font-label-md text-label-md text-on-surface font-semibold">
              {selected.label}
            </span>
          </div>

          {/* Phone */}
          <div className="flex flex-col gap-1.5">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
              <Phone size={12} />
              No. HP Pelanggan <span className="normal-case text-on-surface-variant/50">(opsional)</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="0812xxxxxxxx"
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
              <><ChevronRight size={18} /> PROSES {selected.label.toUpperCase()} [ENTER]</>
            )}
          </button>
        </form>
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
