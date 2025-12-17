# Replicate 설정 가이드 (초보자용)

## 🎯 핵심 정리

**모델 생성 필요 없음!** Replicate는 이미 만들어진 모델들을 사용하는 플랫폼입니다.

## 📝 단계별 설정

### 1단계: 회원가입

1. [Replicate 웹사이트](https://replicate.com/) 접속
2. 우측 상단 "Sign in" 또는 "Try for free" 클릭
3. 가입 방법 선택:
   - 이메일로 가입
   - GitHub 계정으로 가입 (추천)
   - Google 계정으로 가입

### 2단계: API 토큰 생성

1. 로그인 후 우측 상단 프로필 아이콘 클릭
2. 드롭다운 메뉴에서 **"Settings"** 또는 **"API tokens"** 선택
3. **"Create token"** 버튼 클릭
4. 토큰 이름 입력 (예: "namos-chat-image-generation")
5. **"Create token"** 클릭
6. ⚠️ **토큰을 즉시 복사하세요!** (한 번만 보여줍니다)
   - 형식: `r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 3단계: 환경 변수 설정

프로젝트 루트의 `.env.local` 파일에 추가:

```env
REPLICATE_API_TOKEN=r8_여기에_복사한_토큰_붙여넣기
```

**파일 위치**: 프로젝트 루트 디렉토리
```
namos-chat-v1-move/
  ├── .env.local          ← 여기에 추가
  ├── src/
  ├── package.json
  └── ...
```

### 4단계: 서버 재시작

환경 변수를 추가한 후 개발 서버를 재시작:

```bash
# 서버 중지 (Ctrl+C)
# 서버 재시작
npm run dev
```

## ❓ 자주 묻는 질문

### Q: 모델을 만들어야 하나요?
**A: 아니요!** Replicate에는 이미 수천 개의 모델이 준비되어 있습니다. 우리는 기존 모델(Stable Diffusion 등)을 사용합니다.

### Q: 어떤 모델을 사용하나요?
**A: Stable Diffusion v1.5** 모델을 사용합니다. 코드에 이미 설정되어 있습니다.

### Q: 모델을 변경할 수 있나요?
**A: 네!** `src/app/api/images/generate/route.ts` 파일에서 모델 버전을 변경할 수 있습니다.

### Q: 비용이 얼마나 드나요?
**A:** 이미지당 약 $0.0023 (약 3원)입니다. 사용한 만큼만 지불합니다.

### Q: 무료 티어가 있나요?
**A:** Replicate는 무료 티어가 없지만, 사용한 만큼만 지불하는 Pay-as-you-go 방식입니다.

## 🔍 모델 확인하기

Replicate에서 사용 가능한 모델들을 확인하려면:

1. [Replicate Models 페이지](https://replicate.com/explore) 접속
2. "Image Generation" 카테고리 확인
3. 인기 모델들:
   - `stability-ai/stable-diffusion` - 일반적인 이미지 생성
   - `black-forest-labs/flux-dev` - 고품질 이미지
   - `lucataco/anything-v3` - 애니메 특화

## ✅ 설정 확인

설정이 제대로 되었는지 확인:

1. `.env.local` 파일에 토큰이 있는지 확인
2. 개발 서버 재시작
3. 캐릭터 작성 페이지 > "画像" 탭 > "AI生成" 버튼 클릭
4. 프롬프트 입력 후 생성 테스트

## 🆘 문제 해결

### 토큰을 잃어버렸어요
- Settings > API tokens에서 새 토큰 생성
- 기존 토큰은 삭제 가능

### "API 토큰이 설정되지 않았습니다" 에러
- `.env.local` 파일 확인
- 서버 재시작 확인
- 환경 변수 이름이 정확한지 확인 (`REPLICATE_API_TOKEN`)

### 이미지 생성이 안 돼요
- Replicate 계정에 크레딧이 있는지 확인
- 네트워크 연결 확인
- 브라우저 콘솔에서 에러 메시지 확인

## 📚 추가 자료

- [Replicate 공식 문서](https://replicate.com/docs)
- [Replicate API 참조](https://replicate.com/docs/reference/http)
- [모델 탐색](https://replicate.com/explore)









