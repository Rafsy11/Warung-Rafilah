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

  // Initial load + poll every 30s
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBalance();
    }, 0);
    const id = setInterval(fetchBalance, 30_000);
    return () => {
      clearTimeout(timer);
      clearInterval(id);
    };
  }, [fetchBalance]);

  const isLow = balance !== null && balance < LOW_BALANCE_THRESHOLD;

  return (
    <div
      className={`rounded-xl border p-4 flex flex-col gap-3 transition-colors ${
        isLow
          ? 'bg-error-container/20 border-error/40'
          : 'bg-surface-container-lowest border-outline-variant'
      }`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${isLow ? 'bg-error-container' : 'bg-primary-container'}`}>
            {isLow
              ? <AlertTriangle size={16} className="text-on-error-container" />
              : <Wallet size={16} className="text-on-primary-container" />
            }
          </div>
          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
            Saldo Float Agen
          </span>
        </div>
        <button
          onClick={fetchBalance}
          disabled={loading}
          className="text-on-surface-variant hover:text-primary transition-colors disabled:opacity-40"
          aria-label="Refresh saldo"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Balance display */}
      <div className="flex items-end gap-2">
        <span className="text-on-surface-variant font-label-md text-label-md self-start mt-1">Rp</span>
        <span
          className={`font-display-price text-display-price leading-none tracking-tight ${
            isLow ? 'text-error' : 'text-primary'
          }`}
        >
          {balance === null
            ? '—'
            : balance.toLocaleString('id-ID')}
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-on-surface-variant font-label-sm text-label-sm">
          <TrendingUp size={12} />
          {isLow
            ? <span className="text-error font-medium">Saldo hampir habis!</span>
            : <span>Tersedia untuk transaksi</span>
          }
        </div>
        {lastUpdated && (
          <span className="text-on-surface-variant/50 font-label-sm text-label-sm text-[10px]">
            {lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  );
}
