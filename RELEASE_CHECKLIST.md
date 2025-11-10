# 🚀 릴리스 체크리스트 (Release Checklist)

> **프로젝트**: NAMOS Chat v1  
> **작성일**: 2025-01-27  
> **목적**: 프로덕션 환경 배포를 위한 필수 사항 정리

---

## 📋 목차

1. [도메인 및 호스팅](#1-도메인-및-호스팅)
2. [클라우드 서비스 설정](#2-클라우드-서비스-설정)
3. [결제 시스템 연동](#3-결제-시스템-연동)
4. [데이터베이스 및 스토리지](#4-데이터베이스-및-스토리지)
5. [환경 변수 설정](#5-환경-변수-설정)
6. [보안 및 인증](#6-보안-및-인증)
7. [모니터링 및 로깅](#7-모니터링-및-로깅)
8. [법적 준수사항](#8-법적-준수사항)
9. [테스트 및 품질 보증](#9-테스트-및-품질-보증)
10. [문서화](#10-문서화)

---

## 1. 도메인 및 호스팅

### ✅ 도메인 구매
- [ ] **도메인 등록 업체 선택**
  - 추천: Namecheap, Google Domains, AWS Route 53
  - 비용: 약 $10-15/년 (`.com` 도메인 기준)
- [ ] **도메인 이름 확정 및 등록**
  - 예: `namos-chat.com`, `namos.ai` 등
- [ ] **도메인 DNS 설정**
  - Netlify에 도메인 연결
  - SSL 인증서 자동 발급 확인

### ✅ Netlify 호스팅 설정
- [ ] **Netlify Pro 플랜 구독**
  - 비용: $19/월
  - 포함 사항:
    - Serverless Functions: 125,000 requests/월
    - 대역폭: 100GB/월
    - Build minutes: 300분/월
  - 초과 시 추가 비용 발생 가능
- [ ] **사이트 배포 설정**
  - GitHub/GitLab 연동 확인
  - 자동 배포 설정
  - 브랜치별 배포 전략 설정 (production, staging)

---

## 2. 클라우드 서비스 설정

### ✅ Google Cloud Platform (GCP)
- [ ] **GCP 프로젝트 생성**
  - 프로젝트 ID 확인 (`GOOGLE_PROJECT_ID`)
- [ ] **Vertex AI API 활성화**
  - Gemini 2.5 Flash (기본 채팅)
  - Gemini 2.5 Pro (자동 요약)
  - 비용: 사용량 기반 (Input: $0.075-$1.25/1M tokens, Output: $0.30-$5.00/1M tokens)
- [ ] **Secret Manager 설정**
  - 다음 시크릿 생성:
    - `DATABASE_URL`
    - `SUPABASE_URL`
    - `SUPABASE_SERVICE_ROLE_KEY`
    - `OPENAI_API_KEY`
    - `NEXTAUTH_SECRET`
    - `NEXTAUTH_URL`
  - 서비스 계정 키 생성 및 Netlify 환경 변수 설정
- [ ] **서비스 계정 권한 설정**
  - Vertex AI 사용자 권한
  - Secret Manager 접근 권한
- [ ] **청구 알림 설정**
  - 예산 알림 설정 (예: $100/월 초과 시 알림)
  - 사용량 모니터링 설정

### ✅ OpenAI API
- [ ] **OpenAI API 키 발급**
  - Embedding 모델 사용: `text-embedding-3-small`
  - 비용: $0.02/1M tokens
- [ ] **사용량 제한 설정**
  - Rate limit 설정
  - 비용 모니터링

---

## 3. 결제 시스템 연동

### ⚠️ 현재 상태: **미구현** (개발 필요)

### ✅ PayPal 연동
- [ ] **PayPal Business 계정 생성**
  - 비용: 무료
- [ ] **PayPal Developer 계정 설정**
  - 애플리케이션 생성
  - Client ID 및 Secret 발급
- [ ] **PayPal SDK 설치 및 연동**
  - `@paypal/checkout-server-sdk` 또는 `paypal-rest-sdk` 설치
  - 결제 API 엔드포인트 구현
- [ ] **결제 플로우 구현**
  - 포인트 구매 페이지
  - 결제 성공/실패 처리
  - 웹훅 처리 (결제 확인)
- [ ] **수수료 확인**
  - 국내 거래: 2.9% + $0.30/거래
  - 국제 거래: 3.6% + $0.30/거래

### ✅ PayPay 연동 (일본 시장)
- [ ] **PayPay Business 계정 생성**
  - 일본 시장 대상
- [ ] **PayPay API 연동**
  - API 키 발급
  - 결제 플로우 구현
- [ ] **수수료 확인**
  - 약 3.6% + 고정 수수료

### ✅ 결제 시스템 구현 체크리스트
- [ ] **백엔드 API 구현**
  - `src/app/api/payments/paypal/route.ts` 생성
  - `src/app/api/payments/paypay/route.ts` 생성
  - `src/app/api/payments/webhook/route.ts` 생성 (결제 확인)
- [ ] **프론트엔드 구현**
  - 포인트 구매 페이지 (`src/app/points/purchase/page.tsx`)
  - 결제 완료 페이지
  - 결제 실패 페이지
- [ ] **데이터베이스 스키마 업데이트**
  - `payments` 테이블 생성 (결제 기록)
  - `points` 테이블에 결제 정보 추가
- [ ] **보안 검증**
  - 결제 금액 검증
  - 중복 결제 방지
  - 웹훅 서명 검증

---

## 4. 데이터베이스 및 스토리지

### ✅ Supabase 설정
- [ ] **Supabase Pro 플랜 구독**
  - 비용: $25/월 (약 3,750엔/월)
  - 포함 사항:
    - 데이터베이스: 8GB
    - 대역폭: 50GB/월
    - 스토리지: 100GB
    - 벡터 검색 지원 (pgvector)
- [ ] **데이터베이스 마이그레이션**
  - Prisma 마이그레이션 실행
  - 인덱스 최적화 확인
  - 벡터 검색 인덱스 설정
- [ ] **스토리지 버킷 설정**
  - `characters` 버킷 생성
  - 스토리지 정책 설정:
    - 업로드 정책 (인증된 사용자)
    - 읽기 정책 (공개)
- [ ] **RLS (Row Level Security) 설정**
  - 보안 정책 확인
  - 사용자별 접근 권한 설정

### ✅ 데이터베이스 백업
- [ ] **자동 백업 설정**
  - Supabase 자동 백업 활성화
  - 수동 백업 스크립트 작성
- [ ] **복구 계획 수립**
  - 백업 복구 절차 문서화
  - 재해 복구 계획

---

## 5. 환경 변수 설정

### ✅ Netlify 환경 변수
다음 환경 변수를 Netlify Dashboard에 설정:

#### 필수 환경 변수 (빌드 타임)
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `NEXT_PUBLIC_SITE_URL` (도메인 URL)

#### 필수 환경 변수 (런타임 - Secret Manager에서 로드)
- [ ] `GOOGLE_PROJECT_ID`
- [ ] `GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64` (서비스 계정 키)
- [ ] `DATABASE_URL` (선택사항, GSM 사용 시 불필요)
- [ ] `SUPABASE_URL` (선택사항, GSM 사용 시 불필요)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (선택사항, GSM 사용 시 불필요)
- [ ] `OPENAI_API_KEY` (선택사항, GSM 사용 시 불필요)

#### NextAuth 환경 변수
- [ ] `NEXTAUTH_SECRET` (랜덤 문자열, 최소 32자)
- [ ] `NEXTAUTH_URL` (프로덕션 도메인)
- [ ] `GOOGLE_CLIENT_ID` (Google OAuth)
- [ ] `GOOGLE_CLIENT_SECRET` (Google OAuth)

#### 결제 시스템 환경 변수 (구현 후)
- [ ] `PAYPAL_CLIENT_ID`
- [ ] `PAYPAL_CLIENT_SECRET`
- [ ] `PAYPAL_MODE` (`live` 또는 `sandbox`)
- [ ] `PAYPAY_CLIENT_ID` (일본 시장용)
- [ ] `PAYPAY_CLIENT_SECRET` (일본 시장용)

### ✅ Google Secret Manager 설정
- [ ] 다음 시크릿 생성 및 저장:
  - `DATABASE_URL`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `OPENAI_API_KEY`
  - `NEXTAUTH_SECRET`
  - `NEXTAUTH_URL`
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`

---

## 6. 보안 및 인증

### ✅ 보안 설정
- [ ] **HTTPS 설정**
  - Netlify 자동 SSL 인증서 확인
  - HSTS 헤더 설정
- [ ] **CORS 설정**
  - 허용된 도메인만 접근 가능하도록 설정
- [ ] **Rate Limiting**
  - API 엔드포인트별 Rate Limit 설정
  - DDoS 방어 설정
- [ ] **보안 헤더 설정**
  - `X-Frame-Options`
  - `X-Content-Type-Options`
  - `Referrer-Policy`
  - `Permissions-Policy`

### ✅ 인증 설정
- [ ] **NextAuth 설정 확인**
  - 세션 만료 시간 설정
  - 쿠키 보안 설정
- [ ] **Google OAuth 설정**
  - OAuth 클라이언트 ID/Secret 확인
  - 리디렉션 URI 설정
- [ ] **비밀번호 정책**
  - 최소 길이 요구사항
  - 복잡도 요구사항

### ✅ 데이터 보호
- [ ] **개인정보 보호 정책**
  - 개인정보 처리방침 작성
  - 이용약관 작성
- [ ] **데이터 암호화**
  - 전송 중 암호화 (HTTPS)
  - 저장 데이터 암호화 (데이터베이스)
- [ ] **로그 관리**
  - 민감 정보 로그 제거
  - 로그 보관 정책

---

## 7. 모니터링 및 로깅

### ✅ 애플리케이션 모니터링
- [ ] **에러 트래킹**
  - Sentry 또는 유사 서비스 연동
  - 에러 알림 설정
- [ ] **성능 모니터링**
  - Netlify Analytics 활성화
  - API 응답 시간 모니터링
- [ ] **사용자 분석**
  - Google Analytics 설정 (선택사항)
  - 사용자 행동 분석

### ✅ 인프라 모니터링
- [ ] **GCP 모니터링**
  - Vertex AI 사용량 모니터링
  - 비용 알림 설정
- [ ] **Supabase 모니터링**
  - 데이터베이스 성능 모니터링
  - 스토리지 사용량 모니터링
- [ ] **Netlify 모니터링**
  - 빌드 시간 모니터링
  - 함수 실행 시간 모니터링

### ✅ 로깅
- [ ] **구조화된 로깅**
  - 로그 레벨 설정 (info, warn, error)
  - 로그 포맷 통일
- [ ] **로그 보관**
  - 로그 보관 기간 설정
  - 로그 분석 도구 설정

---

## 8. 법적 준수사항

### ✅ 개인정보 보호
- [ ] **개인정보 처리방침 작성**
  - 수집하는 개인정보 항목
  - 개인정보 이용 목적
  - 개인정보 보관 기간
  - 개인정보 제3자 제공
- [ ] **이용약관 작성**
  - 서비스 이용 조건
  - 사용자 의무사항
  - 면책 조항
- [ ] **쿠키 정책**
  - 쿠키 사용 목적
  - 쿠키 관리 방법

### ✅ 결제 관련 법적 준수
- [ ] **결제 서비스 이용약관**
  - 환불 정책
  - 취소 정책
- [ ] **세금 처리**
  - 부가가치세 처리 (해당 국가)
  - 세금 계산서 발행
- [ ] **결제 보안**
  - PCI DSS 준수 (PayPal/PayPay 처리 시)
  - 결제 정보 암호화

### ✅ 콘텐츠 정책
- [ ] **이용약관에 콘텐츠 정책 포함**
  - 금지된 콘텐츠
  - 저작권 정책
  - 신고 절차

---

## 9. 테스트 및 품질 보증

### ✅ 기능 테스트
- [ ] **인증 테스트**
  - 회원가입/로그인 테스트
  - Google OAuth 테스트
  - 비밀번호 재설정 테스트
- [ ] **채팅 기능 테스트**
  - 메시지 전송/수신 테스트
  - 이미지 업로드 테스트
  - 벡터 검색 테스트
- [ ] **결제 테스트** (구현 후)
  - PayPal 샌드박스 테스트
  - PayPay 테스트
  - 웹훅 테스트
- [ ] **성능 테스트**
  - 부하 테스트
  - 응답 시간 테스트
  - 동시 사용자 테스트

### ✅ 보안 테스트
- [ ] **취약점 스캔**
  - OWASP Top 10 검증
  - SQL Injection 테스트
  - XSS 테스트
- [ ] **인증/인가 테스트**
  - 권한 우회 테스트
  - 세션 관리 테스트

### ✅ 호환성 테스트
- [ ] **브라우저 호환성**
  - Chrome, Firefox, Safari, Edge 테스트
  - 모바일 브라우저 테스트
- [ ] **반응형 디자인 테스트**
  - 모바일, 태블릿, 데스크톱 테스트

---

## 10. 문서화

### ✅ 사용자 문서
- [ ] **사용자 가이드**
  - 서비스 사용 방법
  - FAQ 작성
- [ ] **고객 지원**
  - 고객 지원 채널 설정 (이메일, 채팅 등)
  - 지원 시간 명시

### ✅ 개발 문서
- [ ] **API 문서**
  - API 엔드포인트 문서화
  - 요청/응답 예시
- [ ] **배포 가이드**
  - 배포 절차 문서화
  - 롤백 절차 문서화
- [ ] **운영 가이드**
  - 모니터링 방법
  - 문제 해결 가이드

---

## 💰 예상 월간 운영 비용

### 최소 운영 비용 (소규모 사용자)
- **Netlify Pro**: $19/월
- **Supabase Pro**: $25/월
- **도메인**: $1/월 ($12/년)
- **Google Vertex AI**: $10-50/월 (사용량 기반)
- **OpenAI Embeddings**: $5-20/월 (사용량 기반)
- **총계**: 약 **$60-115/월** (약 9,000-17,250엔/월)

### 중규모 운영 비용 (1,000명 사용자)
- **Netlify Pro**: $19/월 (+ 추가 요청/대역폭)
- **Supabase Pro**: $25/월
- **도메인**: $1/월
- **Google Vertex AI**: $200-500/월
- **OpenAI Embeddings**: $50-100/월
- **총계**: 약 **$295-645/월** (약 44,250-96,750엔/월)

### 참고: 결제 시스템 수수료
- **PayPal**: 거래당 2.9% + $0.30
- **PayPay**: 거래당 약 3.6% + 고정 수수료
- 수수료는 매출에서 차감되므로 별도 비용이 아닙니다.

---

## 🚨 중요 체크리스트

### 릴리스 전 필수 확인 사항
- [ ] 모든 환경 변수 설정 완료
- [ ] 데이터베이스 마이그레이션 완료
- [ ] 결제 시스템 연동 완료 (수익화 계획 시)
- [ ] 보안 테스트 완료
- [ ] 성능 테스트 완료
- [ ] 법적 문서 작성 완료 (개인정보 처리방침, 이용약관)
- [ ] 모니터링 시스템 구축 완료
- [ ] 백업 시스템 구축 완료
- [ ] 고객 지원 채널 준비 완료

### 릴리스 후 확인 사항
- [ ] 모든 기능 정상 작동 확인
- [ ] 모니터링 시스템 정상 작동 확인
- [ ] 에러 로그 확인
- [ ] 사용자 피드백 수집
- [ ] 성능 메트릭 확인

---

## 📞 지원 및 문의

프로젝트 관련 문의사항이 있으시면 개발 팀에 연락해 주세요.

**작성일**: 2025-01-27  
**최종 업데이트**: 2025-01-27  
**문서 버전**: 1.0

---

## 📚 참고 자료

- [Netlify 문서](https://docs.netlify.com/)
- [Supabase 문서](https://supabase.com/docs)
- [Google Cloud 문서](https://cloud.google.com/docs)
- [PayPal 개발자 문서](https://developer.paypal.com/)
- [Next.js 문서](https://nextjs.org/docs)
- [Prisma 문서](https://www.prisma.io/docs)

