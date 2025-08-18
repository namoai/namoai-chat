export const runtime = 'nodejs';

import { NextResponse, NextRequest } from 'next/server';
import { prisma } from "@/lib/prisma";

// ✅ Vercelビルドエラーを回避するため、URLから直接IDを解析するヘルパー関数
function extractUserIdFromRequest(request: Request): number | null {
  const url = new URL(request.url);
  const idStr = url.pathname.split('/').pop();
  if (!idStr) return null;
  const parsedId = parseInt(idStr, 10);
  return isNaN(parsedId) ? null : parsedId;
}

export async function GET(request: NextRequest) {
  const userId = extractUserIdFromRequest(request);
  
  if (userId === null) {
    return NextResponse.json({ error: '無効なユーザーIDです。' }, { status: 400 });
  }

  try {
    // 1. ユーザーの基本情報を取得
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        nickname: true,
        email: true,
        image_url: true,
        bio: true,
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'ユーザーが見つかりません。' }, { status: 404 });
    }

    // 2. フォロワー数とフォロー数を直接カウント
    const followerCount = await prisma.follows.count({
      where: { followingId: userId }
    });
    const followingCount = await prisma.follows.count({
      where: { followerId: userId }
    });

    // 3. ユーザーが作成したキャラクターリストを取得
    const characters = await prisma.characters.findMany({
      where: { author_id: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        characterImages: { where: { isMain: true }, take: 1 },
        _count: {
          select: { favorites: true, chat: true }
        }
      }
    });
    
    // 4. 全体の会話量を計算
    const totalMessageCount = await prisma.chat_message.count({
        where: {
            chat: {
                characters: {
                    author_id: userId
                }
            }
        }
    });

    // 返すデータの構造を修正します
    const profileData = {
      ...user,
      characters,
      totalMessageCount,
      _count: { // _countオブジェクトでラップ
        followers: followerCount,
        following: followingCount,
      }
    };

    return NextResponse.json(profileData);

  } catch (error) {
    console.error('プロファイルデータの取得エラー:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}
