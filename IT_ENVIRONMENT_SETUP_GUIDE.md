# IT 테스트 환경 구축 가이드

## 📋 개요

이 가이드는 AWS RDS를 사용하여 IT 테스트 환경을 구축하는 전체 과정을 단계별로 안내합니다.

**예상 소요 시간:** 약 4-6시간  
**필요 권한:** AWS 관리자 권한

---

## 🎯 사전 준비사항

### 필수 항목
- [ ] AWS 계정 (관리자 권한)
- [ ] AWS CLI 설치 및 설정 (선택사항, 관리 패널 사용 시 불필요)
- [ ] 프로젝트 저장소 클론 완료
- [ ] SUPER_ADMIN 권한 계정 (관리 패널 접근용)

### 확인 사항
- [ ] AWS 리전: ap-northeast-1 (도쿄) 권장
- [ ] VPC 및 보안 그룹 설정 권한
- [ ] RDS 생성 권한

---

## 📝 단계별 구축 가이드

### 1단계: AWS RDS 인스턴스 생성

#### 1.1 AWS Console 접속

1. [AWS Console](https://console.aws.amazon.com/)에 로그인
2. **RDS** 서비스로 이동
3. 리전을 **ap-northeast-1 (도쿄)**로 선택

#### 1.2 데이터베이스 생성

1. **데이터베이스 생성** 버튼 클릭

2. **데이터베이스 생성 방법 선택**
   - ✅ **표준 생성** 선택

3. **엔진 옵션**
   - **엔진 유형**: PostgreSQL
   - **버전**: 16.x (또는 프로덕션과 동일한 버전)
   - **템플릿**: 프로덕션 (또는 무료 티어 - 신규 계정인 경우)

4. **설정**
   - **DB 인스턴스 식별자**: `namos-chat-it`
   - **마스터 사용자 이름**: `postgres` (또는 원하는 사용자명)
   - **마스터 암호**: 강력한 비밀번호 설정 (반드시 기록 보관!)

5. **인스턴스 구성**
   - **DB 인스턴스 클래스**: `db.t3.micro` (프리 티어 또는 최소 사양)
   - **스토리지**: 
     - **스토리지 유형**: 범용 SSD (gp3)
     - **할당된 스토리지**: 20 GB (프리 티어는 20GB 무료)

6. **연결**
   - **VPC**: 기본 VPC 또는 프로덕션과 동일한 VPC
   - **퍼블릭 액세스**: 
     - ✅ **예** (관리 패널에서 접근하려면 필요)
     - 또는 VPC 내부에서만 접근하려면 **아니오** (보안 그룹 설정 필요)
   - **VPC 보안 그룹**: 
     - 기존 보안 그룹 선택 또는 새로 생성
     - **포트**: 5432 (PostgreSQL 기본 포트)

7. **데이터베이스 인증**
   - **데이터베이스 인증**: 비밀번호 인증

8. **추가 구성**
   - **초기 데이터베이스 이름**: `namos_chat_it` (선택사항)
   - **DB 파라미터 그룹**: 기본값 사용
   - **옵션 그룹**: 기본값 사용
   - **백업**: 
     - ✅ **자동 백업 활성화** (권장)
     - **백업 보존 기간**: 7일

9. **암호화**
   - **암호화**: 선택사항 (프로덕션과 동일하게 설정 권장)

10. **모니터링**
    - **향상된 모니터링**: 비활성화 (비용 절감)

11. **유지 관리**
    - **자동 마이너 버전 업그레이드**: 선택사항

12. **생성**
    - 모든 설정 확인 후 **데이터베이스 생성** 클릭
    - ⏳ **약 5-10분 소요**

#### 1.3 인스턴스 정보 확인

생성 완료 후 다음 정보를 확인하고 기록:

- **엔드포인트**: `namos-chat-it.xxxxx.ap-northeast-1.rds.amazonaws.com`
- **포트**: `5432`
- **데이터베이스 이름**: `namos_chat_it` (또는 생성 시 지정한 이름)
- **사용자 이름**: `postgres` (또는 생성 시 지정한 이름)
- **비밀번호**: 생성 시 설정한 비밀번호

---

### 2단계: pgvector 확장 설치

#### 2.1 데이터베이스 연결

**방법 1: AWS RDS Query Editor 사용 (권장)**

1. RDS Console → 생성한 인스턴스 선택
2. **Query Editor** 탭 클릭
3. 연결 정보 입력:
   - 데이터베이스 이름: `namos_chat_it`
   - 사용자 이름: `postgres`
   - 비밀번호: 설정한 비밀번호
4. **연결** 클릭

**방법 2: 로컬에서 psql 사용**

```bash
psql -h namos-chat-it.xxxxx.ap-northeast-1.rds.amazonaws.com \
     -U postgres \
     -d namos_chat_it \
     -p 5432
```

#### 2.2 pgvector 확장 설치

연결 후 다음 SQL 실행:

```sql
-- pgvector 확장 설치
CREATE EXTENSION IF NOT EXISTS vector;

-- 설치 확인
SELECT * FROM pg_extension WHERE extname = 'vector';
```

---

### 3단계: 환경 변수 설정

#### 3.1 DATABASE_URL 구성

IT 환경의 데이터베이스 연결 문자열:

```
postgresql://[사용자명]:[비밀번호]@[엔드포인트]:[포트]/[데이터베이스명]
```

**예시:**
```
postgresql://postgres:your_password@namos-chat-it.xxxxx.ap-northeast-1.rds.amazonaws.com:5432/namos_chat_it
```

#### 3.2 배포 환경 변수 설정

**Netlify 환경 변수 설정:**

1. Netlify Dashboard → Site settings → Environment variables
2. 다음 변수 추가:

```bash
# IT 환경 설정 (Deploy Preview 또는 IT 브랜치용)
APP_ENV=integration
NODE_ENV=production
IT_DATABASE_URL=postgresql://postgres:your_password@namos-chat-it.xxxxx.ap-northeast-1.rds.amazonaws.com:5432/namos_chat_it
NEXT_PUBLIC_API_URL=https://it-test.yourdomain.com

# IT 환경 제어용 (프로덕션/스테이징 환경에 설정)
IT_RDS_INSTANCE_IDENTIFIER=namos-chat-it
AWS_REGION=ap-northeast-1
```

**AWS Amplify 환경 변수 설정:**

1. Amplify Console → App settings → Environment variables
2. 위와 동일한 변수 추가

**주의사항:**
- `IT_DATABASE_URL`은 IT 환경에서만 사용
- 프로덕션/스테이징 환경에는 `IT_RDS_INSTANCE_IDENTIFIER`만 설정 (관리 패널 제어용)

---

### 4단계: Prisma 마이그레이션 실행

#### 4.1 IT 환경에서 마이그레이션 실행

**방법 1: 환경 변수로 직접 실행**

```bash
# IT 환경 DATABASE_URL 설정
export IT_DATABASE_URL="postgresql://postgres:password@namos-chat-it.xxxxx.ap-northeast-1.rds.amazonaws.com:5432/namos_chat_it"

# 마이그레이션 실행
npx prisma migrate deploy --schema=./prisma/schema.prisma

# 또는 개발 모드로 실행 (마이그레이션 파일 생성)
DATABASE_URL=$IT_DATABASE_URL npx prisma migrate dev
```

**방법 2: .env 파일 사용**

`.env.it` 파일 생성:

```bash
# .env.it
APP_ENV=integration
NODE_ENV=production
IT_DATABASE_URL=postgresql://postgres:password@namos-chat-it.xxxxx.ap-northeast-1.rds.amazonaws.com:5432/namos_chat_it
```

마이그레이션 실행:

```bash
# 환경 변수 로드 후 실행
source .env.it
npx prisma migrate deploy
```

#### 4.2 Prisma Client 생성

```bash
npx prisma generate
```

#### 4.3 데이터베이스 스키마 확인

```bash
# Prisma Studio로 확인 (선택사항)
DATABASE_URL=$IT_DATABASE_URL npx prisma studio
```

---

### 5단계: 보안 그룹 설정 (약 10분)

#### 5.1 자동 설정 (권장)

**사전 요구사항:**
- AWS CLI 설치 및 설정 완료
- AWS 자격 증명 설정 (`aws configure` 또는 환경 변수)

**방법 1: 자동 스크립트 사용**

```bash
# 환경 변수 설정 (선택사항)
export IT_RDS_INSTANCE_IDENTIFIER=namos-chat-it
export AWS_REGION=ap-northeast-1
export SOURCE_SECURITY_GROUP_ID=sg-xxxxx  # 프로덕션/스테이징 보안 그룹 ID (선택사항)

# 자동 설정 실행
npm run it:setup-security
```

스크립트가 자동으로:
- RDS 인스턴스 정보 확인
- 보안 그룹 ID 자동 감지
- 현재 IP에서 접근 허용 또는 소스 보안 그룹 규칙 추가

**방법 2: 수동 설정 (AWS Console)**

1. RDS Console → 인스턴스 선택 → **연결 및 보안** 탭
2. **VPC 보안 그룹** 클릭
3. **인바운드 규칙 편집**

**규칙 추가:**
- **유형**: PostgreSQL
- **프로토콜**: TCP
- **포트**: 5432
- **소스**: 
  - 특정 IP 주소 (개발자 IP)
  - 또는 프로덕션/스테이징 환경의 보안 그룹
  - 또는 0.0.0.0/0 (비추천, 보안 위험)

---

### 6단계: 관리 패널 연동 확인

#### 6.1 프로덕션/스테이징 환경 설정

프로덕션 또는 스테이징 환경의 환경 변수에 다음 추가:

```bash
# IT 환경 제어용 (프로덕션/스테이징 환경에만 설정)
IT_RDS_INSTANCE_IDENTIFIER=namos-chat-it
AWS_REGION=ap-northeast-1

# AWS 자격 증명 (IAM 역할 사용 시 불필요)
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...
```

#### 6.2 AWS IAM 권한 설정 (약 20분)

관리 패널에서 IT 환경을 제어하려면 다음 IAM 권한 필요:

**최소 권한 정책:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "rds:DescribeDBInstances",
        "rds:StartDBInstance",
        "rds:StopDBInstance"
      ],
      "Resource": "arn:aws:rds:ap-northeast-1:*:db:namos-chat-it"
    }
  ]
}
```

**방법 1: 자동 스크립트 사용 (IAM 역할이 있는 경우)**

```bash
# 환경 변수 설정
export IT_RDS_INSTANCE_IDENTIFIER=namos-chat-it
export AWS_REGION=ap-northeast-1
export IAM_ROLE_NAME=your-iam-role-name  # IAM 역할 이름

# 자동 설정 실행
npm run it:setup-security
```

스크립트가 자동으로:
- IAM 정책 생성
- IAM 역할에 정책 연결

**방법 2: 수동 설정 (AWS Console)**

1. AWS Console → IAM → 역할 또는 사용자 선택
2. **권한 추가** → **인라인 정책 생성**
3. 위 JSON 정책 붙여넣기
4. 저장

**주의사항:**
- 프로덕션/스테이징 환경의 IAM 역할 또는 사용자에 권한 부여
- 최소 권한 원칙 준수 (특정 RDS 인스턴스만 제어 가능)

#### 6.3 관리 패널 접속 테스트

1. 프로덕션 또는 스테이징 환경에 로그인
2. SUPER_ADMIN 권한으로 `/admin` 접속
3. **IT 테스트 환경 관리** 카드 클릭
4. IT 환경 상태 확인 및 시작/중지 테스트

---

### 7단계: 연결 테스트

#### 7.1 애플리케이션에서 연결 테스트

**로컬에서 테스트:**

```bash
# .env.local에 IT 환경 URL 추가 (테스트용)
IT_DATABASE_URL=postgresql://postgres:password@namos-chat-it.xxxxx.ap-northeast-1.rds.amazonaws.com:5432/namos_chat_it

# APP_ENV를 integration으로 설정
APP_ENV=integration

# 개발 서버 시작
npm run dev
```

**연결 확인:**
- 애플리케이션이 정상적으로 시작되는지 확인
- 데이터베이스 쿼리가 정상 작동하는지 확인

#### 7.2 데이터베이스 직접 연결 테스트

```bash
# psql로 직접 연결 테스트
psql -h namos-chat-it.xxxxx.ap-northeast-1.rds.amazonaws.com \
     -U postgres \
     -d namos_chat_it \
     -p 5432

# 연결 성공 시 다음 명령어 실행
\dt  # 테이블 목록 확인
SELECT version();  # PostgreSQL 버전 확인
```

---

## ✅ 체크리스트

구축 완료 후 확인 사항:

- [ ] AWS RDS 인스턴스 생성 완료
- [ ] pgvector 확장 설치 완료
- [ ] 환경 변수 설정 완료 (IT_DATABASE_URL, IT_RDS_INSTANCE_IDENTIFIER)
- [ ] Prisma 마이그레이션 실행 완료
- [ ] 보안 그룹 규칙 설정 완료
- [ ] AWS IAM 권한 설정 완료
- [ ] 관리 패널에서 IT 환경 제어 가능
- [ ] 애플리케이션 연결 테스트 성공
- [ ] 데이터베이스 직접 연결 테스트 성공

---

## 🔧 문제 해결

### 문제 1: 연결할 수 없습니다

**원인:**
- 보안 그룹 규칙이 잘못 설정됨
- VPC 설정 문제
- 네트워크 ACL 차단

**해결:**
1. 보안 그룹 인바운드 규칙 확인
2. 소스 IP 주소 또는 보안 그룹 확인
3. VPC 라우팅 테이블 확인

### 문제 2: pgvector 확장을 찾을 수 없습니다

**원인:**
- RDS 인스턴스에 pgvector가 설치되지 않음
- PostgreSQL 버전 호환성 문제

**해결:**
1. PostgreSQL 11 이상 버전 사용 확인
2. 수동으로 pgvector 설치 (RDS 파라미터 그룹 설정)

### 문제 3: 관리 패널에서 제어할 수 없습니다

**원인:**
- AWS IAM 권한 부족
- 환경 변수 미설정
- 인스턴스 식별자 불일치

**해결:**
1. IAM 권한 확인 (rds:DescribeDBInstances, rds:StartDBInstance, rds:StopDBInstance)
2. `IT_RDS_INSTANCE_IDENTIFIER` 환경 변수 확인
3. AWS 리전 확인 (`AWS_REGION=ap-northeast-1`)

### 문제 4: 마이그레이션 실패

**원인:**
- 데이터베이스 연결 실패
- 권한 부족
- 스키마 충돌

**해결:**
1. DATABASE_URL 확인
2. 사용자 권한 확인 (CREATE, ALTER 등)
3. 기존 테이블 확인 및 정리

---

## 💰 비용 최적화 팁

### 1. 필요할 때만 실행

```bash
# 관리 패널에서 시작
# 또는 AWS CLI
aws rds start-db-instance --db-instance-identifier namos-chat-it

# 사용 후 중지
aws rds stop-db-instance --db-instance-identifier namos-chat-it
```

### 2. 프리 티어 활용

- 신규 AWS 계정: 12개월간 750시간/월 무료
- 월 750시간 이내 사용 시 비용 없음

### 3. 자동 중지 스크립트 (선택사항)

스케줄된 작업으로 자동 중지 설정:

```bash
# AWS EventBridge + Lambda로 매일 자정에 자동 중지
# (구현 필요)
```

---

## 📚 참고 자료

- [AWS RDS PostgreSQL 가이드](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html)
- [pgvector 설치 가이드](https://github.com/pgvector/pgvector#installation)
- [Prisma 마이그레이션 가이드](https://www.prisma.io/docs/guides/migrate)

---

**작성일:** 2025-01-27  
**예상 소요 시간:** 4-6시간  
**다음 단계:** 구축 완료 후 테스트 및 검증

