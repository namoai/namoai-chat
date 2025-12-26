const fs = require('fs');
const path = require('path');

/**
 * E2E 파일들을 E2E_PC 디렉토리로 패키지화
 */
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    // 제외할 파일/디렉토리
    if (entry.name === 'node_modules' || 
        entry.name === '.git' || 
        entry.name === 'debug.log' ||
        entry.name.startsWith('.')) {
      continue;
    }
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      // 문서 파일(.md)은 제외하거나 포함할지 선택 가능
      // 여기서는 포함하되, 필요시 제외 가능
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function main() {
  console.log('📦 E2E 파일들을 E2E_PC로 패키지화 시작...\n');
  
  const rootDir = path.join(__dirname, '..');
  const e2eDir = path.join(rootDir, 'e2e(PC Version)');
  const e2ePcDir = path.join(rootDir, 'Package', 'E2E_PC');
  
  if (!fs.existsSync(e2eDir)) {
    console.error('❌ e2e(PC Version) 디렉토리를 찾을 수 없습니다.');
    process.exit(1);
  }
  
  // 기존 E2E_PC 디렉토리가 있으면 백업
  if (fs.existsSync(e2ePcDir)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupDir = path.join(rootDir, 'backups', `E2E_PC_backup_${timestamp}`);
    
    if (!fs.existsSync(path.join(rootDir, 'backups'))) {
      fs.mkdirSync(path.join(rootDir, 'backups'), { recursive: true });
    }
    
    console.log(`📦 기존 E2E_PC 디렉토리를 백업합니다: ${backupDir}`);
    copyDir(e2ePcDir, backupDir);
    
    // 기존 디렉토리 삭제
    fs.rmSync(e2ePcDir, { recursive: true, force: true });
  }
  
  // E2E_PC 디렉토리 생성 및 복사
  console.log(`📁 E2E_PC 디렉토리 생성: ${e2ePcDir}`);
  copyDir(e2eDir, e2ePcDir);
  
  console.log('\n✅ 패키지화 완료!');
  console.log(`   소스: ${e2eDir}`);
  console.log(`   대상: ${e2ePcDir}`);
  
  // package.json 생성/업데이트
  const packageJsonPath = path.join(e2ePcDir, 'package.json');
  const packageJson = {
    name: '@namos/e2e-pc',
    version: '1.0.0',
    description: 'E2E Test Package for NAMOAIChat PC Version',
    private: true,
    main: 'index.js',
    scripts: {
      test: 'playwright test',
      'test:ui': 'playwright test --ui',
      'test:headed': 'playwright test --headed',
      'test:debug': 'playwright test --debug',
      'test:report': 'playwright show-report',
      'install-browsers': 'playwright install'
    },
    keywords: [
      'e2e',
      'playwright',
      'testing',
      'namos',
      'namoaichat'
    ],
    author: '',
    license: 'UNLICENSED',
    dependencies: {
      '@playwright/test': '^1.40.0'
    },
    peerDependencies: {
      '@playwright/test': '^1.40.0'
    },
    files: [
      '*.spec.ts',
      'helpers/**/*',
      'docs/**/*',
      '*.md',
      'playwright.config.ts'
    ]
  };
  
  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify(packageJson, null, 2),
    'utf8'
  );
  console.log('   ✅ package.json 생성/업데이트 완료');
  
  // README.md 생성 (선택사항)
  const readmePath = path.join(e2ePcDir, 'README.md');
  if (!fs.existsSync(readmePath)) {
    const readme = `# E2E_PC

E2E 테스트 파일 패키지

## 구조

- \`*.spec.ts\`: 테스트 스펙 파일
- \`helpers/\`: 테스트 헬퍼 함수

## 실행

\`\`\`bash
npm test
\`\`\`
`;
    
    fs.writeFileSync(readmePath, readme, 'utf8');
    console.log('   ✅ README.md 생성 완료');
  }
}

if (require.main === module) {
  main();
}

module.exports = { copyDir };

