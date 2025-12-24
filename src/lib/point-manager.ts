/**
 * Point Management System
 * Handles point transactions with individual expiration tracking
 */

import { getPrisma } from './prisma';

export type PointType = 'free' | 'paid';
export type PointSource = 'attendance' | 'purchase' | 'admin_grant' | 'migration' | 'registration';
export type UsageType = 'chat' | 'image_generation' | 'boost' | 'other';

interface GrantPointsParams {
  userId: number;
  amount: number;
  type: PointType;
  source: PointSource;
  description?: string;
  paymentId?: number;
}

interface ConsumePointsParams {
  userId: number;
  amount: number;
  usageType: UsageType;
  description?: string;
  relatedChatId?: number;
  relatedMessageId?: number;
}

interface PointBalance {
  totalFreePoints: number;
  totalPaidPoints: number;
  totalPoints: number;
  details: Array<{
    id: number;
    type: PointType;
    balance: number;
    expiresAt: Date;
    source: string;
  }>;
}

/**
 * Grant points to user and create transaction record
 * Points will expire 1 year from acquired_at date
 */
export async function grantPoints(params: GrantPointsParams): Promise<void> {
  const { userId, amount, type, source, description, paymentId } = params;
  
  if (amount <= 0) {
    throw new Error('Point amount must be positive');
  }

  const prisma = await getPrisma();
  const acquiredAt = new Date();
  const expiresAt = new Date(acquiredAt);
  expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year expiration

  await prisma.$transaction(async (tx) => {
    // Create transaction record
    await tx.point_transactions.create({
      data: {
        user_id: userId,
        type,
        amount,
        balance: amount, // Initially, balance = amount
        source,
        description,
        payment_id: paymentId,
        acquired_at: acquiredAt,
        expires_at: expiresAt,
      },
    });

    // Update points summary table for quick reference
    await tx.points.upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        free_points: type === 'free' ? amount : 0,
        paid_points: type === 'paid' ? amount : 0,
        lastAttendedAt: source === 'attendance' ? acquiredAt : undefined,
      },
      update: {
        free_points: type === 'free' ? { increment: amount } : undefined,
        paid_points: type === 'paid' ? { increment: amount } : undefined,
        lastAttendedAt: source === 'attendance' ? acquiredAt : undefined,
      },
    });
  });
}

/**
 * Consume points from user's balance using FIFO
 * Oldest non-expired points are consumed first
 * Free points are consumed before paid points
 */
export async function consumePoints(params: ConsumePointsParams): Promise<void> {
  const { userId, amount, usageType, description, relatedChatId, relatedMessageId } = params;
  
  if (amount <= 0) {
    throw new Error('Point amount must be positive');
  }

  const prisma = await getPrisma();
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // Get available point transactions (not expired, has balance)
    // Order: free points first (FIFO), then paid points (FIFO)
    const availableTransactions = await tx.point_transactions.findMany({
      where: {
        user_id: userId,
        balance: { gt: 0 },
        expires_at: { gt: now },
      },
      orderBy: [
        { type: 'desc' }, // 'paid' < 'free' in ASCII, so desc gives free first
        { acquired_at: 'asc' }, // FIFO
      ],
    });

    // Calculate total available points
    const totalAvailable = availableTransactions.reduce((sum, t) => sum + t.balance, 0);
    
    if (totalAvailable < amount) {
      throw new Error(`Insufficient points. Required: ${amount}, Available: ${totalAvailable}`);
    }

    // Consume points from transactions
    let remainingToConsume = amount;
    const transactionDetails: Array<{ transactionId: number; amount: number }> = [];

    for (const transaction of availableTransactions) {
      if (remainingToConsume <= 0) break;

      const consumeFromThis = Math.min(transaction.balance, remainingToConsume);
      
      // Update transaction balance
      await tx.point_transactions.update({
        where: { id: transaction.id },
        data: { balance: transaction.balance - consumeFromThis },
      });

      transactionDetails.push({
        transactionId: transaction.id,
        amount: consumeFromThis,
      });

      remainingToConsume -= consumeFromThis;

      // Update points summary
      if (transaction.type === 'free') {
        await tx.points.update({
          where: { user_id: userId },
          data: { free_points: { decrement: consumeFromThis } },
        });
      } else {
        await tx.points.update({
          where: { user_id: userId },
          data: { paid_points: { decrement: consumeFromThis } },
        });
      }
    }

    // Create usage history record
    await tx.point_usage_history.create({
      data: {
        user_id: userId,
        points_used: amount,
        usage_type: usageType,
        description,
        related_chat_id: relatedChatId,
        related_message_id: relatedMessageId,
        transaction_details: transactionDetails,
      },
    });
  });
}

/**
 * Get user's point balance (excluding expired points)
 */
export async function getPointBalance(userId: number): Promise<PointBalance> {
  const prisma = await getPrisma();
  const now = new Date();

  const transactions = await prisma.point_transactions.findMany({
    where: {
      user_id: userId,
      balance: { gt: 0 },
      expires_at: { gt: now },
    },
    orderBy: [
      { type: 'desc' },
      { acquired_at: 'asc' },
    ],
  });

  const totalFreePoints = transactions
    .filter(t => t.type === 'free')
    .reduce((sum, t) => sum + t.balance, 0);

  const totalPaidPoints = transactions
    .filter(t => t.type === 'paid')
    .reduce((sum, t) => sum + t.balance, 0);

  return {
    totalFreePoints,
    totalPaidPoints,
    totalPoints: totalFreePoints + totalPaidPoints,
    details: transactions.map(t => ({
      id: t.id,
      type: t.type as PointType,
      balance: t.balance,
      expiresAt: t.expires_at,
      source: t.source,
    })),
  };
}

/**
 * Clean up expired points
 * This should be run periodically (e.g., daily cron job)
 */
export async function cleanupExpiredPoints(): Promise<{ cleanedCount: number; totalPointsCleaned: number }> {
  const prisma = await getPrisma();
  const now = new Date();

  const expiredTransactions = await prisma.point_transactions.findMany({
    where: {
      balance: { gt: 0 },
      expires_at: { lte: now },
    },
  });

  let totalPointsCleaned = 0;

  for (const transaction of expiredTransactions) {
    totalPointsCleaned += transaction.balance;

    await prisma.$transaction(async (tx) => {
      // Set balance to 0
      await tx.point_transactions.update({
        where: { id: transaction.id },
        data: { balance: 0 },
      });

      // Update points summary
      if (transaction.type === 'free') {
        await tx.points.update({
          where: { user_id: transaction.user_id },
          data: { free_points: { decrement: transaction.balance } },
        });
      } else {
        await tx.points.update({
          where: { user_id: transaction.user_id },
          data: { paid_points: { decrement: transaction.balance } },
        });
      }
    });
  }

  return {
    cleanedCount: expiredTransactions.length,
    totalPointsCleaned,
  };
}

