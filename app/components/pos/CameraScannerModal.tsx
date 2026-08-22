"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, X, RefreshCw, Zap, CheckCircle2, AlertTriangle, ShieldCheck, Image as ImageIcon } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

type CameraScannerModalProps = {
  onScanSuccess: (barcode: string) => Promise<void> | void;
  onClose: () => void;
};

export default function CameraScannerModal({ onScanSuccess, onClose }: CameraScannerModalProps) {
  const [scannerId] = useState(() => `reader-${Math.random().toString(36).substring(2, 9)}`);
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unknown'>('unknown');
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [scannedFeedback, setScannedFeedback] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  // Check browser camera permission state on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'camera' as any })
        .then((result) => {
          setPermissionState(result.state as any);
          result.onchange = () => {
            setPermissionState(result.state as any);
          };
        })
        .catch(() => setPermissionState('unknown'));
    }
  }, []);

  const playBeepSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // Audio context ignored if blocked
    }
  }, []);

  const handleBarcodeDetected = useCallback(async (decodedText: string) => {
    if (lastScanned === decodedText) return;

    setLastScanned(decodedText);
    setScannedFeedback(decodedText);

    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(80); } catch { /* ignore */ }
    }

    playBeepSound();

    try {
      await onScanSuccess(decodedText);
    } catch (err) {
      console.error('Scan callback error:', err);
    }

    setTimeout(() => {
      setLastScanned(null);
      setScannedFeedback(null);
    }, 1500);
  }, [lastScanned, onScanSuccess, playBeepSound]);

  const stopScanner = useCallback(async () => {
    if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
      try {
        await html5QrcodeRef.current.stop();
        html5QrcodeRef.current.clear();
      } catch (err) {
        console.error('Failed to stop scanner:', err);
      }
    }
    setIsScanning(false);
  }, []);

  const startScanner = useCallback(async () => {
    setErrorMessage(null);

    // Verify HTTPS protocol
    if (typeof window !== 'undefined' && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setErrorMessage(
        `Akses kamera memerlukan koneksi aman HTTPS. Buka melalui domain resmi https://warung-rafilah.my.id.`
      );
      setIsScanning(false);
      return;
    }

    try {
      if (!html5QrcodeRef.current) {
        html5QrcodeRef.current = new Html5Qrcode(scannerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
          verbose: false,
        });
      }

      if (html5QrcodeRef.current.isScanning) {
        try {
          await html5QrcodeRef.current.stop();
        } catch { /* ignore */ }
      }

      // Use flexible constraint with ideal facingMode to prevent OverconstrainedError on multi-lens phones
      await html5QrcodeRef.current.start(
        { facingMode: { ideal: facingMode } },
        {
          fps: 15,
          qrbox: { width: 260, height: 160 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleBarcodeDetected(decodedText);
        },
        () => {
          // ignore frame errors
        }
      );

      setIsScanning(true);
      setPermissionState('granted');
    } catch (err: any) {
      console.error('Camera Scanner error:', err);
      const errMsg = String(err?.message || err?.name || err || '');

      if (errMsg.includes('NotAllowedError') || errMsg.includes('Permission') || errMsg.includes('denied')) {
        setPermissionState('denied');
        setErrorMessage(
          'Izin Kamera terblokir di browser HP Anda. Silakan ikuti petunjuk di bawah atau gunakan fitur Ambil Foto Barcode.'
        );
      } else if (errMsg.includes('OverconstrainedError') || errMsg.includes('NotFoundError')) {
        try {
          await html5QrcodeRef.current?.start(
            { video: true } as any,
            { fps: 15, qrbox: { width: 260, height: 160 } },
            (text) => handleBarcodeDetected(text),
            () => {}
          );
          setIsScanning(true);
          setPermissionState('granted');
          return;
        } catch (fallbackErr) {
          setErrorMessage('Gagal mendeteksi lensa kamera HP. Silakan gunakan tombol Ambil Foto Barcode di bawah.');
        }
      } else {
        setErrorMessage(
          'Gagal mengaktifkan video live kamera. Silakan gunakan opsi Ambil Foto Barcode di bawah.'
        );
      }
      setIsScanning(false);
    }
  }, [scannerId, facingMode, handleBarcodeDetected]);

  useEffect(() => {
    startScanner();
    return () => {
      stopScanner();
    };
  }, [facingMode]);

  // Native Photo File Scan Fallback (Bypasses WebRTC permissions completely!)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (!html5QrcodeRef.current) {
        html5QrcodeRef.current = new Html5Qrcode(scannerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
          verbose: false,
        });
      }

      const decodedText = await html5QrcodeRef.current.scanFile(file, true);
      if (decodedText) {
        handleBarcodeDetected(decodedText);
      }
    } catch (err) {
      console.warn('File barcode scan error:', err);
      setErrorMessage('Barcode tidak terdeteksi pada gambar foto. Pastikan gambar cukup terang & jelas.');
    }
  };

  const handleToggleTorch = async () => {
    if (!html5QrcodeRef.current || !isScanning) return;
    try {
      const nextTorch = !torchOn;
      await html5QrcodeRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch } as any]
      });
      setTorchOn(nextTorch);
    } catch {
      // Flashlight not supported
    }
  };

  const handleFlipCamera = () => {
    stopScanner().then(() => {
      setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
    });
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex flex-col items-center justify-between p-4 animate-in fade-in duration-200">
      {/* Hidden File Input for Native Camera Snapshot Fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Header & Status Inspector */}
      <header className="w-full max-w-md flex flex-col gap-2 py-2 text-white shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera size={22} className="text-primary animate-pulse" />
            <h3 className="font-bold text-base tracking-wide">Scan Barcode HP</h3>
          </div>
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors cursor-pointer"
          >
            <X size={22} />
          </button>
        </div>

        {/* Live Permission & HTTPS Inspector Badge */}
        <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-[11px] font-mono">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <ShieldCheck size={14} />
            <span>HTTPS SSL Active</span>
          </span>
          <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
            permissionState === 'granted' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
            permissionState === 'denied' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
            'bg-amber-500/20 text-amber-300 border border-amber-500/30'
          }`}>
            Izin: {permissionState}
          </span>
        </div>
      </header>

      {/* Camera Viewfinder Box */}
      <div className="relative w-full max-w-md flex-1 max-h-[420px] flex items-center justify-center rounded-3xl overflow-hidden border-2 border-primary/40 bg-black shadow-2xl my-auto">
        <div id={scannerId} className="w-full h-full object-cover"></div>

        {/* Viewfinder Target Border Overlay */}
        {isScanning && (
            <div className="w-[260px] h-[160px] border-2 border-primary/80 rounded-2xl relative shadow-[0_0_20px_rgba(0,0,0,0.8)] overflow-hidden">
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_10px_#ef4444] animate-pulse absolute top-1/2 -translate-y-1/2"></div>
            </div>
        )}

        {/* Initial User Touch Activation Overlay */}
        {!isScanning && !errorMessage && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center gap-3 z-20">
            <div className="p-3 bg-primary/20 text-primary rounded-full animate-pulse">
              <Camera size={32} />
            </div>
            <p className="text-xs font-semibold text-white/90">Tekan untuk meminta izin & menyalakan kamera HP</p>
            <button
              onClick={async () => {
                try {
                  const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
                  s.getTracks().forEach(t => t.stop());
                  setPermissionState('granted');
                } catch (e: any) {
                  console.warn('Touch prompt result:', e);
                  if (e?.name === 'NotAllowedError') setPermissionState('denied');
                }
                setTimeout(() => startScanner(), 100);
              }}
              className="bg-primary text-on-primary font-bold text-xs px-5 py-3 rounded-xl shadow-xl flex items-center justify-center gap-2 cursor-pointer hover:opacity-90 active:scale-95 transition-all mt-1"
            >
              <Camera size={18} />
              <span>Minta Izin / Buka Kamera</span>
            </button>
          </div>
        )}

        {/* Feedback Alert Pill when detected */}
        {scannedFeedback && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-white font-mono font-bold text-xs px-4 py-2 rounded-full shadow-2xl flex items-center gap-1.5 animate-in zoom-in-95 duration-150 z-20">
            <CheckCircle2 size={16} />
            <span>Terdeteksi: {scannedFeedback}</span>
          </div>
        )}

        {/* Error State & Unblock Instructions */}
        {errorMessage && (
          <div className="absolute inset-0 bg-surface-container flex flex-col items-center justify-center p-6 text-center gap-3 z-30 overflow-y-auto">
            <div className="p-3 bg-error/10 text-error rounded-full mb-1">
              <AlertTriangle size={28} />
            </div>
            <p className="text-xs font-semibold text-on-surface leading-relaxed max-w-xs">{errorMessage}</p>

            <div className="flex flex-col gap-2 w-full max-w-xs mt-1">
              {/* Guaranteed Native Camera Photo Snap Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-3 rounded-xl shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
              >
                <Camera size={18} />
                <span>📸 Ambil Foto Barcode (Sistem HP)</span>
              </button>

              {permissionState === 'denied' && (
                <div className="bg-amber-950/50 border border-amber-500/30 rounded-xl p-3 text-[11px] text-amber-200 text-left leading-relaxed my-1">
                  <p className="font-bold text-amber-400 mb-1">💡 Petunjuk Buka Izin Terkunci:</p>
                  <ol className="list-decimal list-inside space-y-1 opacity-90">
                    <li>Tekan ikon <strong>Gembok 🔒</strong> di URL web</li>
                    <li>Pilih <strong>Izin / Site Settings</strong></li>
                    <li>Ubah <strong>Kamera</strong> ke <strong>Izinkan (Allow)</strong></li>
                  </ol>
                </div>
              )}

              <button
                onClick={async () => {
                  setErrorMessage(null);
                  try {
                    const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
                    s.getTracks().forEach(t => t.stop());
                    setPermissionState('granted');
                  } catch (e: any) {
                    console.warn('Retry touch prompt result:', e);
                    if (e?.name === 'NotAllowedError') setPermissionState('denied');
                  }
                  setTimeout(() => startScanner(), 100);
                }}
                className="bg-surface-container-highest text-on-surface font-bold text-xs px-4 py-2.5 rounded-xl border border-outline-variant/60 flex items-center justify-center gap-2 cursor-pointer hover:bg-surface-container-high active:scale-95 transition-all"
              >
                <RefreshCw size={16} />
                <span>Coba Lagi Video Stream</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <footer className="w-full max-w-md flex flex-col items-center gap-3 shrink-0 py-2">
        <p className="text-xs text-white/80 font-medium text-center">
          Arahkan kamera ke barcode ATAU gunakan tombol Ambil Foto
        </p>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl flex items-center gap-2 text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-lg"
          >
            <Camera size={18} />
            <span>Foto Barcode</span>
          </button>

          <button
            onClick={handleFlipCamera}
            className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl flex items-center gap-2 text-xs font-semibold cursor-pointer transition-all active:scale-95"
            title="Ganti Kamera Front/Rear"
          >
            <RefreshCw size={18} />
            <span>Flip</span>
          </button>

          <button
            onClick={handleToggleTorch}
            className={`p-3 rounded-2xl flex items-center gap-2 text-xs font-semibold cursor-pointer transition-all active:scale-95 ${
              torchOn ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/30' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
            title="Senter Flashlight"
          >
            <Zap size={18} />
            <span>{torchOn ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
