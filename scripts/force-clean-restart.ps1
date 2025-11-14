# 完全クリーン再起動スクリプト
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "完全クリーン再起動" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/6] Node.jsプロセスを停止中..." -ForegroundColor Yellow
taskkill /F /IM node.exe 2>$null
Start-Sleep -Seconds 2

Write-Host "[2/6] .nextキャッシュを削除中..." -ForegroundColor Yellow
if (Test-Path .next) {
    Remove-Item -Recurse -Force .next
    Write-Host "  ✓ .next削除完了" -ForegroundColor Green
}

Write-Host "[3/6] Prismaキャッシュを削除中..." -ForegroundColor Yellow
if (Test-Path node_modules\.prisma) {
    Remove-Item -Recurse -Force node_modules\.prisma
    Write-Host "  ✓ node_modules\.prisma削除完了" -ForegroundColor Green
}

Write-Host "[4/6] Prisma Clientを再生成中..." -ForegroundColor Yellow
npx prisma generate
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Prisma Client生成完了" -ForegroundColor Green
} else {
    Write-Host "  ✗ Prisma Client生成失敗" -ForegroundColor Red
    exit 1
}

Write-Host "[5/6] Next.jsをビルド中..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ ビルド完了" -ForegroundColor Green
} else {
    Write-Host "  ✗ ビルド失敗" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "[6/6] 完了！以下のコマンドでサーバーを起動:" -ForegroundColor Green
Write-Host "  npm run dev" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan

