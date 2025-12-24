/**
 * Referral System Utilities
 * Handles referral code generation and reward processing
 */

import { getPrisma } from './prisma';

/**
 * Generate a unique 6-character alphanumeric referral code
 */
export async function generateReferralCode(): Promise<string> {
  const prisma = await getPrisma();
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars like 0, O, 1, I
  let code = '';
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!isUnique && attempts < maxAttempts) {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    // Check if code already exists
    const existing = await prisma.users.findUnique({
      where: { referralCode: code },
    });

    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    throw new Error('Failed to generate unique referral code');
  }

  return code;
}

/**
 * Process referral reward when a referred user makes their first payment
 */
export async function processReferralReward(
  referredUserId: number,
  paymentId: number
): Promise<boolean> {
  const prisma = await getPrisma();

  try {
    // Check if referred user has a referrer
    const referredUser = await prisma.users.findUnique({
      where: { id: referredUserId },
      select: { referredByUserId: true },
    });

    if (!referredUser?.referredByUserId) {
      console.log('[Referral] User has no referrer');
      return false;
    }

    // Check if reward already given
    const existingReward = await prisma.referral_rewards.findUnique({
      where: { referred_user_id: referredUserId },
    });

    if (existingReward) {
      console.log('[Referral] Reward already given for this user');
      return false;
    }

    // Award 1000 points to referrer
    const REFERRAL_REWARD_POINTS = 1000;
    
    // Import grantPoints function
    const { grantPoints } = await import('./point-manager');
    
    await grantPoints({
      userId: referredUser.referredByUserId,
      amount: REFERRAL_REWARD_POINTS,
      type: 'free',
      source: 'admin_grant', // Using existing source type for now
      description: `紹介報酬 - 友達が初回決済完了`,
    });

    // Create referral reward record
    await prisma.referral_rewards.create({
      data: {
        referrer_user_id: referredUser.referredByUserId,
        referred_user_id: referredUserId,
        points_awarded: REFERRAL_REWARD_POINTS,
        payment_id: paymentId,
      },
    });

    console.log(`[Referral] Awarded ${REFERRAL_REWARD_POINTS} points to user ${referredUser.referredByUserId}`);
    return true;
  } catch (error) {
    console.error('[Referral] Error processing referral reward:', error);
    return false;
  }
}

/**
 * Get referral statistics for a user
 */
export async function getReferralStats(userId: number) {
  const prisma = await getPrisma();

  const [totalReferrals, totalRewards, recentReferrals] = await Promise.all([
    // Total number of users referred
    prisma.users.count({
      where: { referredByUserId: userId },
    }),

    // Total rewards earned
    prisma.referral_rewards.aggregate({
      where: { referrer_user_id: userId },
      _sum: { points_awarded: true },
    }),

    // Recent referrals with reward status
    prisma.users.findMany({
      where: { referredByUserId: userId },
      select: {
        id: true,
        nickname: true,
        created_at: true,
        referralRewardsReceived: {
          select: {
            points_awarded: true,
            rewarded_at: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 10,
    }),
  ]);

  return {
    totalReferrals,
    totalRewardsEarned: totalRewards._sum.points_awarded || 0,
    successfulReferrals: recentReferrals.filter(r => r.referralRewardsReceived.length > 0).length,
    pendingReferrals: recentReferrals.filter(r => r.referralRewardsReceived.length === 0).length,
    recentReferrals: recentReferrals.map(r => ({
      id: r.id,
      nickname: r.nickname,
      joinedAt: r.created_at,
      rewardEarned: r.referralRewardsReceived[0]?.points_awarded || 0,
      rewardDate: r.referralRewardsReceived[0]?.rewarded_at || null,
      isPending: r.referralRewardsReceived.length === 0,
    })),
  };
}

