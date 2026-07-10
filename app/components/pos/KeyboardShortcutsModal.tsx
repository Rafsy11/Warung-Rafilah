"use client";

import React from 'react';
import { X, Keyboard, ArrowRight, Monitor, ShoppingBag, CreditCard, Wrench } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  if (!isOpen) return null;

  const shortcutGroups = [
    {
      title: 'Navigasi Utama',
      icon: <Monitor className="w-5 h-5 text-sky-400" />,
      items: [
        { key: 'F1', desc: 'Pindah ke Mode WARUNG (POS Penjualan)' },
        { key: 'F2', desc: 'Pindah ke Mode AGENT (Layanan Digital)' },
        { key: 'F3', desc: 'Pindah ke Mode ADMIN (Manajemen Data) *Owner Only*' },
      ]
    },
    {
      title: 'Transaksi POS (Warung)',
      icon: <ShoppingBag className="w-5 h-5 text-emerald-400" />,
      items: [
        { key: 'F7', desc: 'Fokus ke Input Cari & Scan Produk' },
        { key: 'F9', desc: 'Pindah ke Panel Pembayaran / Selesaikan Transaksi' },
        { key: 'F10', desc: 'Cetak Ulang (Reprint) Struk Terakhir' },
        { key: 'Esc', desc: 'Kosongkan Keranjang / Tutup Dialog Aktif' },
      ]
    },
    {
      title: 'Pilihan Pembayaran',
      icon: <CreditCard className="w-5 h-5 text-amber-400" />,
      items: [
        { key: 'Alt + 1', desc: 'Pilih Pembayaran Tunai (CASH)' },
        { key: 'Alt + 2', desc: 'Pilih Pembayaran QRIS' },
        { key: 'Alt + 3', desc: 'Pilih Pembayaran Campuran (SPLIT)' },
        { key: 'Alt + 4', desc: 'Pilih Pembayaran Hutang / Kasbon (DEBT)' },
      ]
    },
    {
      title: 'Alat Bantu & Informasi',
      icon: <Wrench className="w-5 h-5 text-purple-400" />,
      items: [
        { key: 'F4', desc: 'Tampilkan / Tutup Detail Status Kas & Laci' },
        { key: 'F6', desc: 'Buka / Tutup Asisten AI (Velo) *Owner Only*' },
        { key: 'F8', desc: 'Tampilkan / Tutup Panduan Shortcut Keyboard ini' },
      ]
    }
  ];

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-gradient-to-b from-surface-container to-surface-container-high border border-outline-variant/60 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="relative px-6 py-5 border-b border-outline-variant/50 flex items-center justify-between bg-surface-container-highest/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-wide text-on-surface">PANDUAN SHORTCUT KEYBOARD</h2>
              <p className="text-xs text-on-surface-variant/80 font-medium">Gunakan tombol shortcut untuk mempercepat pengoperasian mesin POS</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-surface-container-highest rounded-full text-on-surface-variant hover:text-on-surface transition-all duration-150 active:scale-90 cursor-pointer"
            title="Tutup [Esc]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto">
          {shortcutGroups.map((group, gIdx) => (
            <div 
              key={gIdx} 
              className="bg-surface-container-lowest/40 border border-outline-variant/20 rounded-2xl p-4 flex flex-col gap-3.5 hover:border-outline-variant/60 hover:bg-surface-container-lowest/80 transition-all duration-200 shadow-sm"
            >
              <div className="flex items-center gap-2 border-b border-outline-variant/25 pb-2.5">
                {group.icon}
                <h3 className="font-bold text-sm tracking-wide text-on-surface/90 uppercase">{group.title}</h3>
              </div>
              <div className="flex flex-col gap-2.5">
                {group.items.map((item, iIdx) => (
                  <div key={iIdx} className="flex justify-between items-center gap-4 text-xs">
                    <span className="text-on-surface-variant font-medium leading-relaxed">{item.desc}</span>
                    <kbd className="px-2.5 py-1 bg-surface-container-highest border border-outline-variant rounded-lg font-mono font-bold text-primary shadow-sm tracking-wide shrink-0">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-surface-container-highest/30 border-t border-outline-variant/50 flex justify-between items-center text-xs text-on-surface-variant font-medium">
          <span>* Shortcut dinonaktifkan sementara ketika Anda sedang mengetik di form input / teks.</span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-secondary text-on-secondary hover:bg-secondary/90 font-bold rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer"
          >
            Mengerti
          </button>
        </div>
      </div>
    </div>
  );
}
