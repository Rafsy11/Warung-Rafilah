---
name: Warung Rafilah POS Design System
description: Sleek, high-contrast dark-theme system for efficient retail and digital sales.
colors:
  primary: "#3b82f6"
  secondary: "#818cf8"
  neutral-bg: "#090d16"
  surface: "#111827"
  outline: "#334155"
  error: "#f87171"
typography:
  display:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.2
  title-xl:
    fontSize: "1.5rem"
  title-lg:
    fontSize: "1.25rem"
  title-md:
    fontSize: "1.125rem"
  title-sm:
    fontSize: "1rem"
  body:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontSize: "0.8125rem"
  label:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "0.75rem"
    fontWeight: 600
  label-sm:
    fontSize: "11px"
  caption:
    fontSize: "10px"
  micro:
    fontSize: "9px"
  fonts:
    - Outfit
    - JetBrains Mono
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  2xl: "24px"
  full: "9999px"
spacing:
  base: "4px"
  gutter: "16px"
  margin-edge: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.xl}"
    padding: "10px 16px"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "#ffffff"
    rounded: "{rounded.xl}"
    padding: "10px 16px"
---

# Design System: Warung Rafilah POS

## 1. Overview

**Creative North Star: "Midnight Ritel Studio (Blue Edition)"**

Midnight Ritel Studio memadukan nuansa malam yang tenang dengan fungsionalitas tinggi. Mengandalkan basis warna gelap slate/charcoal gelap yang dipadukan dengan aksen warna biru obsidian, indigo, dan cyan cerah, sistem ini dirancang untuk mengurangi ketegangan mata kasir selama shift kerja yang panjang. Desain ini secara sadar menolak gaya visual generic buatan AI seperti gradasi teks mencolok atau warna latar cream/beige hangat.

**Key Characteristics:**
- **High-Performance Dark Mode**: Menggunakan warna charcoal dingin yang meredam radiasi cahaya layar komputer kasir.
- **Biru/Cyan Accents**: Fokus informasi penting diarahkan secara tegas menggunakan warna biru cerah (kontras tinggi).
- **Keyboard-First Affordances**: Jarak antar-elemen (spacing) yang pas dan indikator fokus yang sangat jelas untuk membantu navigasi hotkey keyboard.

## 2. Colors

Aplikasi POS ini menggunakan skema warna gelap dengan aksen biru yang tajam untuk menjamin keterbacaan tingkat tinggi di bawah pencahayaan semi-open (cahaya matahari siang dan lampu malam).

### Primary
- **Vibrant Blue** (#3b82f6): Digunakan untuk tombol tindakan utama, badge status sukses/aktif, dan penyorotan kursor fokus.

### Secondary
- **Indigo Accent** (#818cf8): Digunakan untuk tindakan sekunder, penanda produk digital, dan tombol penyesuaian filter.

### Neutral
- **Midnight Obsidian** (#090d16): Warna latar belakang dasar aplikasi.
- **Deep Slate Surface** (#111827): Warna kartu kontainer, baris tabel, dan panel kontrol.
- **Slate Outline** (#334155): Warna garis pembatas elemen untuk ketegasan struktur tanpa menambah kontras berlebih.

**The Contrast Rule.** Warna teks utama wajib memiliki rasio kontras minimal 4.5:1 terhadap latar belakang gelap untuk meminimalkan pantulan cahaya luar (glare) saat siang hari di warung.

## 3. Typography

Tipografi dalam POS ini menggabungkan kejelasan baca font sans-serif modern dengan presisi monospace untuk angka nominal.

**Display Font:** JetBrains Mono (dengan fallback monospace)
**Body Font:** Outfit (dengan fallback system-ui, sans-serif)

### Hierarchy
- **Display** (Bold, 1.25rem, 1.2): Digunakan untuk angka total harga kasir besar, kalkulator, dan judul utama halaman.
- **Headline** (SemiBold, 1.1rem, 1.3): Judul kolom panel dan modal.
- **Body** (Regular, 0.875rem, 1.5): Deskripsi nama produk dan informasi transaksional teks biasa.
- **Label** (SemiBold, 0.75rem, 1.1): Kode barcode, status badge, dan label tombol hotkey.

**The Price Monospace Rule.** Semua angka harga, nominal tunai, kembalian, dan stok wajib menggunakan font JetBrains Mono untuk keterbacaan digit angka yang sejajar.

## 4. Elevation

Sistem visual Midnight Ritel Studio menolak penggunaan drop shadow hitam tebal di atas permukaan gelap karena merusak kemurnian warna hitam latar belakang.

Sebagai gantinya, kedalaman dimensi visual (z-index) diatur sepenuhnya menggunakan **Tonal Layering**:
- **Level 0 (Latar Belakang)**: Midnight Obsidian (#090d16) - Gelap pekat.
- **Level 1 (Kartu/Panel)**: Deep Slate Surface (#111827) - Slate gelap.
- **Level 2 (Dropdown/Dialog)**: Slate Bright (#1e293b) - Slate sedang.
