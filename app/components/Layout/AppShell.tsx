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
  const router = useRouter();

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
    <div className="bg-background text-on-background h-screen w-screen overflow-hidden flex flex-col font-body-md select-none">
      {/* Top Navigation Anchor */}
      <header className="bg-surface-container flex justify-between items-center w-full px-margin-edge h-16 border-b border-outline-variant shrink-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-white border border-outline-variant rounded-xl flex items-center justify-center p-1 overflow-hidden shadow-sm shrink-0">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-sm font-black tracking-wider leading-none bg-gradient-to-r from-secondary to-primary bg-clip-text text-transparent">
                WARUNG RAFILAH
              </h1>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[9px] text-on-surface-variant/65 tracking-widest uppercase font-semibold font-mono leading-none">POS SYSTEM</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50"></span>
              </div>
            </div>
          </div>
          <div className="h-8 w-px bg-outline-variant/50 mx-1"></div>
          <div className="flex bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-1 gap-1 shadow-inner">
            <button 
              onClick={() => onModeChange('warung')}
              className={`font-label-md text-label-md px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all active:scale-[0.97] cursor-pointer ${mode === 'warung' ? 'bg-secondary-container text-on-secondary-container shadow-md border border-secondary/25' : 'text-on-surface-variant hover:bg-surface-container-high/50'}`}
            >
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${mode === 'warung' ? 'bg-black/15 text-on-secondary-container border border-black/10' : 'bg-surface-container-highest/60 text-on-surface-variant/80 border border-outline-variant/20'}`}>F1</span>
              WARUNG
            </button>
            <button 
              onClick={() => onModeChange('agent')}
              className={`font-label-md text-label-md px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all active:scale-[0.97] cursor-pointer ${mode === 'agent' ? 'bg-primary-container text-on-primary-container shadow-md border border-primary/25' : 'text-on-surface-variant hover:bg-surface-container-high/50'}`}
            >
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${mode === 'agent' ? 'bg-black/15 text-on-primary-container border border-black/10' : 'bg-surface-container-highest/60 text-on-surface-variant/80 border border-outline-variant/20'}`}>F2</span>
              AGENT
            </button>
            {userRole === 'owner' && (
              <button 
                onClick={() => onModeChange('admin')}
                className={`font-label-md text-label-md px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all active:scale-[0.97] cursor-pointer ${mode === 'admin' ? 'bg-tertiary-container text-on-tertiary-container shadow-md border border-tertiary/25' : 'text-on-surface-variant hover:bg-surface-container-high/50'}`}
              >
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${mode === 'admin' ? 'bg-black/15 text-on-tertiary-container border border-black/10' : 'bg-surface-container-highest/60 text-on-surface-variant/80 border border-outline-variant/20'}`}>F3</span>
                ADMIN
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="font-mono text-on-surface-variant/85 text-xs font-semibold select-none leading-none">
            {time}
          </div>
          
          <div className="h-5 w-px bg-outline-variant/40"></div>
 
          <div className="flex items-center gap-1 text-on-surface-variant">
            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-surface-container-highest rounded-full hover:text-primary transition-all duration-150 cursor-pointer"
              title={theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button
              onClick={() => window.location.reload()}
              className="p-2 hover:bg-surface-container-highest rounded-full hover:text-primary transition-all duration-150 cursor-pointer"
              title="Refresh"
            >
              <RefreshCw size={15} />
            </button>
            <button
              onClick={onReprint}
              disabled={!onReprint}
              className="p-2 hover:bg-surface-container-highest rounded-full hover:text-primary transition-all duration-150 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              title="Print Struk [F10]"
            >
              <Printer size={15} />
            </button>
            {userRole === 'owner' && (
              <button
                onClick={() => router.push('/pos/reports')}
                className="p-2 hover:bg-surface-container-highest rounded-full hover:text-primary transition-all duration-150 cursor-pointer"
                title="Laporan Harian"
              >
                <BarChart3 size={15} />
              </button>
            )}
            {onToggleShortcuts && (
              <button
                onClick={onToggleShortcuts}
                className={`p-2 rounded-full transition-all duration-150 cursor-pointer relative ${
                  isShortcutsOpen 
                    ? 'bg-secondary text-on-secondary shadow-sm' 
                    : 'hover:bg-surface-container-highest hover:text-primary'
                }`}
                title="Panduan Keyboard Shortcuts [F8]"
              >
                <Keyboard size={15} />
              </button>
            )}
            {onToggleCalculator && (
              <button
                onClick={onToggleCalculator}
                className={`p-2 rounded-full transition-all duration-150 cursor-pointer relative ${
                  isCalculatorOpen 
                    ? 'bg-secondary text-on-secondary shadow-sm' 
                    : 'hover:bg-surface-container-highest hover:text-primary'
                }`}
                title="Kalkulator POS [F5]"
              >
                <Calculator size={15} />
              </button>
            )}
            {userRole === 'owner' && onToggleAi && (
              <button
                onClick={onToggleAi}
                className={`p-2 rounded-full transition-all duration-150 cursor-pointer relative ${
                  isAiOpen 
                    ? 'bg-secondary text-on-secondary shadow-sm' 
                    : 'hover:bg-surface-container-highest hover:text-primary'
                }`}
                title="Asisten AI (Velo)"
              >
                <Sparkles size={15} className={isAiOpen ? 'animate-pulse' : ''} />
              </button>
            )}
          </div>
          
          {activeSession && onCloseSession && (
            <>
              <div className="h-5 w-px bg-outline-variant/40"></div>
              <button
                onClick={onCloseSession}
                className="px-3.5 py-2 bg-error-container hover:bg-error-container/85 text-on-error-container font-label-md text-label-md font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-[0.98] border border-error/25 cursor-pointer"
                title="Tutup Sesi (Rekonsiliasi Kas Laci)"
              >
                <LogOut size={14} />
                TUTUP SHIFT
              </button>
            </>
          )}
          
          <div className="h-5 w-px bg-outline-variant/40"></div>
          
          <div className="relative">
            <div 
              onClick={(e) => { e.stopPropagation(); setShowUserDropdown(prev => !prev); }}
              className="flex items-center gap-2 bg-surface-container-lowest border border-outline-variant/40 rounded-full pl-1.5 pr-3 py-1 hover:border-outline/80 transition-all cursor-pointer shadow-sm"
            >
              <div className="w-6.5 h-6.5 rounded-full bg-primary-container/20 border border-primary/30 text-primary flex items-center justify-center font-bold text-[10px] shadow-inner">
                {userRole === 'owner' ? 'OW' : 'CA'}
              </div>
              <div className="flex flex-col text-left">
                <span className="font-semibold text-xs leading-none text-on-surface capitalize">{userRole || 'Cashier'}</span>
                <span className="text-[8px] leading-none text-on-surface-variant/75 mt-0.5 font-medium font-sans">Online</span>
              </div>
            </div>

            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-surface-container-highest border border-outline-variant rounded-xl shadow-xl py-1.5 z-50">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-left hover:bg-error-container/20 hover:text-error text-on-surface-variant font-label-md text-label-md transition-colors"
                >
                  <LogOut size={14} />
                  <span>Keluar (Logout)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="flex-1 flex overflow-hidden p-gutter gap-gutter h-full">
        {children}
      </main>

      {/* Footer Shortcuts */}
      <footer className="bg-surface-container-lowest border-t border-outline-variant h-10 shrink-0 flex items-center justify-between px-margin-edge z-50">
        <div className="flex gap-unit-6 text-on-surface-variant font-label-sm text-label-sm">
          <button onClick={() => onModeChange('warung')} className="hover:text-primary transition-colors flex items-center gap-1 cursor-pointer">
            <span className="bg-surface-container-highest border border-outline-variant px-1 rounded text-on-surface">F1</span> Warung
          </button>
          <button onClick={() => onModeChange('agent')} className="hover:text-primary transition-colors flex items-center gap-1 cursor-pointer">
            <span className="bg-surface-container-highest border border-outline-variant px-1 rounded text-on-surface">F2</span> Agent
          </button>
          {userRole === 'owner' ? (
            <button onClick={() => onModeChange('admin')} className="hover:text-primary transition-colors flex items-center gap-1 cursor-pointer">
              <span className="bg-surface-container-highest border border-outline-variant px-1 rounded text-on-surface">F3</span> Admin
            </button>
          ) : (
            <button 
              onClick={() => {
                const discountInput = document.getElementById('input-discount') as HTMLInputElement | null;
                if (discountInput) {
                  discountInput.focus();
                  discountInput.select();
                }
              }}
              className="hover:text-primary transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span className="bg-surface-container-highest border border-outline-variant px-1 rounded text-on-surface">F3</span> Discount
            </button>
          )}
          <button
            onClick={onReprint}
            disabled={!onReprint}
            className="hover:text-primary transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-30"
          >
            <span className="bg-surface-container-highest border border-outline-variant px-1 rounded text-on-surface">F10</span> Print
          </button>
          <button 
            onClick={onCancel}
            disabled={!onCancel}
            className="hover:text-primary transition-colors flex items-center gap-1 cursor-pointer ml-4 disabled:opacity-30"
          >
            <span className="bg-surface-container-highest border border-outline-variant px-1 rounded text-on-surface">ESC</span> Cancel
          </button>
        </div>
        <div className="font-label-sm text-label-sm text-outline">
          v2.4.0-stable
        </div>
      </footer>
    </div>
  );
}
