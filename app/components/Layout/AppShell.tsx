import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Store, Printer, BarChart3, Sun, Moon, LogOut, Sparkles, Keyboard, Calculator } from 'lucide-react';
import { useRouter } from 'next/navigation';

type AppShellProps = {
  children: React.ReactNode;
  mode: 'warung' | 'agent' | 'admin';
  onModeChange: (mode: 'warung' | 'agent' | 'admin') => void;
  userRole?: string;
  onReprint?: () => void;
  activeSession?: any;
  onCloseSession?: () => void;
  isAiOpen?: boolean;
  onToggleAi?: () => void;
  isShortcutsOpen?: boolean;
  onToggleShortcuts?: () => void;
  isCalculatorOpen?: boolean;
  onToggleCalculator?: () => void;
  onCancel?: () => void;
};

export default function AppShell({ 
  children, 
  mode, 
  onModeChange, 
  userRole, 
  onReprint, 
  activeSession, 
  onCloseSession,
  isAiOpen = false,
  onToggleAi,
  isShortcutsOpen = false,
  onToggleShortcuts,
  isCalculatorOpen = false,
  onToggleCalculator,
  onCancel
}: AppShellProps) {
  const [time, setTime] = useState<string>('');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        router.push('/login');
        router.refresh();
      }
    } catch (err) {
      console.error('Gagal logout:', err);
    }
  }, [router]);

  useEffect(() => {
    if (!showUserDropdown) return;
    const handleClose = () => setShowUserDropdown(false);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, [showUserDropdown]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTimeout(() => {
        setTheme(savedTheme);
        if (savedTheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }, 0);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeString = now.toLocaleTimeString('en-US', { hour12: false });
      const dateOptions: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
      const dateString = now.toLocaleDateString('en-GB', dateOptions);
      setTime(`${timeString} | ${dateString}`);
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div id="pos-main-layout" role="application" className="bg-background text-on-background h-screen w-screen overflow-hidden flex flex-col font-body-md select-none">
      {/* Top Navigation Header */}
      <header id="pos-header" role="banner" className="bg-surface-container flex justify-between items-center w-full px-5 h-16 border-b border-outline-variant shrink-0 z-50 transition-colors duration-150">
        <div className="flex items-center gap-6">
          {/* Brand Identity */}
          <div id="brand-identity" className="flex items-center gap-3">
            <figure className="w-10 h-10 min-w-0 min-h-0 bg-surface-container-low border border-outline-variant/60 rounded-xl flex items-center justify-center p-0.5 overflow-hidden shrink-0 shadow-sm">
              <img src="/logo.png" alt="Logo Warung Rafilah" className="w-full h-full object-cover rounded-[10px]" />
            </figure>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 id="brand-title" className="text-sm font-bold tracking-tight text-on-surface leading-none">
                  WARUNG RAFILAH
                </h1>
                <span id="system-online-badge" className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-none ${
                  isOnline ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full mr-1 ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <span className="text-[10px] text-on-surface-variant font-medium tracking-wide uppercase mt-0.5">POS System</span>
            </div>
          </div>

          <div className="h-6 w-px bg-outline-variant/60"></div>

          {/* Mode Switcher Tabs */}
          <nav id="pos-mode-navigation" aria-label="Mode Aplikasi Kasir" className="flex bg-surface-container-low border border-outline-variant rounded-lg p-0.5 gap-0.5">
            <button 
              id="btn-mode-warung"
              onClick={() => onModeChange('warung')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-2 text-xs font-semibold transition-all cursor-pointer ${
                mode === 'warung' 
                  ? 'bg-primary text-white shadow-sm' 
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <kbd className={`px-1 py-0.2 text-[9px] font-mono rounded ${mode === 'warung' ? 'bg-white/20 text-white' : 'bg-surface-container-highest text-on-surface-variant'}`}>F1</kbd>
              Warung
            </button>
            <button 
              id="btn-mode-agent"
              onClick={() => onModeChange('agent')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-2 text-xs font-semibold transition-all cursor-pointer ${
                mode === 'agent' 
                  ? 'bg-primary text-white shadow-sm' 
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <kbd className={`px-1 py-0.2 text-[9px] font-mono rounded ${mode === 'agent' ? 'bg-white/20 text-white' : 'bg-surface-container-highest text-on-surface-variant'}`}>F2</kbd>
              Agent
            </button>
            {userRole === 'owner' && (
              <button 
                id="btn-mode-admin"
                onClick={() => onModeChange('admin')}
                className={`px-3 py-1.5 rounded-md flex items-center gap-2 text-xs font-semibold transition-all cursor-pointer ${
                  mode === 'admin' 
                    ? 'bg-primary text-white shadow-sm' 
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                }`}
              >
                <kbd className={`px-1 py-0.2 text-[9px] font-mono rounded ${mode === 'admin' ? 'bg-white/20 text-white' : 'bg-surface-container-highest text-on-surface-variant'}`}>F3</kbd>
                Admin
              </button>
            )}
          </nav>
        </div>

        {/* Right Section Tools */}
        <div id="header-tools-actions" className="flex items-center gap-3">
          <time id="pos-header-clock" className="font-mono text-on-surface-variant text-xs font-medium bg-surface-container-low px-2.5 py-1.2 rounded-md border border-outline-variant/40">
            {time}
          </time>
          
          <div className="h-5 w-px bg-outline-variant/60"></div>
 
          <div id="header-utility-buttons" className="flex items-center gap-1 text-on-surface-variant">
            <button
              id="btn-toggle-theme"
              onClick={toggleTheme}
              className="p-1.5 hover:bg-surface-container-high rounded-md hover:text-on-surface transition-colors cursor-pointer"
              title={theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
              aria-label="Ganti Tema Warna"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              id="btn-refresh-app"
              onClick={() => window.location.reload()}
              className="p-1.5 hover:bg-surface-container-high rounded-md hover:text-on-surface transition-colors cursor-pointer"
              title="Refresh"
              aria-label="Refresh Halaman"
            >
              <RefreshCw size={16} />
            </button>
            <button
              id="btn-reprint-receipt"
              onClick={onReprint}
              disabled={!onReprint}
              className="p-1.5 hover:bg-surface-container-high rounded-md hover:text-on-surface transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              title="Print Struk [F10]"
              aria-label="Print Struk Transaksi Terakhir"
            >
              <Printer size={16} />
            </button>
            {userRole === 'owner' && (
              <button
                id="btn-daily-reports"
                onClick={() => router.push('/pos/reports')}
                className="p-1.5 hover:bg-surface-container-high rounded-md hover:text-on-surface transition-colors cursor-pointer"
                title="Laporan Harian"
                aria-label="Buka Laporan Harian"
              >
                <BarChart3 size={16} />
              </button>
            )}
            {onToggleShortcuts && (
              <button
                id="btn-toggle-shortcuts"
                onClick={onToggleShortcuts}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  isShortcutsOpen ? 'bg-primary text-white' : 'hover:bg-surface-container-high hover:text-on-surface'
                }`}
                title="Shortcuts [F8]"
                aria-label="Daftar Pintasan Keyboard"
              >
                <Keyboard size={16} />
              </button>
            )}
            {onToggleCalculator && (
              <button
                id="btn-toggle-calculator"
                onClick={onToggleCalculator}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  isCalculatorOpen ? 'bg-primary text-white' : 'hover:bg-surface-container-high hover:text-on-surface'
                }`}
                title="Kalkulator [Alt + C]"
                aria-label="Buka Kalkulator Kasir"
              >
                <Calculator size={16} />
              </button>
            )}
            {userRole === 'owner' && onToggleAi && (
              <button
                id="btn-toggle-ai"
                onClick={onToggleAi}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  isAiOpen ? 'bg-primary text-white' : 'hover:bg-surface-container-high hover:text-on-surface'
                }`}
                title="Asisten AI (Velo)"
                aria-label="Buka Asisten AI Velo"
              >
                <Sparkles size={16} />
              </button>
            )}
          </div>
          
          {activeSession && onCloseSession && (
            <>
              <div className="h-5 w-px bg-outline-variant/60"></div>
              <button
                id="btn-close-shift"
                onClick={onCloseSession}
                className="px-3 py-1.5 bg-error/10 hover:bg-error/20 text-error text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Tutup Shift"
              >
                <LogOut size={14} />
                Tutup Shift
              </button>
            </>
          )}
          
          <div className="h-5 w-px bg-outline-variant/60"></div>
          
          <div id="user-profile-menu" className="relative">
            <button
              id="btn-user-dropdown-toggle"
              onClick={(e) => { e.stopPropagation(); setShowUserDropdown(prev => !prev); }}
              className="flex items-center gap-2 bg-surface-container-low border border-outline-variant rounded-full pl-1.5 pr-3 py-1 hover:border-outline transition-colors cursor-pointer"
              aria-haspopup="menu"
              aria-expanded={showUserDropdown}
            >
              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">
                {userRole === 'owner' ? 'OW' : 'CA'}
              </div>
              <span className="font-semibold text-xs text-on-surface capitalize">{userRole || 'Cashier'}</span>
            </button>
            
            {showUserDropdown && (
              <div id="user-dropdown-menu" role="menu" className="absolute right-0 mt-2 w-48 bg-surface-container border border-outline-variant rounded-xl shadow-xl py-1.5 z-50 animate-in fade-in-50 slide-in-from-top-2 duration-150">
                <button
                  id="btn-logout"
                  role="menuitem"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-error-container hover:text-on-error-container text-on-surface-variant font-label-md text-label-md transition-colors"
                >
                  <LogOut size={14} />
                  <span>Keluar (Logout)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main id="pos-main-content" role="main" className="flex-1 flex overflow-hidden p-3.5 gap-3.5 h-full">
        {children}
      </main>

      {/* Footer Hotkey Status Bar */}
      <footer id="pos-footer" role="contentinfo" aria-label="Status Pintasan Keyboard" className="bg-surface-container-lowest border-t border-outline-variant h-10 shrink-0 flex items-center justify-between px-margin-edge z-50">
        <nav id="footer-shortcut-list" aria-label="Pintasan Tombol Cepat" className="flex items-center gap-6 text-on-surface-variant text-xs font-medium">
          <button id="btn-footer-f1" onClick={() => onModeChange('warung')} className="hover:text-primary transition-colors flex items-center gap-1.5 cursor-pointer">
            <kbd className="bg-surface-container-highest border border-outline-variant px-1.5 py-0.5 rounded-md font-mono font-bold text-on-surface text-[11px]">F1</kbd> Warung
          </button>
          <button id="btn-footer-f2" onClick={() => onModeChange('agent')} className="hover:text-primary transition-colors flex items-center gap-1.5 cursor-pointer">
            <kbd className="bg-surface-container-highest border border-outline-variant px-1.5 py-0.5 rounded-md font-mono font-bold text-on-surface text-[11px]">F2</kbd> Agent
          </button>
          {userRole === 'owner' ? (
            <button id="btn-footer-f3" onClick={() => onModeChange('admin')} className="hover:text-primary transition-colors flex items-center gap-1.5 cursor-pointer">
              <kbd className="bg-surface-container-highest border border-outline-variant px-1.5 py-0.5 rounded-md font-mono font-bold text-on-surface text-[11px]">F3</kbd> Admin
            </button>
          ) : (
            <button 
              id="btn-footer-f3-discount"
              onClick={() => {
                const discountInput = document.getElementById('input-discount') as HTMLInputElement | null;
                if (discountInput) {
                  discountInput.focus();
                  discountInput.select();
                }
              }}
              className="hover:text-primary transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <kbd className="bg-surface-container-highest border border-outline-variant px-1.5 py-0.5 rounded-md font-mono font-bold text-on-surface text-[11px]">F3</kbd> Discount
            </button>
          )}
          <button
            id="btn-footer-f10"
            onClick={onReprint}
            disabled={!onReprint}
            className="hover:text-primary transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-30"
          >
            <kbd className="bg-surface-container-highest border border-outline-variant px-1.5 py-0.5 rounded-md font-mono font-bold text-on-surface text-[11px]">F10</kbd> Print
          </button>
          <button 
            id="btn-footer-esc"
            onClick={onCancel}
            disabled={!onCancel}
            className="hover:text-primary transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-30"
          >
            <kbd className="bg-surface-container-highest border border-outline-variant px-1.5 py-0.5 rounded-md font-mono font-bold text-on-surface text-[11px]">ESC</kbd> Cancel
          </button>
        </nav>
        <div id="app-version-indicator" className="font-label-sm text-label-sm text-outline">
          v2.4.0-stable
        </div>
      </footer>
    </div>
  );
}
