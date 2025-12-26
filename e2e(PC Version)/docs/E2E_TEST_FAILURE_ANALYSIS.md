# E2E 테스트 실패 원인 분석

## 📋 개요

E2E 테스트 실행 결과, 총 16개 테스트가 실패했습니다. 실패 원인은 크게 두 가지로 분류됩니다:

1. **로그인 실패 문제** (테스트 1-8): 8개 테스트
2. **네트워크 에러 문제** (테스트 9-16): 8개 테스트 (5개 interrupted, 3개 failed)

---

## 🔴 문제 1: 로그인 실패 (테스트 1-8)

### 실패한 테스트
- `admin-banners.spec.ts`: 2-6-1, 2-6-2
- `admin-character-management.spec.ts`: 모든 테스트 (6개)

### 에러 메시지
```
Error: ログインに失敗しました。URL: http://localhost:3000/login
エラー内容: ナモアイサービスを利用するためにはログインが必要です。 Googleアカウントで始まるまたはメールアドレスパスワードログイン状態を保持するパスワード再設定ログインアカウントがない方...
```

### 원인 분석

#### 1. 로그인 함수의 문제점 (`e2e/helpers/auth.ts:162`)

`loginWithEmail` 함수가 로그인 후 리다이렉트를 기다리는데, 로그인 페이지에 머물러 있는 것을 감지하고 에러를 던지고 있습니다.

**문제 코드:**
```typescript:162:162:e2e/helpers/auth.ts
throw new Error(`ログインに失敗しました。URL: ${finalUrl}\nエラー内容: ${errorText.substring(0, 200)}`);
```

#### 2. 가능한 원인들

1. **잘못된 자격증명**
   - 환경 변수 `ADMIN_EMAIL`, `ADMIN_PASSWORD`가 설정되지 않았거나 잘못됨
   - 기본값(`admin@example.com`, `adminpassword123`)이 실제 계정과 일치하지 않음

2. **2FA 활성화**
   - 관리자 계정에 2FA가 활성화되어 있음
   - `loginWithEmail` 함수가 2FA 코드를 기다리지만 제공되지 않음
   - 환경 변수 `TEST_2FA_CODE`가 설정되지 않음

3. **계정 잠금**
   - 로그인 실패 횟수가 10회를 초과하여 계정이 잠금됨
   - `lockedUntil` 필드가 설정되어 있음

4. **계정 정지**
   - 관리자 계정이 `suspendedUntil`로 인해 정지됨

5. **로그인 후 리다이렉트 실패**
   - 로그인은 성공했지만 리다이렉트가 제대로 되지 않음
   - 세션 쿠키가 제대로 설정되지 않음

#### 3. 로그인 플로우 분석

현재 `loginWithEmail` 함수의 동작:
1. 로그인 페이지로 이동
2. 이메일/비밀번호 입력
3. 로그인 버튼 클릭
4. URL 변경 대기 (10초 타임아웃)
5. URL이 `/login`에 머물러 있으면 에러 발생

**문제점:**
- 로그인 실패 시 에러 메시지가 페이지에 표시되지만, 함수가 이를 감지하지 못함
- 2FA가 필요한 경우 처리가 제대로 되지 않을 수 있음

---

## 🔴 문제 2: 네트워크 에러 (테스트 9-16)

### 실패한 테스트
- `admin-ip-management.spec.ts`: 2-10-1, 2-10-2, 2-10-3
- `admin-notices.spec.ts`: 2-4-1, 2-4-2
- `admin-guides.spec.ts`: 2-5-1, 2-5-2
- `admin-reports.spec.ts`: 2-8-1

### 에러 메시지
```
Error: page.goto: net::ERR_ABORTED at http://localhost:3000/admin/ip-block
Error: page.goto: net::ERR_ABORTED at http://localhost:3000/notice/admin
Error: page.goto: net::ERR_ABORTED at http://localhost:3000/admin/reports
Error: page.goto: net::ERR_ABORTED at http://localhost:3000/admin/guides
```

### 원인 분석

#### 1. 로그인 실패로 인한 연쇄 실패

대부분의 테스트가 `beforeEach`에서 로그인을 시도한 후 관리자 페이지로 이동합니다:

```typescript
test.beforeEach(async ({ page }) => {
  await setBasicAuth(page);
  await loginWithEmail(page, adminEmail, adminPassword);
  await page.goto(`${BASE_URL}/admin/guides`, { ... });
});
```

**문제점:**
- `loginWithEmail`이 실패하면 에러를 던지지만, 일부 테스트는 계속 진행됨
- 로그인되지 않은 상태에서 관리자 페이지 접근 시도
- 서버가 인증되지 않은 요청을 차단하여 `net::ERR_ABORTED` 발생

#### 2. 서버 측 인증 체크

관리자 페이지는 인증이 필요합니다:
- NextAuth 세션이 없으면 `/login`으로 리다이렉트
- 리다이렉트 과정에서 네트워크 연결이 중단될 수 있음

#### 3. Basic 인증 설정 문제

`setBasicAuth` 함수가 제대로 작동하지 않을 수 있습니다:
- 환경 변수 `ADMIN_BASIC_AUTH_USER`, `ADMIN_BASIC_AUTH_PASSWORD`가 설정되지 않음
- Basic 인증이 필요한 경우 인증 실패로 연결이 중단됨

---

## 🔍 근본 원인 요약

### 1차 원인: 로그인 실패
- 잘못된 자격증명
- 2FA 활성화
- 계정 잠금/정지
- 로그인 함수의 리다이렉트 감지 실패

### 2차 원인: 네트워크 에러
- 로그인 실패로 인한 연쇄 실패
- 인증되지 않은 요청 차단
- Basic 인증 설정 문제

---

## ✅ 해결 방안

### 1. 환경 변수 확인

다음 환경 변수가 올바르게 설정되어 있는지 확인:

```bash
# 필수 환경 변수
ADMIN_EMAIL=실제_관리자_이메일
ADMIN_PASSWORD=실제_관리자_비밀번호

# 2FA가 활성화된 경우
TEST_2FA_CODE=2FA_코드

# Basic 인증이 필요한 경우
ADMIN_BASIC_AUTH_USER=basic_인증_사용자명
ADMIN_BASIC_AUTH_PASSWORD=basic_인증_비밀번호
```

**중요:** `.env.local` 파일이 프로젝트 루트에 있는지 확인하세요. Playwright는 `playwright.config.ts`에서 `.env.local`을 자동으로 로드합니다.

### 1-1. 환경 변수 로드 확인

테스트 실행 시 콘솔에 다음 메시지가 표시됩니다:
- `[Playwright Config] .env.local ファイルを読み込みました` - 성공
- `[Playwright Config] .env.local ファイルの読み込みに失敗しました` - 실패

환경 변수가 로드되지 않으면 시스템 환경 변수에서 읽으려고 시도합니다.

### 2. 로그인 함수 개선

`e2e/helpers/auth.ts`의 `loginWithEmail` 함수를 개선:

1. **에러 메시지 감지 개선**
   - 로그인 페이지에 표시되는 에러 메시지를 명확히 감지
   - 에러 타입별로 구체적인 메시지 제공

2. **2FA 처리 개선**
   - 2FA가 필요한 경우 자동으로 처리
   - 환경 변수에서 2FA 코드 자동 읽기

3. **리다이렉트 대기 시간 증가**
   - 타임아웃 시간을 늘림
   - 여러 리다이렉트 단계를 고려

### 3. 테스트 구조 개선

1. **로그인 검증 추가**
   - `beforeEach`에서 로그인 성공 여부를 명시적으로 확인
   - 로그인 실패 시 테스트를 스킵하거나 명확한 에러 메시지 제공

2. **에러 핸들링 개선**
   - 네트워크 에러 발생 시 더 자세한 정보 제공
   - 스크린샷과 로그를 활용한 디버깅 정보 수집

### 4. 계정 상태 확인

1. **계정 잠금 확인**
   - 데이터베이스에서 `loginAttempts`, `lockedUntil` 확인
   - 필요시 계정 잠금 해제

2. **계정 정지 확인**
   - `suspendedUntil` 필드 확인
   - 필요시 정지 해제

3. **2FA 상태 확인**
   - 관리자 계정의 2FA 활성화 여부 확인
   - 테스트용 계정은 2FA 비활성화 고려

### 5. 서버 상태 확인

1. **서버 실행 확인**
   - `http://localhost:3000`이 정상적으로 실행 중인지 확인
   - NextAuth 설정이 올바른지 확인

2. **데이터베이스 연결 확인**
   - Prisma 연결이 정상인지 확인
   - 관리자 계정이 데이터베이스에 존재하는지 확인

---

## 🛠️ 즉시 조치 사항

### 1. 환경 변수 설정 확인
```bash
# .env 파일 또는 환경 변수 확인
echo $ADMIN_EMAIL
echo $ADMIN_PASSWORD
echo $TEST_2FA_CODE
```

### 2. 관리자 계정 확인
- 데이터베이스에서 관리자 계정 확인
- 계정 잠금/정지 상태 확인
- 2FA 활성화 여부 확인

### 3. 로그인 수동 테스트
- 브라우저에서 직접 로그인 시도
- 에러 메시지 확인
- 네트워크 탭에서 요청/응답 확인

### 4. 테스트 단일 실행
```bash
# 하나의 테스트만 실행하여 디버깅
npx playwright test e2e/admin-banners.spec.ts:44 --headed
```

---

## 📊 실패 테스트 목록

### 로그인 실패 (8개)
1. `admin-banners.spec.ts:44` - 2-6-1: バナー一覧確認
2. `admin-banners.spec.ts:58` - 2-6-2: バナー作成
3. `admin-character-management.spec.ts:27` - キャラクター一覧が表示される
4. `admin-character-management.spec.ts:40` - キャラクターを検索できる
5. `admin-character-management.spec.ts:62` - キャラクターの詳細を確認できる
6. `admin-character-management.spec.ts:84` - 2-3-3: キャラクター公開/非公開切替
7. `admin-character-management.spec.ts:111` - 2-3-5: キャラクター削除
8. `admin-character-management.spec.ts:139` - 2-3-7: ナモアイフレンズ登録/解除

### 네트워크 에러 (8개)
9. `admin-ip-management.spec.ts:29` - 2-10-1: IPブロック (interrupted)
10. `admin-ip-management.spec.ts:69` - 2-10-2: IPブロック解除 (failed)
11. `admin-ip-management.spec.ts:99` - 2-10-3: IPモニタリング (interrupted)
12. `admin-notices.spec.ts:42` - 2-4-1: お知らせ一覧確認 (failed)
13. `admin-notices.spec.ts:56` - 2-4-2: お知らせ作成 (interrupted)
14. `admin-guides.spec.ts:42` - 2-5-1: ガイド一覧確認 (interrupted)
15. `admin-guides.spec.ts:64` - 2-5-2: ガイド作成 (interrupted)
16. `admin-reports.spec.ts:43` - 2-8-1: 通報一覧確認 (failed)

---

## 📝 추가 조사 필요 사항

1. **로그인 API 응답 확인**
   - `/api/auth/signin` 엔드포인트의 응답 확인
   - 에러 메시지의 정확한 내용 확인

2. **세션 쿠키 확인**
   - 로그인 후 세션 쿠키가 제대로 설정되는지 확인
   - 쿠키 도메인/경로 설정 확인

3. **리다이렉트 로직 확인**
   - NextAuth의 리다이렉트 설정 확인
   - `callbackUrl` 파라미터 처리 확인

4. **서버 로그 확인**
   - 서버 측 로그에서 인증 실패 원인 확인
   - 데이터베이스 쿼리 로그 확인

---

## 🔗 관련 파일

- `e2e/helpers/auth.ts` - 인증 헬퍼 함수
- `e2e/admin-*.spec.ts` - 관리자 테스트 파일들
- `src/app/login/page.tsx` - 로그인 페이지
- `src/lib/nextauth.ts` - NextAuth 설정
- `src/app/api/auth/[...nextauth]/route.ts` - NextAuth API 라우트

