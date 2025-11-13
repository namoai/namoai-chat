# 🔞 성인 콘텐츠 결제 시스템 가이드 (Adult Content Payment Solutions)

> **프로젝트**: NAMOS Chat v1  
> **작성일**: 2025-01-27  
> **⚠️ 중요**: AI 캐릭터 + 언세이프 콘텐츠에 대한 결제 시스템 조사

---

## ❌ 1. PayPal / PayPay 사용 불가 확인

### ✅ **결론: 사용 불가능합니다**

#### PayPal 정책
- **금지 콘텐츠**: 성인 콘텐츠, 성적 콘텐츠, AI 생성 성인 콘텐츠
- **위반 시**: 계정 동결, 자금 보류, 영구 정지
- **관련 조항**: PayPal Acceptable Use Policy
  - "Adult content, services, or products" 명시적 금지
  - "Sexually oriented materials or services" 금지

#### PayPay 정책
- **금지 콘텐츠**: 성인 콘텐츠, 부적절한 콘텐츠
- **일본 법규 준수**: 일본 법률상 성인 콘텐츠 규제 엄격 적용
- **심사 기준**: 웹사이트 내용 검토 시 언세이프 콘텐츠 발견 시 즉시 거부

#### Stripe 정책
- **제한적 허용**: 일부 성인 콘텐츠 허용하나 조건 엄격
- **금지**: "Certain sexually oriented materials or services"
- **AI 생성 콘텐츠**: 명확한 가이드라인 없으나 심사 과정에서 거부 가능성 높음
- **계정 정지 리스크**: 높음

---

## ✅ 2. 대안 결제 시스템 (일본 엔화 대응)

### 2.1 성인 콘텐츠 전문 결제 프로세서

#### 🔥 **CCBill** (최고 추천)

**개요:**
- 성인 콘텐츠 전문 결제 프로세서 (1998년 설립)
- 전 세계 성인 콘텐츠 사이트의 70% 이상 사용
- AI 캐릭터, 성인 게임, 디지털 콘텐츠 전문

**장점:**
- ✅ 성인 콘텐츠 명시적 허용
- ✅ AI 생성 콘텐츠 허용
- ✅ 일본 엔화(JPY) 지원
- ✅ 신용카드, 직불카드, ACH 지원
- ✅ 구독 및 일회성 결제 모두 지원
- ✅ 사기 방지 시스템 내장
- ✅ 분쟁 처리 전문 팀

**단점:**
- ❌ 높은 수수료: 10.5% - 14.5% + $0.30/거래
- ❌ 초기 설정 비용: $500 - $1,000
- ❌ 월간 최소 수수료: $100/월
- ❌ 엄격한 심사 절차 (1-2주)

**수수료:**
```
- Transaction Fee: 10.5% - 14.5% (거래량에 따라)
- Per Transaction: $0.30
- Setup Fee: $500 - $1,000 (일회성)
- Monthly Minimum: $100
- Chargeback Fee: $35/건
```

**신청 절차:**
1. CCBill 웹사이트 가입 (https://www.ccbill.com/)
2. 신청서 제출:
   - 사업자등록증 또는 법인 서류
   - 대표자 신분증
   - 은행 계좌 정보
   - 웹사이트 URL 및 콘텐츠 샘플
3. 콘텐츠 심사 (1-2주)
4. 승인 후 통합 진행

**연락처:**
- 웹사이트: https://www.ccbill.com/
- 이메일: merchantsupport@ccbill.com
- 전화: +1-888-596-9279

---

#### **Segpay**

**개요:**
- 성인 콘텐츠 및 고위험 산업 전문 (2005년 설립)
- CCBill의 주요 경쟁사
- 유럽 시장에 강점

**장점:**
- ✅ 성인 콘텐츠 명시적 허용
- ✅ 일본 엔화(JPY) 지원
- ✅ 60개 이상 통화 지원
- ✅ 다양한 결제 수단
- ✅ CCBill보다 저렴한 수수료

**단점:**
- ❌ CCBill보다 아시아 시장 지원 약함
- ❌ 높은 수수료: 9.5% - 12.5% + $0.35/거래
- ❌ 초기 설정 비용 및 월 최소 수수료

**수수료:**
```
- Transaction Fee: 9.5% - 12.5%
- Per Transaction: $0.35
- Setup Fee: $250 - $500
- Monthly Minimum: $50 - $100
- Chargeback Fee: $25/건
```

**연락처:**
- 웹사이트: https://www.segpay.com/
- 이메일: sales@segpay.com

---

#### **Paxum**

**개요:**
- 성인 콘텐츠 업계를 위한 전자 지갑 서비스
- 직접 결제 및 계좌 간 송금 지원

**장점:**
- ✅ 성인 콘텐츠 허용
- ✅ 낮은 수수료
- ✅ 빠른 출금
- ✅ 익명성 보장

**단점:**
- ❌ 일본 시장 지원 제한적
- ❌ 사용자가 Paxum 계정 필요 (마찰 증가)
- ❌ 인지도 낮음

**수수료:**
```
- Transaction Fee: 2.9% - 5.9%
- Withdrawal Fee: $2 - $25 (방법에 따라)
```

---

### 2.2 일본 전용 솔루션

#### 🇯🇵 **BitCash** (추천)

**개요:**
- 일본의 선불 전자화폐 (프리페이드 결제)
- 일본 편의점에서 구매 가능
- 익명성 보장

**장점:**
- ✅ 일본 내 높은 인지도
- ✅ 성인 콘텐츠 사이트에서 널리 사용
- ✅ 편의점에서 구매 가능
- ✅ 신용카드 불필요
- ✅ 미성년자 차단 가능

**단점:**
- ❌ 일본 전용 (해외 사용 불가)
- ❌ 통합 복잡도 높음
- ❌ 수수료: 약 10-15%

**사용 예시:**
- DLSite (동인지 판매)
- DMM/FANZA (성인 콘텐츠)
- Ci-en (크리에이터 후원)

**신청:**
- 웹사이트: https://www.bitcash.co.jp/
- 가맹점 신청 필요 (일본 법인 필수)

---

#### 🇯🇵 **C-CHECK**

**개요:**
- 일본의 선불 전자화폐
- BitCash와 유사한 시스템

**장점:**
- ✅ 일본 내 인지도
- ✅ 편의점 구매 가능
- ✅ 익명성

**단점:**
- ❌ BitCash보다 가맹점 적음
- ❌ 일본 법인 필수

---

#### 🇯🇵 **WebMoney Japan**

**개요:**
- 일본의 대표적인 선불 전자화폐
- 게임, 디지털 콘텐츠에 널리 사용

**장점:**
- ✅ 높은 인지도
- ✅ 편의점 구매 가능
- ✅ 다양한 액면가

**단점:**
- ❌ 성인 콘텐츠 정책 불명확
- ❌ 심사 엄격

---

### 2.3 암호화폐 결제

#### 💰 **암호화폐 통합 (강력 추천)**

**장점:**
- ✅ 콘텐츠 제한 없음
- ✅ 낮은 수수료 (1-3%)
- ✅ 국제 결제 가능
- ✅ 익명성 보장
- ✅ 계정 정지 위험 없음

**단점:**
- ❌ 변동성 높음
- ❌ 사용자 진입 장벽
- ❌ 일본 엔화 직접 결제 불가 (변환 필요)
- ❌ 세금 처리 복잡

**추천 암호화폐 게이트웨이:**

##### **1. BTCPay Server** (최고 추천 - 오픈소스)
- 완전 무료 (자체 호스팅)
- Bitcoin, Lightning Network, Altcoins 지원
- 제3자 의존 없음
- 웹사이트: https://btcpayserver.org/

**장점:**
- ✅ 수수료 0% (블록체인 수수료만)
- ✅ 완전한 통제권
- ✅ 개인정보 보호
- ✅ 플러그인 및 API 풍부

**단점:**
- ❌ 자체 서버 필요 (Netlify에서 불가능, 별도 VPS 필요)
- ❌ 기술적 설정 필요

**설정:**
```bash
# Docker로 BTCPay Server 설치
git clone https://github.com/btcpayserver/btcpayserver-docker
cd btcpayserver-docker
./btcpay-setup.sh -i

# 환경 변수 설정
export BTCPAY_HOST="pay.namos-chat.com"
export BTCPAYGEN_CRYPTO1="btc"
export BTCPAYGEN_CRYPTO2="ltc"
```

##### **2. CoinGate**
- 호스팅 솔루션 (BTCPay보다 간편)
- 70+ 암호화폐 지원
- 자동 JPY/USD 변환 가능

**수수료:**
- 1% (거래당)
- 출금 무료

**웹사이트:** https://coingate.com/

##### **3. NOWPayments**
- 100+ 암호화폐 지원
- 간편한 API 통합
- KYC 불필요 (일정 금액까지)

**수수료:**
- 0.5% - 0.75% (거래당)
- 출금 수수료 별도

**웹사이트:** https://nowpayments.io/

##### **4. CoinPayments**
- 오래된 서비스 (2013년 설립)
- 다양한 코인 지원
- 자동 변환 기능

**수수료:**
- 0.5% (거래당)

**웹사이트:** https://www.coinpayments.net/

---

### 2.4 하이브리드 솔루션 (추천)

**전략: 다중 결제 수단 제공**

```
1차 결제: 암호화폐 (BTC, ETH, USDT) - CoinGate 또는 BTCPay Server
   ↓ (수수료 최저, 제한 없음)

2차 결제: CCBill (신용카드)
   ↓ (일반 사용자, 높은 수수료)

3차 결제: BitCash (일본 전용)
   ↓ (일본 사용자, 익명성)

4차 결제: 포인트 코드 직접 판매 (이메일/SNS)
   ↓ (최종 수단, 수동 처리)
```

---

## 💼 3. 추천 결제 시스템 비교표

| 결제 시스템 | 성인 콘텐츠 | JPY 지원 | 수수료 | 초기 비용 | 일본 법인 | 난이도 | 추천도 |
|------------|-----------|---------|--------|----------|----------|--------|-------|
| **PayPal** | ❌ 불가 | ✅ | 3.6% | 무료 | ❌ | ⭐ | ❌ |
| **PayPay** | ❌ 불가 | ✅ | 3.24% | 무료 | ✅ 필수 | ⭐ | ❌ |
| **Stripe** | ⚠️ 제한적 | ✅ | 2.9% | 무료 | ❌ | ⭐ | ⚠️ |
| **CCBill** | ✅ 허용 | ✅ | 10-14% | $500 | ❌ | ⭐⭐⭐ | 🔥 |
| **Segpay** | ✅ 허용 | ✅ | 9-12% | $250 | ❌ | ⭐⭐⭐ | ✅ |
| **BitCash** | ✅ 허용 | ✅ | 10-15% | 변동 | ✅ 필수 | ⭐⭐⭐⭐ | ✅ |
| **암호화폐 (CoinGate)** | ✅ 제한없음 | ⚠️ 변환 | 1% | 무료 | ❌ | ⭐⭐ | 🔥 |
| **암호화폐 (BTCPay)** | ✅ 제한없음 | ⚠️ 변환 | 0% | 무료 | ❌ | ⭐⭐⭐⭐⭐ | 🔥 |

---

## 🚀 4. 실전 추천 전략

### 전략 A: 최소 비용 시작 (스타트업)

```
1. 암호화폐 (CoinGate) - 메인 결제
   - 수수료 1%, 초기 비용 0
   - 전 세계 사용 가능
   
2. 포인트 코드 직접 판매 - 보조 결제
   - 이메일/디스코드로 수동 처리
   - 수수료 0%

예상 비용: $0 - $50/월
```

### 전략 B: 표준 운영 (중소 규모)

```
1. 암호화폐 (CoinGate 또는 BTCPay) - 30%
   - 메인 결제 수단
   
2. CCBill - 50%
   - 신용카드 사용자용
   - 수수료 높지만 안정적
   
3. BitCash - 20% (일본 법인 있는 경우)
   - 일본 사용자 전용

예상 비용: $600 - $1,500/월 (CCBill 최소 비용 포함)
```

### 전략 C: 최대 수익 최적화 (대규모)

```
1. 암호화폐 (BTCPay Server) - 40%
   - 자체 호스팅, 수수료 0%
   
2. CCBill + Segpay - 40%
   - 지역별 분산 (리스크 감소)
   
3. BitCash + WebMoney - 20%
   - 일본 시장 공략

예상 비용: $1,000 - $3,000/월
```

---

## ⚠️ 5. 법적 고려사항

### 5.1 일본 법률

#### 성표현규제법 (わいせつ物頒布等の罪)
- **규제 대상**: 음란물의 제작, 판매, 배포
- **AI 생성 콘텐츠**: 법적 해석 불명확 (2025년 기준)
- **주의**: "모자이크 처리"나 "성기 미표시" 등의 조치 필요

#### 아동보호법
- **18세 미만 캐릭터**: 절대 금지
- **AI 생성도 동일 적용**: 실존 여부 무관
- **위반 시**: 형사 처벌

#### 특정상거래법
- **필수 표기사항**:
  - 사업자 명칭 및 대표자
  - 소재지
  - 연락처
  - 환불 및 교환 정책

### 5.2 연령 확인 시스템 필수

**구현 방안:**
```typescript
// 연령 확인 미들웨어 (예시)
export function ageVerification(request: Request) {
  // 1. 쿠키로 확인 여부 체크
  const ageVerified = getCookie('age_verified');
  
  // 2. 미확인 시 연령 확인 페이지로 리다이렉트
  if (!ageVerified) {
    return redirect('/age-verification');
  }
  
  // 3. 언세이프 콘텐츠 접근 로그 기록
  logAccess(request.user.id, request.url);
}
```

**권장 사항:**
- ✅ 생년월일 입력 + 체크박스 동의
- ✅ 신용카드 인증 (일본에서 선호)
- ✅ 휴대폰 본인 인증 (한국에서 선호)

### 5.3 이용약관 필수 조항

```markdown
# 성인 콘텐츠 이용약관

1. 연령 제한
   - 본 서비스는 만 18세 이상만 이용 가능합니다.
   - 허위 정보 제공 시 서비스 이용이 제한됩니다.

2. 콘텐츠 성격
   - 본 서비스는 성인용 AI 캐릭터 대화 콘텐츠를 포함합니다.
   - 모든 캐릭터는 가상이며 실존 인물과 무관합니다.

3. 금지 사항
   - 불법 콘텐츠 요청
   - 미성년자 관련 콘텐츠
   - 타인에게 피해를 주는 행위

4. 면책 사항
   - AI 생성 콘텐츠의 정확성 보장 불가
   - 사용자의 서비스 이용으로 인한 문제는 사용자 책임
```

---

## 🛠️ 6. 기술 통합 가이드

### 6.1 CCBill 통합 예시

```typescript
// src/lib/payments/ccbill.ts
import crypto from 'crypto';

interface CCBillConfig {
  clientAccnum: string;
  clientSubacc: string;
  formName: string;
  salt: string;
}

export function generateCCBillPaymentUrl(
  config: CCBillConfig,
  amount: number,
  currency: string = 'JPY',
  userId: string
) {
  const initialPrice = amount.toFixed(2);
  const initialPeriod = '30'; // 구독 기간 (일)
  
  // Digest 생성 (보안)
  const digestString = `${initialPrice}${initialPeriod}${currency}${config.salt}`;
  const digest = crypto.createHash('md5').update(digestString).digest('hex');
  
  // URL 생성
  const baseUrl = 'https://api.ccbill.com/wap-frontflex/flexforms';
  const params = new URLSearchParams({
    clientAccnum: config.clientAccnum,
    clientSubacc: config.clientSubacc,
    formName: config.formName,
    formDigest: digest,
    initialPrice: initialPrice,
    initialPeriod: initialPeriod,
    currencyCode: currency,
    // Custom fields
    customer_fname: 'User',
    customer_lname: userId,
    // Success/Failure URLs
    redirectUrl: `https://namos-chat.com/payment/success`,
    declineUrl: `https://namos-chat.com/payment/failed`,
  });
  
  return `${baseUrl}/${config.formName}?${params.toString()}`;
}

// Webhook 처리
export function verifyCCBillWebhook(
  payload: any,
  signature: string,
  secret: string
): boolean {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return hash === signature;
}
```

### 6.2 암호화폐 (CoinGate) 통합 예시

```typescript
// src/lib/payments/coingate.ts
import axios from 'axios';

interface CoinGateConfig {
  apiKey: string;
  environment: 'sandbox' | 'live';
}

export async function createCoinGatePayment(
  config: CoinGateConfig,
  amount: number,
  currency: string = 'JPY',
  orderId: string
) {
  const baseUrl = config.environment === 'sandbox'
    ? 'https://api-sandbox.coingate.com/v2'
    : 'https://api.coingate.com/v2';
  
  const response = await axios.post(
    `${baseUrl}/orders`,
    {
      order_id: orderId,
      price_amount: amount,
      price_currency: currency,
      receive_currency: currency, // 받을 화폐
      title: 'NAMOS Chat Points',
      description: `Purchase ${amount} points`,
      callback_url: 'https://namos-chat.com/api/payments/coingate/webhook',
      success_url: 'https://namos-chat.com/payment/success',
      cancel_url: 'https://namos-chat.com/payment/cancel',
    },
    {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    }
  );
  
  return {
    paymentUrl: response.data.payment_url,
    orderId: response.data.id,
  };
}
```

### 6.3 BitCash 통합 예시

```typescript
// src/lib/payments/bitcash.ts
// BitCash는 서버 간 API 통합이 필요함

interface BitCashConfig {
  merchantId: string;
  secretKey: string;
}

export function generateBitCashPaymentForm(
  config: BitCashConfig,
  amount: number,
  orderId: string
) {
  // BitCash는 HTML 폼 제출 방식
  const checksum = generateChecksum(
    config.merchantId,
    orderId,
    amount.toString(),
    config.secretKey
  );
  
  return `
    <form action="https://www.bitcash.co.jp/settlement" method="POST">
      <input type="hidden" name="merchant_id" value="${config.merchantId}">
      <input type="hidden" name="order_id" value="${orderId}">
      <input type="hidden" name="amount" value="${amount}">
      <input type="hidden" name="checksum" value="${checksum}">
      <input type="hidden" name="return_url" value="https://namos-chat.com/payment/success">
      <input type="hidden" name="cancel_url" value="https://namos-chat.com/payment/cancel">
      <button type="submit">BitCashで支払う</button>
    </form>
  `;
}

function generateChecksum(
  merchantId: string,
  orderId: string,
  amount: string,
  secret: string
): string {
  const data = `${merchantId}${orderId}${amount}${secret}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}
```

---

## 📊 7. 예상 비용 분석

### 사용자 1,000명 기준 (월간)

#### 시나리오 A: CCBill만 사용
```
- 평균 결제: $10
- 월 거래: 500건
- 총 매출: $5,000
- CCBill 수수료 (12%): $600
- 월 최소 수수료: $100
- 실제 수수료: $600
- 순수익: $4,400 (88%)
```

#### 시나리오 B: 암호화폐(CoinGate)만 사용
```
- 평균 결제: $10
- 월 거래: 300건 (전환율 60%)
- 총 매출: $3,000
- CoinGate 수수료 (1%): $30
- 실제 수수료: $30
- 순수익: $2,970 (99%)
```

#### 시나리오 C: 하이브리드 (추천)
```
- 암호화폐: 200건 × $10 = $2,000 (수수료 1% = $20)
- CCBill: 300건 × $10 = $3,000 (수수료 12% = $360)
- 총 매출: $5,000
- 총 수수료: $380
- 순수익: $4,620 (92.4%)
```

---

## ✅ 8. 최종 추천

### 🔥 최고 추천 조합 (일본 법인 없음)

```
1. 메인 결제: CoinGate (암호화폐)
   - 초기 비용: $0
   - 수수료: 1%
   - 즉시 시작 가능
   
2. 보조 결제: CCBill (신용카드)
   - 초기 비용: $500
   - 수수료: 10-14%
   - 승인 1-2주 소요
   
3. 긴급 대안: 포인트 코드 수동 판매
   - Discord/Email로 판매
   - 수동 처리
```

### 📋 구현 우선순위

**Phase 1: 즉시 시작 (1주)**
- [ ] CoinGate 계정 생성
- [ ] 암호화폐 결제 페이지 구현
- [ ] 포인트 자동 지급 시스템

**Phase 2: 신용카드 추가 (2-3주)**
- [ ] CCBill 신청 및 심사
- [ ] CCBill 결제 통합
- [ ] 웹훅 처리 구현

**Phase 3: 일본 시장 강화 (1-2개월)**
- [ ] 일본 법인 설립 검토
- [ ] BitCash 가맹점 신청
- [ ] 일본어 결제 페이지

---

## 📞 문의 및 지원

### CCBill
- 웹사이트: https://www.ccbill.com/
- 이메일: merchantsupport@ccbill.com
- 전화: +1-888-596-9279

### CoinGate
- 웹사이트: https://coingate.com/
- 이메일: support@coingate.com

### 법률 자문 (일본)
- 디지털 콘텐츠 전문 변호사 상담 필수
- 성인 콘텐츠 규제 확인
- 결제 시스템 법적 준수 검토

---

**작성일**: 2025-01-27  
**최종 업데이트**: 2025-01-27  
**문서 버전**: 1.0

**⚠️ 주의사항**: 
이 문서는 정보 제공 목적이며, 법적 자문을 대체하지 않습니다.
실제 서비스 런칭 전 반드시 법률 전문가와 상담하시기 바랍니다.

