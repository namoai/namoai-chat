@echo off
REM Windows 배치 파일로 유저 테스트 실행

echo 유저 E2E 테스트 실행 중...

npx playwright test e2e/user-auth.spec.ts e2e/user-character.spec.ts e2e/user-social.spec.ts e2e/user-persona.spec.ts e2e/user-points.spec.ts e2e/user-notifications.spec.ts e2e/user-notices.spec.ts e2e/user-inquiries.spec.ts e2e/user-journey.spec.ts e2e/user-ranking.spec.ts





