# Git 인증 정보 삭제 방법

## 🔴 현재 문제
Windows Credential Manager에 `dhdhaha` 계정 정보가 저장되어 있어서 `namoai` 조직 리포지토리에 접근할 수 없습니다.

## ✅ 해결 방법

### 방법 1: Windows Credential Manager에서 직접 삭제 (가장 확실)

1. **Windows 검색** → "자격 증명 관리자" 입력
2. **Windows 자격 증명** 클릭
3. **일반 자격 증명** 또는 **Windows 자격 증명** 탭에서
4. `git:https://github.com` 검색
5. **화살표 클릭** → **제거** 클릭

### 방법 2: 명령어로 삭제

PowerShell을 **관리자 권한**으로 실행:

```powershell
# Git 관련 자격 증명 모두 삭제
cmdkey /list | Select-String "git" | ForEach-Object {
    $line = $_.Line
    if ($line -match "Target: (.+)") {
        cmdkey /delete:$matches[1]
    }
}
```

또는 수동으로:
```cmd
cmdkey /delete:git:https://github.com
```

### 방법 3: Git Credential Manager 초기화

```bash
# Credential Manager 초기화
git credential-manager-core erase
# 또는
git credential reject https://github.com
```

그 다음 푸시 시도:
```bash
git push -u origin main
```
- 이때 `namoai` 계정 정보 입력

## 🚀 빠른 해결 (권장)

1. **제어판** → **자격 증명 관리자** → **Windows 자격 증명**
2. `git:https://github.com` 검색 → **제거**
3. 푸시 재시도:
   ```bash
   git push -u origin main
   ```
4. **Username**: `namoai` 입력
5. **Password**: GitHub 비밀번호 또는 Personal Access Token 입력

## 💡 팁

### Personal Access Token 사용 (비밀번호 대신)
- GitHub 비밀번호 대신 Personal Access Token 사용 가능
- 더 안전하고 권한 관리 용이

### SSH 키 사용 (가장 깔끔)
- SSH 키를 사용하면 계정 전환 문제 없음
- 한 번 설정하면 계속 사용 가능

