# IT 환경 간단 설정 가이드

## 📋 개요

**⚠️ 중요:** IT 환경에서 테스트 중인 기능이 프로덕션/혼방 환경에 자동으로 반영되지 않도록 **Git 브랜치를 분리하는 것을 권장**합니다.

**Git 브랜치 전략:** [GIT_BRANCH_STRATEGY.md](./GIT_BRANCH_STRATEGY.md) 참고

---

## 🚨 Git 브랜치를 나누지 않는 경우의 문제점

- ❌ IT 환경에서 수정한 코드가 프로덕션에 자동 반영
- ❌ 테스트 중인 기능이 실제 서비스에 배포
- ❌ 롤백이 어려움

**따라서 Git 브랜치를 나누는 것을 강력히 권장합니다!**

---

## 🚀 방법: Git 브랜치 분리 (권장)

**간단한 방법:**
1. `develop` 브랜치 생성 (IT 환경용)
2. Amplify에 `develop` 브랜치 연결
3. 환경 변수만 다르게 설정

자세한 내용은 [GIT_BRANCH_STRATEGY.md](./GIT_BRANCH_STRATEGY.md)를 참고하세요.

---

## 🚀 방법: Git 브랜치 없이 (비권장, 테스트 전용)

**방법:**
1. **같은 Git 브랜치 사용** (main 또는 develop)
2. **별도의 Amplify 앱 생성** (하지만 설정 복사 가능!)
3. 또는 **같은 앱에서 수동 배포** 사용

---

## 🚀 방법 1: Amplify 앱 복제 (가장 간단!)

### Amplify Console에서 앱 복제

1. **기존 혼방 환경 Amplify 앱** 선택
2. **"작업"** 또는 **"Actions"** 메뉴 확인
   - 직접 복제 기능이 없을 수 있음
3. **대안: 새 앱 생성 시 설정 복사**

#### 새 앱 생성 시 기존 설정 재사용

1. **AWS Amplify Console** → **"새 앱 호스팅"**
2. **소스 코드 연결**: 같은 저장소, 같은 브랜치 선택
3. **빌드 설정**: 기존 `amplify.yml` 자동 사용
4. **환경 변수**: 수동으로 입력 (아래 참고)

**환경 변수 복사 방법:**
- 기존 앱의 환경 변수를 텍스트로 복사
- 새 앱에 붙여넣기
- `APP_ENV`와 `DATABASE_URL`만 변경

---

## 🚀 방법 2: 같은 브랜치, 다른 앱 (권장!)

### 장점
- ✅ Git 브랜치 관리 불필요
- ✅ 같은 코드베이스 사용
- ✅ 환경 변수만 다르게 설정

### 단계

1. **새 Amplify 앱 생성**
   - 같은 저장소 연결
   - **같은 브랜치 사용** (main 또는 develop)
   
2. **환경 변수 설정**
   - 기존 앱 환경 변수 복사
   - 다음만 변경:
     ```bash
     APP_ENV=integration
     DATABASE_URL=postgresql://...IT 환경 DB...
     IT_DATABASE_URL=postgresql://...IT 환경 DB...
     NEXTAUTH_URL=https://it-test.namos-chat.com
     ```

3. **배포**
   - 자동 배포 또는 수동 배포 선택

---

## 🚀 방법 3: 수동 배포 사용 (완전 제어)

### 같은 앱에서 수동 배포

1. **Amplify Console** → 앱 선택
2. **"수동 배포"** 또는 **"Manual deploy"** 선택
3. **환경 변수 설정** 후 배포
4. 필요할 때만 수동으로 배포

**단점:** 자동 배포 안 됨 (Git 푸시해도 자동 배포 안 됨)

---

## 📝 환경 변수 설정 템플릿

### 기존 앱에서 복사할 환경 변수

기존 혼방 환경 앱의 환경 변수를 모두 복사한 후, 다음만 변경:

```bash
# 변경할 항목 (3개만!)
APP_ENV=integration  # 혼방은 staging
DATABASE_URL=postgresql://postgres:namoai20250701@namoai-it.cluwk88i28od.ap-northeast-1.rds.amazonaws.com:5432/postgres
IT_DATABASE_URL=postgresql://postgres:namoai20250701@namoai-it.cluwk88i28od.ap-northeast-1.rds.amazonaws.com:5432/postgres
NEXTAUTH_URL=https://it-test.namos-chat.com  # IT 환경 URL

# 그대로 복사할 항목 (나머지 모두!)
# GOOGLE_CLIENT_ID=... (그대로)
# GOOGLE_CLIENT_SECRET=... (그대로)
# NEXTAUTH_SECRET=... (그대로)
# NEXT_PUBLIC_SUPABASE_URL=... (그대로)
# CLOUDFLARE_*=... (그대로)
# OPENAI_API_KEY=... (그대로)
# 등등...
```

---

## ✅ 추천 방법

**방법 2 (같은 브랜치, 다른 앱)**를 추천합니다:

1. ✅ Git 브랜치 관리 불필요
2. ✅ 환경 변수만 다르게 설정
3. ✅ 자동 배포 가능
4. ✅ 환경 분리 명확

**단점:**
- 새 Amplify 앱 생성 필요 (하지만 설정 복사 가능)

---

## 🔧 빠른 설정 체크리스트

1. [ ] AWS Amplify Console 접속
2. [ ] "새 앱 호스팅" 클릭
3. [ ] 같은 저장소, 같은 브랜치 연결
4. [ ] 기존 앱 환경 변수 복사
5. [ ] `APP_ENV=integration` 변경
6. [ ] `DATABASE_URL` → IT 환경 DB로 변경
7. [ ] 배포

**총 소요 시간: 약 10-15분**

---

## 💡 팁

### 환경 변수 일괄 복사

1. 기존 앱 → **"환경 변수"** → **"내보내기"** (있는 경우)
2. 또는 수동으로 복사
3. 새 앱에 붙여넣기
4. 3개 항목만 수정

### 자동화 스크립트 (선택사항)

나중에 환경 변수를 자동으로 복사하는 스크립트를 만들 수도 있습니다.

---

**작성일:** 2025-01-27  
**핵심:** Git 브랜치 나눌 필요 없음! 같은 브랜치 사용, 환경 변수만 다르게!

                                    