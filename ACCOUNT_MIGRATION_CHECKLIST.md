# 회사 계정 전환 체크리스트

## ✅ 이미 회사 계정으로 전환 완료
- **OpenAI** - 이미 회사 계정으로 생성되어 있음 (패스)

---

## 🔄 회사 계정으로 전환 필요

### 1. **Google Cloud Platform (GCP)**
**현재 상태:**
- 프로젝트 ID: `meta-scanner-466006-v8`
- 서비스 계정: `namosai@meta-scanner-466006-v8.iam.gserviceaccount.com`
- 인증 파일: `gcp/sa.json`, `gemini-credentials.json`

**사용 중인 서비스:**
- **Google Secret Manager** - 환경 변수 및 비밀 관리
  - 저장된 시크릿: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `OPENAI_API_KEY`, `DATABASE_URL`
- **Vertex AI (Gemini)** - AI 모델 (Gemini 2.5 Flash/Pro)
  - 환경 변수: `GOOGLE_PROJECT_ID`
  - 사용 위치: `src/app/api/chat/messages/route.ts`, `src/app/api/characters/generate-*/route.ts` 등
- **Google OAuth 2.0** - NextAuth를 통한 Google 로그인
  - 환경 변수: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - 사용 위치: `src/lib/nextauth.ts`

**전환 작업:**

#### 1단계: GCP 프로젝트 설정
1. 회사 GCP 프로젝트 생성 또는 기존 프로젝트 사용
2. 프로젝트 ID 확인 및 기록

#### 2단계: API 활성화 (중요!)
다음 API들을 활성화해야 합니다:
- **Secret Manager API** (`secretmanager.googleapis.com`)
  - 시크릿 읽기/접근에 필요
- **Vertex AI API** (`aiplatform.googleapis.com`)
  - Gemini 모델 사용에 필요

**활성화 방법:**
```
GCP Console → APIs & Services → Enable APIs and Services
→ 검색하여 각각 활성화
```

#### 3단계: 서비스 계정 생성 및 IAM 역할 부여
1. **서비스 계정 생성**
   - IAM & Admin → Service Accounts → Create Service Account
   - 이름: 예) `namos-chat-service` (회사 정책에 맞게)

2. **필수 IAM 역할 부여** (중요!)
   서비스 계정에 다음 역할들을 부여해야 합니다:
   
   - **Secret Manager Secret Accessor** (`roles/secretmanager.secretAccessor`)
     - Secret Manager에서 시크릿 읽기 권한
   
   - **Vertex AI User** (`roles/aiplatform.user`)
     - Vertex AI (Gemini) 모델 사용 권한
   
   **부여 방법:**
   ```
   서비스 계정 → Permissions 탭 → Grant Access
   → Principal: 서비스 계정 이메일
   → Role: 위 역할들 각각 추가
   ```

3. **서비스 계정 키 생성**
   - 서비스 계정 → Keys 탭 → Add Key → Create new key → JSON
   - 다운로드한 JSON 파일 → `gcp/sa.json` 교체
   - 또는 Base64 인코딩하여 Netlify 환경 변수에 설정

#### 4단계: Secret Manager 설정
1. **Secret Manager에 시크릿 생성**
   다음 시크릿들을 생성해야 합니다:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_ANON_KEY`
   - `OPENAI_API_KEY`
   - `DATABASE_URL`
   - (선택) `UPSTASH_REDIS_REST_URL`
   - (선택) `UPSTASH_REDIS_REST_TOKEN`

2. **시크릿 생성 방법:**
   ```
   Secret Manager → Create Secret
   → Name: 시크릿 이름 (예: SUPABASE_URL)
   → Secret value: 실제 값 입력
   → Create
   ```

3. **서비스 계정 접근 권한 확인**
   - 각 시크릿의 Permissions에서 서비스 계정이 접근 가능한지 확인
   - Secret Manager Secret Accessor 역할이 있으면 자동 접근 가능

#### 5단계: 환경 변수 업데이트
1. 환경 변수 `GOOGLE_PROJECT_ID` 업데이트 (새 프로젝트 ID)
2. Netlify 환경 변수 업데이트:
   - `GOOGLE_PROJECT_ID` - 새 프로젝트 ID
   - `GOOGLE_APPLICATION_CREDENTIALS_JSON` 또는 `GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64`
     - 새 서비스 계정 키 JSON (Base64 인코딩 권장)

#### 6단계: Google OAuth 설정 (NextAuth용)
NextAuth에서 Google 로그인을 사용하므로 OAuth 2.0 클라이언트 ID가 필요합니다:

1. **OAuth 동의 화면 설정**
   - APIs & Services → OAuth consent screen
   - User Type: Internal (회사 계정) 또는 External 선택
   - 앱 정보 입력 (앱 이름, 사용자 지원 이메일 등)
   - 승인된 도메인 추가 (예: `yourdomain.com`)

2. **OAuth 2.0 클라이언트 ID 생성**
   - APIs & Services → Credentials → Create Credentials → OAuth client ID
   - Application type: Web application
   - Name: 예) `Namos Chat Web Client`
   - Authorized JavaScript origins:
     - `http://localhost:3000` (개발용)
     - `https://yourdomain.com` (프로덕션)
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google` (개발용)
     - `https://yourdomain.com/api/auth/callback/google` (프로덕션)
   - Create → Client ID와 Client Secret 복사

3. **환경 변수 설정**
   - `GOOGLE_CLIENT_ID` - OAuth 클라이언트 ID
   - `GOOGLE_CLIENT_SECRET` - OAuth 클라이언트 Secret
   - Google Secret Manager에 등록 (선택)
   - Netlify 환경 변수에도 설정

#### 7단계: 테스트
1. Secret Manager 접근 테스트
2. Vertex AI (Gemini) API 호출 테스트
3. Google OAuth 로그인 테스트
4. 빌드 프로세스에서 GSM 로드 확인

---

### 2. **Supabase**
**현재 상태:**
- 데이터베이스: PostgreSQL with pgvector (벡터 검색)
- 스토리지: 이미지 저장 (buckets: `characters`, `usersImage`)
- 인증: NextAuth 통합

**환경 변수:**
- `SUPABASE_URL` - 프로젝트 URL
- `SUPABASE_SERVICE_ROLE_KEY` - 서비스 역할 키 (서버 사이드)
- `SUPABASE_ANON_KEY` - 익명 키 (클라이언트 사이드)
- `SUPABASE_STORAGE_BUCKET` - 스토리지 버킷명 (기본값: `characters`)

**저장 위치:**
- Google Secret Manager에 저장됨
- Netlify 환경 변수에도 설정 가능

**전환 작업:**
1. 회사 Supabase 프로젝트 생성
2. 데이터베이스 마이그레이션 (Prisma 스키마 적용)
3. pgvector 확장 활성화
4. 스토리지 버킷 생성 (`characters`, `usersImage`)
5. 스토리지 정책 설정 (RLS)
6. Google Secret Manager에 새 자격 증명 등록
7. Netlify 환경 변수 업데이트

---

### 3. **Netlify**
**현재 상태:**
- 배포 플랫폼
- 설정 파일: `netlify.toml`
- 빌드 명령: `node scripts/load-gsm-secrets.js && npm run build`

**전환 작업:**
1. 회사 Netlify 계정 생성 또는 팀 계정에 추가
2. 사이트 연결 (GitHub 리포지토리 연결)
3. 환경 변수 설정:
   - `GOOGLE_PROJECT_ID`
   - `GOOGLE_APPLICATION_CREDENTIALS_JSON` 또는 `GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64`
   - (선택) `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` (GSM 사용 시 불필요)
4. 빌드 설정 확인 (`netlify.toml`)

---

### 4. **Upstash Redis**
**현재 상태:**
- 레이트 리미팅 및 캐싱
- 패키지: `@upstash/redis`

**환경 변수:**
- `UPSTASH_REDIS_REST_URL` - Redis REST API URL
- `UPSTASH_REDIS_REST_TOKEN` - Redis REST API 토큰

**사용 위치:**
- `src/lib/redis.ts` - Redis 클라이언트
- `src/lib/rateLimit.ts` - 레이트 리미팅
- `src/app/api/characters/[id]/route.ts` - 캐시 무효화

**전환 작업:**
1. 회사 Upstash 계정 생성
2. Redis 데이터베이스 생성
3. REST URL 및 토큰 확인
4. Google Secret Manager에 등록 (선택)
5. Netlify 환경 변수 설정

---

### 5. **Vector Database**
**현재 상태:**
- **별도 벡터 DB 없음** - Supabase PostgreSQL의 **pgvector** 확장 사용
- 벡터 검색 기능: `src/lib/vector-search.ts`
- 사용 테이블: `chat_message`, `detailed_memories`, `chat`, `lorebooks`, `embeddings`

**전환 작업:**
- Supabase 전환 시 자동 포함 (pgvector 확장만 활성화하면 됨)

---

### 6. **GitHub** (코드 저장소)
**현재 상태:**
- 코드 저장소 (확인 필요)
- GitHub Actions 워크플로우 가능성 (`.github/workflows` 디렉토리 존재)

**전환 작업:**
1. 회사 GitHub 조직/계정 확인
2. 리포지토리 전송 또는 새 리포지토리 생성
3. Netlify와 새 리포지토리 연결
4. (선택) GitHub Actions 시크릿 설정

---

## 📋 환경 변수 전체 목록

### Google Cloud Platform
- `GOOGLE_PROJECT_ID` - GCP 프로젝트 ID
- `GOOGLE_APPLICATION_CREDENTIALS` - 서비스 계정 파일 경로
- `GOOGLE_APPLICATION_CREDENTIALS_JSON` - 서비스 계정 JSON (평문)
- `GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64` - 서비스 계정 JSON (Base64)
- `GOOGLE_CLIENT_ID` - OAuth 2.0 클라이언트 ID (NextAuth용)
- `GOOGLE_CLIENT_SECRET` - OAuth 2.0 클라이언트 Secret (NextAuth용)

### Supabase
- `SUPABASE_URL` - Supabase 프로젝트 URL
- `SUPABASE_SERVICE_ROLE_KEY` - 서비스 역할 키
- `SUPABASE_ANON_KEY` - 익명 키
- `SUPABASE_STORAGE_BUCKET` - 스토리지 버킷명 (기본값: `characters`)
- `NEXT_PUBLIC_SUPABASE_URL` - 클라이언트용 (빌드 시 설정)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - 클라이언트용 (빌드 시 설정)

### Upstash Redis
- `UPSTASH_REDIS_REST_URL` - Redis REST API URL
- `UPSTASH_REDIS_REST_TOKEN` - Redis REST API 토큰

### Database
- `DATABASE_URL` - PostgreSQL 연결 문자열 (Supabase에서 제공)

### OpenAI (이미 회사 계정)
- `OPENAI_API_KEY` - OpenAI API 키

---

## 🔍 확인 필요 사항

### AWS S3
- **상태**: 패키지에 포함되어 있으나 **실제 사용 안 함**
- **대체**: Supabase Storage 사용 중
- **조치**: 불필요 시 `@aws-sdk/client-s3` 패키지 제거 가능

---

## 📝 전환 순서 권장사항

1. **Supabase** - 데이터베이스 및 스토리지 (가장 중요)
2. **Google Cloud Platform** - Secret Manager 및 Vertex AI
3. **Upstash Redis** - 레이트 리미팅
4. **Netlify** - 배포 플랫폼
5. **GitHub** - 코드 저장소

---

## ⚠️ 주의사항

1. **데이터 마이그레이션**: Supabase 전환 시 기존 데이터 백업 및 마이그레이션 필요
2. **다운타임**: 전환 중 서비스 중단 시간 최소화 계획 수립
3. **환경 변수 동기화**: Google Secret Manager와 Netlify 환경 변수 일치 확인
4. **테스트**: 각 서비스 전환 후 충분한 테스트 수행

---

## 📚 관련 파일

- `netlify.toml` - Netlify 설정
- `gcp/sa.json` - GCP 서비스 계정 키
- `gemini-credentials.json` - Gemini 인증 정보
- `scripts/load-gsm-secrets.js` - Secret Manager 로더
- `src/lib/prisma.ts` - 데이터베이스 연결 (GSM 사용)
- `src/lib/redis.ts` - Redis 클라이언트
- `src/lib/vector-search.ts` - 벡터 검색 (pgvector)

