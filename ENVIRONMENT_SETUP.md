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

**설정 방법:**
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

**사용 시나리오:**
- 개발자가 로컬에서 기능 개발 및 단위 테스트
- 빠른 피드백을 위한 개발 사이클

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

### ✅ 환경 분리가 필요한 경우

1. **데이터베이스 분리 필요**
   - 각 환경마다 독립적인 데이터베이스가 필요한 경우
   - 테스트 데이터가 프로덕션에 영향을 주면 안 되는 경우

2. **외부 서비스 API 키 분리**
   - 테스트용과 프로덕션용 API 키가 다른 경우
   - 비용 관리가 필요한 경우 (테스트 환경에서는 무료/저렴한 플랜 사용)

3. **디버깅 및 로깅 레벨 차이**
   - 로컬/통합 테스트에서는 상세한 로그 필요
   - 스테이징/프로덕션에서는 보안을 위해 최소한의 로그만

4. **테스트 기능 관리**
   - 테스트 전용 기능을 프로덕션에 노출하면 안 되는 경우
   - 개발자 도구나 디버그 기능 제어

5. **성능 모니터링 분리**
   - 각 환경별로 별도의 모니터링이 필요한 경우

### ❌ 환경 분리가 불필요한 경우

1. **소규모 프로젝트**
   - 개발자가 1-2명인 경우
   - 빠른 프로토타이핑 단계

2. **단순한 애플리케이션**
   - 외부 서비스 의존성이 적은 경우
   - 데이터베이스가 단순한 경우

3. **비용 제약**
   - 추가 환경 구축 비용이 부담되는 경우

## 권장 사항

### 최소 구성 (권장)
- **로컬 환경**: 개발자가 로컬에서 테스트
- **스테이징 환경**: 프로덕션 배포 전 검증

### 완전한 구성 (대규모 프로젝트)
- **로컬 환경**: 개발자 로컬 테스트
- **통합 테스트 환경**: CI/CD 파이프라인에서 자동 테스트
- **스테이징 환경**: 수동 QA 및 클라이언트 검증
- **프로덕션 환경**: 실제 서비스

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

