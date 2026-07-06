"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import AppShell from '@/components/Layout/AppShell';
import CartTable from '@/components/pos/CartTable';
import PaymentPanel from '@/components/pos/PaymentPanel';
import AgentWorkspace from '@/components/pos/AgentWorkspace';
import AdminWorkspace from '@/components/pos/AdminWorkspace';
import { useGlobalHotkeys } from '@/lib/keyboard/useGlobalHotkeys';
import { printReceipt, type WarungReceiptData } from '@/lib/print/receipt';
import type { CartItem } from '@/types/pos';
import QrisPaymentModal from '@/components/pos/QrisPaymentModal';
import CashSessionModal from '@/components/pos/CashSessionModal';
import AIAssistant from '@/components/pos/AIAssistant';

function getTierPrice(qty: number, basePrice: number, tiers?: { min_qty: number; tier_price: number; name: string }[]) {
  if (!tiers || tiers.length === 0) return { price: basePrice, name: undefined };
  let activePrice = basePrice;
  let activeName: string | undefined = undefined;
  let maxMinQty = -1;
  for (const t of tiers) {
    const minQty = Number(t.min_qty);
    if (qty >= minQty && minQty > maxMinQty) {
      maxMinQty = minQty;
      activePrice = Number(t.tier_price);
      activeName = t.name;
    }
  }
  return { price: activePrice, name: activeName };
}

export default function PosDashboard() {
  const [mode, setMode]     = useState<'warung' | 'agent' | 'admin'>('warung');
  const [cart, setCart]     = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [activeDiscounts, setActiveDiscounts] = useState<any[]>([]);

  const fetchActiveDiscounts = useCallback(async () => {
    try {
      const res = await fetch('/api/discounts?active=true');
      if (res.ok) {
        const data = await res.json();
        setActiveDiscounts(data.items || []);
      }
    } catch (err) {
      console.error('Error fetching active discounts:', err);
    }
  }, []);

  useEffect(() => {
    if (mode === 'warung') {
      fetchActiveDiscounts();
    }
  }, [mode, fetchActiveDiscounts]);

  // Reset discount when cart is empty
  useEffect(() => {
    if (cart.length === 0) {
      setDiscount(0);
    }
  }, [cart.length]);

  const [toast, setToast]   = useState<{ msg: string; type: 'error' | 'success' } | null>(null);
  const [paying, setPaying] = useState(false);
  const [userRole, setUserRole] = useState<string>('');
  const [scannedBarcode, setScannedBarcode] = useState<{ code: string; timestamp: number } | null>(null);
  const [pendingQrisSale, setPendingQrisSale] = useState<{
    id: string;
    transaction_code: string;
    total_amount: number;
    original_amount: number;
    discount?: number;
    split_cash_amount?: number;
    split_qris_amount?: number;
    items: { name: string; qty: number; unit_price: number; subtotal: number }[];
  } | null>(null);
  const lastReceiptRef = useRef<WarungReceiptData | null>(null);
  const userNameRef    = useRef<string>('Kasir');

  const [activeSession, setActiveSession] = useState<any>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [showCloseSessionModal, setShowCloseSessionModal] = useState(false);

  const [rebalanceStatus, setRebalanceStatus] = useState<{
    status: 'healthy' | 'warning' | 'critical';
    alerts: string[];
    recommendations: string[];
    current_cash?: number;
    current_float?: number;
    total_liquidity?: number;
  } | null>(null);
  const [showKasDetail, setShowKasDetail] = useState(false);
  const [rebalanceAlertDismissed, setRebalanceAlertDismissed] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);

  const fetchRebalanceStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/rebalance-status');
      if (res.ok) {
        const data = await res.json();
        if (data.active_session) {
          // If status changes from previous status, automatically un-dismiss the banner
          setRebalanceStatus(prev => {
            if (prev?.status !== data.status) {
              setRebalanceAlertDismissed(false);
            }
            return {
              status: data.status,
              alerts: data.alerts,
              recommendations: data.recommendations,
              current_cash: data.current_cash,
              current_float: data.current_float,
              total_liquidity: data.total_liquidity,
            };
          });
        } else {
          setRebalanceStatus(null);
        }
      }
    } catch (err) {
      console.error('Error fetching rebalance status:', err);
    }
  }, []);

  // Fetch current user details on load to get the role
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.role) setUserRole(data.role);
        if (data.username) userNameRef.current = data.username;
        // Check active session
        fetch('/api/cashier-sessions/active')
          .then(res => res.json())
          .then(sData => {
            setActiveSession(sData.session);
            setCheckingSession(false);
            if (sData.session) {
              fetchRebalanceStatus();
            }
          })
          .catch(() => setCheckingSession(false));
      })
      .catch(() => setCheckingSession(false));
  }, [fetchRebalanceStatus]);

  // ── Toast helper ─────────────────────────────────────────────────────────────
  const showToast = useCallback((msg: string, type: 'error' | 'success' = 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ── Mode switch ──────────────────────────────────────────────────────────────
  const handleF1 = useCallback(() => { setMode('warung'); setCart([]); }, []);
  const handleF2 = useCallback(() => { setMode('agent');  setCart([]); }, []);
  const handleF3 = useCallback(() => { 
    if (userRole === 'owner') { 
      setMode('admin'); 
      setCart([]); 
    } else if (mode === 'warung') {
      const discountInput = document.getElementById('input-discount') as HTMLInputElement | null;
      if (discountInput) {
        discountInput.focus();
        discountInput.select();
      }
    }
  }, [userRole, mode]);

  // ── Add digital item to cart ────────────────────────────────────────────────
  const handleAddDigitalItem = useCallback((item: CartItem) => {
    setCart(prev => [...prev, item]);
  }, []);

  // ── Remove item from cart ────────────────────────────────────────────────────
  const handleRemove = useCallback((id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  }, []);

  const handleBulkRemove = useCallback((ids: string[]) => {
    setCart(prev => prev.filter(item => !ids.includes(item.id)));
  }, []);

  // ── Change item quantity ─────────────────────────────────────────────────────
  const handleChangeQty = useCallback((id: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemove(id);
      return;
    }
    setCart(prev =>
      prev.map(item => {
        if (item.id === id) {
          const originalPrice = item.basePrice || item.price;
          const { price: tierPrice, name: tierName } = getTierPrice(newQty, originalPrice, item.pricingTiers);
          
          let finalPrice = tierPrice;
          if (item.activeDiscount) {
            if (item.activeDiscount.value_type === 'percentage') {
              finalPrice = Math.max(0, tierPrice * (1 - Number(item.activeDiscount.discount_value) / 100));
            } else {
              finalPrice = Math.max(0, tierPrice - Number(item.activeDiscount.discount_value));
            }
          }

          return {
            ...item,
            qty: newQty,
            price: Math.round(finalPrice),
            subtotal: newQty * Math.round(finalPrice),
            basePrice: originalPrice,
            appliedTierName: tierName
          };
        }
        return item;
      })
    );
  }, [handleRemove]);

  // ── Barcode scan → product lookup (Warung only) ──────────────────────────────
  const handleScan = useCallback(async (barcode: string) => {
    try {
      const res = await fetch(`/api/products/lookup?barcode=${encodeURIComponent(barcode)}`);
      if (res.status === 404) {
        showToast(`Barcode tidak ditemukan: ${barcode}`, 'error');
        return;
      }
      if (!res.ok) {
        showToast('Gagal membaca produk. Coba lagi.', 'error');
        return;
      }
      const { data } = await res.json();
      setCart(prev => {
        const existing = prev.findIndex(i => i.id === data.id);
        if (existing >= 0) {
          return prev.map((item, idx) => {
            if (idx === existing) {
              const newQty = item.qty + 1;
              const originalPrice = item.basePrice || item.price;
              const { price: tierPrice, name: tierName } = getTierPrice(newQty, originalPrice, item.pricingTiers);
              
              let finalPrice = tierPrice;
              if (item.activeDiscount) {
                if (item.activeDiscount.value_type === 'percentage') {
                  finalPrice = Math.max(0, tierPrice * (1 - Number(item.activeDiscount.discount_value) / 100));
                } else {
                  finalPrice = Math.max(0, tierPrice - Number(item.activeDiscount.discount_value));
                }
              }

              return {
                ...item,
                qty: newQty,
                price: Math.round(finalPrice),
                subtotal: newQty * Math.round(finalPrice),
                basePrice: originalPrice,
                appliedTierName: tierName
              };
            }
            return item;
          });
        }
        const { price: initialPrice, name: tierName } = getTierPrice(1, Number(data.price), data.pricing_tiers);
        
        let finalPrice = initialPrice;
        if (data.active_discount) {
          if (data.active_discount.value_type === 'percentage') {
            finalPrice = Math.max(0, initialPrice * (1 - Number(data.active_discount.discount_value) / 100));
          } else {
            finalPrice = Math.max(0, initialPrice - Number(data.active_discount.discount_value));
          }
        }

        return [
          ...prev,
          {
            id:       data.id,
            barcode:  data.barcode,
            name:     data.name,
            qty:      1,
            price:    Math.round(finalPrice),
            subtotal: Math.round(finalPrice),
            basePrice: Number(data.price),
            appliedTierName: tierName,
            pricingTiers: data.pricing_tiers || [],
            activeDiscount: data.active_discount || undefined
          },
        ];
      });
    } catch {
      showToast('Koneksi bermasalah. Periksa server.', 'error');
    }
  }, [showToast]);

  // ── Barcode scan in Admin Mode ───────────────────────────────────────────────
  const handleAdminScan = useCallback((barcode: string) => {
    setScannedBarcode({ code: barcode, timestamp: Date.now() });
  }, []);

  // ── Warung checkout ──────────────────────────────────────────────────────────
  const handleCheckout = useCallback(async (
    method: 'CASH' | 'QRIS' | 'SPLIT' | 'DEBT',
    received: number,
    splitCash?: number,
    splitQris?: number,
    customerId?: string
  ) => {
    if (cart.length === 0 || paying) return;
    setPaying(true);
    try {
      const total       = cart.reduce((s, i) => s + i.subtotal, 0);
      const finalTotal  = Math.max(0, total - discount);
      const change_given = method === 'CASH' ? Math.max(0, received - finalTotal) : 0;
      const payload = {
        total_amount:     total,
        discount:         discount,
        payment_method:   method,
        payment_received: method === 'SPLIT' ? (splitCash || 0) : received,
        change_given,
        split_cash_amount: method === 'SPLIT' ? splitCash : undefined,
        split_qris_amount: method === 'SPLIT' ? splitQris : undefined,
        customer_id:       customerId,
        items: cart.map(i => ({
          product_id: i.isAgent ? undefined : i.id,
          quantity:   i.qty,
          unit_price: i.price,
          subtotal:   i.subtotal,
          is_agent:   i.isAgent || undefined,
          barcode:    i.barcode || undefined,
          name:       i.name || undefined,
          digital_details: i.digitalDetails || undefined,
        })),
      };
      const res = await fetch('/api/sales', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        showToast(err.details || err.error || 'Transaksi gagal.', 'error');
        return;
      }
      const data = await res.json();

      if (data.status === 'pending') {
        setPendingQrisSale({
          id: data.saleId,
          transaction_code: data.transaction_code,
          total_amount: data.total_amount,
          original_amount: total,
          discount: discount,
          split_cash_amount: data.split_cash_amount,
          split_qris_amount: data.split_qris_amount,
          items: cart.map(i => ({
            name:       i.name,
            qty:        i.qty,
            unit_price: i.price,
            subtotal:   i.subtotal,
          })),
        });
        return;
      }

      showToast(`✓ Sukses! Kode: ${data.transaction_code}`, 'success');

      // Build receipt data and print
      const receiptData: WarungReceiptData = {
        type:             'warung',
        transaction_code: data.transaction_code,
        cashier:          userNameRef.current,
        items:            cart.map(i => ({
          name:       i.name,
          qty:        i.qty,
          unit_price: i.price,
          subtotal:   i.subtotal,
        })),
        total:            data.total_amount || finalTotal,
        discount:         discount,
        payment_method:   method,
        payment_received: method === 'SPLIT' ? (splitCash || 0) : (method === 'DEBT' ? 0 : (received || data.total_amount || finalTotal)),
        split_cash_amount: method === 'SPLIT' ? splitCash : undefined,
        split_qris_amount: method === 'SPLIT' ? splitQris : undefined,
        change:           change_given,
        timestamp:        new Date(),
      };
      lastReceiptRef.current = receiptData;
      printReceipt(receiptData);

      // Buka laci kasir untuk pembayaran tunai (CASH / SPLIT)
      // QRIS & DEBT tidak perlu buka laci
      if (method === 'CASH' || method === 'SPLIT') {
        fetch('/api/cash-drawer', { method: 'POST' }).catch(() => {
          // Gagal diam-diam — transaksi sudah berhasil dicatat
        });
      }

      setCart([]);
      fetchRebalanceStatus();
    } catch {
      showToast('Koneksi bermasalah. Periksa server.', 'error');
    } finally {
      setPaying(false);
    }
  }, [cart, paying, showToast, discount]);

  const handleReprint = useCallback(() => {
    if (lastReceiptRef.current) {
      printReceipt(lastReceiptRef.current);
    } else {
      // Mock receipt for testing thermal printer
      printReceipt({
        type: 'warung',
        transaction_code: 'WRG-TEST-PRINT-9999',
        cashier: userNameRef.current || 'System Test',
        items: [
          { name: 'TEST PRINTER DUSTA', qty: 1, unit_price: 15000, subtotal: 15000 },
          { name: 'KERTAS THERMAL OK', qty: 2, unit_price: 5000, subtotal: 10000 },
          { name: 'WARUNG RAFILAH POS', qty: 1, unit_price: 0, subtotal: 0 }
        ],
        total: 25000,
        payment_method: 'CASH',
        payment_received: 50000,
        change: 25000,
        timestamp: new Date(),
      });
    }
  }, []);

  useGlobalHotkeys({
    onF1:     handleF1,
    onF2:     handleF2,
    onF3:     handleF3,
    onF10:    handleReprint,
    onScan:   mode === 'warung' ? handleScan : mode === 'admin' ? handleAdminScan : undefined,
    onEscape: () => setCart([]),
  });

  const cartSubtotal = cart.reduce((s, i) => s + i.subtotal, 0);
  const grandTotal = Math.max(0, cartSubtotal - discount);

  return (
    <AppShell
      mode={mode}
      onModeChange={m => m === 'warung' ? handleF1() : m === 'agent' ? handleF2() : handleF3()}
      userRole={userRole}
      onReprint={handleReprint}
      activeSession={activeSession}
      onCloseSession={() => setShowCloseSessionModal(true)}
      isAiOpen={isAiOpen}
      onToggleAi={() => setIsAiOpen(prev => !prev)}
    >
      {/* Toast overlay */}
      {toast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-lg shadow-xl font-label-md text-label-md transition-all max-w-lg text-center
            ${toast.type === 'error'
              ? 'bg-error text-on-error'
              : 'bg-secondary-container text-on-secondary-container'}`}
        >
          {toast.msg}
        </div>
      )}

      {/* Warning Alert Banner */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden h-full">
        {rebalanceStatus && rebalanceStatus.status !== 'healthy' && rebalanceStatus.alerts.length > 0 && !rebalanceAlertDismissed && (
          <div className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200
            ${rebalanceStatus.status === 'critical'
              ? 'bg-error-container text-on-error-container border-error/20'
              : 'bg-amber-950/40 text-amber-400 border-amber-500/20'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0 mt-0.5">⚠️</span>
              <div className="flex flex-col text-left">
                {rebalanceStatus.alerts.map((alert, i) => (
                  <p key={i} className="font-bold text-sm leading-snug">{alert}</p>
                ))}
                {rebalanceStatus.recommendations.length > 0 && (
                  <p className="text-xs opacity-85 mt-1 font-medium">
                    <span className="font-bold">Rekomendasi: </span>
                    {rebalanceStatus.recommendations.join(', ')}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={async () => { await fetchRebalanceStatus(); setShowKasDetail(true); }}
                className={`text-xs font-bold px-4 py-2 rounded-lg border transition-all active:scale-95 cursor-pointer
                  ${rebalanceStatus.status === 'critical'
                    ? 'border-on-error-container/20 hover:bg-on-error-container/10 text-on-error-container'
                    : 'border-amber-400/25 hover:bg-amber-400/10 text-amber-400'
                  }`}
              >
                Cek Status Kas
              </button>
              <button
                onClick={() => setRebalanceAlertDismissed(true)}
                className={`p-2 rounded-lg border transition-all active:scale-95 cursor-pointer leading-none text-xs font-bold hover:bg-white/10
                  ${rebalanceStatus.status === 'critical'
                    ? 'border-on-error-container/20 text-on-error-container'
                    : 'border-amber-400/25 text-amber-400'
                  }`}
                title="Tutup Peringatan"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Kas Detail Modal */}
        {showKasDetail && rebalanceStatus && (
          <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowKasDetail(false)}>
            <div className="bg-surface-container border border-outline-variant rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">📊 Detail Status Kas</h2>
                <button onClick={() => setShowKasDetail(false)} className="text-on-surface-variant hover:text-on-surface text-xl leading-none cursor-pointer">✕</button>
              </div>
              <div className="flex flex-col gap-3 mb-5">
                <div className="flex justify-between items-center p-3 bg-surface-container-high rounded-xl">
                  <span className="text-sm text-on-surface-variant font-medium">💵 Kas Fisik di Laci</span>
                  <span className="font-mono font-bold text-on-surface">Rp {(rebalanceStatus.current_cash ?? 0).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-surface-container-high rounded-xl">
                  <span className="text-sm text-on-surface-variant font-medium">📱 Saldo Float Digital</span>
                  <span className="font-mono font-bold text-on-surface">Rp {(rebalanceStatus.current_float ?? 0).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-secondary-container/20 border border-secondary/20 rounded-xl">
                  <span className="text-sm font-semibold text-on-surface">🏦 Total Likuiditas</span>
                  <span className="font-mono font-bold text-secondary text-base">Rp {(rebalanceStatus.total_liquidity ?? 0).toLocaleString('id-ID')}</span>
                </div>
              </div>
              {rebalanceStatus.alerts.length > 0 && (
                <div className={`rounded-xl p-3 mb-4 ${
                  rebalanceStatus.status === 'critical' ? 'bg-error-container text-on-error-container' : 'bg-amber-950/40 text-amber-300'
                }`}>
                  {rebalanceStatus.alerts.map((a, i) => <p key={i} className="text-xs font-semibold leading-snug mb-1">⚠️ {a}</p>)}
                </div>
              )}
              {rebalanceStatus.recommendations.length > 0 && (
                <div className="bg-surface-container-highest rounded-xl p-3 mb-4">
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Rekomendasi</p>
                  {rebalanceStatus.recommendations.map((r, i) => <p key={i} className="text-xs text-on-surface leading-snug">• {r}</p>)}
                </div>
              )}
              <button
                onClick={() => setShowKasDetail(false)}
                className="w-full py-2.5 rounded-xl bg-secondary text-on-secondary font-bold text-sm cursor-pointer hover:opacity-90 transition-opacity"
              >
                Tutup
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 flex gap-gutter overflow-hidden">
          {mode === 'warung' ? (
        <>
          <CartTable
            items={cart}
            mode="warung"
            onScan={handleScan}
            onRemove={handleRemove}
            onBulkRemove={handleBulkRemove}
            onChangeQty={handleChangeQty}
            onAddDigitalItem={handleAddDigitalItem}
          />
          <PaymentPanel
            warungTotal={cart.filter(i => !i.isAgent).reduce((s, i) => s + i.subtotal, 0)}
            agentTotal={cart.filter(i => i.isAgent).reduce((s, i) => s + (i.modal_price || 0), 0)}
            agentFee={cart.filter(i => i.isAgent).reduce((s, i) => s + (i.price - (i.modal_price || 0)), 0)}
            discount={discount}
            onDiscountChange={setDiscount}
            grandTotal={grandTotal}
            onPay={handleCheckout}
            paying={paying}
            activeDiscounts={activeDiscounts}
          />
        </>
      ) : mode === 'agent' ? (
        <AgentWorkspace onToast={showToast} />
      ) : (
        <AdminWorkspace onToast={showToast} scannedBarcode={scannedBarcode} />
      )}
        </div>
      </div>

      {pendingQrisSale && (
        <QrisPaymentModal
          sale={pendingQrisSale}
          onSuccess={() => {
            showToast('✓ Sukses! Pembayaran QRIS diterima.', 'success');
            
            const isSplit = pendingQrisSale.split_qris_amount !== undefined && pendingQrisSale.split_qris_amount > 0;
            const receiptData: WarungReceiptData = {
              type:             'warung',
              transaction_code: pendingQrisSale.transaction_code,
              cashier:          userNameRef.current,
              items:            pendingQrisSale.items,
              total:            pendingQrisSale.total_amount,
              discount:         pendingQrisSale.discount,
              payment_method:   isSplit ? 'SPLIT' : 'QRIS',
              payment_received: pendingQrisSale.total_amount,
              split_cash_amount: pendingQrisSale.split_cash_amount,
              split_qris_amount: pendingQrisSale.split_qris_amount,
              change:           0,
              timestamp:        new Date(),
            };
            lastReceiptRef.current = receiptData;
            printReceipt(receiptData);

            setCart([]);
            setPendingQrisSale(null);
            fetchRebalanceStatus();
          }}
          onCancel={(msg) => {
            if (msg) showToast(msg, 'error');
            setPendingQrisSale(null);
          }}
          showToast={showToast}
        />
      )}

      {/* Session Opening Modal */}
      {userRole && !checkingSession && !activeSession && (
        <CashSessionModal
          mode="open"
          onSuccess={(session) => {
            setActiveSession(session);
            fetchRebalanceStatus();
          }}
        />
      )}

      {/* Session Closing Modal */}
      {showCloseSessionModal && (
        <CashSessionModal
          mode="close"
          onSuccess={() => {
            setActiveSession(null);
            setShowCloseSessionModal(false);
            setRebalanceStatus(null);
          }}
          onClose={() => setShowCloseSessionModal(false)}
        />
      )}

      <AIAssistant userRole={userRole} isOpen={isAiOpen} onClose={() => setIsAiOpen(false)} />
    </AppShell>
  );
}
