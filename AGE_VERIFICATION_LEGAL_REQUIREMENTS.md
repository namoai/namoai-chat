# ⚠️ 성인 인증 시스템 법적 요구사항 분석

> **프로젝트**: NAMOS Chat v1  
> **작성일**: 2025-01-27  
> **목적**: 현재 시스템의 법적 적합성 검토 및 개선 방안

---

## 🚨 **결론: 현재 시스템은 법적 요구사항 미충족**

### ❌ **현재 상태: 불법 위험 높음**

---

## 📋 목차

1. [현재 시스템 분석](#1-현재-시스템-분석)
2. [일본 법률 요구사항](#2-일본-법률-요구사항)
3. [법적 위험도 평가](#3-법적-위험도-평가)
4. [필수 구현 사항](#4-필수-구현-사항)
5. [구현 가이드](#5-구현-가이드)

---

## 1. 현재 시스템 분석

### 1.1 현재 구현된 기능

#### ✅ **현재 있는 것:**

1. **세이프티 필터 토글** (`src/app/MyPage/page.tsx`)
   ```typescript
   // 단순 체크박스 확인만 있음
   message: "あなたは成人ですか？\n\n「はい」を選択すると..."
   confirmText: "はい（18歳以上です）"
   ```
   - ❌ 실제 연령 검증 없음
   - ❌ 생년월일 입력 없음
   - ❌ 본인 확인 없음

2. **세이프티 필터 설정** (`users.safetyFilter`)
   - 데이터베이스에 `Boolean` 필드만 저장
   - ❌ 연령 정보 없음
   - ❌ 인증 일시 없음
   - ❌ 인증 방법 기록 없음

3. **회원가입 시**
   - 이메일, 비밀번호, 이름, 전화번호만 입력
   - ❌ 생년월일 입력 없음
   - ❌ 연령 확인 없음

#### ❌ **현재 없는 것:**

1. **생년월일 입력**
2. **실제 연령 계산 및 검증**
3. **본인 확인 시스템**
4. **인증 기록 저장**
5. **미성년자 접근 차단**

---

## 2. 일본 법률 요구사항

### 2.1 성표현규제법 (わいせつ物頒布等の罪)

**요구사항:**
- ✅ 만 18세 이상만 접근 가능
- ✅ **신뢰할 수 있는 방법으로 연령 확인 필수**
- ❌ 단순 체크박스는 **법적 효력 없음**

**법적 기준:**
```
"단순히 '18세 이상입니다'를 체크하는 것만으로는 불충분"
"실제로 연령을 확인할 수 있는 방법이 필요"
```

### 2.2 아동보호법 (児童ポルノ禁止法)

**요구사항:**
- ✅ 18세 미만 캐릭터 관련 콘텐츠 절대 금지
- ✅ 미성년자 접근 차단 필수
- ✅ 접근 시도 기록 보관

### 2.3 특정상거래법

**요구사항:**
- ✅ 사업자 정보 명시
- ✅ 연령 제한 명시
- ✅ 성인 콘텐츠 경고 표시

---

## 3. 법적 위험도 평가

### 3.1 현재 시스템의 법적 효력

| 항목 | 현재 상태 | 법적 효력 | 위험도 |
|------|----------|----------|--------|
| **연령 확인** | ❌ 체크박스만 | **무효** | 🔴 **높음** |
| **생년월일 입력** | ❌ 없음 | **무효** | 🔴 **높음** |
| **본인 확인** | ❌ 없음 | **무효** | 🔴 **높음** |
| **미성년자 차단** | ❌ 없음 | **무효** | 🔴 **높음** |
| **인증 기록** | ❌ 없음 | **무효** | 🔴 **높음** |

### 3.2 법적 위험

#### 🔴 **높은 위험 (즉시 대응 필요)**

1. **형사 처벌 가능성**
   - 성표현규제법 위반: **2년 이하 징역 또는 250만엔 이하 벌금**
   - 아동보호법 위반: **더 엄격한 처벌**

2. **민사 소송 위험**
   - 미성년자 보호자로부터 손해배상 청구
   - 평판 손상

3. **사업 중단 위험**
   - 경찰 수사 시 사이트 차단
   - 결제 시스템 계약 해지 (PayPal, PayPay 등)

4. **결제 시스템 거부**
   - CCBill, CoinGate 등도 법적 요구사항 확인
   - 성인 인증 없으면 계약 거부 가능

---

## 4. 필수 구현 사항

### 4.1 최소 요구사항 (법적 준수)

#### ✅ **1. 생년월일 입력 및 검증**

**필수 항목:**
- [ ] 회원가입 시 생년월일 입력 필수
- [ ] 실시간 연령 계산 (만 18세 이상 확인)
- [ ] 미성년자 회원가입 차단
- [ ] 생년월일 데이터베이스 저장

**데이터베이스 스키마 추가:**
```prisma
model users {
  // ... 기존 필드
  dateOfBirth      DateTime?  // 생년월일
  ageVerified      Boolean    @default(false)  // 연령 확인 완료 여부
  ageVerifiedAt    DateTime?  // 연령 확인 일시
  ageVerificationMethod String?  // 인증 방법 (birthday, credit_card, phone 등)
}
```

#### ✅ **2. 성인 인증 페이지 (Age Gate)**

**필수 기능:**
- [ ] 사이트 첫 접속 시 연령 확인 페이지 표시
- [ ] 생년월일 입력 폼
- [ ] 만 18세 미만 시 접근 차단
- [ ] 쿠키/세션으로 인증 상태 저장

**구현 위치:**
```
/app/age-verification/page.tsx (신규 생성)
```

#### ✅ **3. 본인 확인 시스템 (선택사항이지만 강력 권장)**

**권장 방법:**

1. **신용카드 인증** (가장 신뢰성 높음)
   - 카드 번호 입력 (저장 안 함)
   - AVS (Address Verification System) 확인
   - 비용: 거래당 약 ¥100-300

2. **휴대폰 본인 인증** (일본에서 선호)
   - SMS 인증 코드 발송
   - 전화번호 확인
   - 비용: SMS당 약 ¥10-20

3. **생년월일 + 추가 확인** (최소 요구사항)
   - 생년월일 입력
   - 신원 확인 질문 (예: 주민등록번호 뒷자리)
   - ⚠️ 법적 효력 낮음

---

### 4.2 권장 구현 사항 (강화)

#### ✅ **4. 접근 로그 기록**

**필수 항목:**
- [ ] 성인 콘텐츠 접근 시도 기록
- [ ] IP 주소 기록
- [ ] 접근 일시 기록
- [ ] 인증 방법 기록

**법적 목적:**
- 수사 시 증거 자료
- 법적 책임 방어

#### ✅ **5. 미성년자 차단 강화**

**필수 항목:**
- [ ] 미성년자 접근 시 즉시 차단
- [ ] 부모/보호자에게 알림 (선택사항)
- [ ] 재접근 시도 차단

#### ✅ **6. 이용약관 및 경고문**

**필수 항목:**
- [ ] 성인 콘텐츠 경고문 표시
- [ ] 연령 제한 명시
- [ ] 이용약관에 법적 조항 포함

---

## 5. 구현 가이드

### 5.1 데이터베이스 스키마 업데이트

```prisma
model users {
  // ... 기존 필드
  dateOfBirth            DateTime?   // 생년월일
  ageVerified            Boolean     @default(false)  // 연령 확인 완료
  ageVerifiedAt          DateTime?   // 인증 일시
  ageVerificationMethod  String?     // 인증 방법: 'birthday', 'credit_card', 'phone', 'id_card'
  ageVerificationIP       String?     // 인증 시 IP 주소
  ageVerificationLog     String?     @db.Text  // 인증 로그 (JSON)
}
```

**마이그레이션:**
```bash
npx prisma migrate dev --name add_age_verification
```

---

### 5.2 연령 확인 페이지 구현

#### **파일 생성: `src/app/age-verification/page.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function AgeVerificationPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [birthDate, setBirthDate] = useState('');
  const [error, setError] = useState('');

  const calculateAge = (birthDate: string): number => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!birthDate) {
      setError('생년월일을 입력해주세요.');
      return;
    }

    const age = calculateAge(birthDate);
    
    if (age < 18) {
      setError('만 18세 이상만 이용 가능합니다.');
      return;
    }

    // 서버에 인증 정보 전송
    try {
      const response = await fetch('/api/users/age-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          dateOfBirth: birthDate,
          verificationMethod: 'birthday'
        }),
      });

      if (!response.ok) {
        throw new Error('인증 처리에 실패했습니다.');
      }

      // 쿠키에 인증 상태 저장
      document.cookie = `age_verified=true; path=/; max-age=${60 * 60 * 24 * 365}`; // 1년

      // 원래 페이지로 리다이렉트
      const returnUrl = sessionStorage.getItem('returnUrl') || '/';
      router.push(returnUrl);
    } catch (error) {
      setError('인증 처리 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="max-w-md w-full p-8 border border-pink-500 rounded-lg">
        <h1 className="text-2xl font-bold mb-4 text-center">
          年齢確認 (연령 확인)
        </h1>
        
        <div className="bg-red-900/30 border border-red-500 rounded p-4 mb-6">
          <p className="text-sm font-bold text-red-300 mb-2">
            ⚠️ 成人向けコンテンツ (성인 콘텐츠)
          </p>
          <p className="text-xs">
            本サイトは18歳以上の成人のみが利用可能です。
            <br />
            (본 사이트는 만 18세 이상만 이용 가능합니다.)
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              生年月日 (생년월일)
            </label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded text-white"
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              満18歳以上であることを確認するため、生年月日を入力してください。
            </p>
          </div>

          {error && (
            <div className="bg-red-900/50 border border-red-500 rounded p-3">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <div className="bg-gray-900 border border-gray-700 rounded p-4 text-xs">
            <p className="mb-2 font-bold">利用規約への同意:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-300">
              <li>私は18歳以上であることを確認します</li>
              <li>成人向けコンテンツを閲覧することに同意します</li>
              <li>虚偽の情報提供は法律違反となります</li>
            </ul>
          </div>

          <button
            type="submit"
            className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 px-4 rounded"
          >
            確認 (확인)
          </button>

          <button
            type="button"
            onClick={() => router.push('/')}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded"
          >
            戻る (돌아가기)
          </button>
        </form>
      </div>
    </div>
  );
}
```

---

### 5.3 API 엔드포인트 구현

#### **파일 생성: `src/app/api/users/age-verification/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/nextauth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: '認証が必要です。' },
      { status: 401 }
    );
  }

  const userId = parseInt(session.user.id, 10);
  const { dateOfBirth, verificationMethod } = await request.json();

  if (!dateOfBirth) {
    return NextResponse.json(
      { error: '生年月日が必要です。' },
      { status: 400 }
    );
  }

  // 연령 계산
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  // 미성년자 차단
  if (age < 18) {
    // 접근 시도 기록 (법적 목적)
    await prisma.reports.create({
      data: {
        type: 'SYSTEM_ISSUE',
        reporterId: userId,
        title: '미성년자 접근 시도',
        reason: 'AGE_VERIFICATION_FAILED',
        content: `연령: ${age}세, 생년월일: ${dateOfBirth}`,
        status: 'REVIEWED',
      },
    });

    return NextResponse.json(
      { error: '18歳未満は利用できません。' },
      { status: 403 }
    );
  }

  // IP 주소 가져오기
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : 
             request.headers.get('x-real-ip') || 'unknown';

  // 사용자 정보 업데이트
  await prisma.users.update({
    where: { id: userId },
    data: {
      dateOfBirth: new Date(dateOfBirth),
      ageVerified: true,
      ageVerifiedAt: new Date(),
      ageVerificationMethod: verificationMethod || 'birthday',
      ageVerificationIP: ip,
      ageVerificationLog: JSON.stringify({
        dateOfBirth,
        age,
        method: verificationMethod || 'birthday',
        ip,
        verifiedAt: new Date().toISOString(),
      }),
    },
  });

  return NextResponse.json({
    message: '年齢確認が完了しました。',
    age,
  });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: '認証が必要です。' },
      { status: 401 }
    );
  }

  const userId = parseInt(session.user.id, 10);
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: {
      ageVerified: true,
      ageVerifiedAt: true,
      dateOfBirth: true,
    },
  });

  return NextResponse.json({
    ageVerified: user?.ageVerified || false,
    ageVerifiedAt: user?.ageVerifiedAt,
    dateOfBirth: user?.dateOfBirth,
  });
}
```

---

### 5.4 미들웨어 구현 (접근 차단)

#### **파일 생성: `src/middleware.ts`**

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  const path = request.nextUrl.pathname;

  // 성인 콘텐츠 페이지 목록
  const adultContentPaths = [
    '/chat/',
    '/character-management',
    '/character/',
  ];

  // 성인 콘텐츠 접근 시도 확인
  const isAdultContentPath = adultContentPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  );

  if (isAdultContentPath && token) {
    // 쿠키에서 연령 확인 상태 확인
    const ageVerified = request.cookies.get('age_verified')?.value === 'true';

    if (!ageVerified) {
      // 원래 URL 저장
      const returnUrl = request.nextUrl.pathname + request.nextUrl.search;
      
      // 연령 확인 페이지로 리다이렉트
      const url = new URL('/age-verification', request.url);
      url.searchParams.set('return', returnUrl);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/chat/:path*',
    '/character-management/:path*',
    '/character/:path*',
  ],
};
```

---

### 5.5 회원가입 페이지 수정

#### **`src/app/register/page.tsx` 수정**

```typescript
// 생년월일 필드 추가
const [form, setForm] = useState({
  email: "",
  password: "",
  name: "",
  phone: "",
  nickname: "",
  dateOfBirth: "", // 추가
});

// 생년월일 검증 추가
const validate = () => {
  // ... 기존 검증
  
  // 생년월일 검증
  if (!form.dateOfBirth) {
    alert('생년월일을 입력해주세요.');
    return false;
  }

  const today = new Date();
  const birth = new Date(form.dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  if (age < 18) {
    alert('만 18세 이상만 회원가입 가능합니다.');
    return false;
  }

  return true;
};
```

---

### 5.6 신용카드 인증 (선택사항, 강력 권장)

#### **Stripe 또는 CCBill 연동**

```typescript
// src/lib/age-verification/credit-card.ts

export async function verifyAgeWithCreditCard(
  cardNumber: string,
  expiryMonth: string,
  expiryYear: string
): Promise<{ verified: boolean; age: number | null }> {
  // Stripe 또는 CCBill API 호출
  // 카드 정보로 연령 확인 (AVS 확인)
  
  // 실제 구현은 결제 게이트웨이 API 문서 참고
  // 여기서는 예시만 제공
  
  return {
    verified: true,
    age: 25, // API에서 반환된 연령
  };
}
```

---

## 6. 법적 준수 체크리스트

### ✅ 즉시 구현 필요 (법적 요구사항)

- [ ] **생년월일 입력 필드 추가** (회원가입)
- [ ] **연령 확인 페이지 구현** (`/age-verification`)
- [ ] **미성년자 접근 차단** (미들웨어)
- [ ] **인증 상태 쿠키 저장**
- [ ] **데이터베이스 스키마 업데이트**
- [ ] **이용약관에 연령 제한 명시**
- [ ] **성인 콘텐츠 경고문 표시**

### ✅ 권장 구현 (강화)

- [ ] **신용카드 인증** (가장 신뢰성 높음)
- [ ] **휴대폰 본인 인증** (일본에서 선호)
- [ ] **접근 로그 기록** (법적 증거)
- [ ] **정기 재인증** (1년마다)

---

## 7. 법적 위험 완화 전략

### 7.1 즉시 적용 가능

1. **연령 확인 페이지 추가**
   - 생년월일 입력 필수
   - 미성년자 차단
   - **위험도: 🔴 높음 → 🟡 중간**

2. **이용약관 업데이트**
   - 연령 제한 명시
   - 법적 면책 조항
   - **위험도: 🔴 높음 → 🟡 중간**

3. **경고문 표시**
   - 성인 콘텐츠 경고
   - 접근 전 확인
   - **위험도: 🔴 높음 → 🟡 중간**

### 7.2 중기 대응 (1-2주)

1. **신용카드 인증 도입**
   - 가장 신뢰성 높음
   - 법적 효력 최대
   - **위험도: 🟡 중간 → 🟢 낮음**

2. **접근 로그 시스템**
   - 법적 증거 자료
   - 수사 대응
   - **위험도: 🟡 중간 → 🟢 낮음**

---

## 8. 비용 분석

### 8.1 구현 비용

| 항목 | 개발 시간 | 비용 |
|------|----------|------|
| **생년월일 입력 + 검증** | 2-4시간 | 개발 비용 |
| **연령 확인 페이지** | 4-8시간 | 개발 비용 |
| **미들웨어 구현** | 2-4시간 | 개발 비용 |
| **데이터베이스 마이그레이션** | 1시간 | 개발 비용 |
| **신용카드 인증** | 8-16시간 | 개발 비용 + API 비용 |
| **휴대폰 인증** | 4-8시간 | 개발 비용 + SMS 비용 |

### 8.2 운영 비용

| 항목 | 월 비용 |
|------|---------|
| **신용카드 인증** | 거래당 ¥100-300 |
| **SMS 인증** | SMS당 ¥10-20 |
| **생년월일 검증** | 무료 |

---

## 9. 최종 권장사항

### ✅ **즉시 구현 (이번 주)**

1. **생년월일 입력 + 연령 확인 페이지**
   - 최소 법적 요구사항 충족
   - 위험도: 🔴 → 🟡

2. **미들웨어 접근 차단**
   - 미성년자 차단
   - 위험도: 🔴 → 🟡

3. **이용약관 업데이트**
   - 법적 조항 명시
   - 위험도: 🔴 → 🟡

### ✅ **1-2주 내 구현 (강력 권장)**

1. **신용카드 인증**
   - 법적 효력 최대
   - 위험도: 🟡 → 🟢

2. **접근 로그 시스템**
   - 법적 증거 자료
   - 위험도: 🟡 → 🟢

---

## ⚠️ **법적 자문 필수**

이 문서는 기술적 가이드이며, 법적 자문을 대체하지 않습니다.

**반드시 다음을 수행하세요:**
1. 일본 변호사와 상담
2. 성인 콘텐츠 관련 법률 전문가 자문
3. 실제 구현 전 법적 검토

---

**작성일**: 2025-01-27  
**최종 업데이트**: 2025-01-27  
**문서 버전**: 1.0

**⚠️ 경고:** 현재 시스템은 법적 요구사항을 충족하지 못합니다.  
**즉시 성인 인증 시스템을 구현하시기 바랍니다.**


