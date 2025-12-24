export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from 'next/server';
import { cleanupExpiredPoints } from '@/lib/point-manager';
import { ensureEnvVarsLoaded } from '@/lib/load-env-vars';

// Cron job for cleaning up expired points
// Should be called daily (e.g., Vercel Cron or external scheduler)
export async function GET(request: NextRequest) {
  await ensureEnvVarsLoaded();

  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await cleanupExpiredPoints();

    console.log(
      `Expired points cleaned up: ${result.cleanedCount} transactions, ${result.totalPointsCleaned} points total`
    );

    return NextResponse.json({
      success: true,
      cleanedCount: result.cleanedCount,
      totalPointsCleaned: result.totalPointsCleaned,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cleanup expired points error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
