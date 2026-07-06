@echo off
:: Cek status Administrator
openfiles >nul 2>&1
if %errorlevel% neq 0 (
    echo [PENTING] Harap klik kanan file ini lalu pilih "Run as Administrator" / "Jalankan sebagai Administrator"!
    pause
    exit /b
)

cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File .\start-pos.ps1 -Stop
echo.
echo Tekan tombol apa saja untuk keluar...
pause >nul
