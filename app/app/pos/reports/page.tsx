"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, TrendingUp, Wallet, ShoppingCart, ArrowLeft,
  RefreshCw, ChevronDown, ChevronUp, Loader2, AlertCircle,
  Smartphone, FileText, QrCode, ArrowDownCircle, ArrowRightLeft,
  DollarSign, PackageSearch, Download, History, Award, Banknote,
  AlertTriangle, Skull, Bug, ShieldAlert, TrendingDown, Package
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// ─── Types ───────────────────────────────────────────────────────────────────

interface WarungSummary {
  sale_date:         string;
  transaction_count: number;
  gross_revenue:     string;
  gross_margin:      string;
  cash_revenue?:     string;
  qris_revenue?:     string;
  transfer_revenue?: string;
}

interface AgentSummaryBreakdown {
  service_type: string;
  count:        number;
  volume:       string;
  commission:   string;
}

interface AgentSummary {
  date:              string;
  transaction_count: number;
  gross_volume:      string;
  total_commission:  string;
  total_admin_fee:   string;
  breakdown:         AgentSummaryBreakdown[];
  closing:           { status: string; closing_float: string; total_commission: string } | null;
}

interface WarungTx {
  id:               string;
  transaction_code: string;
  total_amount:     string;
  payment_method:   string;
  created_at:       string;
}

interface ProductPerformance {
  name:          string;
  barcode:       string;
  category:      string;
  unit:          string;
  total_qty:     string;
  total_revenue: string;
  total_margin:  string;
}

interface AgentClosingLog {
  id:                 string;
  closing_date:       string;
  opening_float:      string;
  closing_float:      string;
  total_transactions: number;
  total_commission:   string;
  total_admin_fee:    string;
  status:             string;
  created_at:         string;
  closed_by_name:     string | null;
}

interface NetProfitData {
  date:               string;
  gross_revenue:      number;
  total_cogs:         number;
  gross_margin:       number;
  agent_commission:   number;
  shrinkage_loss:     number;
  shrinkage_details:  { type: string; product_name: string; qty: number; loss: number }[];
  consignment_cost:   number;
  net_profit:         number;
}

interface ExpiringProduct {
  id:                   string;
  barcode:              string;
  name:                 string;
  category:             string;
  unit:                 string;
  stock_qty:            string;
  nearest_expiry_date:  string;
  days_until_expiry:    number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SERVICE_LABEL: Record<string, string> = {
  e_wallet_topup:  'E-Wallet Topup',
  bill_payment:    'Bayar Tagihan',
  qris_deposit:    'QRIS Deposit',
  cash_withdrawal: 'Tarik Tunai',
  transfer:        'Transfer Dana',
};

const SERVICE_ICON: Record<string, React.ElementType> = {
  e_wallet_topup:  Smartphone,
  bill_payment:    FileText,
  qris_deposit:    QrCode,
  cash_withdrawal: ArrowDownCircle,
  transfer:        ArrowRightLeft,
};

function formatRp(val: string | number): string {
  return `Rp ${Number(val).toLocaleString('id-ID')}`;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, accent = 'secondary',
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent?: 'primary' | 'secondary' | 'accentGreen' | 'tertiary';
}) {
  const colors: Record<string, string> = {
    primary:   'bg-primary-container/20 border-primary/30 text-primary',
    secondary: 'bg-secondary-container/20 border-secondary/30 text-secondary',
    accentGreen: 'bg-emerald-950/40 border-emerald-500/20 text-emerald-400',
    tertiary:  'bg-tertiary-container/20 border-tertiary/30 text-tertiary',
  };
  const iconColors: Record<string, string> = {
    primary:   'bg-primary-container text-on-primary-container',
    secondary: 'bg-secondary-container text-on-secondary-container',
    accentGreen: 'bg-emerald-500 text-black',
    tertiary:  'bg-tertiary-container text-on-tertiary-container',
  };
  return (
    <div className={`rounded-xl border p-4 flex gap-3 items-start ${colors[accent]}`}>
      <div className={`p-2 rounded-lg shrink-0 ${iconColors[accent]}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider truncate">{label}</div>
        <div className="font-headline-sm text-headline-sm text-on-surface font-bold leading-tight mt-0.5">{value}</div>
        {sub && <div className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const router = useRouter();

  const [date, setDate]                     = useState(todayISO());
  const [activeTab, setActiveTab]           = useState<'financial' | 'profit' | 'closings' | 'net-profit'>('financial');
  
  // Data States
  const [warung, setWarung]                 = useState<WarungSummary | null>(null);
  const [agent, setAgent]                   = useState<AgentSummary | null>(null);
  const [transactions, setTransactions]     = useState<WarungTx[]>([]);
  const [performance, setPerformance]       = useState<ProductPerformance[]>([]);
  const [closings, setClosings]             = useState<AgentClosingLog[]>([]);
  const [netProfit, setNetProfit]           = useState<NetProfitData | null>(null);
  const [expiringProducts, setExpiringProducts] = useState<ExpiringProduct[]>([]);

  // Load States
  const [loadingWarung, setLoadingWarung]   = useState(true);
  const [loadingAgent, setLoadingAgent]     = useState(true);
  const [loadingTxs, setLoadingTxs]         = useState(true);
  const [loadingPerformance, setLoadingPerformance] = useState(false);
  const [loadingClosings, setLoadingClosings]       = useState(false);
  const [loadingNetProfit, setLoadingNetProfit]     = useState(false);
  const [loadingExpiring, setLoadingExpiring]       = useState(false);
  
  const [showTxs, setShowTxs]               = useState(false);
  const [userRole, setUserRole]             = useState('');

  // Auth guard
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        setUserRole(d.role ?? '');
        if (d.role !== 'owner') router.replace('/');
      })
      .catch(() => router.replace('/'));
  }, [router]);

  const fetchWarung = useCallback(async (d: string) => {
    setLoadingWarung(true);
    try {
      const res = await fetch(`/api/sales/daily-summary?date=${d}`);
      if (res.ok) setWarung(await res.json());
    } catch { /* silent */ } finally {
      setLoadingWarung(false);
    }
  }, []);

  const fetchAgent = useCallback(async (d: string) => {
    setLoadingAgent(true);
    try {
      const res = await fetch(`/api/agent/daily-summary?date=${d}`);
      if (res.ok) setAgent(await res.json());
    } catch { /* silent */ } finally {
      setLoadingAgent(false);
    }
  }, []);

  const fetchTransactions = useCallback(async (d: string) => {
    setLoadingTxs(true);
    try {
      const res = await fetch(`/api/sales?date=${d}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.items ?? []);
      }
    } catch { /* silent */ } finally {
      setLoadingTxs(false);
    }
  }, []);

  const fetchPerformance = useCallback(async (d: string) => {
    setLoadingPerformance(true);
    try {
      const res = await fetch(`/api/sales/product-performance?date=${d}`);
      if (res.ok) {
        const data = await res.json();
        setPerformance(data.items ?? []);
      }
    } catch { /* silent */ } finally {
      setLoadingPerformance(false);
    }
  }, []);

  const fetchClosings = useCallback(async () => {
    setLoadingClosings(true);
    try {
      const res = await fetch('/api/agent/closings');
      if (res.ok) {
        const data = await res.json();
        setClosings(data.items ?? []);
      }
    } catch { /* silent */ } finally {
      setLoadingClosings(false);
    }
  }, []);

  const fetchNetProfit = useCallback(async (d: string) => {
    setLoadingNetProfit(true);
    try {
      const res = await fetch(`/api/reports/net-profit?date=${d}`);
      if (res.ok) setNetProfit(await res.json());
    } catch { /* silent */ } finally {
      setLoadingNetProfit(false);
    }
  }, []);

  const fetchExpiringProducts = useCallback(async () => {
    setLoadingExpiring(true);
    try {
      const res = await fetch('/api/products/expiring-soon?days=7');
      if (res.ok) {
        const data = await res.json();
        setExpiringProducts(data.items ?? []);
      }
    } catch { /* silent */ } finally {
      setLoadingExpiring(false);
    }
  }, []);

  const reload = useCallback((d: string) => {
    fetchWarung(d);
    fetchAgent(d);
    fetchTransactions(d);
    fetchExpiringProducts();
    if (activeTab === 'profit') fetchPerformance(d);
    if (activeTab === 'closings') fetchClosings();
    if (activeTab === 'net-profit') fetchNetProfit(d);
  }, [fetchWarung, fetchAgent, fetchTransactions, fetchPerformance, fetchClosings, fetchNetProfit, fetchExpiringProducts, activeTab]);

  useEffect(() => {
    const timer = setTimeout(() => {
      reload(date);
    }, 0);
    return () => clearTimeout(timer);
  }, [date, reload]);

  useEffect(() => {
    if (activeTab === 'profit') {
      const timer = setTimeout(() => {
        fetchPerformance(date);
      }, 0);
      return () => clearTimeout(timer);
    } else if (activeTab === 'closings') {
      const timer = setTimeout(() => {
        fetchClosings();
      }, 0);
      return () => clearTimeout(timer);
    } else if (activeTab === 'net-profit') {
      const timer = setTimeout(() => {
        fetchNetProfit(date);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [activeTab, date, fetchPerformance, fetchClosings, fetchNetProfit]);

  // Export CSV logic
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Header
    csvContent += `LAPORAN HARIAN POS WARUNG RAFILAH - TANGGAL: ${date}\n\n`;
    
    // Warung Section
    csvContent += "--- LAPORAN PENJUALAN WARUNG ---\n";
    if (warung) {
      csvContent += `Total Transaksi,${warung.transaction_count}\n`;
      csvContent += `Gross Revenue,Rp ${Number(warung.gross_revenue).toLocaleString('id-ID')}\n`;
      csvContent += `Pendapatan Tunai (Cash),Rp ${Number(warung.cash_revenue || 0).toLocaleString('id-ID')}\n`;
      csvContent += `Pendapatan QRIS,Rp ${Number(warung.qris_revenue || 0).toLocaleString('id-ID')}\n`;
      csvContent += `Pendapatan Transfer,Rp ${Number(warung.transfer_revenue || 0).toLocaleString('id-ID')}\n`;
      csvContent += `Gross Margin,Rp ${Number(warung.gross_margin).toLocaleString('id-ID')}\n\n`;
      
      // Transactions List
      csvContent += "KODE TRANSAKSI,TOTAL,METODE BAYAR,JAM\n";
      transactions.forEach(t => {
        const jam = new Date(t.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        csvContent += `"${t.transaction_code}",${t.total_amount},"${t.payment_method}","${jam}"\n`;
      });
      csvContent += "\n";
    } else {
      csvContent += "Tidak ada data penjualan warung.\n\n";
    }

    // Agent Section
    csvContent += "--- LAPORAN TRANSAKSI AGEN ---\n";
    if (agent) {
      csvContent += `Total Transaksi Agen,${agent.transaction_count}\n`;
      csvContent += `Volume Transaksi,Rp ${Number(agent.gross_volume).toLocaleString('id-ID')}\n`;
      csvContent += `Total Komisi Agen,Rp ${Number(agent.total_commission).toLocaleString('id-ID')}\n`;
      csvContent += `Total Admin Fee,Rp ${Number(agent.total_admin_fee).toLocaleString('id-ID')}\n\n`;
      
      // Agent breakdown
      csvContent += "LAYANAN,JUMLAH TX,VOLUME,KOMISI\n";
      agent.breakdown.forEach(b => {
        csvContent += `"${SERVICE_LABEL[b.service_type] || b.service_type}",${b.count},${b.volume},${b.commission}\n`;
      });
    } else {
      csvContent += "Tidak ada data transaksi agen.\n";
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Laporan_POS_${date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isLoading = loadingWarung || loadingAgent;

  if (userRole && userRole !== 'owner') return null; // guarded by auth check redirect

  return (
    <div className="bg-background text-on-background min-h-screen w-full flex flex-col font-body-md select-none">
      {/* Header */}
      <header className="bg-surface-container flex items-center gap-4 px-6 h-14 border-b border-outline-variant shrink-0 z-50 shadow-sm">
        <button
          onClick={() => router.push('/')}
          className="p-2 hover:bg-surface-container-highest rounded-lg text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
          aria-label="Kembali"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <BarChart3 size={18} className="text-secondary" />
          <h1 className="font-headline-sm text-headline-sm font-bold text-on-surface">Laporan Detail</h1>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <input
            type="date"
            value={date}
            max={todayISO()}
            onChange={e => setDate(e.target.value)}
            className="bg-surface-dim border border-outline-variant rounded-lg px-3 py-1.5 text-on-surface font-label-md text-label-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors"
          />
          <button
            onClick={() => reload(date)}
            disabled={isLoading}
            className="p-2 hover:bg-surface-container-highest rounded-lg text-on-surface-variant hover:text-primary transition-colors disabled:opacity-40 cursor-pointer"
            aria-label="Refresh"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleExportCSV}
            className="bg-secondary-container hover:bg-secondary-container/85 border border-secondary/20 text-on-secondary-container font-label-md text-label-md rounded-lg px-3.5 py-1.5 flex items-center gap-1.5 transition-all shadow-md shadow-secondary/10 cursor-pointer"
          >
            <Download size={14} />
            EKSPOR CSV
          </button>
        </div>
      </header>

      {/* Tab Switcher */}
      <div className="bg-surface-container-lowest border-b border-outline-variant/50 px-6 py-2 shrink-0 flex gap-2">
        <button
          onClick={() => setActiveTab('financial')}
          className={`font-label-md text-label-md px-4 py-2 rounded-lg transition-all cursor-pointer ${
            activeTab === 'financial'
              ? 'bg-secondary-container text-on-secondary-container font-bold shadow-md'
              : 'text-on-surface-variant hover:bg-surface-container-high/50'
          }`}
        >
          Ringkasan Finansial
        </button>
        <button
          onClick={() => setActiveTab('profit')}
          className={`font-label-md text-label-md px-4 py-2 rounded-lg transition-all cursor-pointer ${
            activeTab === 'profit'
              ? 'bg-secondary-container text-on-secondary-container font-bold shadow-md'
              : 'text-on-surface-variant hover:bg-surface-container-high/50'
          }`}
        >
          Laba Produk
        </button>
        <button
          onClick={() => setActiveTab('closings')}
          className={`font-label-md text-label-md px-4 py-2 rounded-lg transition-all cursor-pointer ${
            activeTab === 'closings'
              ? 'bg-secondary-container text-on-secondary-container font-bold shadow-md'
              : 'text-on-surface-variant hover:bg-surface-container-high/50'
          }`}
        >
          Histori Tutup Kas
        </button>
        <button
          onClick={() => setActiveTab('net-profit')}
          className={`font-label-md text-label-md px-4 py-2 rounded-lg transition-all cursor-pointer ${
            activeTab === 'net-profit'
              ? 'bg-secondary-container text-on-secondary-container font-bold shadow-md'
              : 'text-on-surface-variant hover:bg-surface-container-high/50'
          }`}
        >
          Laba Rugi Bersih
        </button>
      </div>

      <main className="flex-1 p-6 overflow-y-auto flex flex-col gap-6 max-w-5xl mx-auto w-full">
        {activeTab === 'financial' && (
          <>
            {/* ── WARUNG SECTION ────────────────────────────────────────────── */}
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <ShoppingCart size={16} className="text-secondary" />
                <h2 className="font-label-lg text-label-lg font-bold text-on-surface uppercase tracking-wider">Warung</h2>
              </div>

              {loadingWarung ? (
                <div className="flex items-center gap-2 text-on-surface-variant py-4">
                  <Loader2 size={18} className="animate-spin" /> Memuat data warung...
                </div>
              ) : !warung || Number(warung.transaction_count) === 0 ? (
                <div className="bg-surface-container rounded-xl border border-outline-variant p-6 flex items-center gap-3 text-on-surface-variant">
                  <PackageSearch size={20} />
                  <span className="font-body-md text-body-md">Tidak ada transaksi warung pada tanggal ini.</span>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-3 flex flex-col gap-3">
                    <div className="grid grid-cols-3 gap-3">
                      <StatCard
                        label="Total Transaksi"
                        value={String(warung.transaction_count)}
                        icon={ShoppingCart}
                        accent="secondary"
                      />
                      <StatCard
                        label="Gross Revenue"
                        value={formatRp(warung.gross_revenue)}
                        icon={TrendingUp}
                        accent="secondary"
                      />
                      <StatCard
                        label="Gross Margin"
                        value={formatRp(warung.gross_margin)}
                        sub={
                          Number(warung.gross_revenue) > 0
                            ? `${((Number(warung.gross_margin) / Number(warung.gross_revenue)) * 100).toFixed(1)}% profitabilitas`
                            : undefined
                        }
                        icon={DollarSign}
                        accent="tertiary"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <StatCard
                        label="Pendapatan Tunai (Cash)"
                        value={formatRp(warung.cash_revenue || 0)}
                        icon={Banknote}
                        accent="primary"
                      />
                      <StatCard
                        label="Pendapatan QRIS"
                        value={formatRp(warung.qris_revenue || 0)}
                        icon={QrCode}
                        accent="accentGreen"
                      />
                      <StatCard
                        label="Pendapatan Transfer"
                        value={formatRp(warung.transfer_revenue || 0)}
                        icon={ArrowRightLeft}
                        accent="primary"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Transaction list toggle */}
              {!loadingWarung && (warung?.transaction_count ?? 0) > 0 && (
                <div className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden shadow-inner">
                  <button
                    onClick={() => setShowTxs(v => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-container-high transition-colors cursor-pointer"
                  >
                    <span className="font-label-md text-label-md text-on-surface font-semibold">Daftar Transaksi Kasir ({transactions.length})</span>
                    {showTxs ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {showTxs && (
                    <div className="border-t border-outline-variant/30 overflow-x-auto">
                      {loadingTxs ? (
                        <div className="flex items-center justify-center p-6 text-on-surface-variant">
                          <Loader2 size={18} className="animate-spin mr-2" /> Memuat...
                        </div>
                      ) : transactions.length === 0 ? (
                        <div className="p-4 text-on-surface-variant font-body-md text-body-md text-center">Tidak ada data.</div>
                      ) : (
                        <table className="w-full text-left border-collapse font-label-md text-label-md">
                          <thead className="bg-surface-container-highest text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                            <tr>
                              <th className="p-3 pl-4">Kode Transaksi</th>
                              <th className="p-3 text-right">Total</th>
                              <th className="p-3 text-center">Metode</th>
                              <th className="p-3 text-right">Waktu</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-outline-variant/20 bg-surface-dim">
                            {transactions.map(tx => (
                              <tr key={tx.id} className="hover:bg-surface-container-high/40 transition-colors">
                                <td className="p-3 pl-4 font-mono text-[11px] text-on-surface-variant">{tx.transaction_code}</td>
                                <td className="p-3 text-right font-semibold">{formatRp(tx.total_amount)}</td>
                                <td className="p-3 text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                    tx.payment_method === 'cash'
                                      ? 'bg-secondary-container/60 text-on-secondary-container'
                                      : tx.payment_method === 'split'
                                      ? 'bg-tertiary-container/60 text-on-tertiary-container border border-tertiary/20'
                                      : 'bg-primary-container/60 text-on-primary-container'
                                  }`}>
                                    {tx.payment_method}
                                  </span>
                                </td>
                                <td className="p-3 text-right text-on-surface-variant text-[11px] font-mono">
                                  {new Date(tx.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ── AGENT SECTION ─────────────────────────────────────────────── */}
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Wallet size={16} className="text-primary" />
                <h2 className="font-label-lg text-label-lg font-bold text-on-surface uppercase tracking-wider">Agent</h2>
                {agent?.closing && (
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    agent.closing.status === 'closed'
                      ? 'bg-secondary-container text-on-secondary-container'
                      : 'bg-amber-950 text-amber-400 border border-amber-500/20'
                  }`}>
                    KAS {agent.closing.status === 'closed' ? 'SUDAH DITUTUP' : 'OPEN'}
                  </span>
                )}
              </div>

              {loadingAgent ? (
                <div className="flex items-center gap-2 text-on-surface-variant py-4">
                  <Loader2 size={18} className="animate-spin" /> Memuat data agen...
                </div>
              ) : !agent || agent.transaction_count === 0 ? (
                <div className="bg-surface-container rounded-xl border border-outline-variant p-6 flex items-center gap-3 text-on-surface-variant">
                  <PackageSearch size={20} />
                  <span className="font-body-md text-body-md">Tidak ada transaksi agen pada tanggal ini.</span>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-3">
                    <StatCard
                      label="Total Transaksi"
                      value={String(agent.transaction_count)}
                      icon={BarChart3}
                      accent="primary"
                    />
                    <StatCard
                      label="Gross Volume"
                      value={formatRp(agent.gross_volume)}
                      icon={TrendingUp}
                      accent="primary"
                    />
                    <StatCard
                      label="Total Komisi"
                      value={formatRp(agent.total_commission)}
                      icon={Award}
                      accent="accentGreen"
                    />
                    <StatCard
                      label="Total Admin Fee"
                      value={formatRp(agent.total_admin_fee)}
                      icon={Wallet}
                      accent="secondary"
                    />
                  </div>

                  {/* Per-service breakdown */}
                  {agent.breakdown.length > 0 && (
                    <div className="bg-surface-container rounded-xl border border-outline-variant p-4">
                      <div className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-3 font-semibold">
                        Breakdown per Layanan Agen
                      </div>
                      <div className="flex flex-col gap-2">
                        {agent.breakdown.map(b => {
                          const Icon = SERVICE_ICON[b.service_type] ?? Wallet;
                          return (
                            <div key={b.service_type} className="flex items-center gap-3 bg-surface-dim border border-outline-variant/20 rounded-lg px-3 py-2">
                              <Icon size={16} className="text-on-surface-variant shrink-0" />
                              <span className="font-label-md text-label-md text-on-surface flex-1">
                                {SERVICE_LABEL[b.service_type] ?? b.service_type}
                              </span>
                              <span className="text-on-surface-variant font-label-sm text-label-sm text-[11px] font-semibold">
                                {b.count}x
                              </span>
                              <span className="font-label-md text-label-md text-on-surface font-semibold">
                                {formatRp(b.volume)}
                              </span>
                              <span className="text-emerald-400 font-label-sm text-label-sm font-semibold text-[11px] font-mono">
                                +{formatRp(b.commission)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Closing info */}
              {agent?.closing && agent.closing.status === 'closed' && (
                <div className="bg-emerald-950/40 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3">
                  <AlertCircle size={16} className="text-emerald-400 shrink-0" />
                  <span className="font-body-md text-body-md text-on-surface">
                    Kas agen sudah diverifikasi dan ditutup hari ini. Komisi agen yang dibukukan: <strong className="text-emerald-400 font-mono">{formatRp(agent.closing.total_commission)}</strong>
                  </span>
                </div>
              )}
            </section>

            {/* Expiry warning */}
            {expiringProducts.length > 0 && (
              <section className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-error" />
                  <h2 className="font-label-lg text-label-lg font-bold text-error uppercase tracking-wider">Peringatan Kedaluwarsa ({expiringProducts.length} Produk)</h2>
                </div>
                <div className="bg-error-container/20 border border-error/20 rounded-xl p-4">
                  <div className="flex flex-col gap-2">
                    {expiringProducts.map(p => (
                      <div key={p.id} className="flex items-center justify-between bg-surface-dim border border-outline-variant/20 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-3">
                          <ShieldAlert size={16} className={`shrink-0 ${p.days_until_expiry <= 0 ? 'text-error' : 'text-amber-400'}`} />
                          <div>
                            <span className="font-semibold text-on-surface text-sm">{p.name}</span>
                            <span className="text-on-surface-variant text-xs ml-2">({Number(p.stock_qty)} {p.unit})</span>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          p.days_until_expiry <= 0
                            ? 'bg-red-950/50 text-red-400 border border-red-500/20'
                            : 'bg-amber-950/50 text-amber-400 border border-amber-500/20'
                        }`}>
                          {p.days_until_expiry <= 0 ? 'SUDAH EXPIRED' : `${p.days_until_expiry} hari lagi`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {/* Tab Laba Produk */}
        {activeTab === 'profit' && (
          <section className="flex flex-col gap-4 bg-surface-container rounded-xl border border-outline-variant p-4 overflow-hidden shadow-md">
            <div className="flex justify-between items-center shrink-0 border-b border-outline-variant/30 pb-3">
              <div className="flex items-center gap-2">
                <DollarSign size={20} className="text-secondary" />
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">Analisis Kinerja & Laba Produk</h2>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto border border-outline-variant/30 rounded-lg bg-surface-dim">
              {loadingPerformance ? (
                <div className="flex items-center justify-center h-48 text-on-surface-variant">
                  <Loader2 size={24} className="animate-spin mr-2" /> Memuat analisis produk...
                </div>
              ) : performance.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-on-surface-variant">
                  Tidak ada barang terjual pada tanggal ini.
                </div>
              ) : (
                <table className="w-full text-left border-collapse font-label-md text-label-md">
                  <thead>
                    <tr className="bg-surface-container border-b border-outline-variant font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider sticky top-0 z-10">
                      <th className="p-3 pl-4">Barcode</th>
                      <th className="p-3">Nama Produk</th>
                      <th className="p-3">Kategori</th>
                      <th className="p-3 text-center">Terjual</th>
                      <th className="p-3 text-right">Omzet Penjualan</th>
                      <th className="p-3 text-right text-emerald-400">Total Profit (Margin)</th>
                      <th className="p-3 text-center">Margin %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {performance.map(p => {
                      const omzet = Number(p.total_revenue);
                      const untung = Number(p.total_margin);
                      const marginPct = omzet > 0 ? ((untung / omzet) * 100).toFixed(1) : '0';
                      return (
                        <tr key={p.barcode} className="hover:bg-surface-container-high/40 transition-colors">
                          <td className="p-3 pl-4 font-mono text-[11px] opacity-75">{p.barcode}</td>
                          <td className="p-3 font-semibold text-on-surface">{p.name}</td>
                          <td className="p-3 capitalize text-on-surface-variant/80">{p.category}</td>
                          <td className="p-3 text-center font-bold">{Number(p.total_qty)} {p.unit}</td>
                          <td className="p-3 text-right font-semibold font-mono">{formatRp(p.total_revenue)}</td>
                          <td className="p-3 text-right font-bold text-emerald-400 font-mono">{formatRp(p.total_margin)}</td>
                          <td className="p-3 text-center">
                            <span className="bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[11px] font-bold font-mono">
                              {marginPct}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}

        {/* Tab Histori Tutup Kas */}
        {activeTab === 'closings' && (
          <section className="flex flex-col gap-4 bg-surface-container rounded-xl border border-outline-variant p-4 overflow-hidden shadow-md">
            <div className="flex justify-between items-center shrink-0 border-b border-outline-variant/30 pb-3">
              <div className="flex items-center gap-2">
                <History size={20} className="text-secondary" />
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">Histori Tutup Kas Harian Agen</h2>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto border border-outline-variant/30 rounded-lg bg-surface-dim">
              {loadingClosings ? (
                <div className="flex items-center justify-center h-48 text-on-surface-variant">
                  <Loader2 size={24} className="animate-spin mr-2" /> Memuat histori tutup kas...
                </div>
              ) : closings.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-on-surface-variant">
                  Belum ada catatan tutup kas agen.
                </div>
              ) : (
                <table className="w-full text-left border-collapse font-label-md text-label-md">
                  <thead>
                    <tr className="bg-surface-container border-b border-outline-variant font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider sticky top-0 z-10">
                      <th className="p-3 pl-4">Tanggal Closing</th>
                      <th className="p-3 text-right">Saldo Float Awal</th>
                      <th className="p-3 text-right">Saldo Float Akhir</th>
                      <th className="p-3 text-center">Total Tx</th>
                      <th className="p-3 text-right text-emerald-400">Total Komisi</th>
                      <th className="p-3 text-right">Total Admin Fee</th>
                      <th className="p-3">Penanggung Jawab</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {closings.map(c => (
                      <tr key={c.id} className="hover:bg-surface-container-high/40 transition-colors">
                        <td className="p-3 pl-4 font-mono text-[11px] font-bold text-on-surface">
                          {new Date(c.closing_date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </td>
                        <td className="p-3 text-right font-mono font-semibold">{formatRp(c.opening_float)}</td>
                        <td className="p-3 text-right font-mono font-semibold">{formatRp(c.closing_float)}</td>
                        <td className="p-3 text-center font-bold">{c.total_transactions}x</td>
                        <td className="p-3 text-right font-bold text-emerald-400 font-mono">{formatRp(c.total_commission)}</td>
                        <td className="p-3 text-right font-mono font-semibold">{formatRp(c.total_admin_fee)}</td>
                        <td className="p-3 text-on-surface-variant">{c.closed_by_name || 'Operator'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}

        {/* Tab Laba Rugi Bersih */}
        {activeTab === 'net-profit' && (
          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <TrendingDown size={16} className="text-secondary" />
              <h2 className="font-label-lg text-label-lg font-bold text-on-surface uppercase tracking-wider">Laporan Laba Rugi Bersih — {date}</h2>
            </div>

            {loadingNetProfit ? (
              <div className="flex items-center gap-2 text-on-surface-variant py-8">
                <Loader2 size={18} className="animate-spin" /> Menghitung laba rugi bersih...
              </div>
            ) : !netProfit ? (
              <div className="bg-surface-container rounded-xl border border-outline-variant p-6 text-on-surface-variant text-center">
                Tidak ada data untuk tanggal ini.
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <StatCard
                    label="Gross Revenue (Omzet Ritel)"
                    value={formatRp(netProfit.gross_revenue)}
                    icon={TrendingUp}
                    accent="secondary"
                  />
                  <StatCard
                    label="HPP (Harga Pokok Penjualan)"
                    value={formatRp(netProfit.total_cogs)}
                    sub={`Margin: ${netProfit.gross_revenue > 0 ? ((netProfit.gross_margin / netProfit.gross_revenue) * 100).toFixed(1) : 0}%`}
                    icon={Package}
                    accent="primary"
                  />
                </div>

                {/* Breakdown */}
                <div className="bg-surface-container rounded-xl border border-outline-variant p-5 flex flex-col gap-4">
                  <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider font-semibold border-b border-outline-variant/30 pb-2">Rincian Perhitungan</h3>
                  
                  <div className="flex flex-col gap-2 font-label-md text-label-md">
                    <div className="flex justify-between items-center">
                      <span className="text-on-surface-variant">Gross Margin Ritel (Jual − Modal)</span>
                      <span className="font-bold text-emerald-400 font-mono">+ {formatRp(netProfit.gross_margin)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-on-surface-variant">Komisi Agen PPOB</span>
                      <span className="font-bold text-emerald-400 font-mono">+ {formatRp(netProfit.agent_commission)}</span>
                    </div>
                    <div className="h-px bg-outline-variant/30 my-1" />
                    <div className="flex justify-between items-center">
                      <span className="text-on-surface-variant flex items-center gap-1.5">
                        <Skull size={14} className="text-error" /> Kerugian Penyusutan (Rusak/Expired/Hilang)
                      </span>
                      <span className="font-bold text-error font-mono">− {formatRp(netProfit.shrinkage_loss)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-on-surface-variant flex items-center gap-1.5">
                        <Package size={14} className="text-amber-400" /> Biaya Setoran Konsinyasi
                      </span>
                      <span className="font-bold text-amber-400 font-mono">− {formatRp(netProfit.consignment_cost)}</span>
                    </div>
                    <div className="h-px bg-outline-variant/30 my-1" />
                    <div className={`flex justify-between items-center p-3 rounded-lg border ${
                      netProfit.net_profit >= 0 
                        ? 'bg-emerald-950/30 border-emerald-500/20' 
                        : 'bg-red-950/30 border-red-500/20'
                    }`}>
                      <span className="font-bold text-on-surface text-base">LABA BERSIH (NET PROFIT)</span>
                      <span className={`font-black text-lg font-mono ${netProfit.net_profit >= 0 ? 'text-emerald-400' : 'text-error'}`}>
                        {netProfit.net_profit >= 0 ? '+' : ''}{formatRp(netProfit.net_profit)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Shrinkage Details */}
                {netProfit.shrinkage_details && netProfit.shrinkage_details.length > 0 && (
                  <div className="bg-surface-container rounded-xl border border-outline-variant p-4">
                    <div className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-3 font-semibold flex items-center gap-1.5">
                      <Bug size={14} /> Detail Kerugian Penyusutan Hari Ini
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {netProfit.shrinkage_details.map((d, i) => (
                        <div key={i} className="flex items-center justify-between bg-surface-dim border border-outline-variant/20 rounded-lg px-3 py-2 text-sm">
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                              d.type === 'expired' ? 'bg-amber-950/40 text-amber-400 border border-amber-500/20'
                              : d.type === 'stolen' ? 'bg-red-950/40 text-red-400 border border-red-500/20'
                              : 'bg-orange-950/40 text-orange-400 border border-orange-500/20'
                            }`}>{d.type}</span>
                            <span className="text-on-surface font-medium">{d.product_name}</span>
                            <span className="text-on-surface-variant text-xs">({d.qty} unit)</span>
                          </div>
                          <span className="text-error font-bold font-mono text-xs">−{formatRp(d.loss)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
