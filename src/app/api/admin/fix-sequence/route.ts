export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/nextauth';
import { getPrisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';

const isAdminRole = (role?: Role | string | null): boolean => {
  if (!role) return false;
  const roleValue = role as Role;
  return roleValue === Role.SUPER_ADMIN || roleValue === Role.MODERATOR || roleValue === Role.CHAR_MANAGER;
};

/**
 * POST: Fix PostgreSQL sequences for auto-increment fields
 * This fixes the "Unique constraint failed on the fields: (id)" error
 * that occurs when the sequence is out of sync with the actual max id in the table.
 */
export async function POST() {
  if (isBuildTime()) return buildTimeResponse();
  
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }
  if (!isAdminRole(session.user.role)) {
    return NextResponse.json({ error: 'この操作を実行する権限がありません。' }, { status: 403 });
  }

  try {
    const prisma = await getPrisma();
    
    // Fix characters table sequence
    const maxCharacterId = await prisma.$queryRaw<Array<{ max: bigint | null }>>`
      SELECT MAX(id) as max FROM characters
    `;
    const maxId = maxCharacterId[0]?.max ? Number(maxCharacterId[0].max) : 0;
    
    // Reset sequence to max(id) + 1
    await prisma.$executeRawUnsafe(`
      SELECT setval('characters_id_seq', ${maxId + 1}, false)
    `);
    
    // Also check and fix other tables that might have the same issue
    const tables = ['users', 'chat', 'comments', 'character_images', 'lorebooks'];
    const results: Record<string, { maxId: number; sequenceSet: boolean }> = {};
    
    for (const table of tables) {
      try {
        const maxResult = await prisma.$queryRawUnsafe<Array<{ max: bigint | null }>>(
          `SELECT MAX(id) as max FROM ${table}`
        );
        const tableMaxId = maxResult[0]?.max ? Number(maxResult[0].max) : 0;
        
        try {
          await prisma.$executeRawUnsafe(
            `SELECT setval('${table}_id_seq', ${tableMaxId + 1}, false)`
          );
          results[table] = { maxId: tableMaxId, sequenceSet: true };
        } catch (seqError) {
          // Sequence might not exist for this table, skip it
          results[table] = { maxId: tableMaxId, sequenceSet: false };
        }
      } catch (error) {
        results[table] = { maxId: 0, sequenceSet: false };
      }
    }
    
    return NextResponse.json({
      message: 'シーケンスを修正しました。',
      characters: {
        maxId,
        sequenceFixed: true,
      },
      otherTables: results,
    });
  } catch (error) {
    console.error('シーケンス修正エラー:', error);
    return NextResponse.json(
      { 
        error: 'シーケンスの修正に失敗しました。', 
        details: error instanceof Error ? error.message : '不明なエラー' 
      },
      { status: 500 }
    );
  }
}

