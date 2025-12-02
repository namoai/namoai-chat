# DATABASE_URL 마이그레이션 가이드

## 🎯 목적

기존 코드는 모두 `DATABASE_URL`을 직접 사용하고 있습니다. 환경별로 다른 데이터베이스를 사용하려면 `STAGING_DATABASE_URL`, `IT_DATABASE_URL` 등을 추가할 수 있지만, **기존 코드는 그대로 작동합니다** (하위 호환성 유지).

## ✅ 안전한 마이그레이션 방법

### 현재 상태

현재 모든 코드는 `DATABASE_URL`을 사용합니다:
- `src/lib/prisma.ts` - Prisma 클라이언트
- `src/lib/db.ts` - PostgreSQL Pool
- `src/lib/db/db.ts` - PostgreSQL Pool (export)

### 변경 사항

**하위 호환성을 유지하면서** 환경별 URL을 지원하도록 수정했습니다:

1. **`src/lib/prisma.ts`의 `resolveDatabaseUrl()` 함수**
   - 환경별 URL 우선 사용 (`STAGING_DATABASE_URL`, `IT_DATABASE_URL`)
   - 없으면 기존 `DATABASE_URL` 사용 (하위 호환성)

2. **`src/lib/db.ts`와 `src/lib/db/db.ts`**
   - 새로운 `resolveDatabaseUrlForPool()` 함수 사용
   - 동일한 우선순위 적용

### 우선순위

```
1. STAGING_DATABASE_URL (APP_ENV=staging인 경우)
2. IT_DATABASE_URL (APP_ENV=integration인 경우)
3. DATABASE_URL (기존 코드와의 호환성)
```

## 📋 마이그레이션 단계

### 단계 1: 기존 환경 변수 유지 (필수)

**기존 `DATABASE_URL`은 그대로 유지하세요!**

```bash
# 기존 환경 변수 (그대로 유지)
DATABASE_URL=postgresql://existing-db.example.com:5432/namos_chat
```

### 단계 2: 환경별 URL 추가 (선택)

원하는 환경에만 추가하세요:

```bash
# 스테이징 환경에만 추가
STAGING_DATABASE_URL=postgresql://staging-db.example.com:5432/namos_chat_staging

# IT 환경에만 추가
IT_DATABASE_URL=postgresql://it-db.example.com:5432/namos_chat_it
```

### 단계 3: APP_ENV 설정

```bash
# 스테이징 환경
APP_ENV=staging
DATABASE_URL=postgresql://existing-db.example.com:5432/namos_chat  # 폴백용
STAGING_DATABASE_URL=postgresql://staging-db.example.com:5432/namos_chat_staging  # 우선 사용

# IT 환경
APP_ENV=integration
DATABASE_URL=postgresql://existing-db.example.com:5432/namos_chat  # 폴백용
IT_DATABASE_URL=postgresql://it-db.example.com:5432/namos_chat_it  # 우선 사용
```

## 🔒 안전성 보장

### ✅ 하위 호환성

- **기존 코드는 그대로 작동합니다**
- `STAGING_DATABASE_URL`이 없으면 자동으로 `DATABASE_URL` 사용
- 기존 배포 환경에 영향을 주지 않습니다

### ✅ 점진적 마이그레이션

1. **1단계**: 코드만 배포 (환경 변수 변경 없음)
   - 기존 `DATABASE_URL`만 사용
   - 모든 기능 정상 작동

2. **2단계**: 환경별 URL 추가 (선택)
   - 원하는 환경에만 `STAGING_DATABASE_URL` 또는 `IT_DATABASE_URL` 추가
   - 해당 환경에서만 새로운 URL 사용

3. **3단계**: 검증 후 기존 URL 제거 (선택)
   - 모든 환경이 정상 작동하는지 확인
   - 필요시 기존 `DATABASE_URL` 제거 가능

## 📝 실제 사용 예시

### 시나리오 1: 기존 환경 유지 (권장)

```bash
# .env 또는 환경 변수
DATABASE_URL=postgresql://db.example.com:5432/namos_chat
APP_ENV=production  # 또는 설정 안 함
```

**결과**: 기존과 동일하게 `DATABASE_URL` 사용 ✅

### 시나리오 2: 스테이징 환경 분리

```bash
# 스테이징 환경
APP_ENV=staging
DATABASE_URL=postgresql://db.example.com:5432/namos_chat  # 폴백
STAGING_DATABASE_URL=postgresql://staging-db.example.com:5432/namos_chat_staging  # 우선 사용
```

**결과**: 스테이징 환경에서는 `STAGING_DATABASE_URL` 사용 ✅

### 시나리오 3: IT 환경 분리

```bash
# IT 환경
APP_ENV=integration
DATABASE_URL=postgresql://db.example.com:5432/namos_chat  # 폴백
IT_DATABASE_URL=postgresql://it-db.example.com:5432/namos_chat_it  # 우선 사용
```

**결과**: IT 환경에서는 `IT_DATABASE_URL` 사용 ✅

## ⚠️ 주의사항

### 1. DATABASE_URL은 필수

`STAGING_DATABASE_URL`만 설정하고 `DATABASE_URL`을 제거하면:
- 다른 환경에서 오류 발생 가능
- **권장**: `DATABASE_URL`은 항상 유지

### 2. 환경 변수 확인

배포 전에 환경 변수가 올바르게 설정되었는지 확인:

```bash
# 로컬 테스트
echo $DATABASE_URL
echo $STAGING_DATABASE_URL
echo $APP_ENV
```

### 3. 데이터베이스 연결 테스트

새로운 환경 변수를 추가한 후 반드시 연결 테스트:

```typescript
// 테스트 코드 예시
import { getPrisma } from '@/lib/prisma';

const prisma = await getPrisma();
await prisma.$connect();
console.log('Database connection successful!');
```

## 🚀 배포 체크리스트

- [ ] 기존 `DATABASE_URL` 환경 변수 유지
- [ ] `APP_ENV` 환경 변수 설정 (선택)
- [ ] 환경별 URL 추가 (선택: `STAGING_DATABASE_URL`, `IT_DATABASE_URL`)
- [ ] 로컬에서 테스트
- [ ] 스테이징 환경에서 테스트
- [ ] 프로덕션 배포 전 최종 확인

## 📚 관련 파일

- `src/lib/prisma.ts` - Prisma 클라이언트 (환경별 URL 지원)
- `src/lib/db.ts` - PostgreSQL Pool (환경별 URL 지원)
- `src/lib/db/db.ts` - PostgreSQL Pool export (환경별 URL 지원)
- `src/lib/resolve-database-url.ts` - URL 해결 유틸리티

## 💡 FAQ

### Q: 기존 코드를 수정해야 하나요?

**A: 아니요!** 기존 코드는 그대로 작동합니다. 환경 변수만 추가하면 됩니다.

### Q: STAGING_DATABASE_URL을 설정하지 않으면?

**A: 자동으로 DATABASE_URL을 사용합니다.** 하위 호환성이 보장됩니다.

### Q: 모든 환경에서 DATABASE_URL을 제거해도 되나요?

**A: 권장하지 않습니다.** `DATABASE_URL`은 폴백으로 유지하는 것이 안전합니다.

### Q: 기존 배포 환경에 영향을 주나요?

**A: 아니요.** 환경 변수를 변경하지 않으면 기존과 동일하게 작동합니다.

