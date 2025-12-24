# 管理者テストを1つずつ実行するスクリプト
# サーバーの負荷を軽減するため、各テストファイルを個別に実行します

$testFiles = @(
    "e2e/admin-banners.spec.ts",
    "e2e/admin-character-management.spec.ts",
    "e2e/admin-guides.spec.ts",
    "e2e/admin-notices.spec.ts",
    "e2e/admin-reports.spec.ts",
    "e2e/admin-ip-management.spec.ts"
)

Write-Host "管理者テストを1つずつ実行します..." -ForegroundColor Green
Write-Host ""

$totalPassed = 0
$totalFailed = 0

foreach ($testFile in $testFiles) {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "実行中: $testFile" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # 各テストファイルを個別に実行
    $result = npx playwright test $testFile --project=chromium --workers=1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ $testFile が成功しました" -ForegroundColor Green
        $totalPassed++
    } else {
        Write-Host "✗ $testFile が失敗しました" -ForegroundColor Red
        $totalFailed++
    }
    
    Write-Host ""
    Write-Host "次のテストまで5秒待機します..." -ForegroundColor Gray
    Start-Sleep -Seconds 5
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "テスト実行完了" -ForegroundColor Green
Write-Host "成功: $totalPassed" -ForegroundColor Green
Write-Host "失敗: $totalFailed" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Cyan








