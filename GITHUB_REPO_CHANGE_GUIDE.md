# GitHub 리포지토리 변경 가이드

## 🔴 현재 문제
```
Permission denied to dhdhaha
namoai/namoai-chat 리포지토리에 접근 권한 없음
```

## ✅ 해결 방법

### 방법 1: GitHub 조직에 멤버 추가 (가장 간단)

1. **GitHub에서 `namoai` 조직 관리자에게 요청**
   - `namoai` 조직의 Settings → Members
   - `dhdhaha` 계정을 멤버로 추가
   - 권한: **Write** 또는 **Admin** 권한 필요

2. **멤버 추가 후 다시 푸시**
   ```bash
   git push -u origin main
   ```

### 방법 2: Personal Access Token 사용

1. **Personal Access Token 생성**
   - GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - "Generate new token (classic)" 클릭
   - **권한 선택**:
     - ✅ `repo` (전체 체크)
     - ✅ `workflow` (Actions 사용 시)
   - "Generate token" 클릭
   - **토큰 복사** (한 번만 보여줌!)

2. **토큰으로 푸시**
   ```bash
   # 사용자명: dhdhaha
   # 비밀번호 대신 Personal Access Token 입력
   git push -u origin main
   ```
   - Username: `dhdhaha`
   - Password: **Personal Access Token** (복사한 토큰)

### 방법 3: SSH 키 사용 (권장)

1. **SSH 키 확인**
   ```bash
   # SSH 키가 있는지 확인
   ls ~/.ssh/id_rsa.pub
   ```

2. **SSH 키가 없으면 생성**
   ```bash
   ssh-keygen -t ed25519 -C "your_email@example.com"
   # Enter 키 여러 번 (기본값 사용)
   ```

3. **SSH 공개 키 복사**
   ```bash
   # Windows
   type ~/.ssh/id_ed25519.pub
   # 또는
   cat ~/.ssh/id_ed25519.pub
   ```

4. **GitHub에 SSH 키 추가**
   - GitHub → Settings → SSH and GPG keys
   - "New SSH key" 클릭
   - Title: "My Computer" (원하는 이름)
   - Key: 복사한 공개 키 붙여넣기
   - "Add SSH key" 클릭

5. **원격 URL을 SSH로 변경**
   ```bash
   git remote set-url origin git@github.com:namoai/namoai-chat.git
   ```

6. **SSH로 푸시**
   ```bash
   git push -u origin main
   ```

### 방법 4: GitHub CLI 사용

1. **GitHub CLI 설치** (없는 경우)
   - https://cli.github.com/

2. **로그인**
   ```bash
   gh auth login
   ```

3. **푸시**
   ```bash
   git push -u origin main
   ```

## 🔍 현재 상태 확인

### 원격 리포지토리 확인
```bash
git remote -v
```
**결과**: `origin https://github.com/namoai/namoai-chat.git` ✅

### 커밋 상태 확인
```bash
git status
```
**결과**: 모든 변경사항이 커밋됨 ✅

## 📋 단계별 체크리스트

### 1단계: 권한 확인
- [ ] `namoai` 조직의 멤버인가?
- [ ] 리포지토리에 Write 권한이 있는가?

### 2단계: 인증 방법 선택
- [ ] 방법 1: 조직 멤버 추가 (가장 간단)
- [ ] 방법 2: Personal Access Token
- [ ] 방법 3: SSH 키 (권장)
- [ ] 방법 4: GitHub CLI

### 3단계: 푸시 실행
```bash
git push -u origin main
```

## 🚀 빠른 해결 (가장 빠른 방법)

### Personal Access Token 사용 (5분)

1. **토큰 생성**
   - https://github.com/settings/tokens
   - "Generate new token (classic)"
   - `repo` 권한 체크
   - 생성 후 복사

2. **푸시 시 토큰 사용**
   ```bash
   git push -u origin main
   ```
   - Username: `dhdhaha`
   - Password: **Personal Access Token** (복사한 토큰)

## ⚠️ 주의사항

### Personal Access Token 보안
- ✅ 절대 GitHub에 커밋하지 말 것
- ✅ `.env` 파일에 저장하지 말 것
- ✅ 필요시만 생성하고 사용 후 삭제 가능

### SSH 키 보안
- ✅ 개인 키(`id_ed25519`)는 절대 공유하지 말 것
- ✅ 공개 키(`id_ed25519.pub`)만 GitHub에 추가

## 🔗 참고 링크

- [GitHub Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- [GitHub SSH Keys](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)
- [GitHub Organizations](https://docs.github.com/en/organizations)

