"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, Wallet, FileText, 
  Download, Printer, Calendar, RefreshCw, AlertTriangle, 
  CheckCircle2, CreditCard, ShoppingBag, ShieldCheck, ArrowUpRight, ArrowDownRight
} from 'lucide-react';

interface FinancialData {
  startDate: string;
  endDate: string;
  gross_revenue: number;
  total_cogs: number;
  gross_margin: number;
  total_discounts: number;
  total_transactions: number;
  agent_commission: number;
  agent_volume: number;
  total_agent_tx: number;
  shrinkage_loss: number;
  shrinkage_details: Array<{
    type: string;
    product_name: string;
    qty: number;
    loss: number;
    created_at: string;
  }>;
  consignment_cost: number;
  net_profit: number;
  payment_methods: Array<{
    payment_method: string;
    total_amount: number;
    count: number;
  }>;
  balance_sheet: {
    current_float: number;
    total_receivable: number;
    total_inventory_valuation: number;
    total_active_items: number;
    low_stock_count: number;
    total_store_wealth: number;
  };
}

export default function FinancialAccountingTab() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [dateRangeType, setDateRangeType] = useState<'today' | '7days' | 'month' | 'custom'>('today');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FinancialData | null>(null);

  const fetchFinancialReport = useCallback(async (start: string, end: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/net-profit?startDate=${start}&endDate=${end}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Error fetching financial report:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFinancialReport(startDate, endDate);
  }, [startDate, endDate, fetchFinancialReport]);

  const handleRangeChange = (type: 'today' | '7days' | 'month') => {
    setDateRangeType(type);
    const now = new Date();
    const end = now.toISOString().slice(0, 10);
    let start = end;

    if (type === '7days') {
      const sevenDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      start = sevenDaysAgo.toISOString().slice(0, 10);
    } else if (type === 'month') {
      start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    }

    setStartDate(start);
    setEndDate(end);
  };

  const formatRp = (n: number) => `Rp ${Math.round(n || 0).toLocaleString('id-ID')}`;

  const exportToCsv = () => {
    if (!data) return;
    const rows = [
      ['LAPORAN AKUNTANSI & LABA RUGI - WARUNG RAFILAH'],
      ['Periode', `${data.startDate} s/d ${data.endDate}`],
      [''],
      ['KOMPONEN LABA RUGI', 'JUMLAH (IDR)'],
      ['Pendapatan Penjualan Ritel (Gross Revenue)', data.gross_revenue],
      ['Harga Pokok Penjualan (HPP / COGS)', data.total_cogs],
      ['Laba Kotor Penjualan Ritel (Gross Margin)', data.gross_margin],
      ['Pendapatan Komisi Agen PPOB', data.agent_commission],
      ['Beban Kerugian Barang Rusak / Kadaluarsa (Shrinkage)', -data.shrinkage_loss],
      ['Beban Konsinyasi Supplier', -data.consignment_cost],
      ['TOTAL LABA BERSIH OPERASIONAL (NET PROFIT)', data.net_profit],
      [''],
      ['NERACA ASET & LIKUIDITAS TOKO', 'NILAI (IDR)'],
      ['Saldo Digital Float PPOB', data.balance_sheet.current_float],
      ['Total Piutang Kasbon Pelanggan (Receivables)', data.balance_sheet.total_receivable],
      ['Estimasi Nilai Total Persediaan Stok Toko', data.balance_sheet.total_inventory_valuation],
      ['TOTAL ESTIMASI KEKAYAAN ASET TOKO', data.balance_sheet.total_store_wealth],
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Laporan_Keuangan_Warung_Rafilah_${data.startDate}_sd_${data.endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const profitMarginPercent = data && data.gross_revenue > 0 
    ? ((data.net_profit / data.gross_revenue) * 100).toFixed(1) 
    : '0.0';

  return (
    <div className="flex flex-col gap-5 p-1 animate-in fade-in duration-200">
      {/* Header & Filter Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 bg-surface-container border border-outline-variant/40 p-4 rounded-2xl shadow-sm">
        <div>
          <h2 className="text-lg font-black tracking-tight text-on-surface flex items-center gap-2">
            <DollarSign className="text-primary" size={24} />
            Laporan Akuntansi & Laba Rugi
          </h2>
          <p className="text-xs text-on-surface-variant font-medium">
            Pembukuan keuangan riil, analisis margin keuntungan, dan neraca aset Warung Rafilah
          </p>
        </div>

        {/* Action Controls & Date Picker */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-surface-container-high p-1 rounded-xl border border-outline-variant/30 text-xs font-semibold">
            <button
              onClick={() => handleRangeChange('today')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                dateRangeType === 'today' ? 'bg-primary text-on-primary shadow-sm font-bold' : 'text-on-surface hover:text-primary'
              }`}
            >
              Hari Ini
            </button>
            <button
              onClick={() => handleRangeChange('7days')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                dateRangeType === '7days' ? 'bg-primary text-on-primary shadow-sm font-bold' : 'text-on-surface hover:text-primary'
              }`}
            >
              7 Hari
            </button>
            <button
              onClick={() => handleRangeChange('month')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                dateRangeType === 'month' ? 'bg-primary text-on-primary shadow-sm font-bold' : 'text-on-surface hover:text-primary'
              }`}
            >
              Bulan Ini
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-surface-container-high px-2.5 py-1.5 rounded-xl border border-outline-variant/30 text-xs">
            <Calendar size={14} className="text-on-surface-variant" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setDateRangeType('custom');
                setStartDate(e.target.value);
              }}
              className="bg-transparent text-on-surface outline-none font-mono text-[11px]"
            />
            <span className="text-on-surface-variant text-[10px]">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setDateRangeType('custom');
                setEndDate(e.target.value);
              }}
              className="bg-transparent text-on-surface outline-none font-mono text-[11px]"
            />
          </div>

          <button
            onClick={() => fetchFinancialReport(startDate, endDate)}
            className="p-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-xl border border-outline-variant/40 transition-colors cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={exportToCsv}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
            title="Export ke Excel (CSV)"
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex flex-col items-center justify-center h-64 text-on-surface-variant gap-2">
          <RefreshCw size={28} className="animate-spin text-primary" />
          <span className="text-xs font-semibold">Menghitung buku kas & laporan keuangan...</span>
        </div>
      ) : data ? (
        <>
          {/* Top 4 KPI Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Omzet Penjualan */}
            <div className="bg-surface-container border border-outline-variant/40 p-4 rounded-2xl shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Omzet Penjualan</span>
                <div className="p-2 bg-primary/10 text-primary rounded-xl">
                  <ShoppingBag size={18} />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xl font-black text-on-surface font-mono tracking-tight">{formatRp(data.gross_revenue)}</div>
                <div className="text-[11px] text-on-surface-variant font-medium mt-0.5">
                  {data.total_transactions} transaksi kasir
                </div>
              </div>
            </div>

            {/* Laba Bersih */}
            <div className="bg-gradient-to-br from-emerald-950/40 to-surface-container border border-emerald-500/30 p-4 rounded-2xl shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Laba Bersih Riil</span>
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                  <TrendingUp size={18} />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xl font-black text-emerald-400 font-mono tracking-tight">{formatRp(data.net_profit)}</div>
                <div className="flex items-center gap-1 text-[11px] text-emerald-300/90 font-semibold mt-0.5">
                  <span>Margin Profit:</span>
                  <span className="font-bold font-mono">{profitMarginPercent}%</span>
                </div>
              </div>
            </div>

            {/* Komisi Agen PPOB */}
            <div className="bg-surface-container border border-outline-variant/40 p-4 rounded-2xl shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Profit Agen PPOB</span>
                <div className="p-2 bg-secondary/10 text-secondary rounded-xl">
                  <Wallet size={18} />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xl font-black text-secondary font-mono tracking-tight">{formatRp(data.agent_commission)}</div>
                <div className="text-[11px] text-on-surface-variant font-medium mt-0.5">
                  {data.total_agent_tx} transaksi • Vol: {formatRp(data.agent_volume)}
                </div>
              </div>
            </div>

            {/* Total Valuasi Aset */}
            <div className="bg-surface-container border border-outline-variant/40 p-4 rounded-2xl shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Total Aset Toko</span>
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                  <ShieldCheck size={18} />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xl font-black text-amber-400 font-mono tracking-tight">{formatRp(data.balance_sheet.total_store_wealth)}</div>
                <div className="text-[11px] text-on-surface-variant font-medium mt-0.5">
                  Inventori + Float + Piutang
                </div>
              </div>
            </div>
          </div>

          {/* Main 2-Column Content Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left Column: Laporan Laba Rugi Standar Akuntansi */}
            <div className="lg:col-span-2 bg-surface-container border border-outline-variant/40 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-on-surface flex items-center gap-2 pb-3 border-b border-outline-variant/30">
                  <FileText size={18} className="text-primary" />
                  Rincian Laba Rugi Operasional (P&L Income Statement)
                </h3>

                <div className="divide-y divide-outline-variant/20 mt-3 text-xs">
                  {/* Pendapatan */}
                  <div className="py-2.5 flex justify-between items-center">
                    <span className="font-semibold text-on-surface">1. Total Penjualan Kotor (Gross Revenue)</span>
                    <span className="font-mono font-bold text-on-surface">{formatRp(data.gross_revenue)}</span>
                  </div>

                  {/* HPP */}
                  <div className="py-2.5 flex justify-between items-center text-rose-400">
                    <span className="font-medium">2. Harga Pokok Penjualan (HPP / COGS)</span>
                    <span className="font-mono font-semibold">- {formatRp(data.total_cogs)}</span>
                  </div>

                  {/* Laba Kotor */}
                  <div className="py-2.5 flex justify-between items-center bg-surface-container-high/40 px-2 rounded-lg font-bold">
                    <span className="text-on-surface">3. Laba Kotor Ritel (Gross Margin)</span>
                    <span className="font-mono text-emerald-400">{formatRp(data.gross_margin)}</span>
                  </div>

                  {/* Komisi PPOB */}
                  <div className="py-2.5 flex justify-between items-center text-emerald-400">
                    <span className="font-medium">+ Pendapatan Komisi Layanan Agen PPOB</span>
                    <span className="font-mono font-semibold">+ {formatRp(data.agent_commission)}</span>
                  </div>

                  {/* Kerugian Shrinkage */}
                  <div className="py-2.5 flex justify-between items-center text-rose-400">
                    <span className="font-medium">- Beban Kerugian Barang Rusak / Kadaluarsa / Hilang</span>
                    <span className="font-mono font-semibold">- {formatRp(data.shrinkage_loss)}</span>
                  </div>

                  {/* Konsinyasi */}
                  <div className="py-2.5 flex justify-between items-center text-rose-400">
                    <span className="font-medium">- Beban Bagi Hasil Konsinyasi Supplier</span>
                    <span className="font-mono font-semibold">- {formatRp(data.consignment_cost)}</span>
                  </div>

                  {/* LABA BERSIH TOTAL */}
                  <div className="py-3.5 flex justify-between items-center bg-emerald-500/15 border border-emerald-500/30 px-3 rounded-xl mt-2 font-black text-sm text-emerald-400">
                    <span className="uppercase tracking-wide">🏆 LABA BERSIH AKHIR (NET PROFIT)</span>
                    <span className="font-mono text-base">{formatRp(data.net_profit)}</span>
                  </div>
                </div>
              </div>

              {/* Shrinkage Details Alert if any */}
              {data.shrinkage_details.length > 0 && (
                <div className="mt-4 bg-rose-950/30 border border-rose-500/20 rounded-xl p-3 text-xs">
                  <div className="font-bold text-rose-300 mb-1 flex items-center gap-1.5">
                    <AlertTriangle size={14} />
                    Catatan Kerugian Barang ({data.shrinkage_details.length} item):
                  </div>
                  <div className="space-y-1 text-[11px] text-rose-200/80 font-mono">
                    {data.shrinkage_details.slice(0, 3).map((s, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>• {s.product_name} ({s.qty} unit - {s.type})</span>
                        <span className="font-bold">-{formatRp(s.loss)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Neraca Likuiditas & Breakdown Metode Pembayaran */}
            <div className="flex flex-col gap-4">
              {/* Neraca Aset Toko */}
              <div className="bg-surface-container border border-outline-variant/40 p-4 rounded-2xl shadow-sm">
                <h3 className="font-extrabold text-xs text-on-surface flex items-center gap-2 pb-2.5 border-b border-outline-variant/30 uppercase tracking-wider">
                  <ShieldCheck size={16} className="text-amber-400" />
                  Neraca Aset & Likuiditas Toko
                </h3>

                <div className="divide-y divide-outline-variant/20 mt-2 text-xs">
                  <div className="py-2 flex justify-between items-center">
                    <span className="text-on-surface-variant">Saldo Float Digital PPOB:</span>
                    <span className="font-mono font-bold text-on-surface">{formatRp(data.balance_sheet.current_float)}</span>
                  </div>
                  <div className="py-2 flex justify-between items-center">
                    <span className="text-on-surface-variant">Piutang Kasbon Pelanggan:</span>
                    <span className="font-mono font-bold text-amber-400">{formatRp(data.balance_sheet.total_receivable)}</span>
                  </div>
                  <div className="py-2 flex justify-between items-center">
                    <span className="text-on-surface-variant">Valuasi Stok Barang Toko:</span>
                    <span className="font-mono font-bold text-on-surface">{formatRp(data.balance_sheet.total_inventory_valuation)}</span>
                  </div>
                  <div className="pt-2.5 flex justify-between items-center font-bold text-amber-400">
                    <span>Total Kekayaan Aset:</span>
                    <span className="font-mono text-sm">{formatRp(data.balance_sheet.total_store_wealth)}</span>
                  </div>
                </div>
              </div>

              {/* Breakdown Metode Pembayaran */}
              <div className="bg-surface-container border border-outline-variant/40 p-4 rounded-2xl shadow-sm">
                <h3 className="font-extrabold text-xs text-on-surface flex items-center gap-2 pb-2.5 border-b border-outline-variant/30 uppercase tracking-wider">
                  <CreditCard size={16} className="text-secondary" />
                  Penerimaan Berdasarkan Metode Bayar
                </h3>

                <div className="space-y-2 mt-3">
                  {data.payment_methods.length === 0 ? (
                    <div className="text-center py-4 text-xs text-on-surface-variant">Belum ada transaksi pada periode ini.</div>
                  ) : (
                    data.payment_methods.map((pm, idx) => (
                      <div key={idx} className="bg-surface-container-high/60 p-2.5 rounded-xl flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold uppercase text-on-surface">{pm.payment_method}</span>
                          <span className="text-[10px] text-on-surface-variant">({pm.count}x)</span>
                        </div>
                        <span className="font-mono font-bold text-on-surface">{formatRp(pm.total_amount)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
