/**
 * データベースシーケンス同期ユーティリティ
 * Unique constraint エラー発生時にシーケンスを自動修正
 */

import { Prisma, PrismaClient } from "@prisma/client";

/**
 * シーケンス同期および再試行ヘルパー関数
 * @param prisma Prisma クライアント
 * @param tableName テーブル名 (例: 'characters', 'notifications')
 * @param createOperation データ生成関数
 * @returns 生成されたデータ
 */
export async function withSequenceSync<T>(
  prisma: PrismaClient,
  tableName: string,
  createOperation: () => Promise<T>
): Promise<T> {
  try {
    return await createOperation();
  } catch (error) {
    // Unique constraint エラーが id フィールドで発生した場合、シーケンス修正後に再試行
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const isIdFieldError = error.meta && 
        typeof error.meta === 'object' && 
        error.meta !== null &&
        'target' in error.meta && 
        Array.isArray((error.meta as { target?: unknown }).target) &&
        ((error.meta as { target: unknown[] }).target.includes('id'));
      
      const errorMessage = error.message || '';
      const isIdConstraint = errorMessage.includes('Unique constraint failed on the fields: (`id`)') || isIdFieldError;
      
      if (isIdConstraint) {
        console.log(`[sequence-sync] ⚠️ Sequence out of sync detected for ${tableName}. Fixing...`);
        
        try {
          // トランザクション外でシーケンス修正
          const maxResult = await prisma.$queryRaw<Array<{ max: bigint | null }>>`
            SELECT MAX(id) as max FROM ${Prisma.raw(`"${tableName}"`)}
          `;
          const maxId = maxResult[0]?.max ? Number(maxResult[0].max) : 0;
          
          const sequenceName = `${tableName}_id_seq`;
          await prisma.$executeRawUnsafe(`
            SELECT setval('${sequenceName}', ${maxId + 1}, false)
          `);
          
          console.log(`[sequence-sync] ✅ Sequence fixed for ${tableName}. Max ID: ${maxId}, Sequence set to: ${maxId + 1}`);
          
          // 再試行
          return await createOperation();
        } catch (retryError) {
          console.error(`[sequence-sync] ❌ Sequence fix and retry failed for ${tableName}:`, retryError);
          throw error; // 元のエラーを再度 throw
        }
      }
    }
    throw error;
  }
}

/**
 * トランザクション内でシーケンス同期が必要な場合のヘルパー
 * トランザクションが abort された場合、トランザクション外でシーケンスを修正し、新しいトランザクションで再試行
 */
export async function withSequenceSyncInTransaction<T>(
  prisma: PrismaClient,
  tableName: string,
  transactionOperation: () => Promise<T>
): Promise<T> {
  try {
    return await transactionOperation();
  } catch (error) {
    // Unique constraint エラーが id フィールドで発生した場合
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const isIdFieldError = error.meta && 
        typeof error.meta === 'object' && 
        error.meta !== null &&
        'target' in error.meta && 
        Array.isArray((error.meta as { target?: unknown }).target) &&
        ((error.meta as { target: unknown[] }).target.includes('id'));
      
      const errorMessage = error.message || '';
      const isIdConstraint = errorMessage.includes('Unique constraint failed on the fields: (`id`)') || isIdFieldError;
      
      if (isIdConstraint) {
        console.log(`[sequence-sync] ⚠️ Sequence out of sync detected for ${tableName} in transaction. Fixing outside transaction...`);
        
        try {
          // トランザクション外でシーケンス修正
          const maxResult = await prisma.$queryRaw<Array<{ max: bigint | null }>>`
            SELECT MAX(id) as max FROM ${Prisma.raw(`"${tableName}"`)}
          `;
          const maxId = maxResult[0]?.max ? Number(maxResult[0].max) : 0;
          
          const sequenceName = `${tableName}_id_seq`;
          await prisma.$executeRawUnsafe(`
            SELECT setval('${sequenceName}', ${maxId + 1}, false)
          `);
          
          console.log(`[sequence-sync] ✅ Sequence fixed outside transaction for ${tableName}. Max ID: ${maxId}, Sequence set to: ${maxId + 1}`);
          
          // 新しいトランザクションで再試行
          console.log(`[sequence-sync] Retrying with new transaction for ${tableName}...`);
          return await transactionOperation();
        } catch (retryError) {
          console.error(`[sequence-sync] ❌ Sequence fix and retry failed for ${tableName}:`, retryError);
          throw error; // 元のエラーを再度 throw
        }
      }
    }
    throw error;
  }
}

