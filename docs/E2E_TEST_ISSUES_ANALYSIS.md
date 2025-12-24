# E2E 테스트 이슈 분석 (IT 환경 실행 결과)

## 1. 유저 테스트 전체 실패 원인

### 문제: 계정 잠금 (Account Lock)

**증상:**
- 모든 유저 테스트가 실패
- 에러 메시지: "アカウントがロックされました" (계정이 잠겨있습니다)
- 계정 잠금 기간: 14분

**원인:**
- `TEST_EMAIL` 계정이 여러 번 로그인 실패로 인해 잠김
- 로그인 실패 10회 이상 시 계정 자동 잠금 (15분간)
- `createTestUser()` 함수가 실제로는 새 계정을 만들지 않고 기존 `TEST_EMAIL` 계정을 재사용

**해결 방법:**

#### 방법 1: 관리자 페이지에서 잠금 해제 (권장)
1. 관리자 계정으로 로그인
2. `/admin/users` 페이지 접근
3. `TEST_EMAIL` 계정 검색
4. "ロック解除" (잠금 해제) 버튼 클릭

#### 방법 2: DB에서 직접 해제
```sql
-- 계정 잠금 해제 및 로그인 시도 횟수 리셋
UPDATE users 
SET lockedUntil = NULL, 
    loginAttempts = 0 
WHERE email = 'your-test-email@example.com';
```

#### 방법 3: 15분 대기
- 계정 잠금은 15분 후 자동 해제됨
- 잠금 해제 후 테스트 재실행

**향후 개선:**
- 테스트 전에 자동으로 계정 잠금을 해제하는 헬퍼 함수 추가
- 또는 테스트용 계정을 여러 개 준비하여 로테이션 사용

---

## 2. 관리자 테스트 실패 케이스 분석

### 2-1. admin-notices-2-4-2: お知らせ作成

**에러 컨텍스트:**
- 페이지는 정상적으로 로드됨
- 입력 필드가 보임: `textbox "タイトル"`, `textbox "内容 (HTML使用可能)"`
- `combobox "カテゴリー"`도 정상 표시

**예상 원인:**
- 입력 필드 선택자가 정확하지 않을 수 있음
- 또는 입력 후 저장 버튼 클릭 시 문제

**수정 필요:**
```typescript
// 현재 선택자
const titleInput = page.locator('input[name*="title"], input[placeholder*="タイトル"]').first();

// 개선된 선택자 (실제 DOM 구조 확인 필요)
const titleInput = page.locator('input[type="text"]').first(); // 또는 더 구체적인 선택자
```

---

### 2-2. admin-reports-2-8-1: 通報一覧確認

**에러 컨텍스트:**
- 페이지는 정상적으로 로드됨
- "通報履歴がありません。" (신고 이력이 없습니다) 메시지가 표시됨

**예상 원인:**
- 선택자가 "신고가 없습니다" 메시지를 제대로 찾지 못함
- 또는 신고 목록 선택자가 잘못됨

**수정 필요:**
```typescript
// 현재 선택자
const noReportMessage = page.locator('text=/通報がありません|データがありません|No reports/i');

// 개선된 선택자
const noReportMessage = page.locator('text=/通報履歴がありません|通報がありません|データがありません/i');
```

---

### 2-3. admin-terms-2-7-2: 約款編集

**에러 컨텍스트:**
- 페이지는 정상적으로 로드됨
- 편집 폼이 보임
- 내용 입력 필드에 텍스트가 입력되어 있음

**예상 원인:**
- 저장 버튼 선택자 문제
- 또는 저장 후 성공 메시지 확인 실패

**수정 필요:**
- 저장 버튼 선택자 확인 및 수정
- 성공 메시지 확인 로직 개선

---

## 3. 테스트 실행 전 체크리스트

### 필수 확인 사항:
1. ✅ `TEST_EMAIL` 계정이 잠겨있지 않은지 확인
2. ✅ `ADMIN_EMAIL` 계정이 정상 작동하는지 확인
3. ✅ 서버가 정상적으로 실행 중인지 확인
4. ✅ 환경 변수가 올바르게 설정되어 있는지 확인

### 환경 변수 확인:
```bash
# 필수 환경 변수
PLAYWRIGHT_BASE_URL=https://your-app-id.amplify.app
ADMIN_EMAIL=your-admin-email@example.com
ADMIN_PASSWORD=your-admin-password
TEST_EMAIL=your-test-email@example.com
TEST_PASSWORD=your-test-password
```

---

## 4. 다음 단계

1. **유저 테스트 계정 잠금 해제** - 관리자 페이지 또는 DB에서 해제
2. **관리자 테스트 선택자 수정** - 실제 DOM 구조에 맞게 선택자 개선
3. **테스트 재실행** - 수정 후 전체 테스트 재실행
4. **결과 문서화** - 성공/실패 케이스 업데이트




