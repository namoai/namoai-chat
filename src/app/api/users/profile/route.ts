export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { PrismaClient, Prisma } from '@prisma/client'; // Prismaをインポート
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

// GET: 現在ログインしているユーザーのプロフィール情報を取得します
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);

  try {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        nickname: true,
        bio: true,
        image_url: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'ユーザーが見つかりません。' }, { status: 404 });
    }
    return NextResponse.json(user);
  } catch (error) {
    console.error('プロファイル取得エラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}


// PUT: ユーザーのプロフィール情報を更新します
export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);

  try {
    const formData = await request.formData();
    const nickname = formData.get('nickname') as string;
    const bio = formData.get('bio') as string;
    const imageFile = formData.get('image') as File | null;

    let imageUrl: string | undefined = undefined;

    const currentUser = await prisma.users.findUnique({ where: { id: userId } });
    if (!currentUser) {
        return NextResponse.json({ error: 'ユーザーが見つかりません。' }, { status: 404 });
    }

    if (imageFile && imageFile.size > 0) {
      if (currentUser.image_url && currentUser.image_url.startsWith('/uploads/')) {
        try {
          await fs.unlink(path.join(process.cwd(), 'public', currentUser.image_url));
        } catch (e) {
          console.error(`古い画像の削除に失敗: ${currentUser.image_url}`, e);
        }
      }

      const buffer = Buffer.from(await imageFile.arrayBuffer());
      const filename = `${Date.now()}-${imageFile.name.replace(/\s/g, '_')}`;
      const savePath = path.join(process.cwd(), 'public/uploads/avatars', filename);
      
      await fs.mkdir(path.dirname(savePath), { recursive: true });
      await fs.writeFile(savePath, buffer);
      
      imageUrl = `/uploads/avatars/${filename}`;
    }

    const updatedUser = await prisma.users.update({
      where: { id: userId },
      data: {
        nickname: nickname,
        bio: bio,
        ...(imageUrl && { image_url: imageUrl }),
      },
    });

    return NextResponse.json({ message: 'プロフィールが正常に更新されました。', user: updatedUser });

  } catch (error) {
    // ▼▼▼ 変更点: エラーハンドリングを改善します ▼▼▼
    console.error('プロファイル更新エラー:', error);

    // Prismaのユニーク制約違反エラー(P2002)をチェック
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'このニックネームは既に使用されています。' },
        { status: 409 } // 409 Conflict: 競合
      );
    }
    
    return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}