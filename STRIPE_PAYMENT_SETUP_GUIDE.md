# 💳 Stripe 결제 시스템 설정 가이드

> **프로젝트**: NAMOS Chat v1  
> **작성일**: 2025-01-27  
> **목적**: Stripe 결제 시스템 통합 및 테스트 가이드

---

## 📋 목차

1. [환경 변수 설정](#1-환경-변수-설정)
2. [데이터베이스 마이그레이션](#2-데이터베이스-마이그레이션)
3. [Stripe 대시보드 설정](#3-stripe-대시보드-설정)
4. [로컬 테스트 방법](#4-로컬-테스트-방법)
5. [프로덕션 배포](#5-프로덕션-배포)
6. [문제 해결](#6-문제-해결)

---

## 1. 환경 변수 설정

### 1.1 필요한 환경 변수

다음 환경 변수를 설정해야 합니다:

```bash
# Stripe API 키 (필수)
STRIPE_SECRET_KEY=sk_test_...  # 테스트 모드
# 또는
STRIPE_SECRET_KEY=sk_live_...  # 프로덕션 모드

# Stripe Webhook Secret (필수)
STRIPE_WEBHOOK_SECRET=whsec_...

# 앱 URL (필수)
NEXT_PUBLIC_APP_URL=https://your-domain.com  # 프로덕션
# 또는
NEXT_PUBLIC_APP_URL=http://localhost:3000  # 로컬 개발
```

### 1.2 환경 변수 설정 방법

#### 로컬 개발 환경

1. 프로젝트 루트에 `.env.local` 파일 생성 (또는 기존 파일에 추가):

```bash
# .env.local
STRIPE_SECRET_KEY=sk_test_your_test_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

#### Netlify 배포 환경

1. Netlify 대시보드 → Site settings → Environment variables
2. 다음 변수 추가:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `NEXT_PUBLIC_APP_URL`

#### Google Secret Manager (선택사항)

로컬 개발 시 Secret Manager 사용:

```bash
# secrets/runtime.json (로컬 개발용)
{
  "STRIPE_SECRET_KEY": "sk_test_...",
  "STRIPE_WEBHOOK_SECRET": "whsec_...",
  "NEXT_PUBLIC_APP_URL": "http://localhost:3000"
}
```

---

## 2. 데이터베이스 마이그레이션

### 2.1 Prisma 마이그레이션 실행

새로운 `payments` 모델이 추가되었으므로 마이그레이션을 실행해야 합니다:

```bash
# Prisma 클라이언트 생성
npm run db:generate

# 마이그레이션 실행
npm run db:migrate
```

또는 수동으로:

```bash
npx prisma generate
npx prisma migrate dev --name add_payments_model
```

### 2.2 마이그레이션 확인

마이그레이션이 성공적으로 완료되었는지 확인:

```bash
# Prisma Studio로 데이터베이스 확인
npm run db:studio
```

`payments` 테이블이 생성되었는지 확인하세요.

---

## 3. Stripe 대시보드 설정

### 3.1 Stripe 계정 생성 및 API 키 발급

1. **Stripe 계정 생성**
   - https://dashboard.stripe.com/register 방문
   - 계정 생성 (테스트 모드로 시작)

2. **API 키 확인**
   - 대시보드 → Developers → API keys
   - **Publishable key** (클라이언트용, 현재는 사용 안 함)
   - **Secret key** (서버용) → `STRIPE_SECRET_KEY`에 설정

### 3.2 Webhook 엔드포인트 설정

#### 로컬 개발 (Stripe CLI 사용)

1. **Stripe CLI 설치**
   ```bash
   # Windows (PowerShell)
   scoop install stripe
   
   # 또는 직접 다운로드
   # https://stripe.com/docs/stripe-cli
   ```

2. **Stripe CLI 로그인**
   ```bash
   stripe login
   ```

3. **로컬 웹훅 포워딩**
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   
   이 명령어를 실행하면 `whsec_...` 형식의 webhook secret이 출력됩니다.
   이 값을 `STRIPE_WEBHOOK_SECRET`에 설정하세요.

#### 프로덕션 배포

1. **Netlify 배포 후 URL 확인**
   - 예: `https://your-app.netlify.app`

2. **Stripe 대시보드에서 Webhook 추가**
   - Developers → Webhooks → Add endpoint
   - Endpoint URL: `https://your-app.netlify.app/api/stripe/webhook`
   - Events to send:
     - `checkout.session.completed`
     - `checkout.session.async_payment_failed`

3. **Webhook Secret 복사**
   - Webhook 추가 후 "Signing secret" 표시
   - `whsec_...` 값을 복사하여 `STRIPE_WEBHOOK_SECRET`에 설정

---

## 4. 로컬 테스트 방법

### 4.1 테스트 카드 번호

Stripe 테스트 모드에서는 다음 카드 번호를 사용할 수 있습니다:

| 카드 번호 | 결과 |
|---------|------|
| `4242 4242 4242 4242` | 성공 |
| `4000 0000 0000 0002` | 카드 거부 |
| `4000 0000 0000 9995` | 자금 부족 |

**기타 정보:**
- 유효기간: 미래 날짜 (예: 12/25)
- CVC: 임의의 3자리 숫자 (예: 123)
- 우편번호: 임의의 5자리 숫자 (예: 12345)

### 4.2 테스트 절차

1. **개발 서버 시작**
   ```bash
   npm run dev
   ```

2. **Stripe CLI로 웹훅 리스닝** (별도 터미널)
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

3. **브라우저에서 테스트**
   - http://localhost:3000/points 접속
   - 로그인 (필요시)
   - 포인트 패키지 선택 및 결제 버튼 클릭
   - Stripe Checkout 페이지에서 테스트 카드 입력
   - 결제 완료 후 성공 페이지 확인

4. **결제 확인**
   - Stripe 대시보드 → Payments에서 결제 확인
   - 데이터베이스에서 `payments` 테이블 확인
   - 포인트가 정상적으로 추가되었는지 확인

### 4.3 테스트 체크리스트

- [ ] 결제 세션이 정상적으로 생성되는가?
- [ ] Stripe Checkout 페이지가 표시되는가?
- [ ] 테스트 카드로 결제가 완료되는가?
- [ ] 웹훅이 정상적으로 수신되는가?
- [ ] 데이터베이스에 결제 레코드가 생성되는가?
- [ ] 포인트가 정상적으로 추가되는가?
- [ ] 결제 성공 페이지가 표시되는가?
- [ ] 결제 취소 시 취소 페이지가 표시되는가?

---

## 5. 프로덕션 배포

### 5.1 프로덕션 모드 전환

1. **Stripe 대시보드에서 Live 모드 활성화**
   - 대시보드 우측 상단에서 "Test mode" → "Live mode" 전환

2. **Live API 키 발급**
   - Developers → API keys
   - Live mode의 Secret key 복사
   - `STRIPE_SECRET_KEY`에 설정 (프로덕션 환경 변수)

3. **프로덕션 Webhook 설정**
   - 프로덕션 URL로 Webhook 엔드포인트 추가
   - Webhook secret 복사하여 `STRIPE_WEBHOOK_SECRET`에 설정

4. **환경 변수 업데이트**
   ```bash
   # Netlify
   NEXT_PUBLIC_APP_URL=https://your-domain.com
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

### 5.2 배포 후 확인

1. **Webhook 테스트**
   - Stripe 대시보드 → Webhooks → 테스트 이벤트 전송
   - `checkout.session.completed` 이벤트 전송
   - 서버 로그 확인

2. **실제 결제 테스트**
   - 프로덕션 환경에서 실제 카드로 소액 결제 테스트
   - 결제 완료 후 포인트 추가 확인
   - 환불 테스트 (필요시)

---

## 6. 문제 해결

### 6.1 일반적인 오류

#### "STRIPE_SECRET_KEY 환경 변수가 설정되지 않았습니다"

**해결 방법:**
- 환경 변수가 올바르게 설정되었는지 확인
- `.env.local` 파일이 프로젝트 루트에 있는지 확인
- 서버 재시작

#### "Webhook signature 검증 실패"

**해결 방법:**
- `STRIPE_WEBHOOK_SECRET`이 올바른지 확인
- 로컬 테스트 시 Stripe CLI의 webhook secret 사용
- 프로덕션에서는 대시보드의 webhook secret 사용

#### "결제는 완료되었지만 포인트가 추가되지 않음"

**해결 방법:**
- 웹훅이 정상적으로 수신되었는지 확인 (Stripe 대시보드 → Webhooks → 로그)
- 서버 로그 확인
- 데이터베이스에서 `payments` 테이블의 `status` 확인
- 수동으로 포인트 추가 (필요시)

### 6.2 디버깅 팁

1. **서버 로그 확인**
   ```bash
   # 로컬 개발
   npm run dev
   # 콘솔에서 로그 확인
   
   # Netlify
   # Netlify 대시보드 → Functions → Logs
   ```

2. **Stripe 대시보드 확인**
   - Payments: 결제 내역
   - Webhooks: 웹훅 이벤트 로그
   - Events: 모든 이벤트 로그

3. **데이터베이스 확인**
   ```bash
   npm run db:studio
   # payments 테이블 확인
   ```

### 6.3 지원

문제가 지속되면:
1. Stripe 대시보드의 이벤트 로그 확인
2. 서버 로그 확인
3. 데이터베이스 상태 확인
4. GitHub Issues에 문제 보고

---

## 7. 추가 정보

### 7.1 포인트 패키지

현재 설정된 포인트 패키지:

| 포인트 | 금액 (JPY) |
|-------|-----------|
| 100   | ¥1,100    |
| 250   | ¥2,200    |
| 700   | ¥5,500    |
| 1,500 | ¥11,000   |

패키지 변경은 `src/app/api/stripe/create-checkout-session/route.ts`의 `POINT_PACKAGES` 객체를 수정하세요.

### 7.2 환불 처리

환불이 필요한 경우:
1. Stripe 대시보드에서 환불 처리
2. 수동으로 데이터베이스 업데이트:
   ```sql
   UPDATE payments SET status = 'refunded' WHERE stripe_payment_id = '...';
   UPDATE points SET paid_points = paid_points - [환불할 포인트] WHERE user_id = [사용자 ID];
   ```

또는 자동 환불 처리를 위한 웹훅 이벤트 핸들러를 추가할 수 있습니다.

---

## ✅ 체크리스트

### 초기 설정
- [ ] Stripe 계정 생성
- [ ] API 키 발급 및 환경 변수 설정
- [ ] Webhook 엔드포인트 설정
- [ ] 데이터베이스 마이그레이션 실행
- [ ] 환경 변수 확인

### 테스트
- [ ] 로컬 환경에서 테스트 결제 성공
- [ ] 웹훅 수신 확인
- [ ] 포인트 추가 확인
- [ ] 결제 취소 테스트

### 프로덕션
- [ ] Live 모드 API 키 설정
- [ ] 프로덕션 Webhook 설정
- [ ] 프로덕션 환경 변수 확인
- [ ] 실제 결제 테스트

---

**작성일**: 2025-01-27  
**최종 업데이트**: 2025-01-27








