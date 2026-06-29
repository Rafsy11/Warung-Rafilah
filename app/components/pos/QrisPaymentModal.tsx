"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, XCircle, RefreshCw, CheckCircle } from 'lucide-react';

type QrisPaymentModalProps = {
  sale: {
    id: string;
    transaction_code: string;
    total_amount: number;
    original_amount: number;
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
  const [checking, setChecking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
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
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
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

  // Poll transaction status
  useEffect(() => {
    const checkStatus = async () => {
      if (cancelling) return;
      try {
        setChecking(true);
        const res = await fetch(`/api/sales/status?id=${sale.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'completed') {
            clearInterval(pollIntervalRef.current!);
            onSuccess();
          } else if (data.status === 'voided') {
            clearInterval(pollIntervalRef.current!);
            onCancel('Transaksi telah dibatalkan.');
          }
        }
      } catch (err) {
        console.error('Error checking sale status:', err);
      } finally {
        setChecking(false);
      }
    };

    // Run initial check and then interval
    checkStatus();
    pollIntervalRef.current = setInterval(checkStatus, 2500);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [sale.id, onSuccess, onCancel, cancelling]);

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
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant max-w-md w-full p-unit-6 shadow-2xl flex flex-col items-center gap-unit-4 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="w-full text-center">
          <h2 className="text-headline-md font-bold text-on-surface">Menunggu Pembayaran</h2>
          <p className="text-body-sm text-on-surface-variant font-medium mt-1">Kode Transaksi: {sale.transaction_code}</p>
        </div>

        {/* QRIS Card Container */}
        <div className="w-full bg-white rounded-xl p-4 flex flex-col items-center shadow-inner border border-outline/10 text-black">
          
          {/* QRIS Logo area */}
          <div className="w-full flex justify-between items-center border-b border-gray-100 pb-2 mb-3">
            <div className="flex items-center gap-1">
              {/* Fake red/blue logo block for QRIS brand feel */}
              <span className="text-[14px] font-black tracking-tighter text-red-600">QR</span>
              <span className="text-[14px] font-black tracking-tighter text-blue-600">IS</span>
              <span className="text-[9px] bg-red-600 text-white font-bold px-1 rounded ml-1">GPN</span>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-gray-500">NMID : ID1020260233917</div>
            </div>
          </div>

          <div className="font-bold text-[15px] uppercase tracking-wide text-gray-800 text-center w-full">
            WARUNG RAFILAH
          </div>
          <div className="text-[10px] text-gray-400 text-center mb-3">
            Jl. Mawar No.2335, RT 08, RW 02, Sukajaya
          </div>

          {/* SVG Stylized QR Code Pattern */}
          <div className="relative w-48 h-48 bg-white border border-gray-200 rounded-lg p-2 flex items-center justify-center">
            <svg width="100%" height="100%" viewBox="0 0 100 100" className="text-gray-900">
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
            <div className="absolute inset-0 bg-white/20 backdrop-blur-[0.5px] flex items-center justify-center rounded-lg">
              <div className="bg-white p-2 rounded-lg shadow-md border border-gray-100 flex flex-col items-center justify-center">
                <Loader2 size={32} className="text-blue-600 animate-spin" />
              </div>
            </div>
          </div>

          {/* Amount to pay */}
          <div className="w-full text-center mt-4 border-t border-dashed border-gray-200 pt-3">
            {sale.split_qris_amount !== undefined && sale.split_qris_amount > 0 ? (
              <>
                <div className="flex justify-between items-center text-xs text-gray-600 mb-1">
                  <span>Nominal Tunai (Cash):</span>
                  <span className="font-bold text-gray-800">Rp {sale.split_cash_amount?.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-gray-600 border-b border-gray-100 pb-2 mb-2">
                  <span>Total Transaksi:</span>
                  <span className="font-semibold text-gray-800">Rp {sale.total_amount.toLocaleString('id-ID')}</span>
                </div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wide">Nominal Transfer QRIS</div>
                <div className="font-mono text-3xl font-extrabold text-blue-600 mt-1 tracking-tight">
                  Rp {sale.split_qris_amount.toLocaleString('id-ID')}
                </div>
              </>
            ) : (
              <>
                <div className="text-[10px] text-gray-500 uppercase tracking-wide">Total Nominal Transfer</div>
                <div className="font-mono text-3xl font-extrabold text-blue-600 mt-1 tracking-tight">
                  Rp {sale.total_amount.toLocaleString('id-ID')}
                </div>
              </>
            )}
            
            {/* Unique Suffix alert */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 mt-2 text-[11px] text-blue-800 font-semibold leading-relaxed">
              PENTING: Pelanggan wajib men-transfer nominal presisi (termasuk 3 digit terakhir) agar terbaca otomatis!
            </div>
          </div>
        </div>

        {/* Polling Spinner & Timer info */}
        <div className="flex flex-col items-center gap-1 text-center w-full">
          <div className="flex items-center gap-2 text-on-surface-variant font-label-md text-label-md">
            {checking ? (
              <RefreshCw size={16} className="animate-spin text-primary" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            )}
            <span>Menunggu pembayaran masuk...</span>
          </div>
          <div className="text-display-price text-[28px] font-bold text-error tracking-tight font-mono">
            {formattedTime}
          </div>
        </div>

        {/* Manual Confirm Button */}
        <button
          onClick={handleConfirmManual}
          disabled={confirming || cancelling}
          className="w-full mt-4 bg-accent-green hover:bg-accent-green/90 text-white font-label-lg text-label-lg font-bold rounded-xl py-unit-3 flex items-center justify-center gap-2 border border-emerald-600/30 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
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
          onClick={handleCancel}
          disabled={cancelling || confirming}
          className="w-full mt-2 bg-error-container hover:bg-error-container/90 text-on-error-container font-label-lg text-label-lg font-bold rounded-xl py-unit-3 flex items-center justify-center gap-2 border border-error transition-all disabled:opacity-50 cursor-pointer"
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

      </div>
    </div>
  );
}
