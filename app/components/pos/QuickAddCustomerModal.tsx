"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Loader2, UserPlus } from 'lucide-react';
import type { Customer } from '@/components/pos/PaymentPanel';

interface QuickAddCustomerModalProps {
  initialName: string;
  onSaved: (customer: Customer) => void;
  onClose: () => void;
}

const DEFAULT_CREDIT_LIMIT = 500_000;

/**
 * Quick Add Customer Modal — triggered from PaymentPanel when customer search
 * returns empty results during DEBT checkout.
 *
 * Auto-populates the name field with the search query, autofocuses on name
 * (cursor at end for easy editing), and supports full keyboard navigation.
 */
export default function QuickAddCustomerModal({ initialName, onSaved, onClose }: QuickAddCustomerModalProps) {
  const [name, setName]               = useState(initialName);
  const [phone, setPhone]             = useState('');
  const [creditLimitStr, setCreditLimitStr] = useState(DEFAULT_CREDIT_LIMIT.toLocaleString('id-ID'));
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  // Autofocus name input with cursor at end
  useEffect(() => {
    const timer = setTimeout(() => {
      if (nameRef.current) {
        nameRef.current.focus();
        nameRef.current.setSelectionRange(name.length, name.length);
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [name.length]);

  // Close on Escape — capture phase to intercept before useGlobalHotkeys
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [onClose]);

  const creditLimit = parseInt(creditLimitStr.replace(/\D/g, ''), 10) || DEFAULT_CREDIT_LIMIT;
  const canSubmit = name.trim().length > 0 && !saving;

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/customers/quick-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || undefined,
          credit_limit: creditLimit,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Gagal menyimpan pelanggan.');
        return;
      }

      const data = await res.json();
      onSaved(data.customer as Customer);
    } catch {
      setError('Koneksi bermasalah. Periksa server.');
    } finally {
      setSaving(false);
    }
  }, [canSubmit, name, phone, creditLimit, onSaved]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface-container rounded-2xl border border-outline-variant p-6 w-full max-w-md mx-4 flex flex-col gap-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-secondary-container rounded-lg">
              <UserPlus size={18} className="text-on-secondary-container" />
            </div>
            <div>
              <h3 className="font-label-lg text-label-lg font-bold text-on-surface leading-tight">
                Pelanggan Baru
              </h3>
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                Daftarkan cepat untuk pencatatan bon
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-container-highest transition-colors text-on-surface-variant hover:text-on-surface"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Customer Name — auto-populated & focused */}
          <div className="flex flex-col gap-1.5">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              Nama Pelanggan <span className="text-error">*</span>
            </label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nama lengkap pelanggan"
              className="bg-surface-dim border border-outline-variant rounded-lg px-3 py-2.5 text-on-surface font-label-md text-label-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors placeholder:text-on-surface-variant/40"
              disabled={saving}
            />
          </div>

          {/* Phone / WhatsApp */}
          <div className="flex flex-col gap-1.5">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              No. HP / WhatsApp <span className="normal-case text-on-surface-variant/50">(opsional, untuk pengingat)</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="0812xxxxxxxx"
              className="bg-surface-dim border border-outline-variant rounded-lg px-3 py-2.5 text-on-surface font-label-md text-label-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors placeholder:text-on-surface-variant/40"
              disabled={saving}
            />
          </div>

          {/* Credit Limit */}
          <div className="flex flex-col gap-1.5">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              Limit Kredit <span className="normal-case text-on-surface-variant/50">(default Rp 500.000)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-label-md text-label-md">
                Rp
              </span>
              <input
                type="text"
                value={creditLimitStr ? Number(creditLimitStr.replace(/[^0-9]/g, '')).toLocaleString('id-ID') : ''}
                onChange={e => setCreditLimitStr(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="500.000"
                className="w-full bg-surface-dim border border-outline-variant rounded-lg px-3 py-2.5 pl-10 text-on-surface font-label-md text-label-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors placeholder:text-on-surface-variant/40"
                disabled={saving}
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-error-container text-on-error-container font-label-sm text-label-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-surface-container-highest hover:bg-surface-container-high border border-outline-variant text-on-surface font-label-md text-label-md rounded-lg py-2.5 transition-colors"
              disabled={saving}
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 bg-secondary-container hover:bg-secondary-container/80 text-on-secondary-container font-label-md text-label-md rounded-lg py-2.5 flex items-center justify-center gap-2 border border-secondary/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? (
                <><Loader2 size={14} className="animate-spin" /> Menyimpan...</>
              ) : (
                'Simpan & Pilih'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
