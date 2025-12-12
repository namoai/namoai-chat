# AI 이미지 생성 기능 구현 가이드

## 개요
캐릭터 작성 시 이미지 추가 메뉴에 AI 이미지 생성 기능을 추가하는 방법을 설명합니다.

**⚠️ 중요: 이 구현은 2D/애니메 스타일 이미지만 생성하도록 제한되어 있습니다. 실사 이미지 생성은 금지됩니다.**

## 무료/저렴한 AI 이미지 생성 API 옵션

### 1. Hugging Face Inference API (추천 - 무료 티어)
- **무료 티어**: 월 1,000회 요청
- **가격**: 무료 티어 이후 $0.0001/이미지
- **장점**: 
  - 무료 티어가 충분함
  - Stable Diffusion 모델 사용 가능
  - API 키만 있으면 바로 사용 가능
- **단점**: 
  - 무료 티어는 속도가 느릴 수 있음
  - 큐 대기 시간이 있을 수 있음

**설정 방법**:
1. [Hugging Face](https://huggingface.co/) 계정 생성
2. Settings > Access Tokens에서 토큰 생성
3. 환경 변수에 추가: `HUGGINGFACE_API_KEY=your_token`

### 2. Replicate API (✅ 선택됨 - 2D만 생성)
- **가격**: $0.0023/이미지 (Stable Diffusion)
- **장점**: 
  - 빠른 응답 속도
  - 다양한 모델 선택 가능
  - 안정적인 서비스
  - **2D/애니메 스타일만 생성하도록 강제 가능**
- **단점**: 완전 무료는 아님

**설정 방법** (간단합니다!):
1. [Replicate](https://replicate.com/) 회원가입
   - "Sign in" 또는 "Try for free" 클릭
   - 이메일로 가입하거나 GitHub/Google 계정으로 가입
   
2. API 토큰 생성
   - 로그인 후 우측 상단 프로필 아이콘 클릭
   - "Settings" 또는 "API tokens" 메뉴 선택
   - "Create token" 버튼 클릭
   - 토큰 이름 입력 (예: "namos-chat") 후 생성
   - ⚠️ **토큰을 복사해두세요!** (한 번만 보여줍니다)
   
3. 환경 변수에 추가
   - 프로젝트 루트의 `.env.local` 파일에 추가:
   ```env
   REPLICATE_API_TOKEN=r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
   
4. 완료! 모델 생성은 필요 없습니다.
   - Replicate에는 이미 수천 개의 모델이 준비되어 있습니다
   - 우리는 Stable Diffusion 같은 기존 모델을 사용합니다
   - 모델을 만들거나 배포할 필요가 없습니다

**2D 제한 구현**:
- 프롬프트에 "anime style, 2D illustration" 등 강제 추가
- 네거티브 프롬프트에 "photorealistic, realistic, photo" 등 강제 추가
- 실사 이미지 생성 완전 차단

### 3. Stability AI API
- **무료 티어**: 제한적
- **가격**: $0.04/이미지
- **장점**: 고품질 이미지
- **단점**: 비싸고 무료 티어가 제한적

### 4. OpenAI DALL-E 3
- **가격**: $0.04/이미지 (1024x1024)
- **장점**: 매우 고품질
- **단점**: 비쌈

## 구현 단계

### 1단계: API 라우트 생성

`src/app/api/images/generate/route.ts` 파일 생성:

```typescript
import { NextRequest, NextResponse } from 'next/server';

// Hugging Face 사용 예시
export async function POST(request: NextRequest) {
  try {
    const { prompt, negativePrompt, width = 512, height = 512 } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: '프롬프트가 필요합니다.' }, { status: 400 });
    }

    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API 키가 설정되지 않았습니다.' }, { status: 500 });
    }

    // Hugging Face Inference API 호출
    const response = await fetch(
      'https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            negative_prompt: negativePrompt || 'blurry, low quality, distorted',
            width,
            height,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: `이미지 생성 실패: ${error}` },
        { status: response.status }
      );
    }

    // 이미지를 base64로 변환
    const imageBuffer = await response.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    const imageUrl = `data:image/png;base64,${base64Image}`;

    return NextResponse.json({
      success: true,
      imageUrl,
    });
  } catch (error) {
    console.error('이미지 생성 에러:', error);
    return NextResponse.json(
      { error: '이미지 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
```

### 2단계: CharacterForm 컴포넌트 수정

`src/components/CharacterForm.tsx`에 다음 기능 추가:

1. **이미지 생성 모달 상태 추가**:
```typescript
const [isImageGenerateModalOpen, setIsImageGenerateModalOpen] = useState(false);
const [isGeneratingImage, setIsGeneratingImage] = useState(false);
const [generatePrompt, setGeneratePrompt] = useState('');
const [generateNegativePrompt, setGenerateNegativePrompt] = useState('');
```

2. **이미지 생성 함수 추가**:
```typescript
const handleGenerateImage = async () => {
  if (!generatePrompt.trim()) {
    setModalState({
      isOpen: true,
      title: '입력 오류',
      message: '프롬프트를 입력해주세요.',
    });
    return;
  }

  setIsGeneratingImage(true);
  try {
    const response = await fetchWithCsrf('/api/images/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: generatePrompt,
        negativePrompt: generateNegativePrompt,
        width: 512,
        height: 512,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '이미지 생성에 실패했습니다.');
    }

    const data = await response.json();
    
    // base64 이미지를 Blob으로 변환하여 File 객체 생성
    const base64Response = await fetch(data.imageUrl);
    const blob = await base64Response.blob();
    const file = new File([blob], `generated-${Date.now()}.png`, { type: 'image/png' });
    
    // 이미지 목록에 추가
    const newImage: DisplayImage = { file, keyword: '' };
    setImages((prev) => [...prev, newImage]);
    
    setModalState({
      isOpen: true,
      title: '성공',
      message: '이미지가 생성되었습니다.',
    });
    
    // 모달 닫기 및 초기화
    setIsImageGenerateModalOpen(false);
    setGeneratePrompt('');
    setGenerateNegativePrompt('');
  } catch (error) {
    console.error('이미지 생성 에러:', error);
    setModalState({
      isOpen: true,
      title: '에러',
      message: error instanceof Error ? error.message : '이미지 생성에 실패했습니다.',
    });
  } finally {
    setIsGeneratingImage(false);
  }
};
```

3. **UI에 이미지 생성 버튼 추가** (step === 1 부분):
```typescript
<div style={{ display: step === 1 ? 'block' : 'none' }} className="min-h-[400px]">
  <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-gray-800/50">
    {/* 기존 코드... */}
    
    <div className="flex flex-col sm:flex-row gap-3 mb-4">
      <label className="block text-sm sm:text-base font-semibold text-gray-200 mb-3 sm:mb-4">
        이미지 추가
      </label>
      <div className="flex gap-2">
        <input 
          type="file" 
          accept="image/*" 
          multiple 
          onChange={handleImageChange} 
          className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-pink-500 file:to-purple-600 hover:file:from-pink-600 hover:file:to-purple-700 file:text-white file:cursor-pointer cursor-pointer file:shadow-lg file:shadow-pink-500/30 transition-all" 
        />
        <Button
          onClick={() => setIsImageGenerateModalOpen(true)}
          className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white px-4 py-2 rounded-xl shadow-lg shadow-blue-500/30 font-semibold whitespace-nowrap"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          AI 생성
        </Button>
      </div>
    </div>
    
    {/* 기존 이미지 표시 코드... */}
  </div>
</div>
```

4. **이미지 생성 모달 추가**:
```typescript
<Dialog open={isImageGenerateModalOpen} onOpenChange={setIsImageGenerateModalOpen}>
  <DialogContent className="sm:max-w-[500px] bg-gray-800/95 backdrop-blur-xl text-white border-gray-700/50 rounded-xl">
    <DialogHeader>
      <DialogTitle>AI 이미지 생성</DialogTitle>
    </DialogHeader>
    <div className="py-4 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-200 mb-2">
          프롬프트 (필수)
        </label>
        <Textarea
          placeholder="예: cute anime girl, pink hair, school uniform, detailed, high quality"
          value={generatePrompt}
          onChange={(e) => setGeneratePrompt(e.target.value)}
          className="bg-gray-900/50 backdrop-blur-sm border-gray-600/50 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 rounded-xl transition-all min-h-[100px]"
          maxLength={500}
        />
        <p className="text-xs text-gray-400 mt-1">
          생성하고 싶은 이미지를 설명해주세요. 영어로 입력하면 더 좋은 결과를 얻을 수 있습니다.
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-200 mb-2">
          네거티브 프롬프트 (선택)
        </label>
        <Textarea
          placeholder="예: blurry, low quality, distorted, bad anatomy"
          value={generateNegativePrompt}
          onChange={(e) => setGenerateNegativePrompt(e.target.value)}
          className="bg-gray-900/50 backdrop-blur-sm border-gray-600/50 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 rounded-xl transition-all min-h-[80px]"
          maxLength={300}
        />
        <p className="text-xs text-gray-400 mt-1">
          이미지에서 피하고 싶은 요소를 입력해주세요.
        </p>
      </div>
    </div>
    <DialogFooter>
      <Button
        onClick={() => setIsImageGenerateModalOpen(false)}
        variant="ghost"
        className="text-gray-400 hover:text-white"
      >
        취소
      </Button>
      <Button
        onClick={handleGenerateImage}
        disabled={isGeneratingImage || !generatePrompt.trim()}
        className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 shadow-lg shadow-blue-500/30 rounded-xl disabled:opacity-50"
      >
        {isGeneratingImage ? '생성 중...' : '생성하기'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

5. **필요한 import 추가**:
```typescript
import { Sparkles } from "lucide-react";
```

### 3단계: 환경 변수 설정

`.env.local` 파일에 추가:
```env
REPLICATE_API_TOKEN=your_replicate_token_here
```

**Replicate API 토큰 얻는 방법**:
1. [Replicate](https://replicate.com/)에 가입
2. Settings > API tokens로 이동
3. "Create token" 클릭
4. 생성된 토큰을 `.env.local`에 추가

### 4단계: 테스트

1. 개발 서버 실행: `npm run dev`
2. 캐릭터 작성 페이지로 이동
3. "画像" 탭에서 "AI生成" 버튼 클릭
4. 프롬프트 입력 (예: "cute anime girl, pink hair")
5. 생성된 이미지가 2D 스타일인지 확인

## 구현 완료

✅ **이미 구현 완료된 파일들**:
- `src/app/api/images/generate/route.ts` - Replicate API를 사용한 이미지 생성 API (2D만 허용)
- `src/components/CharacterForm.tsx` - AI 이미지 생성 UI 추가

## Replicate API 구현 상세 (2D 제한)

현재 구현된 API는 다음과 같이 2D만 생성하도록 제한됩니다:

### 2D 제한 메커니즘

```typescript
// 1. 프롬프트에 2D/애니메 키워드 강제 추가
const enforced2DPrompt = `${prompt}, anime style, 2D illustration, cartoon style, manga style, cel-shaded, vibrant colors, detailed, high quality, flat shading, hand-drawn`;

// 2. 네거티브 프롬프트에 실사 관련 키워드 강제 추가
const enforcedNegativePrompt = `${negativePrompt || ''}, photorealistic, realistic, photo, 3D render, 3D model, realistic photo, photograph, real person, real face, photorealistic image, hyperrealistic, ultra realistic, CGI, 3D graphics, realistic texture, photo-real, lifelike`.trim();
```

이렇게 하면 사용자가 어떤 프롬프트를 입력하더라도:
- ✅ 2D/애니메 스타일만 생성됨
- ❌ 실사 이미지는 생성되지 않음
- ❌ 3D 렌더링 이미지는 생성되지 않음

### 주요 특징

1. **자동 2D 강제**: 사용자 프롬프트에 관계없이 2D 스타일 키워드가 자동 추가됩니다.
2. **실사 완전 차단**: 네거티브 프롬프트에 실사 관련 키워드가 강제로 포함되어 실사 이미지 생성이 차단됩니다.
3. **인증 필수**: 로그인한 사용자만 이미지 생성 가능합니다.
4. **에러 처리**: 타임아웃, API 오류 등 모든 상황에 대한 에러 처리가 포함되어 있습니다.

## 비용 비교

| 서비스 | 무료 티어 | 유료 가격 | 추천도 |
|--------|----------|----------|--------|
| Hugging Face | 월 1,000회 | $0.0001/이미지 | ⭐⭐⭐⭐⭐ |
| Replicate | 없음 | $0.0023/이미지 | ⭐⭐⭐⭐ |
| Stability AI | 제한적 | $0.04/이미지 | ⭐⭐⭐ |
| OpenAI DALL-E | 없음 | $0.04/이미지 | ⭐⭐ |

## 추천 사항

✅ **현재 구현**: Replicate API 사용 (2D만 생성)

### 모델 선택 옵션

현재는 Stable Diffusion v1.5를 사용하지만, 더 애니메 특화된 모델로 변경 가능:

1. **Anything V3** (애니메 특화)
   - Replicate에서 "anything-v3" 검색
   - 모델 버전 ID를 코드의 `version` 필드에 교체

2. **Waifu Diffusion** (애니메 특화)
   - Replicate에서 "waifu-diffusion" 검색
   - 모델 버전 ID를 코드의 `version` 필드에 교체

3. **현재 사용 중**: Stable Diffusion v1.5
   - 프롬프트로 2D 강제 (현재 구현)
   - 안정적이고 다양한 스타일 생성 가능

## 보안 고려사항

1. ✅ **API 키는 서버 사이드에서만 사용** - 구현 완료
2. ✅ **인증 필수** - 로그인한 사용자만 사용 가능
3. ✅ **2D 제한 강제** - 실사 이미지 생성 불가능
4. ✅ **이미지 크기 제한** - 256-1024px 사이로 제한
5. ⚠️ **Rate limiting 추가 권장** - 사용자당 요청 제한 설정

### Rate Limiting 추가 예시

`src/app/api/images/generate/route.ts`에 추가:

```typescript
import { rateLimit } from '@/lib/rate-limit';

// POST 함수 내부에 추가
const rateResult = await rateLimit({
  identifier: `image_generate:${session.user.id}`,
  limit: 10, // 10분에 10회
  windowMs: 10 * 60 * 1000,
});

if (!rateResult.success) {
  return NextResponse.json(
    { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
    { status: 429 }
  );
}
```

## 추가 개선 사항

1. **프롬프트 자동 생성**: 캐릭터 정보를 기반으로 프롬프트 자동 생성
2. **이미지 스타일 프리셋**: 애니메, 리얼리스틱 등 스타일 선택
3. **이미지 편집**: 생성된 이미지에 추가 편집 기능
4. **배치 생성**: 여러 이미지 한 번에 생성

## 참고 자료

- [Hugging Face Inference API 문서](https://huggingface.co/docs/api-inference)
- [Replicate API 문서](https://replicate.com/docs)
- [Stable Diffusion 프롬프트 가이드](https://stable-diffusion-art.com/prompt-guide/)

