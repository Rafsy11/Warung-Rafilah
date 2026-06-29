import React, { useState, useCallback, useEffect } from 'react';
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
  const [inputValue, setInputValue] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; barcode: string; name: string; sell_price: string; stock_qty: string }[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selectedCartIds, setSelectedCartIds] = useState<string[]>([]);

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
    <section className="flex-1 flex flex-col bg-surface-container-lowest rounded-lg border border-outline-variant overflow-hidden shadow-inner">
      {/* Cart Header */}
      <div className="grid grid-cols-12 gap-2 p-2.5 px-4 border-b border-outline-variant bg-surface-container font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider items-center">
        <div className="col-span-1 text-center flex items-center justify-center">
          {items.length > 0 && onBulkRemove && (
            <input
              type="checkbox"
              checked={selectedCartIds.length === items.length}
              onChange={handleToggleSelectAll}
              className="w-3.5 h-3.5 accent-primary rounded cursor-pointer"
            />
          )}
        </div>
        <div className="col-span-2 min-w-0">Barcode</div>
        <div className="col-span-3 min-w-0">Item Name</div>
        <div className="col-span-2 text-center min-w-0">Qty</div>
        <div className="col-span-2 text-right min-w-0 font-mono">Price</div>
        <div className="col-span-2 text-right min-w-0 flex justify-between items-center pr-2 font-mono">
          <span>Subtotal</span>
          {selectedCartIds.length > 0 && onBulkRemove && (
            <button
              onClick={handleBulkRemoveClick}
              className="bg-error-container hover:bg-error text-on-error-container hover:text-on-error p-1 rounded transition-colors cursor-pointer"
              title="Hapus Terpilih"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto scrollbar-hide bg-surface-dim">
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-full text-on-surface-variant">
            No items in cart.
          </div>
        ) : (
          items.map((item, index) => (
            <div
              key={item.id}
              className={`grid grid-cols-12 gap-2 p-2 px-4 border-b border-outline-variant/50 items-center hover:bg-surface-container-high transition-colors group ${
                item.isAgent
                  ? 'border-l-4 border-l-primary'
                  : index % 2 === 1
                  ? 'bg-surface-container-highest/30 border-l-4 border-l-transparent'
                  : 'border-l-4 border-l-transparent'
              }`}
            >
              <div className="col-span-1 text-center flex items-center justify-center">
                {onBulkRemove ? (
                  <input
                    type="checkbox"
                    checked={selectedCartIds.includes(item.id)}
                    onChange={() => handleToggleSelect(item.id)}
                    className="w-3.5 h-3.5 accent-primary rounded cursor-pointer"
                  />
                ) : (
                  <span className="font-label-sm text-label-sm text-on-surface-variant">{index + 1}</span>
                )}
              </div>
              <div className="col-span-2 font-label-sm text-label-sm text-on-surface-variant flex items-center gap-2 min-w-0">
                {item.isAgent && <Zap size={14} className="text-primary shrink-0" />}
                <span className="truncate">{item.barcode}</span>
              </div>
              <div
                className={`col-span-3 font-body-md text-body-md truncate pr-2 min-w-0 flex items-center gap-1.5 ${
                  item.isAgent ? 'text-primary' : 'text-on-surface'
                }`}
              >
                <span className="truncate">{item.name}</span>
                {item.appliedTierName && (
                  <span className="bg-emerald-950/40 text-emerald-400 text-[9px] font-bold px-1.5 py-0.5 rounded border border-emerald-500/20 uppercase tracking-wide shrink-0">
                    {item.appliedTierName}
                  </span>
                )}
              </div>
              <div className="col-span-2 flex justify-center items-center gap-1.5 min-w-0">
                <button
                  type="button"
                  onClick={() => onChangeQty && onChangeQty(item.id, item.qty - 1)}
                  className="bg-surface-container hover:bg-surface-container-high text-on-surface-variant p-1 rounded border border-outline-variant transition-colors flex items-center justify-center shrink-0 active:scale-90"
                  aria-label="Kurangi"
                >
                  <Minus size={12} />
                </button>
                <div className="bg-surface-container-highest px-2 py-0.5 rounded border border-outline-variant font-label-md text-label-md text-on-surface min-w-[28px] text-center font-mono">
                  {item.qty}
                </div>
                <button
                  type="button"
                  onClick={() => onChangeQty && onChangeQty(item.id, item.qty + 1)}
                  className="bg-surface-container hover:bg-surface-container-high text-on-surface-variant p-1 rounded border border-outline-variant transition-colors flex items-center justify-center shrink-0 active:scale-90"
                  aria-label="Tambah"
                >
                  <Plus size={12} />
                </button>
              </div>
              <div className="col-span-2 text-right font-label-md text-label-md text-on-surface-variant truncate min-w-0 font-mono">
                {item.price.toLocaleString('id-ID')}
              </div>
              <div className="col-span-2 flex justify-end items-center gap-2 min-w-0 font-mono">
                <span className="font-label-md text-label-md text-on-surface truncate">
                  {item.subtotal.toLocaleString('id-ID')}
                </span>
                <button
                  onClick={() => onRemove(item.id)}
                  aria-label={`Hapus ${item.name}`}
                  className="bg-error-container text-on-error-container p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-error hover:text-on-error flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Cart Footer / Scanner Input */}
      <div className="bg-surface-container border-t border-outline-variant p-2.5 flex flex-col gap-1.5">
        <div className="flex gap-2 w-full">
          <div className="relative flex-1">
            {searchResults.length > 0 && (
              <div className="absolute bottom-full mb-2 left-0 right-0 z-50 bg-surface-container-highest border border-outline-variant rounded-lg shadow-xl py-1 max-h-60 overflow-y-auto">
                {searchResults.map((prod, idx) => (
                  <div
                    key={prod.id}
                    onClick={() => handleSelectProduct(prod.barcode)}
                    className={`flex justify-between items-center px-4 py-2 cursor-pointer font-label-md text-label-md transition-colors ${
                      idx === selectedIndex
                        ? 'bg-secondary-container text-on-secondary-container'
                        : 'text-on-surface hover:bg-surface-container-high'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-left">{prod.name}</span>
                      <span className="text-[11px] text-left opacity-60 font-mono">{prod.barcode}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold font-mono">Rp {Number(prod.sell_price).toLocaleString('id-ID')}</div>
                      <div className="text-[11px] opacity-60">Stok: {Number(prod.stock_qty)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <input
              autoFocus
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-surface-dim border border-outline-variant rounded p-2 pl-10 text-on-surface font-label-md text-label-md focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
              placeholder={
                mode === 'warung'
                  ? 'Scan barcode atau ketik PLU...'
                  : 'Ketik kode layanan agen...'
              }
            />
            <div className="absolute left-3 top-2.5 text-on-surface-variant flex items-center justify-center">
              {mode === 'warung' ? <ScanBarcode size={18} /> : <Zap size={18} />}
            </div>
          </div>
          {mode === 'warung' && onAddDigitalItem && (
            <button
              type="button"
              onClick={() => setShowDigitalModal(true)}
              className="bg-primary-container hover:bg-primary-container/80 text-on-primary-container font-label-md text-label-md rounded px-4 py-2 flex items-center gap-1.5 transition-colors border border-primary/20 shrink-0 font-bold cursor-pointer"
            >
              <Zap size={14} className="shrink-0" />
              + LAYANAN DIGITAL
            </button>
          )}
        </div>
        <div className="text-center font-label-sm text-label-sm text-primary tracking-widest uppercase animate-pulse">
          {mode === 'warung' ? 'SIAP SCAN...' : 'SIAP TRANSAKSI AGEN...'}
        </div>
      </div>

      {/* Add Digital Service Modal */}
      {showDigitalModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-container rounded-2xl border border-outline-variant p-6 w-full max-w-sm mx-4 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center gap-2">
              <Zap size={18} className="text-primary" />
              <h3 className="font-label-lg text-label-lg font-bold text-on-surface">Tambah Layanan Digital</h3>
            </div>

            {/* Service selector */}
            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Pilih Layanan</label>
              <select
                value={selectedService.type}
                onChange={e => {
                  const s = SERVICES.find(x => x.type === e.target.value);
                  if (s) setSelectedService(s);
                }}
                className="bg-surface-dim border border-outline-variant rounded-lg px-3 py-2.5 text-on-surface font-label-md text-label-md focus:border-primary outline-none transition-colors w-full"
              >
                {SERVICES.map(s => (
                  <option key={s.type} value={s.type}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* Phone number */}
            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">No. HP Pelanggan</label>
              <input
                type="tel"
                value={digitalPhone}
                onChange={e => setDigitalPhone(e.target.value)}
                placeholder="0812xxxxxxxx"
                className="bg-surface-dim border border-outline-variant rounded-lg px-3 py-2.5 text-on-surface font-label-md text-label-md focus:border-primary outline-none transition-colors w-full"
              />
            </div>

            {/* Amount */}
            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Nominal Transaksi *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-label-md text-label-md">Rp</span>
                <input
                  type="text"
                  placeholder="0"
                  value={digitalAmountStr ? Number(digitalAmountStr.replace(/[^0-9]/g, '')).toLocaleString('id-ID') : ''}
                  onChange={e => setDigitalAmountStr(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full bg-surface-dim border border-outline-variant rounded-lg px-3 py-2.5 pl-10 text-on-surface font-label-md text-label-md focus:border-primary outline-none transition-colors"
                  required
                />
              </div>
            </div>

            {/* Fee breakdown */}
            {parseInt(digitalAmountStr, 10) > 0 && (
              <div className="bg-surface-dim rounded-lg border border-outline-variant/50 p-3 flex flex-col gap-2">
                <div className="flex justify-between font-label-sm text-label-sm text-on-surface-variant">
                  <span>Modal Layanan</span>
                  <span className="text-on-surface">Rp {parseInt(digitalAmountStr, 10).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between font-label-sm text-label-sm text-on-surface-variant">
                  <span>Biaya Admin</span>
                  <span className="text-on-surface">Rp {selectedService.adminFee.toLocaleString('id-ID')}</span>
                </div>
                <div className="border-t border-outline-variant/30 pt-2 flex justify-between font-label-md text-label-md">
                  <span className="text-on-surface-variant">Total Ditagih</span>
                  <span className="text-secondary font-bold">
                    Rp {(parseInt(digitalAmountStr, 10) + selectedService.adminFee).toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between font-label-sm text-label-sm">
                  <span className="text-on-surface-variant">Komisi Agen</span>
                  <span className="text-emerald-400 font-semibold">+ Rp {selectedService.commission.toLocaleString('id-ID')}</span>
                </div>
              </div>
            )}

            {/* Error display */}
            {digitalError && (
              <div className="flex items-center gap-2 bg-error-container text-on-error-container rounded-lg p-3 font-body-md text-body-md">
                <AlertCircle size={16} className="shrink-0" />
                <span>{digitalError}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowDigitalModal(false);
                  setDigitalError('');
                }}
                className="flex-1 bg-surface-container-highest hover:bg-surface-container-high border border-outline-variant text-on-surface font-label-md text-label-md rounded-lg py-2.5 transition-colors cursor-pointer"
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
                className="flex-1 bg-primary-container hover:bg-primary-container/80 text-on-primary-container font-label-md text-label-md rounded-lg py-2.5 border border-primary/30 transition-all font-bold cursor-pointer"
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
