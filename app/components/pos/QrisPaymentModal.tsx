"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, XCircle, CheckCircle, Smartphone } from 'lucide-react';

type QrisPaymentModalProps = {
  sale: {
    id: string;
    transaction_code: string;
    total_amount: number;
    original_amount: number;
    payment_received?: number;
    change_given?: number;
    split_cash_amount?: number;
    split_qris_amount?: number;
  };
  onSuccess: () => void;
  onCancel: (msg?: string) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
};

export default function QrisPaymentModal({
  sale,
  onSuccess,
  onCancel,
  showToast,
}: QrisPaymentModalProps) {
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const [cancelling, setCancelling] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleConfirmManual = useCallback(async () => {
    if (confirming || cancelling) return;
    setConfirming(true);
    try {
      const res = await fetch('/api/sales/confirm-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saleId: sale.id }),
      });
      if (res.ok) {
        showToast('Pembayaran berhasil dikonfirmasi secara manual!', 'success');
        onSuccess();
      } else {
        const data = await res.json();
        showToast(data.details || data.error || 'Gagal mengonfirmasi pembayaran.', 'error');
        setConfirming(false);
      }
    } catch {
      showToast('Koneksi terputus. Gagal mengonfirmasi pembayaran.', 'error');
      setConfirming(false);
    }
  }, [confirming, cancelling, sale.id, onSuccess, showToast]);

  const handleAutoCancel = useCallback(async () => {
    try {
      await fetch('/api/sales/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saleId: sale.id }),
      });
    } catch (e) {
      console.error('Auto cancel failed:', e);
    }
    onCancel('Waktu pembayaran QRIS habis. Transaksi dibatalkan secara otomatis.');
  }, [sale.id, onCancel]);

  const handleCancel = useCallback(async () => {
    if (cancelling) return;
    setCancelling(true);
    try {
      const res = await fetch('/api/sales/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saleId: sale.id }),
      });
      if (res.ok) {
        showToast('Transaksi dibatalkan. Stok barang telah dikembalikan.', 'success');
        onCancel();
      } else {
        const data = await res.json();
        showToast(data.details || 'Gagal membatalkan transaksi.', 'error');
        setCancelling(false);
      }
    } catch {
      showToast('Koneksi terputus. Gagal membatalkan transaksi.', 'error');
      setCancelling(false);
    }
  }, [cancelling, sale.id, onCancel, showToast]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) {
      handleAutoCancel();
      return;
    }
    const timer = setTimeout(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, handleAutoCancel]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <dialog id="qris-payment-dialog" open aria-modal="true" aria-labelledby="qris-dialog-title" className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 w-full h-full border-none">
      <section id="qris-payment-card" className="bg-surface-container-lowest rounded-2xl border border-outline-variant max-w-md w-full p-6 shadow-2xl flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <header id="qris-modal-header" className="w-full text-center">
          <h2 id="qris-dialog-title" className="text-headline-md font-bold text-on-surface">Pembayaran QRIS</h2>
          <p id="qris-transaction-code" className="text-body-sm text-on-surface-variant font-medium mt-1">Kode Transaksi: {sale.transaction_code}</p>
        </header>

        {/* QRIS Card Container */}
        <article id="qris-code-article" className="w-full bg-white rounded-xl p-4 flex flex-col items-center shadow-inner border border-outline/10 text-black">
          
          {/* QRIS Logo area */}
          <header id="qris-brand-header" className="w-full flex justify-between items-center border-b border-gray-100 pb-2 mb-3">
            <div className="flex items-center gap-1">
              <span className="text-[14px] font-black tracking-tighter text-red-600">QR</span>
              <span className="text-[14px] font-black tracking-tighter text-blue-600">IS</span>
              <span className="text-[9px] bg-red-600 text-white font-bold px-1 rounded ml-1">GPN</span>
            </div>
            <div className="text-right">
              <div id="qris-nmid" className="text-[10px] font-bold text-gray-500">NMID : ID1020260233917</div>
            </div>
          </header>

          <h3 id="qris-merchant-name" className="font-bold text-[15px] uppercase tracking-wide text-gray-800 text-center w-full">
            WARUNG RAFILAH
          </h3>
          <address id="qris-merchant-address" className="text-[10px] text-gray-400 text-center mb-3 not-italic">
            Jl. Mawar No.2335, RT 08, RW 02, Sukajaya
          </address>

          {/* SVG Stylized QR Code Pattern (No Spinner) */}
          <figure id="qris-qr-code-figure" className="relative w-48 h-48 bg-white border border-gray-200 rounded-lg p-2 flex items-center justify-center m-0">
            <svg width="100%" height="100%" viewBox="0 0 100 100" className="text-gray-900" aria-label="Kode QRIS Warung Rafilah">
              {/* Corner anchors */}
              <rect x="5" y="5" width="20" height="20" fill="currentColor" />
              <rect x="9" y="9" width="12" height="12" fill="white" />
              <rect x="12" y="12" width="6" height="6" fill="currentColor" />

              <rect x="75" y="5" width="20" height="20" fill="currentColor" />
              <rect x="79" y="9" width="12" height="12" fill="white" />
              <rect x="82" y="12" width="6" height="6" fill="currentColor" />

              <rect x="5" y="75" width="20" height="20" fill="currentColor" />
              <rect x="9" y="79" width="12" height="12" fill="white" />
              <rect x="12" y="82" width="6" height="6" fill="currentColor" />

              {/* QR noise matrix lines */}
              <path d="M 30,5 h 5 v 5 h -5 z M 40,5 h 10 v 5 h -10 z M 55,5 h 5 v 5 h -5 z M 65,5 h 5 v 5 h -5 z" fill="currentColor" />
              <path d="M 30,15 h 15 v 5 h -15 z M 50,15 h 5 v 10 h -5 z M 60,15 h 10 v 5 h -10 z" fill="currentColor" />
              <path d="M 5,30 h 5 v 15 h -5 z M 15,30 h 10 v 5 h -10 z M 30,30 h 5 v 5 h -5 z M 45,30 h 15 v 5 h -15 z M 65,30 h 10 v 10 h -10 z" fill="currentColor" />
              <path d="M 10,40 h 10 v 5 h -10 z M 25,40 h 15 v 10 h -15 z M 45,45 h 10 v 5 h -10 z M 60,40 h 5 v 5 h -5 z M 70,40 h 5 v 10 h -5 z" fill="currentColor" />
              <path d="M 5,50 h 20 v 5 h -20 z M 30,50 h 5 v 10 h -5 z M 40,50 h 10 v 5 h -10 z M 55,50 h 15 v 5 h -15 z M 75,50 h 20 v 5 h -20 z" fill="currentColor" />
              <path d="M 10,60 h 5 v 10 h -5 z M 20,60 h 15 v 5 h -15 z M 45,60 h 10 v 5 h -10 z M 60,60 h 10 v 15 h -10 z" fill="currentColor" />
              <path d="M 30,70 h 20 v 5 h -20 z M 55,70 h 5 v 5 h -5 z M 65,70 h 5 v 15 h -5 z M 75,70 h 10 v 5 h -10 z" fill="currentColor" />
              <path d="M 30,80 h 5 v 15 h -5 z M 40,80 h 15 v 5 h -15 z M 60,85 h 5 v 5 h -5 z M 75,80 h 5 v 10 h -5 z" fill="currentColor" />
              <path d="M 35,90 h 15 v 5 h -15 z M 55,90 h 15 v 5 h -15 z M 80,90 h 15 v 5 h -15 z" fill="currentColor" />
            </svg>
          </figure>

          {/* Amount to pay */}
          <section id="qris-amount-summary-section" className="w-full text-center mt-4 border-t border-dashed border-gray-200 pt-3">
            {sale.split_qris_amount !== undefined && sale.split_qris_amount > 0 ? (
              <>
                <div className="flex justify-between items-center text-xs text-gray-600 mb-1">
                  <span>Nominal Tunai (Cash):</span>
                  <output id="qris-split-cash-output" className="font-bold text-gray-800">Rp {sale.split_cash_amount?.toLocaleString('id-ID')}</output>
                </div>
                <div className="flex justify-between items-center text-xs text-gray-600 border-b border-gray-100 pb-2 mb-2">
                  <span>Total Transaksi:</span>
                  <output id="qris-split-total-output" className="font-semibold text-gray-800">Rp {sale.total_amount.toLocaleString('id-ID')}</output>
                </div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wide">Nominal Transfer QRIS</div>
                <output id="qris-split-transfer-output" className="font-mono text-3xl font-extrabold text-blue-600 mt-1 tracking-tight block">
                  Rp {sale.split_qris_amount.toLocaleString('id-ID')}
                </output>
              </>
            ) : sale.change_given !== undefined && sale.change_given > 0 ? (
              <>
                <div className="flex justify-between items-center text-xs text-gray-600 mb-1">
                  <span>Total Belanja:</span>
                  <output id="qris-total-amount-output" className="font-bold text-gray-800">Rp {sale.total_amount.toLocaleString('id-ID')}</output>
                </div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wide mt-1">Nominal Transfer QRIS</div>
                <output id="qris-transfer-amount-output" className="font-mono text-3xl font-extrabold text-blue-600 mt-0.5 tracking-tight block">
                  Rp {(sale.payment_received || sale.total_amount).toLocaleString('id-ID')}
                </output>
                <div id="qris-cash-change-alert-card" className="mt-2 bg-emerald-50 border border-emerald-200 rounded-lg p-2 flex flex-col items-center">
                  <div className="flex items-center justify-between w-full text-xs font-bold text-emerald-800">
                    <span>💵 Kembalian Tunai:</span>
                    <output id="qris-cash-change-amount-output" className="font-mono text-base font-extrabold text-emerald-700">Rp {sale.change_given.toLocaleString('id-ID')}</output>
                  </div>
                  <p id="qris-cash-change-instruction" className="text-[10px] text-emerald-700 font-medium mt-0.5 text-center">
                    Serahkan Rp {sale.change_given.toLocaleString('id-ID')} uang tunai dari laci kasir ke pelanggan.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="text-[10px] text-gray-500 uppercase tracking-wide">Total Nominal Transfer</div>
                <output id="qris-direct-total-output" className="font-mono text-3xl font-extrabold text-blue-600 mt-1 tracking-tight block">
                  Rp {sale.total_amount.toLocaleString('id-ID')}
                </output>
              </>
            )}
            
            {/* Direct Instructions */}
            <aside id="qris-customer-instruction-aside" className="bg-blue-50 border border-blue-100 rounded-lg p-2 mt-2 text-[11px] text-blue-800 font-semibold leading-relaxed">
              Minta pelanggan untuk men-scan QRIS statis di kasir dan bayar sesuai nominal di atas.
            </aside>
          </section>
        </article>

        {/* Manual Verification Info */}
        <section id="qris-countdown-timer-section" className="flex flex-col items-center gap-1 text-center w-full">
          <div className="flex items-center gap-2 text-on-surface-variant font-label-md text-label-md">
            <Smartphone size={16} className="text-secondary animate-pulse" />
            <span>Periksa mutasi di HP Anda, kemudian klik konfirmasi:</span>
          </div>
          <time id="qris-countdown-timer" className="text-display-price text-[28px] font-bold text-error tracking-tight font-mono block">
            {formattedTime}
          </time>
        </section>

        {/* Modal Action Buttons Footer */}
        <footer id="qris-modal-footer" className="w-full flex flex-col gap-2">
          {/* Manual Confirm Button */}
          <button
            id="btn-confirm-qris-manual"
            onClick={handleConfirmManual}
            disabled={confirming || cancelling}
            className="w-full bg-accent-green hover:bg-accent-green/90 text-white font-label-lg text-label-lg font-bold rounded-xl py-3 flex items-center justify-center gap-2 border border-emerald-600/30 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            {confirming ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                MENGONFIRMASI...
              </>
            ) : (
              <>
                <CheckCircle size={20} />
                KONFIRMASI MANUAL (SUDAH BAYAR)
              </>
            )}
          </button>

          {/* Action button */}
          <button
            id="btn-cancel-qris-transaction"
            onClick={handleCancel}
            disabled={cancelling || confirming}
            className="w-full bg-error-container hover:bg-error-container/90 text-on-error-container font-label-lg text-label-lg font-bold rounded-xl py-3 flex items-center justify-center gap-2 border border-error transition-all disabled:opacity-50 cursor-pointer"
          >
            {cancelling ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                MEMBATALKAN...
              </>
            ) : (
              <>
                <XCircle size={20} />
                BATALKAN TRANSAKSI
              </>
            )}
          </button>
        </footer>

      </section>
    </dialog>
  );
}
