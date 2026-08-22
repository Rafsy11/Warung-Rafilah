import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Zap, X, ScanBarcode, Plus, Minus, Trash2, AlertCircle, Camera } from 'lucide-react';
import type { CartItem } from '@/types/pos';
import { refreshProductCache, searchProductsLocal } from '@/lib/cache/product-cache';
import CameraScannerModal from '@/components/pos/CameraScannerModal';


const SERVICES = [
  { type: 'e_wallet_topup',  label: 'E-Wallet Topup',  adminFee: 1000, commission: 1500 },
  { type: 'bill_payment',    label: 'Bayar Tagihan',    adminFee: 2500, commission: 2000 },
  { type: 'qris_deposit',    label: 'QRIS Deposit',     adminFee: 0,    commission: 500  },
  { type: 'cash_withdrawal', label: 'Tarik Tunai',      adminFee: 5000, commission: 3000 },
  { type: 'transfer',        label: 'Transfer Dana',    adminFee: 3000, commission: 2500 },
] as const;


export default function CartTable({
  items,
  mode,
  onScan,
  onRemove,
  onBulkRemove,
  onChangeQty,
  onAddDigitalItem,
}: {
  items: CartItem[];
  mode: 'warung' | 'agent';
  onScan: (barcode: string) => void;
  onRemove: (id: string) => void;
  onBulkRemove?: (ids: string[]) => void;
  onChangeQty?: (id: string, newQty: number) => void;
  onAddDigitalItem?: (item: CartItem) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; barcode: string; name: string; sell_price: string; stock_qty: string }[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selectedCartIds, setSelectedCartIds] = useState<string[]>([]);
  const [showCameraScanner, setShowCameraScanner] = useState(false);


  // Focus input on mount and whenever mode or items count changes
  useEffect(() => {
    inputRef.current?.focus();
  }, [mode, items.length]);

  // Layanan Digital states
  const [showDigitalModal, setShowDigitalModal] = useState(false);
  const [selectedService, setSelectedService] = useState<typeof SERVICES[number]>(SERVICES[0]);
  const [digitalPhone, setDigitalPhone] = useState('');
  const [digitalAmountStr, setDigitalAmountStr] = useState('');
  const [digitalError, setDigitalError] = useState('');

  // Item Non-Barcode states
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPriceStr, setCustomPriceStr] = useState('');
  const [customQtyStr, setCustomQtyStr] = useState('1');
  const [customError, setCustomError] = useState('');

  // Keep selection state in sync with items list
  useEffect(() => {
    const timer = setTimeout(() => {
      setSelectedCartIds(prev => prev.filter(id => items.some(item => item.id === id)));
    }, 0);
    return () => clearTimeout(timer);
  }, [items]);

  // Warm up product cache on mount
  useEffect(() => {
    refreshProductCache();
  }, []);

  // Fast debounced search for manual product lookup
  useEffect(() => {
    if (mode !== 'warung' || inputValue.trim().length < 2) {
      const timer = setTimeout(() => {
        setSearchResults([]);
        setSelectedIndex(-1);
      }, 0);
      return () => clearTimeout(timer);
    }

    // Try instant local cache first
    const localMatches = searchProductsLocal(inputValue, 5);
    if (localMatches.length > 0) {
      setSearchResults(localMatches);
      setSelectedIndex(0);
      return;
    }

    // Fallback to API search if local cache misses
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(inputValue)}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.items || []);
          setSelectedIndex(data.items && data.items.length > 0 ? 0 : -1);
        }
      } catch (err) {
        console.error('Error searching products:', err);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [inputValue, mode]);

  useEffect(() => {
    const onAddNonBarcode = () => {
      setCustomName(inputValue.trim());
      setShowCustomModal(true);
    };
    window.addEventListener('hotkey-add-non-barcode', onAddNonBarcode);
    return () => window.removeEventListener('hotkey-add-non-barcode', onAddNonBarcode);
  }, [inputValue]);

  const handleSelectProduct = useCallback(
    (barcode: string) => {
      onScan(barcode);
      setInputValue('');
      setSearchResults([]);
      setSelectedIndex(-1);
    },
    [onScan]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (searchResults.length > 0 ? (prev + 1) % searchResults.length : -1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev =>
          searchResults.length > 0 ? (prev - 1 + searchResults.length) % searchResults.length : -1
        );
      } else if (e.key === 'Escape') {
        setSearchResults([]);
        setSelectedIndex(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
          const selectedProduct = searchResults[selectedIndex];
          handleSelectProduct(selectedProduct.barcode);
        } else {
          const barcode = inputValue.trim();
          if (!barcode) return;
          onScan(barcode);
          setInputValue('');
          setSearchResults([]);
          setSelectedIndex(-1);
        }
      }
    },
    [inputValue, onScan, searchResults, selectedIndex, handleSelectProduct]
  );

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedCartIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    setSelectedCartIds(prev =>
      prev.length === items.length ? [] : items.map(i => i.id)
    );
  }, [items]);

  const handleBulkRemoveClick = () => {
    if (selectedCartIds.length === 0 || !onBulkRemove) return;
    onBulkRemove(selectedCartIds);
    setSelectedCartIds([]);
  };

  return (
    <section id="cart-table-section" aria-label="Tabel Keranjang Belanja" className="flex-1 flex flex-col bg-surface-container border border-outline-variant/50 rounded-2xl overflow-hidden shadow-md transition-all duration-200">
      {/* Cart Header (Desktop/Tablet >= 640px) */}
      <header id="cart-table-header" className="hidden sm:grid grid-cols-12 gap-2 p-3 px-5 border-b border-outline-variant/40 bg-surface-container-low font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider items-center">
        <div className="col-span-1 text-center flex items-center justify-center">
          {items.length > 0 && onBulkRemove && (
            <input
              id="checkbox-select-all-cart"
              type="checkbox"
              checked={selectedCartIds.length === items.length}
              onChange={handleToggleSelectAll}
              className="w-4.5 h-4.5 accent-primary rounded-md cursor-pointer transition-all hover:scale-105"
              aria-label="Pilih Semua Baris Keranjang"
            />
          )}
        </div>
        <div className="col-span-2 min-w-0 font-semibold">Barcode</div>
        <div className="col-span-3 min-w-0 font-semibold">Nama Item</div>
        <div className="col-span-2 text-center min-w-0 font-semibold">Qty</div>
        <div className="col-span-2 text-right min-w-0 font-mono font-semibold">Harga</div>
        <div className="col-span-2 text-right min-w-0 flex justify-between items-center pr-2 font-mono font-semibold">
          <span>Subtotal</span>
          {selectedCartIds.length > 0 && onBulkRemove && (
            <button
              id="btn-bulk-remove-cart"
              onClick={handleBulkRemoveClick}
              className="bg-error-container hover:bg-error text-on-error-container hover:text-on-error p-1.5 rounded-lg transition-colors cursor-pointer active:scale-95 shadow-sm"
              title="Hapus Terpilih"
              aria-label="Hapus Item Terpilih"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </header>

      {/* Cart Item Scroll List */}
      <div id="cart-item-list" role="region" aria-label="Daftar Barang Kasir" className="flex-1 overflow-y-auto bg-surface-dim/40 divide-y divide-outline-variant/30">
        {items.length === 0 ? (
          <div id="cart-empty-state" className="flex flex-col items-center justify-center h-full text-on-surface-variant/40 gap-4.5 p-6 select-none animate-in fade-in duration-300">
            <div className="p-5 rounded-2xl bg-surface-container-high border border-outline-variant/20 text-on-surface-variant/30 shadow-inner">
              <ScanBarcode size={52} className="stroke-[1.25] text-primary/70" />
            </div>
            <div className="text-center">
              <p className="font-label-md text-label-md font-bold text-on-surface-variant/70 tracking-wide uppercase">Keranjang Masih Kosong</p>
              <p className="text-body-md text-on-surface-variant/50 mt-1">Scan barcode atau masukkan nama produk untuk memulai transaksi</p>
            </div>
          </div>
        ) : (
          items.map((item, idx) => {
            const isSelected = selectedCartIds.includes(item.id);
            return (
              <React.Fragment key={item.id}>
                {/* ── Mobile Touch Card View (<640px) ── */}
                <article className={`sm:hidden flex flex-col p-3 px-4 gap-2 border-b border-outline-variant/30 transition-colors ${
                  isSelected ? 'bg-primary/10 border-l-4 border-l-primary' : 'bg-surface-container-low/40'
                }`}>
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm text-on-surface leading-snug">{item.name}</span>
                        {item.isAgent && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-secondary/10 text-secondary border border-secondary/20 shrink-0">AGEN</span>
                        )}
                        {item.appliedTierName && (
                          <span className="text-[10px] text-emerald-500 font-bold tracking-wide">
                            ★ {item.appliedTierName}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[10px] text-on-surface-variant/70 mt-0.5">{item.barcode}</span>
                    </div>
                    <button
                      onClick={() => onRemove(item.id)}
                      className="p-1.5 text-error/80 hover:text-error hover:bg-error-container/20 rounded-lg shrink-0 transition-colors cursor-pointer"
                      title="Hapus item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="flex justify-between items-center mt-1 pt-1 border-t border-outline-variant/20">
                    <span className="font-mono text-xs text-on-surface-variant font-semibold">
                      Rp {item.price.toLocaleString('id-ID')}
                    </span>
                    <div className="flex items-center gap-3">
                      {onChangeQty && !item.isAgent ? (
                        <div className="flex items-center bg-surface-container border border-outline-variant/60 rounded-xl p-0.5 shadow-sm">
                          <button
                            onClick={() => onChangeQty(item.id, Math.max(1, item.qty - 1))}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface hover:bg-surface-container-high cursor-pointer"
                          >
                            <Minus size={13} />
                          </button>
                          <span className="w-7 text-center font-mono font-bold text-xs text-on-surface">{item.qty}</span>
                          <button
                            onClick={() => onChangeQty(item.id, item.qty + 1)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface hover:bg-surface-container-high cursor-pointer"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      ) : (
                        <span className="font-mono font-bold text-on-surface bg-surface-container-high px-2 py-0.5 rounded-md text-xs">{item.qty}</span>
                      )}
                      <span className="font-mono font-extrabold text-sm text-primary min-w-[70px] text-right">
                        Rp {item.subtotal.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                </article>

                {/* ── Desktop Grid Row View (>=640px) ── */}
                <article
                  id={`cart-item-${item.id}`}
                  className={`hidden sm:grid grid-cols-12 gap-2 p-3 px-5 items-center transition-colors font-body-md text-body-md ${
                    isSelected
                      ? 'bg-primary/10 border-l-4 border-l-primary'
                      : idx % 2 === 0
                      ? 'bg-surface-container-low/40 hover:bg-surface-container-high/40'
                      : 'bg-surface-container/20 hover:bg-surface-container-high/40'
                  }`}
                >

                  <div className="col-span-1 text-center flex items-center justify-center">
                    {onBulkRemove && (
                      <input
                        id={`checkbox-cart-item-${item.id}`}
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(item.id)}
                        className="w-4 h-4 accent-primary rounded cursor-pointer transition-all"
                        aria-label={`Pilih item ${item.name}`}
                      />
                    )}
                  </div>
                  <div className="col-span-2 min-w-0 font-mono text-xs text-on-surface-variant/70 truncate flex items-center gap-1.5">
                    <span className="truncate">{item.barcode}</span>
                    {item.isAgent && (
                      <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-secondary/10 text-secondary border border-secondary/20 shrink-0">AGEN</span>
                    )}
                  </div>
                  <div className="col-span-3 min-w-0 font-medium text-on-surface flex flex-col">
                    <span className="truncate font-semibold">{item.name}</span>
                    {item.appliedTierName && (
                      <span className="text-[10px] text-emerald-500 font-bold tracking-wide">
                        ★ {item.appliedTierName}
                      </span>
                    )}
                  </div>
                  <div className="col-span-2 flex items-center justify-center gap-1">
                    {onChangeQty && !item.isAgent ? (
                      <div className="flex items-center bg-surface-container-low border border-outline-variant/60 rounded-lg p-0.5 shadow-sm">
                        <button
                          id={`btn-decrease-qty-${item.id}`}
                          onClick={() => onChangeQty(item.id, Math.max(1, item.qty - 1))}
                          className="w-6 h-6 rounded flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                          title="Kurangi Qty"
                          aria-label={`Kurangi kuantitas ${item.name}`}
                        >
                          <Minus size={12} />
                        </button>
                        <input
                          id={`input-qty-${item.id}`}
                          type="number"
                          min="1"
                          value={item.qty}
                          onChange={e => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val) && val > 0) onChangeQty(item.id, val);
                          }}
                          className="w-10 text-center font-mono font-bold text-xs bg-transparent text-on-surface focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          id={`btn-increase-qty-${item.id}`}
                          onClick={() => onChangeQty(item.id, item.qty + 1)}
                          className="w-6 h-6 rounded flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                          title="Tambah Qty"
                          aria-label={`Tambah kuantitas ${item.name}`}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    ) : (
                      <span className="font-mono font-bold text-on-surface bg-surface-container-high px-2 py-0.5 rounded-md text-xs">{item.qty}</span>
                    )}
                  </div>
                  <div className="col-span-2 text-right font-mono text-on-surface-variant text-xs font-semibold">
                    Rp {item.price.toLocaleString('id-ID')}
                  </div>
                  <div className="col-span-2 text-right font-mono font-bold text-primary flex items-center justify-between pr-2">
                    <span className="w-full text-right">Rp {item.subtotal.toLocaleString('id-ID')}</span>
                    <button
                      id={`btn-remove-item-${item.id}`}
                      onClick={() => onRemove(item.id)}
                      className="text-on-surface-variant/40 hover:text-error transition-colors p-1 rounded-lg hover:bg-error-container/30 cursor-pointer ml-2 shrink-0"
                      title="Hapus barang"
                      aria-label={`Hapus item ${item.name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              </React.Fragment>
            );
          })
        )}

      </div>

      {/* Footer Barcode Scan Bar */}
      <footer id="cart-table-footer" className={`p-2.5 sm:p-3 bg-surface-container-low border-t border-outline-variant/50 flex flex-col gap-2 shrink-0 transition-all ${items.length > 0 ? 'pb-16 md:pb-3' : ''}`}>

        <div id="barcode-input-container" className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 relative">
          <form id="barcode-scan-form" onSubmit={(e) => e.preventDefault()} className="flex-1 relative w-full">
            <ScanBarcode size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/60" />
            <input
              id="input-barcode-scan"
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={mode === 'warung' ? "Scan Barcode / Cari Produk [F1]..." : "Input Transaksi Agen [F2]..."}
              className="w-full bg-surface-container border border-outline-variant/60 rounded-xl pl-10 pr-24 py-2.5 text-on-surface font-label-md text-label-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-on-surface-variant/40 shadow-inner font-mono font-semibold"
              autoFocus
              aria-label="Scan atau Cari Barcode Produk"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {inputValue && (
                <button
                  id="btn-clear-barcode-input"
                  type="button"
                  onClick={() => {
                    setInputValue('');
                    setSearchResults([]);
                    setSelectedIndex(-1);
                    inputRef.current?.focus();
                  }}
                  className="text-on-surface-variant hover:text-on-surface transition-colors p-1"
                  aria-label="Bersihkan Input Barcode"
                >
                  <X size={14} />
                </button>
              )}
              {mode === 'warung' && (
                <button
                  type="button"
                  onClick={() => setShowCameraScanner(true)}
                  className="p-1 bg-primary/10 hover:bg-primary hover:text-white text-primary rounded-lg transition-all cursor-pointer shrink-0 md:hidden"
                  title="Scan Barcode via Kamera HP"
                  aria-label="Buka Pemindai Kamera"
                >
                  <Camera size={16} />
                </button>
              )}
            </div>


            {/* Fast Autocomplete Dropdown */}
            {searchResults.length > 0 ? (
              <div id="barcode-search-results-dropdown" role="listbox" className="absolute left-0 bottom-full mb-2 w-full bg-surface-container border border-outline-variant rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                <div className="px-3 py-1.5 bg-surface-container-high font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider flex justify-between items-center border-b border-outline-variant/30">
                  <span>Hasil Pencarian ({searchResults.length})</span>
                  <span className="text-[10px] text-on-surface-variant/60">Gunakan ↑↓ & Enter</span>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-outline-variant/20">
                  {searchResults.map((p, index) => {
                    const isSelected = index === selectedIndex;
                    return (
                      <div
                        key={p.id}
                        id={`search-result-item-${p.id}`}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelectProduct(p.barcode)}
                        className={`px-3 py-2 cursor-pointer transition-colors flex justify-between items-center ${
                          isSelected
                            ? 'bg-primary text-white'
                            : 'hover:bg-surface-container-high text-on-surface'
                        }`}
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-xs truncate">{p.name}</span>
                          <span className={`font-mono text-[10px] ${isSelected ? 'text-white/80' : 'text-on-surface-variant'}`}>
                            {p.barcode} • Stok: {p.stock_qty}
                          </span>
                        </div>
                        <span className={`font-mono font-bold text-xs shrink-0 ${isSelected ? 'text-white' : 'text-primary'}`}>
                          Rp {Number(p.sell_price).toLocaleString('id-ID')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : inputValue.trim().length >= 2 ? (
              <div id="barcode-no-results-dropdown" className="absolute left-0 bottom-full mb-2 w-full bg-surface-container border border-outline-variant rounded-xl shadow-2xl p-2 z-50 animate-in fade-in duration-150">
                <button
                  type="button"
                  onClick={() => {
                    setCustomName(inputValue.trim());
                    setShowCustomModal(true);
                  }}
                  className="w-full text-left p-2.5 bg-primary/10 hover:bg-primary hover:text-white rounded-lg transition-colors flex items-center justify-between cursor-pointer"
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-xs">Produk "{inputValue.trim()}" Tidak Ditemukan</span>
                    <span className="text-[10px] opacity-80">Klik untuk tambah sebagai Item Non-Barcode / Manual</span>
                  </div>
                  <Plus size={16} />
                </button>
              </div>
            ) : null}
          </form>

          {mode === 'warung' && onAddDigitalItem && (
            <div className="flex gap-2 w-full sm:w-auto shrink-0 flex-wrap">
              <button
                id="btn-open-camera-scanner"
                type="button"
                onClick={() => setShowCameraScanner(true)}
                className="flex-1 sm:flex-initial bg-primary text-on-primary hover:bg-primary/90 rounded-xl px-3 py-2 flex md:hidden items-center justify-center gap-1.5 font-bold text-xs shadow-md shrink-0 cursor-pointer active:scale-95 border border-primary/30"
                title="Buka Kamera HP untuk Scan Barcode"
                aria-label="Scan Barcode Kamera HP"
              >
                <Camera size={15} />
                <span>SCAN KAMERA</span>
              </button>
              <button
                id="btn-open-custom-item-modal"
                type="button"
                onClick={() => {
                  setCustomName(inputValue.trim());
                  setShowCustomModal(true);
                }}
                className="flex-1 sm:flex-initial bg-primary/10 hover:bg-primary hover:text-white text-primary rounded-xl px-2.5 py-2 flex items-center justify-center gap-1 font-bold text-xs border border-primary/20 cursor-pointer active:scale-95 shadow-sm"
                title="Tambah barang tanpa barcode / item manual"
                aria-label="Tambah Item Non-Barcode"
              >
                <Plus size={14} className="shrink-0" />
                <span>NON-BARCODE</span>
              </button>
              <button
                id="btn-open-digital-modal"
                type="button"
                onClick={() => setShowDigitalModal(true)}
                className="flex-1 sm:flex-initial bg-secondary-container hover:bg-secondary hover:text-white text-on-secondary-container rounded-xl px-2.5 py-2 flex items-center justify-center gap-1 font-bold text-xs border border-secondary/20 cursor-pointer active:scale-95 shadow-sm"
                aria-label="Buka Tambah Layanan Digital"
              >
                <Zap size={14} className="shrink-0" />
                <span>+ DIGITAL</span>
              </button>
            </div>
          )}

        </div>

        <div id="barcode-scan-status-indicator" className="text-center font-label-sm text-label-sm text-primary font-bold tracking-widest uppercase animate-pulse text-[10px] leading-none mt-0.5">
          {mode === 'warung' ? '✓ SIAP SCAN BARCODE PRODUK' : '⚡ SIAP TRANSAKSI DIGITAL AGEN'}
        </div>
      </footer>

      {/* Add Digital Service Modal */}
      {showDigitalModal && (
        <div id="digital-service-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="digital-modal-title" className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div id="digital-service-modal-card" className="bg-surface-container rounded-2xl border border-outline-variant/50 p-6 w-full max-w-sm mx-4 flex flex-col gap-4.5 shadow-2xl animate-in zoom-in-95 duration-200">
            <header className="flex items-center gap-2 border-b border-outline-variant/30 pb-3">
              <Zap size={18} className="text-secondary" />
              <h3 id="digital-modal-title" className="font-label-lg text-label-lg font-extrabold text-on-surface">Tambah Layanan Digital</h3>
            </header>

            {/* Service selector */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="select-digital-service" className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-[10px]">Pilih Layanan</label>
              <select
                id="select-digital-service"
                value={selectedService.type}
                onChange={e => {
                  const s = SERVICES.find(x => x.type === e.target.value);
                  if (s) setSelectedService(s);
                }}
                className="bg-surface-dim border border-outline-variant/65 rounded-xl px-3 py-2.5 text-on-surface font-label-md text-label-md focus:border-secondary outline-none transition-all w-full"
              >
                {SERVICES.map(s => (
                  <option key={s.type} value={s.type}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* Phone number */}
            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-[10px]">No. HP Pelanggan</label>
              <input
                type="tel"
                value={digitalPhone}
                onChange={e => setDigitalPhone(e.target.value)}
                placeholder="0812xxxxxxxx"
                className="bg-surface-dim border border-outline-variant/65 rounded-xl px-3 py-2.5 text-on-surface font-label-md text-label-md focus:border-secondary outline-none transition-all w-full"
              />
            </div>

            {/* Amount */}
            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-[10px]">Nominal Transaksi *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-label-md text-label-md font-bold">Rp</span>
                <input
                  type="text"
                  placeholder="0"
                  value={digitalAmountStr ? Number(digitalAmountStr.replace(/[^0-9]/g, '')).toLocaleString('id-ID') : ''}
                  onChange={e => setDigitalAmountStr(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full bg-surface-dim border border-outline-variant/65 rounded-xl px-3 py-2.5 pl-10 text-on-surface font-label-md text-label-md focus:border-secondary outline-none transition-all font-mono font-bold"
                  required
                />
              </div>
            </div>

            {/* Fee breakdown */}
            {parseInt(digitalAmountStr, 10) > 0 && (
              <div className="bg-surface-dim/75 rounded-xl border border-outline-variant/40 p-3.5 flex flex-col gap-2 shadow-inner">
                <div className="flex justify-between font-label-sm text-label-sm text-on-surface-variant">
                  <span>Modal Layanan</span>
                  <span className="text-on-surface font-mono font-semibold">Rp {parseInt(digitalAmountStr, 10).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between font-label-sm text-label-sm text-on-surface-variant">
                  <span>Biaya Admin</span>
                  <span className="text-on-surface font-mono font-semibold">Rp {selectedService.adminFee.toLocaleString('id-ID')}</span>
                </div>
                <div className="border-t border-outline-variant/40 pt-2 flex justify-between font-label-md text-label-md">
                  <span className="text-on-surface-variant font-medium">Total Ditagih</span>
                  <span className="text-secondary font-bold font-mono text-base">
                    Rp {(parseInt(digitalAmountStr, 10) + selectedService.adminFee).toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between font-label-sm text-label-sm">
                  <span className="text-on-surface-variant">Komisi Agen</span>
                  <span className="text-emerald-500 font-bold font-mono">+ Rp {selectedService.commission.toLocaleString('id-ID')}</span>
                </div>
              </div>
            )}

            {/* Error display */}
            {digitalError && (
              <div className="flex items-center gap-2 bg-error-container/40 text-on-error-container rounded-xl p-3 font-body-md text-body-md border border-error/15">
                <AlertCircle size={16} className="shrink-0" />
                <span>{digitalError}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 border-t border-outline-variant/30 pt-3.5">
              <button
                type="button"
                onClick={() => {
                  setShowDigitalModal(false);
                  setDigitalError('');
                }}
                className="flex-1 bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/50 text-on-surface font-label-md text-label-md rounded-xl py-2.5 transition-all cursor-pointer font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const amount = parseInt(digitalAmountStr.replace(/\D/g, ''), 10) || 0;
                  if (amount <= 0) {
                    setDigitalError('Nominal harus lebih dari 0.');
                    return;
                  }
                  if (!onAddDigitalItem) return;

                  const totalCharge = amount + selectedService.adminFee;
                  const timestamp = Date.now();

                  const newItem: CartItem = {
                    id: `digital-${timestamp}`,
                    barcode: `DIGITAL-${selectedService.type.toUpperCase()}`,
                    name: `${selectedService.label} (${digitalPhone.trim() || 'No HP'})`,
                    qty: 1,
                    price: totalCharge,
                    subtotal: totalCharge,
                    isAgent: true,
                    modal_price: amount,
                    digitalDetails: {
                      service_type: selectedService.type,
                      customer_phone: digitalPhone.trim() || undefined,
                      amount: amount,
                      admin_fee: selectedService.adminFee,
                      agent_commission: selectedService.commission
                    }
                  };

                  onAddDigitalItem(newItem);
                  
                  // reset form
                  setDigitalPhone('');
                  setDigitalAmountStr('');
                  setDigitalError('');
                  setShowDigitalModal(false);
                }}
                className="flex-1 bg-secondary-container hover:bg-secondary hover:text-white text-on-secondary-container font-label-md text-label-md rounded-xl py-2.5 border border-secondary/20 transition-all font-bold cursor-pointer"
              >
                Tambahkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom / Non-Barcode Item Modal */}
      {showCustomModal && (
        <div id="custom-item-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="custom-modal-title" className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div id="custom-item-modal-card" className="bg-surface-container rounded-2xl border border-outline-variant/50 p-6 w-full max-w-sm mx-4 flex flex-col gap-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <header className="flex items-center justify-between border-b border-outline-variant/30 pb-3">
              <div className="flex items-center gap-2">
                <Plus size={18} className="text-primary" />
                <h3 id="custom-modal-title" className="font-label-lg text-label-lg font-extrabold text-on-surface">Item Non-Barcode / Manual</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </header>

            {/* Product Name */}
            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-[10px]">Nama Barang / Produk *</label>
              <input
                type="text"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                placeholder="contoh: Es Lilin, Gorengan, Kerupuk"
                className="bg-surface-dim border border-outline-variant/65 rounded-xl px-3 py-2.5 text-on-surface font-label-md text-label-md focus:border-primary outline-none transition-all w-full font-semibold"
                autoFocus
                required
              />
            </div>

            {/* Price & Quantity Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-[10px]">Harga (Rp) *</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant font-label-md text-label-md font-bold text-xs">Rp</span>
                  <input
                    type="text"
                    placeholder="0"
                    value={customPriceStr ? Number(customPriceStr.replace(/[^0-9]/g, '')).toLocaleString('id-ID') : ''}
                    onChange={e => setCustomPriceStr(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full bg-surface-dim border border-outline-variant/65 rounded-xl py-2 pl-8 pr-2 text-on-surface font-mono font-bold text-xs focus:border-primary outline-none transition-all"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-[10px]">Kuantitas *</label>
                <input
                  type="number"
                  min="1"
                  value={customQtyStr}
                  onChange={e => setCustomQtyStr(e.target.value)}
                  className="w-full bg-surface-dim border border-outline-variant/65 rounded-xl py-2 px-3 text-on-surface font-mono font-bold text-xs focus:border-primary outline-none transition-all"
                  required
                />
              </div>
            </div>

            {/* Error display */}
            {customError && (
              <div className="flex items-center gap-2 bg-error-container/40 text-on-error-container rounded-xl p-2.5 text-xs border border-error/15">
                <AlertCircle size={14} className="shrink-0" />
                <span>{customError}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 border-t border-outline-variant/30 pt-3">
              <button
                type="button"
                onClick={() => {
                  setShowCustomModal(false);
                  setCustomError('');
                }}
                className="flex-1 bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/50 text-on-surface text-xs rounded-xl py-2.5 transition-all cursor-pointer font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!customName.trim()) {
                    setCustomError('Nama barang harus diisi.');
                    return;
                  }
                  const price = parseInt(customPriceStr.replace(/\D/g, ''), 10) || 0;
                  if (price <= 0) {
                    setCustomError('Harga barang harus lebih dari 0.');
                    return;
                  }
                  const qty = parseInt(customQtyStr, 10) || 1;
                  if (qty <= 0) {
                    setCustomError('Kuantitas harus minimal 1.');
                    return;
                  }
                  if (!onAddDigitalItem) return;

                  const timestamp = Date.now();
                  const newItem: CartItem = {
                    id: `custom-${timestamp}`,
                    barcode: `NOBC-${timestamp}`,
                    name: customName.trim(),
                    qty: qty,
                    price: price,
                    subtotal: price * qty,
                    isAgent: false,
                  };

                  onAddDigitalItem(newItem);
                  
                  // reset form
                  setCustomName('');
                  setCustomPriceStr('');
                  setCustomQtyStr('1');
                  setCustomError('');
                  setShowCustomModal(false);
                }}
                className="flex-1 bg-primary hover:bg-primary/90 text-white text-xs rounded-xl py-2.5 transition-all font-bold cursor-pointer shadow-sm"
              >
                + Tambah Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Barcode Scanner Modal */}
      {showCameraScanner && (
        <CameraScannerModal
          onScanSuccess={(barcode) => {
            onScan(barcode);
          }}
          onClose={() => setShowCameraScanner(false)}
        />
      )}
    </section>
  );
}


