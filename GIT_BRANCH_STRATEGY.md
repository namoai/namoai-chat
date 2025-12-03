# Git 브랜치 전략 가이드

## 📋 개요

IT 환경에서 테스트 중인 기능이 프로덕션/혼방 환경에 자동으로 반영되지 않도록 **Git 브랜치를 분리**해야 합니다.

---

## 🌳 권장 브랜치 전략

### 브랜치 구조

```
main (프로덕션)
  └─ staging (혼방)
      └─ develop (IT 환경)
          └─ feature/* (개발 브랜치)
```

### 브랜치별 용도

| 브랜치 | Amplify 환경 | 용도 | 자동 배포 |
|--------|-------------|------|----------|
| `main` | 프로덕션 | 실제 서비스 | ✅ |
| `staging` | 혼방(스테이징) | QA 검증 | ✅ |
| `develop` | IT 환경 | 통합 테스트 | ✅ |
| `feature/*` | 없음 | 기능 개발 | ❌ |

---

## 🔄 워크플로우

### 1. 기능 개발

```bash
# feature 브랜치에서 개발
git checkout -b feature/new-feature
# ... 개발 작업 ...
git commit -m "새 기능 추가"
git push origin feature/new-feature
```

### 2. IT 환경에서 테스트

```bash
# develop 브랜치에 머지
git checkout develop
git merge feature/new-feature
git push origin develop
# → IT 환경 Amplify에 자동 배포
# → IT 환경에서 테스트
```

### 3. 혼방 환경에서 QA

```bash
# IT 환경 테스트 통과 후 staging에 머지
git checkout staging
git merge develop
git push origin staging
# → 혼방 환경 Amplify에 자동 배포
# → QA 검증
```

### 4. 프로덕션 배포

```bash
# QA 통과 후 main에 머지
git checkout main
git merge staging
git push origin main
# → 프로덕션 Amplify에 자동 배포
```

---

## 🚀 Amplify 브랜치 연결

### 브랜치별 Amplify 설정

1. **main 브랜치** → 프로덕션 Amplify 앱
   - `APP_ENV=production`
   - 프로덕션 RDS

2. **staging 브랜치** → 혼방 Amplify 앱
   - `APP_ENV=staging`
   - 스테이징 RDS

3. **develop 브랜치** → IT 환경 Amplify 앱 (또는 같은 앱의 브랜치)
   - `APP_ENV=integration`
   - IT RDS

---

## 📝 초기 설정 방법

### 방법 1: 기존 브랜치 사용 (간단)

이미 `develop` 브랜치가 있다면:

```bash
# develop 브랜치 확인
git branch -a

# develop 브랜치가 있으면 그대로 사용
# 없으면 생성
git checkout -b develop
git push origin develop
```

### 방법 2: 새 브랜치 생성

```bash
# main에서 develop 브랜치 생성
git checkout main
git checkout -b develop
git push origin develop

# staging 브랜치도 생성 (없는 경우)
git checkout main
git checkout -b staging
git push origin staging
```

---

## ✅ 장점

1. **환경 분리**: IT 환경에서 테스트해도 프로덕션에 영향 없음
2. **안전한 테스트**: 실험적인 기능도 IT 환경에서 자유롭게 테스트
3. **단계적 배포**: develop → staging → main 순서로 검증
4. **롤백 용이**: 문제 발생 시 이전 브랜치로 쉽게 롤백

---

## 🔧 Amplify 브랜치 연결

### 같은 앱에서 브랜치 추가

1. **Amplify Console** → 앱 선택
2. **"분기"** 탭 → **"분기 추가"**
3. 브랜치 선택:
   - `develop` → IT 환경
   - `staging` → 혼방 환경
   - `main` → 프로덕션

### 브랜치별 환경 변수

각 브랜치마다 환경 변수를 다르게 설정:

**develop 브랜치 (IT 환경):**
```bash
APP_ENV=integration
DATABASE_URL=postgresql://...IT 환경 DB...
```

**staging 브랜치 (혼방):**
```bash
APP_ENV=staging
DATABASE_URL=postgresql://...스테이징 DB...
```

**main 브랜치 (프로덕션):**
```bash
APP_ENV=production
DATABASE_URL=postgresql://...프로덕션 DB...
```

---

## 💡 실전 예시

### 시나리오: 새 기능 개발

1. **기능 개발**
   ```bash
   git checkout -b feature/chat-improvement
   # ... 개발 ...
   git commit -m "채팅 기능 개선"
   ```

2. **IT 환경 테스트**
   ```bash
   git checkout develop
   git merge feature/chat-improvement
   git push origin develop
   # → IT 환경에 자동 배포
   # → IT 환경에서 테스트
   ```

3. **문제 발견 시**
   ```bash
   # develop 브랜치에서 수정
   git checkout develop
   # ... 수정 ...
   git commit -m "버그 수정"
   git push origin develop
   # → IT 환경에만 반영, 프로덕션은 안전
   ```

4. **테스트 통과 후 혼방 배포**
   ```bash
   git checkout staging
   git merge develop
   git push origin staging
   # → 혼방 환경에 배포
   ```

---

## 📚 참고 자료

- [Git Flow 전략](https://nvie.com/posts/a-successful-git-branching-model/)
- [Amplify 브랜치 관리](https://docs.aws.amazon.com/amplify/latest/userguide/managing-branches.html)

---

**작성일:** 2025-01-27  
**핵심:** Git 브랜치를 나눠서 환경을 분리하면 안전하게 테스트할 수 있습니다!

