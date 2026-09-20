"use client";

import { useDeferredEffect } from '@/lib/useDeferredEffect';
import type { CashSession, Discount } from '@/types/api';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import AppShell from '@/components/Layout/AppShell';
import { Banknote, AlertTriangle, X } from 'lucide-react';

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
import QuickAddProductModal from '@/components/pos/QuickAddProductModal';
import KeyboardShortcutsModal from '@/components/pos/KeyboardShortcutsModal';
import CalculatorModal from '@/components/pos/CalculatorModal';

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
  const [activeDiscounts, setActiveDiscounts] = useState<Discount[]>([]);

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

  useDeferredEffect(() => {
    if (mode === 'warung') {
      fetchActiveDiscounts();
    }
  }, [mode, fetchActiveDiscounts]);

  // Reset discount when cart is empty
  useDeferredEffect(() => {
    if (cart.length === 0) {
      setDiscount(0);
    }
  }, [cart.length]);

  const [toast, setToast]   = useState<{ msg: string; type: 'error' | 'success' } | null>(null);
  const [paying, setPaying] = useState(false);
  const [userRole, setUserRole] = useState<string>('');
  const [userId, setUserId] = useState('');
  const draftReady = useRef(false);
  const checkoutBusy = useRef(false);
  const [scannedBarcode, setScannedBarcode] = useState<{ code: string; timestamp: number } | null>(null);
  const [quickAddBarcode, setQuickAddBarcode] = useState<string | null>(null);
  const [pendingQrisSale, setPendingQrisSale] = useState<{
    receipt?: WarungReceiptData;
    id: string;
    transaction_code: string;
    total_amount: number;
    original_amount: number;
    discount?: number;
    payment_received?: number;
    change_given?: number;
    split_cash_amount?: number;
    split_qris_amount?: number;
    items: { name: string; qty: number; unit_price: number; subtotal: number }[];
  } | null>(null);
  const lastReceiptRef = useRef<WarungReceiptData | null>(null);
  const userNameRef    = useRef<string>('Kasir');

  const [activeSession, setActiveSession] = useState<CashSession | null>(null);
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
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [isPaymentDrawerOpen, setIsPaymentDrawerOpen] = useState(false);


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

  // Mode change handler with localStorage persistence
  const handleModeChange = useCallback((newMode: 'warung' | 'agent' | 'admin') => {
    setMode(newMode);
    try {
      localStorage.setItem('pos_preferred_mode', newMode);
    } catch { /* ignore */ }
  }, []);

  // Fetch current user details on load to get the role
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.role) {
          setUserRole(data.role); setUserId(data.id);
          try {
            const savedMode = localStorage.getItem('pos_preferred_mode') as 'warung' | 'agent' | 'admin' | null;
            if (savedMode && (data.role === 'owner' || savedMode !== 'admin')) {
              setMode(savedMode);
            } else if (data.role === 'owner' && !savedMode) {
              setMode('admin');
            }
          } catch { /* ignore */ }
        }
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
  const handleF1 = useCallback(() => { handleModeChange('warung'); setCart([]); }, [handleModeChange]);
  const handleF2 = useCallback(() => { handleModeChange('agent');  setCart([]); }, [handleModeChange]);
  const handleF3 = useCallback(() => { 
    if (userRole === 'owner') { 
      handleModeChange('admin'); 
      setCart([]); 
    } else if (mode === 'warung') {
      const discountInput = document.getElementById('input-discount') as HTMLInputElement | null;
      if (discountInput) {
        const disclosure = discountInput.closest('details');
        if (disclosure) disclosure.open = true;
        discountInput.focus();
        discountInput.select();
      }
    }
  }, [userRole, mode, handleModeChange]);


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
        setQuickAddBarcode(barcode);
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

  // ── Quick Add Product → inject into cart after save ────────────────────────
  const handleQuickAddSaved = useCallback((product: { id: string; barcode: string; name: string; price: number }) => {
    setQuickAddBarcode(null);
    setCart(prev => [
      ...prev,
      {
        id:       product.id,
        barcode:  product.barcode,
        name:     product.name,
        qty:      1,
        price:    product.price,
        subtotal: product.price,
        basePrice: product.price,
      },
    ]);
    showToast(`✓ "${product.name}" disimpan & ditambahkan ke keranjang`, 'success');
  }, [showToast]);

  // ── Barcode scan in Admin Mode ───────────────────────────────────────────────
  const handleAdminScan = useCallback((barcode: string) => {
    setScannedBarcode({ code: barcode, timestamp: Date.now() });
  }, []);

  useDeferredEffect(() => {
    if (!userId) return;
    let active = true;
    const draftKey = 'pos-draft:' + userId;
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey) || 'null');
      if (draft) { setCart(draft.cart || []); setDiscount(draft.discount || 0); }
      const receipt = JSON.parse(localStorage.getItem('pos-receipt:' + userId) || 'null');
      if (receipt) lastReceiptRef.current = { ...receipt, timestamp: new Date(receipt.timestamp) };
    } catch { /* Corrupt local draft never affects server transactions. */ }
    draftReady.current = true;
    async function recover() {
      const journal = JSON.parse(localStorage.getItem('pos-checkout:' + userId) || 'null');
      const res = await fetch('/api/sales/recover' + (journal ? '?key=' + journal.checkout_key : ''));
      if (!res.ok || !active) return;
      const { sale } = await res.json();
      if (!sale) return;
      const receipt = { ...sale.receipt, timestamp: new Date(sale.receipt.timestamp) };
      if (sale.status === 'pending') {
        setPendingQrisSale({ id: sale.saleId, transaction_code: sale.transaction_code, total_amount: receipt.total,
          original_amount: receipt.total + (receipt.discount || 0), discount: receipt.discount, items: receipt.items,
          payment_received: receipt.payment_received, change_given: receipt.change, split_cash_amount: receipt.split_cash_amount,
          split_qris_amount: receipt.split_qris_amount, receipt });
      } else {
        try { localStorage.removeItem('pos-checkout:' + userId); } catch { /* Existing journal safely replays the same sale. */ }
        if (journal) setCart([]);
        if (sale.status === 'completed') {
          lastReceiptRef.current = receipt;
          try { localStorage.setItem('pos-receipt:' + userId, JSON.stringify(receipt)); } catch { /* Receipt remains available in memory and on the server. */ }
          showToast('Transaksi sebelumnya sudah tersimpan. Struk dapat dicetak ulang.', 'success');
        }
      }
    }
    recover().catch(() => showToast('Pemulihan transaksi belum berhasil. Periksa koneksi lalu muat ulang.', 'error'));
    return () => { active = false; };
  }, [userId, showToast]);

  useEffect(() => {
    if (userId && draftReady.current) {
      try { localStorage.setItem('pos-draft:' + userId, JSON.stringify({ cart, discount })); }
      catch { /* Checkout separately requires a durable journal before sending. */ }
    }
  }, [userId, cart, discount]);

  // ── Warung checkout ──────────────────────────────────────────────────────────
  const handleCheckout = useCallback(async (
    method: 'CASH' | 'QRIS' | 'SPLIT' | 'DEBT',
    received: number,
    splitCash?: number,
    splitQris?: number,
    customerId?: string
  ) => {
    if (cart.length === 0 || paying || checkoutBusy.current || pendingQrisSale) return;
    checkoutBusy.current = true;
    setPaying(true);
    try {
      const total       = cart.reduce((s, i) => s + i.subtotal, 0);
      const finalTotal  = Math.max(0, total - discount);
      const change_given = (method === 'CASH' || method === 'QRIS') ? Math.max(0, received - finalTotal) : 0;
      let payload = {
        checkout_key: crypto.randomUUID(),
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
      const journalKey = 'pos-checkout:' + userId;
      const previousAttempt = localStorage.getItem(journalKey);
      if (previousAttempt) payload = JSON.parse(previousAttempt);
      localStorage.setItem(journalKey, JSON.stringify(payload));
      const res = await fetch('/api/sales', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        if (res.status === 400 || res.status === 409) try { localStorage.removeItem(journalKey); } catch { /* Existing journal safely replays the same sale. */ }
        if (Array.isArray(err.items)) setCart(prev => prev.map(item => {
          const index = payload.items.findIndex(row => row.product_id === item.id && !row.is_agent);
          const corrected = err.items[index];
          return corrected ? { ...item, price: corrected.unit_price, subtotal: Math.round(corrected.unit_price * item.qty * 100) / 100 } : item;
        }));
        showToast(typeof err.error === 'string' ? err.error : 'Data pembayaran tidak valid. Periksa nominal dan produk.', 'error');
        return;
      }
      const data = await res.json();
      const serverReceipt: WarungReceiptData = { ...data.receipt, timestamp: new Date(data.receipt.timestamp) };
      if (data.status === 'voided') { try { localStorage.removeItem(journalKey); } catch { /* Existing journal safely replays the same sale. */ } showToast('Transaksi ini sudah dibatalkan. Mulai pembayaran kembali.', 'error'); return; }

      if (data.status === 'pending') {
        setPendingQrisSale({ id: data.saleId, transaction_code: data.transaction_code,
          total_amount: serverReceipt.total, original_amount: serverReceipt.total + (serverReceipt.discount || 0),
          discount: serverReceipt.discount, payment_received: serverReceipt.payment_received,
          change_given: serverReceipt.change, split_cash_amount: serverReceipt.split_cash_amount,
          split_qris_amount: serverReceipt.split_qris_amount, items: serverReceipt.items, receipt: serverReceipt });
        return;
      }

      showToast(`✓ Sukses! Kode: ${data.transaction_code}`, 'success');

      // Build receipt data and print
      const receiptData = serverReceipt;
      try { localStorage.removeItem(journalKey); } catch { /* Existing journal safely replays the same sale. */ }
      try { localStorage.setItem('pos-receipt:' + userId, JSON.stringify(receiptData)); } catch { /* Receipt remains available in memory and on the server. */ }
      lastReceiptRef.current = receiptData;
      
      const shouldPrint = window.confirm('Cetak struk belanja?');
      if (shouldPrint) {
        printReceipt(receiptData);
      } else {
        // Buka laci kasir secara manual jika tidak dicetak (hanya untuk CASH/SPLIT)
        if (method === 'CASH' || method === 'SPLIT') {
          fetch('/api/cash-drawer', { method: 'POST' }).catch(() => {});
        }
      }

      setCart([]);
      fetchRebalanceStatus();
    } catch {
      showToast('Koneksi bermasalah. Periksa server.', 'error');
    } finally {
      checkoutBusy.current = false;
      setPaying(false);
    }
  }, [cart, paying, showToast, discount, pendingQrisSale, userId]);

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

  const handleManualKickDrawer = useCallback(() => {
    fetch('/api/cash-drawer', { method: 'POST' })
      .then(res => {
        if (res.ok) {
          showToast('✓ Laci kasir terbuka', 'success');
        } else {
          showToast('Gagal membuka laci', 'error');
        }
      })
      .catch(() => showToast('Gagal koneksi ke laci', 'error'));
  }, [showToast]);

  const handleF7 = useCallback(() => {
    let element: HTMLInputElement | null = null;
    if (mode === 'warung') {
      element = document.getElementById('main-barcode-search-input') as HTMLInputElement;
    } else if (mode === 'agent') {
      element = document.getElementById('agent-customer-phone-input') as HTMLInputElement;
    } else if (mode === 'admin') {
      element = document.getElementById('admin-product-search-input') as HTMLInputElement;
    }
    if (element) {
      element.focus();
      element.select();
    }
  }, [mode]);

  const handleEscape = useCallback(() => {
    if (isCalculatorOpen) {
      setIsCalculatorOpen(false);
      return;
    }
    if (isShortcutsOpen) {
      setIsShortcutsOpen(false);
      return;
    }
    if (showKasDetail) {
      setShowKasDetail(false);
      return;
    }
    if (isAiOpen) {
      setIsAiOpen(false);
      return;
    }
    setCart([]);
  }, [isCalculatorOpen, isShortcutsOpen, showKasDetail, isAiOpen]);

  useGlobalHotkeys({
    onF1:     handleF1,
    onF2:     handleF2,
    onF3:     handleF3,
    onF4:     () => setShowKasDetail(prev => !prev),
    onAltC:   () => setIsCalculatorOpen(prev => !prev),
    onF6:     () => { if (userRole === 'owner') setIsAiOpen(prev => !prev); },
    onF7:     handleF7,
    onF8:     () => setIsShortcutsOpen(prev => !prev),
    onF9:     () => window.dispatchEvent(new CustomEvent('hotkey-focus-payment')),
    onF10:    handleReprint,
    onScan:   mode === 'warung' ? handleScan : mode === 'admin' ? handleAdminScan : undefined,
    onEscape: handleEscape,
    onAlt1:   () => window.dispatchEvent(new CustomEvent('hotkey-pay-cash')),
    onAlt2:   () => window.dispatchEvent(new CustomEvent('hotkey-pay-qris')),
    onAlt3:   () => window.dispatchEvent(new CustomEvent('hotkey-pay-split')),
    onAlt4:   () => window.dispatchEvent(new CustomEvent('hotkey-pay-debt')),
    onAltA:   () => window.dispatchEvent(new CustomEvent('hotkey-pay-exact-cash')),
    onAltN:   () => window.dispatchEvent(new CustomEvent('hotkey-add-non-barcode')),
    onAltP:   () => window.dispatchEvent(new CustomEvent('hotkey-trigger-pay')),
    onAltS:   () => window.dispatchEvent(new CustomEvent('hotkey-select-customer')),
    onAsterisk: handleManualKickDrawer,
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
      isShortcutsOpen={isShortcutsOpen}
      onToggleShortcuts={() => setIsShortcutsOpen(prev => !prev)}
      isCalculatorOpen={isCalculatorOpen}
      onToggleCalculator={() => setIsCalculatorOpen(prev => !prev)}
      onCancel={() => setCart([])}
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
          <div className="pos-operational-notice" role="status">
            <AlertTriangle size={17} aria-hidden="true" />
            <span><strong>Saldo kas dan agen perlu diperiksa.</strong> {rebalanceStatus.alerts.length} pemberitahuan.</span>
            <button className="notice-detail" onClick={async () => { await fetchRebalanceStatus(); setShowKasDetail(true); }}>Lihat rincian</button>
            <button className="notice-close" onClick={() => setRebalanceAlertDismissed(true)} aria-label="Tutup pemberitahuan saldo"><X size={16} /></button>
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

        <div className="flex-1 flex flex-col sm:flex-row gap-3.5 overflow-hidden relative">
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

          {/* Desktop/Tablet Payment Panel (>=640px) */}
          <div className="hidden sm:block shrink-0">
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
          </div>

          {/* Mobile Payment Panel Drawer (<640px) */}
          {isPaymentDrawerOpen && (
            <PaymentPanel
              warungTotal={cart.filter(i => !i.isAgent).reduce((s, i) => s + i.subtotal, 0)}
              agentTotal={cart.filter(i => i.isAgent).reduce((s, i) => s + (i.modal_price || 0), 0)}
              agentFee={cart.filter(i => i.isAgent).reduce((s, i) => s + (i.price - (i.modal_price || 0)), 0)}
              discount={discount}
              onDiscountChange={setDiscount}
              grandTotal={grandTotal}
              onPay={(method, received, splitCash, splitQris, customerId) => {
                setIsPaymentDrawerOpen(false);
                handleCheckout(method, received, splitCash, splitQris, customerId);
              }}
              paying={paying}
              activeDiscounts={activeDiscounts}
              isMobileDrawer
              onCloseMobileDrawer={() => setIsPaymentDrawerOpen(false)}
            />
          )}

          {/* Mobile Sticky Checkout Action Bar (<640px) */}
          {mode === 'warung' && cart.length > 0 && (
            <div className="sm:hidden fixed bottom-16 left-0 right-0 z-30 p-3 px-4 bg-surface-container/95 backdrop-blur-md border-t border-outline-variant/60 shadow-2xl flex items-center justify-between gap-3 animate-in slide-in-from-bottom-2 duration-200">
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
                  {cart.reduce((s, i) => s + i.qty, 0)} Item di Keranjang
                </span>
                <span className="font-mono font-extrabold text-base text-primary truncate">
                  Rp {grandTotal.toLocaleString('id-ID')}
                </span>
              </div>
              <button
                onClick={() => setIsPaymentDrawerOpen(true)}
                className="bg-primary hover:bg-primary/90 text-on-primary font-bold text-sm px-5 py-2.5 rounded-xl shadow-lg shadow-primary/25 active:scale-95 transition-all flex items-center gap-2 cursor-pointer shrink-0"
              >
                <span>BAYAR SEKARANG</span>
                <Banknote size={18} />
              </button>
            </div>
          )}
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
              payment_received: pendingQrisSale.payment_received ?? pendingQrisSale.total_amount,
              split_cash_amount: pendingQrisSale.split_cash_amount,
              split_qris_amount: pendingQrisSale.split_qris_amount,
              change:           pendingQrisSale.change_given || 0,
              timestamp:        new Date(),
            };
            lastReceiptRef.current = receiptData;
            try { localStorage.removeItem('pos-checkout:' + userId); } catch { /* Existing journal safely replays the same sale. */ }
            try { localStorage.setItem('pos-receipt:' + userId, JSON.stringify(receiptData)); } catch { /* Receipt remains available in memory and on the server. */ }
            if (window.confirm('Cetak struk belanja?')) {
              printReceipt(receiptData);
            }

            setCart([]);
            setPendingQrisSale(null);
            fetchRebalanceStatus();
          }}
          onCancel={(msg) => {
            try { localStorage.removeItem('pos-checkout:' + userId); } catch { /* Existing journal safely replays the same sale. */ }
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

      <KeyboardShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />

      <CalculatorModal isOpen={isCalculatorOpen} onClose={() => setIsCalculatorOpen(false)} />

      {/* Quick Add Product Modal — triggered when barcode scan returns 404 */}
      {quickAddBarcode && (
        <QuickAddProductModal
          barcode={quickAddBarcode}
          onSaved={handleQuickAddSaved}
          onClose={() => setQuickAddBarcode(null)}
        />
      )}
    </AppShell>
  );
}
