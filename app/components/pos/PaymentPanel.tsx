"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  const [qrisReceived, setQrisReceived] = useState(0);
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
  const presets  = useMemo(() => quickCashOptions(grandTotal), [grandTotal]);

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
        setQrisReceived(0);
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
    } else if (method === 'QRIS') {
      const finalQrisVal = qrisReceived > 0 ? qrisReceived : grandTotal;
      onPay(method, finalQrisVal);
    } else {
      onPay(method, received);
    }
    setReceived(0);
    setQrisReceived(0);
    setSplitCashAmount(0);
    setSplitQrisAmount(0);
    setSelectedCustomer(null);
  }, [canPay, method, received, qrisReceived, grandTotal, splitCashAmount, splitQrisAmount, onPay, selectedCustomer]);

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
    const onExactCash = () => {
      if (grandTotal <= 0 || paying) return;
      setMethod('CASH');
      setReceived(grandTotal);
      onPay('CASH', grandTotal);
    };
    const onSelectCustomer = () => {
      setMethod('DEBT');
      setTimeout(() => {
        const inp = document.getElementById('customer-search-input') as HTMLInputElement;
        inp?.focus();
        inp?.select();
      }, 50);
    };

    window.addEventListener('hotkey-pay-cash', onSelectCash);
    window.addEventListener('hotkey-pay-qris', onSelectQris);
    window.addEventListener('hotkey-pay-split', onSelectSplit);
    window.addEventListener('hotkey-pay-debt', onSelectDebt);
    window.addEventListener('hotkey-focus-payment', onFocusPayment);
    window.addEventListener('hotkey-trigger-pay', onTriggerPay);
    window.addEventListener('hotkey-pay-exact-cash', onExactCash);
    window.addEventListener('hotkey-select-customer', onSelectCustomer);

    return () => {
      window.removeEventListener('hotkey-pay-cash', onSelectCash);
      window.removeEventListener('hotkey-pay-qris', onSelectQris);
      window.removeEventListener('hotkey-pay-split', onSelectSplit);
      window.removeEventListener('hotkey-pay-debt', onSelectDebt);
      window.removeEventListener('hotkey-focus-payment', onFocusPayment);
      window.removeEventListener('hotkey-trigger-pay', onTriggerPay);
      window.removeEventListener('hotkey-pay-exact-cash', onExactCash);
      window.removeEventListener('hotkey-select-customer', onSelectCustomer);
    };
  }, [method, canPay, handlePay, grandTotal, paying, onPay]);

  return (
    <aside id="payment-panel-sidebar" aria-label="Panel Pembayaran dan Kasir" className="w-96 shrink-0 flex flex-col h-full overflow-hidden border border-outline-variant/50 bg-surface-container-low p-3 justify-between rounded-2xl shadow-md transition-all duration-200">
      <div id="payment-panel-container" className="flex-1 flex flex-col gap-2.5 overflow-y-auto pr-0.5 no-scrollbar">

        {/* ── Totals Card ─────────────────────────────────────────────────── */}
        <section id="payment-totals-card" aria-label="Ringkasan Total Harga" className="bg-surface-container border border-outline-variant rounded-xl p-2.5 flex flex-col gap-1 shadow-sm shrink-0">
          {warungTotal > 0 && (
            <div className="flex justify-between items-center text-on-surface-variant text-xs border-b border-outline-variant/30 pb-1">
              <span>Total Warung</span>
              <span className="font-mono font-semibold text-on-surface">Rp {warungTotal.toLocaleString('id-ID')}</span>
            </div>
          )}
          {agentTotal > 0 && (
            <div className="flex justify-between items-center text-on-surface-variant text-xs border-b border-outline-variant/30 pb-1">
              <span>Layanan Agen</span>
              <span className="font-mono font-semibold text-on-surface">Rp {agentTotal.toLocaleString('id-ID')}</span>
            </div>
          )}
          {agentFee > 0 && (
            <div className="flex justify-between items-center text-on-surface-variant text-xs border-b border-outline-variant/30 pb-1">
              <span>Admin Agen</span>
              <span className="font-mono font-semibold text-on-surface">Rp {agentFee.toLocaleString('id-ID')}</span>
            </div>
          )}
          {discount > 0 && (
            <div className="flex justify-between items-center text-xs border-b border-outline-variant/30 pb-1">
              <span className="text-error font-medium">Diskon</span>
              <span className="font-mono font-semibold text-error">- Rp {discount.toLocaleString('id-ID')}</span>
            </div>
          )}
          <div className="pt-0.5 flex justify-between items-center">
            <span className="text-xs text-on-surface-variant font-semibold tracking-wide uppercase">Grand Total</span>
            <output id="grand-total-output" aria-live="polite" className="font-mono text-2xl text-primary font-bold tracking-tight">
              {grandTotal > 0 ? `Rp ${grandTotal.toLocaleString('id-ID')}` : 'Rp 0'}
            </output>
          </div>
        </section>

        {/* ── Discount Panel ───────────────────────────────────────────────── */}
        <div className="bg-surface-container border border-outline-variant p-2.5 rounded-xl flex flex-col gap-1.5 shadow-sm shrink-0">
          <div className="text-xs font-semibold text-on-surface-variant flex justify-between items-center">
            <span>Diskon / Potongan</span>
            {discount > 0 && (
              <span className="text-[10px] text-error font-medium bg-error/10 px-1.5 py-0.5 rounded">
                Potongan Aktif
              </span>
            )}
          </div>
          
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-xs font-medium">Rp</span>
            <input
              id="input-discount"
              type="text"
              value={discountInputVal}
              onChange={handleDiscountInputChange}
              placeholder="0"
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-1 pl-8 pr-7 text-on-surface font-mono font-semibold text-xs focus:border-primary focus:outline-none transition-colors"
            />
            {discount > 0 && (
              <button
                type="button"
                onClick={handleClearDiscount}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-error transition-colors cursor-pointer"
                title="Hapus diskon"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Quick discount preset buttons */}
          <div className="grid grid-cols-5 gap-1">
            <button
              type="button"
              onClick={() => handleApplyPresetNominal(2000)}
              className="bg-surface-container-low hover:bg-surface-container-high border border-outline-variant text-on-surface rounded py-0.5 cursor-pointer text-[10px] font-medium text-center"
            >
              2k
            </button>
            <button
              type="button"
              onClick={() => handleApplyPresetNominal(5000)}
              className="bg-surface-container-low hover:bg-surface-container-high border border-outline-variant text-on-surface rounded py-0.5 cursor-pointer text-[10px] font-medium text-center"
            >
              5k
            </button>
            <button
              type="button"
              onClick={() => handleApplyPresetNominal(10000)}
              className="bg-surface-container-low hover:bg-surface-container-high border border-outline-variant text-on-surface rounded py-0.5 cursor-pointer text-[10px] font-medium text-center"
            >
              10k
            </button>
            <button
              type="button"
              onClick={() => handleApplyPresetPercent(5)}
              className="bg-surface-container-low hover:bg-surface-container-high border border-outline-variant text-on-surface rounded py-0.5 cursor-pointer text-[10px] font-medium text-center"
            >
              5%
            </button>
            <button
              type="button"
              onClick={() => handleApplyPresetPercent(10)}
              className="bg-surface-container-low hover:bg-surface-container-high border border-outline-variant text-on-surface rounded py-0.5 cursor-pointer text-[10px] font-medium text-center"
            >
              10%
            </button>
          </div>

          {/* Active Promo Pills */}
          {activeDiscounts && activeDiscounts.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5 max-h-12 overflow-hidden">
              {activeDiscounts.slice(0, 3).map((d: any) => {
                const meetsMin = !d.min_purchase_amount || (warungTotal + agentTotal + agentFee) >= Number(d.min_purchase_amount);
                return (
                  <button
                    key={d.id}
                    type="button"
                    disabled={!meetsMin}
                    onClick={() => {
                      if (d.value_type === 'percentage') {
                        handleApplyPresetPercent(Number(d.discount_value));
                      } else {
                        handleApplyPresetNominal(Number(d.discount_value));
                      }
                    }}
                    className={`text-[9px] font-medium px-1.5 py-0.5 rounded border ${
                      meetsMin
                        ? 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 cursor-pointer'
                        : 'bg-surface-container-low border-outline-variant text-on-surface-variant/40 cursor-not-allowed'
                    }`}
                  >
                    🏷️ {d.name} ({d.value_type === 'percentage' ? `${d.discount_value}%` : `Rp ${Number(d.discount_value).toLocaleString('id-ID')}`})
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Payment Method ───────────────────────────────────────────────── */}
        <div className="bg-surface-container border border-outline-variant p-2.5 rounded-xl flex flex-col gap-1.5 shadow-sm shrink-0">
          <div className="text-xs font-semibold text-on-surface-variant">Metode Pembayaran</div>
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() => setMethod('CASH')}
              className={`border rounded-lg py-1.5 px-2 flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
                method === 'CASH'
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-surface-container-low border-outline-variant text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              <Banknote size={14} />
              CASH
            </button>
            <button
              onClick={() => setMethod('QRIS')}
              className={`border rounded-lg py-1.5 px-2 flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
                method === 'QRIS'
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-surface-container-low border-outline-variant text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              <QrCode size={14} />
              QRIS
            </button>
            <button
              onClick={() => setMethod('SPLIT')}
              className={`border rounded-lg py-1.5 px-2 flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
                method === 'SPLIT'
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-surface-container-low border-outline-variant text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              <Coins size={14} />
              SPLIT
            </button>
            <button
              onClick={() => setMethod('DEBT')}
              className={`border rounded-lg py-1.5 px-2 flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
                method === 'DEBT'
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-surface-container-low border-outline-variant text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              <User size={14} />
              BON / HUTANG
            </button>
          </div>
        </div>

        {/* ── QRIS Input & Overpayment (Kembalian Tunai) ──────────────────── */}
        {method === 'QRIS' && (
          <div className="bg-surface-container border border-outline-variant p-2.5 rounded-xl flex flex-col gap-2 shadow-sm shrink-0">
            <div className="flex justify-between items-center text-xs font-semibold text-on-surface-variant">
              <span>Nominal QRIS Di-scan</span>
              <span className="text-[10px] text-primary font-mono bg-primary/10 px-1.5 py-0.5 rounded font-semibold">
                Lebih Bayar / Kembalian
              </span>
            </div>

            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-xs font-medium">Rp</span>
              <input
                id="input-qris-received"
                type="text"
                data-received-input="true"
                value={qrisReceived ? qrisReceived.toLocaleString('id-ID') : ''}
                onChange={e => {
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  setQrisReceived(Number(raw) || 0);
                }}
                placeholder={grandTotal.toLocaleString('id-ID')}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-1 pl-8 pr-3 text-on-surface font-mono font-bold text-xs focus:border-primary focus:outline-none transition-colors"
              />
            </div>

            {/* Quick QRIS Presets */}
            <div className="grid grid-cols-4 gap-1">
              <button
                type="button"
                onClick={() => setQrisReceived(grandTotal)}
                className="bg-surface-container-low hover:bg-surface-container-high border border-outline-variant text-on-surface rounded py-1 cursor-pointer text-[10px] font-bold text-center"
              >
                Pas
              </button>
              <button
                type="button"
                onClick={() => {
                  const base = qrisReceived > 0 ? qrisReceived : grandTotal;
                  setQrisReceived(base + 2000);
                }}
                className="bg-surface-container-low hover:bg-surface-container-high border border-outline-variant text-on-surface rounded py-1 cursor-pointer text-[10px] font-medium text-center"
              >
                +2k
              </button>
              <button
                type="button"
                onClick={() => {
                  const base = qrisReceived > 0 ? qrisReceived : grandTotal;
                  setQrisReceived(base + 5000);
                }}
                className="bg-surface-container-low hover:bg-surface-container-high border border-outline-variant text-on-surface rounded py-1 cursor-pointer text-[10px] font-medium text-center"
              >
                +5k
              </button>
              <button
                type="button"
                onClick={() => {
                  const base = qrisReceived > 0 ? qrisReceived : grandTotal;
                  setQrisReceived(base + 10000);
                }}
                className="bg-surface-container-low hover:bg-surface-container-high border border-outline-variant text-on-surface rounded py-1 cursor-pointer text-[10px] font-medium text-center"
              >
                +10k
              </button>
            </div>

            {/* Highlight Cash Change if qrisReceived > grandTotal */}
            {qrisReceived > grandTotal && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2 flex flex-col gap-0.5 animate-in fade-in duration-150">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                    💵 Kembalian Tunai:
                  </span>
                  <span className="font-mono text-sm font-extrabold text-emerald-600 dark:text-emerald-300">
                    Rp {(qrisReceived - grandTotal).toLocaleString('id-ID')}
                  </span>
                </div>
                <span className="text-[10px] text-emerald-800/80 dark:text-emerald-300/80 font-medium">
                  Serahkan Rp {(qrisReceived - grandTotal).toLocaleString('id-ID')} uang tunai dari laci kasir ke pelanggan.
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Cash Input (only when CASH method selected) ──────────────────── */}
        {method === 'CASH' && (
          <div className="bg-surface-container border border-outline-variant p-2.5 rounded-xl flex flex-col gap-1.5 shadow-sm shrink-0">
            <div className="text-xs font-semibold text-on-surface-variant">Uang Diterima</div>

            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-xs font-medium">Rp</span>
              <input
                type="text"
                data-received-input="true"
                value={received ? received.toLocaleString('id-ID') : ''}
                onChange={e => {
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  setReceived(Number(raw) || 0);
                }}
                placeholder="0"
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-1 pl-8 pr-3 text-on-surface font-mono font-bold text-xs focus:border-primary focus:outline-none transition-colors"
              />
            </div>

            {/* Quick cash presets */}
            <div className="grid grid-cols-3 gap-1">
              {presets.map(amount => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setReceived(amount)}
                  className={`rounded-md py-1 text-[11px] font-semibold transition-colors border text-center cursor-pointer ${
                    received === amount
                      ? 'bg-primary text-white border-primary'
                      : 'bg-surface-container-low hover:bg-surface-container-high border-outline-variant text-on-surface'
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

            {/* Kembalian Display */}
            <div className="flex justify-between items-center bg-surface-container-low border border-outline-variant rounded-lg px-2 py-1 mt-0.5">
              <span className="text-xs text-on-surface-variant font-medium">Kembalian</span>
              <span className={`font-mono text-sm font-bold ${
                change > 0 ? 'text-emerald-600 dark:text-emerald-400' : change < 0 ? 'text-error' : 'text-on-surface-variant/50'
              }`}>
                {received > 0 ? `Rp ${Math.max(0, change).toLocaleString('id-ID')}` : '—'}
              </span>
            </div>
          </div>
        )}

        {/* Split Input */}
        {method === 'SPLIT' && (
          <div className="bg-surface-container border border-outline-variant p-2.5 rounded-xl flex flex-col gap-1.5 shadow-sm shrink-0">
            <span className="text-xs font-semibold text-on-surface-variant">Split (Cash + QRIS)</span>
            
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] text-on-surface-variant font-medium">Nominal Tunai (Cash)</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-xs font-medium">Rp</span>
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
                  placeholder="0"
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-1 pl-8 pr-3 text-on-surface font-mono font-bold text-xs focus:border-primary focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="flex justify-between items-center bg-surface-container-low border border-outline-variant rounded-lg p-1.5 text-xs">
              <span className="text-on-surface-variant">Sisa QRIS:</span>
              <span className="font-mono font-bold text-primary">Rp {splitQrisAmount.toLocaleString('id-ID')}</span>
            </div>
          </div>
        )}

        {/* Debt Input */}
        {method === 'DEBT' && (
          <div className="bg-surface-container border border-outline-variant p-2.5 rounded-xl flex flex-col gap-1.5 shadow-sm shrink-0">
            <span className="text-xs font-semibold text-on-surface-variant">Pilih Pelanggan (Bon)</span>

            {selectedCustomer ? (
              <div className="flex justify-between items-center bg-surface-container-low border border-outline-variant rounded-lg p-1.5">
                <div className="flex flex-col">
                  <span className="font-semibold text-on-surface text-xs">{selectedCustomer.name}</span>
                  <span className="text-[10px] text-on-surface-variant font-mono">
                    Sisa Limit: Rp {remainingLimit.toLocaleString('id-ID')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="p-1 hover:bg-surface-container-high rounded text-on-surface-variant transition-colors cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  id="customer-search-input"
                  type="text"
                  placeholder="Cari pelanggan..."
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && customerSearchDone && customerSuggestions.length === 0 && customerSearch.trim().length >= 2) {
                      e.preventDefault();
                      setQuickAddName(customerSearch.trim());
                      setCustomerSuggestions([]);
                    }
                  }}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-1 pl-8 pr-3 text-on-surface text-xs focus:border-primary focus:outline-none transition-colors"
                />
                <Search size={13} className="absolute left-2.5 top-2 text-on-surface-variant" />

                {customerSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 bg-surface-container border border-outline-variant rounded-lg shadow-xl mt-1 py-1 max-h-36 overflow-y-auto">
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
                          className="flex justify-between items-center px-2.5 py-1.5 cursor-pointer hover:bg-surface-container-high text-xs transition-colors"
                        >
                          <div className="flex flex-col">
                            <span className="font-semibold text-on-surface">{c.name}</span>
                            <span className="text-[10px] text-on-surface-variant font-mono">{c.phone || '-'}</span>
                          </div>
                          <span className="font-mono text-[10px] text-primary">Limit: Rp {remaining.toLocaleString('id-ID')}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── Fixed Pay Button at Bottom (Zero Scroll guaranteed) ──────────────── */}
      <div className="shrink-0 pt-1">
        {method === 'CASH' && received > 0 && received < grandTotal && grandTotal > 0 && (
          <div className="mb-0.5 text-center text-xs text-error font-semibold animate-pulse">
            ⚠️ Kurang Rp {(grandTotal - received).toLocaleString('id-ID')}
          </div>
        )}
        <button
          id="btn-pay"
          onClick={handlePay}
          disabled={!canPay}
          className="w-full bg-primary hover:bg-primary/90 text-white font-bold text-sm rounded-xl py-2.5 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
        >
          <MonitorSmartphone size={16} />
          <span>
            {paying 
              ? 'Memproses...' 
              : method === 'QRIS' 
              ? 'Bayar QRIS [Enter]' 
              : method === 'SPLIT' 
              ? 'Bayar Split [Enter]' 
              : method === 'DEBT' 
              ? 'Proses Bon Hutang [Enter]' 
              : 'Proses Bayar [Enter]'}
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
    </aside>
  );
}

