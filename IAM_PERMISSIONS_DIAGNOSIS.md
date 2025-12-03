# IAM 권한 진단 가이드

## 사용자가 보여준 정책 분석

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "iam:CreatePolicy",
        "iam:AttachRolePolicy",
        "iam:GetRole"
      ],
      "Resource": "*"
    }
  ]
}
```

이 정책은 **IAM 자체를 수정하는 권한**입니다. Lambda 실행 역할이 아니라, **Amplify 관리자나 다른 관리 역할**에 필요한 권한입니다.

## 403 에러 원인 진단 방법

### 1. CloudWatch 로그 확인

AWS Console → CloudWatch → Log groups → `/aws/amplify/{app-id}`

검색할 키워드:
- `[seed]` - seed 엔드포인트 디버깅 로그
- `[middleware]` - CSRF 토큰 검증 실패 로그
- `AccessDenied` - IAM 권한 부족
- `Permission denied` - 권한 부족
- `403` - Forbidden 에러

### 2. 필요한 IAM 권한 확인

#### Lambda 실행 역할 (AmplifySSRLoggingRole)에 필요한 권한:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters",
        "ssm:GetParametersByPath"
      ],
      "Resource": [
        "arn:aws:ssm:ap-northeast-1:577079095142:parameter/amplify/{app-id}/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

#### 데이터베이스 접근 권한 (RDS가 있는 경우):

```json
{
  "Effect": "Allow",
  "Action": [
    "rds-db:connect"
  ],
  "Resource": "arn:aws:rds-db:ap-northeast-1:577079095142:dbuser:*/{db-user}"
}
```

### 3. 실제 에러 메시지 확인 방법

#### 방법 1: CloudWatch Logs Insights 쿼리

```sql
fields @timestamp, @message
| filter @message like /403/ or @message like /AccessDenied/ or @message like /Permission/
| sort @timestamp desc
| limit 100
```

#### 방법 2: 브라우저 개발자 도구

1. Network 탭에서 `/api/admin/test/seed` 요청 확인
2. Response 탭에서 실제 에러 메시지 확인
3. Headers 탭에서 `x-csrf-token` 헤더 확인

### 4. 일반적인 403 에러 원인

#### A. CSRF 토큰 문제 (가장 가능성 높음)

**증상**:
- `CSRF_TOKEN_INVALID` 에러
- 미들웨어에서 차단

**확인 방법**:
```javascript
// 브라우저 콘솔에서 실행
document.cookie.split(';').find(c => c.includes('csrf-token'))
```

**해결 방법**:
1. 페이지 새로고침 (CSRF 토큰 재발급)
2. 다시 로그인
3. 브라우저 쿠키 삭제 후 재시도

#### B. 관리자 권한 없음

**증상**:
- `[seed] ❌ 권한 없음` 로그
- `この操作を実行する権限がありません` 메시지

**확인 방법**:
- CloudWatch 로그에서 `[seed] Session check` 확인
- `userRole`이 `SUPER_ADMIN`, `MODERATOR`, `CHAR_MANAGER` 중 하나인지 확인

**해결 방법**:
- 데이터베이스에서 사용자 역할 업데이트:
```sql
UPDATE users SET role = 'SUPER_ADMIN' WHERE email = 'your-email@example.com';
```

#### C. SSM Parameter Store 접근 권한 없음

**증상**:
- `AccessDeniedException: User: ... is not authorized to perform: ssm:GetParameters`
- 환경 변수를 불러오지 못함

**확인 방법**:
- CloudWatch 로그에서 `[load-env-vars]` 검색
- `AccessDenied` 또는 `Permission denied` 메시지 확인

**해결 방법**:
1. IAM Console → Roles → `AmplifySSRLoggingRole-*`
2. Permissions 탭에서 SSM 권한 확인
3. `amplify-ssm-policy.json`의 정책을 역할에 연결

#### D. 데이터베이스 접근 권한 없음

**증상**:
- Prisma 연결 실패
- `P1001: Can't reach database server`

**확인 방법**:
- CloudWatch 로그에서 `prisma` 또는 `database` 검색
- 연결 에러 메시지 확인

**해결 방법**:
- RDS 보안 그룹에서 Lambda VPC 접근 허용
- 또는 RDS Public Access 활성화 (개발 환경만)

## 디버깅 체크리스트

- [ ] CloudWatch 로그에서 `[seed]` 로그 확인
- [ ] CSRF 토큰 쿠키 존재 여부 확인
- [ ] 세션 유효성 확인 (로그인 상태)
- [ ] 사용자 역할 확인 (`SUPER_ADMIN`, `MODERATOR`, `CHAR_MANAGER`)
- [ ] SSM Parameter Store 접근 권한 확인
- [ ] 데이터베이스 연결 확인
- [ ] 네트워크 요청 헤더 확인 (`x-csrf-token` 포함 여부)

## 사용자가 보여준 정책의 용도

```json
{
  "Action": [
    "iam:CreatePolicy",      // IAM 정책 생성
    "iam:AttachRolePolicy",   // 역할에 정책 연결
    "iam:GetRole"            // 역할 정보 조회
  ]
}
```

이 정책은:
- **Lambda 실행 역할이 아니라**
- **Amplify 관리자나 다른 관리 역할**에 필요한 권한입니다
- Lambda 함수가 IAM을 수정할 필요는 없으므로, Lambda 실행 역할에는 이 권한이 필요하지 않습니다

## 다음 단계

1. CloudWatch 로그에서 `[seed]` 검색하여 실제 에러 확인
2. 브라우저 개발자 도구에서 Network 탭 확인
3. 위의 체크리스트에 따라 원인 확인
4. 필요시 IAM 권한 추가

