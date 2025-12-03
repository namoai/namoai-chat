# Amplify Lambda IAM 역할에 RDS 권한 추가 가이드

## 개요

IT 환경 RDS 인스턴스를 제어하려면 Amplify Lambda 함수의 IAM 역할에 RDS 권한이 필요합니다.

**중요**: `AWS_ACCESS_KEY_ID`와 `AWS_SECRET_ACCESS_KEY`는 **필요하지 않습니다**. Lambda는 IAM 역할을 자동으로 사용합니다.

## 문제

현재 Lambda 함수의 IAM 역할에 다음 권한이 없을 수 있습니다:
- `rds:DescribeDBInstances`
- `rds:StartDBInstance`
- `rds:StopDBInstance`

## 해결 방법

### 방법 1: AWS 콘솔에서 직접 추가 (권장)

1. **AWS Amplify 콘솔** 접속
   - https://console.aws.amazon.com/amplify/
   - 앱 선택: `duvg1mvqbm4y4`

2. **Lambda 함수의 IAM 역할 찾기**
   - Amplify 앱 설정 → "App settings" → "General"
   - 또는 AWS Lambda 콘솔에서 함수 찾기
   - 함수 이름: `amplify-*-function-*` 형식

3. **IAM 역할 확인**
   - Lambda 함수 → "Configuration" → "Permissions"
   - "Execution role" 클릭

4. **권한 추가**
   - IAM 역할 페이지에서 "Add permissions" → "Attach policies"
   - 다음 정책 중 하나를 선택:
     - **`AmazonRDSFullAccess`** (전체 권한, 간단함)
     - 또는 커스텀 정책 생성 (아래 참조)

### 방법 2: 커스텀 IAM 정책 생성 (더 안전)

1. **IAM 콘솔** 접속
   - https://console.aws.amazon.com/iam/

2. **정책 생성**
   - "Policies" → "Create policy"
   - JSON 탭에서 다음 정책 붙여넣기:

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

3. **정책 이름**: `AmplifyRDSControlPolicy`

4. **IAM 역할에 연결**
   - Lambda 함수의 IAM 역할 선택
   - "Add permissions" → "Attach policies"
   - 생성한 정책 선택

## 확인 방법

권한 추가 후 다음을 확인:

1. **Lambda 함수 재배포** (필요시)
   - Amplify에서 자동으로 재배포되거나
   - 수동으로 트리거 가능

2. **IT 환경 관리 페이지 테스트**
   - `/admin/it-environment` 접속
   - "更新" 버튼 클릭
   - 상태가 정상적으로 표시되는지 확인

3. **로그 확인**
   - CloudWatch Logs에서 `[IT-Environment]` 로그 확인
   - 에러 메시지가 사라졌는지 확인

## 주의사항

- **보안**: 가능하면 `AmazonRDSFullAccess` 대신 최소 권한 정책 사용
- **리소스 제한**: 정책에서 특정 RDS 인스턴스만 지정 가능
- **리전**: `ap-northeast-1` 리전에 맞게 ARN 수정

## 문제 해결

### "AccessDenied" 에러가 계속 발생하는 경우

1. IAM 역할에 정책이 제대로 연결되었는지 확인
2. Lambda 함수가 올바른 IAM 역할을 사용하는지 확인
3. RDS 인스턴스 식별자가 정확한지 확인 (`namos-chat-it`)
4. CloudWatch Logs에서 상세 에러 메시지 확인

### 권한이 적용되지 않는 경우

- IAM 변경사항은 즉시 적용되지만, Lambda 함수가 캐시된 자격 증명을 사용할 수 있음
- Lambda 함수를 재시작하거나 몇 분 기다림

## 참고

- AWS IAM 문서: https://docs.aws.amazon.com/iam/
- Amplify Lambda 권한: https://docs.aws.amazon.com/amplify/latest/userguide/access-control.html

