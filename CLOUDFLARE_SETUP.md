# 🔧 Cloudflare R2 설정 가이드

이 프로젝트는 이미지 스토리지로 **Cloudflare Images** 대신 **Cloudflare R2 (S3 호환 객체 스토리지)**를 사용합니다.  
R2는 자동 CDN + 0달러 이그레스 정책 덕분에 고頻도 이미지 조회 서비스(AI 채팅 등)에서 **월 수백~수천만 이미지 요청에도 매우 저렴**하게 운영할 수 있습니다.

---

## 📦 R2 구성 개요

1. **R2 버킷 생성** – Images → R2 → Create bucket
2. **Access Key / Secret 발급** – R2 대시보드의 *Manage R2 API Tokens* 버튼으로 생성
3. **Public Access 또는 커스텀 도메인 연결** – R2 버킷 Settings → Public Bucket 활성화, 필요하면 도메인 연결
4. **환경 변수 설정** – 백엔드가 S3 API로 업로드/삭제
5. (선택) **이미지 리사이징 파이프라인** – sharp 등으로 업로드 전에 용량 줄이기

업로드/삭제 로직은 `src/lib/cloudflare-images.ts` (파일명은 그대로지만 내부는 R2 클라이언트)를 통해 모든 API 라우트에서 공유됩니다.

---

## ✅ 필수 환경 변수

`.env.local` (로컬) 및 배포 환경 둘 다 설정합니다.

```bash
CLOUDFLARE_ACCOUNT_ID=cf-account-id-or-r2-account-id
CLOUDFLARE_R2_ACCESS_KEY_ID=access-key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=secret-key
CLOUDFLARE_R2_BUCKET_NAME=chat-images
# 또는 CLOUDFLARE_R2_BUCKET으로 동일하게 사용 가능

# R2가 공개적으로 노출되는 베이스 URL (끝 슬래시 제거)
# Public bucket URL, 또는 커스텀 도메인/대체 Worker URL
CLOUDFLARE_R2_PUBLIC_URL=https://chat-images.<account-id>.r2.cloudflarestorage.com

# 선택: 계정별 기본 endpoint를 덮어쓸 때만 사용
# CLOUDFLARE_R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
```

> **중요**: R2는 S3 호환 API이므로 API Token(Images:Edit)은 더 이상 사용하지 않습니다.  
> `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_IMAGES_API_TOKEN` 항목은 삭제해도 됩니다.

### 변수 상세

| 변수 | 설명 | 확인 방법 |
| --- | --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 계정 ID (32자리) | Dashboard 상단 URL 또는 My Profile → API Tokens |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | R2 API Access Key | 버킷 우측 상단 **Manage R2 API Tokens** → Create API Token |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | R2 API Secret | 위 Access Key 생성 시 함께 표시 (재확인 불가, 반드시 복사) |
| `CLOUDFLARE_R2_BUCKET_NAME` | R2 버킷 이름 | R2 → Buckets → 생성한 버킷 |
| `CLOUDFLARE_R2_PUBLIC_URL` | 공개 URL 베이스 | R2 → 해당 버킷 → Settings → *Public bucket* 활성화 후 표시되는 URL / 또는 커스텀 도메인 |
| `CLOUDFLARE_R2_ENDPOINT` | (선택) S3 API Endpoint | 기본값: `https://<account-id>.r2.cloudflarestorage.com` |

---

## 🪣 버킷 생성 & 공개 설정

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **R2** 메뉴 이동  
2. **Create bucket** → 이름 입력 (예: `chat-images`)  
3. 버킷 → **Settings** 탭 → **Public bucket** > `Allow public access to this bucket` 활성화  
   - 이 옵션을 켜면 `https://<bucket>.<account>.r2.cloudflarestorage.com` 형식의 공개 URL이 생성됩니다  
   - 커스텀 도메인을 쓰고 싶다면 아래 *Custom Domain* 기능 추가
4. **Public Bucket URL**을 복사해 `CLOUDFLARE_R2_PUBLIC_URL`에 입력  
5. (선택) **Custom Domain**: 동일 Settings 화면에서 도메인을 연결하면 CDN 캐시 + 친숙한 URL 사용 가능  
   - 예: `https://img.example.com/uploads/xxx.png`

> 커스텀 도메인을 연결하지 않아도 Cloudflare CDN이 자동으로 앞단에 붙습니다.  
> 단, 커스텀 도메인을 사용하면 캐시/보안 규칙을 더 세밀하게 제어할 수 있습니다.

---

## 🔐 Access Key 발급

1. R2 버킷 목록 우측 상단 **Manage R2 API Tokens** → **Create API Token**  
2. **Permissions** 에서 `Object Read & Write`, `Bucket Read` 권한을 선택 (필요 시 더 제한 가능)  
3. 생성이 끝나면 Access Key / Secret Key가 한 번만 노출 → 즉시 환경 변수에 저장  
4. 이 키는 S3 SDK에서 사용되므로 **절대 클라이언트에 노출 금지**

---

## 💻 코드 흐름 (요약)

1. 클라이언트는 `/api/upload-image`에 `FormData`로 이미지 전송 (CSRF 토큰 포함)  
2. API Route가 세션 검증 후 `uploadImageToCloudflare(file)` 호출  
3. `src/lib/cloudflare-images.ts` 가 S3 SDK로 R2에 `uploads/<filename>` 키로 업로드  
4. 업로드 완료 시 `CLOUDFLARE_R2_PUBLIC_URL` + 파일 키로 구성된 **공개 URL**을 반환  
5. URL이 DB에 저장되고, 프론트엔드는 그대로 `<Image>`에 넣어 사용  
6. 이미지 교체/삭제 시 `deleteImageFromCloudflare`가 같은 키를 제거

> **파일명 규칙**: `uploads/<sanitize(filename)>`.  
> 동일한 이름일 경우 마지막 업로드가 덮어쓰기 되므로, 실제 코드에서는 `randomUUID()`가 자동으로 붙습니다.

---

## 🧪 동작 확인

```bash
npm run dev
# 캐릭터/프로필 등에서 이미지를 업로드
# Network → /api/upload-image 응답의 imageUrl이 R2 도메인인지 확인
```

정상이라면 `https://<bucket>.<account>.r2.cloudflarestorage.com/uploads/<...>` 혹은 커스텀 도메인 URL이 돌아옵니다.  
브라우저 주소창에 붙여넣어 바로 접근되는지 확인하세요.

---

## 💰 비용 비교 (Images vs R2)

| 항목 | Cloudflare Images | Cloudflare R2 |
| --- | --- | --- |
| 저장 | 월 $5 (유료 플랜) | $0.015 / GB (10GB 무료) |
| 요청 비용 | 변환 위주 과금 (무거움) | Class B 10M 무료 + 추가 $0.36/백만 |
| 이그레스 | 포함 (이미지 전달) | **0달러** (R2 핵심 장점) |
| 자동 최적화 | 기본 제공 | 직접 구현 (sharp 등) |
| 커스텀 파이프라인 | 제한적 | 자유 (S3와 동일) |

**AI 채팅처럼 하루 10만~백만 호출 시**:  
- Images: 변환당 요금 + 향후 대량 트래픽 시 월 수백 달러까지 증가  
- R2: 0달러 이그레스 + 요청 요금만 소폭 → 월 수 달러 수준  

> 따라서 현재 구조는 **R2 + (선택) 업로드 전 서버 리사이징**을 추천합니다.

---

## 🔧 추가 작업 로드맵

- [ ] sharp 등으로 업로드 전 리사이징/압축 파이프라인 추가 (대기)
- [ ] 기존 Supabase/Cloudflare Images 에 있던 자산을 R2로 마이그레이션
- [ ] 커스텀 도메인 연결 + Cache Rules로 장기 캐싱 설정

---

## 🐛 문제 해결

| 증상 | 확인 사항 |
| --- | --- |
| `Cloudflare R2環境変数が不足しています` | 위 표의 변수 전부 입력 여부, `.env.local` 저장 후 서버 재시작 |
| 업로드는 됐는데 URL 접근 시 403 | R2 버킷 Settings → Public bucket 활성화 여부, 또는 도메인 DNS/SSL 설정 |
| 삭제가 되지 않는다 | `CLOUDFLARE_R2_PUBLIC_URL` 과 실제 저장된 URL 도메인이 일치하는지 확인 (기준 URL이 달라지면 키 추출 실패) |
| 속도가 느림 | 업로드 전 sharp로 리사이즈/압축, Next.js `Image` 캐시 사용, Cloudflare Cache Rules 적용 |

---

## 📚 참고 링크

- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [S3-Compatible API](https://developers.cloudflare.com/r2/api/s3/api/) (현재 코드가 사용하는 프로토콜)
- [Public Buckets & Custom Domains](https://developers.cloudflare.com/r2/buckets/public-buckets/)
- [Pricing](https://developers.cloudflare.com/r2/pricing/)

---

필요 시 언제든지 `CLOUDFLARE_SETUP.md` 를 갱신해서 운영 노하우나 파이프라인(리사이징 등)을 공유해주세요. Cloudflare Images 관련 내용은 전부 제거되어 있으므로, 이제부터는 **R2 기반** 설정만 따르면 됩니다.💪

