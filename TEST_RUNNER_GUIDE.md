# 🧪 CLI 테스트 러너 사용 가이드

## 📋 개요

CLI 테스트 러너는 웹 UI와 동일한 테스트를 명령줄에서 실행할 수 있는 도구입니다. CI/CD 파이프라인이나 자동화 스크립트에서 사용하기에 적합합니다.

## 🚀 빠른 시작

### 1. 사전 요구사항

- Node.js 20.x 이상
- API 서버가 실행 중이어야 함 (`npm run dev` 또는 `npm start`)

### 2. 기본 실행

```bash
# npm 스크립트 사용
npm run test -- --email admin@example.com --password yourpassword

# 또는 직접 실행
node scripts/test-runner.mjs --email admin@example.com --password yourpassword
```

### 3. 환경 변수 설정 (선택사항)

`.env.local` 파일에 설정하거나 환경 변수로 설정:

```bash
export API_URL=http://localhost:3000
export TEST_EMAIL=admin@example.com
export TEST_PASSWORD=yourpassword
```

그러면 옵션 없이 실행 가능:

```bash
npm run test
```

## 📖 사용법

### 기본 옵션

```bash
node scripts/test-runner.mjs [옵션]
```

### 주요 옵션

| 옵션 | 설명 | 예제 |
|------|------|------|
| `--url <url>` | API 서버 URL | `--url http://localhost:3000` |
| `--email <email>` | 로그인 이메일 (필수) | `--email admin@example.com` |
| `--password <password>` | 로그인 비밀번호 (필수) | `--password pass123` |
| `--category <name>` | 특정 카테고리만 테스트 | `--category "ポイント機能"` |
| `--test <name>` | 특정 테스트만 실행 | `--test "ポイント情報取得"` |
| `--json` | JSON 형식으로 출력 | `--json` |
| `--output <file>` | 결과를 파일로 저장 | `--output results.json` |
| `--ai-analysis` | AI 분석 포함 | `--ai-analysis` |
| `--help` | 도움말 표시 | `--help` |

## 💡 사용 예제

### 1. 모든 테스트 실행

```bash
node scripts/test-runner.mjs \
  --email admin@example.com \
  --password yourpassword
```

### 2. JSON 형식으로 출력

```bash
node scripts/test-runner.mjs \
  --email admin@example.com \
  --password yourpassword \
  --json
```

### 3. 특정 카테고리만 테스트

```bash
# ポイント機能만 테스트
node scripts/test-runner.mjs \
  --email admin@example.com \
  --password yourpassword \
  --category "ポイント機能"

# キャラクター機能만 테스트
node scripts/test-runner.mjs \
  --email admin@example.com \
  --password yourpassword \
  --category "キャラクター機能"
```

### 4. 특정 테스트만 실행

```bash
node scripts/test-runner.mjs \
  --email admin@example.com \
  --password yourpassword \
  --test "ポイント情報取得"
```

### 5. AI 분석 포함

```bash
node scripts/test-runner.mjs \
  --email admin@example.com \
  --password yourpassword \
  --ai-analysis
```

### 6. 결과를 파일로 저장

```bash
node scripts/test-runner.mjs \
  --email admin@example.com \
  --password yourpassword \
  --output test-results.json
```

### 7. JSON + 파일 저장 + AI 분석

```bash
node scripts/test-runner.mjs \
  --email admin@example.com \
  --password yourpassword \
  --json \
  --output test-results.json \
  --ai-analysis
```

## 🔧 npm 스크립트 사용

`package.json`에 미리 정의된 스크립트:

```bash
# 기본 실행
npm run test -- --email admin@example.com --password pass123

# JSON 출력
npm run test:json -- --email admin@example.com --password pass123

# 특정 카테고리
npm run test:category -- --category "ポイント機能" --email admin@example.com --password pass123

# AI 분석 포함
npm run test:ai -- --email admin@example.com --password pass123
```

## 📊 출력 형식

### 일반 출력

```
🔐 ログイン中...
✅ ログイン成功: Admin User

🚀 テストを開始します...

✅ [認証・セッション] セッション確認        (45ms)
✅ [認証・セッション] ユーザー情報取得      (32ms)
✅ [ポイント機能    ] ポイント情報取得      (67ms)
✅ [ポイント機能    ] ポイントチャージ      (123ms)
❌ [ポイント機能    ] 出席チェック          (89ms)
   出席済みまたはエラー

📊 テスト結果サマリー:
  総テスト数: 20
  成功: 19 (95.00%)
  失敗: 1
  平均実行時間: 78ms
```

### JSON 출력

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "baseUrl": "http://localhost:3000",
  "user": {
    "email": "admin@example.com",
    "name": "Admin User",
    "id": "1"
  },
  "summary": {
    "total": 20,
    "passed": 19,
    "failed": 1,
    "successRate": "95.00%",
    "avgDuration": "78ms"
  },
  "results": [
    {
      "category": "認証・セッション",
      "name": "セッション確認",
      "status": "success",
      "message": "{\"userId\":\"1\"}",
      "duration": 45,
      "timestamp": "2024-01-01T12:00:00.000Z"
    }
  ]
}
```

## 🔄 CI/CD 통합

### GitHub Actions 예제

```yaml
name: API Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm install
      
      - name: Start API server
        run: npm run dev &
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          NEXTAUTH_SECRET: ${{ secrets.NEXTAUTH_SECRET }}
      
      - name: Wait for server
        run: |
          timeout 30 bash -c 'until curl -f http://localhost:3000/api/auth/session; do sleep 1; done'
      
      - name: Run tests
        run: |
          npm run test:json \
            -- --email ${{ secrets.TEST_EMAIL }} \
               --password ${{ secrets.TEST_PASSWORD }} \
               --output test-results.json
        env:
          API_URL: http://localhost:3000
      
      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-results
          path: test-results.json
```

### GitLab CI 예제

```yaml
test:
  image: node:20
  before_script:
    - npm install
  script:
    - npm run dev &
    - sleep 10
    - npm run test:json -- --email $TEST_EMAIL --password $TEST_PASSWORD --output test-results.json
  artifacts:
    paths:
      - test-results.json
```

## 🐛 문제 해결

### 1. 로그인 실패

```
❌ エラー: ログインに失敗しました
```

**해결 방법:**
- 이메일과 비밀번호가 올바른지 확인
- API 서버가 실행 중인지 확인 (`curl http://localhost:3000/api/auth/session`)
- 사용자 계정이 활성화되어 있는지 확인

### 2. 연결 오류

```
❌ エラー: fetch failed
```

**해결 방법:**
- API 서버 URL이 올바른지 확인 (`--url` 옵션)
- 방화벽이나 네트워크 설정 확인
- 서버가 실행 중인지 확인

### 3. 세션 오류

```
❌ エラー: セッションが取得できませんでした
```

**해결 방법:**
- 로그인이 성공했는지 확인
- 쿠키가 제대로 저장되었는지 확인
- 서버의 세션 설정 확인

## 📝 테스트 카테고리

현재 지원하는 테스트 카테고리:

1. **認証・セッション** - 인증 및 세션 관리
2. **ポイント機能** - 포인트 시스템
3. **キャラクター機能** - 캐릭터 관리
4. **チャット機能** - 채팅 기능
5. **通知機能** - 알림 시스템
6. **ソーシャル機能** - 소셜 기능 (팔로우, 좋아요, 댓글)
7. **その他機能** - 기타 기능 (랭킹, 검색, 페르소나)

## 🔐 보안 주의사항

- **비밀번호를 환경 변수로 관리**: `.env.local` 파일 사용 또는 CI/CD 시크릿 사용
- **결과 파일 보안**: 테스트 결과 파일에 민감한 정보가 포함될 수 있으므로 주의
- **프로덕션 환경**: 프로덕션 환경에서는 테스트 계정만 사용

## 📚 추가 리소스

- 웹 UI 테스트 도구: `/admin/test`
- 테스트 비교 문서: `TEST_TOOL_COMPARISON.md`




