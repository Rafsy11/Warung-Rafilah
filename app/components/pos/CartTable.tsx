import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Zap, X, ScanBarcode, Plus, Minus, Trash2, AlertCircle } from 'lucide-react';
import type { CartItem } from '@/types/pos';

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

  // Keep selection state in sync with items list
  useEffect(() => {
    const timer = setTimeout(() => {
      setSelectedCartIds(prev => prev.filter(id => items.some(item => item.id === id)));
    }, 0);
    return () => clearTimeout(timer);
  }, [items]);

  // Debounced search for manual product lookup
  useEffect(() => {
    if (mode !== 'warung' || inputValue.trim().length < 2) {
      const timer = setTimeout(() => {
        setSearchResults([]);
        setSelectedIndex(-1);
      }, 0);
      return () => clearTimeout(timer);
    }
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
    }, 300);

    return () => clearTimeout(timer);
  }, [inputValue, mode]);

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
    <section className="flex-1 flex flex-col bg-surface-container border border-outline-variant/50 rounded-2xl overflow-hidden shadow-md transition-all duration-200">
      {/* Cart Header */}
      <div className="grid grid-cols-12 gap-2 p-3 px-5 border-b border-outline-variant/40 bg-surface-container-low font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider items-center">
        <div className="col-span-1 text-center flex items-center justify-center">
          {items.length > 0 && onBulkRemove && (
            <input
              type="checkbox"
              checked={selectedCartIds.length === items.length}
              onChange={handleToggleSelectAll}
              className="w-4.5 h-4.5 accent-primary rounded-md cursor-pointer transition-all hover:scale-105"
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
              onClick={handleBulkRemoveClick}
              className="bg-error-container hover:bg-error text-on-error-container hover:text-on-error p-1.5 rounded-lg transition-colors cursor-pointer active:scale-95 shadow-sm"
              title="Hapus Terpilih"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto bg-surface-dim/40 divide-y divide-outline-variant/30">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-on-surface-variant/40 gap-4.5 p-6 select-none animate-in fade-in duration-300">
            <div className="p-5 rounded-2xl bg-surface-container-high border border-outline-variant/20 text-on-surface-variant/30 shadow-inner">
              <ScanBarcode size={52} className="stroke-[1.25] text-primary/70" />
            </div>
            <div className="text-center">
              <p className="font-bold text-on-surface text-base">Keranjang Belanja Kosong</p>
              <p className="text-xs text-on-surface-variant/60 mt-1.5 max-w-[240px] leading-relaxed">
                Scan barcode produk di laci scan atau cari nama produk di input bawah.
              </p>
            </div>
          </div>
        ) : (
          items.map((item, index) => (
            <div
              key={item.id}
              className={`grid grid-cols-12 gap-2 p-3 px-5 items-center hover:bg-primary-container/10 transition-all duration-150 group border-l-4 ${
                item.isAgent
                  ? 'border-l-secondary bg-secondary-container/5'
                  : 'border-l-transparent'
              }`}
            >
              <div className="col-span-1 text-center flex items-center justify-center">
                {onBulkRemove ? (
                  <input
                    type="checkbox"
                    checked={selectedCartIds.includes(item.id)}
                    onChange={() => handleToggleSelect(item.id)}
                    className="w-4 h-4 accent-primary rounded cursor-pointer transition-all hover:scale-105"
                  />
                ) : (
                  <span className="font-label-sm text-label-sm text-on-surface-variant font-bold">{index + 1}</span>
                )}
              </div>
              <div className="col-span-2 font-label-sm text-label-sm text-on-surface-variant flex items-center gap-2 min-w-0">
                {item.isAgent && <Zap size={14} className="text-secondary shrink-0" />}
                <span className="truncate font-medium">{item.barcode}</span>
              </div>
              <div
                className={`col-span-3 font-body-md text-body-md truncate pr-2 min-w-0 flex items-center gap-1.5 ${
                  item.isAgent ? 'text-secondary font-bold' : 'text-on-surface font-semibold'
                }`}
              >
                <span className="truncate">{item.name}</span>
                {item.appliedTierName && (
                  <span className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border border-emerald-500/20 uppercase tracking-wide shrink-0">
                    {item.appliedTierName}
                  </span>
                )}
                {item.activeDiscount && (
                  <span className="bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border border-rose-500/20 uppercase tracking-wide shrink-0">
                    DISC {item.activeDiscount.value_type === 'percentage' 
                      ? `${item.activeDiscount.discount_value}%` 
                      : `Rp ${(Number(item.activeDiscount.discount_value)).toLocaleString('id-ID')}`
                    }
                  </span>
                )}
              </div>
              <div className="col-span-2 flex justify-center items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => onChangeQty && onChangeQty(item.id, item.qty - 1)}
                  className="w-7 h-7 bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/65 transition-all flex items-center justify-center shrink-0 rounded-full cursor-pointer shadow-sm"
                  aria-label="Kurangi"
                >
                  <Minus size={12} className="stroke-[2.5]" />
                </button>
                <div className="bg-surface-container-highest/80 px-2.5 py-0.5 rounded-lg border border-outline-variant font-label-md text-label-md text-on-surface min-w-[32px] text-center font-mono font-bold">
                  {item.qty}
                </div>
                <button
                  type="button"
                  onClick={() => onChangeQty && onChangeQty(item.id, item.qty + 1)}
                  className="w-7 h-7 bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/65 transition-all flex items-center justify-center shrink-0 rounded-full cursor-pointer shadow-sm"
                  aria-label="Tambah"
                >
                  <Plus size={12} className="stroke-[2.5]" />
                </button>
              </div>
              <div className="col-span-2 text-right font-label-md text-label-md text-on-surface-variant truncate min-w-0 font-mono font-medium">
                {item.price.toLocaleString('id-ID')}
              </div>
              <div className="col-span-2 flex justify-end items-center gap-2 min-w-0 font-mono">
                <span className="font-label-md text-label-md text-on-surface truncate font-bold">
                  {item.subtotal.toLocaleString('id-ID')}
                </span>
                <button
                  onClick={() => onRemove(item.id)}
                  aria-label={`Hapus ${item.name}`}
                  className="bg-error-container/40 text-error p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-error hover:text-white flex items-center justify-center shrink-0 cursor-pointer active:scale-95 shadow-sm ml-1"
                >
                  <X size={13} className="stroke-[2.5]" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Cart Footer / Scanner Input */}
      <div className="bg-surface-container border-t border-outline-variant/45 p-4 flex flex-col gap-3">
        <div className="flex gap-3 w-full items-stretch">
          <div className="relative flex-1">
            {searchResults.length > 0 && (
              <div className="absolute bottom-full mb-3 left-0 right-0 z-50 bg-surface-container border border-outline-variant/65 rounded-2xl shadow-2xl py-1.5 max-h-64 overflow-y-auto backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-200">
                {searchResults.map((prod, idx) => (
                  <div
                    key={prod.id}
                    onClick={() => handleSelectProduct(prod.barcode)}
                    className={`flex justify-between items-center px-4 py-2.5 cursor-pointer font-label-md text-label-md transition-colors ${
                      idx === selectedIndex
                        ? 'bg-primary-container text-on-primary-container font-semibold'
                        : 'text-on-surface hover:bg-surface-container-high/60'
                    }`}
                  >
                    <div className="flex flex-col text-left">
                      <span className="font-bold text-sm text-on-surface">{prod.name}</span>
                      <span className="text-[10px] opacity-65 font-mono mt-0.5">{prod.barcode}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold font-mono text-primary">Rp {Number(prod.sell_price).toLocaleString('id-ID')}</div>
                      <div className="text-[10px] opacity-65 font-medium mt-0.5">Stok: {Number(prod.stock_qty)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <input
              id="main-barcode-search-input"
              ref={inputRef}
              autoFocus
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-surface-dim border border-outline-variant/70 rounded-xl p-3 pl-11 text-on-surface font-label-md text-label-md focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-sm outline-none"
              placeholder={
                mode === 'warung'
                  ? 'Scan barcode atau ketik nama produk...'
                  : 'Ketik kode layanan digital agen...'
              }
            />
            <div className="absolute left-3.5 top-3.5 text-on-surface-variant flex items-center justify-center">
              {mode === 'warung' ? <ScanBarcode size={18} className="text-primary" /> : <Zap size={18} className="text-secondary" />}
            </div>
          </div>
          {mode === 'warung' && onAddDigitalItem && (
            <button
              type="button"
              onClick={() => setShowDigitalModal(true)}
              className="bg-secondary-container hover:bg-secondary hover:text-white text-on-secondary-container font-label-md text-label-md rounded-xl px-4 py-2.5 flex items-center gap-1.5 transition-all border border-secondary/20 shrink-0 font-bold cursor-pointer active:scale-95 shadow-sm"
            >
              <Zap size={14} className="shrink-0" />
              + LAYANAN DIGITAL
            </button>
          )}
        </div>
        <div className="text-center font-label-sm text-label-sm text-primary font-bold tracking-widest uppercase animate-pulse text-[10px] leading-none mt-0.5">
          {mode === 'warung' ? '✓ SIAP SCAN BARCODE PRODUK' : '⚡ SIAP TRANSAKSI DIGITAL AGEN'}
        </div>
      </div>

      {/* Add Digital Service Modal */}
      {showDigitalModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface-container rounded-2xl border border-outline-variant/50 p-6 w-full max-w-sm mx-4 flex flex-col gap-4.5 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 border-b border-outline-variant/30 pb-3">
              <Zap size={18} className="text-secondary" />
              <h3 className="font-label-lg text-label-lg font-extrabold text-on-surface">Tambah Layanan Digital</h3>
            </div>

            {/* Service selector */}
            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-[10px]">Pilih Layanan</label>
              <select
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
    </section>
  );
}

