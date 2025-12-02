import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/nextauth';
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';

// AWS RDS 클라이언트 동적 import
let RDSClient: any;
let StartDBInstanceCommand: any;
let StopDBInstanceCommand: any;
let DescribeDBInstancesCommand: any;

async function getRDSClient() {
  if (!RDSClient) {
    const { RDSClient: RDS } = await import('@aws-sdk/client-rds');
    const { StartDBInstanceCommand: Start } = await import('@aws-sdk/client-rds');
    const { StopDBInstanceCommand: Stop } = await import('@aws-sdk/client-rds');
    const { DescribeDBInstancesCommand: Describe } = await import('@aws-sdk/client-rds');
    
    RDSClient = RDS;
    StartDBInstanceCommand = Start;
    StopDBInstanceCommand = Stop;
    DescribeDBInstancesCommand = Describe;
  }
  
  return {
    client: new RDSClient({ 
      region: process.env.AWS_REGION || 'ap-northeast-1' 
    }),
    StartDBInstanceCommand,
    StopDBInstanceCommand,
    DescribeDBInstancesCommand,
  };
}

// IT 환경 RDS 인스턴스 식별자 (환경 변수에서 가져오거나 기본값 사용)
const IT_DB_INSTANCE_IDENTIFIER = process.env.IT_RDS_INSTANCE_IDENTIFIER || 'namos-chat-it';

/**
 * GET: IT 환경 RDS 인스턴스 상태 확인
 */
export async function GET(request: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();

  try {
    const session = await getServerSession(authOptions);
    
    // SUPER_ADMIN 권한만 허용
    if (!session || session.user?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const { client, DescribeDBInstancesCommand } = await getRDSClient();
    
    const command = new DescribeDBInstancesCommand({
      DBInstanceIdentifier: IT_DB_INSTANCE_IDENTIFIER,
    });

    const response = await client.send(command);
    
    if (!response.DBInstances || response.DBInstances.length === 0) {
      return NextResponse.json({ 
        status: 'not-found',
        message: 'IT 환경 데이터베이스 인스턴스를 찾을 수 없습니다.',
      });
    }

    const instance = response.DBInstances[0];
    const status = instance.DBInstanceStatus;
    
    // 상태 매핑
    let displayStatus = status;
    let canStart = false;
    let canStop = false;
    
    if (status === 'stopped') {
      displayStatus = '중지됨';
      canStart = true;
    } else if (status === 'available') {
      displayStatus = '실행 중';
      canStop = true;
    } else if (status === 'starting') {
      displayStatus = '시작 중...';
    } else if (status === 'stopping') {
      displayStatus = '중지 중...';
    }

    return NextResponse.json({
      status: status,
      displayStatus,
      canStart,
      canStop,
      instanceIdentifier: instance.DBInstanceIdentifier,
      engine: instance.Engine,
      engineVersion: instance.EngineVersion,
      instanceClass: instance.DBInstanceClass,
      endpoint: instance.Endpoint ? {
        address: instance.Endpoint.Address,
        port: instance.Endpoint.Port,
      } : null,
    });
  } catch (error: any) {
    console.error('IT 환경 상태 확인 오류:', error);
    
    // 인스턴스를 찾을 수 없는 경우
    if (error.name === 'DBInstanceNotFoundFault') {
      return NextResponse.json({ 
        status: 'not-found',
        message: 'IT 환경 데이터베이스 인스턴스를 찾을 수 없습니다.',
      });
    }
    
    return NextResponse.json({ 
      error: '상태 확인 중 오류가 발생했습니다.',
      details: error.message,
    }, { status: 500 });
  }
}

/**
 * POST: IT 환경 RDS 인스턴스 시작
 */
export async function POST(request: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();

  try {
    const session = await getServerSession(authOptions);
    
    // SUPER_ADMIN 권한만 허용
    if (!session || session.user?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const { client, StartDBInstanceCommand } = await getRDSClient();
    
    const command = new StartDBInstanceCommand({
      DBInstanceIdentifier: IT_DB_INSTANCE_IDENTIFIER,
    });

    await client.send(command);

    return NextResponse.json({
      success: true,
      message: 'IT 환경 데이터베이스 시작 요청이 완료되었습니다. 약 5-10분 소요됩니다.',
      instanceIdentifier: IT_DB_INSTANCE_IDENTIFIER,
    });
  } catch (error: any) {
    console.error('IT 환경 시작 오류:', error);
    
    // 이미 실행 중인 경우
    if (error.name === 'InvalidDBInstanceStateFault') {
      return NextResponse.json({ 
        error: '이미 실행 중이거나 시작 중입니다.',
      }, { status: 400 });
    }
    
    return NextResponse.json({ 
      error: '시작 요청 중 오류가 발생했습니다.',
      details: error.message,
    }, { status: 500 });
  }
}

/**
 * DELETE: IT 환경 RDS 인스턴스 중지
 */
export async function DELETE(request: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();

  try {
    const session = await getServerSession(authOptions);
    
    // SUPER_ADMIN 권한만 허용
    if (!session || session.user?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const { client, StopDBInstanceCommand } = await getRDSClient();
    
    const command = new StopDBInstanceCommand({
      DBInstanceIdentifier: IT_DB_INSTANCE_IDENTIFIER,
    });

    await client.send(command);

    return NextResponse.json({
      success: true,
      message: 'IT 환경 데이터베이스 중지 요청이 완료되었습니다.',
      instanceIdentifier: IT_DB_INSTANCE_IDENTIFIER,
    });
  } catch (error: any) {
    console.error('IT 환경 중지 오류:', error);
    
    // 이미 중지된 경우
    if (error.name === 'InvalidDBInstanceStateFault') {
      return NextResponse.json({ 
        error: '이미 중지되었거나 중지 중입니다.',
      }, { status: 400 });
    }
    
    return NextResponse.json({ 
      error: '중지 요청 중 오류가 발생했습니다.',
      details: error.message,
    }, { status: 500 });
  }
}

