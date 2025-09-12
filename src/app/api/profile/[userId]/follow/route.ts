import { NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';

// ▼▼▼【修正】関数の第二引数を Next.js の規約に合わせて context オブジェクトとして受け取るように変更
export async function POST(request: Request, context: { params: { userId: string } }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
    }

    try {
        // ▼▼▼【修正】context.params から動的パラメータ(userId)を取得するように変更
        const targetUserId = parseInt(context.params.userId, 10);
        const currentUserId = parseInt(session.user.id, 10);

        if (isNaN(targetUserId)) {
            return NextResponse.json({ error: '無効なユーザーIDです。' }, { status: 400 });
        }
        if (currentUserId === targetUserId) {
            return NextResponse.json({ error: '自分自身をフォローすることはできません。' }, { status: 400 });
        }

        const existingFollow = await prisma.follows.findUnique({
            where: {
                followerId_followingId: {
                    followerId: currentUserId,
                    followingId: targetUserId,
                },
            },
        });

        if (existingFollow) {
            await prisma.follows.delete({
                where: {
                    followerId_followingId: {
                        followerId: currentUserId,
                        followingId: targetUserId,
                    },
                },
            });
            const newFollowerCount = await prisma.follows.count({ where: { followingId: targetUserId } });
            return NextResponse.json({ message: 'フォローを解除しました。', isFollowing: false, newFollowerCount });
        } else {
            await prisma.follows.create({
                data: {
                    followerId: currentUserId,
                    followingId: targetUserId,
                },
            });
            const newFollowerCount = await prisma.follows.count({ where: { followingId: targetUserId } });
            return NextResponse.json({ message: 'フォローしました。', isFollowing: true, newFollowerCount });
        }
    } catch (error) {
        console.error('フォロー処理エラー:', error);
        return NextResponse.json({ error: '処理中にエラーが発生しました。' }, { status: 500 });
    }
}