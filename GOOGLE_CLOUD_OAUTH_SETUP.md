# Google Cloud OAuth 도메인 설정 가이드

## 개요

새로운 Amplify 앱을 사용할 때, Google Cloud Console에서 OAuth 설정을 업데이트해야 합니다.

## 필수 설정 항목

### 1. OAuth 2.0 클라이언트 ID 설정

**경로**: Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs

#### 승인된 리디렉션 URI (Authorized redirect URIs)

다음 형식의 URI를 추가해야 합니다:

```
https://{your-domain}/api/auth/callback/google
```

**예시**:
- 메인 앱: `https://main.yourdomain.com/api/auth/callback/google`
- 새 앱: `https://new.yourdomain.com/api/auth/callback/google`
- 또는 Amplify 도메인: `https://{branch}.{app-id}.amplifyapp.com/api/auth/callback/google`

#### 승인된 JavaScript 원본 (Authorized JavaScript origins)

다음 형식의 도메인을 추가해야 합니다:

```
https://{your-domain}
```

**예시**:
- 메인 앱: `https://main.yourdomain.com`
- 새 앱: `https://new.yourdomain.com`
- 또는 Amplify 도메인: `https://{branch}.{app-id}.amplifyapp.com`

### 2. OAuth 동의 화면 설정

**경로**: Google Cloud Console → APIs & Services → OAuth consent screen

#### 승인된 도메인 (Authorized domains)

애플리케이션 도메인을 추가해야 합니다:

- `yourdomain.com` (루트 도메인)
- 또는 `amplifyapp.com` (Amplify 기본 도메인 사용 시)

**참고**: 서브도메인은 자동으로 포함되지만, 명시적으로 추가하는 것이 좋습니다.

### 3. API 키 제한사항 (만약 API 키를 사용한다면)

**경로**: Google Cloud Console → APIs & Services → Credentials → API Keys

API 키를 사용하는 경우, HTTP 리퍼러(웹사이트) 제한에 다음을 추가:

```
https://{your-domain}/*
```

## 설정 확인 방법

### 1. 현재 설정 확인

Google Cloud Console에서:
1. **APIs & Services** → **Credentials**
2. OAuth 2.0 Client ID 클릭
3. **Authorized redirect URIs** 및 **Authorized JavaScript origins** 확인

### 2. 테스트

1. 새 앱에서 Google 로그인 시도
2. 브라우저 개발자 도구 → Network 탭에서 확인:
   - `redirect_uri_mismatch` 에러가 발생하면 리디렉션 URI가 누락된 것
   - `origin_mismatch` 에러가 발생하면 JavaScript 원본이 누락된 것

## 문제 해결

### 에러: `redirect_uri_mismatch`

**원인**: 승인된 리디렉션 URI에 새 도메인이 추가되지 않음

**해결**:
1. Google Cloud Console → OAuth 2.0 Client ID
2. **Authorized redirect URIs**에 새 도메인 추가
3. 형식: `https://{new-domain}/api/auth/callback/google`

### 에러: `origin_mismatch`

**원인**: 승인된 JavaScript 원본에 새 도메인이 추가되지 않음

**해결**:
1. Google Cloud Console → OAuth 2.0 Client ID
2. **Authorized JavaScript origins**에 새 도메인 추가
3. 형식: `https://{new-domain}` (프로토콜 포함, 경로 제외)

### CSRF 토큰 에러

**원인**: `NEXTAUTH_URL` 환경변수가 새 도메인으로 설정되지 않음

**해결**:
1. Amplify Console → Environment variables
2. `NEXTAUTH_URL`을 새 도메인으로 설정
   - 예: `https://{new-domain}`
3. 앱 재배포

## 중요 사항

1. **도메인 변경 시**: 새 도메인을 Google Cloud Console에 추가해야 함
2. **환경변수**: `NEXTAUTH_URL`이 실제 도메인과 일치해야 함
3. **HTTPS 필수**: 프로덕션 환경에서는 HTTPS만 사용 가능
4. **와일드카드 불가**: Google은 와일드카드를 지원하지 않으므로 각 도메인을 개별적으로 추가해야 함

## 참고

- NextAuth는 기본적으로 `/api/auth/callback/{provider}` 경로를 사용
- Google OAuth는 `sameSite: 'strict'` 쿠키를 사용하므로 도메인이 정확히 일치해야 함
- CSRF 토큰은 도메인별로 생성되므로, 도메인이 다르면 토큰이 검증되지 않음

