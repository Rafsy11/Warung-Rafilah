"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Wallet, RefreshCw, TrendingUp, AlertTriangle } from 'lucide-react';

const LOW_BALANCE_THRESHOLD = 500_000; // Rp 500k warning

interface FloatBalanceWidgetProps {
  /** Callback so parent can sync balance for transaction validation */
  onBalanceLoad?: (balance: number) => void;
}

export default function FloatBalanceWidget({ onBalanceLoad }: FloatBalanceWidgetProps) {
  const [balance, setBalance]     = useState<number | null>(null);
  const [loading, setLoading]     = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchBalance = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/agent/float-balance');
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      const bal = Number(data.balance);
      setBalance(bal);
      setLastUpdated(new Date());
      onBalanceLoad?.(bal);
    } catch {
      // Keep previous value on error — don't reset to null mid-session
    } finally {
      setLoading(false);
    }
  }, [onBalanceLoad]);

  // Initial load + poll every 30s, paused when tab is hidden (Page Visibility API)
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (intervalId) return; // already running
      fetchBalance();
      intervalId = setInterval(fetchBalance, 30_000);
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stopPolling();
      } else {
        startPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchBalance]);


  const isLow = balance !== null && balance < LOW_BALANCE_THRESHOLD;

  return (
    <aside
      id="float-balance-widget"
      className={`rounded-xl border p-4 flex flex-col gap-3 transition-colors ${
        isLow
          ? 'bg-error-container/20 border-error/40'
          : 'bg-surface-container-lowest border-outline-variant'
      }`}
    >
      {/* Header row */}
      <header id="float-balance-header" className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${isLow ? 'bg-error-container' : 'bg-primary-container'}`}>
            {isLow
              ? <AlertTriangle size={16} className="text-on-error-container" />
              : <Wallet size={16} className="text-on-primary-container" />
            }
          </div>
          <h4 id="float-balance-title" className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">
            Saldo Float Agen
          </h4>
        </div>
        <button
          id="btn-refresh-float-balance"
          onClick={fetchBalance}
          disabled={loading}
          className="text-on-surface-variant hover:text-primary transition-colors disabled:opacity-40 cursor-pointer p-1 rounded-lg"
          aria-label="Refresh saldo float agen"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      {/* Balance display */}
      <output id="float-balance-output" className="flex items-end gap-2 block">
        <span className="text-on-surface-variant font-label-md text-label-md self-start mt-1 font-bold">Rp</span>
        <span
          id="float-balance-value"
          className={`font-display-price text-display-price leading-none tracking-tight font-extrabold ${
            isLow ? 'text-error' : 'text-primary'
          }`}
        >
          {balance === null
            ? '—'
            : balance.toLocaleString('id-ID')}
        </span>
      </output>

      {/* Footer */}
      <footer id="float-balance-footer" className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-on-surface-variant font-label-sm text-label-sm">
          <TrendingUp size={12} />
          {isLow
            ? <span id="float-balance-warning-msg" className="text-error font-medium">Saldo hampir habis!</span>
            : <span id="float-balance-status-msg">Tersedia untuk transaksi</span>
          }
        </div>
        {lastUpdated && (
          <time id="float-balance-updated-time" className="text-on-surface-variant/50 font-label-sm text-label-sm text-[10px]">
            {lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </time>
        )}
      </footer>
    </aside>
  );
}
