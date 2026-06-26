# fix_loading.ps1
# Jalankan dari ROOT project (folder yang ada folder "app").
# Fungsi: hapus app\loading.tsx yang nyasar (bikin spinner full-screen
# nongol di landing/login), sambil mempertahankan app\(app)\loading.tsx.

$stray = "app\loading.tsx"
$correct = "app\(app)\loading.tsx"

Write-Host "== Fix loading Closari ==" -ForegroundColor Cyan

if (-not (Test-Path "app")) {
  Write-Host "ERROR: folder 'app' gak ketemu. Jalankan script ini dari root project." -ForegroundColor Red
  exit 1
}

if (Test-Path $stray) {
  Remove-Item $stray -Force
  Write-Host "[OK] Dihapus: $stray" -ForegroundColor Green
} else {
  Write-Host "[SKIP] $stray sudah tidak ada (bagus)." -ForegroundColor Yellow
}

if (Test-Path $correct) {
  Write-Host "[OK] Dipertahankan: $correct" -ForegroundColor Green
} else {
  Write-Host "[WARN] $correct tidak ditemukan. Loading branded di dalam app mungkin hilang." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Sisa file loading.tsx (harusnya cuma satu, di dalam (app)):" -ForegroundColor Cyan
Get-ChildItem -Recurse -Filter loading.tsx app | ForEach-Object { Write-Host "  $($_.FullName)" }

Write-Host ""
Write-Host "Kalau sudah bener, deploy:" -ForegroundColor Cyan
Write-Host '  git add -A'
Write-Host '  git commit -m "Hapus loading root yang nyasar bikin spinner di landing dan login"'
Write-Host '  git push origin main'
