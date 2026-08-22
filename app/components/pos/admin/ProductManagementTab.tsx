"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Package, Trash2, Plus, Search, Loader2, Tag, Edit2, X, AlertCircle, Save, TrendingDown, ShieldAlert, CalendarX2, Camera } from 'lucide-react';
import CameraScannerModal from '../CameraScannerModal';
import { Product } from '../AdminWorkspace';


interface ProductManagementTabProps {
  products: Product[];
  totalProductsCount?: number;
  loading: boolean;
  fetchProducts: (query?: string) => Promise<void>;
  onToast: (msg: string, type: 'success' | 'error') => void;
  handleOpenTiersModal: (prod: Product) => void;
  scannedBarcode?: { code: string; timestamp: number } | null;
}

export default function ProductManagementTab({
  products,
  totalProductsCount,
  loading,
  fetchProducts,
  onToast,
  handleOpenTiersModal,
  scannedBarcode
}: ProductManagementTabProps) {
  const nowDate = new Date();
  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [cameraScanTarget, setCameraScanTarget] = useState<'search' | 'form' | null>(null);


  // Computed stats from existing products data — no extra fetch needed
  const stats = useMemo(() => {
    const total = totalProductsCount !== undefined && totalProductsCount > 0 ? totalProductsCount : products.length;
    const lowStock = products.filter(p => Number(p.stock_qty) <= Number(p.reorder_threshold)).length;
    const expiringSoon = products.filter(p => {
      if (!p.nearest_expiry_date) return false;
      const exp = new Date(p.nearest_expiry_date);
      return exp <= sevenDaysLater && exp >= nowDate;
    }).length;
    return { total, lowStock, expiringSoon };
  }, [products, totalProductsCount, nowDate, sevenDaysLater]);


  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Field states (Product)
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('general');
  const [unit, setUnit] = useState('pcs');
  const [costPrice, setCostPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [stockQty, setStockQty] = useState('');
  const [reorderThreshold, setReorderThreshold] = useState('5');
  const [formError, setFormError] = useState('');

  // Consignment form states
  const [isConsignment, setIsConsignment] = useState(false);
  const [consignmentSupplierName, setConsignmentSupplierName] = useState('');
  const [consignmentCostShare, setConsignmentCostShare] = useState('');

  // Expiry date state
  const [nearestExpiryDate, setNearestExpiryDate] = useState('');

  // Listen to scanner events
  useEffect(() => {
    if (!scannedBarcode) return;
    const existing = products.find(p => p.barcode === scannedBarcode.code);
    const timer = setTimeout(() => {
      if (existing) {
        handleOpenEditForm(existing);
        onToast(`✓ Menscan produk terdaftar: ${existing.name}`, 'success');
      } else {
        handleOpenAddForm();
        setBarcode(scannedBarcode.code);
        onToast(`✓ Barcode baru terdeteksi: ${scannedBarcode.code}`, 'success');
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [scannedBarcode, products]);

  const handleOpenAddForm = () => {
    setEditingProduct(null);
    setBarcode('');
    setName('');
    setCategory('general');
    setUnit('pcs');
    setCostPrice('');
    setSellPrice('');
    setStockQty('');
    setReorderThreshold('5');
    setIsConsignment(false);
    setConsignmentSupplierName('');
    setConsignmentCostShare('');
    setNearestExpiryDate('');
    setFormError('');
    setShowForm(true);
  };

  const handleOpenEditForm = (prod: Product) => {
    setEditingProduct(prod);
    setBarcode(prod.barcode);
    setName(prod.name);
    setCategory(prod.category);
    setUnit(prod.unit);
    setCostPrice(prod.cost_price ? Math.round(Number(prod.cost_price)).toString() : '');
    setSellPrice(prod.sell_price ? Math.round(Number(prod.sell_price)).toString() : '');
    setStockQty(prod.stock_qty ? Math.round(Number(prod.stock_qty)).toString() : '');
    setReorderThreshold(prod.reorder_threshold ? Math.round(Number(prod.reorder_threshold)).toString() : '5');
    setIsConsignment(!!prod.is_consignment);
    setConsignmentSupplierName(prod.consignment_supplier_name || '');
    setConsignmentCostShare(prod.consignment_cost_share ? prod.consignment_cost_share.toString() : '');
    setNearestExpiryDate(prod.nearest_expiry_date ? prod.nearest_expiry_date.substring(0, 10) : '');
    setFormError('');
    setShowForm(true);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts(searchQuery);
  };

  const handleToggleSelectAllProducts = () => {
    if (selectedProductIds.length === products.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(products.map(p => p.id));
    }
  };

  const handleToggleProductSelection = (id: string) => {
    setSelectedProductIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleDeleteProduct = async (id: string, prodName: string) => {
    if (!confirm(`Apakah Anda yakin ingin menonaktifkan produk "${prodName}"? (Stok akan diset ke 0 dan produk diarsipkan)`)) return;
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) {
        onToast(`✓ Produk "${prodName}" berhasil dinonaktifkan.`, 'success');
        fetchProducts(searchQuery);
      } else {
        onToast('Gagal menonaktifkan produk.', 'error');
      }
    } catch {
      onToast('Koneksi database bermasalah.', 'error');
    }
  };

  const handleBulkDeleteProducts = async () => {
    if (selectedProductIds.length === 0) return;
    if (!confirm(`Apakah Anda yakin ingin menonaktifkan ${selectedProductIds.length} produk terpilih?`)) return;

    setSaving(true);
    let successCount = 0;
    try {
      for (const id of selectedProductIds) {
        const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
        if (res.ok) successCount++;
      }
      onToast(`✓ Berhasil menonaktifkan ${successCount} produk.`, 'success');
      setSelectedProductIds([]);
      fetchProducts(searchQuery);
    } catch {
      onToast('Terjadi kendala jaringan saat memproses bulk delete.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleInlineRestock = async (prod: Product, qty: number) => {
    setSaving(true);
    try {
      const res = await fetch('/api/products/adjust-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: prod.id,
          qtyChange: qty,
          movementType: 'restock',
          note: 'Restock cepat dari tabel Produk',
        }),
      });

      if (res.ok) {
        onToast(`✓ Berhasil menambahkan +${qty} stok untuk ${prod.name}.`, 'success');
        fetchProducts(searchQuery);
      } else {
        const err = await res.json();
        onToast(err.error?.message || 'Gagal menambahkan stok.', 'error');
      }
    } catch {
      onToast('Koneksi database bermasalah.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode || !name || !sellPrice || !stockQty) {
      setFormError('Harap lengkapi semua kolom wajib (*).');
      return;
    }

    const sellPriceNum = Number(sellPrice);
    const costPriceNum = costPrice ? Number(costPrice) : 0;
    const stockQtyNum = Number(stockQty);
    const reorderThresholdNum = reorderThreshold ? Number(reorderThreshold) : 5;

    if (isNaN(sellPriceNum) || sellPriceNum <= 0) {
      setFormError('Harga jual harus berupa angka positif.');
      return;
    }
    if (isNaN(costPriceNum) || costPriceNum < 0) {
      setFormError('Harga modal tidak boleh negatif.');
      return;
    }
    if (isNaN(stockQtyNum) || stockQtyNum < 0) {
      setFormError('Jumlah stok tidak boleh negatif.');
      return;
    }
    if (isNaN(reorderThresholdNum) || reorderThresholdNum < 0) {
      setFormError('Batas minimum stok tidak boleh negatif.');
      return;
    }

    if (isConsignment && (!consignmentSupplierName || !consignmentCostShare)) {
      setFormError('Untuk produk konsinyasi, harap lengkapi nama penitip dan setoran.');
      return;
    }

    const supplierCostShareNum = consignmentCostShare ? Number(consignmentCostShare) : null;

    setSaving(true);
    setFormError('');

    try {
      const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
      const method = editingProduct ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode,
          name,
          category,
          unit,
          cost_price: costPriceNum,
          sell_price: sellPriceNum,
          stock_qty: stockQtyNum,
          reorder_threshold: reorderThresholdNum,
          is_consignment: isConsignment,
          consignment_supplier_name: isConsignment ? consignmentSupplierName : null,
          consignment_cost_share: isConsignment ? supplierCostShareNum : null,
          nearest_expiry_date: nearestExpiryDate ? new Date(nearestExpiryDate).toISOString() : null,
        }),
      });

      if (res.ok) {
        onToast(editingProduct ? '✓ Produk berhasil diperbarui.' : '✓ Produk berhasil ditambahkan.', 'success');
        setShowForm(false);
        setEditingProduct(null);
        fetchProducts(searchQuery);
      } else {
        const errData = await res.json().catch(() => null);
        const errMsg = 
          typeof errData?.error === 'string' 
            ? errData.error 
            : (errData?.error?.message || errData?.message || 'Gagal menyimpan produk.');
        setFormError(errMsg);
      }
    } catch (err: any) {
      console.error('Save product error:', err);
      setFormError(err?.message || 'Gagal terhubung ke server.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* ── LEFT: Product Table ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-surface-container rounded-xl border border-outline-variant p-4 overflow-hidden">
        <div className="flex justify-between items-center mb-4 shrink-0">
          <div className="flex items-center gap-2">
            <Package size={20} className="text-secondary" />
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
              Daftar Produk & Stok
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {selectedProductIds.length > 0 && (
              <button
                onClick={handleBulkDeleteProducts}
                disabled={saving}
                className="bg-error-container hover:bg-error-container/85 text-on-error-container font-label-md text-label-md rounded-lg px-4 py-2 flex items-center gap-1.5 transition-all shadow-md border border-error/20 cursor-pointer"
              >
                <Trash2 size={16} />
                HAPUS TERPILIH ({selectedProductIds.length})
              </button>
            )}
            <button
              onClick={handleOpenAddForm}
              className="bg-secondary-container hover:bg-secondary-container/80 text-on-secondary-container font-label-md text-label-md rounded-lg px-4 py-2 flex items-center gap-1.5 transition-all shadow-md shadow-secondary/10 border border-secondary/20 cursor-pointer"
            >
              <Plus size={16} />
              TAMBAH PRODUK
            </button>
          </div>
        </div>

        {/* ── Product Stats Cards ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 mb-4 shrink-0">

          {/* Total SKU */}
          <div
            id="stat-total-produk"
            className="flex items-center gap-3 bg-primary-container/20 border border-primary/15 rounded-xl px-4 py-3 transition-all hover:bg-primary-container/30"
          >
            <div className="p-2 rounded-lg bg-primary-container shrink-0">
              <Package size={16} className="text-on-primary-container" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-widest leading-none mb-1">Total SKU</p>
              <p className="font-bold text-xl text-on-surface leading-none tabular-nums">
                {loading ? <span className="inline-block w-8 h-5 bg-outline-variant/40 rounded animate-pulse" /> : stats.total}
              </p>
            </div>
          </div>

          {/* Stok Kritis */}
          <div
            id="stat-stok-kritis"
            className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-all ${
              stats.lowStock > 0
                ? 'bg-amber-500/10 border-amber-500/25 hover:bg-amber-500/15'
                : 'bg-surface-container-low border-outline-variant/40 hover:bg-surface-container'
            }`}
          >
            <div className={`p-2 rounded-lg shrink-0 ${stats.lowStock > 0 ? 'bg-amber-500/20' : 'bg-surface-container-highest'}`}>
              <TrendingDown size={16} className={stats.lowStock > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-on-surface-variant'} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-widest leading-none mb-1">Stok Kritis</p>
              <p className={`font-bold text-xl leading-none tabular-nums ${stats.lowStock > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-on-surface'}`}>
                {loading ? <span className="inline-block w-8 h-5 bg-outline-variant/40 rounded animate-pulse" /> : stats.lowStock}
              </p>
            </div>
          </div>

          {/* Hampir Kadaluarsa */}
          <div
            id="stat-hampir-exp"
            className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-all ${
              stats.expiringSoon > 0
                ? 'bg-error-container/20 border-error/25 hover:bg-error-container/30'
                : 'bg-surface-container-low border-outline-variant/40 hover:bg-surface-container'
            }`}
          >
            <div className={`p-2 rounded-lg shrink-0 ${stats.expiringSoon > 0 ? 'bg-error-container' : 'bg-surface-container-highest'}`}>
              <CalendarX2 size={16} className={stats.expiringSoon > 0 ? 'text-on-error-container' : 'text-on-surface-variant'} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-widest leading-none mb-1">Hampir Exp</p>
              <p className={`font-bold text-xl leading-none tabular-nums ${stats.expiringSoon > 0 ? 'text-error' : 'text-on-surface'}`}>
                {loading ? <span className="inline-block w-8 h-5 bg-outline-variant/40 rounded animate-pulse" /> : stats.expiringSoon}
              </p>
            </div>
          </div>
        </div>

        {/* Search Bar */}

        <form onSubmit={handleSearchSubmit} className="flex gap-2 mb-4 shrink-0">
          <div className="relative flex-1">
            <input
              id="admin-product-search-input"
              type="text"
              placeholder="Cari produk berdasarkan nama / barcode..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-surface-dim border border-outline-variant rounded-lg px-3 py-2 pl-10 pr-10 text-on-surface font-label-md text-label-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors placeholder:text-on-surface-variant/40"
            />
            <Search size={18} className="absolute left-3 top-2.5 text-on-surface-variant/60" />
            <button
              type="button"
              onClick={() => setCameraScanTarget('search')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-on-surface-variant hover:text-secondary transition-colors cursor-pointer md:hidden"
              title="Scan Barcode via Kamera HP untuk Cari Produk"
              aria-label="Scan Barcode Kamera Admin"
            >
              <Camera size={18} />
            </button>
          </div>
          <button
            type="submit"
            className="bg-surface-container-highest border border-outline-variant text-on-surface font-label-md text-label-md rounded-lg px-5 hover:bg-surface-container-high transition-colors cursor-pointer"
          >
            Cari
          </button>
        </form>


        {/* Product Table */}
        <div className="flex-1 overflow-y-auto border border-outline-variant/30 rounded-lg bg-surface-dim">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-on-surface-variant">
              <Loader2 size={24} className="animate-spin mr-2" /> Loading data produk...
            </div>
          ) : products.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-on-surface-variant">
              Belum ada produk atau hasil pencarian nihil.
            </div>
          ) : (
            <>

              {/* ── Mobile Product List Cards (<640px) ── */}
              <div className="sm:hidden flex flex-col divide-y divide-outline-variant/20">
                {products.map(prod => (
                  <div key={prod.id} className="p-3.5 flex flex-col gap-2.5 bg-surface-container-low/40">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="font-bold text-sm text-on-surface leading-tight">{prod.name}</span>
                        <span className="font-mono text-[11px] text-on-surface-variant/70 mt-0.5">
                          {prod.barcode} • <span className="text-secondary font-semibold">{prod.category || 'Umum'}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleOpenEditForm(prod)}
                          className="p-2 rounded-lg bg-surface-container-high text-on-surface hover:text-secondary transition-colors cursor-pointer"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(prod.id, prod.name)}
                          className="p-2 rounded-lg bg-error-container/30 text-error hover:bg-error-container transition-colors cursor-pointer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-xs font-mono pt-1.5 border-t border-outline-variant/20 flex-wrap gap-2">
                      <span className="text-on-surface-variant">Modal: <strong>Rp {Number(prod.cost_price).toLocaleString('id-ID')}</strong></span>
                      <span className="text-primary font-bold text-sm">Jual: Rp {Number(prod.sell_price).toLocaleString('id-ID')}</span>
                      <span className={`px-2 py-0.5 rounded font-bold text-xs ${
                        Number(prod.stock_qty) <= Number(prod.reorder_threshold)
                          ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                          : 'bg-surface-container-high text-on-surface border border-outline-variant/40'
                      }`}>
                        Stok: {prod.stock_qty} {prod.unit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Desktop Product Table (>=640px) ── */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[650px]">
                  <thead>
                    <tr className="bg-surface-container border-b border-outline-variant font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider sticky top-0 z-10">
                      <th className="p-3 pl-4 text-center w-12">
                        <input
                          type="checkbox"
                          checked={products.length > 0 && selectedProductIds.length === products.length}
                          onChange={handleToggleSelectAllProducts}
                          className="w-4 h-4 accent-secondary rounded border-outline-variant cursor-pointer"
                        />
                      </th>
                      <th className="p-3">Barcode</th>
                      <th className="p-3">Nama Barang</th>
                      <th className="p-3">Kategori</th>
                      <th className="p-3 text-right">Modal</th>
                      <th className="p-3 text-right">Harga Jual</th>
                      <th className="p-3 text-center">Stok</th>
                      <th className="p-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="font-body-md text-body-md text-on-surface divide-y divide-outline-variant/20">
                    {products.map(prod => (
                      <tr key={prod.id} className={`hover:bg-surface-container-high/40 transition-colors ${selectedProductIds.includes(prod.id) ? 'bg-secondary-container/10' : ''}`}>
                        <td className="p-3 text-center w-12">
                          <input
                            type="checkbox"
                            checked={selectedProductIds.includes(prod.id)}
                            onChange={() => handleToggleProductSelection(prod.id)}
                            className="w-4 h-4 accent-secondary rounded border-outline-variant cursor-pointer"
                          />
                        </td>

                    <td className="p-3 font-mono text-[11px] opacity-75">{prod.barcode}</td>
                    <td className="p-3 font-semibold">
                      <div className="flex flex-col gap-0.5 text-left">
                        <span>{prod.name}</span>
                        {prod.is_consignment && (
                          <span className="text-[10px] bg-amber-950/40 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded w-fit leading-none font-bold uppercase tracking-wide">
                            Titipan: {prod.consignment_supplier_name}
                          </span>
                        )}
                        {prod.nearest_expiry_date && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded w-fit leading-none font-bold uppercase tracking-wide border mt-0.5 ${
                            new Date(prod.nearest_expiry_date) <= nowDate
                              ? 'bg-red-950/40 text-red-400 border-red-500/20'
                              : new Date(prod.nearest_expiry_date) <= sevenDaysLater
                              ? 'bg-amber-950/40 text-amber-400 border-amber-500/20'
                              : 'bg-surface-container-highest text-on-surface-variant/70 border-outline-variant/30'
                          }`}>
                            Exp: {new Date(prod.nearest_expiry_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 capitalize opacity-70">{prod.category}</td>
                    <td className="p-3 text-right font-mono text-on-surface-variant">
                      Rp {Number(prod.cost_price || 0).toLocaleString('id-ID')}
                    </td>
                    <td className="p-3 text-right font-mono">
                      <div className="flex flex-col items-end">
                        <span className="font-semibold text-on-surface">Rp {Number(prod.sell_price).toLocaleString('id-ID')}</span>
                        {prod.pricing_tiers && prod.pricing_tiers.length > 0 && (
                          <div className="flex flex-col items-end gap-0.5 mt-1 max-w-[150px]">
                            {prod.pricing_tiers.map((t) => (
                              <span key={t.id} className="text-[9px] bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 px-1 py-0.5 rounded leading-none shrink-0" title={`${t.name} (Min Qty: ${Number(t.min_qty)})`}>
                                {t.name}: Rp {Number(t.tier_price).toLocaleString('id-ID')} (≥{Number(t.min_qty)})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          Number(prod.stock_qty) <= Number(prod.reorder_threshold || 5)
                            ? 'bg-error-container text-on-error-container animate-pulse'
                            : 'bg-secondary-container/50 text-on-secondary-container'
                        }`}>
                          {Number(prod.stock_qty)} {prod.unit}
                        </span>
                        <input
                          type="number"
                          min="1"
                          placeholder="+Stok"
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const inputVal = (e.target as HTMLInputElement).value;
                              const qtyNum = Number(inputVal);
                              if (qtyNum > 0) {
                                await handleInlineRestock(prod, qtyNum);
                                (e.target as HTMLInputElement).value = '';
                              }
                            }
                          }}
                          className="w-12 bg-surface-container-highest border border-outline-variant/60 rounded px-1.5 py-0.5 text-center font-bold font-mono text-[9px] text-on-surface focus:border-primary outline-none"
                          title="Masukkan jumlah & tekan Enter untuk restock cepat"
                        />
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenTiersModal(prod)}
                          className="p-1.5 hover:bg-emerald-950 hover:text-emerald-400 rounded text-on-surface-variant transition-colors cursor-pointer"
                          title="Kelola Harga Grosir"
                        >
                          <Tag size={14} />
                        </button>
                        <button
                          onClick={() => handleOpenEditForm(prod)}
                          className="p-1.5 hover:bg-secondary-container hover:text-on-secondary-container rounded text-on-surface-variant transition-colors cursor-pointer"
                          title="Edit Produk"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(prod.id, prod.name)}
                          className="p-1.5 hover:bg-error-container hover:text-on-error-container rounded text-on-surface-variant transition-colors cursor-pointer"
                          title="Nonaktifkan Produk"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  </div>


      {/* ── RIGHT: Add / Edit Form Panel ─────────────────────────────────── */}
      {showForm && (
        <aside className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm sm:static sm:z-auto sm:bg-transparent sm:backdrop-blur-none flex items-end sm:items-stretch justify-center p-0 sm:p-0 sm:w-80 sm:shrink-0 animate-in fade-in duration-150" onClick={() => setShowForm(false)}>
          <div className="w-full sm:w-80 max-h-[90dvh] sm:max-h-full flex flex-col bg-surface-container rounded-t-3xl sm:rounded-xl border border-outline-variant p-4 overflow-y-auto shadow-2xl sm:shadow-none animate-in slide-in-from-bottom sm:slide-in-from-right duration-200" onClick={(e) => e.stopPropagation()}>


          <div className="flex justify-between items-center mb-4 shrink-0">
            <h3 className="font-label-lg text-label-lg font-bold text-on-surface">
              {editingProduct ? 'EDIT PRODUK' : 'TAMBAH PRODUK BARU'}
            </h3>
            <button
              onClick={() => setShowForm(false)}
              className="p-1 hover:bg-surface-container-high rounded text-on-surface-variant transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmitForm} className="flex flex-col gap-4">
            {/* Barcode */}
            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                Barcode / PLU *
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={barcode}
                  onChange={e => setBarcode(e.target.value)}
                  placeholder="Contoh: 89912345"
                  className="w-full bg-surface-dim border border-outline-variant rounded-lg pl-3 pr-10 py-2 text-on-surface font-label-md text-label-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors font-mono"
                  required
                  disabled={saving || (editingProduct !== null)}
                />
                {!editingProduct && (
                  <button
                    type="button"
                    onClick={() => setCameraScanTarget('form')}
                    className="absolute right-2 p-1.5 bg-secondary-container hover:bg-secondary hover:text-white text-on-secondary-container rounded-md transition-colors cursor-pointer md:hidden"
                    title="Scan Barcode Kemasan Produk via Kamera HP"
                    aria-label="Scan Barcode Form Admin"
                  >
                    <Camera size={16} />
                  </button>
                )}
              </div>
            </div>


            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                Nama Barang *
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Nama produk lengkap"
                className="bg-surface-dim border border-outline-variant rounded-lg px-3 py-2 text-on-surface font-label-md text-label-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors"
                required
                disabled={saving}
              />
            </div>

            {/* Category & Unit */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                  Kategori
                </label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="bg-surface-dim border border-outline-variant rounded-lg px-3 py-2 text-on-surface font-label-md text-label-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors"
                  disabled={saving}
                >
                  <option value="general">Umum</option>
                  <option value="Makanan">Makanan</option>
                  <option value="Minuman">Minuman</option>
                  <option value="Sembako">Sembako</option>
                  <option value="Rokok">Rokok</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                  Satuan
                </label>
                <input
                  type="text"
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  placeholder="pcs"
                  className="bg-surface-dim border border-outline-variant rounded-lg px-3 py-2 text-on-surface font-label-md text-label-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors"
                  disabled={saving}
                />
              </div>
            </div>

            {/* Cost & Sell Price */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                  Harga Modal (Rp)
                </label>
                <input
                  type="text"
                  value={costPrice ? Number(costPrice.replace(/[^0-9]/g, '')).toLocaleString('id-ID') : ''}
                  onChange={e => setCostPrice(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="0"
                  className="bg-surface-dim border border-outline-variant rounded-lg px-3 py-2 text-on-surface font-label-md text-label-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors"
                  disabled={saving}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                  Harga Jual (Rp) *
                </label>
                <input
                  type="text"
                  value={sellPrice ? Number(sellPrice.replace(/[^0-9]/g, '')).toLocaleString('id-ID') : ''}
                  onChange={e => setSellPrice(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="0"
                  className="bg-surface-dim border border-outline-variant rounded-lg px-3 py-2 text-on-surface font-label-md text-label-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors"
                  required
                  disabled={saving}
                />
              </div>
            </div>

            {/* Stock Qty & Reorder Limit */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                  Stok Saat Ini *
                </label>
                <input
                  type="text"
                  value={stockQty ? Number(stockQty.replace(/[^0-9]/g, '')).toLocaleString('id-ID') : ''}
                  onChange={e => setStockQty(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="0"
                  className="bg-surface-dim border border-outline-variant rounded-lg px-3 py-2 text-on-surface font-label-md text-label-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors"
                  required
                  disabled={saving}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                  Batas Min Stok
                </label>
                <input
                  type="text"
                  value={reorderThreshold ? Number(reorderThreshold.replace(/[^0-9]/g, '')).toLocaleString('id-ID') : ''}
                  onChange={e => setReorderThreshold(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="5"
                  className="bg-surface-dim border border-outline-variant rounded-lg px-3 py-2 text-on-surface font-label-md text-label-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors"
                  disabled={saving}
                />
              </div>
            </div>

            {/* Consignment Fields */}
            <div className="flex flex-col gap-3 p-3 bg-surface-container-high rounded-lg border border-outline-variant/30 mt-1">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isConsignment"
                  checked={isConsignment}
                  onChange={e => setIsConsignment(e.target.checked)}
                  className="w-4 h-4 accent-secondary rounded border-outline-variant cursor-pointer"
                  disabled={saving}
                />
                <label htmlFor="isConsignment" className="font-label-md text-label-md font-bold text-on-surface cursor-pointer select-none">
                  Produk Konsinyasi (Barang Titipan)
                </label>
              </div>

              {isConsignment && (
                <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                      Nama Penitip *
                    </label>
                    <input
                      type="text"
                      value={consignmentSupplierName}
                      onChange={e => setConsignmentSupplierName(e.target.value)}
                      placeholder="e.g. Bu Joko"
                      required={isConsignment}
                      className="bg-surface-dim border border-outline-variant rounded-lg px-3 py-2 text-on-surface font-label-md text-label-md focus:border-secondary outline-none transition-colors"
                      disabled={saving}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                      Setoran Ke Supplier (Rp) *
                    </label>
                    <input
                      type="number"
                      value={consignmentCostShare}
                      onChange={e => setConsignmentCostShare(e.target.value)}
                      placeholder="0"
                      min="0"
                      required={isConsignment}
                      className="bg-surface-dim border border-outline-variant rounded-lg px-3 py-2 text-on-surface font-label-md text-label-md focus:border-secondary outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                      disabled={saving}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Expiry Date Field */}
            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                Tanggal Kedaluwarsa Terdekat
              </label>
              <input
                type="date"
                value={nearestExpiryDate}
                onChange={e => setNearestExpiryDate(e.target.value)}
                className="bg-surface-dim border border-outline-variant rounded-lg px-3 py-2 text-on-surface font-label-md text-label-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors"
                disabled={saving}
              />
            </div>

            {/* Error Message */}
            {formError && (
              <div className="flex items-center gap-2 bg-error-container text-on-error-container rounded-lg p-3 font-body-md text-body-md">
                <AlertCircle size={16} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={saving}
              className="bg-secondary-container hover:bg-secondary-container/80 text-on-secondary-container font-label-md text-label-md rounded-lg py-3 flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] shadow-md shadow-secondary/15 disabled:opacity-50 disabled:cursor-not-allowed border border-secondary/30 mt-2"
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Menyimpan...
                </>
              ) : (
                <>
                  <Save size={16} /> SIMPAN PRODUK
                </>
              )}
            </button>
          </form>
        </div>
      </aside>
    )}

    {/* Camera Barcode Scanner Modal for Admin */}
    {cameraScanTarget && (
      <CameraScannerModal
        onScanSuccess={(code) => {
          if (cameraScanTarget === 'search') {
            setSearchQuery(code);
            fetchProducts(code);
          } else if (cameraScanTarget === 'form') {
            setBarcode(code);
          }
          setCameraScanTarget(null);
        }}
        onClose={() => setCameraScanTarget(null)}
      />
    )}
  </>
);
}



