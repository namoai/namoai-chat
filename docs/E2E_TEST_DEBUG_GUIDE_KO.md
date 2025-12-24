# E2E 테스트 디버깅 가이드

**최종 업데이트**: 2025년 12월 22일

---

## 🔍 테스트 실패 시 확인 사항

### 1. HTML 리포트 확인

```bash
npm run test:e2e:report
```

브라우저가 자동으로 열리며, 다음을 확인할 수 있습니다:
- 실패한 테스트 목록
- 에러 메시지
- 스크린샷
- 동영상 (실패 시)
- 트레이스 (실패 시)

### 2. 스크린샷 확인

```powershell
# 스크린샷 위치
Get-ChildItem -Path test-results -Recurse -Filter "*.png" | Select-Object -First 5
```

스크린샷에서 다음을 확인:
- 페이지가 제대로 로드되었는지
- 로그인 화면이 표시되는지
- 에러 메시지가 있는지

### 3. 환경 변수 확인

```powershell
# 환경 변수 확인
$env:PLAYWRIGHT_BASE_URL
$env:ADMIN_BASIC_AUTH_USER
$env:ADMIN_BASIC_AUTH_PASSWORD
$env:ADMIN_EMAIL
$env:ADMIN_PASSWORD
$env:TEST_EMAIL
$env:TEST_PASSWORD
```

### 4. 개발 서버 확인

```bash
# 개발 서버가 실행 중인지 확인
curl http://localhost:3000

# 또는 브라우저에서 직접 접속
# http://localhost:3000
```

---

## 🐛 주요 실패 원인

### 원인 1: Basic 인증 설정 누락

**증상**: 관리자 테스트가 모두 실패

**해결 방법**:
```powershell
# 환경 변수 설정
$env:ADMIN_BASIC_AUTH_USER="admin"
$env:ADMIN_BASIC_AUTH_PASSWORD="your-password"
```

### 원인 2: 로그인 정보 오류

**증상**: 로그인 테스트 실패

**해결 방법**:
```powershell
# 올바른 계정 정보 설정
$env:ADMIN_EMAIL="admin@example.com"
$env:ADMIN_PASSWORD="correct-password"
$env:TEST_EMAIL="test@example.com"
$env:TEST_PASSWORD="correct-password"
```

### 원인 3: 개발 서버 미실행

**증상**: `ECONNREFUSED` 에러

**해결 방법**:
```bash
# 별도 터미널에서 개발 서버 실행
npm run dev
```

### 원인 4: 2FA 활성화

**증상**: 2FA 코드 입력 화면 표시

**해결 방법**:
```sql
-- 데이터베이스에서 2FA 비활성화
UPDATE users SET twoFactorEnabled = false WHERE email = 'admin@example.com';
```

### 원인 5: 타임아웃

**증상**: `Timeout exceeded` 에러

**해결 방법**:
```bash
# 타임아웃 연장
npm run test:e2e -- --timeout=120000
```

---

## 📊 테스트 결과 분석

### HTML 리포트에서 확인할 사항

1. **에러 메시지**: 정확한 실패 원인
2. **스크린샷**: 실패 시점의 화면 상태
3. **트레이스**: 단계별 실행 과정
4. **동영상**: 전체 테스트 실행 과정

### 로그 확인

```bash
# Playwright 로그 확인
npm run test:e2e -- --reporter=list

# 상세 로그
DEBUG=pw:api npm run test:e2e
```

---

## 🔧 디버깅 팁

### 1. 단일 테스트 실행

```bash
# 특정 테스트만 실행
npm run test:e2e -- e2e/admin-user-management.spec.ts --grep "ユーザー一覧"
```

### 2. UI 모드로 실행

```bash
# 브라우저에서 단계별 확인
npm run test:e2e:ui
```

### 3. 헤드 모드로 실행

```bash
# 브라우저를 표시하며 실행
npm run test:e2e:headed
```

### 4. 디버그 모드

```bash
# Playwright Inspector 실행
npm run test:e2e:debug
```

---

## 📝 체크리스트

테스트 실패 시 다음을 확인하세요:

- [ ] 개발 서버가 실행 중인가? (`npm run dev`)
- [ ] 환경 변수가 올바르게 설정되었는가?
- [ ] Basic 인증 정보가 설정되었는가? (관리자 테스트)
- [ ] 로그인 계정 정보가 올바른가?
- [ ] 2FA가 비활성화되어 있는가?
- [ ] HTML 리포트에서 에러 메시지를 확인했는가?
- [ ] 스크린샷을 확인했는가?

---

## 🚨 긴급 대응

모든 테스트가 실패하는 경우:

1. **환경 변수 재설정**
   ```powershell
   $env:PLAYWRIGHT_BASE_URL="http://localhost:3000"
   $env:ADMIN_BASIC_AUTH_USER="admin"
   $env:ADMIN_BASIC_AUTH_PASSWORD="your-password"
   $env:ADMIN_EMAIL="admin@example.com"
   $env:ADMIN_PASSWORD="your-password"
   ```

2. **개발 서버 재시작**
   ```bash
   # 서버 중지 후 재시작
   npm run dev
   ```

3. **P0 테스트만 실행**
   ```bash
   npm run test:e2e -- e2e/points-critical.spec.ts
   ```

4. **HTML 리포트 확인**
   ```bash
   npm run test:e2e:report
   ```

---

**문제가 계속되면**: HTML 리포트의 스크린샷과 에러 메시지를 확인하세요.








