#!/usr/bin/env node

/**
 * IT 환경 보안 그룹 및 IAM 권한 설정 스크립트
 * 
 * 사용법:
 *   node scripts/setup-it-security.mjs
 * 
 * 환경 변수:
 *   AWS_REGION - AWS 리전 (기본값: ap-northeast-1)
 *   IT_RDS_INSTANCE_IDENTIFIER - IT 환경 RDS 인스턴스 식별자 (기본값: namos-chat-it)
 *   IT_RDS_SECURITY_GROUP_ID - IT 환경 RDS 보안 그룹 ID
 *   SOURCE_SECURITY_GROUP_ID - 프로덕션/스테이징 환경 보안 그룹 ID (선택사항)
 *   IAM_ROLE_NAME - IAM 역할 이름 (선택사항)
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// .env.local 파일 로드
function loadEnvLocal() {
  const envLocalPath = join(rootDir, '.env.local');
  if (existsSync(envLocalPath)) {
    const content = readFileSync(envLocalPath, 'utf-8');
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

loadEnvLocal();

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// AWS CLI 설치 확인
function checkAWSCLI() {
  try {
    execSync('aws --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

// AWS 자격 증명 확인
function checkAWSCredentials() {
  try {
    const result = execSync('aws sts get-caller-identity', { encoding: 'utf-8' });
    const identity = JSON.parse(result);
    log(`✅ AWS 자격 증명 확인: ${identity.Arn}`, colors.green);
    return true;
  } catch (error) {
    log(`❌ AWS 자격 증명 확인 실패: ${error.message}`, colors.red);
    log(`   AWS CLI를 설정하거나 환경 변수를 확인하세요.`, colors.yellow);
    return false;
  }
}

// RDS 인스턴스 정보 가져오기
function getRDSInstanceInfo(instanceIdentifier, region) {
  try {
    const result = execSync(
      `aws rds describe-db-instances --db-instance-identifier ${instanceIdentifier} --region ${region} --output json`,
      { encoding: 'utf-8' }
    );
    const data = JSON.parse(result);
    if (data.DBInstances && data.DBInstances.length > 0) {
      return data.DBInstances[0];
    }
    return null;
  } catch (error) {
    log(`⚠️  RDS 인스턴스 정보 가져오기 실패: ${error.message}`, colors.yellow);
    return null;
  }
}

// 보안 그룹 규칙 추가
function addSecurityGroupRule(securityGroupId, sourceSecurityGroupId, region, description) {
  try {
    log(`  보안 그룹 규칙 추가 중...`, colors.cyan);
    
    const command = `aws ec2 authorize-security-group-ingress \
      --group-id ${securityGroupId} \
      --protocol tcp \
      --port 5432 \
      --source-group ${sourceSecurityGroupId} \
      --region ${region} \
      --description "${description}"`;
    
    execSync(command, { stdio: 'inherit' });
    log(`  ✅ 보안 그룹 규칙 추가 완료`, colors.green);
    return true;
  } catch (error) {
    if (error.message.includes('already exists') || error.message.includes('Duplicate')) {
      log(`  ℹ️  보안 그룹 규칙이 이미 존재합니다.`, colors.yellow);
      return true;
    }
    log(`  ❌ 보안 그룹 규칙 추가 실패: ${error.message}`, colors.red);
    return false;
  }
}

// 현재 IP에서 접근 허용
function addCurrentIPAccess(securityGroupId, region) {
  try {
    log(`  현재 IP 주소 확인 중...`, colors.cyan);
    
    // 외부 IP 확인 (간단한 방법)
    let currentIP = '0.0.0.0/0'; // 기본값 (모든 IP 허용 - 보안상 권장하지 않음)
    
    try {
      const ipResult = execSync('curl -s https://api.ipify.org', { encoding: 'utf-8' });
      currentIP = ipResult.trim();
      log(`  현재 IP: ${currentIP}`, colors.cyan);
    } catch (e) {
      log(`  ⚠️  IP 확인 실패, 수동으로 입력하세요.`, colors.yellow);
      log(`  현재 IP를 입력하세요 (예: 1.2.3.4/32): `, colors.yellow);
      // 자동화를 위해 기본값 사용
    }
    
    log(`  현재 IP(${currentIP})에서 접근 허용 중...`, colors.cyan);
    
    const command = `aws ec2 authorize-security-group-ingress \
      --group-id ${securityGroupId} \
      --protocol tcp \
      --port 5432 \
      --cidr ${currentIP}/32 \
      --region ${region} \
      --description "IT 환경 접근 - 현재 IP"`;
    
    execSync(command, { stdio: 'inherit' });
    log(`  ✅ 현재 IP 접근 허용 완료`, colors.green);
    return true;
  } catch (error) {
    if (error.message.includes('already exists') || error.message.includes('Duplicate')) {
      log(`  ℹ️  현재 IP 접근 규칙이 이미 존재합니다.`, colors.yellow);
      return true;
    }
    log(`  ❌ 현재 IP 접근 허용 실패: ${error.message}`, colors.red);
    return false;
  }
}

// IAM 정책 생성
function createIAMPolicy(policyName, region) {
  const policyDocument = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: [
          'rds:DescribeDBInstances',
          'rds:StartDBInstance',
          'rds:StopDBInstance',
          'rds:DescribeDBClusters',
        ],
        Resource: `arn:aws:rds:${region}:*:db:${process.env.IT_RDS_INSTANCE_IDENTIFIER || 'namos-chat-it'}`,
      },
    ],
  };
  
  try {
    log(`  IAM 정책 생성 중...`, colors.cyan);
    
    const policyFile = join(rootDir, 'temp-iam-policy.json');
    require('fs').writeFileSync(policyFile, JSON.stringify(policyDocument, null, 2));
    
    const command = `aws iam create-policy \
      --policy-name ${policyName} \
      --policy-document file://${policyFile} \
      --description "IT 환경 RDS 제어 정책"`;
    
    execSync(command, { stdio: 'inherit' });
    
    // 임시 파일 삭제
    require('fs').unlinkSync(policyFile);
    
    log(`  ✅ IAM 정책 생성 완료`, colors.green);
    return true;
  } catch (error) {
    if (error.message.includes('already exists') || error.message.includes('EntityAlreadyExists')) {
      log(`  ℹ️  IAM 정책이 이미 존재합니다.`, colors.yellow);
      return true;
    }
    log(`  ❌ IAM 정책 생성 실패: ${error.message}`, colors.red);
    return false;
  }
}

// IAM 역할에 정책 연결
function attachPolicyToRole(roleName, policyArn) {
  try {
    log(`  IAM 역할에 정책 연결 중...`, colors.cyan);
    
    const command = `aws iam attach-role-policy \
      --role-name ${roleName} \
      --policy-arn ${policyArn}`;
    
    execSync(command, { stdio: 'inherit' });
    log(`  ✅ IAM 역할에 정책 연결 완료`, colors.green);
    return true;
  } catch (error) {
    log(`  ❌ IAM 역할에 정책 연결 실패: ${error.message}`, colors.red);
    return false;
  }
}

// 메인 함수
async function main() {
  log('\n🔐 IT 환경 보안 그룹 및 IAM 권한 설정 시작\n', colors.cyan);
  
  // 1. AWS CLI 확인
  if (!checkAWSCLI()) {
    log('\n❌ AWS CLI가 설치되어 있지 않습니다.', colors.red);
    log('   설치 방법: https://aws.amazon.com/cli/', colors.yellow);
    process.exit(1);
  }
  
  // 2. AWS 자격 증명 확인
  if (!checkAWSCredentials()) {
    log('\n❌ AWS 자격 증명을 설정하세요.', colors.red);
    log('   방법 1: aws configure', colors.yellow);
    log('   방법 2: 환경 변수 설정 (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)', colors.yellow);
    process.exit(1);
  }
  
  const region = process.env.AWS_REGION || 'ap-northeast-1';
  const instanceIdentifier = process.env.IT_RDS_INSTANCE_IDENTIFIER || 'namos-chat-it';
  
  log(`\n📋 설정 정보:`, colors.blue);
  log(`  - 리전: ${region}`, colors.cyan);
  log(`  - RDS 인스턴스: ${instanceIdentifier}`, colors.cyan);
  
  // 3. RDS 인스턴스 정보 가져오기
  log(`\n🔍 RDS 인스턴스 정보 확인 중...`, colors.blue);
  const instanceInfo = getRDSInstanceInfo(instanceIdentifier, region);
  
  if (!instanceInfo) {
    log(`\n❌ RDS 인스턴스를 찾을 수 없습니다.`, colors.red);
    log(`   인스턴스 식별자를 확인하세요: ${instanceIdentifier}`, colors.yellow);
    process.exit(1);
  }
  
  const securityGroupId = instanceInfo.VpcSecurityGroups?.[0]?.VpcSecurityGroupId;
  
  if (!securityGroupId) {
    log(`\n❌ 보안 그룹을 찾을 수 없습니다.`, colors.red);
    process.exit(1);
  }
  
  log(`  ✅ RDS 인스턴스 확인: ${instanceInfo.DBInstanceStatus}`, colors.green);
  log(`  ✅ 보안 그룹 ID: ${securityGroupId}`, colors.green);
  
  // 4. 보안 그룹 설정
  log(`\n🔒 보안 그룹 설정 중...`, colors.blue);
  
  const sourceSecurityGroupId = process.env.SOURCE_SECURITY_GROUP_ID;
  
  if (sourceSecurityGroupId) {
    log(`  프로덕션/스테이징 환경 보안 그룹에서 접근 허용 중...`, colors.cyan);
    addSecurityGroupRule(
      securityGroupId,
      sourceSecurityGroupId,
      region,
      '프로덕션/스테이징 환경에서 IT 환경 접근'
    );
  } else {
    log(`  ⚠️  SOURCE_SECURITY_GROUP_ID가 설정되지 않았습니다.`, colors.yellow);
    log(`  현재 IP에서 접근 허용 중...`, colors.cyan);
    addCurrentIPAccess(securityGroupId, region);
  }
  
  // 5. IAM 권한 설정 (선택사항)
  const iamRoleName = process.env.IAM_ROLE_NAME;
  
  if (iamRoleName) {
    log(`\n👤 IAM 권한 설정 중...`, colors.blue);
    
    const accountId = execSync('aws sts get-caller-identity --query Account --output text', { encoding: 'utf-8' }).trim();
    const policyName = `IT-RDS-Control-Policy-${instanceIdentifier}`;
    const policyArn = `arn:aws:iam::${accountId}:policy/${policyName}`;
    
    createIAMPolicy(policyName, region);
    attachPolicyToRole(iamRoleName, policyArn);
  } else {
    log(`\n⚠️  IAM_ROLE_NAME이 설정되지 않았습니다.`, colors.yellow);
    log(`  IAM 권한 설정을 건너뜁니다.`, colors.yellow);
    log(`  수동으로 설정하려면 아래 정책을 사용하세요:`, colors.cyan);
    log(`\n  정책 이름: IT-RDS-Control-Policy`, colors.cyan);
    log(`  권한:`, colors.cyan);
    log(`    - rds:DescribeDBInstances`, colors.cyan);
    log(`    - rds:StartDBInstance`, colors.cyan);
    log(`    - rds:StopDBInstance`, colors.cyan);
  }
  
  log(`\n✅ 보안 그룹 및 IAM 권한 설정 완료!`, colors.green);
  log(`\n다음 단계:`, colors.cyan);
  log(`1. IT 환경 애플리케이션에서 연결 테스트`, colors.cyan);
  log(`2. 관리 패널에서 IT 환경 제어 기능 테스트`, colors.cyan);
}

main().catch((error) => {
  log(`\n❌ 오류 발생: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});

