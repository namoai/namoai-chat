#!/bin/bash

# 유저 테스트만 실행하는 스크립트
echo "유저 E2E 테스트 실행 중..."

# Windows Git Bash에서 실행할 경우
npx playwright test e2e/user-*.spec.ts

# 또는 특정 테스트만 실행하려면:
# npx playwright test e2e/user-auth.spec.ts e2e/user-character.spec.ts e2e/user-social.spec.ts e2e/user-persona.spec.ts e2e/user-points.spec.ts e2e/user-notifications.spec.ts e2e/user-notices.spec.ts e2e/user-inquiries.spec.ts e2e/user-journey.spec.ts e2e/user-ranking.spec.ts





