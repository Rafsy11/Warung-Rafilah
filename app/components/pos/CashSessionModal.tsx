"use client";

import React, { useState } from 'react';
import { Wallet, AlertCircle, Loader2, LogOut } from 'lucide-react';

interface CashSession {
  id: string;
  cashier_id: string;
  opened_at: string;
  starting_cash: string;
  status: 'open' | 'closed';
}

interface CashSessionModalProps {
  mode: 'open' | 'close';
  onSuccess: (session: CashSession | null) => void;
  onClose?: () => void;
}

export default function CashSessionModal({ mode, onSuccess, onClose }: CashSessionModalProps) {
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (isNaN(val) || val < 0) {
      setError(
        mode === 'open' 
          ? 'Modal awal harus berupa angka valid dan tidak negatif.' 
          : 'Uang fisik laci harus berupa angka valid dan tidak negatif.'
      );
      return;
    }

    setLoading(true);
    setError('');

    try {
      const url = mode === 'open' ? '/api/cashier-sessions/open' : '/api/cashier-sessions/close';
      const payload = mode === 'open' 
        ? { startingCash: val } 
        : { actualCash: val, notes: notes.trim() || undefined };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        if (mode === 'open') {
          onSuccess(data.session);
        } else {
          // Tutup shift selesai, pass null agar halaman POS tahu session_id kosong
          onSuccess(null);
          alert(
            `Shift berhasil ditutup!\n\n` +
            `Expected Cash: Rp ${Number(data.session.expected_cash).toLocaleString('id-ID')}\n` +
            `Actual Cash: Rp ${Number(data.session.actual_cash).toLocaleString('id-ID')}\n` +
            `Selisih: Rp ${Number(data.session.cash_difference).toLocaleString('id-ID')}`
          );
        }
      } else {
        setError(data.error || 'Terjadi kesalahan sistem.');
      }
    } catch {
      setError('Koneksi bermasalah dengan server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
      <div className="bg-surface-container rounded-2xl border border-outline-variant p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-2.5 mb-4 border-b border-outline-variant/30 pb-3">
          <div className="p-2 bg-secondary-container text-on-secondary-container rounded-lg">
            <Wallet size={20} />
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
            {mode === 'open' ? 'Buka Sesi Kasir' : 'Tutup Sesi (Rekonsiliasi Kas)'}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'open' ? (
            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                Modal Awal di Laci Kasir (Cash Float) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-3 text-sm text-on-surface-variant">Rp</span>
                <input
                  type="text"
                  placeholder="Misal: 100.000"
                  value={amount ? Number(amount.replace(/[^0-9]/g, '')).toLocaleString('id-ID') : ''}
                  onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full bg-surface-dim border border-outline-variant rounded-xl px-3.5 py-3 pl-10 text-on-surface font-label-md text-label-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-all font-semibold"
                  required
                  disabled={loading}
                />
              </div>
              <p className="text-[11px] text-on-surface-variant/70 leading-relaxed">
                Masukkan jumlah uang kertas/logam awal di dalam laci kasir untuk modal kembalian.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                  Hitungan Uang Fisik Aktual di Laci *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-sm text-on-surface-variant">Rp</span>
                  <input
                    type="text"
                    placeholder="Hitung semua uang tunai saat ini"
                    value={amount ? Number(amount.replace(/[^0-9]/g, '')).toLocaleString('id-ID') : ''}
                    onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full bg-surface-dim border border-outline-variant rounded-xl px-3.5 py-3 pl-10 text-on-surface font-label-md text-label-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-all font-semibold"
                    required
                    disabled={loading}
                  />
                </div>
                <p className="text-[11px] text-on-surface-variant/70 leading-relaxed">
                  Harap hitung semua uang tunai fisik yang ada di laci saat ini secara presisi.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                  Catatan / Keterangan
                </label>
                <textarea
                  placeholder="Opsional: Tulis alasan jika terjadi selisih kas..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full bg-surface-dim border border-outline-variant rounded-xl px-3.5 py-2.5 text-on-surface font-label-md text-label-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-all h-20 resize-none"
                  disabled={loading}
                />
              </div>
            </>
          )}

          {error && (
            <div className="flex items-center gap-2 bg-error-container text-on-error-container rounded-lg p-3 font-body-md text-body-md">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-outline-variant/30 pt-4 mt-2">
            {mode === 'close' && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="bg-surface-container-highest border border-outline-variant text-on-surface font-label-md text-label-md rounded-lg px-4 py-2 hover:bg-surface-container-high transition-colors"
                disabled={loading}
              >
                Batal
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="bg-secondary-container hover:bg-secondary-container/85 text-on-secondary-container font-label-md text-label-md font-bold rounded-lg px-5 py-2.5 flex items-center gap-1.5 transition-all shadow-md cursor-pointer ml-auto"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : mode === 'open' ? (
                'BUKA SHIFT BARU'
              ) : (
                <>
                  <LogOut size={16} /> TUTUP SHIFT KASIR
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
