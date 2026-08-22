"use client";

import React, { useState } from 'react';
import { Store, Wallet, Shield, Sparkles, Menu, X, Printer, Calculator, Keyboard, BarChart3, Sun, Moon, LogOut, RefreshCw } from 'lucide-react';

interface BottomNavProps {
  mode: 'warung' | 'agent' | 'admin';
  onModeChange: (mode: 'warung' | 'agent' | 'admin') => void;
  userRole?: string;
  onReprint?: () => void;
  onToggleAi?: () => void;
  onToggleShortcuts?: () => void;
  onToggleCalculator?: () => void;
  onCloseSession?: () => void;
  activeSession?: any;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onLogout: () => void;
}

export default function BottomNav({
  mode,
  onModeChange,
  userRole,
  onReprint,
  onToggleAi,
  onToggleShortcuts,
  onToggleCalculator,
  onCloseSession,
  activeSession,
  theme,
  onToggleTheme,
  onLogout,
}: BottomNavProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <>
      {/* Mobile Bottom Slide-up Menu Drawer */}
      {showMenu && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99] sm:hidden animate-in fade-in duration-200"
          onClick={() => setShowMenu(false)}
        >
          <div
            className="fixed bottom-16 inset-x-0 bg-surface-container border-t border-outline-variant rounded-t-2xl p-4 shadow-2xl z-[100] animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-3 border-b border-outline-variant/50 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <h3 className="font-bold text-sm text-on-surface">Menu Operasional</h3>
              </div>
              <button
                onClick={() => setShowMenu(false)}
                className="p-1 text-on-surface-variant hover:text-on-surface rounded-lg bg-surface-container-high cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => { onReprint?.(); setShowMenu(false); }}
                disabled={!onReprint}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-surface-container-low border border-outline-variant/60 text-on-surface hover:bg-surface-container-high disabled:opacity-40 transition-all cursor-pointer"
              >
                <Printer size={20} className="mb-1 text-primary" />
                <span className="text-[11px] font-semibold">Cetak Struk</span>
              </button>

              {onToggleCalculator && (
                <button
                  onClick={() => { onToggleCalculator(); setShowMenu(false); }}
                  className="flex flex-col items-center justify-center p-3 rounded-xl bg-surface-container-low border border-outline-variant/60 text-on-surface hover:bg-surface-container-high transition-all cursor-pointer"
                >
                  <Calculator size={20} className="mb-1 text-secondary" />
                  <span className="text-[11px] font-semibold">Kalkulator</span>
                </button>
              )}

              {onToggleShortcuts && (
                <button
                  onClick={() => { onToggleShortcuts(); setShowMenu(false); }}
                  className="flex flex-col items-center justify-center p-3 rounded-xl bg-surface-container-low border border-outline-variant/60 text-on-surface hover:bg-surface-container-high transition-all cursor-pointer"
                >
                  <Keyboard size={20} className="mb-1 text-tertiary" />
                  <span className="text-[11px] font-semibold">Shortcuts</span>
                </button>
              )}

              <button
                onClick={() => { onToggleTheme(); setShowMenu(false); }}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-surface-container-low border border-outline-variant/60 text-on-surface hover:bg-surface-container-high transition-all cursor-pointer"
              >
                {theme === 'dark' ? <Sun size={20} className="mb-1 text-amber-400" /> : <Moon size={20} className="mb-1 text-indigo-400" />}
                <span className="text-[11px] font-semibold">{theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}</span>
              </button>

              <button
                onClick={() => window.location.reload()}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-surface-container-low border border-outline-variant/60 text-on-surface hover:bg-surface-container-high transition-all cursor-pointer"
              >
                <RefreshCw size={20} className="mb-1 text-on-surface-variant" />
                <span className="text-[11px] font-semibold">Refresh</span>
              </button>

              {activeSession && onCloseSession && (
                <button
                  onClick={() => { onCloseSession(); setShowMenu(false); }}
                  className="flex flex-col items-center justify-center p-3 rounded-xl bg-error-container/20 border border-error/30 text-error hover:bg-error-container/40 transition-all cursor-pointer"
                >
                  <LogOut size={20} className="mb-1 text-error" />
                  <span className="text-[11px] font-semibold">Tutup Shift</span>
                </button>
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-outline-variant/50 flex justify-between items-center">
              <span className="text-[11px] text-on-surface-variant font-medium">Sesi: <strong className="text-on-surface">{userRole || 'Cashier'}</strong></span>
              <button
                onClick={onLogout}
                className="px-3 py-1.5 rounded-lg bg-error-container text-on-error-container text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut size={14} />
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fixed Bottom Navigation Bar (<640px / sm:hidden) */}
      <nav
        id="mobile-bottom-nav"
        aria-label="Mobile Navigation"
        className="fixed bottom-0 inset-x-0 h-16 bg-surface-container/95 backdrop-blur-md border-t border-outline-variant flex items-center justify-around z-40 sm:hidden px-2 shadow-lg"
      >
        {/* Mode Kasir / Warung */}
        <button
          onClick={() => onModeChange('warung')}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all cursor-pointer ${
            mode === 'warung'
              ? 'text-primary font-bold bg-primary-container/30'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Store size={20} className={mode === 'warung' ? 'scale-110 transition-transform' : ''} />
          <span className="text-[10px] mt-0.5">Kasir</span>
        </button>

        {/* Mode Agent */}
        <button
          onClick={() => onModeChange('agent')}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all cursor-pointer ${
            mode === 'agent'
              ? 'text-primary font-bold bg-primary-container/30'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Wallet size={20} className={mode === 'agent' ? 'scale-110 transition-transform' : ''} />
          <span className="text-[10px] mt-0.5">Agent</span>
        </button>

        {/* Mode Admin (Owner Only) */}
        {userRole === 'owner' && (
          <button
            onClick={() => onModeChange('admin')}
            className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all cursor-pointer ${
              mode === 'admin'
                ? 'text-primary font-bold bg-primary-container/30'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Shield size={20} className={mode === 'admin' ? 'scale-110 transition-transform' : ''} />
            <span className="text-[10px] mt-0.5">Admin</span>
          </button>
        )}

        {/* Velo AI (Owner Only) */}
        {userRole === 'owner' && onToggleAi && (
          <button
            onClick={onToggleAi}
            className="flex flex-col items-center justify-center flex-1 py-1 rounded-xl text-on-surface-variant hover:text-primary transition-all cursor-pointer"
          >
            <Sparkles size={20} className="text-secondary animate-pulse" />
            <span className="text-[10px] mt-0.5">Velo AI</span>
          </button>
        )}

        {/* More Operations Menu */}
        <button
          onClick={() => setShowMenu(prev => !prev)}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all cursor-pointer ${
            showMenu ? 'text-primary bg-primary-container/30 font-bold' : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Menu size={20} />
          <span className="text-[10px] mt-0.5">Menu</span>
        </button>
      </nav>
    </>
  );
}
