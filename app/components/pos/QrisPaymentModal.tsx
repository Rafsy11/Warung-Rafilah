"use client";

import React, { useState, useCallback } from 'react';
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

  const handleCancel = useCallback(async () => {
    if (cancelling || confirming) return;
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
  }, [cancelling, confirming, sale.id, onCancel, showToast]);

  return (
    <dialog id="qris-payment-dialog" open aria-modal="true" aria-labelledby="qris-dialog-title" className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 w-full h-full border-none">
      <section id="qris-payment-card" className="bg-surface-container-lowest rounded-2xl border border-outline-variant max-w-md w-full max-h-[90dvh] overflow-y-auto p-6 shadow-2xl flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-200">
        
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

          <h3 id="qris-merchant-name" className="font-bold text-sm uppercase tracking-wide text-gray-800 text-center w-full">
            WARUNG RAFILAH
          </h3>
          <address id="qris-merchant-address" className="text-xs text-gray-400 text-center mb-3 not-italic">
            Jl. Mawar No.2335, RT 08, RW 02, Sukajaya
          </address>

          <p className="text-sm text-center text-gray-700 py-4">Gunakan QRIS fisik yang terpasang di kasir.</p>

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
                <div className="text-xs text-gray-500 uppercase tracking-wide">Nominal Transfer QRIS</div>
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
                <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">Nominal Transfer QRIS</div>
                <output id="qris-transfer-amount-output" className="font-mono text-3xl font-extrabold text-blue-600 mt-0.5 tracking-tight block">
                  Rp {(sale.payment_received || sale.total_amount).toLocaleString('id-ID')}
                </output>
                <div id="qris-cash-change-alert-card" className="mt-2 bg-emerald-50 border border-emerald-200 rounded-lg p-2 flex flex-col items-center">
                  <div className="flex items-center justify-between w-full text-xs font-bold text-emerald-800">
                    <span>💵 Kembalian Tunai:</span>
                    <output id="qris-cash-change-amount-output" className="font-mono text-base font-extrabold text-emerald-700">Rp {sale.change_given.toLocaleString('id-ID')}</output>
                  </div>
                  <p id="qris-cash-change-instruction" className="text-xs text-emerald-700 font-medium mt-0.5 text-center">
                    Serahkan Rp {sale.change_given.toLocaleString('id-ID')} uang tunai dari laci kasir ke pelanggan.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Total Nominal Transfer</div>
                <output id="qris-direct-total-output" className="font-mono text-3xl font-extrabold text-blue-600 mt-1 tracking-tight block">
                  Rp {sale.total_amount.toLocaleString('id-ID')}
                </output>
              </>
            )}
            
            {/* Direct Instructions */}
            <aside id="qris-customer-instruction-aside" className="bg-blue-50 border border-blue-100 rounded-lg p-2 mt-2 text-xs text-blue-800 font-semibold leading-relaxed">
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
          <p className="text-body-sm text-on-surface-variant">Transaksi tetap tertunda sampai pembayaran dikonfirmasi atau dibatalkan. Periksa mutasi sebelum membatalkan.</p>
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
