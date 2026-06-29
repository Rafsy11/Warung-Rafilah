"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Banknote, QrCode, MonitorSmartphone, Coins, User, Search, X } from 'lucide-react';

export type PaymentMethod = 'CASH' | 'QRIS' | 'SPLIT' | 'DEBT';

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  credit_limit: string;
  current_debt: string;
}

type PaymentPanelProps = {
  warungTotal: number;
  agentTotal:  number;
  agentFee:    number;
  discount:    number;
  grandTotal:  number;
  onPay:       (method: PaymentMethod, received: number, splitCash?: number, splitQris?: number, customerId?: string) => void;
  paying:      boolean;
};

/** Round up to nearest denomination ceiling for quick-cash presets */
function quickCashOptions(total: number): number[] {
  if (total <= 0) return [5_000, 10_000, 20_000, 50_000, 100_000, 200_000];
  const options = new Set<number>();
  // Exact amount
  options.add(total);
  // Round up to next 1k, 2k, 5k, 10k, 50k, 100k
  const thresholds = [1_000, 2_000, 5_000, 10_000, 20_000, 50_000, 100_000, 200_000, 500_000, 1_000_000];
  for (const t of thresholds) {
    const rounded = Math.ceil(total / t) * t;
    if (rounded >= total) options.add(rounded);
  }
  return Array.from(options).sort((a, b) => a - b).slice(0, 6);
}

export default function PaymentPanel({
  warungTotal,
  agentTotal,
  agentFee,
  discount,
  grandTotal,
  onPay,
  paying,
}: PaymentPanelProps) {
  const [method, setMethod]     = useState<PaymentMethod>('CASH');
  const [received, setReceived]   = useState(0);
  const [splitCashAmount, setSplitCashAmount] = useState(0);
  const [splitQrisAmount, setSplitQrisAmount] = useState(0);

  // Customer search states
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Real-time customer lookup for debt payment with 300ms debounce
  useEffect(() => {
    if (customerSearch.trim().length < 2) {
      setCustomerSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/customers?search=${encodeURIComponent(customerSearch)}`);
        if (res.ok) {
          const data = await res.json();
          setCustomerSuggestions(data.items || []);
        }
      } catch (err) {
        console.error(err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  const change   = received - grandTotal;

  const remainingLimit = selectedCustomer ? (Number(selectedCustomer.credit_limit) - Number(selectedCustomer.current_debt)) : 0;
  const netDebtAdded = selectedCustomer ? Math.max(0, grandTotal - (method === 'DEBT' ? received : 0)) : 0;
  const isLimitOk = selectedCustomer ? (remainingLimit >= netDebtAdded) : false;

  const canPay   = grandTotal > 0 && !paying && (
    method === 'QRIS' || 
    (method === 'CASH' && received >= grandTotal) ||
    (method === 'SPLIT' && splitCashAmount > 0 && splitQrisAmount > 0 && (splitCashAmount + splitQrisAmount) === grandTotal) ||
    (method === 'DEBT' && selectedCustomer !== null && isLimitOk)
  );
  const presets  = quickCashOptions(grandTotal);

  useEffect(() => {
    if (method === 'SPLIT') {
      setSplitCashAmount(0);
      setSplitQrisAmount(grandTotal);
    } else if (method === 'DEBT') {
      setReceived(0);
    }
  }, [method, grandTotal]);

  // Reset payment state when cart clears
  useEffect(() => {
    if (grandTotal === 0) {
      const timer = setTimeout(() => {
        setReceived(0);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [grandTotal]);

  const handlePay = useCallback(() => {
    if (!canPay) return;
    if (method === 'SPLIT') {
      onPay(method, splitCashAmount, splitCashAmount, splitQrisAmount);
    } else if (method === 'DEBT') {
      onPay(method, received, undefined, undefined, selectedCustomer?.id);
    } else {
      onPay(method, method === 'QRIS' ? grandTotal : received);
    }
    setReceived(0);
    setSplitCashAmount(0);
    setSplitQrisAmount(0);
    setSelectedCustomer(null);
  }, [canPay, method, received, grandTotal, splitCashAmount, splitQrisAmount, onPay, selectedCustomer]);

  // Listen to Enter key for quick payment submission
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (!canPay) return;

      const activeElement = document.activeElement;
      if (activeElement && activeElement.tagName === 'INPUT') {
        const isReceivedInput = activeElement.getAttribute('data-received-input') === 'true';
        if (e.key === 'Enter' && isReceivedInput) {
          e.preventDefault();
          handlePay();
        }
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        handlePay();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [canPay, handlePay]);

  return (
    <section className="w-96 shrink-0 flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-hidden flex flex-col gap-2.5 pr-1 pb-1">

        {/* ── Totals Card ─────────────────────────────────────────────────── */}
        <div className="bg-surface-container-lowest rounded-lg border border-outline-variant p-3 flex flex-col gap-2 shadow-md">
          {warungTotal > 0 && (
            <div className="flex justify-between items-center text-on-surface-variant font-body-md text-body-md border-b border-outline-variant/30 pb-1.5">
              <span>Warung Total</span>
              <span className="font-label-md text-label-md">Rp {warungTotal.toLocaleString('id-ID')}</span>
            </div>
          )}
          {agentTotal > 0 && (
            <div className="flex justify-between items-center text-primary font-body-md text-body-md border-b border-outline-variant/30 pb-1.5">
              <span>Agent Value</span>
              <span className="font-label-md text-label-md">Rp {agentTotal.toLocaleString('id-ID')}</span>
            </div>
          )}
          {agentFee > 0 && (
            <div className="flex justify-between items-center text-secondary font-body-md text-body-md border-b border-outline-variant/30 pb-1.5">
              <span>Admin Fee</span>
              <span className="font-label-md text-label-md">Rp {agentFee.toLocaleString('id-ID')}</span>
            </div>
          )}
          {discount > 0 && (
            <div className="flex justify-between items-center text-on-surface-variant font-body-md text-body-md border-b border-outline-variant/30 pb-1.5">
              <span>Diskon</span>
              <span className="font-label-md text-label-md text-error">- Rp {discount.toLocaleString('id-ID')}</span>
            </div>
          )}
          <div className="mt-0.5 pt-1.5 border-t border-outline-variant">
            <div className="text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider mb-0.5">Grand Total</div>
            <div className="font-display-price text-display-price text-secondary-container tracking-tight">
              {grandTotal > 0 ? grandTotal.toLocaleString('id-ID') : '—'}
            </div>
          </div>
        </div>

        {/* ── Payment Method ───────────────────────────────────────────────── */}
        <div className="bg-surface-container rounded-lg border border-outline-variant p-2.5 flex flex-col gap-2">
          <div className="text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">Metode Bayar</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMethod('CASH')}
              className={`border-2 rounded p-1.5 flex flex-col items-center justify-center gap-0.5 transition-all relative overflow-hidden font-label-md text-label-md font-bold cursor-pointer ${
                method === 'CASH'
                  ? 'bg-secondary-container border-secondary text-on-secondary-container shadow-md shadow-secondary/20'
                  : 'bg-surface-dim border-outline-variant text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <Banknote size={16} />
              CASH
              <span className="absolute top-0.5 right-0.5 bg-surface-container-lowest/60 rounded px-1 text-[8px]">1</span>
            </button>
            <button
              onClick={() => setMethod('QRIS')}
              className={`border-2 rounded p-1.5 flex flex-col items-center justify-center gap-0.5 transition-all relative font-label-md text-label-md font-bold cursor-pointer ${
                method === 'QRIS'
                  ? 'bg-primary-container border-primary text-on-primary-container shadow-md shadow-primary/20'
                  : 'bg-surface-dim border-outline-variant text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <QrCode size={16} />
              QRIS
              <span className="absolute top-0.5 right-0.5 bg-surface-container-lowest/60 rounded px-1 text-[8px]">2</span>
            </button>
            <button
              onClick={() => setMethod('SPLIT')}
              className={`border-2 rounded p-1.5 flex flex-col items-center justify-center gap-0.5 transition-all relative font-label-md text-label-md font-bold cursor-pointer ${
                method === 'SPLIT'
                  ? 'bg-tertiary-container border-tertiary text-on-tertiary-container shadow-md shadow-tertiary/20'
                  : 'bg-surface-dim border-outline-variant text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <Coins size={16} />
              SPLIT
              <span className="absolute top-0.5 right-0.5 bg-surface-container-lowest/60 rounded px-1 text-[8px]">3</span>
            </button>
            <button
              onClick={() => setMethod('DEBT')}
              className={`border-2 rounded p-1.5 flex flex-col items-center justify-center gap-0.5 transition-all relative font-label-md text-label-md font-bold cursor-pointer ${
                method === 'DEBT'
                  ? 'bg-amber-950/20 border-amber-600 text-amber-500 shadow-md shadow-amber-950/20'
                  : 'bg-surface-dim border-outline-variant text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <User size={16} />
              HUTANG (BON)
              <span className="absolute top-0.5 right-0.5 bg-surface-container-lowest/60 rounded px-1 text-[8px]">4</span>
            </button>
          </div>
        </div>

        {/* ── Cash Input (only when CASH method selected) ──────────────────── */}
        {method === 'CASH' && (
          <div className="bg-surface-container rounded-lg border border-outline-variant p-2.5 flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">Uang Diterima</span>
            </div>

            {/* Custom/Manual input field - always visible */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-label-md text-label-md">Rp</span>
              <input
                type="text"
                data-received-input="true"
                value={received ? received.toLocaleString('id-ID') : ''}
                onChange={e => {
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  setReceived(Number(raw) || 0);
                }}
                placeholder="Ketik jumlah uang..."
                className="w-full bg-surface-dim border border-outline-variant rounded-lg px-3 py-1.5 pl-10 text-on-surface font-label-md text-label-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors"
              />
            </div>

            {/* Quick cash presets */}
            <div className="grid grid-cols-3 gap-2.5">
              {presets.map(amount => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setReceived(amount)}
                  className={`rounded py-1.5 font-label-md text-label-md transition-all border text-center cursor-pointer ${
                    received === amount
                      ? 'bg-secondary-container text-on-secondary-container border-secondary shadow-sm font-bold'
                      : 'bg-surface-container-highest hover:bg-surface-container-high border-outline-variant text-on-surface'
                  }`}
                >
                  {amount === grandTotal
                    ? 'Pas'
                    : amount >= 1_000_000
                    ? `${amount / 1_000_000}jt`
                    : `${amount / 1_000}k`}
                </button>
              ))}
            </div>

            {/* Received / Change display */}
            <div className="flex flex-col gap-1">
              <div className="bg-surface-dim border border-outline-variant rounded p-1.5 flex justify-between items-center">
                <span className="font-label-sm text-label-sm text-on-surface-variant">Diterima</span>
                <span className={`font-label-md text-label-md ${received > 0 ? 'text-on-surface font-semibold' : 'text-on-surface-variant/40'}`}>
                  {received > 0 ? `Rp ${received.toLocaleString('id-ID')}` : '—'}
                </span>
              </div>
              <div className="bg-surface-dim border border-outline-variant rounded p-1.5 flex justify-between items-center">
                <span className="font-label-sm text-label-sm text-on-surface-variant">Kembalian</span>
                <span className={`font-label-lg text-label-lg font-bold ${
                  change > 0 ? 'text-emerald-400' : change < 0 ? 'text-error' : 'text-on-surface-variant/40'
                }`}>
                  {received > 0 ? `Rp ${Math.max(0, change).toLocaleString('id-ID')}` : '—'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Split Input */}
        {method === 'SPLIT' && (
          <div className="bg-surface-container rounded-lg border border-outline-variant p-unit-3 flex flex-col gap-unit-3 animate-in fade-in slide-in-from-top-2 duration-150">
            <span className="text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">Split (Cash + QRIS)</span>
            
            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-label-sm text-on-surface-variant">Nominal Tunai (Cash)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-label-md text-label-md">Rp</span>
                <input
                  type="text"
                  value={splitCashAmount ? splitCashAmount.toLocaleString('id-ID') : ''}
                  onChange={e => {
                    const raw = e.target.value.replace(/[^0-9]/g, '');
                    const val = Number(raw) || 0;
                    const clampedVal = Math.min(grandTotal, val);
                    setSplitCashAmount(clampedVal);
                    setSplitQrisAmount(Math.max(0, grandTotal - clampedVal));
                  }}
                  placeholder="Ketik nominal tunai..."
                  className="w-full bg-surface-dim border border-outline-variant rounded-lg px-3 py-2 pl-10 text-on-surface font-label-md text-label-md focus:border-tertiary focus:ring-1 focus:ring-tertiary outline-none transition-colors"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-label-sm text-on-surface-variant">Sisa Nominal QRIS</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 font-label-md text-label-md">Rp</span>
                <input
                  type="text"
                  value={splitQrisAmount ? splitQrisAmount.toLocaleString('id-ID') : ''}
                  readOnly
                  placeholder="Sisa otomatis..."
                  className="w-full bg-surface-container-low border border-outline-variant/60 rounded-lg px-3 py-2 pl-10 text-on-surface/60 font-label-md text-label-md outline-none cursor-not-allowed"
                />
              </div>
            </div>

            <div className="bg-primary-container/10 border border-primary/20 rounded p-unit-2 text-center text-primary font-body-sm text-body-sm leading-relaxed">
              Bayar Tunai <span className="font-bold">Rp {splitCashAmount.toLocaleString('id-ID')}</span> dan QRIS <span className="font-bold">Rp {splitQrisAmount.toLocaleString('id-ID')}</span>.
            </div>
          </div>
        )}

        {/* Debt Input (only when DEBT method selected) */}
        {method === 'DEBT' && (
          <div className="bg-surface-container rounded-lg border border-outline-variant p-unit-3 flex flex-col gap-unit-3 animate-in fade-in slide-in-from-top-2 duration-150">
            <span className="text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">Pilih Pelanggan (Bon)</span>

            {selectedCustomer ? (
              <div className="flex justify-between items-center bg-surface-dim border border-outline-variant rounded-lg p-3">
                <div className="flex flex-col">
                  <span className="font-semibold text-on-surface">{selectedCustomer.name}</span>
                  <span className="text-xs text-on-surface-variant font-mono">
                    Limit: Rp {Number(selectedCustomer.credit_limit).toLocaleString('id-ID')} | Sisa: Rp {remainingLimit.toLocaleString('id-ID')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="p-1 hover:bg-surface-container-high rounded text-on-surface-variant transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Cari nama pelanggan..."
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  className="w-full bg-surface-dim border border-outline-variant rounded-lg px-3 py-2 pl-10 text-on-surface font-label-md text-label-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors"
                />
                <Search size={18} className="absolute left-3 top-2.5 text-on-surface-variant/60" />

                {customerSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 bg-surface-container-highest border border-outline-variant rounded-lg shadow-xl mt-1 py-1 max-h-48 overflow-y-auto">
                    {customerSuggestions.map(c => {
                      const remaining = Number(c.credit_limit) - Number(c.current_debt);
                      return (
                        <div
                          key={c.id}
                          onClick={() => {
                            setSelectedCustomer(c);
                            setCustomerSearch('');
                            setCustomerSuggestions([]);
                          }}
                          className="flex justify-between items-center px-4 py-2 cursor-pointer hover:bg-surface-container-high font-label-md text-label-md transition-colors"
                        >
                          <div className="flex flex-col text-left">
                            <span className="font-semibold">{c.name}</span>
                            <span className="text-[11px] opacity-60 font-mono">{c.phone || '-'}</span>
                          </div>
                          <span className="text-right font-semibold text-xs">Limit Sisa: Rp {remaining.toLocaleString('id-ID')}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {selectedCustomer && (
              <>
                <div className="flex flex-col gap-1.5 mt-2">
                  <label className="font-label-sm text-label-sm text-on-surface-variant flex justify-between">
                    <span>Uang Muka / DP Tunai (Opsional)</span>
                    {received > 0 && <span className="font-bold text-secondary">Sisa Bon: Rp {(grandTotal - received).toLocaleString('id-ID')}</span>}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-label-md text-label-md">Rp</span>
                    <input
                      type="text"
                      value={received ? received.toLocaleString('id-ID') : ''}
                      onChange={e => {
                        const raw = e.target.value.replace(/[^0-9]/g, '');
                        const val = Number(raw) || 0;
                        setReceived(Math.min(grandTotal, val));
                      }}
                      placeholder="Ketik nominal DP..."
                      className="w-full bg-surface-dim border border-outline-variant rounded-lg px-3 py-1.5 pl-10 text-on-surface font-label-md text-label-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors"
                    />
                  </div>
                </div>

                {!isLimitOk ? (
                  <div className="bg-error-container/20 border border-error/20 rounded p-unit-2 text-center text-error font-body-sm text-body-sm leading-relaxed font-semibold">
                    Limit kredit tidak mencukupi untuk sisa hutang ini!
                  </div>
                ) : (
                  <div className="bg-secondary-container/10 border border-secondary/20 rounded p-unit-2 text-center text-secondary font-body-sm text-body-sm leading-relaxed">
                    {received > 0 ? (
                      <span>
                        DP sebesar <span className="font-bold">Rp {received.toLocaleString('id-ID')}</span> diterima. Sisa <span className="font-bold">Rp {(grandTotal - received).toLocaleString('id-ID')}</span> akan dicatat sebagai hutang/bon.
                      </span>
                    ) : (
                      <span>Total Rp {grandTotal.toLocaleString('id-ID')} akan dicatat sebagai hutang/bon.</span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

      </div>

      {/* ── Pay Button ─────────────────────────────────────────────────────── */}
      <div className="mt-auto pt-4 shrink-0">
        {/* Insufficient cash warning */}
        {method === 'CASH' && received > 0 && received < grandTotal && grandTotal > 0 && (
          <div className="mb-2 text-center font-label-sm text-label-sm text-error animate-pulse">
            Kurang Rp {(grandTotal - received).toLocaleString('id-ID')}
          </div>
        )}
        <button
          id="btn-pay"
          onClick={handlePay}
          disabled={!canPay}
          className="w-full bg-primary-container hover:bg-primary-container/90 text-on-primary-container font-headline-lg text-headline-lg rounded-lg py-unit-4 flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg shadow-primary-container/20 border border-primary disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <MonitorSmartphone size={28} />
          {paying ? 'MEMPROSES...' : method === 'QRIS' ? 'BAYAR QRIS [ENTER]' : method === 'SPLIT' ? 'BAYAR SPLIT [ENTER]' : method === 'DEBT' ? 'CATAT HUTANG [ENTER]' : 'BAYAR TUNAI [ENTER]'}
        </button>
      </div>
    </section>
  );
}
