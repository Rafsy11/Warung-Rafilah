"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Package, Search, Plus, Edit2, Trash2, X, Save, AlertCircle, Loader2, History, Scale, Wallet, RefreshCw, Users, User, Tag, Truck, Percent } from 'lucide-react';

interface Product {
  id: string;
  barcode: string;
  name: string;
  category: string;
  unit: string;
  cost_price: string;
  sell_price: string;
  stock_qty: string;
  reorder_threshold: string;
  pricing_tiers?: {
    id: string;
    product_id: string;
    min_qty: number;
    tier_price: number;
    name: string;
  }[];
  is_consignment?: boolean;
  consignment_supplier_name?: string | null;
  consignment_cost_share?: string | number | null;
  nearest_expiry_date?: string | null;
}

interface StockMovement {
  id: string;
  movement_type: string;
  qty_change: string;
  reference_id: string | null;
  note: string | null;
  created_at: string;
  product_name: string;
  product_barcode: string;
  cost_price?: string;
  user_name: string | null;
}

interface FloatLedgerEntry {
  id: string;
  entry_type: string;
  amount: string;
  balance_after: string;
  note: string | null;
  created_at: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  credit_limit: string;
  current_debt: string;
}

interface Discount {
  id: string;
  name: string;
  discount_type: 'global' | 'product';
  value_type: 'fixed' | 'percentage';
  discount_value: number;
  product_id: string | null;
  product_name?: string | null;
  product_barcode?: string | null;
  min_purchase_amount: number;
  is_active: boolean;
  created_at: string;
}

interface AdminWorkspaceProps {
  onToast: (msg: string, type: 'success' | 'error') => void;
  scannedBarcode?: { code: string; timestamp: number } | null;
}

export default function AdminWorkspace({ onToast, scannedBarcode }: AdminWorkspaceProps) {
  const nowDate = new Date();
  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const [activeTab, setActiveTab] = useState<'products' | 'adjust' | 'convert' | 'customers' | 'sessions' | 'history' | 'float' | 'consignment' | 'procurement' | 'discounts'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states (Product)
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

  // Stock Adjustment Form states
  const [adjustSearch, setAdjustSearch] = useState('');
  const [adjustSuggestions, setAdjustSuggestions] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustType, setAdjustType] = useState<'restock' | 'adjustment' | 'damaged' | 'expired' | 'stolen'>('restock');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustError, setAdjustError] = useState('');

  // Product Conversion Form states
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

  // Conversion map state
  const [conversionMaps, setConversionMaps] = useState<any[]>([]);
  const [loadingConversionMaps, setLoadingConversionMaps] = useState(false);
  const [mapSourceProduct, setMapSourceProduct] = useState<Product | null>(null);
  const [mapDestProduct, setMapDestProduct] = useState<Product | null>(null);
  const [mapRatio, setMapRatio] = useState('');
  const [mapAutoConvert, setMapAutoConvert] = useState(true);
  const [mapError, setMapError] = useState('');
  const [mapSourceSearch, setMapSourceSearch] = useState('');
  const [mapSourceSuggestions, setMapSourceSuggestions] = useState<Product[]>([]);
  const [mapDestSearch, setMapDestSearch] = useState('');
  const [mapDestSuggestions, setMapDestSuggestions] = useState<Product[]>([]);

  // Customer management states
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchCustomerQuery, setSearchCustomerQuery] = useState('');
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Customer form fields
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerCreditLimit, setCustomerCreditLimit] = useState('500000');
  const [customerFormError, setCustomerFormError] = useState('');

  // Customer debt and history details
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState<Customer | null>(null);
  const [customerLedger, setCustomerLedger] = useState<any[]>([]);
  const [customerSales, setCustomerSales] = useState<any[]>([]);
  const [loadingCustomerHistory, setLoadingCustomerHistory] = useState(false);
  const [showPayDebtForm, setShowPayDebtForm] = useState(false);
  const [payDebtAmount, setPayDebtAmount] = useState('');
  const [payDebtNote, setPayDebtNote] = useState('');
  const [payDebtError, setPayDebtError] = useState('');
  const [sendingWa, setSendingWa] = useState(false);

  // Stock Movements State
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [shrinkageSummary, setShrinkageSummary] = useState<any[]>([]);
  const [loadingShrinkage, setLoadingShrinkage] = useState(false);

  // Consignment tab states
  const [consignmentSummary, setConsignmentSummary] = useState<any[]>([]);
  const [consignmentLogs, setConsignmentLogs] = useState<any[]>([]);
  const [loadingConsignment, setLoadingConsignment] = useState(false);

  // Pricing Tiers States
  const [selectedTiersProduct, setSelectedTiersProduct] = useState<Product | null>(null);
  const [productTiers, setProductTiers] = useState<any[]>([]);
  const [loadingTiers, setLoadingTiers] = useState(false);
  const [tiersError, setTiersError] = useState('');

  // Cashier Session History States
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Bulk Delete State
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // Float balance states
  const [floatBalance, setFloatBalance] = useState<number | null>(null);
  const [loadingFloat, setLoadingFloat] = useState(false);
  const [adjustFloatAmount, setAdjustFloatAmount] = useState('');
  const [adjustFloatType, setAdjustFloatType] = useState<'deposit_in' | 'deposit_out'>('deposit_in');
  const [adjustFloatNote, setAdjustFloatNote] = useState('');
  const [adjustFloatError, setAdjustFloatError] = useState('');
  const [floatLedger, setFloatLedger] = useState<FloatLedgerEntry[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Procurement List States
  const [procurementItems, setProcurementItems] = useState<any[]>([]);
  const [loadingProcurement, setLoadingProcurement] = useState(false);
  const [totalEstimatedCost, setTotalEstimatedCost] = useState(0);

  // Discount Management States
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loadingDiscounts, setLoadingDiscounts] = useState(false);
  const [showDiscountForm, setShowDiscountForm] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);
  const [discountName, setDiscountName] = useState('');
  const [discountType, setDiscountType] = useState<'global' | 'product'>('global');
  const [discountValueType, setDiscountValueType] = useState<'fixed' | 'percentage'>('fixed');
  const [discountValue, setDiscountValue] = useState('');
  const [discountProductId, setDiscountProductId] = useState<string | null>(null);
  const [discountProductSearch, setDiscountProductSearch] = useState('');
  const [discountProductSuggestions, setDiscountProductSuggestions] = useState<Product[]>([]);
  const [discountMinPurchase, setDiscountMinPurchase] = useState('0');
  const [discountIsActive, setDiscountIsActive] = useState(true);
  const [discountFormError, setDiscountFormError] = useState('');
  const [savingDiscount, setSavingDiscount] = useState(false);

  const fetchProducts = useCallback(async (search = '') => {
    setLoading(true);
    setSelectedProductIds([]);
    try {
      const url = search 
        ? `/api/products?search=${encodeURIComponent(search)}&limit=100`
        : `/api/products?limit=100`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.items || []);
      } else {
        onToast('Gagal memuat produk.', 'error');
      }
    } catch {
      onToast('Koneksi database bermasalah.', 'error');
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  const handleToggleProductSelection = useCallback((id: string) => {
    setSelectedProductIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  }, []);

  const handleToggleSelectAllProducts = useCallback(() => {
    setSelectedProductIds(prev =>
      prev.length === products.length ? [] : products.map(p => p.id)
    );
  }, [products]);

  const handleBulkDeleteProducts = useCallback(async () => {
    if (selectedProductIds.length === 0) return;
    if (!confirm(`Apakah Anda yakin ingin menonaktifkan ${selectedProductIds.length} produk terpilih?`)) return;
    setSaving(true);
    try {
      const res = await fetch('/api/products/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedProductIds }),
      });
      if (res.ok) {
        onToast(`✓ ${selectedProductIds.length} produk berhasil dinonaktifkan secara massal.`, 'success');
        setSelectedProductIds([]);
        fetchProducts(searchQuery);
      } else {
        const err = await res.json();
        onToast(err.error?.message || 'Gagal menonaktifkan produk secara massal.', 'error');
      }
    } catch {
      onToast('Koneksi database bermasalah.', 'error');
    } finally {
      setSaving(false);
    }
  }, [selectedProductIds, searchQuery, fetchProducts, onToast]);

  const fetchMovements = useCallback(async () => {
    setLoadingMovements(true);
    try {
      const res = await fetch('/api/products/stock-movements');
      if (res.ok) {
        const data = await res.json();
        setMovements(data.items || []);
      } else {
        onToast('Gagal memuat riwayat stok.', 'error');
      }
    } catch {
      onToast('Koneksi database bermasalah.', 'error');
    } finally {
      setLoadingMovements(false);
    }
  }, [onToast]);

  const fetchShrinkageSummary = useCallback(async () => {
    setLoadingShrinkage(true);
    try {
      const res = await fetch('/api/products/shrinkage-summary');
      if (res.ok) {
        const data = await res.json();
        setShrinkageSummary(data.summary || []);
      }
    } catch (err) {
      console.error('Error fetching shrinkage summary:', err);
    } finally {
      setLoadingShrinkage(false);
    }
  }, []);

  const fetchFloatBalance = useCallback(async () => {
    setLoadingFloat(true);
    try {
      const res = await fetch('/api/agent/float-balance');
      if (res.ok) {
        const data = await res.json();
        setFloatBalance(Number(data.balance));
      }
    } catch {
      onToast('Gagal memuat saldo float.', 'error');
    } finally {
      setLoadingFloat(false);
    }
  }, [onToast]);

  const fetchFloatLedger = useCallback(async () => {
    setLoadingLedger(true);
    try {
      const res = await fetch('/api/agent/float-ledger');
      if (res.ok) {
        const data = await res.json();
        setFloatLedger(data.items || []);
      }
    } catch {
      // silent
    } finally {
      setLoadingLedger(false);
    }
  }, []);

  const handleSubmitFloatAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(adjustFloatAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setAdjustFloatError('Nominal penyesuaian harus valid dan lebih dari 0.');
      return;
    }

    setSaving(true);
    setAdjustFloatError('');

    const finalAmount = adjustFloatType === 'deposit_in' ? amountNum : -amountNum;

    try {
      const res = await fetch('/api/agent/float-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: finalAmount,
          note: adjustFloatNote.trim() || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        onToast(
          adjustFloatType === 'deposit_in'
            ? `✓ Berhasil menambah saldo float sebesar Rp ${amountNum.toLocaleString('id-ID')}`
            : `✓ Berhasil mengurangi saldo float sebesar Rp ${amountNum.toLocaleString('id-ID')}`,
          'success'
        );
        setAdjustFloatAmount('');
        setAdjustFloatNote('');
        setFloatBalance(data.newBalance);
        fetchFloatLedger();
      } else {
        const err = await res.json();
        setAdjustFloatError(err.error?.message || 'Gagal menyimpan penyesuaian saldo.');
      }
    } catch {
      setAdjustFloatError('Koneksi database bermasalah.');
    } finally {
      setSaving(false);
    }
  };

  // Real-time product search with 300ms debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchProducts]);

  const fetchConsignmentData = useCallback(async () => {
    setLoadingConsignment(true);
    try {
      const [sumRes, logRes] = await Promise.all([
        fetch('/api/consignment/ledger?summary=true'),
        fetch('/api/consignment/ledger')
      ]);
      if (sumRes.ok && logRes.ok) {
        const sumData = await sumRes.json();
        const logData = await logRes.json();
        setConsignmentSummary(sumData.summary || []);
        setConsignmentLogs(logData.logs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingConsignment(false);
    }
  }, []);

  const handleSettleConsignment = async (supplierName: string) => {
    if (!confirm(`Apakah Anda yakin ingin melunasi seluruh setoran penjualan barang titipan untuk "${supplierName}"?`)) return;
    setSaving(true);
    try {
      const res = await fetch('/api/consignment/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplier_name: supplierName })
      });
      if (res.ok) {
        onToast(`✓ Setoran barang titipan untuk "${supplierName}" berhasil dilunasi.`, 'success');
        fetchConsignmentData();
      } else {
        const err = await res.json();
        onToast(err.error || 'Gagal melunasi setoran.', 'error');
      }
    } catch {
      onToast('Koneksi database bermasalah.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const fetchProcurementList = useCallback(async () => {
    setLoadingProcurement(true);
    try {
      const res = await fetch('/api/products/procurement-list');
      if (res.ok) {
        const data = await res.json();
        setProcurementItems(data.items || []);
        setTotalEstimatedCost(Number(data.total_estimated_cost || 0));
      } else {
        onToast('Gagal memuat daftar kulakan.', 'error');
      }
    } catch {
      onToast('Koneksi bermasalah saat memuat daftar kulakan.', 'error');
    } finally {
      setLoadingProcurement(false);
    }
  }, [onToast]);

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

  const fetchDiscounts = useCallback(async () => {
    setLoadingDiscounts(true);
    try {
      const res = await fetch('/api/discounts');
      if (res.ok) {
        const data = await res.json();
        setDiscounts(data.items || []);
      } else {
        onToast('Gagal memuat data diskon.', 'error');
      }
    } catch {
      onToast('Koneksi bermasalah saat memuat diskon.', 'error');
    } finally {
      setLoadingDiscounts(false);
    }
  }, [onToast]);

  const handleOpenAddDiscountForm = () => {
    setEditingDiscount(null);
    setDiscountName('');
    setDiscountType('global');
    setDiscountValueType('fixed');
    setDiscountValue('');
    setDiscountProductId(null);
    setDiscountProductSearch('');
    setDiscountProductSuggestions([]);
    setDiscountMinPurchase('0');
    setDiscountIsActive(true);
    setDiscountFormError('');
    setShowDiscountForm(true);
  };

  const handleOpenEditDiscountForm = (d: Discount) => {
    setEditingDiscount(d);
    setDiscountName(d.name);
    setDiscountType(d.discount_type);
    setDiscountValueType(d.value_type);
    setDiscountValue(String(d.discount_value));
    setDiscountProductId(d.product_id);
    setDiscountProductSearch(d.product_name || '');
    setDiscountProductSuggestions([]);
    setDiscountMinPurchase(String(d.min_purchase_amount));
    setDiscountIsActive(d.is_active);
    setDiscountFormError('');
    setShowDiscountForm(true);
  };

  const handleSubmitDiscountForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discountName.trim()) {
      setDiscountFormError('Nama diskon wajib diisi.');
      return;
    }
    if (!discountValue || Number(discountValue) <= 0) {
      setDiscountFormError('Nilai diskon harus lebih besar dari 0.');
      return;
    }
    if (discountValueType === 'percentage' && Number(discountValue) > 100) {
      setDiscountFormError('Diskon persentase tidak boleh melebihi 100%.');
      return;
    }
    if (discountType === 'product' && !discountProductId) {
      setDiscountFormError('Pilih produk untuk diskon per-produk.');
      return;
    }

    setSavingDiscount(true);
    setDiscountFormError('');

    const payload = {
      name: discountName.trim(),
      discount_type: discountType,
      value_type: discountValueType,
      discount_value: Number(discountValue),
      product_id: discountType === 'product' ? discountProductId : null,
      min_purchase_amount: discountType === 'global' ? Number(discountMinPurchase) || 0 : 0,
      is_active: discountIsActive,
    };

    try {
      const url = editingDiscount ? `/api/discounts/${editingDiscount.id}` : '/api/discounts';
      const method = editingDiscount ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        onToast(`✓ Diskon "${discountName}" berhasil ${editingDiscount ? 'diperbarui' : 'ditambahkan'}.`, 'success');
        setShowDiscountForm(false);
        fetchDiscounts();
      } else {
        const err = await res.json();
        setDiscountFormError(err.error || 'Gagal menyimpan diskon.');
      }
    } catch {
      setDiscountFormError('Koneksi bermasalah. Coba lagi.');
    } finally {
      setSavingDiscount(false);
    }
  };

  const handleDeleteDiscount = async (id: string, name: string) => {
    if (!confirm(`Hapus diskon "${name}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      const res = await fetch(`/api/discounts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        onToast(`✓ Diskon "${name}" berhasil dihapus.`, 'success');
        fetchDiscounts();
      } else {
        onToast('Gagal menghapus diskon.', 'error');
      }
    } catch {
      onToast('Koneksi bermasalah.', 'error');
    }
  };

  // Fetch data on tab change
  useEffect(() => {
    if (activeTab === 'products') {
      fetchProducts(searchQuery);
    } else if (activeTab === 'history') {
      fetchMovements();
      fetchShrinkageSummary();
    } else if (activeTab === 'float') {
      fetchFloatBalance();
      fetchFloatLedger();
    } else if (activeTab === 'consignment') {
      fetchConsignmentData();
    } else if (activeTab === 'procurement') {
      fetchProcurementList();
    } else if (activeTab === 'convert') {
      fetchConversionMaps();
    } else if (activeTab === 'discounts') {
      fetchDiscounts();
    }
  }, [activeTab, searchQuery, fetchProducts, fetchMovements, fetchShrinkageSummary, fetchFloatBalance, fetchFloatLedger, fetchConsignmentData, fetchProcurementList, fetchConversionMaps, fetchDiscounts]);

  // Discount product search with 300ms debounce
  useEffect(() => {
    if (!showDiscountForm || discountType !== 'product') return;
    if (discountProductSearch.trim().length < 2) {
      setDiscountProductSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(discountProductSearch)}&limit=10`);
        if (res.ok) {
          const data = await res.json();
          setDiscountProductSuggestions(data.items || []);
        }
      } catch { /* silent */ }
    }, 300);
    return () => clearTimeout(timer);
  }, [discountProductSearch, discountType, showDiscountForm]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts(searchQuery);
  };

  const handleOpenAddForm = useCallback(() => {
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
  }, []);

  const handleOpenEditForm = useCallback((prod: Product) => {
    setEditingProduct(prod);
    setBarcode(prod.barcode);
    setName(prod.name);
    setCategory(prod.category || 'general');
    setUnit(prod.unit || 'pcs');
    setCostPrice(Number(prod.cost_price).toString());
    setSellPrice(Number(prod.sell_price).toString());
    setStockQty(Number(prod.stock_qty).toString());
    setReorderThreshold(Number(prod.reorder_threshold || 5).toString());
    setIsConsignment(prod.is_consignment || false);
    setConsignmentSupplierName(prod.consignment_supplier_name || '');
    setConsignmentCostShare(prod.consignment_cost_share ? Number(prod.consignment_cost_share).toString() : '');
    setNearestExpiryDate(prod.nearest_expiry_date ? prod.nearest_expiry_date.slice(0, 10) : '');
    setFormError('');
    setShowForm(true);
  }, []);

  // Handle scanned barcode from global hotkey listener
  useEffect(() => {
    if (!scannedBarcode) return;
    const existing = products.find(p => p.barcode === scannedBarcode.code);
    const timer = setTimeout(() => {
      if (existing) {
        handleOpenEditForm(existing);
        onToast(`✓ Ditemukan: ${existing.name} (Edit Mode)`, 'success');
      } else {
        handleOpenAddForm();
        setBarcode(scannedBarcode.code);
        onToast(`✓ Barcode baru terdeteksi: ${scannedBarcode.code}`, 'success');
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [scannedBarcode, products, handleOpenEditForm, handleOpenAddForm, onToast]);

  const handleDeleteProduct = async (id: string, prodName: string) => {
    if (!confirm(`Apakah Anda yakin ingin menonaktifkan produk "${prodName}"?`)) return;
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onToast(`✓ Produk "${prodName}" berhasil dinonaktifkan.`, 'success');
        fetchProducts(searchQuery);
      } else {
        const err = await res.json();
        onToast(err.error?.message || 'Gagal menghapus produk.', 'error');
      }
    } catch {
      onToast('Koneksi bermasalah saat menghapus.', 'error');
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim() || !name.trim() || !sellPrice || !stockQty) {
      setFormError('Harap isi semua kolom wajib.');
      return;
    }

    if (Number(sellPrice) < Number(costPrice)) {
      setFormError('Harga jual tidak boleh lebih rendah dari harga modal.');
      return;
    }

    setSaving(true);
    setFormError('');

    const payload = {
      barcode: barcode.trim(),
      name: name.trim(),
      category,
      unit,
      cost_price: Number(costPrice) || 0,
      sell_price: Number(sellPrice),
      stock_qty: Number(stockQty),
      reorder_threshold: Number(reorderThreshold) || 5,
      is_consignment: isConsignment,
      consignment_supplier_name: isConsignment ? consignmentSupplierName.trim() : null,
      consignment_cost_share: isConsignment ? Number(consignmentCostShare) || 0 : 0,
      nearest_expiry_date: nearestExpiryDate || null
    };

    try {
      const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
      const method = editingProduct ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        onToast(
          editingProduct 
            ? `✓ Produk "${name}" berhasil diperbarui.`
            : `✓ Produk "${name}" berhasil ditambahkan.`,
          'success'
        );
        setShowForm(false);
        fetchProducts(searchQuery);
      } else {
        const err = await res.json();
        setFormError(err.error?.message || 'Gagal menyimpan produk.');
      }
    } catch {
      setFormError('Koneksi bermasalah. Coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  // Stock Adjustment logic
  const handleAdjustSearchChange = (val: string) => {
    setAdjustSearch(val);
  };

  // Real-time stock adjustment lookup with 300ms debounce
  useEffect(() => {
    if (adjustSearch.trim().length < 2) {
      const timer = setTimeout(() => {
        setAdjustSuggestions([]);
      }, 0);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(adjustSearch)}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setAdjustSuggestions(data.items || []);
        }
      } catch (err) {
        console.error(err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [adjustSearch]);

  const handleSelectAdjustProduct = (prod: Product) => {
    setSelectedProduct(prod);
    setAdjustSearch('');
    setAdjustSuggestions([]);
    setAdjustError('');
  };

  const handleSubmitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) {
      setAdjustError('Harap pilih produk terlebih dahulu.');
      return;
    }
    const qtyNum = Number(adjustQty);
    if (qtyNum === 0 || isNaN(qtyNum)) {
      setAdjustError('Jumlah penyesuaian tidak boleh nol.');
      return;
    }

    setSaving(true);
    setAdjustError('');

    try {
      const res = await fetch('/api/products/adjust-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          movementType: adjustType,
          qtyChange: qtyNum,
          note: adjustNote.trim(),
        }),
      });

      if (res.ok) {
        onToast(`✓ Penyesuaian stok produk "${selectedProduct.name}" berhasil disimpan.`, 'success');
        setSelectedProduct(null);
        setAdjustQty('');
        setAdjustNote('');
        fetchProducts(searchQuery);
      } else {
        const err = await res.json();
        setAdjustError(err.error?.message || 'Gagal menyesuaikan stok.');
      }
    } catch {
      setAdjustError('Koneksi database bermasalah.');
    } finally {
      setSaving(false);
    }
  };

  // Real-time source product lookup for conversion with 300ms debounce
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

  // Real-time destination product lookup for conversion with 300ms debounce
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

  // Real-time lookups for conversion map setup
  useEffect(() => {
    if (mapSourceSearch.trim().length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  useEffect(() => {
    if (mapDestSearch.trim().length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const fetchCustomers = useCallback(async (search = '') => {
    setLoadingCustomers(true);
    try {
      const url = search 
        ? `/api/customers?search=${encodeURIComponent(search)}`
        : `/api/customers`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.items || []);
      } else {
        onToast('Gagal memuat daftar pelanggan.', 'error');
      }
    } catch {
      onToast('Koneksi database bermasalah.', 'error');
    } finally {
      setLoadingCustomers(false);
    }
  }, [onToast]);

  const handleOpenAddCustomerForm = useCallback(() => {
    setEditingCustomer(null);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setCustomerCreditLimit('500000');
    setCustomerFormError('');
    setShowCustomerForm(true);
  }, []);

  const handleOpenEditCustomerForm = useCallback((cust: Customer) => {
    setEditingCustomer(cust);
    setCustomerName(cust.name);
    setCustomerPhone(cust.phone || '');
    setCustomerAddress(cust.address || '');
    setCustomerCreditLimit(Number(cust.credit_limit).toString());
    setCustomerFormError('');
    setShowCustomerForm(true);
  }, []);

  const handleSubmitCustomerForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setCustomerFormError('Nama pelanggan wajib diisi.');
      return;
    }
    const limitNum = Number(customerCreditLimit);
    if (isNaN(limitNum) || limitNum < 0) {
      setCustomerFormError('Limit kredit harus berupa angka positif.');
      return;
    }

    setSaving(true);
    setCustomerFormError('');

    const payload = {
      name: customerName.trim(),
      phone: customerPhone.trim(),
      address: customerAddress.trim(),
      credit_limit: limitNum
    };

    try {
      const url = editingCustomer ? `/api/customers/${editingCustomer.id}` : '/api/customers';
      const method = editingCustomer ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        onToast(
          editingCustomer 
            ? `✓ Pelanggan "${customerName}" berhasil diperbarui.`
            : `✓ Pelanggan "${customerName}" berhasil ditambahkan.`,
          'success'
        );
        setShowCustomerForm(false);
        fetchCustomers(searchCustomerQuery);
      } else {
        const err = await res.json();
        setCustomerFormError(err.error || 'Gagal menyimpan pelanggan.');
      }
    } catch {
      setCustomerFormError('Koneksi bermasalah. Coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCustomer = async (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menonaktifkan pelanggan "${name}"?`)) return;
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onToast(`✓ Pelanggan "${name}" berhasil dinonaktifkan.`, 'success');
        fetchCustomers(searchCustomerQuery);
        if (selectedCustomerDetail?.id === id) {
          setSelectedCustomerDetail(null);
        }
      } else {
        const err = await res.json();
        onToast(err.error || 'Gagal menghapus pelanggan.', 'error');
      }
    } catch {
      onToast('Koneksi bermasalah saat menghapus.', 'error');
    }
  };

  const fetchCustomerHistory = useCallback(async (id: string) => {
    setLoadingCustomerHistory(true);
    try {
      const res = await fetch(`/api/customers/${id}/history`);
      if (res.ok) {
        const data = await res.json();
        setCustomerLedger(data.ledger || []);
        setCustomerSales(data.sales || []);
      } else {
        onToast('Gagal memuat riwayat pelanggan.', 'error');
      }
    } catch {
      onToast('Koneksi database bermasalah.', 'error');
    } finally {
      setLoadingCustomerHistory(false);
    }
  }, [onToast]);

  const handleSubmitPayDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerDetail) return;
    const amountNum = parseFloat(payDebtAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setPayDebtError('Jumlah pembayaran harus berupa angka valid dan lebih dari 0.');
      return;
    }
    if (amountNum > Number(selectedCustomerDetail.current_debt)) {
      setPayDebtError('Jumlah pembayaran tidak boleh melebihi sisa hutang.');
      return;
    }

    setSaving(true);
    setPayDebtError('');

    try {
      const res = await fetch(`/api/customers/${selectedCustomerDetail.id}/pay-debt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountNum,
          note: payDebtNote.trim() || undefined
        }),
      });

      if (res.ok) {
        const data = await res.json();
        onToast(`✓ Pembayaran hutang sebesar Rp ${amountNum.toLocaleString('id-ID')} berhasil dicatat.`, 'success');
        setPayDebtAmount('');
        setPayDebtNote('');
        setShowPayDebtForm(false);
        // Refresh customer details and history
        setSelectedCustomerDetail(prev => prev ? { ...prev, current_debt: data.newDebt } : null);
        fetchCustomerHistory(selectedCustomerDetail.id);
        fetchCustomers(searchCustomerQuery);
      } else {
        const err = await res.json();
        setPayDebtError(err.error || 'Gagal menyimpan pembayaran hutang.');
      }
    } catch {
      setPayDebtError('Koneksi database bermasalah.');
    } finally {
      setSaving(false);
    }
  };

  const handleSendWaReminder = async (cust: Customer) => {
    if (!cust.phone || cust.phone.trim() === '') {
      onToast('Pelanggan tidak memiliki nomor telepon terdaftar.', 'error');
      return;
    }
    setSendingWa(true);
    try {
      const res = await fetch(`/api/customers/${cust.id}/send-debt-alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'reminder' })
      });
      const data = await res.json();
      if (res.ok) {
        onToast(`✓ Pengingat WA berhasil dikirim ke ${cust.name}.`, 'success');
      } else {
        onToast(data.warning || data.error || 'Gagal mengirim pengingat WA.', 'error');
      }
    } catch {
      onToast('Koneksi bermasalah dengan server.', 'error');
    } finally {
      setSendingWa(false);
    }
  };

  // Real-time customer search with 300ms debounce
  useEffect(() => {
    if (activeTab === 'customers') {
      const timer = setTimeout(() => {
        fetchCustomers(searchCustomerQuery);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [searchCustomerQuery, activeTab, fetchCustomers]);

  // Trigger fetching history when selectedCustomerDetail changes
  useEffect(() => {
    if (selectedCustomerDetail) {
      fetchCustomerHistory(selectedCustomerDetail.id);
    }
  }, [selectedCustomerDetail, fetchCustomerHistory]);

  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch('/api/cashier-sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.items || []);
      } else {
        onToast('Gagal memuat riwayat sesi kasir.', 'error');
      }
    } catch {
      onToast('Koneksi database bermasalah.', 'error');
    } finally {
      setLoadingSessions(false);
    }
  }, [onToast]);

  useEffect(() => {
    if (activeTab === 'sessions') {
      fetchSessions();
    }
  }, [activeTab, fetchSessions]);

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
        fetchProducts(searchQuery);
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

  const handleOpenTiersModal = async (prod: Product) => {
    setSelectedTiersProduct(prod);
    setTiersError('');
    setLoadingTiers(true);
    try {
      const res = await fetch(`/api/products/${prod.id}/tiers`);
      if (res.ok) {
        const data = await res.json();
        setProductTiers(data.tiers || []);
      } else {
        setTiersError('Gagal memuat detail tingkatan harga.');
      }
    } catch {
      setTiersError('Koneksi internet atau server terganggu.');
    } finally {
      setLoadingTiers(false);
    }
  };

  const handleTierFieldChange = (idx: number, field: string, val: string) => {
    setProductTiers(prev => prev.map((t, i) => i === idx ? { ...t, [field]: val } : t));
  };

  const handleAddTierRow = () => {
    setProductTiers(prev => [...prev, { name: '', min_qty: '', tier_price: '' }]);
  };

  const handleRemoveTierRow = (idx: number) => {
    setProductTiers(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSaveTiers = async () => {
    if (!selectedTiersProduct) return;
    setSaving(true);
    setTiersError('');

    // Validation
    for (const t of productTiers) {
      if (!t.name || t.name.trim() === '') {
        setTiersError('Semua tingkatan wajib memiliki nama (misal: Grosir).');
        setSaving(false);
        return;
      }
      if (!t.min_qty || isNaN(Number(t.min_qty)) || Number(t.min_qty) <= 0) {
        setTiersError('Kuantitas minimum harus berupa angka positif.');
        setSaving(false);
        return;
      }
      if (t.tier_price === '' || isNaN(Number(t.tier_price)) || Number(t.tier_price) < 0) {
        setTiersError('Harga tingkatan harus berupa angka positif.');
        setSaving(false);
        return;
      }
    }

    try {
      const res = await fetch(`/api/products/${selectedTiersProduct.id}/tiers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiers: productTiers })
      });
      if (res.ok) {
        onToast(`✓ Berhasil memperbarui harga grosir untuk ${selectedTiersProduct.name}.`, 'success');
        setSelectedTiersProduct(null);
        fetchProducts(searchQuery);
      } else {
        const err = await res.json();
        setTiersError(err.error || 'Gagal menyimpan tingkatan harga.');
      }
    } catch {
      setTiersError('Koneksi database bermasalah.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-row gap-gutter overflow-hidden h-full">
      {/* Side Navbar / Tab Switcher */}
      <div className="w-60 bg-surface-container border border-outline-variant/30 rounded-xl p-2 gap-1 flex flex-col shrink-0 overflow-y-auto scrollbar-hide h-full">
        <button
          onClick={() => setActiveTab('products')}
          className={`font-label-md text-label-md px-4 py-2.5 rounded-lg flex items-center gap-3 transition-all cursor-pointer shrink-0 w-full text-left ${
            activeTab === 'products'
              ? 'bg-secondary-container text-on-secondary-container shadow-md font-bold'
              : 'text-on-surface-variant hover:bg-surface-container-high/50'
          }`}
        >
          <Package size={16} />
          Manajemen Produk
        </button>
        <button
          onClick={() => setActiveTab('adjust')}
          className={`font-label-md text-label-md px-4 py-2.5 rounded-lg flex items-center gap-3 transition-all cursor-pointer shrink-0 w-full text-left ${
            activeTab === 'adjust'
              ? 'bg-secondary-container text-on-secondary-container shadow-md font-bold'
              : 'text-on-surface-variant hover:bg-surface-container-high/50'
          }`}
        >
          <Scale size={16} />
          Penyesuaian Stok
        </button>
        <button
          onClick={() => setActiveTab('convert')}
          className={`font-label-md text-label-md px-4 py-2.5 rounded-lg flex items-center gap-3 transition-all cursor-pointer shrink-0 w-full text-left ${
            activeTab === 'convert'
              ? 'bg-secondary-container text-on-secondary-container shadow-md font-bold'
              : 'text-on-surface-variant hover:bg-surface-container-high/50'
          }`}
        >
          <RefreshCw size={14} />
          Konversi Produk
        </button>
        <button
          onClick={() => setActiveTab('customers')}
          className={`font-label-md text-label-md px-4 py-2.5 rounded-lg flex items-center gap-3 transition-all cursor-pointer shrink-0 w-full text-left ${
            activeTab === 'customers'
              ? 'bg-secondary-container text-on-secondary-container shadow-md font-bold'
              : 'text-on-surface-variant hover:bg-surface-container-high/50'
          }`}
        >
          <Users size={16} />
          Kelola Pelanggan
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          className={`font-label-md text-label-md px-4 py-2.5 rounded-lg flex items-center gap-3 transition-all cursor-pointer shrink-0 w-full text-left ${
            activeTab === 'sessions'
              ? 'bg-secondary-container text-on-secondary-container shadow-md font-bold'
              : 'text-on-surface-variant hover:bg-surface-container-high/50'
          }`}
        >
          <Wallet size={16} />
          Rekonsiliasi Kasir
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`font-label-md text-label-md px-4 py-2.5 rounded-lg flex items-center gap-3 transition-all cursor-pointer shrink-0 w-full text-left ${
            activeTab === 'history'
              ? 'bg-secondary-container text-on-secondary-container shadow-md font-bold'
              : 'text-on-surface-variant hover:bg-surface-container-high/50'
          }`}
        >
          <History size={16} />
          Riwayat Stok
        </button>
        <button
          onClick={() => setActiveTab('float')}
          className={`font-label-md text-label-md px-4 py-2.5 rounded-lg flex items-center gap-3 transition-all cursor-pointer shrink-0 w-full text-left ${
            activeTab === 'float'
              ? 'bg-secondary-container text-on-secondary-container shadow-md font-bold'
              : 'text-on-surface-variant hover:bg-surface-container-high/50'
          }`}
        >
          <Wallet size={16} />
          Kelola Saldo Agen
        </button>
        <button
          onClick={() => setActiveTab('consignment')}
          className={`font-label-md text-label-md px-4 py-2.5 rounded-lg flex items-center gap-3 transition-all cursor-pointer shrink-0 w-full text-left ${
            activeTab === 'consignment'
              ? 'bg-secondary-container text-on-secondary-container shadow-md font-bold'
              : 'text-on-surface-variant hover:bg-surface-container-high/50'
          }`}
        >
          <Truck size={16} />
          Barang Konsinyasi
        </button>
        <button
          onClick={() => setActiveTab('procurement')}
          className={`font-label-md text-label-md px-4 py-2.5 rounded-lg flex items-center gap-3 transition-all cursor-pointer shrink-0 w-full text-left ${
            activeTab === 'procurement'
              ? 'bg-secondary-container text-on-secondary-container shadow-md font-bold'
              : 'text-on-surface-variant hover:bg-surface-container-high/50'
          }`}
        >
          <Tag size={16} />
          Daftar Kulakan
        </button>
        <button
          onClick={() => setActiveTab('discounts')}
          className={`font-label-md text-label-md px-4 py-2.5 rounded-lg flex items-center gap-3 transition-all cursor-pointer shrink-0 w-full text-left ${
            activeTab === 'discounts'
              ? 'bg-secondary-container text-on-secondary-container shadow-md font-bold'
              : 'text-on-surface-variant hover:bg-surface-container-high/50'
          }`}
        >
          <Percent size={16} />
          Manajemen Diskon
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 flex gap-gutter overflow-hidden h-full">
        {activeTab === 'products' && (
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

              {/* Search Bar */}
              <form onSubmit={handleSearchSubmit} className="flex gap-2 mb-4 shrink-0">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Cari produk berdasarkan nama..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-surface-dim border border-outline-variant rounded-lg px-3 py-2 pl-10 text-on-surface font-label-md text-label-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors placeholder:text-on-surface-variant/40"
                  />
                  <Search size={18} className="absolute left-3 top-2.5 text-on-surface-variant/60" />
                </div>
                <button
                  type="submit"
                  className="bg-surface-container-highest border border-outline-variant text-on-surface font-label-md text-label-md rounded-lg px-5 hover:bg-surface-container-high transition-colors"
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
                  <table className="w-full text-left border-collapse">
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
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              Number(prod.stock_qty) <= Number(prod.reorder_threshold || 5)
                                ? 'bg-error-container text-on-error-container animate-pulse'
                                : 'bg-secondary-container/50 text-on-secondary-container'
                            }`}>
                              {Number(prod.stock_qty)} {prod.unit}
                            </span>
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
                )}
              </div>
            </div>

            {/* ── RIGHT: Add / Edit Form Panel ─────────────────────────────────── */}
            {showForm && (
              <div className="w-80 shrink-0 flex flex-col bg-surface-container rounded-xl border border-outline-variant p-4 overflow-y-auto max-h-full">
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
                    <input
                      type="text"
                      value={barcode}
                      onChange={e => setBarcode(e.target.value)}
                      placeholder="Contoh: 89912345"
                      className="bg-surface-dim border border-outline-variant rounded-lg px-3 py-2 text-on-surface font-label-md text-label-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors"
                      required
                      disabled={saving || (editingProduct !== null)}
                    />
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
                            Nama Penitip / Supplier *
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
            )}
          </>
        )}

        {/* Tab Penyesuaian Stok */}
        {activeTab === 'adjust' && (
          <div className="flex-1 bg-surface-container rounded-xl border border-outline-variant p-5 overflow-hidden max-w-xl mx-auto w-full">
            <div className="flex items-center gap-2 mb-4 border-b border-outline-variant pb-2">
              <Scale size={20} className="text-secondary" />
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                Penyesuaian & Restock Produk
              </h2>
            </div>

            <form onSubmit={handleSubmitAdjustment} className="flex flex-col gap-3.5">
              {/* Product Autocomplete Search */}
              <div className="flex flex-col gap-1.5 relative">
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                  Cari Produk *
                </label>
                {selectedProduct ? (
                  <div className="flex justify-between items-center bg-surface-dim border border-outline-variant rounded-lg p-2.5">
                    <div className="flex flex-col">
                      <span className="font-semibold text-on-surface text-sm">{selectedProduct.name}</span>
                      <span className="text-xs text-on-surface-variant font-mono">{selectedProduct.barcode} | Stok: {Number(selectedProduct.stock_qty)} {selectedProduct.unit}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedProduct(null)}
                      className="p-1 hover:bg-surface-container-high rounded text-on-surface-variant transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      placeholder="Ketik minimal 2 karakter untuk mencari produk..."
                      value={adjustSearch}
                      onChange={e => handleAdjustSearchChange(e.target.value)}
                      className="w-full bg-surface-dim border border-outline-variant rounded-lg px-3 py-2 text-on-surface font-label-md text-label-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors"
                    />
                    {adjustSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-50 bg-surface-container-highest border border-outline-variant rounded-lg shadow-xl mt-1 py-1 max-h-48 overflow-y-auto">
                        {adjustSuggestions.map(p => (
                          <div
                            key={p.id}
                            onClick={() => handleSelectAdjustProduct(p)}
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

              {/* Adjustment Type */}
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                  Tipe Penyesuaian *
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('restock')}
                    className={`border rounded-lg py-2 font-label-md text-label-md font-bold transition-all cursor-pointer ${
                      adjustType === 'restock'
                        ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400 shadow-sm'
                        : 'bg-surface-dim border-outline-variant text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    Restock (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('adjustment')}
                    className={`border rounded-lg py-2 font-label-md text-label-md font-bold transition-all cursor-pointer ${
                      adjustType === 'adjustment'
                        ? 'bg-secondary-container border-secondary text-on-secondary-container shadow-sm'
                        : 'bg-surface-dim border-outline-variant text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    Penyesuaian (+/-)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('damaged')}
                    className={`border rounded-lg py-2 font-label-md text-label-md font-bold transition-all cursor-pointer ${
                      adjustType === 'damaged'
                        ? 'bg-error-container/20 border-error text-error shadow-sm'
                        : 'bg-surface-dim border-outline-variant text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    Barang Rusak (-)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('expired')}
                    className={`border rounded-lg py-2 font-label-md text-label-md font-bold transition-all cursor-pointer ${
                      adjustType === 'expired'
                        ? 'bg-amber-950/40 border-amber-500 text-amber-400 shadow-sm'
                        : 'bg-surface-dim border-outline-variant text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    Kedaluwarsa (-)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('stolen')}
                    className={`border rounded-lg py-2 font-label-md text-label-md font-bold transition-all cursor-pointer ${
                      adjustType === 'stolen'
                        ? 'bg-fuchsia-950/40 border-fuchsia-500 text-fuchsia-400 shadow-sm'
                        : 'bg-surface-dim border-outline-variant text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    Hilang / Dicuri (-)
                  </button>
                </div>
              </div>

              {/* Qty Change */}
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                  Jumlah Perubahan Stok *
                </label>
                <input
                  type="number"
                  placeholder={['damaged', 'expired', 'stolen'].includes(adjustType) ? 'Misal: 5' : adjustType === 'restock' ? 'Misal: 10' : 'Misal: -2 atau 5'}
                  value={adjustQty}
                  onChange={e => setAdjustQty(e.target.value)}
                  className="bg-surface-dim border border-outline-variant rounded-lg px-3 py-2 text-on-surface font-label-md text-label-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors"
                  required
                  disabled={saving}
                />
                <span className="text-[11px] text-on-surface-variant/75 font-mono">
                  {['damaged', 'expired', 'stolen'].includes(adjustType) 
                    ? 'Nilai akan otomatis disimpan sebagai pengurang stok.' 
                    : 'Gunakan tanda minus (-) untuk mengurangi stok.'}
                </span>
              </div>

              {/* Note */}
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                  Catatan Penyesuaian
                </label>
                <textarea
                  placeholder="Keterangan tambahan (misal: Barang rusak, retur distributor, dll.)"
                  value={adjustNote}
                  onChange={e => setAdjustNote(e.target.value)}
                  className="bg-surface-dim border border-outline-variant rounded-lg px-3 py-2 text-on-surface font-body-md text-body-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors h-16 resize-none"
                  disabled={saving}
                />
              </div>

              {/* Error display */}
              {adjustError && (
                <div className="flex items-center gap-2 bg-error-container text-on-error-container rounded-lg p-2.5 font-body-md text-body-md">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{adjustError}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={saving || !selectedProduct || !adjustQty}
                className="bg-secondary-container hover:bg-secondary-container/80 text-on-secondary-container font-label-lg text-label-lg font-bold rounded-xl py-2.5 flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md border border-secondary/30 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Menyimpan...
                  </>
                ) : (
                  'SIMPAN PENYESUAIAN STOK'
                )}
              </button>
            </form>
          </div>
        )}

        {/* Tab Konversi Produk */}
        {activeTab === 'convert' && (
          <div className="flex-1 flex gap-gutter overflow-hidden h-full w-full">
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
                        <th className="p-2.5 text-center w-16">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/20">
                      {conversionMaps.map(m => (
                        <tr key={m.id} className="hover:bg-surface-container-high/40 transition-colors">
                          <td className="p-2.5 pl-4">
                            <div className="font-semibold text-on-surface text-xs">{m.source_name}</div>
                            <div className="text-[10px] text-on-surface-variant/70 font-mono">Stok: {Number(m.source_stock)} {m.source_unit}</div>
                          </td>
                          <td className="p-2.5 font-mono text-xs font-bold text-secondary">
                            1 → {m.conversion_ratio}
                          </td>
                          <td className="p-2.5">
                            <div className="font-semibold text-on-surface text-xs">{m.dest_name}</div>
                            <div className="text-[10px] text-on-surface-variant/70 font-mono">Stok: {Number(m.dest_stock)} {m.dest_unit}</div>
                          </td>
                          <td className="p-2.5 text-center">
                            <span className="bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider leading-none">
                              Aktif
                            </span>
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
          </div>
        )}

        {/* Tab Kelola Pelanggan */}
        {activeTab === 'customers' && (
          <div className="flex-1 flex gap-gutter overflow-hidden h-full">
            {/* LEFT: Customer List & Create Form */}
            <div className="flex-1 flex flex-col bg-surface-container rounded-xl border border-outline-variant p-4 overflow-hidden">
              <div className="flex justify-between items-center mb-4 shrink-0">
                <div className="flex items-center gap-2">
                  <Users size={20} className="text-secondary" />
                  <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                    Kelola Pelanggan & Bon
                  </h2>
                </div>
                <button
                  onClick={handleOpenAddCustomerForm}
                  className="bg-secondary-container hover:bg-secondary-container/80 text-on-secondary-container font-label-md text-label-md rounded-lg px-4 py-2 flex items-center gap-1.5 transition-all shadow-md shadow-secondary/10 border border-secondary/20 cursor-pointer"
                >
                  <Plus size={16} />
                  TAMBAH PELANGGAN
                </button>
              </div>

              {/* Search Customer */}
              <div className="relative mb-4 shrink-0">
                <input
                  type="text"
                  placeholder="Cari pelanggan berdasarkan nama..."
                  value={searchCustomerQuery}
                  onChange={e => setSearchCustomerQuery(e.target.value)}
                  className="w-full bg-surface-dim border border-outline-variant rounded-lg px-3 py-2 pl-10 text-on-surface font-label-md text-label-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors placeholder:text-on-surface-variant/40"
                />
                <Search size={18} className="absolute left-3 top-2.5 text-on-surface-variant/60" />
              </div>

              {/* Customer Table */}
              <div className="flex-1 overflow-y-auto border border-outline-variant/30 rounded-lg bg-surface-dim">
                {loadingCustomers ? (
                  <div className="flex items-center justify-center h-48 text-on-surface-variant">
                    <Loader2 size={24} className="animate-spin mr-2" /> Memuat data pelanggan...
                  </div>
                ) : customers.length === 0 ? (
                  <div className="flex items-center justify-center h-48 text-on-surface-variant">
                    Belum ada data pelanggan.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse font-label-md text-label-md">
                    <thead>
                      <tr className="bg-surface-container border-b border-outline-variant font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider sticky top-0 z-10">
                        <th className="p-3 pl-4">Nama</th>
                        <th className="p-3">Telepon</th>
                        <th className="p-3">Limit Kredit</th>
                        <th className="p-3">Sisa Hutang</th>
                        <th className="p-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/20">
                      {customers.map(c => (
                        <tr 
                          key={c.id} 
                          onClick={() => setSelectedCustomerDetail(c)}
                          className={`cursor-pointer transition-colors ${
                            selectedCustomerDetail?.id === c.id 
                              ? 'bg-secondary-container/20 hover:bg-secondary-container/30' 
                              : 'hover:bg-surface-container-high/40'
                          }`}
                        >
                          <td className="p-3 pl-4 font-semibold text-on-surface">{c.name}</td>
                          <td className="p-3 font-mono text-[11px] opacity-75">{c.phone || '—'}</td>
                          <td className="p-3 text-on-surface-variant">Rp {Number(c.credit_limit).toLocaleString('id-ID')}</td>
                          <td className="p-3 font-bold text-error">Rp {Number(c.current_debt).toLocaleString('id-ID')}</td>
                          <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleOpenEditCustomerForm(c)}
                                className="p-1.5 hover:bg-surface-container-high rounded text-on-surface-variant transition-colors cursor-pointer"
                                title="Edit Pelanggan"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteCustomer(c.id, c.name)}
                                className="p-1.5 hover:bg-error-container/20 rounded text-error transition-colors cursor-pointer"
                                title="Hapus Pelanggan"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* RIGHT: Customer Detail, Ledger & Sales History */}
            <div className="w-96 shrink-0 flex flex-col bg-surface-container rounded-xl border border-outline-variant p-4 overflow-hidden">
              {selectedCustomerDetail ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="border-b border-outline-variant/30 pb-3 mb-4 shrink-0 flex justify-between items-start">
                    <div>
                      <h3 className="font-headline-sm text-lg font-bold text-on-surface">{selectedCustomerDetail.name}</h3>
                      <p className="text-xs text-on-surface-variant font-mono mt-0.5">{selectedCustomerDetail.phone || 'Tidak ada nomor telepon'}</p>
                      <p className="text-xs text-on-surface-variant mt-1 italic">{selectedCustomerDetail.address || 'Alamat tidak diisi'}</p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedCustomerDetail(null);
                        setCustomerLedger([]);
                        setCustomerSales([]);
                      }}
                      className="p-1 hover:bg-surface-container-high rounded text-on-surface-variant transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Summary Card */}
                  <div className="bg-surface-dim border border-outline-variant/60 rounded-xl p-4 mb-4 flex flex-col gap-2 shadow-inner shrink-0">
                    <div className="flex justify-between items-center text-xs text-on-surface-variant uppercase tracking-wider">
                      <span>Total Saldo Hutang</span>
                      <span className="font-semibold text-error">Limit: Rp {Number(selectedCustomerDetail.credit_limit).toLocaleString('id-ID')}</span>
                    </div>
                    <div className="font-display-price text-2xl font-bold text-error tracking-tight">
                      Rp {Number(selectedCustomerDetail.current_debt).toLocaleString('id-ID')}
                    </div>
                    <div className="text-xs text-on-surface-variant/75 flex justify-between mt-1">
                      <span>Sisa Limit Kredit:</span>
                      <span className="font-semibold text-emerald-400">
                        Rp {(Number(selectedCustomerDetail.credit_limit) - Number(selectedCustomerDetail.current_debt)).toLocaleString('id-ID')}
                      </span>
                    </div>

                    {Number(selectedCustomerDetail.current_debt) > 0 && (
                      <div className="flex flex-col gap-2 mt-2">
                        {!showPayDebtForm && (
                          <button
                            onClick={() => {
                              setPayDebtAmount(Number(selectedCustomerDetail.current_debt).toString());
                              setPayDebtNote('');
                              setPayDebtError('');
                              setShowPayDebtForm(true);
                            }}
                            className="bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-400 font-label-md text-label-md font-bold rounded-lg py-2 transition-all border border-emerald-500/20 cursor-pointer text-center w-full"
                          >
                            BAYAR HUTANG (BON)
                          </button>
                        )}
                        <button
                          onClick={() => handleSendWaReminder(selectedCustomerDetail)}
                          disabled={sendingWa}
                          className="bg-primary-container/20 hover:bg-primary-container/30 text-primary font-label-md text-label-md font-bold rounded-lg py-2 transition-all border border-primary/20 cursor-pointer text-center w-full flex items-center justify-center gap-1.5 disabled:opacity-40"
                        >
                          {sendingWa ? (
                            <>
                              <Loader2 size={14} className="animate-spin" /> Mengirim...
                            </>
                          ) : (
                            'KIRIM PENGINGAT WA'
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Pay Debt Form */}
                  {showPayDebtForm && (
                    <form onSubmit={handleSubmitPayDebt} className="bg-surface-container-highest border border-outline-variant rounded-xl p-4 mb-4 flex flex-col gap-3 shrink-0 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="flex justify-between items-center border-b border-outline-variant/20 pb-1.5">
                        <span className="font-bold text-sm text-secondary uppercase tracking-wider">Form Pembayaran Hutang</span>
                        <button
                          type="button"
                          onClick={() => setShowPayDebtForm(false)}
                          className="text-xs text-on-surface-variant hover:underline"
                        >
                          Batal
                        </button>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] text-on-surface-variant uppercase tracking-wider font-semibold">Nominal Pembayaran *</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-2.5 text-xs text-on-surface-variant">Rp</span>
                          <input
                            type="number"
                            value={payDebtAmount}
                            onChange={e => setPayDebtAmount(e.target.value)}
                            max={Number(selectedCustomerDetail.current_debt)}
                            className="w-full bg-surface-dim border border-outline-variant rounded-lg px-2.5 py-2 pl-8 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors"
                            required
                            disabled={saving}
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] text-on-surface-variant uppercase tracking-wider font-semibold">Catatan</label>
                        <input
                          type="text"
                          placeholder="Misal: Bayar tunai di kasir"
                          value={payDebtNote}
                          onChange={e => setPayDebtNote(e.target.value)}
                          className="w-full bg-surface-dim border border-outline-variant rounded-lg px-2.5 py-2 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors"
                          disabled={saving}
                        />
                      </div>

                      {payDebtError && (
                        <div className="text-xs text-error font-medium flex items-center gap-1">
                          <AlertCircle size={12} /> {payDebtError}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={saving}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-label-md text-label-md font-bold rounded-lg py-2 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : 'SIMPAN PEMBAYARAN'}
                      </button>
                    </form>
                  )}

                  {/* Tabs History */}
                  <div className="flex-1 flex flex-col overflow-hidden min-h-[200px]">
                    <span className="text-[11px] text-on-surface-variant uppercase tracking-wider font-bold mb-2 block shrink-0">Riwayat Mutasi Bon</span>
                    <div className="flex-1 overflow-y-auto border border-outline-variant/30 rounded-lg bg-surface-dim p-2 flex flex-col gap-2">
                      {loadingCustomerHistory ? (
                        <div className="flex items-center justify-center h-24 text-on-surface-variant text-xs">
                          <Loader2 size={16} className="animate-spin mr-1.5" /> Loading riwayat...
                        </div>
                      ) : customerLedger.length === 0 ? (
                        <div className="flex items-center justify-center h-24 text-on-surface-variant text-xs">
                          Belum ada transaksi bon tercatat.
                        </div>
                      ) : (
                        customerLedger.map(l => (
                          <div key={l.id} className="bg-surface-container/60 border border-outline-variant/20 rounded p-2 flex flex-col gap-1 text-[11px] hover:bg-surface-container-high/40 transition-colors">
                            <div className="flex justify-between items-center">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                l.entry_type === 'debt_added' 
                                  ? 'bg-error-container/20 text-error' 
                                  : 'bg-emerald-950/40 text-emerald-400'
                              }`}>
                                {l.entry_type === 'debt_added' ? 'Hutang Baru' : 'Bayar Hutang'}
                              </span>
                              <span className="text-[9px] text-on-surface-variant/60 font-mono">
                                {new Date(l.created_at).toLocaleDateString('id-ID')} {new Date(l.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="flex justify-between items-baseline font-semibold mt-1">
                              <span className="text-on-surface-variant">Nominal:</span>
                              <span className={l.entry_type === 'debt_added' ? 'text-error' : 'text-emerald-400'}>
                                {l.entry_type === 'debt_added' ? `+ Rp ${Number(l.amount).toLocaleString('id-ID')}` : `- Rp ${Number(l.amount).toLocaleString('id-ID')}`}
                              </span>
                            </div>
                            <div className="flex justify-between items-baseline text-[10px] opacity-75">
                              <span>Saldo Akhir:</span>
                              <span>Rp {Number(l.balance_after).toLocaleString('id-ID')}</span>
                            </div>
                            <div className="text-[10px] text-on-surface-variant mt-0.5 border-t border-outline-variant/10 pt-0.5 max-w-full truncate" title={l.note || ''}>
                              {l.note || '—'} (Oleh: {l.created_by_name || 'Kasir'})
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-on-surface-variant/60 border-2 border-dashed border-outline-variant/30 rounded-xl p-6 my-auto">
                  <Users size={32} className="opacity-40 mb-2" />
                  <p className="font-label-md text-label-md">Pilih pelanggan untuk melihat rincian bon, riwayat belanja, dan pembayaran.</p>
                </div>
              )}
            </div>

            {/* CUSTOMER FORM DIALOG (MODAL OVERLAY) */}
            {showCustomerForm && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                <div className="bg-surface-container rounded-2xl border border-outline-variant p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-center border-b border-outline-variant/30 pb-3 mb-4">
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                      {editingCustomer ? 'Edit Pelanggan' : 'Tambah Pelanggan Baru'}
                    </h3>
                    <button
                      onClick={() => setShowCustomerForm(false)}
                      className="p-1 hover:bg-surface-container-high rounded text-on-surface-variant transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <form onSubmit={handleSubmitCustomerForm} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Nama Pelanggan *</label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                        className="bg-surface-dim border border-outline-variant rounded-lg px-3 py-2 text-on-surface font-label-md text-label-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors"
                        required
                        disabled={saving}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">No. Telp / WA</label>
                      <input
                        type="text"
                        placeholder="Misal: 08123456789"
                        value={customerPhone}
                        onChange={e => setCustomerPhone(e.target.value)}
                        className="bg-surface-dim border border-outline-variant rounded-lg px-3 py-2 text-on-surface font-label-md text-label-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors"
                        disabled={saving}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Alamat</label>
                      <textarea
                        value={customerAddress}
                        onChange={e => setCustomerAddress(e.target.value)}
                        className="bg-surface-dim border border-outline-variant rounded-lg px-3 py-2 text-on-surface font-label-md text-label-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors h-20 resize-none"
                        disabled={saving}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Batas Limit Kredit (Rp) *</label>
                      <input
                        type="number"
                        value={customerCreditLimit}
                        onChange={e => setCustomerCreditLimit(e.target.value)}
                        className="bg-surface-dim border border-outline-variant rounded-lg px-3 py-2 text-on-surface font-label-md text-label-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors"
                        required
                        disabled={saving}
                      />
                    </div>

                    {customerFormError && (
                      <div className="flex items-center gap-2 bg-error-container text-on-error-container rounded-lg p-3 font-body-md text-body-md">
                        <AlertCircle size={16} className="shrink-0" />
                        <span>{customerFormError}</span>
                      </div>
                    )}

                    <div className="flex justify-end gap-2 border-t border-outline-variant/30 pt-4 mt-2">
                      <button
                        type="button"
                        onClick={() => setShowCustomerForm(false)}
                        className="bg-surface-container-highest border border-outline-variant text-on-surface font-label-md text-label-md rounded-lg px-4 py-2 hover:bg-surface-container-high transition-colors"
                        disabled={saving}
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="bg-secondary-container hover:bg-secondary-container/85 text-on-secondary-container font-label-md text-label-md font-bold rounded-lg px-5 py-2 flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                      >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        SIMPAN
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab Rekonsiliasi Kasir */}
        {activeTab === 'sessions' && (
          <div className="flex-1 flex flex-col bg-surface-container rounded-xl border border-outline-variant p-4 overflow-hidden">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <Wallet size={20} className="text-secondary" />
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Riwayat Shift & Rekonsiliasi Kasir
                </h2>
              </div>
              <button
                onClick={fetchSessions}
                disabled={loadingSessions}
                className="bg-surface-container-highest border border-outline-variant text-on-surface font-label-md text-label-md rounded-lg px-4 py-2 hover:bg-surface-container-high transition-colors disabled:opacity-40"
              >
                {loadingSessions ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto border border-outline-variant/30 rounded-lg bg-surface-dim">
              {loadingSessions ? (
                <div className="flex items-center justify-center h-48 text-on-surface-variant">
                  <Loader2 size={24} className="animate-spin mr-2" /> Memuat riwayat sesi...
                </div>
              ) : sessions.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-on-surface-variant">
                  Belum ada catatan sesi kasir.
                </div>
              ) : (
                <table className="w-full text-left border-collapse font-label-md text-label-md">
                  <thead>
                    <tr className="bg-surface-container border-b border-outline-variant font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider sticky top-0 z-10">
                      <th className="p-3 pl-4">Waktu Buka / Tutup</th>
                      <th className="p-3">Kasir</th>
                      <th className="p-3">Modal Awal</th>
                      <th className="p-3">Penjualan Cash</th>
                      <th className="p-3">Expected Cash</th>
                      <th className="p-3">Uang Fisik</th>
                      <th className="p-3">Selisih</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {sessions.map(s => (
                      <tr key={s.id} className="hover:bg-surface-container-high/40 transition-colors">
                        <td className="p-3 pl-4 text-on-surface-variant text-[11px] font-mono leading-none">
                          <span className="text-emerald-400 font-bold">Buka:</span> {new Date(s.opened_at).toLocaleDateString('id-ID')} {new Date(s.opened_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          {s.closed_at && (
                            <>
                              <br />
                              <span className="text-error font-bold">Tutup:</span> {new Date(s.closed_at).toLocaleDateString('id-ID')} {new Date(s.closed_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </>
                          )}
                        </td>
                        <td className="p-3 font-semibold text-on-surface">{s.cashier_name}</td>
                        <td className="p-3 font-mono text-[11px]">Rp {Number(s.starting_cash).toLocaleString('id-ID')}</td>
                        <td className="p-3 font-mono text-[11px] text-emerald-400">Rp {Number(s.total_cash_sales).toLocaleString('id-ID')}</td>
                        <td className="p-3 font-mono text-[11px]">Rp {Number(s.expected_cash).toLocaleString('id-ID')}</td>
                        <td className="p-3 font-mono text-[11px]">
                          {s.status === 'open' ? '—' : `Rp ${Number(s.actual_cash).toLocaleString('id-ID')}`}
                        </td>
                        <td className="p-3">
                          {s.status === 'open' ? (
                            '—'
                          ) : (
                            <span className={`font-mono text-[11px] font-bold ${
                              Number(s.cash_difference) === 0 
                                ? 'text-emerald-400' 
                                : Number(s.cash_difference) > 0 
                                ? 'text-primary' 
                                : 'text-error'
                            }`}>
                              {Number(s.cash_difference) === 0 
                                ? 'Pas' 
                                : Number(s.cash_difference) > 0 
                                ? `+ Rp ${Number(s.cash_difference).toLocaleString('id-ID')}` 
                                : `- Rp ${Math.abs(Number(s.cash_difference)).toLocaleString('id-ID')}`}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            s.status === 'open' 
                              ? 'bg-primary-container/20 text-primary border border-primary/25' 
                              : 'bg-surface-container-highest/60 text-on-surface-variant border border-outline-variant/30'
                          }`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="p-3 text-on-surface-variant max-w-[150px] truncate" title={s.notes || ''}>
                          {s.notes || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Tab Riwayat Stok */}
        {activeTab === 'history' && (
          <div className="flex-1 flex flex-col bg-surface-container rounded-xl border border-outline-variant p-4 overflow-hidden">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <History size={20} className="text-secondary" />
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Riwayat Mutasi Stok
                </h2>
              </div>
              <button
                onClick={() => {
                  fetchMovements();
                  fetchShrinkageSummary();
                }}
                disabled={loadingMovements || loadingShrinkage}
                className="bg-surface-container-highest border border-outline-variant text-on-surface font-label-md text-label-md rounded-lg px-4 py-2 hover:bg-surface-container-high transition-colors disabled:opacity-40 cursor-pointer"
              >
                {loadingMovements || loadingShrinkage ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {/* Loss / Shrinkage Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 shrink-0">
              {['damaged', 'expired', 'stolen'].map(type => {
                const item = shrinkageSummary.find(s => s.movement_type === type) || {
                  total_qty: 0,
                  total_loss: 0
                };
                const label = type === 'damaged' ? 'Barang Rusak' : type === 'expired' ? 'Kedaluwarsa' : 'Hilang / Dicuri';
                const colorClass = type === 'damaged' ? 'text-error' : type === 'expired' ? 'text-amber-400' : 'text-fuchsia-400';
                const bgClass = type === 'damaged' ? 'bg-error-container/10 border-error/20' : type === 'expired' ? 'bg-amber-950/20 border-amber-500/20' : 'bg-fuchsia-950/20 border-fuchsia-500/20';
                
                return (
                  <div key={type} className={`border rounded-xl p-3 flex flex-col gap-1 shadow-inner ${bgClass}`}>
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">{label}</span>
                    <div className="flex justify-between items-baseline mt-1">
                      <span className="font-mono text-xs opacity-75">{Number(item.total_qty).toLocaleString('id-ID')} unit</span>
                      <span className={`font-display-price text-base font-bold ${colorClass}`}>
                        Rp {Number(item.total_loss).toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto border border-outline-variant/30 rounded-lg bg-surface-dim">
              {loadingMovements ? (
                <div className="flex items-center justify-center h-48 text-on-surface-variant">
                  <Loader2 size={24} className="animate-spin mr-2" /> Memuat riwayat mutasi...
                </div>
              ) : movements.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-on-surface-variant">
                  Belum ada catatan mutasi stok.
                </div>
              ) : (
                <table className="w-full text-left border-collapse font-label-md text-label-md">
                  <thead>
                    <tr className="bg-surface-container border-b border-outline-variant font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider sticky top-0 z-10">
                      <th className="p-3 pl-4">Waktu</th>
                      <th className="p-3">Barcode</th>
                      <th className="p-3">Nama Produk</th>
                      <th className="p-3 text-center">Tipe</th>
                      <th className="p-3 text-center">Perubahan</th>
                      <th className="p-3">Pencatat</th>
                      <th className="p-3">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {movements.map(m => (
                      <tr key={m.id} className="hover:bg-surface-container-high/40 transition-colors">
                        <td className="p-3 pl-4 text-on-surface-variant text-[11px] font-mono leading-none">
                          {new Date(m.created_at).toLocaleDateString('id-ID')}<br />
                          <span className="opacity-55 text-[9px]">{new Date(m.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                        </td>
                        <td className="p-3 font-mono text-[11px] opacity-75">{m.product_barcode}</td>
                        <td className="p-3 font-semibold text-on-surface">{m.product_name}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            m.movement_type === 'sale'
                              ? 'bg-primary-container/20 text-primary border border-primary/25'
                              : m.movement_type === 'restock'
                              ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20'
                              : m.movement_type === 'damaged'
                              ? 'bg-error-container/20 text-error border border-error/20'
                              : m.movement_type === 'expired'
                              ? 'bg-amber-950/40 text-amber-400 border border-amber-500/20'
                              : m.movement_type === 'stolen'
                              ? 'bg-fuchsia-950/40 text-fuchsia-400 border border-fuchsia-500/20'
                              : 'bg-surface-container-highest text-on-surface-variant border border-outline-variant'
                          }`}>
                            {m.movement_type === 'sale' ? 'Sale' : 
                             m.movement_type === 'restock' ? 'Restock' : 
                             m.movement_type === 'damaged' ? 'Rusak' : 
                             m.movement_type === 'expired' ? 'Expired' : 
                             m.movement_type === 'stolen' ? 'Dicuri' : 'Adj'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex flex-col items-center">
                            <span className={`font-bold font-mono ${Number(m.qty_change) > 0 ? 'text-emerald-400' : 'text-error'}`}>
                              {Number(m.qty_change) > 0 ? `+${Number(m.qty_change)}` : Number(m.qty_change)}
                            </span>
                            {['damaged', 'expired', 'stolen'].includes(m.movement_type) && m.cost_price && (
                              <span className="text-[9px] text-error/80 font-semibold leading-none mt-0.5">
                                Rugi: Rp {(Math.abs(Number(m.qty_change)) * Number(m.cost_price)).toLocaleString('id-ID')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-on-surface-variant">{m.user_name || 'Kasir'}</td>
                        <td className="p-3 text-on-surface-variant max-w-[200px] truncate" title={m.note || ''}>
                          {m.note || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeTab === 'float' && (
          <div className="flex-1 flex gap-gutter overflow-hidden h-full">
            {/* LEFT: Float adjustment form */}
            <div className="w-96 shrink-0 flex flex-col bg-surface-container rounded-xl border border-outline-variant p-4 overflow-y-auto">
              <div className="flex items-center gap-2 mb-4 shrink-0">
                <Wallet size={20} className="text-secondary" />
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Kelola Saldo Agen
                </h2>
              </div>

              {/* Current float balance status */}
              <div className="bg-surface-dim border border-outline-variant/60 rounded-xl p-4 mb-4 flex flex-col gap-1.5 shadow-inner">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Saldo Float Saat Ini</span>
                <div className="flex items-baseline gap-1 text-primary">
                  <span className="font-label-md text-label-md">Rp</span>
                  <span className="font-display-price text-3xl font-bold leading-none tracking-tight">
                    {loadingFloat ? '...' : floatBalance === null ? '—' : floatBalance.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              <form onSubmit={handleSubmitFloatAdjustment} className="flex flex-col gap-4">
                {/* Adjustment Type Selector */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                    Tipe Penyesuaian Saldo *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAdjustFloatType('deposit_in')}
                      className={`border rounded-lg py-2.5 font-label-md text-label-md font-bold transition-all cursor-pointer ${
                        adjustFloatType === 'deposit_in'
                          ? 'bg-primary-container border-primary text-on-primary-container shadow-sm'
                          : 'bg-surface-dim border-outline-variant text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                    >
                      Top Up (Tambah Saldo)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustFloatType('deposit_out')}
                      className={`border rounded-lg py-2.5 font-label-md text-label-md font-bold transition-all cursor-pointer ${
                        adjustFloatType === 'deposit_out'
                          ? 'bg-secondary-container border-secondary text-on-secondary-container shadow-sm'
                          : 'bg-surface-dim border-outline-variant text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                    >
                      Withdraw (Kurang Saldo)
                    </button>
                  </div>
                </div>

                {/* Amount */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                    Nominal Perubahan Saldo *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-label-md text-label-md">Rp</span>
                    <input
                      type="number"
                      placeholder="0"
                      min={0}
                      step={1000}
                      value={adjustFloatAmount}
                      onChange={e => setAdjustFloatAmount(e.target.value)}
                      className="w-full bg-surface-dim border border-outline-variant rounded-lg px-3 py-2.5 pl-10 text-on-surface font-label-md text-label-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                      required
                      disabled={saving}
                    />
                  </div>
                </div>

                {/* Note */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                    Catatan Mutasi
                  </label>
                  <textarea
                    placeholder="Contoh: Deposit bank tunai, Tarik kas darurat, Koreksi selisih ledger, dll."
                    value={adjustFloatNote}
                    onChange={e => setAdjustFloatNote(e.target.value)}
                    className="bg-surface-dim border border-outline-variant rounded-lg px-3 py-2.5 text-on-surface font-body-md text-body-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors h-20 resize-none"
                    disabled={saving}
                  />
                </div>

                {/* Error display */}
                {adjustFloatError && (
                  <div className="flex items-center gap-2 bg-error-container text-on-error-container rounded-lg p-3 font-body-md text-body-md">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{adjustFloatError}</span>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={saving || !adjustFloatAmount}
                  className="bg-secondary-container hover:bg-secondary-container/80 text-on-secondary-container font-label-lg text-label-lg font-bold rounded-xl py-3.5 flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md border border-secondary/30 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {saving ? (
                    <><Loader2 size={18} className="animate-spin" /> Menyimpan...</>
                  ) : (
                    'SIMPAN PERUBAHAN SALDO'
                  )}
                </button>
              </form>
            </div>

            {/* RIGHT: Ledger history log */}
            <div className="flex-1 flex flex-col bg-surface-container rounded-xl border border-outline-variant p-4 overflow-hidden">
              <div className="flex justify-between items-center mb-4 shrink-0">
                <div className="flex items-center gap-2">
                  <History size={20} className="text-secondary" />
                  <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                    Riwayat Mutasi Saldo Float
                  </h2>
                </div>
                <button
                  onClick={fetchFloatLedger}
                  disabled={loadingLedger}
                  className="bg-surface-container-highest border border-outline-variant text-on-surface font-label-md text-label-md rounded-lg px-4 py-2 hover:bg-surface-container-high transition-colors disabled:opacity-40 cursor-pointer"
                >
                  {loadingLedger ? 'Loading...' : 'Refresh'}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto border border-outline-variant/30 rounded-lg bg-surface-dim">
                {loadingLedger ? (
                  <div className="flex items-center justify-center h-48 text-on-surface-variant">
                    <Loader2 size={24} className="animate-spin mr-2" /> Memuat riwayat mutasi...
                  </div>
                ) : floatLedger.length === 0 ? (
                  <div className="flex items-center justify-center h-48 text-on-surface-variant">
                    Belum ada catatan mutasi saldo float.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse font-label-md text-label-md">
                    <thead>
                      <tr className="bg-surface-container border-b border-outline-variant font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider sticky top-0 z-10">
                        <th className="p-3 pl-4">Waktu</th>
                        <th className="p-3">Tipe</th>
                        <th className="p-3 text-right">Jumlah</th>
                        <th className="p-3 text-right">Saldo Akhir</th>
                        <th className="p-3">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/20">
                      {floatLedger.map(e => (
                        <tr key={e.id} className="hover:bg-surface-container-high/40 transition-colors">
                          <td className="p-3 pl-4 text-on-surface-variant text-[11px] font-mono leading-none">
                            {new Date(e.created_at).toLocaleDateString('id-ID')}<br />
                            <span className="opacity-55 text-[9px]">{new Date(e.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              e.entry_type === 'deposit_in' || e.entry_type === 'commission_earned'
                                ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20'
                                : 'bg-amber-950/40 text-amber-400 border border-amber-500/20'
                            }`}>
                              {e.entry_type === 'deposit_in'
                                ? 'Deposit In'
                                : e.entry_type === 'deposit_out'
                                ? 'Deposit Out'
                                : e.entry_type === 'commission_earned'
                                ? 'Komisi'
                                : e.entry_type === 'settlement'
                                ? 'Settlement'
                                : 'Manual Adj'}
                            </span>
                          </td>
                          <td className={`p-3 text-right font-bold font-mono ${
                            e.entry_type === 'deposit_in' || e.entry_type === 'commission_earned' ? 'text-emerald-400' : 'text-error'
                          }`}>
                            {e.entry_type === 'deposit_in' || e.entry_type === 'commission_earned' ? '+' : '-'}{Number(e.amount).toLocaleString('id-ID')}
                          </td>
                          <td className="p-3 text-right font-mono font-semibold text-on-surface">
                            Rp {Number(e.balance_after).toLocaleString('id-ID')}
                          </td>
                          <td className="p-3 text-on-surface-variant max-w-[200px] truncate" title={e.note || ''}>
                            {e.note || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'consignment' && (
          <div className="flex-1 flex gap-gutter overflow-hidden h-full w-full">
            {/* LEFT: Summary of debts by supplier */}
            <div className="w-[380px] bg-surface-container rounded-xl border border-outline-variant p-4 flex flex-col shrink-0 overflow-y-auto">
              <div className="flex items-center gap-2 mb-4 border-b border-outline-variant/30 pb-3 shrink-0">
                <Truck size={18} className="text-secondary" />
                <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                  Ringkasan Supplier
                </h3>
              </div>

              {loadingConsignment ? (
                <div className="flex items-center justify-center py-12 text-on-surface-variant">
                  <Loader2 size={24} className="animate-spin mr-2" /> Loading...
                </div>
              ) : consignmentSummary.length === 0 ? (
                <div className="text-center py-12 text-on-surface-variant opacity-60 text-sm italic">
                  Belum ada data setoran barang titipan.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {consignmentSummary.map(s => (
                    <div key={s.supplier_name} className="bg-surface-container-high rounded-xl border border-outline-variant/30 p-4 flex flex-col gap-3">
                      <div>
                        <div className="font-bold text-on-surface text-base">{s.supplier_name}</div>
                        <div className="text-xs text-on-surface-variant opacity-75 mt-0.5">Total Terjual: {Number(s.total_sold_qty)} unit</div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 border-t border-b border-outline-variant/20 py-2 my-1 text-xs font-mono">
                        <div>
                          <span className="text-[10px] text-on-surface-variant block uppercase">Telah Dibayar</span>
                          <span className="text-emerald-400 font-bold text-sm">Rp {Number(s.total_paid_owed).toLocaleString('id-ID')}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-on-surface-variant block uppercase">Belum Dibayar</span>
                          <span className="text-error font-bold text-sm">Rp {Number(s.total_unpaid_owed).toLocaleString('id-ID')}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSettleConsignment(s.supplier_name)}
                        disabled={saving || Number(s.total_unpaid_owed) <= 0}
                        className="bg-emerald-950/50 hover:bg-emerald-950 text-emerald-400 border border-emerald-500/20 disabled:opacity-40 font-label-md text-label-md font-bold py-2 px-3 rounded-lg text-center transition-colors cursor-pointer w-full"
                      >
                        LUNASI SETORAN
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT: Detailed logs */}
            <div className="flex-1 flex flex-col bg-surface-container rounded-xl border border-outline-variant p-4 overflow-hidden">
              <div className="flex justify-between items-center mb-4 shrink-0">
                <div className="flex items-center gap-2">
                  <History size={20} className="text-secondary" />
                  <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                    Riwayat Penjualan Barang Titipan
                  </h2>
                </div>
                <button
                  onClick={fetchConsignmentData}
                  disabled={loadingConsignment}
                  className="bg-surface-container-highest border border-outline-variant text-on-surface font-label-md text-label-md rounded-lg px-4 py-2 hover:bg-surface-container-high transition-colors disabled:opacity-40 cursor-pointer"
                >
                  {loadingConsignment ? 'Loading...' : 'Refresh'}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto border border-outline-variant/30 rounded-lg bg-surface-dim">
                {loadingConsignment ? (
                  <div className="flex items-center justify-center h-48 text-on-surface-variant">
                    <Loader2 size={24} className="animate-spin mr-2" /> Memuat mutasi konsinyasi...
                  </div>
                ) : consignmentLogs.length === 0 ? (
                  <div className="flex items-center justify-center h-48 text-on-surface-variant">
                    Belum ada riwayat penjualan barang titipan.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse font-label-md text-label-md">
                    <thead>
                      <tr className="bg-surface-container border-b border-outline-variant font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider sticky top-0 z-10">
                        <th className="p-3 pl-4">Tanggal Ritel</th>
                        <th className="p-3">Nama Barang</th>
                        <th className="p-3">Supplier</th>
                        <th className="p-3 text-center">Terjual</th>
                        <th className="p-3 text-right">Bagi Hasil</th>
                        <th className="p-3 text-right">Total Setoran</th>
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/20">
                      {consignmentLogs.map(log => (
                        <tr key={log.id} className="hover:bg-surface-container-high/40 transition-colors">
                          <td className="p-3 pl-4 text-on-surface-variant text-[11px] font-mono leading-none">
                            {new Date(log.created_at).toLocaleDateString('id-ID')}<br />
                            <span className="opacity-55 text-[9px]">{new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                          </td>
                          <td className="p-3 font-semibold text-on-surface">{log.product_name}</td>
                          <td className="p-3 text-on-surface-variant">{log.supplier_name}</td>
                          <td className="p-3 text-center font-mono text-on-surface">
                            {Number(log.qty_sold)} {log.product_unit || 'pcs'}
                          </td>
                          <td className="p-3 text-right font-mono text-on-surface-variant">
                            Rp {Number(log.cost_share).toLocaleString('id-ID')}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-on-surface">
                            Rp {Number(log.total_owed).toLocaleString('id-ID')}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              log.status === 'paid'
                                ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20'
                                : 'bg-red-950/40 text-red-400 border border-red-500/20'
                            }`}>
                              {log.status === 'paid' ? 'Lunas' : 'Belum Setor'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'procurement' && (
          <div className="flex-1 flex gap-gutter overflow-hidden h-full w-full">
            {/* Main table showing procurement items */}
            <div className="flex-1 flex flex-col bg-surface-container rounded-xl border border-outline-variant p-5 overflow-hidden">
              <div className="flex justify-between items-center mb-4 shrink-0">
                <div className="flex items-center gap-2">
                  <Tag size={20} className="text-secondary" />
                  <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                    Daftar Kulakan / Belanja Reorder Otomatis
                  </h2>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={fetchProcurementList}
                    disabled={loadingProcurement}
                    className="bg-surface-container-highest border border-outline-variant text-on-surface font-label-md text-label-md rounded-lg px-4 py-2 hover:bg-surface-container-high transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    {loadingProcurement ? 'Loading...' : 'Refresh'}
                  </button>
                  <button
                    onClick={() => {
                      const text = procurementItems.map(p => `- ${p.name} (Barcode: ${p.barcode}) | Stok Saat Ini: ${Number(p.stock_qty)} | Batas Min: ${Number(p.reorder_threshold)} | Rekomendasi Beli: ${Number(p.suggested_qty)} ${p.unit}`).join('\n');
                      const totalCost = `Estimasi Total Biaya Kulakan: Rp ${totalEstimatedCost.toLocaleString('id-ID')}`;
                      const formatted = `*DAFTAR KULAKAN WARUNG RAFILAH*\n\n${text}\n\n${totalCost}`;
                      window.open(`https://wa.me/?text=${encodeURIComponent(formatted)}`, '_blank');
                    }}
                    disabled={procurementItems.length === 0}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-label-md text-label-md font-bold rounded-lg px-4 py-2 flex items-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    Kirim via WA
                  </button>
                </div>
              </div>

              {/* Total Estimated Cost Banner */}
              <div className="bg-secondary-container/10 border border-secondary/20 rounded-xl p-4 mb-4 flex items-center justify-between shrink-0 font-label-md text-label-md">
                <span className="font-semibold text-on-surface-variant uppercase tracking-wider">Total Estimasi Modal Belanja Kulakan</span>
                <span className="font-black text-xl text-secondary font-mono">
                  Rp {totalEstimatedCost.toLocaleString('id-ID')}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto border border-outline-variant/30 rounded-lg bg-surface-dim">
                {loadingProcurement ? (
                  <div className="flex items-center justify-center py-16 text-on-surface-variant">
                    <Loader2 size={24} className="animate-spin mr-2" /> Menghitung kebutuhan belanja...
                  </div>
                ) : procurementItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant opacity-60 text-center">
                    <Tag size={32} className="mb-2" />
                    <p className="font-label-md text-label-md">Semua produk memiliki stok di atas batas minimum.</p>
                    <p className="text-xs">Tidak ada barang yang perlu dibeli ulang saat ini.</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse font-label-md text-label-md">
                    <thead>
                      <tr className="bg-surface-container border-b border-outline-variant font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider sticky top-0 z-10">
                        <th className="p-3 pl-4">Barcode</th>
                        <th className="p-3">Nama Produk</th>
                        <th className="p-3 text-center">Stok Saat Ini</th>
                        <th className="p-3 text-center">Batas Minimum</th>
                        <th className="p-3 text-center">Saran Qty Beli</th>
                        <th className="p-3 text-right">Harga Modal</th>
                        <th className="p-3 text-right">Estimasi Biaya</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/20">
                      {procurementItems.map(p => (
                        <tr key={p.id} className="hover:bg-surface-container-high/40 transition-colors">
                          <td className="p-3 pl-4 font-mono text-[11px] opacity-75">{p.barcode}</td>
                          <td className="p-3 font-semibold text-on-surface">{p.name}</td>
                          <td className="p-3 text-center">
                            <span className="bg-error-container text-on-error-container px-2 py-0.5 rounded text-[11px] font-bold">
                              {Number(p.stock_qty)} {p.unit}
                            </span>
                          </td>
                          <td className="p-3 text-center font-semibold text-on-surface-variant">
                            {Number(p.reorder_threshold)} {p.unit}
                          </td>
                          <td className="p-3 text-center font-bold text-secondary">
                            {Number(p.suggested_qty)} {p.unit}
                          </td>
                          <td className="p-3 text-right font-mono text-on-surface-variant">
                            Rp {Number(p.cost_price).toLocaleString('id-ID')}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-on-surface">
                            Rp {Number(p.estimated_cost).toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Tab Manajemen Diskon ───────────────────────────────────────────── */}
        {activeTab === 'discounts' && (
          <div className="flex-1 flex gap-gutter overflow-hidden h-full">
            {/* LEFT: Discount List */}
            <div className="flex-1 flex flex-col bg-surface-container rounded-xl border border-outline-variant p-5 overflow-hidden">
              <div className="flex justify-between items-center mb-4 shrink-0">
                <div className="flex items-center gap-2">
                  <Percent size={20} className="text-secondary" />
                  <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">Manajemen Diskon</h2>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={fetchDiscounts}
                    disabled={loadingDiscounts}
                    className="bg-surface-container-highest border border-outline-variant text-on-surface font-label-md text-label-md rounded-lg px-4 py-2 hover:bg-surface-container-high transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    {loadingDiscounts ? 'Loading...' : 'Refresh'}
                  </button>
                  <button
                    onClick={handleOpenAddDiscountForm}
                    className="bg-secondary-container hover:bg-secondary-container/80 text-on-secondary-container font-label-md text-label-md font-bold rounded-lg px-4 py-2 flex items-center gap-1.5 transition-all shadow-md shadow-secondary/10 border border-secondary/20 cursor-pointer"
                  >
                    <Plus size={16} />
                    BUAT DISKON
                  </button>
                </div>
              </div>

              {/* Info Banner */}
              <div className="bg-primary-container/10 border border-primary/20 rounded-xl p-3 mb-4 shrink-0 text-sm text-on-surface-variant leading-relaxed">
                <p><span className="font-bold text-primary">Diskon Global</span> — berlaku untuk semua produk di transaksi ritel, dengan minimal pembelian opsional.</p>
                <p className="mt-1"><span className="font-bold text-secondary">Diskon Per-Produk</span> — hanya berlaku untuk produk tertentu. Kasir bisa memilih diskon saat proses checkout.</p>
              </div>

              <div className="flex-1 overflow-y-auto border border-outline-variant/30 rounded-lg bg-surface-dim">
                {loadingDiscounts ? (
                  <div className="flex items-center justify-center py-16 text-on-surface-variant">
                    <Loader2 size={24} className="animate-spin mr-2" /> Memuat diskon...
                  </div>
                ) : discounts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant gap-2">
                    <Percent size={32} className="opacity-30" />
                    <p className="font-medium">Belum ada diskon yang dibuat.</p>
                    <p className="text-sm opacity-60">Klik "Buat Diskon" untuk menambahkan.</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse font-label-md text-label-md">
                    <thead>
                      <tr className="bg-surface-container border-b border-outline-variant font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider sticky top-0 z-10">
                        <th className="p-3 pl-4">Nama Diskon</th>
                        <th className="p-3">Tipe</th>
                        <th className="p-3">Nilai</th>
                        <th className="p-3">Produk / Min. Beli</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/20">
                      {discounts.map(d => (
                        <tr key={d.id} className="hover:bg-surface-container-high/30 transition-colors">
                          <td className="p-3 pl-4">
                            <span className="font-semibold text-on-surface">{d.name}</span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              d.discount_type === 'global'
                                ? 'bg-primary-container text-on-primary-container'
                                : 'bg-secondary-container text-on-secondary-container'
                            }`}>
                              {d.discount_type === 'global' ? 'Global' : 'Per-Produk'}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-bold">
                            {d.value_type === 'percentage'
                              ? `${d.discount_value}%`
                              : `Rp ${d.discount_value.toLocaleString('id-ID')}`
                            }
                          </td>
                          <td className="p-3 text-on-surface-variant text-xs">
                            {d.discount_type === 'product'
                              ? <span className="font-medium text-on-surface">{d.product_name || '-'} <span className="font-mono opacity-50">{d.product_barcode}</span></span>
                              : d.min_purchase_amount > 0
                                ? `Min. Rp ${d.min_purchase_amount.toLocaleString('id-ID')}`
                                : <span className="opacity-40">Semua transaksi</span>
                            }
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={async () => {
                                try {
                                  const res = await fetch(`/api/discounts/${d.id}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ is_active: !d.is_active }),
                                  });
                                  if (res.ok) {
                                    onToast(`✓ Status diskon diubah.`, 'success');
                                    fetchDiscounts();
                                  }
                                } catch { onToast('Gagal mengubah status.', 'error'); }
                              }}
                              className={`px-3 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-all ${
                                d.is_active
                                  ? 'bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30'
                                  : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-container-high'
                              }`}
                            >
                              {d.is_active ? 'Aktif' : 'Nonaktif'}
                            </button>
                          </td>
                          <td className="p-3">
                            <div className="flex gap-1.5 justify-center">
                              <button
                                onClick={() => handleOpenEditDiscountForm(d)}
                                title="Edit"
                                className="p-1.5 rounded hover:bg-surface-container-high text-on-surface-variant transition-colors cursor-pointer"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteDiscount(d.id, d.name)}
                                title="Hapus"
                                className="p-1.5 rounded hover:bg-error-container text-error transition-colors cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* RIGHT: Create / Edit Form */}
            {showDiscountForm && (
              <div className="w-96 shrink-0 bg-surface-container rounded-xl border border-outline-variant p-5 flex flex-col gap-4 overflow-y-auto">
                <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3">
                  <div className="flex items-center gap-2">
                    <Percent size={18} className="text-secondary" />
                    <h3 className="font-bold text-on-surface">{editingDiscount ? 'Edit Diskon' : 'Buat Diskon Baru'}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDiscountForm(false)}
                    className="p-1 hover:bg-surface-container-high rounded text-on-surface-variant transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                {discountFormError && (
                  <div className="flex items-center gap-2 bg-error-container text-on-error-container rounded-lg p-3 text-sm">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{discountFormError}</span>
                  </div>
                )}

                <form onSubmit={handleSubmitDiscountForm} className="flex flex-col gap-4">
                  {/* Name */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Nama Diskon *</label>
                    <input
                      type="text"
                      value={discountName}
                      onChange={e => setDiscountName(e.target.value)}
                      placeholder="Contoh: Diskon Pelanggan Setia"
                      className="bg-surface-dim border border-outline-variant rounded-lg px-3 py-2 text-on-surface font-label-md text-label-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors"
                    />
                  </div>

                  {/* Discount Type */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Tipe Diskon *</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['global', 'product'] as const).map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => { setDiscountType(t); setDiscountProductId(null); setDiscountProductSearch(''); }}
                          className={`border-2 rounded-lg py-2 font-label-md text-label-md font-bold cursor-pointer transition-all ${
                            discountType === t
                              ? 'bg-secondary-container border-secondary text-on-secondary-container'
                              : 'bg-surface-dim border-outline-variant text-on-surface-variant hover:bg-surface-container-high'
                          }`}
                        >
                          {t === 'global' ? '🌐 Global' : '📦 Per-Produk'}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-on-surface-variant/70">
                      {discountType === 'global'
                        ? 'Berlaku untuk semua produk dalam transaksi.'
                        : 'Hanya berlaku untuk produk tertentu yang dipilih.'}
                    </p>
                  </div>

                  {/* Product search — only if product type */}
                  {discountType === 'product' && (
                    <div className="flex flex-col gap-1.5">
                      <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Produk *</label>
                      {discountProductId ? (
                        <div className="flex justify-between items-center bg-surface-dim border border-outline-variant rounded-lg px-3 py-2">
                          <span className="font-medium text-sm text-on-surface">
                            {discountProductSearch || 'Produk dipilih'}
                          </span>
                          <button
                            type="button"
                            onClick={() => { setDiscountProductId(null); setDiscountProductSearch(''); }}
                            className="text-on-surface-variant hover:text-error transition-colors"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="relative">
                          <Search size={16} className="absolute left-3 top-2.5 text-on-surface-variant/60" />
                          <input
                            type="text"
                            value={discountProductSearch}
                            onChange={e => setDiscountProductSearch(e.target.value)}
                            placeholder="Cari produk..."
                            className="w-full bg-surface-dim border border-outline-variant rounded-lg px-3 py-2 pl-9 text-on-surface font-label-md text-label-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors"
                          />
                          {discountProductSuggestions.length > 0 && (
                            <div className="absolute top-full left-0 right-0 z-50 bg-surface-container-highest border border-outline-variant rounded-lg shadow-xl mt-1 max-h-48 overflow-y-auto">
                              {discountProductSuggestions.map(p => (
                                <div
                                  key={p.id}
                                  onClick={() => {
                                    setDiscountProductId(p.id);
                                    setDiscountProductSearch(p.name);
                                    setDiscountProductSuggestions([]);
                                  }}
                                  className="px-4 py-2 cursor-pointer hover:bg-surface-container-high transition-colors text-sm"
                                >
                                  <span className="font-semibold">{p.name}</span>
                                  <span className="ml-2 text-xs font-mono opacity-50">{p.barcode}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Value type */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Jenis Potongan *</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['fixed', 'percentage'] as const).map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setDiscountValueType(t)}
                          className={`border-2 rounded-lg py-2 font-label-md text-label-md font-bold cursor-pointer transition-all ${
                            discountValueType === t
                              ? 'bg-secondary-container border-secondary text-on-secondary-container'
                              : 'bg-surface-dim border-outline-variant text-on-surface-variant hover:bg-surface-container-high'
                          }`}
                        >
                          {t === 'fixed' ? '💰 Nominal (Rp)' : '📊 Persentase (%)'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Discount value */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                      Nilai Diskon * {discountValueType === 'percentage' ? '(%)' : '(Rp)'}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-label-md text-label-md">
                        {discountValueType === 'percentage' ? '%' : 'Rp'}
                      </span>
                      <input
                        type="number"
                        min="0"
                        max={discountValueType === 'percentage' ? 100 : undefined}
                        step={discountValueType === 'percentage' ? '0.01' : '100'}
                        value={discountValue}
                        onChange={e => setDiscountValue(e.target.value)}
                        placeholder={discountValueType === 'percentage' ? '0.00' : '0'}
                        className="w-full bg-surface-dim border border-outline-variant rounded-lg px-3 py-2 pl-10 text-on-surface font-label-md text-label-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* Min purchase — only for global */}
                  {discountType === 'global' && (
                    <div className="flex flex-col gap-1.5">
                      <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Min. Pembelian (Rp)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-label-md text-label-md">Rp</span>
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          value={discountMinPurchase}
                          onChange={e => setDiscountMinPurchase(e.target.value)}
                          placeholder="0"
                          className="w-full bg-surface-dim border border-outline-variant rounded-lg px-3 py-2 pl-10 text-on-surface font-label-md text-label-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors"
                        />
                      </div>
                      <p className="text-xs text-on-surface-variant/70">Isi 0 agar berlaku tanpa minimal pembelian.</p>
                    </div>
                  )}

                  {/* Active toggle */}
                  <div className="flex items-center justify-between bg-surface-dim border border-outline-variant rounded-lg px-3 py-3">
                    <span className="font-label-md text-label-md text-on-surface font-semibold">Aktifkan Diskon</span>
                    <button
                      type="button"
                      onClick={() => setDiscountIsActive(v => !v)}
                      className={`relative w-11 h-6 rounded-full transition-all cursor-pointer ${
                        discountIsActive ? 'bg-secondary' : 'bg-surface-container-highest'
                      }`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                        discountIsActive ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t border-outline-variant/30">
                    <button
                      type="button"
                      onClick={() => setShowDiscountForm(false)}
                      className="flex-1 bg-surface-container-highest text-on-surface font-label-md text-label-md rounded-lg py-2.5 hover:bg-surface-container-high transition-colors cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={savingDiscount}
                      className="flex-1 bg-secondary-container hover:bg-secondary-container/80 text-on-secondary-container font-label-md text-label-md font-bold rounded-lg py-2.5 flex items-center justify-center gap-1.5 transition-all shadow-md shadow-secondary/15 disabled:opacity-40 cursor-pointer"
                    >
                      {savingDiscount ? <><Loader2 size={14} className="animate-spin" /> Menyimpan...</> : <><Save size={14} /> {editingDiscount ? 'Simpan Perubahan' : 'Buat Diskon'}</>}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Harga Grosir (Pricing Tiers) Management Modal */}
      {selectedTiersProduct && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-container rounded-2xl border border-outline-variant p-6 w-full max-w-lg mx-4 flex flex-col gap-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-outline-variant/30 pb-3">
              <div className="flex items-center gap-2">
                <Tag size={20} className="text-secondary" />
                <h3 className="font-headline-sm text-lg font-bold text-on-surface">
                  Harga Grosir: {selectedTiersProduct.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedTiersProduct(null)}
                className="p-1 hover:bg-surface-container-high rounded text-on-surface-variant transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {tiersError && (
              <div className="flex items-center gap-2 bg-error-container text-on-error-container rounded-lg p-3 font-body-md text-body-md">
                <AlertCircle size={16} className="shrink-0" />
                <span>{tiersError}</span>
              </div>
            )}

            {loadingTiers ? (
              <div className="flex items-center justify-center py-12 text-on-surface-variant">
                <Loader2 size={24} className="animate-spin mr-2" /> Memuat detail...
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1">
                  <div className="grid grid-cols-12 gap-2 text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
                    <div className="col-span-5">Nama Tingkat (e.g. Grosir)</div>
                    <div className="col-span-3 text-center">Min Qty</div>
                    <div className="col-span-3 text-right">Harga (Rp)</div>
                    <div className="col-span-1"></div>
                  </div>

                  {productTiers.length === 0 ? (
                    <div className="text-center py-8 text-on-surface-variant opacity-60 text-sm italic">
                      Belum ada tingkatan harga grosir. Klik tambah untuk membuat.
                    </div>
                  ) : (
                    productTiers.map((t, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                        <input
                          type="text"
                          placeholder="Grosir / Dus"
                          value={t.name}
                          onChange={e => handleTierFieldChange(idx, 'name', e.target.value)}
                          className="col-span-5 bg-surface-dim border border-outline-variant rounded px-2.5 py-2 text-on-surface font-label-md text-label-md focus:border-secondary outline-none transition-colors"
                        />
                        <input
                          type="number"
                          placeholder="10"
                          min={1}
                          value={t.min_qty}
                          onChange={e => handleTierFieldChange(idx, 'min_qty', e.target.value)}
                          className="col-span-3 bg-surface-dim border border-outline-variant rounded px-2.5 py-2 text-on-surface font-label-md text-label-md text-center focus:border-secondary outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <input
                          type="number"
                          placeholder="2800"
                          min={0}
                          value={t.tier_price}
                          onChange={e => handleTierFieldChange(idx, 'tier_price', e.target.value)}
                          className="col-span-3 bg-surface-dim border border-outline-variant rounded px-2.5 py-2 text-on-surface font-label-md text-label-md text-right focus:border-secondary outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveTierRow(idx)}
                          className="col-span-1 p-1.5 hover:bg-error-container hover:text-on-error rounded text-on-surface-variant transition-colors flex items-center justify-center cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleAddTierRow}
                  className="bg-surface-container-highest border border-outline-variant text-on-surface font-label-md text-label-md rounded-lg py-2 flex items-center justify-center gap-1.5 hover:bg-surface-container-high transition-colors cursor-pointer w-full font-bold"
                >
                  <Plus size={14} /> TAMBAH TINGKAT HARGA
                </button>
              </>
            )}

            <div className="flex gap-2 justify-end border-t border-outline-variant/30 pt-3 mt-2">
              <button
                type="button"
                onClick={() => setSelectedTiersProduct(null)}
                className="bg-surface-container-highest text-on-surface font-label-md text-label-md rounded-lg px-4 py-2 hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveTiers}
                disabled={saving || loadingTiers}
                className="bg-secondary-container hover:bg-secondary-container/80 text-on-secondary-container font-label-md text-label-md font-bold rounded-lg px-5 py-2 flex items-center gap-1.5 transition-all shadow-md shadow-secondary/15 disabled:opacity-40 cursor-pointer"
              >
                {saving ? <><Loader2 size={14} className="animate-spin" /> Menyimpan...</> : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
