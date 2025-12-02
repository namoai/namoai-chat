# 환경(Environment) 설정 가이드

이 프로젝트는 다음 3가지 환경을 지원합니다:

1. **로컬 테스트 환경 (local)** - 개발자가 로컬에서 테스트
2. **IT(결합) 테스트 환경 (integration)** - 시스템 통합 및 결합 테스트
3. **혼방(스테이징) 환경 (staging)** - 프로덕션 배포 전 최종 검증

## 환경 구분 방법

환경은 `APP_ENV` 환경 변수로 구분됩니다:

- `APP_ENV=local` → 로컬 테스트 환경
- `APP_ENV=integration` → IT(결합) 테스트 환경
- `APP_ENV=staging` → 혼방(스테이징) 환경
- `APP_ENV=production` → 프로덕션 환경 (또는 `APP_ENV` 미설정 시 `NODE_ENV=production`이면 자동)

## 환경별 설정

### 1. 로컬 테스트 환경 (local)

> ⚡ **빠른 설정**: 자동 설정 스크립트를 사용하면 한 번의 명령으로 모든 설정이 완료됩니다!
> 
> ```bash
> npm run setup:local
> ```
> 
> 자세한 내용은 [로컬 환경 설정 가이드](./LOCAL_SETUP_GUIDE.md)를 참고하세요.

**설정 방법:**

**방법 1: 자동 설정 (권장) ⭐**
```bash
npm run setup:local
```

**방법 2: 수동 설정**
```bash
# .env.local
APP_ENV=local
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3000
DATABASE_URL=postgresql://localhost:5432/namos_chat_local
```

**특징:**
- ✅ 데이터 변경 허용
- ✅ 디버그 로그 활성화
- ✅ 테스트 기능 활성화
- ✅ 실제 서비스 사용 (모킹 없음)
- ✅ Docker Compose로 PostgreSQL 자동 설정 가능
- ✅ pgvector 확장 자동 설치

**사용 시나리오:**
- 개발자가 로컬에서 기능 개발 및 단위 테스트
- 빠른 피드백을 위한 개발 사이클
- 팀원 4명이 각자 로컬 환경에서 독립적으로 개발

### 2. IT(결합) 테스트 환경 (integration)

**설정 방법:**
```bash
# .env.integration 또는 배포 환경 변수
APP_ENV=integration
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://it-test.example.com
NEXT_PUBLIC_IT_API_URL=https://it-test.example.com
IT_DATABASE_URL=postgresql://it-db.example.com:5432/namos_chat_it
```

**특징:**
- ✅ 데이터 변경 허용
- ✅ 디버그 로그 활성화
- ✅ 테스트 기능 활성화
- ✅ 실제 서비스 사용

**사용 시나리오:**
- 시스템 간 통합 테스트
- API 결합 테스트
- E2E 테스트
- 회귀 테스트

### 3. 혼방(스테이징) 환경 (staging)

**설정 방법:**
```bash
# 배포 환경 변수
APP_ENV=staging
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://staging.example.com
NEXT_PUBLIC_STAGING_API_URL=https://staging.example.com
STAGING_DATABASE_URL=postgresql://staging-db.example.com:5432/namos_chat_staging
```

**특징:**
- ✅ 데이터 변경 허용
- ❌ 디버그 로그 비활성화
- ❌ 테스트 기능 비활성화
- ✅ 실제 서비스 사용

**사용 시나리오:**
- 프로덕션 배포 전 최종 검증
- 클라이언트/QA 팀의 수락 테스트
- 성능 테스트
- 보안 검증

## 코드에서 환경 사용하기

### 기본 사용법

```typescript
import { 
  getEnvironmentType, 
  getEnvironmentConfig,
  isLocal,
  isIntegration,
  isStaging,
  isProduction,
  shouldEnableDebugLogs,
  shouldEnableTestFeatures,
  allowMutations
} from '@/lib/environment';

// 현재 환경 타입 확인
const envType = getEnvironmentType(); // 'local' | 'integration' | 'staging' | 'production'

// 환경별 설정 가져오기
const config = getEnvironmentConfig();

// 환경별 조건 분기
if (isLocal()) {
  console.log('로컬 환경입니다');
}

if (isIntegration()) {
  console.log('통합 테스트 환경입니다');
}

if (isStaging()) {
  console.log('스테이징 환경입니다');
}

// 디버그 로그 조건부 출력
if (shouldEnableDebugLogs()) {
  console.log('[DEBUG] 상세한 디버그 정보');
}

// 테스트 기능 활성화 여부 확인
if (shouldEnableTestFeatures()) {
  // 테스트 전용 기능 표시
}
```

### 실제 사용 예시

```typescript
// API 라우트에서
import { isLocal, shouldEnableDebugLogs } from '@/lib/environment';

export async function GET() {
  if (shouldEnableDebugLogs()) {
    console.log('[API] GET 요청 받음');
  }
  
  // 로컬 환경에서만 상세한 에러 정보 반환
  try {
    // ... 로직
  } catch (error) {
    if (isLocal()) {
      return NextResponse.json({ 
        error: error.message,
        stack: error.stack 
      }, { status: 500 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
```

## 배포 환경별 설정

### Netlify

Netlify Dashboard → Site configuration → Environment variables:

**Production (main 브랜치):**
```
APP_ENV=production
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://example.com
```

**Deploy Preview (PR 브랜치):**
```
APP_ENV=integration
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://it-test.example.com
```

**Branch Deploy (develop 브랜치 등):**
```
APP_ENV=staging
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://staging.example.com
```

### AWS Amplify

Amplify Console → App settings → Environment variables:

**Production 브랜치:**
```
APP_ENV=production
NODE_ENV=production
```

**Staging 브랜치:**
```
APP_ENV=staging
NODE_ENV=production
```

**Integration 브랜치:**
```
APP_ENV=integration
NODE_ENV=production
```

## 환경 분리의 필요성

### 📋 개요

프로젝트는 **로컬 테스트 환경**과 **IT 테스트 환경**을 구분하여 사용합니다. 각 환경의 목적과 비용을 이해하고, 팀 상황에 맞게 선택하세요.

---

### 🎯 요점

#### 로컬 테스트 환경
- **필요**: 개발자가 각자 컴퓨터에서 빠르게 테스트
- **비용**: 추가 비용 없음 (로컬 DB 사용)
- **용도**: 단위 테스트, 빠른 피드백, 개인 개발

#### IT 테스트 환경
- **필요성 판단 기준**:
  - 팀 규모: 개발자 3명 이상, CI/CD 파이프라인 사용 시 권장
  - 통합 테스트: 여러 시스템 간 통합 검증 필요 시
  - 프로덕션 안정성: 배포 전 실제 환경과 유사한 검증 필요 시
- **비용**: 필요 시만 실행 시 **약 500-1,000 엔/월**, 24시간 실행 시 **약 3,275 엔/월**

---

### 📊 상세

#### 1. 로컬 테스트 환경 vs IT 테스트 환경

| 항목 | 로컬 테스트 환경 | IT 테스트 환경 |
|------|----------------|---------------|
| **위치** | 각 개발자 컴퓨터 | AWS RDS (클라우드) |
| **비용** | 0 엔/월 | 500-3,275 엔/월 |
| **속도** | 매우 빠름 | 보통 (네트워크 지연) |
| **독립성** | 각자 독립적 | 팀 공유 |
| **통합 테스트** | 어려움 | 가능 |
| **CI/CD 연동** | 어려움 | 가능 |

#### 2. IT 테스트 환경 비용 (엔화)

**환경 사양:**
- 인스턴스: PostgreSQL db.t3.micro
- 리전: ap-northeast-1c (도쿄)
- 배포: Single-AZ (Multi-AZ 아님)

**월 비용 계산 (24시간 실행 시):**
- DB 인스턴스: 0.026 USD/시간 × 24시간 × 30일 = 18.72 USD
- 스토리지 (20GB): 20GB × 0.115 USD/GB = 2.3 USD
- 백업 스토리지 (20GB): 20GB × 0.095 USD/GB = 1.9 USD
- 데이터 전송 (10GB): 첫 1GB 무료 + 9GB × 0.09 USD = 0.81 USD
- **총 월 비용: 약 23.73 USD ≈ 3,560 엔/월**

**비용 절감 방법:**
- **핵심**: 필요할 때만 실행하고, 끝나면 중지!
- AWS CLI로 중지/시작:
  ```bash
  # 중지 (비용 절감)
  aws rds stop-db-instance --db-instance-identifier namos-chat-it
  
  # 시작 (약 5-10분 소요)
  aws rds start-db-instance --db-instance-identifier namos-chat-it
  ```
- 시나리오별 비용:
  - 월 40시간 사용: 약 500 엔/월 (권장)
  - 주 5일, 하루 8시간: 약 969 엔/월
  - 24시간 계속 실행: 약 3,153 엔/월 (비추천)

**AWS 프리 티어:**
- 신규 계정은 12개월간 db.t3.micro 750시간/월 + 20GB 스토리지 무료
- 프리 티어 적용 시: 월 0 엔 (750시간 이내)

#### 3. 환경 간 데이터 이동

**IT 환경 → 스테이징/프로덕션 환경:**

캐릭터 데이터를 IT 환경에서 스테이징 또는 프로덕션 환경으로 이동하는 방법:

1. **API를 통한 캐릭터 Export/Import**
   - IT 환경에서 캐릭터 데이터를 JSON으로 Export
   - 스테이징/프로덕션 환경에서 Import
   - API 엔드포인트: `/api/characters/[id]/import`

2. **데이터베이스 직접 마이그레이션**
   - `pg_dump`로 IT 환경 DB 백업
   - `pg_restore`로 스테이징/프로덕션 환경에 복원
   - 주의: 사용자 데이터는 제외하고 캐릭터 데이터만 이동 권장

3. **수동 복사**
   - IT 환경에서 캐릭터 정보 확인
   - 스테이징/프로덕션 환경에서 동일하게 재생성

**주의사항:**
- IT 환경의 테스트 데이터는 프로덕션에 직접 이동하지 않기
- 반드시 스테이징 환경에서 먼저 검증 후 프로덕션으로 이동
- 사용자 데이터, 채팅 기록 등은 환경별로 분리 유지

---

### ✅ 결론

#### IT 테스트 환경이 필요한 경우
- 개발자 3명 이상
- CI/CD 자동화 테스트 필요
- 통합 테스트 필수
- 프로덕션 안정성 중시

#### IT 테스트 환경이 불필요한 경우
- 개발자 1~2명
- 소규모 프로젝트
- 비용 제약
- 로컬 + 스테이징으로 충분

#### 권장 사항

**최소 구성 (소규모 팀):**
- 로컬 환경: 개발자가 로컬에서 테스트
- 스테이징 환경: 프로덕션 배포 전 검증
- **비용**: IT 환경 없음 → 0 엔/월

**완전한 구성 (대규모 팀):**
- 로컬 환경: 개발자 로컬 테스트
- IT 테스트 환경: CI/CD 파이프라인에서 자동 테스트
- 스테이징 환경: 수동 QA 및 클라이언트 검증
- 프로덕션 환경: 실제 서비스
- **비용**: IT 환경 필요 시만 실행 → 약 500-1,000 엔/월

#### 비용 요약
- IT 테스트 환경 (RDS db.t3.micro, 필요 시만 실행): 약 500-1,000 엔/월
- IT 테스트 환경 (24시간 실행): 약 3,275 엔/월
- 프리 티어 적용 시: 0 엔/월 (12개월간, 750시간 이내)

## 마이그레이션 가이드

기존 코드를 환경 분리 시스템으로 마이그레이션:

1. `APP_ENV` 환경 변수 추가
2. `src/lib/environment.ts`의 유틸리티 함수 사용
3. 하드코딩된 `NODE_ENV` 체크를 환경 타입 체크로 변경
4. 각 환경별 환경 변수 설정

```typescript
// Before
if (process.env.NODE_ENV === 'development') {
  // ...
}

// After
import { isLocal, shouldEnableDebugLogs } from '@/lib/environment';
if (isLocal() || shouldEnableDebugLogs()) {
  // ...
}
```

