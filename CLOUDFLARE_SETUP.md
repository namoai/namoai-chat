# 🔧 Cloudflare Images 설정 가이드

이 프로젝트는 이미지 스토리지로 **Cloudflare Images**를 사용합니다.

## 📋 필수 환경 변수

### 1️⃣ **Cloudflare Account ID 확인** ⭐ 중요

**Account ID란?**
- Cloudflare 계정을 식별하는 고유한 ID입니다
- 보통 **32자리 영숫자 문자열**입니다 (예: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)
- ⚠️ **주의**: "namoai-chat" 같은 계정 이름이 아닙니다!

**✅ 중요: 도메인 등록은 필요 없습니다!**
- Cloudflare Images는 **도메인 없이도 사용 가능**합니다
- 무료 계정으로도 사용 가능합니다
- 계정만 있으면 Account ID가 표시됩니다

**확인 방법 (가장 확실한 방법):**

1. **[Cloudflare Dashboard](https://dash.cloudflare.com/)에 로그인**

2. **왼쪽 사이드바에서 "My Profile" 클릭**
   - Dashboard 왼쪽 하단에 있는 **사람 아이콘** 또는 **"My Profile"** 클릭

3. **"API Tokens" 탭 클릭**
   - My Profile 페이지에서 **"API Tokens"** 탭을 클릭합니다

4. **Account ID 확인**
   - API Tokens 페이지 **상단**에 **"Account ID"**가 표시됩니다
   - 예시: `Account ID: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`
   - 복사 버튼을 클릭하거나 직접 복사합니다

**다른 확인 방법:**

**방법 2: 오른쪽 사이드바 확인** ⭐ 가장 확실한 방법
- 현재 페이지(계정 홈)의 **오른쪽 사이드바**를 확인하세요
- 오른쪽 사이드바에 **"Account ID"** 또는 **"계정 ID"** 섹션이 있을 수 있습니다
- 스크롤을 내려서 확인해보세요

**방법 3: API Token 생성 시 확인** ⭐ 추천
1. 왼쪽 사이드바에서 **"My Profile"** (또는 사람 아이콘) 클릭
2. **"API Tokens"** 탭 클릭
3. **"Create Token"** 버튼 클릭
4. Token 생성 과정에서 Account ID가 표시될 수 있습니다
5. 또는 생성된 Token의 권한 설정에서 Account ID를 확인할 수 있습니다

**방법 4: URL에서 확인**
- 현재 페이지의 URL을 확인해보세요
- URL 형식: `https://dash.cloudflare.com/{account-id}/...`
- URL의 `/` 사이에 있는 값이 Account ID일 수 있습니다

**방법 5: 실제로 테스트해보기**
- "namoai-chat"을 Account ID로 사용해보고 에러가 나는지 확인
- 에러가 나면 다른 방법으로 찾기
- 작동한다면 그것이 실제 Account ID일 수 있습니다

**⚠️ 중요: "namoai-chat" 같은 값이 표시되는 경우**
- 스크린샷에서 "Account ID: namoai-chat"이 표시되는 경우:
  - 이것은 **계정 이름**일 수 있습니다
  - 실제 Account ID는 보통 **32자리 영숫자**입니다
  - 하지만 일부 계정에서는 다른 형식일 수도 있습니다
  - **실제로 API를 호출해서 테스트**해보는 것이 가장 확실합니다

**⚠️ Account ID를 찾을 수 없는 경우:**
1. **계정이 제대로 생성되었는지 확인**
   - Cloudflare 계정에 로그인할 수 있는지 확인
   - 이메일 인증이 완료되었는지 확인

2. **다른 브라우저나 시크릿 모드로 시도**
   - 캐시 문제일 수 있습니다

3. **Cloudflare 지원팀에 문의**
   - Account ID가 표시되지 않으면 Cloudflare 지원팀에 문의하세요

**⚠️ 확인 사항:**
- Account ID는 반드시 **영문자와 숫자만** 포함합니다
- 하이픈(-)이나 언더스코어(_)는 포함되지 않습니다
- 길이는 보통 **32자리**입니다

### 2️⃣ **API Token 생성**

1. Cloudflare Dashboard → **My Profile** → **API Tokens** 이동
2. **Create Token** 클릭
3. **Custom token** 선택
4. 다음 권한 설정:
   - **Account** → **Cloudflare Images** → **Edit**
5. **Continue to summary** → **Create Token**
6. 생성된 토큰을 복사 (한 번만 표시됨!)

### 2.5️⃣ **스토리지 설정이 필요한가요?** ❌ 불필요!

**답변: 아니요, 별도의 스토리지 설정은 필요 없습니다!**

Cloudflare Images는 Supabase Storage나 AWS S3와 달리:
- ❌ 버킷(Bucket) 생성 불필요
- ❌ 스토리지 활성화 불필요
- ❌ 도메인 연결 불필요 (기본 도메인 사용 가능)
- ✅ **Account ID + API Token만 있으면 바로 사용 가능**

**참고사항:**
- Cloudflare Images는 계정 생성 시 자동으로 활성화됩니다
- 별도의 활성화 절차가 필요 없습니다
- 바로 환경 변수 설정 후 사용할 수 있습니다

### 3️⃣ **로컬 개발 환경 설정** ⭐ 중요

프로젝트 루트에 `.env.local` 파일을 생성하고 다음을 추가:

```bash
# .env.local
CLOUDFLARE_ACCOUNT_ID=your-account-id-here
CLOUDFLARE_API_TOKEN=your-api-token-here
```

또는:

```bash
CLOUDFLARE_ACCOUNT_ID=your-account-id-here
CLOUDFLARE_IMAGES_API_TOKEN=your-api-token-here
```

**💡 Note:** `.env.local` 파일은 `.gitignore`에 포함되어 있어 Git에 커밋되지 않습니다.

### 4️⃣ **프로덕션 환경 변수 설정** ⭐ 중요

배포 환경(AWS Amplify, Netlify, Vercel 등)의 환경 변수 설정에서 다음을 추가:

```
변수명: CLOUDFLARE_ACCOUNT_ID
값: your-account-id-here

변수명: CLOUDFLARE_API_TOKEN
값: your-api-token-here
```

## 🔒 보안 주의사항

- ⚠️ **절대 API Token을 클라이언트 사이드 코드에 노출하지 마세요!**
- ✅ API Token은 서버 사이드에서만 사용됩니다
- ✅ 클라이언트 사이드 업로드는 `/api/upload-image` API 라우트를 통해 처리됩니다

## 📸 업로드된 이미지 확인 및 사용 방법

### 1️⃣ **Cloudflare Dashboard에서 이미지 확인**

1. [Cloudflare Dashboard](https://dash.cloudflare.com/)에 로그인
2. 왼쪽 사이드바에서 **Images** 클릭
3. 업로드된 모든 이미지 목록 확인 가능
   - 이미지 미리보기
   - 이미지 ID
   - 업로드 날짜
   - 파일 크기
   - 이미지 URL

### 2️⃣ **업로드된 이미지 URL 형식**

업로드 성공 시 반환되는 URL 형식:
```
https://imagedelivery.net/{account-hash}/{image-id}/public
```

예시:
```
https://imagedelivery.net/abc123def456/xyz789/image.jpg/public
```

### 3️⃣ **코드에서 이미지 사용 방법**

#### 업로드 프로세스:
1. **업로드**: `uploadImageToCloudflare()` 함수가 이미지 URL을 반환
2. **저장**: 반환된 URL이 데이터베이스 `character_images` 테이블의 `imageUrl` 필드에 저장
3. **사용**: 저장된 URL을 그대로 HTML `<img>` 태그나 Next.js `Image` 컴포넌트에서 사용

#### 예시 코드:

```typescript
// 업로드 후 URL 반환
const imageUrl = await uploadImageToCloudflare(file);
// 예: "https://imagedelivery.net/abc123/xyz789/image.jpg/public"

// 데이터베이스에 저장
await prisma.character_images.create({
  data: {
    characterId: 1,
    imageUrl: imageUrl,  // Cloudflare URL 그대로 저장
    keyword: "캐릭터 이미지",
    isMain: true,
  }
});

// 프론트엔드에서 사용
<img src={character.imageUrl} alt="캐릭터" />
// 또는 Next.js Image 컴포넌트
<Image src={character.imageUrl} alt="캐릭터" width={500} height={500} />
```

### 4️⃣ **이미지 URL의 특징**

- ✅ **공개 URL**: 별도의 인증 없이 바로 접근 가능
- ✅ **CDN 최적화**: Cloudflare의 글로벌 CDN으로 빠른 전송
- ✅ **자동 최적화**: 업로드 시 자동으로 최적화됨
- ✅ **영구 URL**: 삭제하지 않는 한 URL이 변경되지 않음

### 5️⃣ **이미지 삭제**

**주의**: 현재 코드는 이미지 삭제 시 Cloudflare에서 실제 파일을 삭제하지 않습니다.
- 데이터베이스에서만 레코드 삭제
- Cloudflare Images에 파일은 그대로 남아있음

**✅ 이미지 삭제 기능:**
- 캐릭터 이미지 삭제 시 Cloudflare Images에서도 자동으로 삭제됩니다
- 코드에 이미 구현되어 있어 별도 작업 불필요
- 캐릭터 삭제 시에도 모든 이미지가 Cloudflare에서 삭제됩니다

## ✅ 동작 확인

환경 변수가 올바르게 설정되었는지 확인:

```bash
# 로컬 개발 환경
npm run dev

# 이미지 업로드 테스트
# 캐릭터 생성 페이지에서 이미지를 업로드해보세요
```

**확인 방법:**
1. 이미지 업로드 후 브라우저 개발자 도구 → Network 탭에서 응답 확인
2. 반환된 `imageUrl`이 `https://imagedelivery.net/...` 형식인지 확인
3. 해당 URL을 브라우저 주소창에 입력하여 이미지가 표시되는지 확인
4. Cloudflare Dashboard → Images에서 업로드된 이미지 확인

## 💰 Cloudflare Images 가격 정보

### **무료 플랜**
- ✅ **저장된 이미지 수**: 무제한
- ✅ **이미지 변환**: 월 5,000개
- ✅ **이미지 요청(조회)**: 무제한 (비용 없음)

### **유료 플랜**
- ✅ **저장된 이미지 수**: 무제한
- ✅ **이미지 변환**: 월 100,000개 포함
- ✅ **초과 변환 비용**: 1,000건당 **$0.50** (약 650원)
- ✅ **이미지 요청(조회)**: 무제한 (비용 없음)

### **💡 실제 사용 예시**

**채팅에서 이미지 3장 불러오기:**
- 이미 저장된 이미지를 단순히 보여주는 경우 = **비용 없음** ✅
- 이미지 변환(리사이징, 썸네일 생성)이 필요한 경우만 비용 발생

**비용 계산 예시:**
- 월 10,000번의 이미지 변환 = 무료 (무료 플랜 한도 내)
- 월 150,000번의 이미지 변환 = $25 (100,000개 포함 + 50,000개 × $0.50/1,000)
- 단순 이미지 조회는 **무제한 무료**

## 🚀 Cloudflare Images의 장점

- ✅ **자동 이미지 최적화**: 업로드된 이미지가 자동으로 최적화됨
- ✅ **CDN 통합**: Cloudflare의 글로벌 CDN으로 빠른 이미지 전송
- ✅ **변형(변형) 지원**: 다양한 크기와 형식의 이미지 자동 생성
- ✅ **비용 효율적**: 저장 이미지 수 무제한, 단순 조회 무료
- ✅ **간단한 API**: RESTful API로 쉽게 통합
- ✅ **자동 삭제**: 캐릭터/이미지 삭제 시 Cloudflare에서도 자동 삭제

## 🌐 Cloudflare CDN 사용 방법 (비용 절감)

Cloudflare Images는 **자동으로 CDN을 사용**합니다! 별도 설정이 필요 없습니다.

### ✅ **자동 CDN 기능**

1. **글로벌 CDN**: 업로드된 이미지는 자동으로 Cloudflare의 전 세계 CDN에 배포됩니다
2. **최적화된 전송**: 가장 가까운 엣지 서버에서 이미지를 제공하여 속도 향상
3. **비용 절감**: 
   - Cloudflare Images: **저장된 이미지 수 무제한** (무료/유료 모두) ✅
   - 이미지 조회(단순 불러오기): **무제한 무료** ✅
   - 이미지 변환: 무료 플랜 월 5,000개, 유료 플랜 월 100,000개 포함
   - CDN 대역폭: 무료 (Cloudflare Images 사용 시)
   - 별도의 CDN 서비스 불필요

### 📊 **CDN 동작 방식**

```
사용자 요청
    ↓
가장 가까운 Cloudflare 엣지 서버
    ↓
이미지 제공 (캐시된 경우 즉시 제공)
    ↓
캐시 미스 시 원본에서 가져와 캐시
```

### 💡 **추가 최적화 팁**

#### 1. **이미지 변형(Variant) 사용** (선택사항)

다양한 크기의 이미지를 자동 생성하여 사용:

```typescript
// URL에 variant 추가
const thumbnailUrl = imageUrl.replace('/public', '/thumbnail');
const mediumUrl = imageUrl.replace('/public', '/medium');
```

**설정 방법:**
1. Cloudflare Dashboard → **Images** → **Variants**
2. 원하는 크기의 variant 생성 (예: `thumbnail`, `medium`, `large`)
3. URL에서 variant 이름 변경하여 사용

#### 2. **Next.js Image 컴포넌트 사용**

Next.js의 `Image` 컴포넌트는 자동으로 최적화를 수행합니다:

```tsx
import Image from 'next/image';

<Image 
  src={character.imageUrl} 
  alt="캐릭터" 
  width={500} 
  height={500}
  // Cloudflare CDN이 자동으로 최적화된 이미지 제공
/>
```

#### 3. **캐싱 헤더 설정** (선택사항)

Cloudflare Dashboard에서 캐싱 규칙을 설정할 수 있습니다:
- **Caching** → **Page Rules** 또는 **Cache Rules**
- 이미지 URL 패턴에 대한 캐싱 규칙 추가

### 💰 **비용 비교**

| 서비스 | 이미지 스토리지 | CDN | 월 무료 티어 |
|--------|---------------|-----|------------|
| **Cloudflare Images** | ✅ 포함 | ✅ 자동 | **저장 이미지 수 제한 없음** ✅ |
| Supabase Storage | ✅ | ❌ 별도 필요 | 제한적 |
| AWS S3 + CloudFront | ✅ | ✅ 별도 설정 | 제한적 |

**참고**: 
- **무료 플랜**: 이미지 변환 월 5,000개 제한, 저장 이미지 수 무제한
- **유료 플랜**: 이미지 변환 월 100,000개 포함, 저장 이미지 수 무제한
- **초과 비용**: 변환 1,000건당 $0.50 (약 650원)

**💡 채팅에서 이미지 사용 시 비용:**
- 이미 저장된 이미지를 단순히 불러와서 보여주는 경우: **비용 없음** ✅
- 이미지 변환(리사이징, 썸네일 생성 등)이 필요한 경우만 비용 발생
- 채팅에서 이미지 3장을 보여주는 것 = 단순 요청 = **무료**

**결론**: Cloudflare Images는 스토리지와 CDN이 통합되어 있어 **별도 CDN 설정 없이도 최적화된 이미지 전송**이 가능합니다!

## 📚 참고 링크

- [Cloudflare Images Documentation](https://developers.cloudflare.com/images/)
- [Cloudflare Images API Reference](https://developers.cloudflare.com/api/operations/cloudflare-images-upload-an-image-via-url)
- [Cloudflare Images Pricing](https://developers.cloudflare.com/images/pricing/)

## 🔄 Supabase Storage에서 마이그레이션

이전에 Supabase Storage를 사용했다면:

1. 기존 이미지 URL은 그대로 유지됩니다 (데이터베이스에 저장된 URL)
2. 새로운 이미지만 Cloudflare Images에 업로드됩니다
3. 기존 이미지를 마이그레이션하려면 별도의 마이그레이션 스크립트가 필요합니다

## 🐛 문제 해결

### "Cloudflare 환경 변수가 설정되지 않았습니다" 오류

- `.env.local` 파일이 프로젝트 루트에 있는지 확인
- 환경 변수 이름이 정확한지 확인 (`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`)
- 서버를 재시작했는지 확인

### "이미지 업로드 실패" 오류

- API Token이 올바른 권한을 가지고 있는지 확인 (Cloudflare Images: Edit)
- Account ID가 올바른지 확인
- Cloudflare Dashboard에서 API 사용량 제한을 확인

### 클라이언트 사이드 업로드 실패

- `/api/upload-image` API 라우트가 정상 작동하는지 확인
- 브라우저 콘솔에서 네트워크 오류 확인
- 인증 세션이 유효한지 확인

