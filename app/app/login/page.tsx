"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router   = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [username, setUsername]   = useState('');
  const [password, setPassword]   = useState('');
  const [showPwd, setShowPwd]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [shake, setShake]         = useState(false);

  // Auto-focus username on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (loading) return;
      setError('');
      setLoading(true);

      try {
        const res = await fetch('/api/auth/login', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ username: username.trim(), pin: password }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error?.message || 'Login gagal.');
          triggerShake();
          return;
        }

        // Successful login — redirect to POS
        router.push('/');
        router.refresh();
      } catch {
        setError('Koneksi bermasalah. Periksa server.');
        triggerShake();
      } finally {
        setLoading(false);
      }
    },
    [username, password, loading, router, triggerShake]
  );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center overflow-hidden relative">
      {/* Ambient glow blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-secondary/10 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-primary/10 blur-[120px]" />
      </div>

      {/* Login card */}
      <div
        className={`relative z-10 w-full max-w-sm mx-4 transition-all ${
          shake ? 'animate-[shake_0.5s_ease-in-out]' : ''
        }`}
      >
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white border border-outline-variant mb-4 shadow-lg p-2 overflow-hidden">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="font-headline-md text-headline-md text-secondary font-bold tracking-tight">
            WARUNG RAFILAH
          </h1>
          <p className="text-on-surface-variant font-body-md text-body-md mt-1">
            Masuk untuk melanjutkan
          </p>
        </div>

        {/* Form card */}
        <div className="bg-surface-container rounded-2xl border border-outline-variant p-8 shadow-xl shadow-black/30">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Username */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="username"
                className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider"
              >
                Username
              </label>
              <input
                id="username"
                ref={inputRef}
                type="text"
                autoComplete="username"
                value={username}
                onChange={e => { setUsername(e.target.value); setError(''); }}
                className="bg-surface-dim border border-outline-variant rounded-lg px-4 py-3 text-on-surface font-body-md text-body-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors placeholder:text-on-surface-variant/40"
                placeholder="admin"
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  className="w-full bg-surface-dim border border-outline-variant rounded-lg px-4 py-3 pr-12 text-on-surface font-body-md text-body-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors placeholder:text-on-surface-variant/40"
                  placeholder="••••••••••"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-secondary transition-colors p-1"
                  aria-label={showPwd ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2 bg-error-container text-on-error-container rounded-lg px-4 py-3 font-body-md text-body-md">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !username.trim() || !password}
              className="mt-1 bg-secondary-container hover:bg-secondary-container/80 text-on-secondary-container font-label-lg text-label-lg rounded-lg py-3.5 flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md shadow-secondary/20 disabled:opacity-50 disabled:cursor-not-allowed border border-secondary/30"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Memverifikasi...
                </>
              ) : (
                'MASUK'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-on-surface-variant font-label-sm text-label-sm mt-6 opacity-60">
          Warung POS v2.4.0 · Sistem Lokal
        </p>
      </div>

      {/* Shake keyframe via inline style tag */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-8px); }
          40%       { transform: translateX(8px); }
          60%       { transform: translateX(-6px); }
          80%       { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
