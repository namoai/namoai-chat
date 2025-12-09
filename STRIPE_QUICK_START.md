# 🚀 Stripe 결제 시스템 빠른 시작 가이드

## 소스 코드 구축 완료 ✅

다음 파일들이 생성/수정되었습니다:

### 생성된 파일
- `src/app/api/stripe/create-checkout-session/route.ts` - 결제 세션 생성 API
- `src/app/api/stripe/webhook/route.ts` - Stripe 웹훅 처리 API
- `src/app/payment/success/page.tsx` - 결제 성공 페이지
- `src/app/payment/cancel/page.tsx` - 결제 취소 페이지
- `STRIPE_PAYMENT_SETUP_GUIDE.md` - 상세 설정 가이드
- `STRIPE_SETUP_CHECKLIST.md` - 작업 체크리스트

### 수정된 파일
- `prisma/schema.prisma` - `payments` 모델 추가
- `src/app/points/page.tsx` - Stripe 결제 연동
- `package.json` - `stripe`, `@stripe/stripe-js` 패키지 추가

---

## 🎯 지금 해야 할 일 (3단계)

### 1️⃣ Stripe 계정 설정 (5분)

1. https://dashboard.stripe.com/register 방문
2. 계정 생성 (테스트 모드)
3. Developers → API keys에서 **Secret key** 복사 (`sk_test_...`)

### 2️⃣ 환경 변수 설정 (2분)

`.env.local` 파일 생성/수정:

```bash
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_placeholder  # 3단계에서 실제 값으로 교체
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3️⃣ 데이터베이스 마이그레이션 (1분)

```bash
npm run db:generate
npm run db:migrate
```

---

## 🧪 테스트 방법

### 1. Stripe CLI 설치 및 실행

```bash
# Stripe CLI 설치 (Windows)
# https://stripe.com/docs/stripe-cli

# 로그인
stripe login

# 웹훅 포워딩 (별도 터미널)
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

출력된 `whsec_...` 값을 `.env.local`의 `STRIPE_WEBHOOK_SECRET`에 설정하세요.

### 2. 개발 서버 시작

```bash
npm run dev
```

### 3. 브라우저에서 테스트

1. http://localhost:3000/points 접속
2. 포인트 패키지 선택
3. 결제 버튼 클릭
4. 테스트 카드 입력:
   - 카드: `4242 4242 4242 4242`
   - 유효기간: `12/25`
   - CVC: `123`
   - 우편번호: `12345`

---

## 📚 상세 가이드

- **전체 설정 가이드**: `STRIPE_PAYMENT_SETUP_GUIDE.md`
- **작업 체크리스트**: `STRIPE_SETUP_CHECKLIST.md`

---

## ⚠️ 중요 사항

1. **테스트 모드**: 개발 중에는 반드시 테스트 모드 사용
2. **Webhook Secret**: 로컬과 프로덕션은 다른 secret 사용
3. **환경 변수**: `.env.local`은 Git에 커밋하지 마세요

---

## 🆘 문제 발생 시

자세한 문제 해결 방법은 `STRIPE_PAYMENT_SETUP_GUIDE.md`의 "문제 해결" 섹션을 참조하세요.

---

**준비 완료!** 위 3단계만 완료하면 바로 테스트할 수 있습니다. 🎉







