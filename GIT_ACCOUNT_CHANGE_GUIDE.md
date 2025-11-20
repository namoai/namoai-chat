# Git 계정 변경 가이드

## ❌ 재설치 불필요!
Git을 삭제하고 재설치할 필요 **전혀 없습니다**. 설정만 변경하면 됩니다.

## 🔍 현재 Git 설정 확인

```bash
git config --global --list
```

이 명령어로 현재 설정을 확인할 수 있습니다.

## ✅ Git 계정 변경 방법

### 방법 1: 전역 설정 변경 (가장 간단)

#### 사용자 이름 변경
```bash
git config --global user.name "새로운이름"
```

#### 이메일 변경
```bash
git config --global user.email "새로운이메일@example.com"
```

#### 예시
```bash
# namoai 계정으로 변경
git config --global user.name "namoai"
git config --global user.email "namoai@example.com"
```

### 방법 2: 특정 리포지토리만 변경

현재 프로젝트만 다른 계정 사용:
```bash
# 전역 설정 제거 (선택사항)
git config --global --unset user.name
git config --global --unset user.email

# 현재 리포지토리만 설정
git config user.name "namoai"
git config user.email "namoai@example.com"
```

## 🔐 GitHub 인증 정보 변경

### 중요: Git 설정과 GitHub 인증은 별개!

**Git 설정** (`user.name`, `user.email`):
- 커밋 작성자 정보
- 누가 커밋했는지 표시

**GitHub 인증**:
- 실제로 푸시할 권한
- Personal Access Token 또는 SSH 키 사용

### GitHub 인증 방법

#### 방법 1: Personal Access Token (추천)

1. **토큰 생성**
   - https://github.com/settings/tokens
   - "Generate new token (classic)"
   - `repo` 권한 체크
   - 토큰 복사

2. **푸시 시 사용**
   ```bash
   git push -u origin main
   ```
   - Username: GitHub 사용자명
   - Password: **Personal Access Token** (비밀번호 아님!)

#### 방법 2: Windows Credential Manager (자동 저장)

1. **기존 인증 정보 삭제**
   ```bash
   # Windows Credential Manager에서 삭제
   # 제어판 → 자격 증명 관리자 → Windows 자격 증명
   # 또는
   git credential-manager-core erase
   ```

2. **새 인증 정보 입력**
   - 다음 푸시 시 새 계정 정보 입력
   - Windows가 자동으로 저장

#### 방법 3: SSH 키 사용

1. **SSH 키 생성** (없는 경우)
   ```bash
   ssh-keygen -t ed25519 -C "your_email@example.com"
   ```

2. **공개 키 복사**
   ```bash
   type ~/.ssh/id_ed25519.pub
   ```

3. **GitHub에 SSH 키 추가**
   - GitHub → Settings → SSH and GPG keys
   - "New SSH key" 클릭
   - 공개 키 붙여넣기

4. **원격 URL을 SSH로 변경**
   ```bash
   git remote set-url origin git@github.com:namoai/namoai-chat.git
   ```

## 📋 단계별 가이드

### 현재 상황: `dhdhaha` → `namoai`로 변경

#### 1단계: Git 사용자 정보 변경
```bash
git config --global user.name "namoai"
git config --global user.email "namoai@yourcompany.com"
```

#### 2단계: 기존 인증 정보 삭제 (Windows)
```bash
# Windows Credential Manager에서 삭제
# 또는 다음 명령어로 확인
git config --global credential.helper
```

#### 3단계: Personal Access Token 생성
- https://github.com/settings/tokens
- `namoai` 계정으로 로그인
- 토큰 생성 (`repo` 권한)

#### 4단계: 푸시
```bash
git push -u origin main
```
- Username: `namoai`
- Password: Personal Access Token

## 🔍 설정 확인

### 현재 Git 설정 확인
```bash
git config --global user.name
git config --global user.email
```

### 원격 리포지토리 확인
```bash
git remote -v
```

### 인증 정보 확인 (Windows)
- 제어판 → 자격 증명 관리자 → Windows 자격 증명
- `git:https://github.com` 검색

## ⚠️ 주의사항

### 커밋 작성자 정보
- 이미 커밋된 내용의 작성자는 변경되지 않음
- 새로운 커밋부터 새 정보 사용

### 여러 계정 사용 시
- 전역 설정: `git config --global`
- 로컬 설정: `git config` (전역보다 우선)
- 특정 리포지토리만 다른 계정 사용 가능

## 🚀 빠른 명령어

### namoai 계정으로 변경
```bash
# 1. Git 설정 변경
git config --global user.name "namoai"
git config --global user.email "namoai@yourcompany.com"

# 2. 설정 확인
git config --global --list

# 3. 푸시 (Personal Access Token 필요)
git push -u origin main
```

## 💡 팁

### 여러 GitHub 계정 사용하기
1. **SSH 키 사용** (가장 깔끔)
   - 각 계정마다 다른 SSH 키
   - `~/.ssh/config` 파일로 관리

2. **GitHub CLI 사용**
   ```bash
   gh auth login
   ```

3. **로컬 설정 우선**
   - 전역: 회사 계정
   - 로컬: 개인 계정 (특정 프로젝트만)

## ❓ FAQ

### Q: Git을 재설치해야 하나?
**A: 아니요!** 설정만 변경하면 됩니다.

### Q: 기존 커밋의 작성자도 바뀌나?
**A: 아니요.** 이미 커밋된 내용은 변경되지 않습니다. 새로운 커밋부터 새 정보가 사용됩니다.

### Q: 여러 계정을 동시에 사용할 수 있나?
**A: 네!** SSH 키나 로컬 설정으로 가능합니다.

### Q: Personal Access Token은 어디에 저장되나?
**A: Windows Credential Manager에 저장됩니다.** 안전하게 관리됩니다.

