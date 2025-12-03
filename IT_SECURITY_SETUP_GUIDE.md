# IT 환경 보안 그룹 및 IAM 권한 설정 가이드

## 📋 개요

IT 환경 RDS 인스턴스에 접근하고 관리 패널에서 제어하기 위한 보안 그룹 및 IAM 권한 설정 가이드입니다.

---

## 🚀 빠른 시작

### 자동 설정 (권장)

```bash
# 1. AWS CLI 설치 확인
aws --version

# 2. AWS 자격 증명 설정 (처음 한 번만)
aws configure

# 3. 환경 변수 설정 (선택사항)
export IT_RDS_INSTANCE_IDENTIFIER=namos-chat-it
export AWS_REGION=ap-northeast-1
export SOURCE_SECURITY_GROUP_ID=sg-xxxxx  # 프로덕션/스테이징 보안 그룹 ID
export IAM_ROLE_NAME=your-iam-role-name    # IAM 역할 이름

# 4. 자동 설정 실행
npm run it:setup-security
```

---

## 📝 단계별 설명

### 1단계: AWS CLI 설치 및 설정

#### AWS CLI 설치

**Windows:**
```powershell
# Chocolatey 사용
choco install awscli

# 또는 MSI 설치 프로그램 다운로드
# https://aws.amazon.com/cli/
```

**macOS:**
```bash
brew install awscli
```

**Linux:**
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

#### AWS 자격 증명 설정

```bash
# 대화형 설정
aws configure

# 또는 환경 변수로 설정
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_REGION=ap-northeast-1
```

---

### 2단계: 보안 그룹 설정

#### 자동 설정 (스크립트 사용)

```bash
npm run it:setup-security
```

스크립트가 자동으로:
- RDS 인스턴스 정보 확인
- 보안 그룹 ID 자동 감지
- 현재 IP에서 접근 허용 또는 소스 보안 그룹 규칙 추가

#### 수동 설정 (AWS Console)

1. **AWS RDS Console 접속**
   - https://console.aws.amazon.com/rds/

2. **RDS 인스턴스 선택**
   - `namos-chat-it` 인스턴스 클릭

3. **보안 그룹 확인**
   - **연결 및 보안** 탭
   - **VPC 보안 그룹** 클릭

4. **인바운드 규칙 추가**
   - **인바운드 규칙 편집** 클릭
   - **규칙 추가** 클릭

   **규칙 설정:**
   - **유형**: PostgreSQL
   - **프로토콜**: TCP
   - **포트**: 5432
   - **소스**: 
     - **특정 IP 주소**: 개발자 IP (예: `1.2.3.4/32`)
     - **보안 그룹**: 프로덕션/스테이징 환경 보안 그룹 ID
     - **모든 IPv4 트래픽**: `0.0.0.0/0` (비추천, 보안 위험)

5. **규칙 저장**

---

### 3단계: IAM 권한 설정

#### 자동 설정 (IAM 역할이 있는 경우)

```bash
export IAM_ROLE_NAME=your-iam-role-name
npm run it:setup-security
```

#### 수동 설정 (AWS Console)

1. **IAM Console 접속**
   - https://console.aws.amazon.com/iam/

2. **역할 또는 사용자 선택**
   - 프로덕션/스테이징 환경에서 사용하는 IAM 역할 또는 사용자 선택

3. **권한 추가**
   - **권한 추가** → **인라인 정책 생성** (또는 **정책 연결**)

4. **정책 JSON 입력**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "rds:DescribeDBInstances",
        "rds:StartDBInstance",
        "rds:StopDBInstance"
      ],
      "Resource": "arn:aws:rds:ap-northeast-1:*:db:namos-chat-it"
    }
  ]
}
```

5. **정책 이름 지정**
   - 예: `IT-RDS-Control-Policy`

6. **정책 생성**

---

## 🔍 설정 확인

### 보안 그룹 확인

```bash
# RDS 인스턴스 정보 확인
aws rds describe-db-instances \
  --db-instance-identifier namos-chat-it \
  --region ap-northeast-1 \
  --query 'DBInstances[0].VpcSecurityGroups'

# 보안 그룹 규칙 확인
aws ec2 describe-security-groups \
  --group-ids sg-xxxxx \
  --region ap-northeast-1 \
  --query 'SecurityGroups[0].IpPermissions'
```

### IAM 권한 확인

```bash
# IAM 역할 정책 확인
aws iam list-attached-role-policies \
  --role-name your-iam-role-name

# 정책 내용 확인
aws iam get-policy \
  --policy-arn arn:aws:iam::ACCOUNT_ID:policy/IT-RDS-Control-Policy
```

---

## ❓ 문제 해결

### 문제 1: AWS CLI를 찾을 수 없습니다

**해결:**
- AWS CLI 설치 확인: `aws --version`
- PATH 환경 변수 확인
- 재설치 필요 시 공식 문서 참고

### 문제 2: 자격 증명 오류

**원인:**
- AWS 자격 증명 미설정
- 잘못된 자격 증명

**해결:**
```bash
# 자격 증명 확인
aws sts get-caller-identity

# 자격 증명 재설정
aws configure
```

### 문제 3: 보안 그룹 규칙 추가 실패

**원인:**
- 권한 부족
- 잘못된 보안 그룹 ID

**해결:**
- IAM 권한 확인 (`ec2:AuthorizeSecurityGroupIngress`)
- 보안 그룹 ID 확인
- 수동으로 AWS Console에서 설정

### 문제 4: IAM 정책 생성 실패

**원인:**
- 권한 부족
- 정책 이름 중복

**해결:**
- IAM 권한 확인 (`iam:CreatePolicy`, `iam:AttachRolePolicy`)
- 기존 정책 확인 및 삭제 후 재생성
- 수동으로 AWS Console에서 설정

---

## 📚 참고 자료

- [AWS CLI 설치 가이드](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- [AWS RDS 보안 그룹 설정](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Overview.RDSSecurityGroups.html)
- [AWS IAM 정책 생성](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_create.html)

---

**작성일:** 2025-01-27  
**다음 단계:** 보안 그룹 및 IAM 권한 설정 완료 후 관리 패널에서 IT 환경 제어 테스트

