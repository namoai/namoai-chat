# 💳 결제 시스템 통합 가이드 (Payment Integration Guide)

> **프로젝트**: NAMOS Chat v1  
> **작성일**: 2025-01-27  
> **목적**: PayPal 및 PayPay 결제 시스템 통합 가이드

---

## 📋 목차

1. [PayPal 통합 가이드](#1-paypal-통합-가이드)
2. [PayPay 통합 가이드](#2-paypay-통합-가이드)
3. [공통 구현 사항](#3-공통-구현-사항)
4. [테스트 및 검증](#4-테스트-및-검증)

---

## 1. PayPal 통합 가이드

### 1.1 PayPal Business 계정 신청

#### 📝 신청 절차

**Step 1: PayPal Business 계정 생성**

1. **PayPal 웹사이트 방문**
   - URL: https://www.paypal.com/bizsignup
   - 또는: https://www.paypal.com/kr/business (한국)

2. **계정 유형 선택**
   - "비즈니스 계정" 선택
   - "시작하기" 클릭

3. **이메일 주소 입력**
   ```
   비즈니스 이메일: business@namos-chat.com
   ```
   - 회사 전용 이메일 사용 권장
   - 개인 이메일과 분리

4. **비즈니스 정보 입력**
   ```yaml
   비즈니스 유형: 법인 / 개인사업자 / 개인
   비즈니스 이름: NAMOS Chat
   비즈니스 주소: [실제 사업장 주소]
   연락처: [대표 전화번호]
   웹사이트: https://namos-chat.com
   ```

5. **개인 정보 입력**
   ```yaml
   이름: [대표자 이름]
   생년월일: [YYYY-MM-DD]
   주소: [대표자 주소]
   전화번호: [개인 연락처]
   ```

6. **은행 계좌 연결**
   - 은행 이름 선택
   - 계좌번호 입력
   - 예금주 확인
   - **중요**: 소액 입금 확인 필요 (1-3영업일 소요)

7. **신분 확인**
   - 신분증 사진 업로드 (주민등록증, 운전면허증, 여권)
   - 사업자등록증 업로드 (법인/개인사업자)
   - 주소 확인 서류 (공과금 청구서 등)

**Step 2: 비즈니스 확인 (Business Verification)**

PayPal이 제출한 서류를 검토합니다 (통상 1-3영업일).

필요 서류:
- ✅ 사업자등록증 (법인/개인사업자)
- ✅ 대표자 신분증
- ✅ 은행 계좌 확인서
- ✅ 웹사이트 소유권 증명 (도메인 등록 확인서)

**Step 3: 계정 제한 해제**

신규 계정은 다음 제한이 있을 수 있습니다:
- 월 수신 한도: 처음에는 제한적
- 출금 제한: 초기에는 21일 보류 가능

제한 해제 방법:
1. 거래 실적 쌓기 (최소 5-10건의 성공적인 거래)
2. 고객 만족도 유지 (분쟁/환불 최소화)
3. PayPal 고객센터에 제한 해제 요청

---

### 1.2 PayPal Developer 계정 설정 및 API 신청

#### 📝 API 신청 절차

**Step 1: PayPal Developer 포털 접속**

1. **Developer Portal 로그인**
   - URL: https://developer.paypal.com/
   - Business 계정으로 로그인

2. **Dashboard 접속**
   - "Dashboard" 클릭
   - "My Apps & Credentials" 선택

**Step 2: REST API 앱 생성**

1. **새 앱 생성**
   ```
   App Name: NAMOS Chat Payment System
   Sandbox developer account: [자동 생성]
   ```

2. **앱 유형 선택**
   - "Merchant" 선택 (판매자용)
   - "Checkout" 기능 활성화

3. **기능 선택**
   - ✅ Accept payments (결제 수락)
   - ✅ Payouts (지급 - 선택사항)
   - ✅ Subscriptions (구독 - 선택사항)

**Step 3: API Credentials 확인**

앱 생성 후 다음 정보를 확인할 수 있습니다:

```yaml
Sandbox 환경:
  Client ID: [Sandbox Client ID]
  Secret: [Sandbox Secret]

Production 환경 (Live):
  Client ID: [Production Client ID]
  Secret: [Production Secret]
```

**⚠️ 중요**: Secret은 절대 공개하지 마세요! (환경 변수에 저장)

**Step 4: 웹훅(Webhook) 설정**

1. **Webhooks 메뉴 접속**
   - Dashboard → Webhooks 클릭
   - "Add Webhook" 선택

2. **웹훅 URL 설정**
   ```
   Webhook URL: https://namos-chat.com/api/payments/paypal/webhook
   Event types: 다음 이벤트 선택
     - PAYMENT.CAPTURE.COMPLETED (결제 완료)
     - PAYMENT.CAPTURE.DENIED (결제 거부)
     - PAYMENT.CAPTURE.REFUNDED (환불 완료)
     - CUSTOMER.DISPUTE.CREATED (분쟁 생성)
   ```

3. **웹훅 서명 확인**
   ```javascript
   // 웹훅 서명 검증 코드 (보안을 위해 필수)
   const crypto = require('crypto');
   
   function verifyWebhookSignature(headers, body, webhookId) {
     const transmissionId = headers['paypal-transmission-id'];
     const transmissionTime = headers['paypal-transmission-time'];
     const certUrl = headers['paypal-cert-url'];
     const transmissionSig = headers['paypal-transmission-sig'];
     const authAlgo = headers['paypal-auth-algo'];
     
     // PayPal SDK로 검증
     // ...
   }
   ```

**Step 5: Go Live (프로덕션 승인 신청)**

Sandbox 테스트가 완료되면 프로덕션 승인을 신청합니다.

1. **Go Live 신청**
   - Dashboard → App → "Go Live" 버튼 클릭

2. **추가 정보 제공**
   ```yaml
   웹사이트 URL: https://namos-chat.com
   비즈니스 모델: 디지털 콘텐츠 판매 (AI 채팅 포인트)
   예상 월 거래량: [예상 금액]
   예상 평균 거래 금액: $5 - $50
   개인정보 처리방침 URL: https://namos-chat.com/privacy
   환불 정책 URL: https://namos-chat.com/refund
   이용약관 URL: https://namos-chat.com/terms
   ```

3. **PayPal 검토**
   - 통상 1-3영업일 소요
   - 추가 서류 요청 가능
   - 웹사이트 심사 (개인정보 처리방침, 환불 정책 등)

4. **승인 완료**
   - 이메일로 승인 통보
   - Production Credentials 활성화

---

### 1.3 PayPal 신청 시 필요 서류 체크리스트

#### 📋 필수 서류

- [ ] **사업자등록증** (법인/개인사업자)
  - 파일 형식: PDF, JPG, PNG
  - 유효기간 내 서류
  - 명확하게 읽을 수 있어야 함

- [ ] **대표자 신분증**
  - 주민등록증 / 운전면허증 / 여권
  - 앞면 + 뒷면 모두 제출
  - 유효기간 확인

- [ ] **은행 계좌 확인서**
  - 인터넷 뱅킹 스크린샷
  - 계좌번호, 예금주명 확인 가능해야 함

- [ ] **웹사이트 소유권 증명**
  - 도메인 등록 확인서
  - 호스팅 계약서

#### 📋 웹사이트 필수 페이지

- [ ] **개인정보 처리방침 (Privacy Policy)**
  ```
  URL: https://namos-chat.com/privacy
  필수 포함 내용:
    - 수집하는 개인정보
    - 개인정보 이용 목적
    - 개인정보 보관 기간
    - 제3자 제공 (PayPal 등)
  ```

- [ ] **환불 정책 (Refund Policy)**
  ```
  URL: https://namos-chat.com/refund
  필수 포함 내용:
    - 환불 가능 조건
    - 환불 신청 방법
    - 환불 처리 기간
    - 환불 불가 항목
  ```

- [ ] **이용약관 (Terms of Service)**
  ```
  URL: https://namos-chat.com/terms
  필수 포함 내용:
    - 서비스 이용 조건
    - 결제 조건
    - 사용자 의무
    - 면책 조항
  ```

- [ ] **연락처 정보 (Contact Information)**
  ```
  필수 포함 정보:
    - 회사명/상호
    - 대표자 이름
    - 주소
    - 이메일
    - 전화번호
  ```

---

### 1.4 PayPal 신청 템플릿

#### 📄 신청서 템플릿

```markdown
# PayPal Business Account Application

## 1. Business Information

**Business Legal Name:**
NAMOS Chat Co., Ltd. (또는 귀하의 법인명)

**Business Type:**
- [ ] Corporation (법인)
- [x] Sole Proprietor (개인사업자)
- [ ] Partnership (합명회사)

**Business Category:**
Digital Goods - Virtual Currency/Points

**Business Sub-category:**
Digital Content Subscription Service

**Business Website:**
https://namos-chat.com

**Business Description:**
NAMOS Chat는 AI 기반 대화형 엔터테인먼트 플랫폼입니다.
사용자는 포인트를 구매하여 AI 캐릭터와 대화를 즐길 수 있습니다.
We provide AI-powered conversational entertainment platform.
Users can purchase points to chat with AI characters.

**Expected Monthly Sales Volume:**
$1,000 - $10,000 USD

**Average Transaction Amount:**
$5 - $50 USD

**Products/Services Sold:**
- Virtual Points (가상 포인트)
- Subscription Plans (구독 플랜 - 선택사항)

## 2. Contact Information

**Business Address:**
[상세 주소]

**Business Phone:**
+82-2-XXXX-XXXX

**Customer Service Email:**
support@namos-chat.com

**Website URLs:**
- Main: https://namos-chat.com
- Privacy Policy: https://namos-chat.com/privacy
- Refund Policy: https://namos-chat.com/refund
- Terms of Service: https://namos-chat.com/terms

## 3. Bank Account Information

**Bank Name:**
[은행명]

**Account Number:**
[계좌번호]

**Account Holder Name:**
[예금주명]

**Account Type:**
- [x] Business Checking (기업 당좌)
- [ ] Business Savings (기업 저축)

## 4. Representative Information

**Name:**
[대표자 이름]

**Date of Birth:**
[YYYY-MM-DD]

**ID Number:**
[신분증 번호 - 일부 가림]

**Address:**
[대표자 주소]

**Phone:**
[대표자 전화번호]

## 5. Additional Information

**Do you currently accept credit cards?**
No (처음 시작하는 경우)

**Estimated percentage of transactions from:**
- Domestic (Korea): 70%
- International: 30%

**Do you ship physical goods?**
No, digital only

**Average delivery time:**
Instant (즉시 - 디지털 상품)

**Customer dispute rate (expected):**
< 1%

## 6. Compliance

I confirm that:
- [x] All information provided is accurate
- [x] I have read and agree to PayPal User Agreement
- [x] I have read and agree to PayPal Acceptable Use Policy
- [x] My business complies with all applicable laws
- [x] I will not sell prohibited items or services

**Signature:**
[대표자 서명]

**Date:**
[YYYY-MM-DD]
```

---

## 2. PayPay 통합 가이드

### 2.1 PayPay 비즈니스 계정 신청

#### 📝 신청 절차

**⚠️ 중요**: PayPay는 일본 국내 사업자만 사용 가능합니다.
- 일본 법인 또는 일본에서 사업자등록한 개인사업자
- 일본 은행 계좌 필수

**Step 1: PayPay for Business 신청**

1. **PayPay 비즈니스 웹사이트 방문**
   - URL: https://paypay.ne.jp/business/
   - "加盟店申込" (가맹점 신청) 클릭

2. **신청 유형 선택**
   ```
   - 実店舗 (실제 매장): オンライン決済も利用する 선택
   - オンライン決済のみ (온라인 결제만): 이 옵션 선택
   ```

3. **기본 정보 입력**
   ```yaml
   店舗名 (상호): NAMOS Chat
   法人/個人: 법인 / 개인사업자 선택
   業種: デジタルコンテンツ (디지털 콘텐츠)
   電話番号: [일본 전화번호]
   メールアドレス: business@namos-chat.com
   ```

4. **법인 정보 입력** (법인인 경우)
   ```yaml
   法人名: [법인명]
   法人番号: [법인번호 13자리]
   代表者氏名: [대표자 성명]
   本店所在地: [본점 소재지]
   資本金: [자본금]
   設立年月日: [설립일]
   ```

5. **개인사업자 정보 입력** (개인사업자인 경우)
   ```yaml
   屋号: [상호]
   代表者氏名: [대표자 성명]
   生年月日: [생년월일]
   住所: [주소]
   開業年月日: [개업일]
   ```

**Step 2: 서류 제출**

필요 서류:
- **법인인 경우**:
  - ✅ 登記簿謄本 (등기부등본) - 발행 3개월 이내
  - ✅ 代表者の本人確認書類 (대표자 신분증)
  - ✅ 銀行口座確認書類 (은행 계좌 확인서)
  
- **개인사업자인 경우**:
  - ✅ 開業届 (개업신고서)
  - ✅ 本人確認書類 (신분증)
  - ✅ 銀行口座確認書類 (은행 계좌 확인서)

**Step 3: 심사 및 승인**

- 심사 기간: 통상 1-2주
- 심사 기준:
  - 사업 적법성
  - 웹사이트 확인
  - 금융범죄 예방 (AML/KYC)
- 추가 서류 요청 가능

**Step 4: 계약 체결 및 계정 활성화**

- 가맹점 계약서 서명
- 결제 수수료율 확인 (통상 3.24% + 세금)
- 계정 활성화

---

### 2.2 PayPay API 신청 및 설정

#### 📝 API 신청 절차

**Step 1: PayPay for Developers 가입**

1. **Developer Portal 접속**
   - URL: https://developer.paypay.ne.jp/
   - 비즈니스 계정으로 로그인

2. **개발자 계정 등록**
   - 비즈니스 계정과 연동
   - 개발자 정보 입력

**Step 2: API 신청**

1. **새 애플리케이션 등록**
   ```yaml
   アプリケーション名: NAMOS Chat Payment
   説明: AI チャットサービスのポイント決済システム
   ウェブサイト: https://namos-chat.com
   コールバックURL: https://namos-chat.com/api/payments/paypay/callback
   ```

2. **API 권한 선택**
   - ✅ ウェブペイメント (Web Payment)
   - ✅ 決済の作成 (Create Payment)
   - ✅ 決済の確認 (Get Payment Details)
   - ✅ 返金 (Refund) - 선택사항

**Step 3: API Credentials 발급**

```yaml
Sandbox 環境:
  API Key: [Sandbox API Key]
  API Secret: [Sandbox API Secret]
  Merchant ID: [Sandbox Merchant ID]

Production 環境:
  API Key: [Production API Key]
  API Secret: [Production API Secret]
  Merchant ID: [Production Merchant ID]
```

**Step 4: Webhook 설定**

1. **Webhook URL 등록**
   ```
   Webhook URL: https://namos-chat.com/api/payments/paypay/webhook
   イベント:
     - payment.authorized (결제 승인)
     - payment.captured (결제 확정)
     - payment.failed (결제 실패)
     - payment.refunded (환불)
   ```

2. **Webhook 서명 검증**
   ```javascript
   // PayPay Webhook 서명 검증
   const crypto = require('crypto');
   
   function verifyPayPaySignature(payload, signature, secret) {
     const hash = crypto
       .createHmac('sha256', secret)
       .update(JSON.stringify(payload))
       .digest('hex');
     
     return hash === signature;
   }
   ```

**Step 5: 本番環境申請 (프로덕션 승인)**

1. **Sandbox 테스트 완료 증빙**
   - 테스트 거래 내역 제출
   - 에러 처리 확인

2. **본番환경 신청서 제출**
   ```yaml
   サービス名: NAMOS Chat
   サービス概要: AI キャラクターとのチャットサービス
   決済商品: ポイント購入 (1000円, 3000円, 5000円, 10000円)
   月間予想取引高: 100万円〜500万円
   セキュリティ対策: SSL/TLS, 個人情報暗号化, 不正検知
   ```

3. **PayPay 심사**
   - 심사 기간: 1-2주
   - 웹사이트 보안 확인
   - 개인정보 보호 확인

4. **승인 완료**
   - Production API 활성화
   - 실제 결제 가능

---

### 2.3 PayPay 신청 시 필요 서류 체크리스트

#### 📋 법인 필수 서류

- [ ] **登記簿謄本** (등기부등본)
  - 발행 3개월 이내
  - 전체 사항 증명서 (履歴事項全部証明書)

- [ ] **代表者の本人確認書類** (대표자 신분증)
  - 運転免許証 (운전면허증) / パスポート (여권) / マイナンバーカード
  - 앞면 + 뒷면

- [ ] **銀行口座確認書類** (은행 계좌 확인서)
  - 통장 사본
  - 인터넷 뱅킹 스크린샷
  - 법인명의 계좌

- [ ] **印鑑証明書** (인감증명서)
  - 발행 3개월 이내
  - 법인 인감

#### 📋 개인사업자 필수 서류

- [ ] **開業届の控え** (개업신고서 사본)
  - 세무서 수령인 있는 것

- [ ] **本人確認書類** (신분증)
  - 運転免許証 / パスポート / マイナンバーカード
  - 앞면 + 뒷면

- [ ] **銀行口座確認書類** (은행 계좌 확인서)
  - 통장 사본
  - 인터넷 뱅킹 스크린샷
  - 본인명의 계좌

#### 📋 웹사이트 필수 페이지 (일본어)

- [ ] **プライバシーポリシー** (개인정보 처리방침)
  ```
  URL: https://namos-chat.com/ja/privacy
  必須内容:
    - 個人情報の収集項目
    - 利用目的
    - 第三者提供 (PayPay含む)
    - 安全管理措置
    - 問い合わせ先
  ```

- [ ] **返金規約** (환불 규약)
  ```
  URL: https://namos-chat.com/ja/refund
  必須内容:
    - 返金可能な条件
    - 返金申請方法
    - 返金処理期間
    - 返金不可項目
  ```

- [ ] **利用規約** (이용약관)
  ```
  URL: https://namos-chat.com/ja/terms
  必須内容:
    - サービス利用条件
    - 決済条件
    - ユーザーの義務
    - 免責事項
  ```

- [ ] **特定商取引法に基づく表記** (특정상거래법 표기)
  ```
  URL: https://namos-chat.com/ja/legal
  必須内容:
    - 事業者名
    - 代表者名
    - 所在地
    - 電話番号
    - メールアドレス
    - 販売価格
    - 支払方法
    - 商品引渡時期
    - 返品・交換について
  ```

---

### 2.4 PayPay 신청 템플릿

#### 📄 PayPay 가맹점 신청서 (일본어)

```markdown
# PayPay 加盟店申込書

## 1. 店舗情報

**店舗名（屋号）:**
NAMOS Chat

**法人/個人区分:**
- [x] 法人
- [ ] 個人事業主

**法人名:**
[法人名を記入]

**法人番号:**
[13桁の法人番号]

**代表者氏名:**
[代表者のフルネーム]

**本店所在地:**
〒[郵便番号]
[都道府県][市区町村][番地]
[建物名・部屋番号]

**電話番号:**
03-XXXX-XXXX

**メールアドレス:**
business@namos-chat.com

**ウェブサイトURL:**
https://namos-chat.com

## 2. 事業内容

**業種:**
デジタルコンテンツ販売

**事業内容の詳細:**
AIキャラクターとの対話を楽しめるエンターテインメントプラットフォームを提供しています。
ユーザーは当サービス内で使用できるポイントを購入し、
AIキャラクターとのチャット機能をご利用いただけます。

**販売商品・サービス:**
- バーチャルポイント (1,000円、3,000円、5,000円、10,000円)
- 月額サブスクリプション（検討中）

**月間予想売上高:**
100万円 〜 500万円

**平均取引単価:**
500円 〜 5,000円

**取引形態:**
- [x] オンライン決済のみ
- [ ] 実店舗あり

## 3. 銀行口座情報

**金融機関名:**
[銀行名]

**支店名:**
[支店名]

**口座種別:**
- [x] 普通預金
- [ ] 当座預金

**口座番号:**
[7桁の口座番号]

**口座名義:**
[法人名または屋号]

## 4. 代表者情報

**氏名:**
[フルネーム（漢字）]

**フリガナ:**
[フルネーム（カタカナ）]

**生年月日:**
[YYYY年MM月DD日]

**住所:**
〒[郵便番号]
[都道府県][市区町村][番地]
[建物名・部屋番号]

**電話番号:**
[携帯電話番号]

## 5. 本人確認書類

**提出書類:**
- [x] 運転免許証
- [ ] パスポート
- [ ] マイナンバーカード

**書類番号:**
[書類の番号（一部マスク可）]

**有効期限:**
[YYYY年MM月DD日]

## 6. 追加情報

**PayPay決済の利用目的:**
オンラインでのポイント販売に使用します。
ユーザーが安全かつ便利に決済できる手段を提供するためです。

**月間予想決済件数:**
500件 〜 2,000件

**不正利用対策:**
- SSL/TLS暗号化通信
- 3Dセキュア導入予定
- 不正検知システム導入
- ユーザー本人確認

**カスタマーサポート:**
- メール: support@namos-chat.com
- 営業時間: 平日 10:00-18:00

## 7. 同意事項

以下の事項に同意します:
- [x] PayPay加盟店規約に同意します
- [x] 決済手数料(3.24% + 税)を理解しました
- [x] 禁止商品・サービスを販売しないことを約束します
- [x] 提供した情報は全て正確です
- [x] 法令遵守します

**代表者署名:**
[代表者署名]

**申込日:**
[YYYY年MM月DD日]

---

## 添付書類チェックリスト

- [ ] 登記簿謄本（発行3ヶ月以内）
- [ ] 代表者の本人確認書類（運転免許証等）
- [ ] 銀行口座確認書類（通帳コピー等）
- [ ] 印鑑証明書（発行3ヶ月以内）
- [ ] ウェブサイトのスクリーンショット
```

---

## 3. 공통 구현 사항

### 3.1 필수 웹사이트 페이지 작성

#### 📄 개인정보 처리방침 (Privacy Policy)

```markdown
# 개인정보 처리방침 (Privacy Policy)

최종 수정일: 2025-01-27

NAMOS Chat("회사")는 이용자의 개인정보를 중요시하며,
「개인정보 보호법」을 준수하고 있습니다.

## 1. 수집하는 개인정보 항목

회사는 다음과 같은 개인정보를 수집합니다:

### 필수 정보
- 이메일 주소
- 닉네임
- 비밀번호 (암호화 저장)

### 선택 정보
- 프로필 이미지
- 자기소개

### 결제 정보
- 결제 수단 정보는 PayPal/PayPay에서 직접 처리되며,
  회사는 결제 완료 여부만 확인합니다.
- 회사는 신용카드 정보를 직접 저장하지 않습니다.

### 자동 수집 정보
- IP 주소
- 쿠키
- 서비스 이용 기록
- 방문 기록

## 2. 개인정보의 수집 및 이용 목적

- 회원 가입 및 관리
- 서비스 제공 및 개선
- 결제 및 환불 처리
- 고객 문의 응대
- 이용 통계 분석

## 3. 개인정보의 보유 및 이용 기간

- 회원 탈퇴 시: 즉시 삭제
- 법령에 따른 보존:
  - 계약 또는 청약철회 등에 관한 기록: 5년
  - 대금결제 및 재화 등의 공급에 관한 기록: 5년
  - 소비자의 불만 또는 분쟁처리에 관한 기록: 3년

## 4. 개인정보의 제3자 제공

회사는 다음의 경우에만 개인정보를 제3자에게 제공합니다:

- PayPal/PayPay: 결제 처리 목적
- Google: OAuth 로그인 목적

## 5. 개인정보의 파기

회사는 개인정보 보유기간 경과, 처리목적 달성 등
개인정보가 불필요하게 되었을 때는 지체없이 파기합니다.

## 6. 개인정보보호책임자

- 이름: [담당자 이름]
- 이메일: privacy@namos-chat.com
- 전화: 02-XXXX-XXXX

## 7. 권익침해 구제방법

개인정보침해에 대한 신고나 상담이 필요하신 경우
아래 기관에 문의하시기 바랍니다.

- 개인정보침해신고센터 (privacy.kisa.or.kr / 국번없이 118)
- 개인정보분쟁조정위원회 (www.kopico.go.kr / 1833-6972)
```

#### 📄 환불 규정 (Refund Policy)

```markdown
# 환불 규정 (Refund Policy)

최종 수정일: 2025-01-27

## 1. 환불 가능 조건

다음의 경우 환불이 가능합니다:

### 즉시 환불
- 결제 오류로 인한 중복 결제
- 서비스 장애로 포인트를 사용할 수 없는 경우
- 구매 후 포인트를 전혀 사용하지 않은 경우 (구매 후 7일 이내)

### 부분 환불
- 포인트를 일부 사용한 경우, 남은 포인트에 대해서만 환불 가능

## 2. 환불 불가 조건

다음의 경우 환불이 불가능합니다:
- 포인트를 이미 사용한 경우 (부분 환불 제외)
- 환불 신청 기한(구매 후 7일)이 지난 경우
- 이용약관 위반으로 인한 계정 정지/삭제

## 3. 환불 신청 방법

1. 고객센터 이메일로 환불 신청
   - 이메일: support@namos-chat.com
   - 제목: 환불 신청 - [구매일자] [거래번호]
   
2. 필수 정보 제공
   - 사용자 이메일
   - 구매 일자
   - 결제 금액
   - 환불 사유

3. 환불 심사 (영업일 기준 3-5일)

4. 환불 처리
   - 승인 시: 원래 결제 수단으로 환불
   - 거부 시: 사유 안내

## 4. 환불 처리 기간

- PayPal: 승인 후 3-5영업일
- PayPay: 승인 후 5-7영업일
- 은행 계좌에 따라 추가 시간 소요 가능

## 5. 문의

환불 관련 문의:
- 이메일: support@namos-chat.com
- 운영 시간: 평일 10:00-18:00 (한국 시간)
```

---

### 3.2 결제 통합 구현 코드

다음 파일을 생성해야 합니다:

```
src/
├── app/
│   ├── api/
│   │   └── payments/
│   │       ├── paypal/
│   │       │   ├── route.ts (결제 생성)
│   │       │   └── webhook/
│   │       │       └── route.ts (웹훅 처리)
│   │       └── paypay/
│   │           ├── route.ts (결제 생성)
│   │           └── webhook/
│   │               └── route.ts (웹훅 처리)
│   └── points/
│       └── purchase/
│           └── page.tsx (포인트 구매 페이지)
└── lib/
    └── payments/
        ├── paypal.ts
        └── paypay.ts
```

필요한 경우 구현 코드 예시를 추가로 작성해 드릴 수 있습니다.

---

## 4. 테스트 및 검증

### 4.1 Sandbox 테스트

#### PayPal Sandbox
- URL: https://developer.paypal.com/developer/accounts/
- 테스트 계정 생성 (구매자/판매자)
- 테스트 카드 정보 사용

#### PayPay Sandbox
- PayPay Developer Portal에서 테스트 환경 접속
- 테스트 결제 시뮬레이션

### 4.2 테스트 시나리오

- [ ] 정상 결제 테스트
- [ ] 결제 실패 테스트
- [ ] 중복 결제 방지 테스트
- [ ] 환불 테스트
- [ ] 웹훅 처리 테스트
- [ ] 에러 처리 테스트

---

## 📞 문의

결제 시스템 통합 관련 문의:
- 개발팀: dev@namos-chat.com

**작성일**: 2025-01-27  
**문서 버전**: 1.0






