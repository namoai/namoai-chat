# 실패한 테스트만 실행하는 스크립트
$failedTests = @(
    "e2e/user-auth.spec.ts -g 'パスワード変更'",
    "e2e/user-character.spec.ts -g 'キャラクター作成'",
    "e2e/user-character.spec.ts -g 'キャラクタークローン'",
    "e2e/user-social.spec.ts -g 'フォロー'",
    "e2e/user-social.spec.ts -g 'コメント作成'"
)

foreach ($test in $failedTests) {
    Write-Host "Running: $test" -ForegroundColor Yellow
    npx playwright test $test
}




