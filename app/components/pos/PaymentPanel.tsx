"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Banknote, QrCode, MonitorSmartphone, Coins, User, Search, X, UserPlus } from 'lucide-react';
import QuickAddCustomerModal from '@/components/pos/QuickAddCustomerModal';

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
  onDiscountChange: (discount: number) => void;
  grandTotal:  number;
  onPay:       (method: PaymentMethod, received: number, splitCash?: number, splitQris?: number, customerId?: string) => void;
  paying:      boolean;
  activeDiscounts?: any[];
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
  onDiscountChange,
  grandTotal,
  onPay,
  paying,
  activeDiscounts,
}: PaymentPanelProps) {
  const [method, setMethod]     = useState<PaymentMethod>('CASH');
  const [received, setReceived]   = useState(0);
  const [splitCashAmount, setSplitCashAmount] = useState(0);
  const [splitQrisAmount, setSplitQrisAmount] = useState(0);

  // Customer search states
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearchDone, setCustomerSearchDone] = useState(false);
  const [quickAddName, setQuickAddName] = useState<string | null>(null);

  const [discountInputVal, setDiscountInputVal] = useState('');

  // Sync discountInputVal with discount prop
  useEffect(() => {
    if (discount === 0) {
      setDiscountInputVal('');
    } else {
      setDiscountInputVal(discount.toLocaleString('id-ID'));
    }
  }, [discount]);

  const handleDiscountInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    const val = Number(raw) || 0;
    const subtotal = warungTotal + agentTotal + agentFee;
    const clampedVal = Math.min(subtotal, val);
    onDiscountChange(clampedVal);
  };

  const handleApplyPresetNominal = (amount: number) => {
    const subtotal = warungTotal + agentTotal + agentFee;
    onDiscountChange(Math.min(subtotal, amount));
  };

  const handleApplyPresetPercent = (percent: number) => {
    const subtotal = warungTotal + agentTotal + agentFee;
    const d = Math.round((subtotal * percent) / 100);
    onDiscountChange(Math.min(subtotal, d));
  };

  const handleClearDiscount = () => {
    onDiscountChange(0);
  };

  // Real-time customer lookup for debt payment with 300ms debounce
  useEffect(() => {
    setCustomerSearchDone(false);
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
      } finally {
        setCustomerSearchDone(true);
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

  const handleQuickAddCustomerSaved = useCallback((customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch('');
    setCustomerSuggestions([]);
    setQuickAddName(null);
  }, []);

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

  useEffect(() => {
    const onSelectCash = () => {
      setMethod('CASH');
      setTimeout(() => {
        const inp = document.querySelector('[data-received-input="true"]') as HTMLInputElement;
        inp?.focus();
        inp?.select();
      }, 50);
    };
    const onSelectQris = () => setMethod('QRIS');
    const onSelectSplit = () => {
      setMethod('SPLIT');
      setTimeout(() => {
        const inp = document.querySelector('[data-received-input="true"]') as HTMLInputElement;
        inp?.focus();
        inp?.select();
      }, 50);
    };
    const onSelectDebt = () => {
      setMethod('DEBT');
      setTimeout(() => {
        const inp = document.getElementById('customer-search-input') as HTMLInputElement;
        inp?.focus();
        inp?.select();
      }, 50);
    };
    const onFocusPayment = () => {
      const inp = document.querySelector('[data-received-input="true"]') as HTMLInputElement;
      if (inp && (method === 'CASH' || method === 'SPLIT')) {
        inp.focus();
        inp.select();
      } else if (method === 'DEBT') {
        const custInp = document.getElementById('customer-search-input') as HTMLInputElement;
        custInp?.focus();
      }
    };
    const onTriggerPay = () => {
      if (canPay) {
        handlePay();
      }
    };

    window.addEventListener('hotkey-pay-cash', onSelectCash);
    window.addEventListener('hotkey-pay-qris', onSelectQris);
    window.addEventListener('hotkey-pay-split', onSelectSplit);
    window.addEventListener('hotkey-pay-debt', onSelectDebt);
    window.addEventListener('hotkey-focus-payment', onFocusPayment);
    window.addEventListener('hotkey-trigger-pay', onTriggerPay);

    return () => {
      window.removeEventListener('hotkey-pay-cash', onSelectCash);
      window.removeEventListener('hotkey-pay-qris', onSelectQris);
      window.removeEventListener('hotkey-pay-split', onSelectSplit);
      window.removeEventListener('hotkey-pay-debt', onSelectDebt);
      window.removeEventListener('hotkey-focus-payment', onFocusPayment);
      window.removeEventListener('hotkey-trigger-pay', onTriggerPay);
    };
  }, [method, canPay, handlePay]);

  return (
    <section className="w-96 shrink-0 flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto flex flex-col gap-3.5 pr-2.5 pb-2">

        {/* ── Totals Card ─────────────────────────────────────────────────── */}
        <div className="bg-surface-container border border-outline-variant/50 rounded-2xl p-4 flex flex-col gap-2.5 shadow-md hover:shadow-lg transition-shadow duration-200">
          {warungTotal > 0 && (
            <div className="flex justify-between items-center text-on-surface-variant font-body-md text-body-md border-b border-outline-variant/20 pb-2">
              <span className="font-medium">Total Warung</span>
              <span className="font-mono font-bold text-on-surface">Rp {warungTotal.toLocaleString('id-ID')}</span>
            </div>
          )}
          {agentTotal > 0 && (
            <div className="flex justify-between items-center text-secondary font-body-md text-body-md border-b border-outline-variant/20 pb-2">
              <span className="font-semibold">Layanan Agen</span>
              <span className="font-mono font-bold">Rp {agentTotal.toLocaleString('id-ID')}</span>
            </div>
          )}
          {agentFee > 0 && (
            <div className="flex justify-between items-center text-secondary font-body-md text-body-md border-b border-outline-variant/20 pb-2">
              <span className="font-semibold">Admin Agen</span>
              <span className="font-mono font-bold">Rp {agentFee.toLocaleString('id-ID')}</span>
            </div>
          )}
          {discount > 0 && (
            <div className="flex justify-between items-center text-on-surface-variant font-body-md text-body-md border-b border-outline-variant/20 pb-2">
              <span className="font-medium">Diskon Potongan</span>
              <span className="font-mono font-bold text-error">- Rp {discount.toLocaleString('id-ID')}</span>
            </div>
          )}
          <div className="mt-1 pt-2">
            <div className="text-on-surface-variant/80 font-label-sm text-label-sm uppercase tracking-wider font-extrabold text-[10px] leading-none">GRAND TOTAL</div>
            <div className="font-display-price text-3xl xl:text-4xl text-primary font-black tracking-tight mt-1.5 price-display">
              {grandTotal > 0 ? `Rp ${grandTotal.toLocaleString('id-ID')}` : 'Rp 0'}
            </div>
          </div>
        </div>

        {/* ── Discount Panel ───────────────────────────────────────────────── */}
        <div className="bg-surface-container border border-outline-variant/50 p-4 rounded-2xl flex flex-col gap-3 shadow-sm">
          <div className="text-on-surface-variant/90 font-label-sm text-label-sm uppercase tracking-wider font-bold flex justify-between items-center text-[10px]">
            <span>Terapkan Diskon</span>
            {discount > 0 && (
              <span className="text-[9px] text-error font-extrabold bg-error-container/30 px-2 py-0.5 rounded-md border border-error/10 uppercase">
                Aktif
              </span>
            )}
          </div>
          
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant font-label-md text-label-md font-bold">Rp</span>
            <input
              id="input-discount"
              type="text"
              value={discountInputVal}
              onChange={handleDiscountInputChange}
              placeholder="0"
              className="w-full bg-surface-dim border border-outline-variant/75 rounded-xl px-3.5 py-2 pl-10 pr-9 text-on-surface font-mono font-bold text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
            />
            {discount > 0 && (
              <button
                type="button"
                onClick={handleClearDiscount}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-error transition-colors cursor-pointer p-0.5"
                title="Hapus diskon"
              >
                <X size={16} className="stroke-[2.5]" />
              </button>
            )}
          </div>

          {/* Quick discount preset buttons */}
          <div className="grid grid-cols-5 gap-2">
            <button
              type="button"
              onClick={() => handleApplyPresetNominal(2000)}
              className="bg-surface-container-high hover:bg-primary-container hover:text-on-primary-container border border-outline-variant/60 text-on-surface rounded-xl py-1.5 cursor-pointer transition-all active:scale-95 text-xs font-bold text-center"
            >
              2k
            </button>
            <button
              type="button"
              onClick={() => handleApplyPresetNominal(5000)}
              className="bg-surface-container-high hover:bg-primary-container hover:text-on-primary-container border border-outline-variant/60 text-on-surface rounded-xl py-1.5 cursor-pointer transition-all active:scale-95 text-xs font-bold text-center"
            >
              5k
            </button>
            <button
              type="button"
              onClick={() => handleApplyPresetNominal(10000)}
              className="bg-surface-container-high hover:bg-primary-container hover:text-on-primary-container border border-outline-variant/60 text-on-surface rounded-xl py-1.5 cursor-pointer transition-all active:scale-95 text-xs font-bold text-center"
            >
              10k
            </button>
            <button
              type="button"
              onClick={() => handleApplyPresetPercent(5)}
              className="bg-surface-container-high hover:bg-primary-container hover:text-on-primary-container border border-outline-variant/60 text-on-surface rounded-xl py-1.5 cursor-pointer transition-all active:scale-95 text-xs font-bold text-center"
            >
              5%
            </button>
            <button
              type="button"
              onClick={() => handleApplyPresetPercent(10)}
              className="bg-surface-container-high hover:bg-primary-container hover:text-on-primary-container border border-outline-variant/60 text-on-surface rounded-xl py-1.5 cursor-pointer transition-all active:scale-95 text-xs font-bold text-center"
            >
              10%
            </button>
          </div>

          {/* Database Global Discounts */}
          {activeDiscounts && activeDiscounts.filter(d => d.discount_type === 'global' && d.is_active).length > 0 && (
            <div className="flex flex-col gap-1.5 mt-1.5 border-t border-outline-variant/20 pt-3 shrink-0">
              <span className="text-[10px] text-on-surface-variant font-extrabold uppercase tracking-wider">
                Promo Toko Aktif:
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                {activeDiscounts
                  .filter(d => d.discount_type === 'global' && d.is_active)
                  .map(d => {
                    const meetsMin = warungTotal >= Number(d.min_purchase_amount);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        disabled={!meetsMin}
                        onClick={() => {
                          let amt = 0;
                          if (d.value_type === 'percentage') {
                            amt = Math.round(warungTotal * (Number(d.discount_value) / 100));
                          } else {
                            amt = Number(d.discount_value);
                          }
                          onDiscountChange(Math.min(warungTotal, amt));
                        }}
                        className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer border ${
                          meetsMin
                            ? 'bg-primary-container/40 hover:bg-primary hover:text-white border-primary/20 text-on-primary-container'
                            : 'bg-surface-container border-outline-variant/40 opacity-40 cursor-not-allowed text-on-surface-variant/70'
                        }`}
                        title={d.name + (d.min_purchase_amount > 0 ? ` (Min. Beli Rp ${d.min_purchase_amount.toLocaleString('id-ID')})` : '')}
                      >
                        🏷️ {d.name} ({d.value_type === 'percentage' ? `${d.discount_value}%` : `Rp ${Number(d.discount_value).toLocaleString('id-ID')}`})
                      </button>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* ── Payment Method ───────────────────────────────────────────────── */}
        <div className="bg-surface-container border border-outline-variant/50 p-4 rounded-2xl flex flex-col gap-3 shadow-sm">
          <div className="text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider font-extrabold text-[10px] leading-none">Metode Pembayaran</div>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => setMethod('CASH')}
              className={`border-2 rounded-xl p-3 flex flex-col items-center justify-center gap-1 transition-all relative overflow-hidden font-label-md text-label-md font-bold cursor-pointer ${
                method === 'CASH'
                  ? 'bg-secondary-container/50 border-primary text-primary shadow-md'
                  : 'bg-surface-dim border-outline-variant/50 text-on-surface-variant hover:bg-surface-container-high hover:border-outline'
              }`}
            >
              <Banknote size={18} className="stroke-[2.2]" />
              CASH
              <span className="absolute top-1 right-1 bg-surface-container-lowest/70 border border-outline-variant/30 rounded-md px-1.5 py-0.5 text-[8px] font-mono leading-none">1</span>
            </button>
            <button
              onClick={() => setMethod('QRIS')}
              className={`border-2 rounded-xl p-3 flex flex-col items-center justify-center gap-1 transition-all relative font-label-md text-label-md font-bold cursor-pointer ${
                method === 'QRIS'
                  ? 'bg-primary-container/50 border-primary text-primary shadow-md'
                  : 'bg-surface-dim border-outline-variant/50 text-on-surface-variant hover:bg-surface-container-high hover:border-outline'
              }`}
            >
              <QrCode size={18} className="stroke-[2.2]" />
              QRIS
              <span className="absolute top-1 right-1 bg-surface-container-lowest/70 border border-outline-variant/30 rounded-md px-1.5 py-0.5 text-[8px] font-mono leading-none">2</span>
            </button>
            <button
              onClick={() => setMethod('SPLIT')}
              className={`border-2 rounded-xl p-3 flex flex-col items-center justify-center gap-1 transition-all relative font-label-md text-label-md font-bold cursor-pointer ${
                method === 'SPLIT'
                  ? 'bg-tertiary-container/50 border-tertiary text-on-tertiary-container shadow-md'
                  : 'bg-surface-dim border-outline-variant/50 text-on-surface-variant hover:bg-surface-container-high hover:border-outline'
              }`}
            >
              <Coins size={18} className="stroke-[2.2]" />
              SPLIT
              <span className="absolute top-1 right-1 bg-surface-container-lowest/70 border border-outline-variant/30 rounded-md px-1.5 py-0.5 text-[8px] font-mono leading-none">3</span>
            </button>
            <button
              onClick={() => setMethod('DEBT')}
              className={`border-2 rounded-xl p-3 flex flex-col items-center justify-center gap-1 transition-all relative font-label-md text-label-md font-bold cursor-pointer ${
                method === 'DEBT'
                  ? 'bg-amber-950/20 border-amber-600 text-amber-500 shadow-md'
                  : 'bg-surface-dim border-outline-variant/50 text-on-surface-variant hover:bg-surface-container-high hover:border-outline'
              }`}
            >
              <User size={18} className="stroke-[2.2]" />
              BON / HUTANG
              <span className="absolute top-1 right-1 bg-surface-container-lowest/70 border border-outline-variant/30 rounded-md px-1.5 py-0.5 text-[8px] font-mono leading-none">4</span>
            </button>
          </div>
        </div>

        {/* ── Cash Input (only when CASH method selected) ──────────────────── */}
        {method === 'CASH' && (
          <div className="bg-surface-container border border-outline-variant/50 p-4 rounded-2xl flex flex-col gap-3 shadow-sm">
            <div className="flex justify-between items-center">
              <span className="text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider font-extrabold text-[10px] leading-none">Uang Diterima</span>
            </div>

            {/* Custom/Manual input field - always visible */}
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant font-label-md text-label-md font-bold">Rp</span>
              <input
                type="text"
                data-received-input="true"
                value={received ? received.toLocaleString('id-ID') : ''}
                onChange={e => {
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  setReceived(Number(raw) || 0);
                }}
                placeholder="Ketik nominal diterima..."
                className="w-full bg-surface-dim border border-outline-variant rounded-xl p-3 pl-10 text-on-surface font-mono font-bold text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
              />
            </div>

            {/* Quick cash presets */}
            <div className="grid grid-cols-3 gap-2">
              {presets.map(amount => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setReceived(amount)}
                  className={`rounded-xl py-2 font-label-md text-label-md transition-all border text-center cursor-pointer font-bold ${
                    received === amount
                      ? 'bg-primary text-white border-primary shadow-sm font-extrabold'
                      : 'bg-surface-container-high hover:bg-surface-container-highest border-outline-variant/60 text-on-surface'
                  }`}
                >
                  {amount === grandTotal
                    ? 'Uang Pas'
                    : amount >= 1_000_000
                    ? `${amount / 1_000_000}jt`
                    : `${amount / 1_000}k`}
                </button>
              ))}
            </div>

            {/* Received / Change display */}
            <div className="flex flex-col gap-2 border-t border-outline-variant/20 pt-3">
              <div className="bg-surface-dim/80 border border-outline-variant/50 rounded-xl p-2.5 flex justify-between items-center">
                <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">Jumlah Diterima</span>
                <span className={`font-mono text-sm font-bold ${received > 0 ? 'text-on-surface' : 'text-on-surface-variant/40'}`}>
                  {received > 0 ? `Rp ${received.toLocaleString('id-ID')}` : '—'}
                </span>
              </div>
              <div className="bg-surface-dim/80 border border-outline-variant/50 rounded-xl p-2.5 flex justify-between items-center">
                <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">Uang Kembalian</span>
                <span className={`font-mono text-lg font-black ${
                  change > 0 ? 'text-emerald-500' : change < 0 ? 'text-error' : 'text-on-surface-variant/40'
                }`}>
                  {received > 0 ? `Rp ${Math.max(0, change).toLocaleString('id-ID')}` : '—'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Split Input */}
        {method === 'SPLIT' && (
          <div className="bg-surface-container border border-outline-variant/50 p-4 rounded-2xl flex flex-col gap-3.5 animate-in fade-in slide-in-from-top-2 duration-150">
            <span className="text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider font-extrabold text-[10px] leading-none">Split (Cash + QRIS)</span>
            
            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-label-sm text-on-surface-variant font-semibold">Nominal Tunai (Cash)</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant font-label-md text-label-md font-bold">Rp</span>
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
                  placeholder="Nominal tunai..."
                  className="w-full bg-surface-dim border border-outline-variant rounded-xl p-3 pl-10 text-on-surface font-mono font-bold text-sm focus:border-tertiary focus:ring-1 focus:ring-tertiary outline-none transition-colors"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-label-sm text-on-surface-variant font-semibold">Sisa Nominal QRIS</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/50 font-label-md text-label-md font-bold">Rp</span>
                <input
                  type="text"
                  value={splitQrisAmount ? splitQrisAmount.toLocaleString('id-ID') : ''}
                  readOnly
                  placeholder="Sisa otomatis..."
                  className="w-full bg-surface-container-low border border-outline-variant/60 rounded-xl p-3 pl-10 text-on-surface/50 font-mono font-bold text-sm outline-none cursor-not-allowed"
                />
              </div>
            </div>

            <div className="bg-primary-container/20 border border-primary/20 rounded-xl p-3 text-center text-primary font-body-sm text-body-sm leading-relaxed font-medium">
              Bayar Tunai <span className="font-bold font-mono">Rp {splitCashAmount.toLocaleString('id-ID')}</span> & QRIS <span className="font-bold font-mono">Rp {splitQrisAmount.toLocaleString('id-ID')}</span>.
            </div>
          </div>
        )}

        {/* Debt Input (only when DEBT method selected) */}
        {method === 'DEBT' && (
          <div className="bg-surface-container border border-outline-variant/50 p-4 rounded-2xl flex flex-col gap-3.5 animate-in fade-in slide-in-from-top-2 duration-150">
            <span className="text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider font-extrabold text-[10px] leading-none">Pilih Pelanggan (Bon)</span>

            {selectedCustomer ? (
              <div className="flex justify-between items-center bg-surface-dim border border-outline-variant rounded-xl p-3 shadow-inner">
                <div className="flex flex-col text-left">
                  <span className="font-bold text-on-surface text-sm">{selectedCustomer.name}</span>
                  <span className="text-[10px] text-on-surface-variant/80 font-mono mt-1 leading-none">
                    Limit: Rp {Number(selectedCustomer.credit_limit).toLocaleString('id-ID')} | Sisa: Rp {remainingLimit.toLocaleString('id-ID')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="p-1 hover:bg-surface-container-high rounded-lg text-on-surface-variant transition-colors cursor-pointer"
                >
                  <X size={16} className="stroke-[2.5]" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  id="customer-search-input"
                  type="text"
                  placeholder="Cari nama pelanggan..."
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && customerSearchDone && customerSuggestions.length === 0 && customerSearch.trim().length >= 2) {
                      e.preventDefault();
                      setQuickAddName(customerSearch.trim());
                      setCustomerSuggestions([]);
                    }
                  }}
                  className="w-full bg-surface-dim border border-outline-variant rounded-xl p-3 pl-10 text-on-surface font-label-md text-label-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors"
                />
                <Search size={18} className="absolute left-3.5 top-3.5 text-on-surface-variant/60" />

                {customerSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 bg-surface-container border border-outline-variant/65 rounded-xl shadow-xl mt-1.5 py-1.5 max-h-48 overflow-y-auto backdrop-blur-md">
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
                          className="flex justify-between items-center px-4 py-2.5 cursor-pointer hover:bg-surface-container-high/60 font-label-md text-label-md transition-colors"
                        >
                          <div className="flex flex-col text-left">
                            <span className="font-bold text-on-surface">{c.name}</span>
                            <span className="text-[10px] opacity-60 font-mono mt-0.5">{c.phone || '-'}</span>
                          </div>
                          <span className="text-right font-bold text-xs text-primary font-mono">Limit: Rp {remaining.toLocaleString('id-ID')}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Empty search result → show Quick Add button */}
                {customerSearchDone && customerSuggestions.length === 0 && customerSearch.trim().length >= 2 && (
                  <div className="absolute top-full left-0 right-0 z-50 bg-surface-container border border-outline-variant rounded-xl shadow-xl mt-1.5 py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setQuickAddName(customerSearch.trim());
                        setCustomerSuggestions([]);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-secondary-container/40 font-label-md text-label-md transition-colors cursor-pointer"
                    >
                      <UserPlus size={16} className="text-secondary shrink-0" />
                      <span className="text-sm font-medium">
                        Tambah Pelanggan: <span className="font-bold text-secondary">&ldquo;{customerSearch.trim()}&rdquo;</span>
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {selectedCustomer && (
              <>
                <div className="flex flex-col gap-1.5 mt-2">
                  <label className="font-label-sm text-label-sm text-on-surface-variant flex justify-between font-semibold text-[10px] uppercase">
                    <span>Uang Muka / DP Tunai (Opsional)</span>
                    {received > 0 && <span className="font-bold text-secondary font-mono">Sisa Bon: Rp {(grandTotal - received).toLocaleString('id-ID')}</span>}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant font-label-md text-label-md font-bold">Rp</span>
                    <input
                      type="text"
                      value={received ? received.toLocaleString('id-ID') : ''}
                      onChange={e => {
                        const raw = e.target.value.replace(/[^0-9]/g, '');
                        const val = Number(raw) || 0;
                        setReceived(Math.min(grandTotal, val));
                      }}
                      placeholder="Nominal DP..."
                      className="w-full bg-surface-dim border border-outline-variant rounded-xl p-3 pl-10 text-on-surface font-mono font-bold text-sm focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors"
                    />
                  </div>
                </div>

                {!isLimitOk ? (
                  <div className="bg-error-container/30 border border-error/20 rounded-xl p-3 text-center text-error font-body-sm text-body-sm leading-relaxed font-bold shadow-sm">
                    ⚠️ Sisa limit kredit bon tidak mencukupi!
                  </div>
                ) : (
                  <div className="bg-secondary-container/20 border border-secondary/20 rounded-xl p-3 text-center text-secondary font-body-sm text-body-sm leading-relaxed font-medium">
                    {received > 0 ? (
                      <span>
                        DP tunai <span className="font-bold font-mono">Rp {received.toLocaleString('id-ID')}</span>. Sisa <span className="font-bold font-mono text-primary">Rp {(grandTotal - received).toLocaleString('id-ID')}</span> masuk ke bon/hutang.
                      </span>
                    ) : (
                      <span>Seluruh <span className="font-bold font-mono text-primary">Rp {grandTotal.toLocaleString('id-ID')}</span> masuk ke bon/hutang.</span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

      </div>

      {/* ── Pay Button ─────────────────────────────────────────────────────── */}
      <div className="mt-auto pt-2 shrink-0">
        {/* Insufficient cash warning */}
        {method === 'CASH' && received > 0 && received < grandTotal && grandTotal > 0 && (
          <div className="mb-2.5 text-center font-label-sm text-label-sm text-error font-extrabold animate-pulse uppercase tracking-wider text-[10px]">
            ⚠️ Kurang Rp {(grandTotal - received).toLocaleString('id-ID')}
          </div>
        )}
        <button
          id="btn-pay"
          onClick={handlePay}
          disabled={!canPay}
          className="w-full bg-primary hover:bg-primary-hover text-white font-headline-md text-base rounded-2xl py-4 flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg shadow-primary/20 hover:shadow-xl cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <MonitorSmartphone size={20} className="stroke-[2.2]" />
          <span className="font-bold tracking-wide">
            {paying 
              ? 'MEMPROSES...' 
              : method === 'QRIS' 
              ? 'BAYAR QRIS [ENTER]' 
              : method === 'SPLIT' 
              ? 'BAYAR SPLIT [ENTER]' 
              : method === 'DEBT' 
              ? 'PROSES BON HUTANG [ENTER]' 
              : 'PROSES BAYAR [ENTER]'}
          </span>
        </button>
      </div>

      {quickAddName && (
        <QuickAddCustomerModal
          initialName={quickAddName}
          onSaved={handleQuickAddCustomerSaved}
          onClose={() => setQuickAddName(null)}
        />
      )}
    </section>
  );
}

