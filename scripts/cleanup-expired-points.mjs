#!/usr/bin/env node

/**
 * Manual script to cleanup expired points
 * Usage: node scripts/cleanup-expired-points.mjs
 */

import 'dotenv/config';

const CRON_SECRET = process.env.CRON_SECRET;
const API_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

if (!CRON_SECRET) {
  console.error('❌ CRON_SECRET environment variable not set');
  process.exit(1);
}

console.log('🔄 Starting expired points cleanup...');
console.log(`📍 API URL: ${API_URL}`);

try {
  const response = await fetch(`${API_URL}/api/cron/cleanup-expired-points`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CRON_SECRET}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();

  if (response.ok) {
    console.log('✅ Cleanup completed successfully:');
    console.log(`   - Transactions cleaned: ${data.cleanedCount}`);
    console.log(`   - Total points cleaned: ${data.totalPointsCleaned}`);
    console.log(`   - Duration: ${data.duration}ms`);
    console.log(`   - Timestamp: ${data.timestamp}`);
  } else {
    console.error('❌ Cleanup failed:');
    console.error(`   - Status: ${response.status}`);
    console.error(`   - Error: ${data.error}`);
    if (data.details) {
      console.error(`   - Details: ${data.details}`);
    }
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Failed to call cleanup API:');
  console.error(error);
  process.exit(1);
}

