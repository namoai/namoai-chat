#!/usr/bin/env node

/**
 * IT 환경 보안 그룹 및 IAM 권한 설정 스크립트 (AWS SDK 사용, AWS CLI 불필요)
 * 
 * 사용법:
 *   node scripts/setup-it-security-sdk.mjs
 * 
 * 환경 변수 (.env.local 또는 환경 변수):
 *   AWS_REGION - AWS 리전 (기본값: ap-northeast-1)
 *   AWS_ACCESS_KEY_ID - AWS 액세스 키 (필수)
 *   AWS_SECRET_ACCESS_KEY - AWS 시크릿 키 (필수)
 *   IT_RDS_INSTANCE_IDENTIFIER - IT 환경 RDS 인스턴스 식별자 (기본값: namos-chat-it)
 *   SOURCE_SECURITY_GROUP_ID - 프로덕션/스테이징 환경 보안 그룹 ID (선택사항)
 *   IAM_ROLE_NAME - IAM 역할 이름 (선택사항)
 */

import { RDSClient, DescribeDBInstancesCommand } from '@aws-sdk/client-rds';
import { EC2Client, AuthorizeSecurityGroupIngressCommand, DescribeSecurityGroupsCommand } from '@aws-sdk/client-ec2';
import { IAMClient, CreatePolicyCommand, AttachRolePolicyCommand, GetRoleCommand } from '@aws-sdk/client-iam';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
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

// AWS 클라이언트 생성
function createClients(region) {
  const config = { region };
  
  // 환경 변수에서 자격 증명 가져오기
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    config.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    };
  }
  
  return {
    rds: new RDSClient(config),
    ec2: new EC2Client(config),
    iam: new IAMClient(config),
    sts: new STSClient(config),
  };
}

// AWS 자격 증명 확인
async function checkAWSCredentials(stsClient) {
  try {
    const command = new GetCallerIdentityCommand({});
    const response = await stsClient.send(command);
    log(`✅ AWS 자격 증명 확인: ${response.Arn}`, colors.green);
    return response.Account;
  } catch (error) {
    log(`❌ AWS 자격 증명 확인 실패: ${error.message}`, colors.red);
    log(`   환경 변수를 확인하세요:`, colors.yellow);
    log(`   - AWS_ACCESS_KEY_ID`, colors.yellow);
    log(`   - AWS_SECRET_ACCESS_KEY`, colors.yellow);
    log(`   - AWS_REGION`, colors.yellow);
    return null;
  }
}

// RDS 인스턴스 정보 가져오기
async function getRDSInstanceInfo(rdsClient, instanceIdentifier) {
  try {
    const command = new DescribeDBInstancesCommand({
      DBInstanceIdentifier: instanceIdentifier,
    });
    const response = await rdsClient.send(command);
    
    if (response.DBInstances && response.DBInstances.length > 0) {
      return response.DBInstances[0];
    }
    return null;
  } catch (error) {
    log(`⚠️  RDS 인스턴스 정보 가져오기 실패: ${error.message}`, colors.yellow);
    return null;
  }
}

// 현재 IP 주소 가져오기
async function getCurrentIP() {
  try {
    const https = await import('https');
    return new Promise((resolve, reject) => {
      https.get('https://api.ipify.org', (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve(data.trim()));
      }).on('error', reject);
    });
  } catch (error) {
    return null;
  }
}

// 보안 그룹 규칙 추가
async function addSecurityGroupRule(ec2Client, securityGroupId, sourceSecurityGroupId, region, description) {
  try {
    log(`  보안 그룹 규칙 추가 중...`, colors.cyan);
    
    const command = new AuthorizeSecurityGroupIngressCommand({
      GroupId: securityGroupId,
      IpPermissions: [{
        IpProtocol: 'tcp',
        FromPort: 5432,
        ToPort: 5432,
        UserIdGroupPairs: [{
          GroupId: sourceSecurityGroupId,
        }],
      }],
      Description: description.replace(/[^a-zA-Z0-9. _:\/()#,@+=&;{}!$*\[\]-]/g, ' ').substring(0, 255),
    });
    
    await ec2Client.send(command);
    log(`  ✅ 보안 그룹 규칙 추가 완료`, colors.green);
    return true;
  } catch (error) {
    if (error.name === 'InvalidPermission.Duplicate' || error.message.includes('already exists')) {
      log(`  ℹ️  보안 그룹 규칙이 이미 존재합니다.`, colors.yellow);
      return true;
    }
    log(`  ❌ 보안 그룹 규칙 추가 실패: ${error.message}`, colors.red);
    return false;
  }
}

// 현재 IP에서 접근 허용
async function addCurrentIPAccess(ec2Client, securityGroupId, region) {
  try {
    log(`  현재 IP 주소 확인 중...`, colors.cyan);
    
    const currentIP = await getCurrentIP();
    if (!currentIP) {
      log(`  ⚠️  IP 확인 실패, 수동으로 입력하세요.`, colors.yellow);
      return false;
    }
    
    log(`  현재 IP: ${currentIP}`, colors.cyan);
    log(`  현재 IP(${currentIP})에서 접근 허용 중...`, colors.cyan);
    
    const command = new AuthorizeSecurityGroupIngressCommand({
      GroupId: securityGroupId,
      IpPermissions: [{
        IpProtocol: 'tcp',
        FromPort: 5432,
        ToPort: 5432,
        IpRanges: [{
          CidrIp: `${currentIP}/32`,
          Description: 'IT Environment Access - Current IP',
        }],
      }],
    });
    
    await ec2Client.send(command);
    log(`  ✅ 현재 IP 접근 허용 완료`, colors.green);
    return true;
  } catch (error) {
    if (error.name === 'InvalidPermission.Duplicate' || error.message.includes('already exists')) {
      log(`  ℹ️  현재 IP 접근 규칙이 이미 존재합니다.`, colors.yellow);
      return true;
    }
    log(`  ❌ 현재 IP 접근 허용 실패: ${error.message}`, colors.red);
    return false;
  }
}

// IAM 정책 생성
async function createIAMPolicy(iamClient, policyName, accountId, region, instanceIdentifier) {
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
        Resource: `arn:aws:rds:${region}:${accountId}:db:${instanceIdentifier}`,
      },
    ],
  };
  
  try {
    log(`  IAM 정책 생성 중...`, colors.cyan);
    
    const command = new CreatePolicyCommand({
      PolicyName: policyName,
      PolicyDocument: JSON.stringify(policyDocument),
      Description: 'IT 환경 RDS 제어 정책',
    });
    
    const response = await iamClient.send(command);
    log(`  ✅ IAM 정책 생성 완료: ${response.Policy.Arn}`, colors.green);
    return response.Policy.Arn;
  } catch (error) {
    if (error.name === 'EntityAlreadyExistsException') {
      log(`  ℹ️  IAM 정책이 이미 존재합니다.`, colors.yellow);
      // 기존 정책 ARN 반환
      return `arn:aws:iam::${accountId}:policy/${policyName}`;
    }
    log(`  ❌ IAM 정책 생성 실패: ${error.message}`, colors.red);
    return null;
  }
}

// IAM 역할에 정책 연결
async function attachPolicyToRole(iamClient, roleName, policyArn) {
  try {
    log(`  IAM 역할 확인 중...`, colors.cyan);
    
    // 역할 존재 확인
    const getRoleCommand = new GetRoleCommand({ RoleName: roleName });
    await iamClient.send(getRoleCommand);
    
    log(`  IAM 역할에 정책 연결 중...`, colors.cyan);
    
    const command = new AttachRolePolicyCommand({
      RoleName: roleName,
      PolicyArn: policyArn,
    });
    
    await iamClient.send(command);
    log(`  ✅ IAM 역할에 정책 연결 완료`, colors.green);
    return true;
  } catch (error) {
    if (error.name === 'NoSuchEntity') {
      log(`  ❌ IAM 역할을 찾을 수 없습니다: ${roleName}`, colors.red);
    } else {
      log(`  ❌ IAM 역할에 정책 연결 실패: ${error.message}`, colors.red);
    }
    return false;
  }
}

// 메인 함수
async function main() {
  log('\n🔐 IT 환경 보안 그룹 및 IAM 권한 설정 시작 (AWS SDK 사용)\n', colors.cyan);
  
  const region = process.env.AWS_REGION || 'ap-northeast-1';
  const instanceIdentifier = process.env.IT_RDS_INSTANCE_IDENTIFIER || 'namos-chat-it';
  
  // AWS 자격 증명 확인
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    log('\n❌ AWS 자격 증명이 설정되지 않았습니다.', colors.red);
    log('   .env.local 파일 또는 환경 변수에 다음을 추가하세요:', colors.yellow);
    log('   AWS_ACCESS_KEY_ID=your-access-key', colors.yellow);
    log('   AWS_SECRET_ACCESS_KEY=your-secret-key', colors.yellow);
    log('   AWS_REGION=ap-northeast-1', colors.yellow);
    process.exit(1);
  }
  
  log(`\n📋 설정 정보:`, colors.blue);
  log(`  - 리전: ${region}`, colors.cyan);
  log(`  - RDS 인스턴스: ${instanceIdentifier}`, colors.cyan);
  
  // AWS 클라이언트 생성
  const clients = createClients(region);
  
  // AWS 자격 증명 확인
  const accountId = await checkAWSCredentials(clients.sts);
  if (!accountId) {
    process.exit(1);
  }
  
  // RDS 인스턴스 정보 가져오기
  log(`\n🔍 RDS 인스턴스 정보 확인 중...`, colors.blue);
  const instanceInfo = await getRDSInstanceInfo(clients.rds, instanceIdentifier);
  
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
  
  // 보안 그룹 설정
  log(`\n🔒 보안 그룹 설정 중...`, colors.blue);
  
  const sourceSecurityGroupId = process.env.SOURCE_SECURITY_GROUP_ID;
  
  if (sourceSecurityGroupId) {
    log(`  프로덕션/스테이징 환경 보안 그룹에서 접근 허용 중...`, colors.cyan);
    await addSecurityGroupRule(
      clients.ec2,
      securityGroupId,
      sourceSecurityGroupId,
      region,
      'Production/Staging Environment Access to IT Environment'
    );
  } else {
    log(`  ⚠️  SOURCE_SECURITY_GROUP_ID가 설정되지 않았습니다.`, colors.yellow);
    log(`  현재 IP에서 접근 허용 중...`, colors.cyan);
    await addCurrentIPAccess(clients.ec2, securityGroupId, region);
  }
  
  // IAM 권한 설정 (선택사항)
  const iamRoleName = process.env.IAM_ROLE_NAME;
  
  if (iamRoleName) {
    log(`\n👤 IAM 권한 설정 중...`, colors.blue);
    
    const policyName = `IT-RDS-Control-Policy-${instanceIdentifier}`;
    const policyArn = await createIAMPolicy(clients.iam, policyName, accountId, region, instanceIdentifier);
    
    if (policyArn) {
      await attachPolicyToRole(clients.iam, iamRoleName, policyArn);
    }
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

