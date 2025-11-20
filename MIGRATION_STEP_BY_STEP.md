# 회사 계정 전환 단계별 가이드

## 📌 현재 상황
- ✅ **AWS 회원가입 완료** (현재는 사용 안 함, 나중에 마이그레이션 시 사용 가능)
- ✅ **OpenAI** - 이미 회사 계정으로 전환 완료
- ⏳ **다음 단계 진행 필요**

---

## 🎯 우선순위별 전환 순서

### 1순위: **Supabase** (가장 중요!)
**왜 먼저?** 데이터베이스와 스토리지가 모든 기능의 기반입니다.

#### 작업 내용:
1. **Supabase 프로젝트 생성**
   - [Supabase Dashboard](https://supabase.com/dashboard) 접속
   - 회사 계정으로 로그인
   - "New Project" 클릭
   - 프로젝트 이름, 데이터베이스 비밀번호 설정
   - 리전 선택 (가장 가까운 리전, 예: Northeast Asia (Seoul))

2. **데이터베이스 설정**
   - Settings → Database → Extensions
   - **pgvector** 확장 활성화 (벡터 검색용)
   - SQL Editor에서 실행:
     ```sql
     CREATE EXTENSION IF NOT EXISTS vector;
     ```

3. **Prisma 마이그레이션**
   ```bash
   # 새 DATABASE_URL로 .env.local 업데이트
   DATABASE_URL="postgresql://postgres:[비밀번호]@[프로젝트].supabase.co:5432/postgres"
   
   # 마이그레이션 실행
   npx prisma migrate deploy
   ```

4. **스토리지 버킷 생성**
   - Storage → Create bucket
   - `characters` 버킷 생성 (Public)
   - `usersImage` 버킷 생성 (Public)
   
5. **스토리지 정책 설정**
   - Storage → Policies → `characters` 버킷
   - 다음 정책 추가:
   
   **업로드 정책 (INSERT):**
   ```sql
   CREATE POLICY "Authenticated users can upload images"
   ON storage.objects
   FOR INSERT
   TO authenticated
   WITH CHECK (
     bucket_id = 'characters' AND
     (storage.foldername(name))[1] = 'uploads'
   );
   ```
   
   **읽기 정책 (SELECT):**
   ```sql
   CREATE POLICY "Public can read images"
   ON storage.objects
   FOR SELECT
   TO public
   USING (bucket_id = 'characters');
   ```

6. **API 키 확인**
   - Settings → API
   - Project URL 복사 → `SUPABASE_URL`
   - `anon` `public` 키 복사 → `SUPABASE_ANON_KEY`
   - `service_role` `secret` 키 복사 → `SUPABASE_SERVICE_ROLE_KEY`

---

### 2순위: **Google Cloud Platform (GCP)**
**왜 두 번째?** Secret Manager와 Vertex AI가 Supabase 자격 증명을 관리하고 AI 기능을 제공합니다.

#### 작업 내용:

#### Step 1: GCP 프로젝트 생성
1. [GCP Console](https://console.cloud.google.com/) 접속
2. 회사 계정으로 로그인
3. 프로젝트 선택 또는 새 프로젝트 생성
4. 프로젝트 ID 기록 (예: `namos-chat-company`)

#### Step 2: API 활성화
1. **APIs & Services → Enable APIs and Services**
2. 다음 API 검색하여 활성화:
   - `Secret Manager API` → Enable
   - `Vertex AI API` → Enable

#### Step 3: 서비스 계정 생성
1. **IAM & Admin → Service Accounts**
2. **Create Service Account**
   - Service account name: `namos-chat-service`
   - Service account ID: 자동 생성
   - Description: "Namos Chat application service account"
3. **Create and Continue**

#### Step 4: IAM 역할 부여
1. **Grant this service account access to project** 선택
2. 다음 역할 추가:
   - **Secret Manager Secret Accessor** (`roles/secretmanager.secretAccessor`)
   - **Vertex AI User** (`roles/aiplatform.user`)
3. **Continue** → **Done**

#### Step 5: 서비스 계정 키 생성
1. 생성한 서비스 계정 클릭
2. **Keys** 탭 → **Add Key** → **Create new key**
3. **JSON** 선택 → **Create**
4. 다운로드한 JSON 파일 저장 (나중에 사용)

#### Step 6: Secret Manager에 시크릿 등록
1. **Secret Manager** → **Create Secret**
2. 다음 시크릿들을 각각 생성:

   **SUPABASE_URL:**
   - Name: `SUPABASE_URL`
   - Secret value: Supabase에서 복사한 Project URL
   - Create

   **SUPABASE_SERVICE_ROLE_KEY:**
   - Name: `SUPABASE_SERVICE_ROLE_KEY`
   - Secret value: Supabase service_role 키
   - Create

   **SUPABASE_ANON_KEY:**
   - Name: `SUPABASE_ANON_KEY`
   - Secret value: Supabase anon 키
   - Create

   **OPENAI_API_KEY:**
   - Name: `OPENAI_API_KEY`
   - Secret value: 회사 OpenAI API 키
   - Create

   **DATABASE_URL:**
   - Name: `DATABASE_URL`
   - Secret value: Supabase Database URL
   - Create

#### Step 7: Google OAuth 설정 (NextAuth용)
1. **APIs & Services → OAuth consent screen**
   - User Type: Internal (회사 계정) 또는 External
   - App name: "Namos Chat"
   - User support email: 회사 이메일
   - Developer contact: 회사 이메일
   - Save and Continue

2. **Scopes** → Save and Continue

3. **Test users** (Internal인 경우 생략 가능) → Save and Continue

4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `Namos Chat Web Client`
   - Authorized JavaScript origins:
     - `http://localhost:3000` (개발용)
     - `https://yourdomain.com` (프로덕션 - 나중에 추가)
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google` (개발용)
     - `https://yourdomain.com/api/auth/callback/google` (프로덕션 - 나중에 추가)
   - **Create**
   - **Client ID**와 **Client Secret** 복사

#### Step 8: 환경 변수 설정
서비스 계정 키 JSON을 Base64로 인코딩:
```bash
# Windows PowerShell
[Convert]::ToBase64String([System.IO.File]::ReadAllBytes("path/to/service-account-key.json"))
```

Netlify 환경 변수 설정:
- `GOOGLE_PROJECT_ID` = GCP 프로젝트 ID
- `GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64` = Base64 인코딩된 서비스 계정 JSON
- `GOOGLE_CLIENT_ID` = OAuth 클라이언트 ID
- `GOOGLE_CLIENT_SECRET` = OAuth 클라이언트 Secret

---

### 3순위: **Upstash Redis**
**왜 세 번째?** 레이트 리미팅과 캐싱 기능 (선택적이지만 권장)

#### 작업 내용:
1. [Upstash Console](https://console.upstash.com/) 접속
2. 회사 계정으로 로그인
3. **Create Database**
   - Name: `namos-chat-redis`
   - Type: Regional (가장 가까운 리전)
   - Create
4. **REST API** 탭에서:
   - **UPSTASH_REDIS_REST_URL** 복사
   - **UPSTASH_REDIS_REST_TOKEN** 복사
5. Google Secret Manager에 등록 (선택)
6. Netlify 환경 변수에 설정

---

### 4순위: **Netlify**
**왜 네 번째?** 배포 플랫폼 (다른 서비스들이 준비된 후)

#### 작업 내용:
1. [Netlify](https://app.netlify.com/) 접속
2. 회사 계정으로 로그인 또는 팀 계정에 추가
3. **Add new site** → **Import an existing project**
4. GitHub 리포지토리 연결
5. **Site settings** → **Environment variables**에서 다음 설정:
   - `GOOGLE_PROJECT_ID`
   - `GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - (선택) `UPSTASH_REDIS_REST_URL`
   - (선택) `UPSTASH_REDIS_REST_TOKEN`
6. **Build settings** 확인:
   - Build command: `node scripts/load-gsm-secrets.js && npm run build`
   - Publish directory: `.next`

---

### 5순위: **GitHub** (코드 저장소)
**왜 마지막?** 코드 저장소는 나중에 옮겨도 됨

#### 작업 내용:
1. 회사 GitHub 조직/계정 확인
2. 새 리포지토리 생성 또는 기존 리포지토리로 전송
3. Netlify와 새 리포지토리 연결

---

## ✅ 체크리스트

### Supabase
- [ ] 프로젝트 생성
- [ ] pgvector 확장 활성화
- [ ] Prisma 마이그레이션 완료
- [ ] 스토리지 버킷 생성 (`characters`, `usersImage`)
- [ ] 스토리지 정책 설정
- [ ] API 키 확인 및 저장

### Google Cloud Platform
- [ ] 프로젝트 생성
- [ ] Secret Manager API 활성화
- [ ] Vertex AI API 활성화
- [ ] 서비스 계정 생성
- [ ] IAM 역할 부여 (Secret Manager, Vertex AI)
- [ ] 서비스 계정 키 생성 및 다운로드
- [ ] Secret Manager에 시크릿 등록 (5개)
- [ ] OAuth 동의 화면 설정
- [ ] OAuth 클라이언트 ID 생성
- [ ] 환경 변수 준비

### Upstash Redis
- [ ] 계정 생성
- [ ] Redis 데이터베이스 생성
- [ ] REST URL 및 토큰 확인

### Netlify
- [ ] 계정 생성 또는 팀 추가
- [ ] 사이트 생성 및 GitHub 연결
- [ ] 환경 변수 설정
- [ ] 빌드 설정 확인

### GitHub
- [ ] 리포지토리 생성 또는 전송
- [ ] Netlify 연결

---

## 🚀 다음 단계

**지금 바로 시작할 것:**
1. **Supabase 프로젝트 생성** (가장 중요!)
2. **GCP 프로젝트 생성 및 API 활성화**

**AWS는?**
- 현재는 사용하지 않으므로 나중에 마이그레이션할 때 사용
- 지금은 Supabase와 GCP에 집중하세요!

---

## 📞 문제 발생 시

각 서비스별 지원 문서:
- Supabase: [docs.supabase.com](https://docs.supabase.com)
- GCP: [cloud.google.com/docs](https://cloud.google.com/docs)
- Netlify: [docs.netlify.com](https://docs.netlify.com)

