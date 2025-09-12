import { NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';

// セッションとユーザーIDを検証する共通関数
async function getAndVerifySession(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return { error: '認証されていません。', status: 401, userIds: null };
    }
    
    const url = new URL(request.url);
    const idStr = url.pathname.split('/').at(-2); // /blockの前のIDを取得
    if (!idStr) {
        return { error: '無効なユーザーIDです。', status: 400, userIds: null };
    }
    const targetUserId = parseInt(idStr, 10);
    if (isNaN(targetUserId)) {
        return { error: '無効なユーザーID形式です。', status: 400, userIds: null };
    }

    const currentUserId = parseInt(session.user.id, 10);
    if (currentUserId === targetUserId) {
        return { error: '自分自身をブロックすることはできません。', status: 400, userIds: null };
    }

    return { error: null, status: 200, userIds: { currentUserId, targetUserId } };
}

export async function POST(request: Request) {
    const { error, status, userIds } = await getAndVerifySession(request);
    if (error || !userIds) {
        return NextResponse.json({ error }, { status });
    }
    const { currentUserId, targetUserId } = userIds;

    try {
        const existingBlock = await prisma.block.findUnique({
            where: {
                blockerId_blockingId: {
                    blockerId: currentUserId,
                    blockingId: targetUserId,
                },
            },
        });

        if (existingBlock) {
            // 既にブロックしている場合は解除
            await prisma.block.delete({
                where: {
                    blockerId_blockingId: {
                        blockerId: currentUserId,
                        blockingId: targetUserId,
                    },
                },
            });
            return NextResponse.json({ message: 'ブロックを解除しました。', isBlocked: false });
        } else {
            // ブロックしていない場合はブロック
            await prisma.block.create({
                data: {
                    blockerId: currentUserId,
                    blockingId: targetUserId,
                },
            });
            return NextResponse.json({ message: 'ブロックしました。', isBlocked: true });
        }
    } catch (e) {
        console.error('ブロック処理エラー:', e);
        // ▼▼▼【修正】'e'が'unknown'型であるため、型チェックを追加して安全にプロパティにアクセスします ▼▼▼
        if (typeof e === 'object' && e !== null) {
            const error = e as { code?: string; message?: string };
            if (error.code === 'P2002' || (error.message && error.message.includes('relation "Block" does not exist'))) {
                return NextResponse.json({ error: 'サーバーエラー: Blockテーブルがデータベースに存在しない可能性があります。スキーマを確認してください。' }, { status: 500 });
            }
        }
        return NextResponse.json({ error: '処理中にエラーが発生しました。' }, { status: 500 });
    }
}

