"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Scale, X, Plus, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { Product } from '../AdminWorkspace';

interface ProductConversionTabProps {
  products: Product[];
  fetchProducts: (query?: string) => Promise<void>;
  onToast: (msg: string, type: 'success' | 'error') => void;
}

export default function ProductConversionTab({
  products,
  fetchProducts,
  onToast
}: ProductConversionTabProps) {
  const [saving, setSaving] = useState(false);

  // Manual Conversion states
  const [sourceSearch, setSourceSearch] = useState('');
  const [sourceSuggestions, setSourceSuggestions] = useState<Product[]>([]);
  const [selectedSourceProduct, setSelectedSourceProduct] = useState<Product | null>(null);

  const [destSearch, setDestSearch] = useState('');
  const [destSuggestions, setDestSuggestions] = useState<Product[]>([]);
  const [selectedDestProduct, setSelectedDestProduct] = useState<Product | null>(null);

  const [convertSourceQty, setConvertSourceQty] = useState('1');
  const [convertRatio, setConvertRatio] = useState('');
  const [convertNote, setConvertNote] = useState('');
  const [convertError, setConvertError] = useState('');

  // Auto-Conversion Maps state
  const [conversionMaps, setConversionMaps] = useState<any[]>([]);
  const [loadingConversionMaps, setLoadingConversionMaps] = useState(false);
  const [mapError, setMapError] = useState('');

  // Map creation fields
  const [mapSourceProduct, setMapSourceProduct] = useState<Product | null>(null);
  const [mapDestProduct, setMapDestProduct] = useState<Product | null>(null);
  const [mapRatio, setMapRatio] = useState('');
  const [mapAutoConvert, setMapAutoConvert] = useState(true);

  // Map search fields
  const [mapSourceSearch, setMapSourceSearch] = useState('');
  const [mapSourceSuggestions, setMapSourceSuggestions] = useState<Product[]>([]);
  const [mapDestSearch, setMapDestSearch] = useState('');
  const [mapDestSuggestions, setMapDestSuggestions] = useState<Product[]>([]);

  // Quick split quantities
  const [quickConvertQtys, setQuickConvertQtys] = useState<Record<string, string>>({});

  const fetchConversionMaps = useCallback(async () => {
    setLoadingConversionMaps(true);
    try {
      const res = await fetch('/api/products/conversion-map');
      if (res.ok) {
        const data = await res.json();
        setConversionMaps(data.items || []);
      } else {
        onToast('Gagal memuat peta konversi.', 'error');
      }
    } catch {
      onToast('Koneksi bermasalah saat memuat peta konversi.', 'error');
    } finally {
      setLoadingConversionMaps(false);
    }
  }, [onToast]);

  // Load maps on mount
  useEffect(() => {
    fetchConversionMaps();
  }, [fetchConversionMaps]);

  // Lookups for manual conversion source
  useEffect(() => {
    if (sourceSearch.trim().length < 2) {
      setSourceSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(sourceSearch)}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setSourceSuggestions(data.items || []);
        }
      } catch (err) {
        console.error(err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [sourceSearch]);

  // Lookups for manual conversion destination
  useEffect(() => {
    if (destSearch.trim().length < 2) {
      setDestSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(destSearch)}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setDestSuggestions(data.items || []);
        }
      } catch (err) {
        console.error(err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [destSearch]);

  // Lookups for mapping creation source
  useEffect(() => {
    if (mapSourceSearch.trim().length < 2) {
      setMapSourceSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(mapSourceSearch)}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setMapSourceSuggestions(data.items || []);
        }
      } catch (err) {
        console.error(err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [mapSourceSearch]);

  // Lookups for mapping creation destination
  useEffect(() => {
    if (mapDestSearch.trim().length < 2) {
      setMapDestSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(mapDestSearch)}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setMapDestSuggestions(data.items || []);
        }
      } catch (err) {
        console.error(err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [mapDestSearch]);

  // Auto-fill destination product and ratio if source product is already mapped
  useEffect(() => {
    if (selectedSourceProduct && conversionMaps.length > 0) {
      const match = conversionMaps.find(m => m.source_product_id === selectedSourceProduct.id);
      if (match) {
        setSelectedDestProduct({
          id: match.dest_product_id,
          name: match.dest_name,
          barcode: match.dest_barcode,
          unit: match.dest_unit,
          stock_qty: match.dest_stock,
        } as any);
        setConvertRatio(match.conversion_ratio.toString());
      }
    }
  }, [selectedSourceProduct, conversionMaps]);

  const handleSubmitConversion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSourceProduct || !selectedDestProduct) {
      setConvertError('Harap pilih produk asal dan produk tujuan.');
      return;
    }
    const sourceQtyNum = Number(convertSourceQty);
    const ratioNum = Number(convertRatio);
    if (isNaN(sourceQtyNum) || sourceQtyNum <= 0) {
      setConvertError('Jumlah produk asal harus lebih besar dari 0.');
      return;
    }
    if (isNaN(ratioNum) || ratioNum <= 0) {
      setConvertError('Rasio konversi harus lebih besar dari 0.');
      return;
    }
    if (Number(selectedSourceProduct.stock_qty) < sourceQtyNum) {
      setConvertError(`Stok produk asal tidak mencukupi (Tersedia: ${selectedSourceProduct.stock_qty}).`);
      return;
    }

    setSaving(true);
    setConvertError('');

    try {
      const res = await fetch('/api/products/convert-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceProductId: selectedSourceProduct.id,
          destProductId: selectedDestProduct.id,
          sourceQty: sourceQtyNum,
          ratio: ratioNum,
          note: convertNote.trim() || undefined,
        }),
      });

      if (res.ok) {
        onToast(`✓ Berhasil mengonversi ${sourceQtyNum} ${selectedSourceProduct.name} menjadi ${sourceQtyNum * ratioNum} ${selectedDestProduct.name}.`, 'success');
        setSelectedSourceProduct(null);
        setSelectedDestProduct(null);
        setConvertSourceQty('1');
        setConvertRatio('');
        setConvertNote('');
        fetchProducts();
        fetchConversionMaps();
      } else {
        const err = await res.json();
        setConvertError(err.error?.message || 'Gagal memproses konversi.');
      }
    } catch {
      setConvertError('Koneksi database bermasalah.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitConversionMap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapSourceProduct || !mapDestProduct || !mapRatio) {
      setMapError('Harap lengkapi semua kolom wajib.');
      return;
    }
    const ratioNum = Number(mapRatio);
    if (isNaN(ratioNum) || ratioNum <= 0) {
      setMapError('Rasio konversi harus berupa angka positif.');
      return;
    }
    setSaving(true);
    setMapError('');

    try {
      const res = await fetch('/api/products/conversion-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_product_id: mapSourceProduct.id,
          dest_product_id: mapDestProduct.id,
          conversion_ratio: ratioNum,
          auto_convert: mapAutoConvert,
        }),
      });

      if (res.ok) {
        onToast('✓ Peta konversi berhasil disimpan.', 'success');
        setMapSourceProduct(null);
        setMapDestProduct(null);
        setMapRatio('');
        setMapAutoConvert(true);
        fetchConversionMaps();
      } else {
        const err = await res.json();
        setMapError(err.error || 'Gagal menyimpan peta konversi.');
      }
    } catch {
      setMapError('Koneksi database bermasalah.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickConvert = async (map: any) => {
    const qtyStr = quickConvertQtys[map.id] || '1';
    const sourceQtyNum = Number(qtyStr);
    const ratioNum = Number(map.conversion_ratio);

    if (isNaN(sourceQtyNum) || sourceQtyNum <= 0) {
      onToast('Jumlah harus lebih besar dari 0.', 'error');
      return;
    }

    if (Number(map.source_stock) < sourceQtyNum) {
      onToast(`Stok ${map.source_name} tidak mencukupi (Tersedia: ${map.source_stock}).`, 'error');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/products/convert-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceProductId: map.source_product_id,
          destProductId: map.dest_product_id,
          sourceQty: sourceQtyNum,
          ratio: ratioNum,
          note: 'Konversi cepat dari tabel peta',
        }),
      });

      if (res.ok) {
        onToast(`✓ Berhasil mengonversi ${sourceQtyNum} ${map.source_name} menjadi ${sourceQtyNum * ratioNum} ${map.dest_name}.`, 'success');
        setQuickConvertQtys(prev => ({ ...prev, [map.id]: '1' }));
        fetchProducts();
        fetchConversionMaps();
      } else {
        const err = await res.json();
        onToast(err.error?.message || 'Gagal memproses konversi.', 'error');
      }
    } catch {
      onToast('Koneksi database bermasalah.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConversionMap = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus peta konversi otomatis ini?')) return;
    try {
      const res = await fetch('/api/products/conversion-map', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        onToast('✓ Peta konversi berhasil dihapus.', 'success');
        fetchConversionMaps();
      } else {
        onToast('Gagal menghapus peta konversi.', 'error');
      }
    } catch {
      onToast('Koneksi bermasalah saat menghapus.', 'error');
    }
  };

  return (
    <section id="product-conversion-tab-container" className="flex-1 flex gap-3.5 overflow-hidden h-full w-full">
      {/* LEFT: Manual Conversion */}
      <div className="w-[450px] bg-surface-container rounded-xl border border-outline-variant p-5 flex flex-col shrink-0 overflow-y-auto">
        <div className="flex items-center gap-2 mb-4 shrink-0 border-b border-outline-variant/30 pb-3">
          <RefreshCw size={18} className="text-secondary" />
          <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
            Manual: Konversi Bungkus → Eceran
          </h3>
        </div>

        <form onSubmit={handleSubmitConversion} className="flex flex-col gap-4">
          {/* Source Product Search */}
          <div className="flex flex-col gap-1.5 relative">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              Produk Asal (Bungkus / Box) *
            </label>
            {selectedSourceProduct ? (
              <div className="flex justify-between items-center bg-surface-dim border border-outline-variant rounded-lg p-3">
                <div className="flex flex-col">
                  <span className="font-semibold text-on-surface text-sm">{selectedSourceProduct.name}</span>
                  <span className="text-xs text-on-surface-variant font-mono">
                    {selectedSourceProduct.barcode} | Stok: {Number(selectedSourceProduct.stock_qty)} {selectedSourceProduct.unit}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSourceProduct(null)}
                  className="p-1 hover:bg-surface-container-high rounded text-on-surface-variant transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Cari produk asal..."
                  value={sourceSearch}
                  onChange={e => setSourceSearch(e.target.value)}
                  className="w-full bg-surface-dim border border-outline-variant rounded-lg px-3 py-2 text-on-surface font-label-md text-label-md focus:border-secondary outline-none transition-colors"
                />
                {sourceSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 bg-surface-container-highest border border-outline-variant rounded-lg shadow-xl mt-1 py-1 max-h-48 overflow-y-auto">
                    {sourceSuggestions.map(p => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSelectedSourceProduct(p);
                          setSourceSearch('');
                          setSourceSuggestions([]);
                          setConvertError('');
                        }}
                        className="flex justify-between items-center px-4 py-2 cursor-pointer hover:bg-surface-container-high font-label-md text-label-md transition-colors"
                      >
                        <div className="flex flex-col text-left">
                          <span className="font-semibold">{p.name}</span>
                          <span className="text-[11px] opacity-60 font-mono">{p.barcode}</span>
                        </div>
                        <span className="text-right font-semibold">Stok: {Number(p.stock_qty)} {p.unit}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Destination Product Search */}
          <div className="flex flex-col gap-1.5 relative">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              Produk Tujuan (Batangan / Satuan) *
            </label>
            {selectedDestProduct ? (
              <div className="flex justify-between items-center bg-surface-dim border border-outline-variant rounded-lg p-3">
                <div className="flex flex-col">
                  <span className="font-semibold text-on-surface text-sm">{selectedDestProduct.name}</span>
                  <span className="text-xs text-on-surface-variant font-mono">
                    {selectedDestProduct.barcode} | Stok: {Number(selectedDestProduct.stock_qty)} {selectedDestProduct.unit}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDestProduct(null)}
                  className="p-1 hover:bg-surface-container-high rounded text-on-surface-variant transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Cari produk tujuan..."
                  value={destSearch}
                  onChange={e => setDestSearch(e.target.value)}
                  className="w-full bg-surface-dim border border-outline-variant rounded-lg px-3 py-2 text-on-surface font-label-md text-label-md focus:border-secondary outline-none transition-colors"
                />
                {destSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 bg-surface-container-highest border border-outline-variant rounded-lg shadow-xl mt-1 py-1 max-h-48 overflow-y-auto">
                    {destSuggestions.map(p => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSelectedDestProduct(p);
                          setDestSearch('');
                          setDestSuggestions([]);
                          setConvertError('');
                        }}
                        className="flex justify-between items-center px-4 py-2 cursor-pointer hover:bg-surface-container-high font-label-md text-label-md transition-colors"
                      >
                        <div className="flex flex-col text-left">
                          <span className="font-semibold">{p.name}</span>
                          <span className="text-[11px] opacity-60 font-mono">{p.barcode}</span>
                        </div>
                        <span className="text-right font-semibold">Stok: {Number(p.stock_qty)} {p.unit}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Conversion Values */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">Jumlah Bungkus *</label>
              <input
                type="number"
                min="1"
                value={convertSourceQty}
                onChange={e => setConvertSourceQty(e.target.value)}
                className="bg-surface-dim border border-outline-variant rounded-lg px-3 py-2 text-on-surface font-label-md text-label-md focus:border-secondary outline-none transition-colors"
                required
                disabled={saving}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">Rasio (Isi per Pack) *</label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 12"
                value={convertRatio}
                onChange={e => setConvertRatio(e.target.value)}
                className="bg-surface-dim border border-outline-variant rounded-lg px-3 py-2 text-on-surface font-label-md text-label-md focus:border-secondary outline-none transition-colors"
                required
                disabled={saving}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Catatan Opsional</label>
            <input
              type="text"
              placeholder="e.g. Buka bungkus baru"
              value={convertNote}
              onChange={e => setConvertNote(e.target.value)}
              className="bg-surface-dim border border-outline-variant rounded-lg px-3 py-2 text-on-surface font-label-md text-label-md focus:border-secondary outline-none transition-colors"
              disabled={saving}
            />
          </div>

          {/* Preview */}
          {selectedSourceProduct && selectedDestProduct && convertSourceQty && convertRatio && (
            <div className="bg-secondary-container/10 border border-secondary/20 rounded-xl p-3 flex flex-col gap-1 text-xs">
              <span className="font-semibold text-secondary uppercase tracking-wider">Preview Konversi</span>
              <p className="text-on-surface">
                Mengurangi <strong className="text-error">{convertSourceQty} {selectedSourceProduct.unit}</strong> dari {selectedSourceProduct.name}
              </p>
              <p className="text-on-surface">
                Menambah <strong className="text-emerald-400">{(Number(convertSourceQty) * Number(convertRatio)) || 0} {selectedDestProduct.unit}</strong> ke {selectedDestProduct.name}
              </p>
            </div>
          )}

          {convertError && (
            <div className="flex items-center gap-2 bg-error-container text-on-error-container rounded-lg p-3 font-body-md text-body-md">
              <AlertCircle size={16} className="shrink-0" />
              <span>{convertError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={saving || !selectedSourceProduct || !selectedDestProduct || !convertSourceQty || !convertRatio}
            className="bg-secondary-container hover:bg-secondary-container/85 text-on-secondary-container font-label-md text-label-md font-bold rounded-xl py-3 flex items-center justify-center gap-2 transition-all active:scale-[0.98] border border-secondary/30 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer w-full"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : 'PROSES KONVERSI SEKARANG'}
          </button>
        </form>
      </div>

      {/* RIGHT: Auto-Conversion Maps */}
      <div className="flex-1 flex flex-col bg-surface-container rounded-xl border border-outline-variant p-5 overflow-hidden">
        <div className="flex items-center gap-2 mb-4 shrink-0 border-b border-outline-variant/30 pb-3">
          <Scale size={18} className="text-secondary" />
          <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
            Otomatis: Peta Auto-Split Kemasan Ritel
          </h3>
        </div>

        {/* Create Map Form */}
        <form onSubmit={handleSubmitConversionMap} className="bg-surface-dim border border-outline-variant/50 rounded-xl p-4 mb-4 flex flex-col gap-3 shrink-0">
          <span className="font-bold text-xs text-secondary uppercase tracking-wider">Hubungkan Produk & Auto-Split</span>
          
          <div className="grid grid-cols-2 gap-3">
            {/* Source Product */}
            <div className="flex flex-col gap-1.5 relative text-left">
              <label className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">Produk Kemasan Besar *</label>
              {mapSourceProduct ? (
                <div className="flex justify-between items-center bg-surface-container rounded-lg px-2.5 py-1.5 text-xs">
                  <span className="font-semibold text-on-surface truncate max-w-[120px]">{mapSourceProduct.name}</span>
                  <button type="button" onClick={() => setMapSourceProduct(null)} className="text-on-surface-variant hover:text-error ml-1"><X size={14} /></button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="e.g. Rokok Bungkus"
                    value={mapSourceSearch}
                    onChange={e => setMapSourceSearch(e.target.value)}
                    className="bg-surface-container border border-outline-variant/60 rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:border-secondary outline-none w-full"
                  />
                  {mapSourceSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 bg-surface-container-highest border border-outline-variant rounded-lg shadow-xl mt-1 py-1 max-h-36 overflow-y-auto">
                      {mapSourceSuggestions.map(p => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setMapSourceProduct(p);
                            setMapSourceSearch('');
                            setMapSourceSuggestions([]);
                            setMapError('');
                          }}
                          className="px-3 py-1.5 cursor-pointer hover:bg-surface-container-high text-xs transition-colors flex justify-between"
                        >
                          <span className="font-semibold truncate max-w-[100px]">{p.name}</span>
                          <span className="opacity-60 font-mono">Stok: {Number(p.stock_qty)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Dest Product */}
            <div className="flex flex-col gap-1.5 relative text-left">
              <label className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">Produk Satuan Eceran *</label>
              {mapDestProduct ? (
                <div className="flex justify-between items-center bg-surface-container rounded-lg px-2.5 py-1.5 text-xs">
                  <span className="font-semibold text-on-surface truncate max-w-[120px]">{mapDestProduct.name}</span>
                  <button type="button" onClick={() => setMapDestProduct(null)} className="text-on-surface-variant hover:text-error ml-1"><X size={14} /></button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="e.g. Rokok Batangan"
                    value={mapDestSearch}
                    onChange={e => setMapDestSearch(e.target.value)}
                    className="bg-surface-container border border-outline-variant/60 rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:border-secondary outline-none w-full"
                  />
                  {mapDestSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 bg-surface-container-highest border border-outline-variant rounded-lg shadow-xl mt-1 py-1 max-h-36 overflow-y-auto">
                      {mapDestSuggestions.map(p => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setMapDestProduct(p);
                            setMapDestSearch('');
                            setMapDestSuggestions([]);
                            setMapError('');
                          }}
                          className="px-3 py-1.5 cursor-pointer hover:bg-surface-container-high text-xs transition-colors flex justify-between"
                        >
                          <span className="font-semibold truncate max-w-[100px]">{p.name}</span>
                          <span className="opacity-60 font-mono">Stok: {Number(p.stock_qty)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 items-end">
            <div className="flex flex-col gap-1.5 col-span-2 text-left">
              <label className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">Rasio Konversi (1 Bungkus = N Batang) *</label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 12"
                value={mapRatio}
                onChange={e => setMapRatio(e.target.value)}
                className="bg-surface-container border border-outline-variant/60 rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:border-secondary outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={saving || !mapSourceProduct || !mapDestProduct || !mapRatio}
              className="bg-secondary-container hover:bg-secondary-container/85 border border-secondary/20 text-on-secondary-container font-label-md text-label-md font-bold rounded-lg py-2 flex items-center justify-center gap-1 cursor-pointer transition-all disabled:opacity-40"
            >
              <Plus size={14} /> Hubungkan
            </button>
          </div>

          {mapError && (
            <div className="text-[11px] text-error font-medium flex items-center gap-1">
              <AlertCircle size={12} /> {mapError}
            </div>
          )}
        </form>

        {/* Maps List Table */}
        <div className="flex-1 overflow-y-auto border border-outline-variant/30 rounded-lg bg-surface-dim">
          {loadingConversionMaps ? (
            <div className="flex items-center justify-center py-12 text-on-surface-variant text-xs">
              <Loader2 size={16} className="animate-spin mr-1.5" /> Loading...
            </div>
          ) : conversionMaps.length === 0 ? (
            <div className="text-center py-12 text-on-surface-variant opacity-60 text-xs italic">
              Belum ada hubungan auto-split yang terdaftar.
            </div>
          ) : (
            <table className="w-full text-left border-collapse font-label-md text-label-md">
              <thead>
                <tr className="bg-surface-container border-b border-outline-variant font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider sticky top-0 z-10">
                  <th className="p-2.5 pl-4">Produk Kemasan</th>
                  <th className="p-2.5">Rasio</th>
                  <th className="p-2.5">Produk Ritel</th>
                  <th className="p-2.5 text-center">Auto-Split</th>
                  <th className="p-2.5 text-center">Konversi Cepat</th>
                  <th className="p-2.5 text-center w-16">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {conversionMaps.map(m => (
                  <tr key={m.id} className="hover:bg-surface-container-high/40 transition-colors">
                    <td className="p-2.5 pl-4">
                      <div className="font-semibold text-on-surface text-xs">{m.source_name}</div>
                      <div className="text-[10px] text-on-surface-variant/70 font-mono">Stok: <strong className="text-secondary">{Number(m.source_stock)}</strong> {m.source_unit}</div>
                    </td>
                    <td className="p-2.5 font-mono text-xs font-bold text-primary">
                      1 → {m.conversion_ratio}
                    </td>
                    <td className="p-2.5">
                      <div className="font-semibold text-on-surface text-xs">{m.dest_name}</div>
                      <div className="text-[10px] text-on-surface-variant/70 font-mono">Stok: <strong className="text-secondary">{Number(m.dest_stock)}</strong> {m.dest_unit}</div>
                    </td>
                    <td className="p-2.5 text-center">
                      <span className="bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider leading-none">
                        Aktif
                      </span>
                    </td>
                    <td className="p-2.5">
                      <div className="flex items-center justify-center gap-1.5">
                        <input
                          type="number"
                          min="1"
                          value={quickConvertQtys[m.id] || '1'}
                          onChange={e => setQuickConvertQtys(prev => ({ ...prev, [m.id]: e.target.value }))}
                          className="w-14 bg-surface-container border border-outline-variant/60 rounded px-1.5 py-1 text-center font-bold font-mono text-xs text-on-surface focus:border-primary outline-none"
                          title="Jumlah bungkus yang ingin dikonversi"
                        />
                        <button
                          onClick={() => handleQuickConvert(m)}
                          disabled={saving}
                          className="bg-primary hover:bg-primary/85 text-white rounded px-2.5 py-1 font-bold text-[9px] uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Konversi instan"
                        >
                          <RefreshCw size={10} className={saving ? 'animate-spin' : ''} />
                          Split
                        </button>
                      </div>
                    </td>
                    <td className="p-2.5 text-center">
                      <button
                        onClick={() => handleDeleteConversionMap(m.id)}
                        className="p-1 hover:bg-error-container/20 rounded text-error transition-colors cursor-pointer"
                        title="Hapus Hubungan"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
