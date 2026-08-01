"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Loader2, PackagePlus } from 'lucide-react';

interface QuickAddProductModalProps {
  barcode: string;
  onSaved: (product: {
    id: string;
    barcode: string;
    name: string;
    price: number;
  }) => void;
  onClose: () => void;
}

const DEFAULT_CATEGORIES = [
  'Makanan', 'Minuman', 'Snack', 'Bumbu Dapur', 'Rokok',
  'Sabun & Deterjen', 'ATK', 'Obat', 'Es Krim', 'Lainnya',
] as const;

/**
 * Quick Add Product Modal — triggered when barcode scanner returns 404.
 * Minimal fields for speed: barcode (read-only), name (autofocus), sell_price, category.
 * On save: POST to /api/products/quick-add → returns new product → injected into cart.
 */
export default function QuickAddProductModal({ barcode, onSaved, onClose }: QuickAddProductModalProps) {
  const [name, setName]         = useState('');
  const [priceStr, setPriceStr] = useState('');
  const [category, setCategory] = useState('Lainnya');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  // Autofocus on product name input when modal opens
  useEffect(() => {
    const timer = setTimeout(() => nameRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, []);

  // Close on Escape
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

  const price = parseInt(priceStr.replace(/\D/g, ''), 10) || 0;
  const canSubmit = name.trim().length > 0 && price > 0 && !saving;

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/products/quick-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode,
          name: name.trim(),
          sell_price: price,
          category,
        }),
      });

      if (res.status === 409) {
        setError('Barcode ini sudah terdaftar di database.');
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error?.message || 'Gagal menyimpan produk.');
        return;
      }

      const product = await res.json();
      onSaved({
        id:      product.id,
        barcode: product.barcode,
        name:    product.name,
        price:   Number(product.sell_price),
      });
    } catch {
      setError('Koneksi bermasalah. Periksa server.');
    } finally {
      setSaving(false);
    }
  }, [canSubmit, barcode, name, price, category, onSaved]);

  return (
    <dialog
      id="quick-add-product-dialog"
      open
      aria-modal="true"
      aria-labelledby="quick-add-product-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm w-full h-full border-none p-0"
      onClick={onClose}
    >
      <section
        id="quick-add-product-card"
        className="bg-surface-container rounded-2xl border border-outline-variant p-6 w-full max-w-md mx-4 flex flex-col gap-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <header id="quick-add-product-header" className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary-container rounded-lg">
              <PackagePlus size={18} className="text-on-primary-container" />
            </div>
            <div>
              <h3 id="quick-add-product-title" className="font-label-lg text-label-lg font-bold text-on-surface leading-tight">
                Produk Baru Terdeteksi
              </h3>
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                Barcode belum terdaftar — tambahkan cepat
              </p>
            </div>
          </div>
          <button
            id="btn-close-quick-add-product-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-container-highest transition-colors text-on-surface-variant hover:text-on-surface"
            aria-label="Tutup Modal Tambah Produk Baru"
          >
            <X size={18} />
          </button>
        </header>

        <form id="quick-add-product-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Barcode — read-only */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="input-quick-add-barcode" className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              Barcode
            </label>
            <input
              id="input-quick-add-barcode"
              type="text"
              value={barcode}
              readOnly
              className="bg-surface-dim border border-outline-variant/50 rounded-lg px-3 py-2.5 text-on-surface/60 font-mono font-label-md text-label-md cursor-not-allowed"
            />
          </div>

          {/* Product Name — autofocused */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="input-quick-add-name" className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              Nama Produk <span className="text-error">*</span>
            </label>
            <input
              id="input-quick-add-name"
              ref={nameRef}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Contoh: Teh Pucuk 350ml"
              className="bg-surface-dim border border-outline-variant rounded-lg px-3 py-2.5 text-on-surface font-label-md text-label-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors placeholder:text-on-surface-variant/40"
              disabled={saving}
              required
            />
          </div>

          {/* Selling Price */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="input-quick-add-price" className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              Harga Jual <span className="text-error">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-label-md text-label-md">
                Rp
              </span>
              <input
                id="input-quick-add-price"
                type="text"
                value={priceStr ? Number(priceStr.replace(/[^0-9]/g, '')).toLocaleString('id-ID') : ''}
                onChange={e => setPriceStr(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="0"
                className="w-full bg-surface-dim border border-outline-variant rounded-lg px-3 py-2.5 pl-10 text-on-surface font-label-md text-label-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors placeholder:text-on-surface-variant/40"
                disabled={saving}
                required
              />
            </div>
          </div>

          {/* Category */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="select-quick-add-category" className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              Kategori
            </label>
            <select
              id="select-quick-add-category"
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="bg-surface-dim border border-outline-variant rounded-lg px-3 py-2.5 text-on-surface font-label-md text-label-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
              disabled={saving}
            >
              {DEFAULT_CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Error */}
          {error && (
            <div id="quick-add-product-error" className="bg-error-container text-on-error-container font-label-sm text-label-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Actions */}
          <footer id="quick-add-product-footer" className="flex gap-2 pt-1">
            <button
              id="btn-cancel-quick-add-product"
              type="button"
              onClick={onClose}
              className="flex-1 bg-surface-container-highest hover:bg-surface-container-high border border-outline-variant text-on-surface font-label-md text-label-md rounded-lg py-2.5 transition-colors cursor-pointer"
              disabled={saving}
            >
              Batal
            </button>
            <button
              id="btn-submit-quick-add-product"
              type="submit"
              disabled={!canSubmit}
              className="flex-1 bg-primary-container hover:bg-primary-container/80 text-on-primary-container font-label-md text-label-md rounded-lg py-2.5 flex items-center justify-center gap-2 border border-primary/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {saving ? (
                <><Loader2 size={14} className="animate-spin" /> Menyimpan...</>
              ) : (
                'Simpan & Tambah ke Keranjang'
              )}
            </button>
          </footer>
        </form>
      </section>
    </dialog>
  );
}
