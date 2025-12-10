# ✅ Stripe 결제 시스템 설정 체크리스트

이 문서는 Stripe 결제 시스템을 테스트하기 위해 **사용자가 직접 수행해야 할 작업**을 정리한 것입니다.

---

## 📋 작업 순서

### 1단계: Stripe 계정 설정

- [ ] **Stripe 계정 생성**
  - https://dashboard.stripe.com/register 방문
  - 계정 생성 (테스트 모드로 시작)

- [ ] **API 키 확인**
  - Stripe 대시보드 → Developers → API keys
  - **Secret key** (테스트 모드) 복사
  - 형식: `sk_test_...`

---

### 2단계: 환경 변수 설정

#### 로컬 개발 환경

- [ ] **`.env.local` 파일 생성/수정**
  ```bash
  STRIPE_SECRET_KEY=sk_test_your_test_secret_key
  STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
  NEXT_PUBLIC_APP_URL=http://localhost:3000
  ```
  
  ⚠️ **중요**: `STRIPE_WEBHOOK_SECRET`은 3단계에서 얻을 수 있습니다.

#### 프로덕션 환경 (Netlify)

- [ ] **Netlify 환경 변수 설정**
  - Netlify 대시보드 → Site settings → Environment variables
  - 다음 변수 추가:
    - `STRIPE_SECRET_KEY`
    - `STRIPE_WEBHOOK_SECRET`
    - `NEXT_PUBLIC_APP_URL`

---

### 3단계: 데이터베이스 마이그레이션

- [ ] **Prisma 클라이언트 생성**
  ```bash
  npm run db:generate
  ```

- [ ] **데이터베이스 마이그레이션 실행**
  ```bash
  npm run db:migrate
  ```
  
  또는 수동으로:
  ```bash
  npx prisma migrate dev --name add_payments_model
  ```

- [ ] **마이그레이션 확인**
  ```bash
  npm run db:studio
  ```
  - `payments` 테이블이 생성되었는지 확인

---

### 4단계: Stripe CLI 설정 (로컬 테스트용)

- [ ] **Stripe CLI 설치**
  - Windows: https://stripe.com/docs/stripe-cli
  - 또는: `scoop install stripe` (PowerShell)

- [ ] **Stripe CLI 로그인**
  ```bash
  stripe login
  ```

- [ ] **로컬 웹훅 포워딩 시작** (별도 터미널)
  ```bash
  stripe listen --forward-to localhost:3000/api/stripe/webhook
  ```
  
  ⚠️ **중요**: 이 명령어를 실행하면 `whsec_...` 형식의 webhook secret이 출력됩니다.
  이 값을 `.env.local`의 `STRIPE_WEBHOOK_SECRET`에 설정하세요.

---

### 5단계: 로컬 테스트

- [ ] **개발 서버 시작**
  ```bash
  npm run dev
  ```

- [ ] **Stripe CLI 실행 중 확인**
  - 4단계의 `stripe listen` 명령어가 실행 중이어야 합니다.

- [ ] **브라우저에서 테스트**
  1. http://localhost:3000/points 접속
  2. 로그인 (필요시)
  3. 포인트 패키지 선택 및 결제 버튼 클릭
  4. Stripe Checkout 페이지에서 테스트 카드 입력:
     - 카드 번호: `4242 4242 4242 4242`
     - 유효기간: 미래 날짜 (예: 12/25)
     - CVC: 임의 3자리 (예: 123)
     - 우편번호: 임의 5자리 (예: 12345)
  5. 결제 완료 후 성공 페이지 확인

- [ ] **결제 확인**
  - Stripe 대시보드 → Payments에서 결제 확인
  - 포인트 페이지에서 포인트 추가 확인

---

### 6단계: 프로덕션 Webhook 설정 (배포 후)

- [ ] **Netlify 배포 완료 확인**
  - 배포 URL 확인 (예: `https://your-app.netlify.app`)

- [ ] **Stripe 대시보드에서 Webhook 추가**
  1. Developers → Webhooks → Add endpoint
  2. Endpoint URL: `https://your-app.netlify.app/api/stripe/webhook`
  3. Events to send 선택:
     - `checkout.session.completed`
     - `checkout.session.async_payment_failed`
  4. Add endpoint 클릭

- [ ] **Webhook Secret 복사**
  - Webhook 추가 후 "Signing secret" 표시
  - `whsec_...` 값을 복사
  - Netlify 환경 변수 `STRIPE_WEBHOOK_SECRET`에 설정

- [ ] **프로덕션 환경 변수 업데이트**
  ```bash
  NEXT_PUBLIC_APP_URL=https://your-app.netlify.app
  STRIPE_SECRET_KEY=sk_live_...  # Live 모드 키 (테스트 완료 후)
  STRIPE_WEBHOOK_SECRET=whsec_...  # 프로덕션 Webhook secret
  ```

---

### 7단계: 프로덕션 테스트 (선택사항)

- [ ] **Live 모드 전환** (테스트 완료 후)
  - Stripe 대시보드 우측 상단: "Test mode" → "Live mode"
  - Live API 키 발급 및 환경 변수 업데이트

- [ ] **프로덕션에서 실제 결제 테스트**
  - 실제 카드로 소액 결제 테스트
  - 결제 완료 및 포인트 추가 확인

---

## ⚠️ 주의사항

1. **테스트 모드와 Live 모드**
   - 개발 중에는 반드시 **테스트 모드**를 사용하세요.
   - Live 모드로 전환하기 전에 충분히 테스트하세요.

2. **Webhook Secret**
   - 로컬 테스트용과 프로덕션용 Webhook secret이 다릅니다.
   - 각각 올바른 환경에 설정해야 합니다.

3. **환경 변수 보안**
   - `.env.local` 파일은 절대 Git에 커밋하지 마세요.
   - 프로덕션 환경 변수는 Netlify 대시보드에서만 관리하세요.

4. **데이터베이스 백업**
   - 마이그레이션 실행 전 데이터베이스 백업 권장

---

## 🆘 문제 발생 시

1. **"STRIPE_SECRET_KEY 환경 변수가 설정되지 않았습니다"**
   - 환경 변수가 올바르게 설정되었는지 확인
   - 서버 재시작

2. **"Webhook signature 검증 실패"**
   - `STRIPE_WEBHOOK_SECRET`이 올바른지 확인
   - 로컬: Stripe CLI의 webhook secret 사용
   - 프로덕션: 대시보드의 webhook secret 사용

3. **결제는 완료되었지만 포인트가 추가되지 않음**
   - Stripe 대시보드 → Webhooks → 로그 확인
   - 서버 로그 확인
   - 데이터베이스 `payments` 테이블 확인

자세한 문제 해결 방법은 `STRIPE_PAYMENT_SETUP_GUIDE.md`를 참조하세요.

---

## ✅ 완료 확인

모든 작업을 완료했다면:

- [ ] 로컬에서 테스트 결제 성공
- [ ] 포인트가 정상적으로 추가됨
- [ ] 프로덕션 Webhook 설정 완료
- [ ] 프로덕션 환경 변수 설정 완료

---

**작성일**: 2025-01-27









