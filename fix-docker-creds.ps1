# Script untuk memperbaiki masalah Docker credential helper
Write-Host "🔧 Memperbaiki Docker credential configuration..." -ForegroundColor Cyan

$dockerConfigPath = "$env:USERPROFILE\.docker\config.json"

if (Test-Path $dockerConfigPath) {
    Write-Host "  ✓ Backup config.json asli..." -ForegroundColor Yellow
    Copy-Item $dockerConfigPath "$dockerConfigPath.backup"
    
    # Baca config JSON
    $config = Get-Content $dockerConfigPath -Raw | ConvertFrom-Json
    
    # Hapus credsStore yang bermasalah, ganti dengan credStore kosong
    if ($config.PSObject.Properties['credsStore']) {
        Write-Host "  ✓ Menonaktifkan credsStore: desktop" -ForegroundColor Green
        $config.PSObject.Properties.Remove('credsStore')
    }
    
    # Simpan kembali
    $config | ConvertTo-Json -Depth 10 | Set-Content $dockerConfigPath
    
    Write-Host "✅ Docker config diperbaiki!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Sekarang jalankan: docker compose build --no-cache" -ForegroundColor Cyan
} else {
    Write-Host "❌ File config.json tidak ditemukan!" -ForegroundColor Red
}
