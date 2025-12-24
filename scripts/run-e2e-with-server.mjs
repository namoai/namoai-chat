#!/usr/bin/env node

/**
 * E2E 테스트를 서버 자동 관리와 함께 실행하는 스크립트
 * 서버 과부하 시 자동으로 재시작하여 테스트가 안정적으로 완료되도록 합니다.
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import http from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, rmSync } from 'fs';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const SERVER_START_TIMEOUT = 180000; // 3분
const SERVER_CHECK_INTERVAL = 2000; // 2초
const TEST_DELAY_BETWEEN_FILES = 5000; // 테스트 파일 간 5초 대기

let serverProcess = null;
let serverStartTime = null;
let serverNeedsRestart = false;

// 테스트 파일 목록
const testFiles = [
  'e2e/admin-banners.spec.ts',
  'e2e/admin-character-management.spec.ts',
  'e2e/admin-guides.spec.ts',
  'e2e/admin-notices.spec.ts',
  'e2e/admin-reports.spec.ts',
  'e2e/admin-ip-management.spec.ts',
];

/**
 * 서버가 실행 중인지 확인 (더 엄격한 체크 - 실제 페이지 내용 확인)
 */
async function checkServerHealth() {
  return new Promise((resolve) => {
    const req = http.get(`${BASE_URL}/`, { timeout: 10000 }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk.toString(); });
      res.on('end', () => {
        // Internal Server Error 체크
        if (body.includes('Internal Server Error') || body.includes('500') || res.statusCode === 500) {
          console.error('  ❌ 서버가 Internal Server Error를 반환했습니다.');
          resolve(false);
          return;
        }
        
        // 실제 HTML 내용이 있는지 확인 (에러 페이지가 아닌지)
        const hasValidContent = body.length > 100 && 
          (body.includes('<html') || body.includes('<!DOCTYPE') || body.includes('<div') || body.includes('ログイン') || body.includes('Login'));
        
        if (hasValidContent && (res.statusCode === 200 || res.statusCode === 302 || res.statusCode === 401)) {
          resolve(true);
        } else {
          console.warn(`  ⚠ 서버 응답이 비정상입니다. Status: ${res.statusCode}, Body length: ${body.length}`);
          resolve(false);
        }
      });
    });
    
    req.on('error', (err) => {
      console.warn(`  ⚠ 서버 연결 실패: ${err.message}`);
      resolve(false);
    });
    req.on('timeout', () => {
      req.destroy();
      console.warn('  ⚠ 서버 응답 타임아웃');
      resolve(false);
    });
  });
}

/**
 * 포트 3000을 사용하는 프로세스 찾기
 */
async function findProcessOnPort3000() {
  try {
    const { stdout } = await execAsync('netstat -ano | findstr :3000 | findstr LISTENING');
    if (stdout.trim()) {
      const lines = stdout.trim().split('\n');
      const pids = new Set();
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length > 0) {
          const pid = parts[parts.length - 1];
          if (pid && !isNaN(pid)) {
            pids.add(pid);
          }
        }
      }
      return Array.from(pids);
    }
  } catch (error) {
    // 프로세스가 없으면 빈 배열 반환
  }
  return [];
}

/**
 * 포트 3000의 프로세스 종료
 */
async function killProcessOnPort3000() {
  const pids = await findProcessOnPort3000();
  if (pids.length === 0) {
    console.log('  ✓ 포트 3000에 실행 중인 프로세스가 없습니다.');
    return;
  }

  console.log(`  🔄 포트 3000의 프로세스 종료 중... (PID: ${pids.join(', ')})`);
  for (const pid of pids) {
    try {
      await execAsync(`taskkill /F /PID ${pid}`);
      console.log(`  ✓ 프로세스 ${pid} 종료 완료`);
    } catch (error) {
      console.warn(`  ⚠ 프로세스 ${pid} 종료 실패: ${error.message}`);
    }
  }
  
  // 프로세스가 완전히 종료될 때까지 대기
  await new Promise(resolve => setTimeout(resolve, 3000));
}

/**
 * 서버 시작
 */
async function startServer() {
  console.log('\n🚀 서버 시작 중...');
  
  // 기존 프로세스 종료
  if (serverProcess) {
    console.log('  🔄 기존 서버 프로세스 종료 중...');
    serverProcess.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // 포트 3000의 모든 프로세스 종료
  await killProcessOnPort3000();
  
  // 새 서버 시작
  console.log('  📦 Next.js 개발 서버 시작 중...');
  serverNeedsRestart = false; // 재시작 플래그 리셋
  
  // 포트 3001도 확인하여 종료 (Next.js가 자동으로 다른 포트 사용할 수 있음)
  try {
    const { stdout } = await execAsync('netstat -ano | findstr :3001 | findstr LISTENING');
    if (stdout.trim()) {
      console.log('  🔄 포트 3001의 프로세스도 종료 중...');
      const lines = stdout.trim().split('\n');
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && !isNaN(pid)) {
          await execAsync(`taskkill /F /PID ${pid}`).catch(() => {});
        }
      }
    }
  } catch {}
  
  // NOTE:
  // - 기존에는 APP_ENV 가 없으면 강제로 "local" 로 설정했는데,
  //   이 값에 따라 프로덕션 빌드용 아티팩트(`.next/routes-manifest.json` 등)를
  //   dev 서버에서 읽으려 해서 ENOENT + Internal Server Error 가 발생하는 문제가 있었다.
  // - 로컬에서 이미 잘 돌고 있는 `npm run dev` 환경을 그대로 쓰는 게 목표이므로,
  //   여기서는 APP_ENV 를 건드리지 않고, 사용자가 설정한 값만 그대로 사용한다.
  const serverEnv = { ...process.env, FORCE_COLOR: '1' };
  
  serverProcess = spawn('npm', ['run', 'dev'], {
    cwd: projectRoot,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: serverEnv,
  });

  let serverOutput = '';
  let errorOutput = '';

  serverProcess.stdout.on('data', (data) => {
    const output = data.toString();
    serverOutput += output;
    // 서버가 준비되었는지 확인
    if (output.includes('Ready') || output.includes('Local:') || output.includes('started server') || output.includes('compiled')) {
      console.log('  ✓ 서버 시작 신호 감지');
    }
    // 컴파일 완료 확인
    if (output.includes('compiled successfully') || output.includes('Compiled /')) {
      console.log('  ✓ 서버 컴파일 완료');
    }
  });

  serverProcess.stderr.on('data', (data) => {
    const output = data.toString();
    errorOutput += output;
    
    // 치명적 에러 감지
    const criticalErrors = [
      'UNKNOWN: unknown error',
      'EADDRINUSE',
      'ENOENT',
      'ECONNREFUSED',
      'Internal Server Error',
      'ERR_ABORTED',
      'Cannot find module',
      'ENOTFOUND',
    ];
    
    const hasCriticalError = criticalErrors.some(err => output.includes(err));
    
    if (hasCriticalError) {
      console.error(`  ❌ 치명적 서버 에러 감지: ${output.substring(0, 300)}`);
      // 치명적 에러가 발생하면 서버 재시작 플래그 설정
      serverNeedsRestart = true;
    } else if (!output.includes('Warning') && !output.includes('warn') && !output.includes('CSRF')) {
      console.warn(`  ⚠ 서버 에러: ${output.substring(0, 200)}`);
    }
  });

  serverProcess.on('error', (error) => {
    console.error(`  ❌ 서버 시작 실패: ${error.message}`);
  });

  serverStartTime = Date.now();

  // 서버가 준비될 때까지 대기
  console.log('  ⏳ 서버 준비 대기 중... (최소 1분 대기)');
  const maxWaitTime = SERVER_START_TIMEOUT;
  const startTime = Date.now();
  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 15; // 더 많은 에러 허용 (빌드 중일 수 있음)
  const MIN_WAIT_TIME = 60000; // 최소 1분 대기
  const STABLE_CHECK_COUNT = 3; // 연속으로 3번 성공해야 준비 완료로 간주
  let successfulChecks = 0;

  while (Date.now() - startTime < maxWaitTime) {
    // 치명적 에러가 감지되면 즉시 중단하고 .next 폴더 삭제 후 재시작
    if (serverNeedsRestart) {
      console.error('  ❌ 치명적 서버 에러가 감지되었습니다. .next 폴더를 삭제하고 즉시 재시작합니다...');
      if (serverProcess) {
        serverProcess.kill('SIGKILL');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      await killProcessOnPort3000();
      // 포트 3001도 확인 (Next.js가 자동으로 다른 포트 사용할 수 있음)
      try {
        const { stdout } = await execAsync('netstat -ano | findstr :3001 | findstr LISTENING');
        if (stdout.trim()) {
          const lines = stdout.trim().split('\n');
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && !isNaN(pid)) {
              await execAsync(`taskkill /F /PID ${pid}`).catch(() => {});
            }
          }
        }
      } catch {}
      
      // .next 폴더 삭제
      const nextDir = join(projectRoot, '.next');
      if (existsSync(nextDir)) {
        try {
          console.log('  🗑️  .next 폴더 삭제 중...');
          rmSync(nextDir, { recursive: true, force: true });
          console.log('  ✓ .next 폴더 삭제 완료');
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          console.warn(`  ⚠ .next 폴더 삭제 실패: ${error.message}`);
        }
      }
      
      return false;
    }
    
    // 서버가 시작된 지 최소 1분은 기다림 (빌드 및 초기화 시간)
    const timeSinceStart = Date.now() - serverStartTime;
    if (timeSinceStart < MIN_WAIT_TIME) {
      // 아직 빌드 중일 수 있으므로 에러 카운트를 리셋
      consecutiveErrors = 0;
      const remainingTime = Math.ceil((MIN_WAIT_TIME - timeSinceStart) / 1000);
      if (remainingTime % 10 === 0 || remainingTime < 10) {
        console.log(`  ⏳ 서버 빌드 대기 중... (${remainingTime}초 남음)`);
      }
      
      // 빌드 중에도 치명적 에러는 체크
      if (serverNeedsRestart) {
        console.error('  ❌ 빌드 중 치명적 에러 감지. .next 폴더를 삭제하고 즉시 재시작합니다...');
        if (serverProcess) {
          serverProcess.kill('SIGKILL');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        await killProcessOnPort3000();
        
        // .next 폴더 삭제
        const nextDir = join(projectRoot, '.next');
        if (existsSync(nextDir)) {
          try {
            console.log('  🗑️  .next 폴더 삭제 중...');
            rmSync(nextDir, { recursive: true, force: true });
            console.log('  ✓ .next 폴더 삭제 완료');
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (error) {
            console.warn(`  ⚠ .next 폴더 삭제 실패: ${error.message}`);
          }
        }
        
        return false;
      }
      await new Promise(resolve => setTimeout(resolve, SERVER_CHECK_INTERVAL));
      continue;
    }
    
    // 최소 대기 시간이 지났으므로 서버 상태 확인
    // 치명적 에러가 없을 때만 체크
    if (!serverNeedsRestart) {
      const isHealthy = await checkServerHealth();
      if (isHealthy) {
        successfulChecks++;
        const elapsed = ((Date.now() - serverStartTime) / 1000).toFixed(1);
        console.log(`  ✓ 서버 건강 체크 성공 (${successfulChecks}/${STABLE_CHECK_COUNT}) - ${elapsed}초 경과`);
        
        // 연속으로 여러 번 성공해야 안정적으로 준비된 것으로 간주
        if (successfulChecks >= STABLE_CHECK_COUNT) {
          console.log(`  ✅ 서버가 완전히 준비되었습니다! (${elapsed}초 소요, ${STABLE_CHECK_COUNT}회 연속 성공)`);
          return true;
        }
        
        // 성공했지만 아직 안정화 대기 중
        consecutiveErrors = 0; // 성공하면 에러 카운트 리셋
        await new Promise(resolve => setTimeout(resolve, SERVER_CHECK_INTERVAL));
        continue;
      } else {
        // 실패하면 성공 카운트 리셋
        successfulChecks = 0;
        consecutiveErrors++;
        
        // 에러가 많아지면 경고
        if (consecutiveErrors >= 5 && consecutiveErrors % 5 === 0) {
          const elapsed = ((Date.now() - serverStartTime) / 1000).toFixed(1);
          console.warn(`  ⚠ 서버가 아직 준비되지 않았습니다. (${elapsed}초 경과, ${consecutiveErrors}회 연속 실패)`);
        }
      }
    }
    
    // 치명적 에러가 있거나 너무 많은 에러가 발생하면 재시작
    if (serverNeedsRestart || consecutiveErrors >= maxConsecutiveErrors) {
      if (serverNeedsRestart) {
        console.error('  ❌ 치명적 서버 에러가 감지되었습니다.');
      } else {
        console.error(`  ❌ 서버가 ${maxConsecutiveErrors}회 연속으로 에러를 반환했습니다.`);
      }
      console.log('  🔄 .next 폴더 문제일 수 있습니다. 서버를 강제 종료하고 재시작합니다...');
      // 서버 프로세스 강제 종료
      if (serverProcess) {
        serverProcess.kill('SIGKILL');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      await killProcessOnPort3000();
      return false;
    }
    
    await new Promise(resolve => setTimeout(resolve, SERVER_CHECK_INTERVAL));
  }

  console.error('  ❌ 서버 시작 타임아웃');
  return false;
}

/**
 * 서버 재시작
 */
async function restartServer() {
  console.log('\n🔄 서버 재시작 중...');
  await startServer();
}

/**
 * 테스트 파일 실행
 */
async function runTestFile(testFile) {
  console.log(`\n📋 테스트 실행: ${testFile}`);
  
  return new Promise((resolve) => {
    const testProcess = spawn('npx', ['playwright', 'test', testFile, '--project=chromium', '--workers=1'], {
      cwd: projectRoot,
      shell: true,
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: '1' },
    });

    testProcess.on('close', (code) => {
      resolve(code === 0);
    });

    testProcess.on('error', (error) => {
      console.error(`  ❌ 테스트 실행 실패: ${error.message}`);
      resolve(false);
    });
  });
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log('🧪 E2E 테스트 자동 실행 스크립트');
  console.log('=====================================\n');

  // 서버 시작 (최대 3회 재시도)
  let serverStarted = false;
  let startAttempts = 0;
  const maxStartAttempts = 3;
  
  while (!serverStarted && startAttempts < maxStartAttempts) {
    startAttempts++;
    if (startAttempts > 1) {
      console.log(`\n🔄 서버 시작 재시도 ${startAttempts}/${maxStartAttempts}...`);
      // .next 폴더 문제일 수 있으므로 잠시 대기
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    serverStarted = await startServer();
    
    if (!serverStarted && startAttempts < maxStartAttempts) {
      console.log('  ⚠ 서버 시작 실패. 재시도합니다...');
    }
  }
  
  if (!serverStarted) {
    console.log('\n🔄 .next 폴더를 삭제하고 서버를 재시작합니다...');
    const nextDir = join(projectRoot, '.next');
    if (existsSync(nextDir)) {
      try {
        console.log('  🗑️  .next 폴더 삭제 중...');
        rmSync(nextDir, { recursive: true, force: true });
        console.log('  ✓ .next 폴더 삭제 완료');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 다시 서버 시작 시도
        console.log('  🔄 서버 재시작 중...');
        serverStarted = await startServer();
      } catch (error) {
        console.error(`  ❌ .next 폴더 삭제 실패: ${error.message}`);
      }
    }
    
    if (!serverStarted) {
      console.error('\n❌ 서버를 시작할 수 없습니다. 수동으로 .next 폴더를 삭제하고 다시 시도해보세요.');
      console.error('   명령어: rmdir /s /q .next');
      process.exit(1);
    }
  }

  const results = {
    passed: [],
    failed: [],
    total: testFiles.length,
  };

  // 각 테스트 파일 실행
  for (let i = 0; i < testFiles.length; i++) {
    const testFile = testFiles[i];
    
    // 테스트 파일 간 대기
    if (i > 0) {
      console.log(`\n⏸️  ${TEST_DELAY_BETWEEN_FILES / 1000}초 대기 중... (서버 부하 완화)`);
      await new Promise(resolve => setTimeout(resolve, TEST_DELAY_BETWEEN_FILES));
    }

    // 서버 상태 확인 (치명적 에러 체크 포함)
    if (serverNeedsRestart) {
      console.log('  ⚠ 치명적 서버 에러가 감지되었습니다. 즉시 재시작 중...');
      await restartServer();
      serverNeedsRestart = false;
    }
    
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      console.log('  ⚠ 서버가 응답하지 않거나 에러를 반환합니다. 재시작 중...');
      await restartServer();
    }
    
    // 재시작 후 안정화 대기
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 테스트 실행 (최대 3회 재시도)
    let success = false;
    let attempts = 0;
    const maxAttempts = 3;

    while (!success && attempts < maxAttempts) {
      attempts++;
      
      if (attempts > 1) {
        console.log(`  🔄 재시도 ${attempts}/${maxAttempts}...`);
        // 재시도 전 서버 재시작
        await restartServer();
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      success = await runTestFile(testFile);

      if (!success && attempts < maxAttempts) {
        console.log(`  ⚠ 테스트 실패. 서버 재시작 후 재시도합니다...`);
      }
    }

    if (success) {
      results.passed.push(testFile);
      console.log(`  ✅ ${testFile} 통과!`);
    } else {
      results.failed.push(testFile);
      console.log(`  ❌ ${testFile} 실패 (${attempts}회 시도)`);
    }
  }

  // 결과 요약
  console.log('\n=====================================');
  console.log('📊 테스트 결과 요약');
  console.log('=====================================');
  console.log(`✅ 성공: ${results.passed.length}/${results.total}`);
  console.log(`❌ 실패: ${results.failed.length}/${results.total}`);
  
  if (results.passed.length > 0) {
    console.log('\n✅ 성공한 테스트:');
    results.passed.forEach(file => console.log(`  - ${file}`));
  }
  
  if (results.failed.length > 0) {
    console.log('\n❌ 실패한 테스트:');
    results.failed.forEach(file => console.log(`  - ${file}`));
  }

  // 서버 종료
  if (serverProcess) {
    console.log('\n🛑 서버 종료 중...');
    serverProcess.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // 종료 코드
  process.exit(results.failed.length > 0 ? 1 : 0);
}

// 신호 처리
process.on('SIGINT', async () => {
  console.log('\n\n⚠️  중단 신호 수신. 정리 중...');
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }
  await killProcessOnPort3000();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }
  await killProcessOnPort3000();
  process.exit(0);
});

// 실행
main().catch((error) => {
  console.error('\n❌ 치명적 오류:', error);
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }
  process.exit(1);
});

