# IT 환경 브랜치 설정 가이드

## 📋 개요

**새 Amplify 앱을 만들 필요 없습니다!**  
기존 혼방(스테이징) 환경 Amplify 앱에 **IT 환경 전용 브랜치**를 추가하고, 브랜치별로 환경 변수를 다르게 설정하면 됩니다.

**⚠️ Git 브랜치를 나누고 싶지 않다면:**  
[IT_ENVIRONMENT_SIMPLE_SETUP.md](./IT_ENVIRONMENT_SIMPLE_SETUP.md)를 참고하세요.  
같은 Git 브랜치를 사용하면서 별도의 Amplify 앱을 만들 수도 있습니다!

---

## 🚀 간단한 구축 방법

### 방법 1: Amplify Console에서 브랜치 추가 (가장 간단)

#### 1단계: 기존 Amplify 앱 선택

1. **AWS Amplify Console** 접속
2. 기존 혼방 환경 앱 선택 (또는 프로덕션 앱)

#### 2단계: 브랜치 추가

1. 앱 선택 → **"분기"** 또는 **"Branches"** 탭 클릭
2. **"분기 추가"** 또는 **"Add branch"** 클릭
3. 브랜치 정보 입력:
   - **분기 이름**: `it-test` 또는 `integration`
   - **소스 분기**: `main` 또는 `develop` (기존 브랜치)
   - **분기 설정 복사**: ✅ 체크 (기존 브랜치 설정 복사)

#### 3단계: 브랜치별 환경 변수 설정

1. 추가한 브랜치 선택
2. **"환경 변수"** 또는 **"Environment variables"** 클릭
3. **"분기별 환경 변수 관리"** 선택

**IT 환경 전용 환경 변수 설정:**

기존 환경 변수는 그대로 두고, 다음만 변경/추가:

```bash
# 환경 구분 (가장 중요!)
APP_ENV=integration  # ← 이게 핵심! 혼방은 staging, 프로덕션은 production

# IT 환경 데이터베이스
DATABASE_URL=postgresql://postgres:namoai20250701@namoai-it.cluwk88i28od.ap-northeast-1.rds.amazonaws.com:5432/postgres
IT_DATABASE_URL=postgresql://postgres:namoai20250701@namoai-it.cluwk88i28od.ap-northeast-1.rds.amazonaws.com:5432/postgres

# IT 환경 RDS 제어용
IT_RDS_INSTANCE_IDENTIFIER=namoai-it
AWS_REGION=ap-northeast-1

# NextAuth URL (IT 환경 URL로 변경)
NEXTAUTH_URL=https://it-test.namos-chat.com  # 또는 Amplify 자동 생성 URL
```

**⚠️ 중요:**
- 다른 환경 변수(Google OAuth, Supabase, Cloudflare 등)는 **그대로 유지**
- `APP_ENV`와 `DATABASE_URL`만 변경하면 됩니다!

#### 4단계: 배포

1. **"저장 후 배포"** 클릭
2. 또는 Git에 푸시하면 자동 배포

---

### 방법 2: Git 브랜치 생성 후 자동 연결

#### 1단계: Git 브랜치 생성

```bash
# IT 환경 전용 브랜치 생성
git checkout -b it-test

# 또는 기존 브랜치에서 생성
git checkout develop
git checkout -b it-test
```

#### 2단계: Amplify에서 자동 감지

1. Amplify Console → 앱 선택
2. **"분기"** 탭에서 새 브랜치 자동 감지
3. **"분기 추가"** 클릭하여 연결

#### 3단계: 브랜치별 환경 변수 설정

위의 "방법 1 - 3단계"와 동일

---

## 🔄 환경별 브랜치 구성 예시

| 브랜치 | APP_ENV | DATABASE_URL | URL | 용도 |
|--------|---------|--------------|-----|------|
| `main` | production | 프로덕션 RDS | namos-chat.com | 프로덕션 |
| `staging` | staging | 스테이징 RDS | staging.namos-chat.com | 혼방 |
| `it-test` | integration | IT RDS | it-test.namos-chat.com | IT 환경 |

**같은 Amplify 앱, 다른 브랜치, 다른 환경 변수!**

---

## ✅ 장점

1. **간단함**: 새 앱 생성 불필요
2. **환경 변수 재사용**: 대부분 환경 변수는 그대로 유지
3. **관리 편의성**: 한 앱에서 모든 환경 관리
4. **비용 효율**: 추가 앱 생성 비용 없음

---

## 📝 환경 변수 변경 체크리스트

IT 환경 브랜치에서 **반드시 변경해야 하는 것:**

- [ ] `APP_ENV=integration` (혼방은 `staging`, 프로덕션은 `production`)
- [ ] `DATABASE_URL` → IT 환경 RDS URL
- [ ] `IT_DATABASE_URL` → IT 환경 RDS URL (동일)
- [ ] `IT_RDS_INSTANCE_IDENTIFIER=namoai-it`
- [ ] `NEXTAUTH_URL` → IT 환경 URL

**그대로 유지해도 되는 것:**

- ✅ `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- ✅ `NEXTAUTH_SECRET`
- ✅ `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- ✅ `CLOUDFLARE_*` 변수들
- ✅ `OPENAI_API_KEY`
- ✅ 기타 모든 환경 변수

---

## 🔧 문제 해결

### 문제 1: 브랜치별 환경 변수가 적용되지 않음

**해결:**
1. Amplify Console → 브랜치 선택
2. **"환경 변수"** → **"분기별 환경 변수 관리"** 확인
3. 환경 변수가 브랜치별로 올바르게 설정되었는지 확인

### 문제 2: 빌드 실패

**원인:**
- `APP_ENV` 미설정
- `DATABASE_URL` 잘못 설정

**해결:**
1. 브랜치별 환경 변수 확인
2. 빌드 로그에서 환경 변수 확인

---

## 📚 참고 자료

- [Amplify 브랜치별 환경 변수](https://docs.aws.amazon.com/amplify/latest/userguide/environment-variables.html#branch-variables)
- [Amplify 브랜치 관리](https://docs.aws.amazon.com/amplify/latest/userguide/managing-branches.html)

---

**작성일:** 2025-01-27  
**다음 단계:** 기존 Amplify 앱에 IT 환경 브랜치 추가 후 환경 변수 설정

