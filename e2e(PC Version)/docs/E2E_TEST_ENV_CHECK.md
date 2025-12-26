# 환경 변수 확인 방법

**최종 업데이트**: 2025년 12월 22일

---

## 🔍 Bash에서 환경 변수 확인

### 기본 확인 방법
+-9+
```bash
# 단일 환경 변수 확인
echo $PLAYWRIGHT_BASE_URL
echo $ADMIN_BASIC_AUTH_USER
echo $ADMIN_EMAIL
echo $ADMIN_PASSWORD

# 환경 변수가 설정되지 않은 경우 빈 줄이 출력됨+

# ADMIN 관련 환경 변수만 확인
env | grep ADMIN

# TEST 관련 환경 변수만 확인
env | grep TEST

# 모든 환경 변수 확인 (너무 많으니 필터링 권장)
env | grep -E "PLAYWRIGHT|ADMIN|TEST"
```

### 환경 변수 존재 여부 확인 (스크립트용)

```bash
# 환경 변수가 설정되어 있는지 확인
if [ -z "$ADMIN_BASIC_AUTH_USER" ]; then
  echo "❌ ADMIN_BASIC_AUTH_USER가 설정되지 않았습니다"
else
  echo "✅ ADMIN_BASIC_AUTH_USER: $ADMIN_BASIC_AUTH_USER"
fi

# 여러 환경 변수 한번에 확인
check_env() {
  local var_name=$1
  if [ -z "${!var_name}" ]; then
    echo "❌ $var_name가 설정되지 않았습니다"
    return 1
  else
    echo "✅ $var_name: ${!var_name}"
    return 0
  fi
}

check_env "PLAYWRIGHT_BASE_URL"
check_env "ADMIN_BASIC_AUTH_USER"
check_env "ADMIN_BASIC_AUTH_PASSWORD"
check_env "ADMIN_EMAIL"
check_env "ADMIN_PASSWORD"
```

### 환경 변수 설정 스크립트

```bash
#!/bin/bash
# check-e2e-env.sh

echo "=== E2E 테스트 환경 변수 확인 ==="
echo ""

# 필수 환경 변수 목록
REQUIRED_VARS=(
  "PLAYWRIGHT_BASE_URL"
  "ADMIN_BASIC_AUTH_USER"
  "ADMIN_BASIC_AUTH_PASSWORD"
  "ADMIN_EMAIL"
  "ADMIN_PASSWORD"
)

# 선택적 환경 변수 목록
OPTIONAL_VARS=(
  "TEST_EMAIL"
  "TEST_PASSWORD"
  "TEST_2FA_CODE"
)

echo "📋 필수 환경 변수:"
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    echo "  ❌ $var: 설정되지 않음"
  else
    # 비밀번호는 일부만 표시
    if [[ "$var" == *"PASSWORD"* ]] || [[ "$var" == *"SECRET"* ]]; then
      echo "  ✅ $var: ${!var:0:3}***"
    else
      echo "  ✅ $var: ${!var}"
    fi
  fi
done

echo ""
echo "📋 선택적 환경 변수:"
for var in "${OPTIONAL_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    echo "  ⚠️  $var: 설정되지 않음 (선택사항)"
  else
    if [[ "$var" == *"PASSWORD"* ]] || [[ "$var" == *"SECRET"* ]]; then
      echo "  ✅ $var: ${!var:0:3}***"
    else
      echo "  ✅ $var: ${!var}"
    fi
  fi
done
```

### 사용 방법

```bash
# 스크립트에 실행 권한 부여
chmod +x check-e2e-env.sh

# 실행
./check-e2e-env.sh
```

---

## 🔍 PowerShell에서 환경 변수 확인

### 기본 확인 방법

```powershell
# 단일 환경 변수 확인
$env:PLAYWRIGHT_BASE_URL
$env:ADMIN_BASIC_AUTH_USER
$env:ADMIN_EMAIL

# 환경 변수가 설정되지 않은 경우 $null 반환
```

### 모든 관련 환경 변수 확인

```powershell
# PLAYWRIGHT 관련 환경 변수만 확인
Get-ChildItem Env: | Where-Object { $_.Name -like "*PLAYWRIGHT*" }

# ADMIN 관련 환경 변수만 확인
Get-ChildItem Env: | Where-Object { $_.Name -like "*ADMIN*" }

# TEST 관련 환경 변수만 확인
Get-ChildItem Env: | Where-Object { $_.Name -like "*TEST*" }

# 모든 관련 환경 변수 확인
Get-ChildItem Env: | Where-Object { 
  $_.Name -like "*PLAYWRIGHT*" -or 
  $_.Name -like "*ADMIN*" -or 
  $_.Name -like "*TEST*" 
}
```

### 환경 변수 존재 여부 확인

```powershell
# 환경 변수가 설정되어 있는지 확인
if ($env:ADMIN_BASIC_AUTH_USER) {
  Write-Host "✅ ADMIN_BASIC_AUTH_USER: $env:ADMIN_BASIC_AUTH_USER"
} else {
  Write-Host "❌ ADMIN_BASIC_AUTH_USER가 설정되지 않았습니다"
}
```

---

## 🔍 Windows CMD에서 환경 변수 확인

### 기본 확인 방법

```cmd
REM 단일 환경 변수 확인
echo %PLAYWRIGHT_BASE_URL%
echo %ADMIN_BASIC_AUTH_USER%
echo %ADMIN_EMAIL%

REM 환경 변수가 설정되지 않은 경우 빈 줄이 출력됨
```

### 모든 환경 변수 확인

```cmd
REM 모든 환경 변수 확인
set | findstr PLAYWRIGHT
set | findstr ADMIN
set | findstr TEST
```

---

## 📝 빠른 확인 명령어

### Bash

```bash
# 한 줄로 모든 관련 환경 변수 확인
env | grep -E "PLAYWRIGHT|ADMIN|TEST" | sort
```

### PowerShell

```powershell
# 한 줄로 모든 관련 환경 변수 확인
Get-ChildItem Env: | Where-Object { $_.Name -match "PLAYWRIGHT|ADMIN|TEST" } | Sort-Object Name
```

---

## ⚠️ 주의사항

1. **비밀번호 표시**: 환경 변수 확인 시 비밀번호가 터미널에 표시될 수 있습니다
2. **히스토리**: Bash/PowerShell 히스토리에 환경 변수가 저장될 수 있습니다
3. **보안**: 프로덕션 환경에서는 환경 변수를 직접 출력하지 마세요

---

## 🎯 추천 방법

테스트 실행 전에 환경 변수를 확인하는 스크립트를 만들어 사용하세요:

```bash
#!/bin/bash
# test-env-check.sh

echo "환경 변수 확인 중..."
if [ -z "$ADMIN_BASIC_AUTH_USER" ]; then
  echo "❌ ADMIN_BASIC_AUTH_USER가 설정되지 않았습니다"
  exit 1
fi

if [ -z "$ADMIN_EMAIL" ]; then
  echo "❌ ADMIN_EMAIL이 설정되지 않았습니다"
  exit 1
fi

echo "✅ 필수 환경 변수가 모두 설정되었습니다"
```














