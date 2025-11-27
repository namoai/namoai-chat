export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/nextauth';
import { prisma } from '@/lib/prisma';
import { Prisma, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

type Tx = Prisma.TransactionClient;

const PARTNER_EMAIL = process.env.TEST_SOCIAL_EMAIL ?? 'social-partner@namos.chat';
const PARTNER_PASSWORD = process.env.TEST_SOCIAL_PASSWORD ?? 'SocialTest123!';
const SEED_TITLE_PREFIX = '[AutoSeed]';

const isAdminRole = (role?: Role | string | null): boolean => {
  if (!role) return false;
  const roleValue = role as Role;
  return roleValue === Role.SUPER_ADMIN || roleValue === Role.MODERATOR || roleValue === Role.CHAR_MANAGER;
};

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }
  if (!isAdminRole(session.user.role)) {
    return NextResponse.json({ error: 'この操作を実行する権限がありません。' }, { status: 403 });
  }

  const targetUserId = Number(session.user.id);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const partnerUser = await ensurePartnerUser(tx);
      const partnerCharacter = await ensureCharacter(tx, partnerUser.id, {
        name: 'テスト協力キャラクター',
        description: '自動生成されたテスト用のキャラクターです。',
      });
      const targetCharacter = await ensureCharacter(tx, targetUserId, {
        name: 'テスト検証キャラクター',
        description: '自動生成されたテスト検証用のキャラクターです。',
      });

      const followCreated = await ensureFollow(tx, partnerUser.id, targetUserId);
      const favoriteCreated = await ensureFavorite(tx, partnerUser.id, targetCharacter.id);
      const comment = await createSeedComment(tx, partnerUser.id, targetCharacter.id);

      await purgeSeedNotifications(tx, targetUserId);
      const notifications = await createSeedNotifications(tx, {
        targetUserId,
        partnerUser,
        targetCharacter,
        commentId: comment.id,
      });

      return {
        partnerUser: { id: partnerUser.id, nickname: partnerUser.nickname, email: partnerUser.email },
        partnerCharacterId: partnerCharacter.id,
        targetCharacterId: targetCharacter.id,
        followCreated,
        favoriteCreated,
        commentId: comment.id,
        notificationsCreated: notifications.length,
      };
    });

    return NextResponse.json({
      message: 'ソーシャル / 通知テスト用データを準備しました。',
      ...result,
    });
  } catch (error) {
    console.error('テスト用ソーシャルデータ準備エラー:', error);
    return NextResponse.json(
      { error: 'ソーシャルテストデータの準備に失敗しました。', details: error instanceof Error ? error.message : '不明なエラー' },
      { status: 500 }
    );
  }
}

async function ensurePartnerUser(tx: Tx) {
  let user = await tx.users.findUnique({
    where: { email: PARTNER_EMAIL },
    include: { points: true },
  });

  if (!user) {
    const hashed = await bcrypt.hash(PARTNER_PASSWORD, 12);
    user = await tx.users.create({
      data: {
        email: PARTNER_EMAIL,
        password: hashed,
        name: 'テスト協力ユーザー',
        nickname: `テスト協力_${Date.now()}`,
        phone: `099${Math.floor(Math.random() * 1_0000_0000)
          .toString()
          .padStart(8, '0')}`,
        safetyFilter: true,
        points: {
          create: {},
        },
      },
      include: { points: true },
    });
  } else if (!user.points) {
    await tx.points.create({
      data: {
        user_id: user.id,
      },
    });
  }

  return user;
}

async function ensureCharacter(
  tx: Tx,
  userId: number,
  template: { name: string; description: string }
) {
  let character = await tx.characters.findFirst({
    where: { author_id: userId },
    orderBy: { createdAt: 'asc' },
  });

  if (!character) {
    character = await tx.characters.create({
      data: {
        author_id: userId,
        name: template.name,
        description: template.description,
        detailSetting: 'テスト自動生成されたキャラクター設定です。',
        firstSituation: 'テスト環境での確認用シナリオです。',
        firstMessage: 'こんにちは、テスト用のキャラクターです！',
        visibility: 'public',
        safetyFilter: true,
        category: 'テスト',
        hashtags: ['テスト', '自動生成'],
      },
    });
  }

  return character;
}

async function ensureFollow(tx: Tx, followerId: number, followingId: number) {
  const existing = await tx.follows.findUnique({
    where: {
      followerId_followingId: { followerId, followingId },
    },
  });

  if (existing) return false;

  await tx.follows.create({
    data: { followerId, followingId },
  });
  return true;
}

async function ensureFavorite(tx: Tx, userId: number, characterId: number) {
  const existing = await tx.favorites.findUnique({
    where: {
      user_id_character_id: { user_id: userId, character_id: characterId },
    },
  });

  if (existing) return false;

  await tx.favorites.create({
    data: {
      user_id: userId,
      character_id: characterId,
    },
  });
  return true;
}

async function createSeedComment(tx: Tx, authorId: number, characterId: number) {
  await tx.comments.deleteMany({
    where: {
      authorId,
      characterId,
      content: { startsWith: SEED_TITLE_PREFIX },
    },
  });

  return tx.comments.create({
    data: {
      authorId,
      characterId,
      content: `${SEED_TITLE_PREFIX} テストコメント - ${new Date().toISOString()}`,
    },
  });
}

async function purgeSeedNotifications(tx: Tx, userId: number) {
  await tx.notifications.deleteMany({
    where: {
      userId,
      title: { startsWith: SEED_TITLE_PREFIX },
    },
  });
}

async function createSeedNotifications(
  tx: Tx,
  params: {
    targetUserId: number;
    partnerUser: { id: number; nickname: string; email: string };
    targetCharacter: { id: number; name: string };
    commentId: number;
  }
) {
  const baseContent = {
    userId: params.targetUserId,
    actorId: params.partnerUser.id,
    characterId: params.targetCharacter.id,
  };

  const payloads = [
    {
      type: 'FOLLOW',
      title: `${SEED_TITLE_PREFIX} 新しいフォロワー`,
      content: `${params.partnerUser.nickname} があなたをフォローしました。`,
      link: `/profile/${params.partnerUser.id}`,
    },
    {
      type: 'LIKE',
      title: `${SEED_TITLE_PREFIX} キャラクターにいいねが届きました`,
      content: `${params.partnerUser.nickname} が ${params.targetCharacter.name} にいいねしました。`,
      link: `/characters/${params.targetCharacter.id}`,
    },
    {
      type: 'COMMENT',
      title: `${SEED_TITLE_PREFIX} 新しいコメント`,
      content: `${params.partnerUser.nickname} からコメントが届きました。`,
      link: `/characters/${params.targetCharacter.id}`,
      commentId: params.commentId,
    },
  ];

  const notifications = [];
  for (const payload of payloads) {
    notifications.push(
      await tx.notifications.create({
        data: {
          ...baseContent,
          ...payload,
        },
      })
    );
  }

  return notifications;
}


