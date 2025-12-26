# E2E テスト: 2FA (2단계 인증) 대응 가이드

**最終更新**: 2025年12月22日

---

## 🎯 問題

**管理자アカウントに2FA（2단계 인증）が設定されている場合、E2Eテストは可能ですか？**

**回答**: ✅ **可能です。ただし、追加の設定が必要합니다。**

---

## 📋 対応方法

### 方法1: テスト용 관리자 계정의 2FA 비활성화 (推奨)

**最も簡単な方法**:

1. テスト用 관리자アカウントを作成
2. そのアカウントの2FAを無効化
3. テストでそのアカウントを使用

**実装例**:
```typescript
// e2e/helpers/auth.ts
export async function createTestAdminUser(): Promise<{ email: string; password: string; userId?: number }> {
  const timestamp = Date.now();
  const email = `test-admin-${timestamp}@e2e-test.com`;
  const password = 'TestAdminPassword123!';
  
  // ユーザーを作成（2FA無効）
  // ... ユーザー作成API呼び出し
  
  // 2FAを無効化
  // await disable2FA(userId);
  
  return { email, password, userId };
}
```

---

### 方法2: 環境変数で2FA 코드 제공

**テスト実行時に2FA 코드를環境変数で提供**:

```powershell
# Windows PowerShell
$env:TEST_2FA_CODE="123456"

# テスト実行
npm run test:e2e
```

**注意**: 
- この方法は**メールベース2FA**の場合のみ有効
- コードは手動で取得する必要がある
- テストのたびに新しいコードが必要（推奨しない）

---

### 方法3: TOTP (Google Authenticator) 코드自動生成

**TOTP 시크릿 키를 환경 변수로 제공**:

```powershell
# Windows PowerShell
$env:ADMIN_TOTP_SECRET="YOUR_TOTP_SECRET_KEY"

# テスト実行
npm run test:e2e
```

**実装**:
```typescript
// e2e/admin-user-management.spec.ts
import { loginWithTOTP } from './helpers/auth-2fa';

test.beforeEach(async ({ page }) => {
  const totpSecret = process.env.ADMIN_TOTP_SECRET;
  
  if (totpSecret) {
    await loginWithTOTP(page, adminEmail, adminPassword, totpSecret);
  } else {
    // 2FAが無効な場合は通常のログイン
    await loginWithEmail(page, adminEmail, adminPassword);
  }
});
```

**注意**: 
- TOTP 시크릿 키는 보안상 환경 변수나 시크릿 매니저에 저장
- CI/CD에서는 GitHub Secretsを使用

---

### 方法4: 백업 코드 사용

**백업 코드를 환경 변수로 제공**:

```powershell
# Windows PowerShell
$env:ADMIN_BACKUP_CODE="BACKUP123456"

# テスト実行
npm run test:e2e
```

**実装**:
```typescript
// e2e/admin-user-management.spec.ts
import { loginWithBackupCode } from './helpers/auth-2fa';

test.beforeEach(async ({ page }) => {
  const backupCode = process.env.ADMIN_BACKUP_CODE;
  
  if (backupCode) {
    await loginWithBackupCode(page, adminEmail, adminPassword, backupCode);
  } else {
    await loginWithEmail(page, adminEmail, adminPassword);
  }
});
```

**注意**: 
- 백업 코드는 1회 사용 후 무효화됨
- 여러 번 테스트를 실행하는 경우 부적합

---

### 方法5: テスト環境에서2FA 우회 (開発環境のみ)

**주의**: 本番環境では絶対に使用しないでください。

**実装例**:
```typescript
// src/lib/nextauth.ts (テスト環境でのみ)
if (process.env.APP_ENV === 'local' && process.env.BYPASS_2FA_FOR_TEST === 'true') {
  // 2FA를 우회
  return { user: { ...user }, skip2FA: true };
}
```

**環境変数**:
```bash
# .env.local (テスト環境のみ)
BYPASS_2FA_FOR_TEST=true
```

---

## 🎯 推奨される実装

### 推奨: 方法1 (テスト용 계정 2FA 비활성화)

1. **テスト용 관리자 계정 생성**
   ```sql
   -- データベースで直接作成、またはAPI経由
   INSERT INTO users (email, password, role, twoFactorEnabled) 
   VALUES ('test-admin@e2e-test.com', '$2b$...', 'SUPER_ADMIN', false);
   ```

2. **환경 변수 설정**
   ```powershell
   $env:ADMIN_EMAIL="test-admin@e2e-test.com"
   $env:ADMIN_PASSWORD="TestAdminPassword123!"
   ```

3. **테스트 실행**
   ```bash
   npm run test:e2e -- e2e/admin-user-management.spec.ts
   ```

---

## 📝 実装例: 2FA対応ログイン関数

### 自動2FA処理付きログイン

```typescript
// e2e/helpers/auth.ts に追加
export async function loginWithEmailAuto2FA(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  
  // メールアドレスとパスワード入力
  const emailInput = page.locator('input[type="email"]').first();
  await emailInput.fill(email);
  
  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.fill(password);
  
  const loginButton = page.locator('button[type="submit"]').first();
  await loginButton.click();
  
  await page.waitForTimeout(2000);
  
  // 2FAコード入力画面を確認
  const twoFactorInput = page.locator('input[placeholder*="コード"]').first();
  
  if (await twoFactorInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    // 2FAが必要な場合
    
    // 環境変数からコードを取得
    const twoFactorCode = process.env.TEST_2FA_CODE || process.env.ADMIN_TOTP_CODE;
    
    if (twoFactorCode) {
      await twoFactorInput.fill(twoFactorCode);
      const verifyButton = page.locator('button:has-text("確認")').first();
      await verifyButton.click();
    } else {
      throw new Error('2FAコードが必要ですが、環境変数TEST_2FA_CODEまたはADMIN_TOTP_CODEが設定されていません。');
    }
  }
  
  // ログイン完了を待つ
  await page.waitForURL(/\/($|MyPage|admin)/, { timeout: 10000 });
}
```

---

## 🔧 テスト環境別推奨設定

### ローカル環境 (local)

**推奨**: テスト용 계정 2FA 비활성화
```powershell
$env:ADMIN_EMAIL="test-admin@e2e-test.com"
$env:ADMIN_PASSWORD="TestAdminPassword123!"
```

### CI/CD環境 (GitHub Actions)

**推奨**: TOTP 자동 생성 또는 테스트용 계정 사용
```yaml
# .github/workflows/e2e-tests.yml
env:
  ADMIN_EMAIL: ${{ secrets.ADMIN_EMAIL }}
  ADMIN_PASSWORD: ${{ secrets.ADMIN_PASSWORD }}
  ADMIN_TOTP_SECRET: ${{ secrets.ADMIN_TOTP_SECRET }}
```

---

## ⚠️ 注意事項

### セキュリティ

1. **本番環境のアカウントは使用しない**
   - テスト용 별도 계정 사용
   - 本番データに影響を与えない

2. **TOTP 시크릿 키 보안**
   - GitHub Secrets에 저장
   - `.env` 파일에 커밋하지 않음
   - 로컬 환경 변수만 사용

3. **백업 코드 관리**
   - 백업 코드는 1회 사용 후 무효화
   - 여러 테스트에 사용 불가

### テスト安定性

1. **2FA 비활성화 계정 사용 권장**
   - 가장 안정적
   - 테스트 속도 향상
   - 코드 복잡도 감소

2. **TOTP 자동 생성 사용 시**
   - 시간 동기화 문제 가능
   - 타임아웃 설정 주의

---

## 📚 参考

- [2FA 구현 코드](../src/lib/2fa.ts)
- [ログインページ 2FA 처리](../src/app/login/page.tsx)
- [認証ヘルパー関数](../e2e/helpers/auth.ts)
- [2FAヘルパー関数](../e2e/helpers/auth-2fa.ts) (新規作成)

---

## 🎯 まとめ

**推奨アプローチ**:
1. ✅ **テスト용 관리자 계정 생성** (2FA 비활성화)
2. ✅ **환경 변수로 계정 정보 제공**
3. ✅ **테스트에서 해당 계정 사용**

これにより、2FAが設定されていても、テストを安定して実行できます。














