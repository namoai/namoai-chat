# 成人認証フィールド追加マイグレーションスクリプト (PowerShell版)
# IT環境と本番環境の両方に適用

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "成人認証フィールド追加マイグレーション" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$migrationFile = "prisma\migrations\add_adult_verification_fields\migration.sql"

# IT環境
Write-Host ""
Write-Host "【IT環境】マイグレーション実行中..." -ForegroundColor Yellow
$itDbUrl = "postgresql://postgres:namoai20250701@namoai-it.cluwk88i28od.ap-northeast-1.rds.amazonaws.com:5432/postgres"

try {
    $env:DATABASE_URL = $itDbUrl
    Get-Content $migrationFile | psql $itDbUrl
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ IT環境: マイグレーション成功" -ForegroundColor Green
    } else {
        Write-Host "❌ IT環境: マイグレーション失敗" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ IT環境: エラー - $_" -ForegroundColor Red
    exit 1
}

# 本番環境（혼방）
Write-Host ""
Write-Host "【本番環境】マイグレーション実行中..." -ForegroundColor Yellow
$prodDbUrl = "postgresql://postgres:namoai20250701@namos-chat.cluwk88i28od.ap-northeast-1.rds.amazonaws.com:5432/postgres"

try {
    $env:DATABASE_URL = $prodDbUrl
    Get-Content $migrationFile | psql $prodDbUrl
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ 本番環境: マイグレーション成功" -ForegroundColor Green
    } else {
        Write-Host "❌ 本番環境: マイグレーション失敗" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ 本番環境: エラー - $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "✅ すべてのマイグレーションが完了しました" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan

