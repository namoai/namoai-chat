# AWS 자격 증명 확인 가이드

## 📋 개요

AWS 자격 증명(Access Key ID, Secret Access Key)을 확인하고 설정하는 방법입니다.

---

## 🔑 AWS 자격 증명 확인 방법

### 방법 1: AWS Console에서 새 Access Key 생성 (권장)

#### 1단계: AWS Console 접속

1. **AWS Console 로그인**
   - https://console.aws.amazon.com/
   - 계정에 로그인

#### 2단계: IAM 서비스 접속

1. 상단 검색창에 **"IAM"** 입력
2. **IAM (Identity and Access Management)** 클릭
3. 또는 직접 링크: https://console.aws.amazon.com/iam/

#### 3단계: 사용자 선택 또는 생성

**기존 사용자 사용:**
1. 왼쪽 메뉴에서 **"사용자"** 클릭
2. 사용자 이름 클릭 (또는 새 사용자 생성)

**새 사용자 생성 (권장):**
1. **"사용자 추가"** 클릭
2. 사용자 이름 입력 (예: `it-environment-admin`)
3. **"AWS 자격 증명 유형"** 선택
   - ✅ **"액세스 키 - 프로그래밍 방식 액세스"** 체크
4. **"다음: 권한"** 클릭

#### 4단계: 권한 설정

**최소 권한 정책 연결:**

1. **"기존 정책 직접 연결"** 선택
2. 다음 정책 검색 및 선택:
   - `AmazonRDSFullAccess` (또는 더 제한적인 정책)
   - `AmazonEC2FullAccess` (보안 그룹 설정용)
   - `IAMFullAccess` (IAM 정책 생성용, 선택사항)

또는 **인라인 정책 생성:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "rds:DescribeDBInstances",
        "rds:StartDBInstance",
        "rds:StopDBInstance",
        "rds:DescribeDBClusters",
        "ec2:AuthorizeSecurityGroupIngress",
        "ec2:DescribeSecurityGroups",
        "ec2:DescribeVpcs",
        "iam:CreatePolicy",
        "iam:AttachRolePolicy",
        "iam:GetRole",
        "sts:GetCallerIdentity"
      ],
      "Resource": "*"
    }
  ]
}
```

3. **"다음: 태그"** → **"다음: 검토"** → **"사용자 만들기"** 클릭

#### 5단계: Access Key 확인 및 저장

⚠️ **중요: 이 단계에서만 Access Key를 확인할 수 있습니다!**

1. **"액세스 키 ID"** 복사 → `AWS_ACCESS_KEY_ID`에 사용
2. **"비밀 액세스 키"** 복사 → `AWS_SECRET_ACCESS_KEY`에 사용
   - **"비밀 액세스 키 표시"** 클릭하여 확인
3. **⚠️ 반드시 안전한 곳에 저장하세요!**
   - 이 창을 닫으면 Secret Access Key를 다시 확인할 수 없습니다
   - 다시 확인하려면 새 Access Key를 생성해야 합니다

---

### 방법 2: 기존 Access Key 확인

**⚠️ 주의: Secret Access Key는 한 번만 표시되므로, 이미 생성된 키의 Secret은 확인할 수 없습니다.**

기존 Access Key ID만 확인 가능:

1. **IAM Console** → **"사용자"** → 사용자 선택
2. **"보안 자격 증명"** 탭
3. **"액세스 키"** 섹션에서 Access Key ID 확인

**Secret Access Key를 모르는 경우:**
- 새 Access Key를 생성해야 합니다 (위 방법 1 참고)

---

## 📝 .env.local 파일에 추가

`.env.local` 파일에 다음을 추가하세요:

```bash
# AWS 자격 증명
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=ap-northeast-1

# IT 환경 설정
IT_RDS_INSTANCE_IDENTIFIER=namos-chat-it
```

**⚠️ 보안 주의사항:**
- `.env.local` 파일은 **절대 Git에 커밋하지 마세요!**
- `.gitignore`에 `.env.local`이 포함되어 있는지 확인하세요

---

## 🔒 보안 권장사항

### 1. 최소 권한 원칙

필요한 권한만 부여:
- RDS 제어: `rds:DescribeDBInstances`, `rds:StartDBInstance`, `rds:StopDBInstance`
- 보안 그룹: `ec2:AuthorizeSecurityGroupIngress`, `ec2:DescribeSecurityGroups`
- IAM (선택): `iam:CreatePolicy`, `iam:AttachRolePolicy`

### 2. Access Key 로테이션

정기적으로 Access Key를 교체:
1. 새 Access Key 생성
2. 애플리케이션에 새 키 적용
3. 이전 키 비활성화
4. 확인 후 이전 키 삭제

### 3. MFA 활성화

가능하면 MFA(Multi-Factor Authentication) 활성화 권장

---

## ❓ 문제 해결

### 문제 1: Access Key를 찾을 수 없습니다

**해결:**
- 새 Access Key 생성 (방법 1 참고)
- IAM 사용자에 "액세스 키 - 프로그래밍 방식 액세스" 권한이 있는지 확인

### 문제 2: 권한 오류가 발생합니다

**원인:**
- IAM 사용자에 필요한 권한이 없음

**해결:**
1. IAM Console → 사용자 선택
2. "권한" 탭 확인
3. 필요한 정책 추가

### 문제 3: Secret Access Key를 잃어버렸습니다

**해결:**
- Secret Access Key는 재확인 불가능
- 새 Access Key 생성 필요
- 이전 Access Key는 삭제 또는 비활성화

---

## 📚 참고 자료

- [AWS IAM 사용자 가이드](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users.html)
- [AWS Access Key 관리](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html)
- [AWS 보안 모범 사례](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)

---

**작성일:** 2025-01-27  
**다음 단계:** AWS 자격 증명 설정 후 `npm run it:setup-security` 실행

