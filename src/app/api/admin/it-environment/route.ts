import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/nextauth';
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';

// AWS RDS 클라이언트 동적 import
// 動的インポートのため型を遅延評価
type RDSClientType = typeof import('@aws-sdk/client-rds').RDSClient;
type StartDBInstanceCommandType = typeof import('@aws-sdk/client-rds').StartDBInstanceCommand;
type StopDBInstanceCommandType = typeof import('@aws-sdk/client-rds').StopDBInstanceCommand;
type DescribeDBInstancesCommandType = typeof import('@aws-sdk/client-rds').DescribeDBInstancesCommand;

let RDSClient: RDSClientType | null = null;
let StartDBInstanceCommand: StartDBInstanceCommandType | null = null;
let StopDBInstanceCommand: StopDBInstanceCommandType | null = null;
let DescribeDBInstancesCommand: DescribeDBInstancesCommandType | null = null;

async function getRDSClient() {
  try {
    if (!RDSClient || !StartDBInstanceCommand || !StopDBInstanceCommand || !DescribeDBInstancesCommand) {
      console.log('[IT-Environment] Loading AWS RDS SDK...');
      const { RDSClient: RDS } = await import('@aws-sdk/client-rds');
      const { StartDBInstanceCommand: Start } = await import('@aws-sdk/client-rds');
      const { StopDBInstanceCommand: Stop } = await import('@aws-sdk/client-rds');
      const { DescribeDBInstancesCommand: Describe } = await import('@aws-sdk/client-rds');
      
      RDSClient = RDS;
      StartDBInstanceCommand = Start;
      StopDBInstanceCommand = Stop;
      DescribeDBInstancesCommand = Describe;
      console.log('[IT-Environment] AWS RDS SDK loaded successfully');
    }
    
    // この時点でnullでないことを保証
    if (!RDSClient || !StartDBInstanceCommand || !StopDBInstanceCommand || !DescribeDBInstancesCommand) {
      throw new Error('AWS RDS SDKの初期化に失敗しました。');
    }
    
    const region = process.env.AWS_REGION || 'ap-northeast-1';
    console.log('[IT-Environment] Creating RDS client with region:', region);
    
    // Lambda環境ではIAMロールの認証情報を自動的に使用
    // In Lambda environment, IAM role credentials are used automatically
    const client = new RDSClient({ 
      region,
      // 認証情報はLambdaのIAMロールから自動取得される
      // Credentials are automatically obtained from Lambda's IAM role
    });
    
    console.log('[IT-Environment] RDS client created successfully');
    
    return {
      client,
      StartDBInstanceCommand,
      StopDBInstanceCommand,
      DescribeDBInstancesCommand,
    };
  } catch (error) {
    console.error('[IT-Environment] getRDSClient error:', error);
    throw error;
  }
}

// IT 환경 RDS 인스턴스 식별자 (환경 변수에서 가져오거나 기본값 사용)
const IT_DB_INSTANCE_IDENTIFIER = process.env.IT_RDS_INSTANCE_IDENTIFIER || 'namos-chat-it';

/**
 * GET: IT 환경 RDS 인스턴스 상태 확인
 */
export async function GET() {
  if (isBuildTime()) return buildTimeResponse();

  try {
    console.log('[IT-Environment] GET request received');
    console.log('[IT-Environment] IT_DB_INSTANCE_IDENTIFIER:', IT_DB_INSTANCE_IDENTIFIER);
    console.log('[IT-Environment] AWS_REGION:', process.env.AWS_REGION || 'ap-northeast-1');
    
    const session = await getServerSession(authOptions);
    
    // SUPER_ADMIN 권限のみ許可
    if (!session || session.user?.role !== 'SUPER_ADMIN') {
      console.log('[IT-Environment] Unauthorized access attempt');
      return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
    }

    console.log('[IT-Environment] Initializing RDS client...');
    const { client, DescribeDBInstancesCommand } = await getRDSClient();
    console.log('[IT-Environment] RDS client initialized successfully');
    
    const command = new DescribeDBInstancesCommand({
      DBInstanceIdentifier: IT_DB_INSTANCE_IDENTIFIER,
    });

    console.log('[IT-Environment] Sending DescribeDBInstancesCommand...');
    const response = await client.send(command);
    console.log('[IT-Environment] Response received:', { 
      instanceCount: response.DBInstances?.length || 0 
    });
    
    if (!response.DBInstances || response.DBInstances.length === 0) {
      return NextResponse.json({ 
        status: 'not-found',
        message: 'IT環境データベースインスタンスが見つかりません。',
      });
    }

    const instance = response.DBInstances[0];
    const status = instance.DBInstanceStatus;
    
    // 상태 매핑
    let displayStatus = status;
    let canStart = false;
    let canStop = false;
    
    if (status === 'stopped') {
      displayStatus = '停止中';
      canStart = true;
    } else if (status === 'available') {
      displayStatus = '実行中';
      canStop = true;
    } else if (status === 'starting') {
      displayStatus = '起動中...';
    } else if (status === 'stopping') {
      displayStatus = '停止中...';
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
  } catch (error: unknown) {
    console.error('[IT-Environment] GET error:', error);
    console.error('[IT-Environment] Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    // インスタンスが見つからない場合
    if (error instanceof Error && error.name === 'DBInstanceNotFoundFault') {
      console.log('[IT-Environment] DBInstanceNotFoundFault detected');
      return NextResponse.json({ 
        status: 'not-found',
        message: 'IT環境データベースインスタンスが見つかりません。',
      });
    }
    
    // AWS認証エラーの場合
    if (error instanceof Error && (
      error.name === 'CredentialsProviderError' ||
      error.message.includes('credentials') ||
      error.message.includes('UnauthorizedOperation')
    )) {
      console.error('[IT-Environment] AWS credentials error');
      return NextResponse.json({ 
        error: 'AWS認証エラーが発生しました。IAM権限を確認してください。',
        message: error.message,
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      error: '状態確認中にエラーが発生しました。',
      message: error instanceof Error ? error.message : '状態確認中にエラーが発生しました。',
    }, { status: 500 });
  }
}

/**
 * POST: IT 환경 RDS 인스턴스 시작
 */
export async function POST() {
  if (isBuildTime()) return buildTimeResponse();

  try {
    const session = await getServerSession(authOptions);
    
    // SUPER_ADMIN 권한만 허용
    if (!session || session.user?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
    }

    const { client, StartDBInstanceCommand } = await getRDSClient();
    
    const command = new StartDBInstanceCommand({
      DBInstanceIdentifier: IT_DB_INSTANCE_IDENTIFIER,
    });

    await client.send(command);

    return NextResponse.json({
      success: true,
      message: 'IT環境データベースの起動リクエストが完了しました。約5-10分かかります。',
      instanceIdentifier: IT_DB_INSTANCE_IDENTIFIER,
    });
  } catch (error: unknown) {
    console.error('IT 환경 시작 오류:', error);
    
    // 既に実行中の場合
    if (error instanceof Error && error.name === 'InvalidDBInstanceStateFault') {
      return NextResponse.json({ 
        error: '既に実行中または起動中です。',
        message: '既に実行中または起動中です。',
      }, { status: 400 });
    }
    
    return NextResponse.json({ 
      error: '起動リクエスト中にエラーが発生しました。',
      message: error instanceof Error ? error.message : '起動リクエスト中にエラーが発生しました。',
    }, { status: 500 });
  }
}

/**
 * DELETE: IT 환경 RDS 인스턴스 중지
 */
export async function DELETE() {
  if (isBuildTime()) return buildTimeResponse();

  try {
    const session = await getServerSession(authOptions);
    
    // SUPER_ADMIN 권한만 허용
    if (!session || session.user?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
    }

    const { client, StopDBInstanceCommand } = await getRDSClient();
    
    const command = new StopDBInstanceCommand({
      DBInstanceIdentifier: IT_DB_INSTANCE_IDENTIFIER,
    });

    await client.send(command);

    return NextResponse.json({
      success: true,
      message: 'IT環境データベースの停止リクエストが完了しました。',
      instanceIdentifier: IT_DB_INSTANCE_IDENTIFIER,
    });
  } catch (error: unknown) {
    console.error('IT 환경 중지 오류:', error);
    
    // 既に停止されている場合
    if (error instanceof Error && error.name === 'InvalidDBInstanceStateFault') {
      return NextResponse.json({ 
        error: '既に停止されているか、停止中です。',
        message: '既に停止されているか、停止中です。',
      }, { status: 400 });
    }
    
    return NextResponse.json({ 
      error: '停止リクエスト中にエラーが発生しました。',
      message: error instanceof Error ? error.message : '停止リクエスト中にエラーが発生しました。',
    }, { status: 500 });
  }
}


