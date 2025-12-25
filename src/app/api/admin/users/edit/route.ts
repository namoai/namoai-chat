export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { getPrisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { isBuildTime, buildTimeResponse, safeJsonParse } from "@/lib/api-helpers";

// ユーザー情報取得 API
export async function GET(request: NextRequest) {
    if (isBuildTime()) return buildTimeResponse();
    
    try {
        const session = await getServerSession(authOptions);
        
        // 管理者権限チェック
        if (!session || session.user?.role !== 'SUPER_ADMIN') {
            return NextResponse.json({ error: "権限がありません。" }, { status: 403 });
        }

        const userId = request.nextUrl.searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: "ユーザーIDが必要です。" }, { status: 400 });
        }

        const prisma = await getPrisma();
        const user = await prisma.users.findUnique({
            where: { id: parseInt(userId) },
            include: {
                points: true,
                accounts: {
                    select: {
                        provider: true,
                    }
                }
            },
        });

        if (!user) {
            return NextResponse.json({ error: "ユーザーが見つかりません。" }, { status: 404 });
        }

        // 生年月日(dateOfBirth)から未成年かどうかを判定
        let isMinor = false;
        if (user.dateOfBirth) {
            const birthDate = new Date(user.dateOfBirth);
            const today = new Date();
            const age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            const dayDiff = today.getDate() - birthDate.getDate();
            
            // 誕生日がまだ来ていない場合は年齢を1引く
            const actualAge = (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) ? age - 1 : age;
            isMinor = actualAge < 18;
        }

        return NextResponse.json({ ...user, isMinor });
    } catch (error) {
        console.error("ユーザー情報取得エラー:", error);
        return NextResponse.json({ error: "取得処理中にエラーが発生しました。" }, { status: 500 });
    }
}

// ユーザー情報更新 API
export async function PUT(request: NextRequest) {
    if (isBuildTime()) return buildTimeResponse();
    
    try {
        const session = await getServerSession(authOptions);
        
        // 管理者権限チェック
        if (!session || session.user?.role !== 'SUPER_ADMIN') {
            return NextResponse.json({ error: "権限がありません。" }, { status: 403 });
        }

        const parseResult = await safeJsonParse<{ userId: number; name?: string; nickname?: string; email?: string; phone?: string; bio?: string; role?: string; freePoints?: number; paidPoints?: number; dateOfBirth?: string | null; isMinor?: boolean }>(request);
        if (!parseResult.success) return parseResult.error;
        const { userId, name, nickname, email, phone, bio, role, freePoints, paidPoints, dateOfBirth, isMinor } = parseResult.data;

        if (!userId) {
            return NextResponse.json({ error: "ユーザーIDが必要です。" }, { status: 400 });
        }

        // roleのバリデーション
        let roleValue: Role | undefined = undefined;
        if (role) {
            if (!Object.values(Role).includes(role as Role)) {
                return NextResponse.json({ error: "無効な役割です。" }, { status: 400 });
            }
            roleValue = role as Role;
        }

        const prisma = await getPrisma();
        // トランザクションで更新
        await prisma.$transaction(async (tx) => {
            // ユーザー情報を更新
            const updateData: {
                name?: string;
                nickname?: string;
                email?: string;
                phone?: string | null;
                bio?: string | null;
                role?: Role;
                dateOfBirth?: Date | null;
            } = {};
            
            if (name !== undefined) updateData.name = name;
            if (nickname !== undefined) updateData.nickname = nickname;
            if (email !== undefined) updateData.email = email;
            if (phone !== undefined) updateData.phone = phone || null;
            if (bio !== undefined) updateData.bio = bio || null;
            if (roleValue !== undefined) updateData.role = roleValue;
            
            // 生年月日の処理
            if (dateOfBirth !== undefined) {
                if (dateOfBirth === null || dateOfBirth === '') {
                    updateData.dateOfBirth = null;
                } else {
                    updateData.dateOfBirth = new Date(dateOfBirth);
                }
            }
            
            // isMinorがtrueの場合、生年月日を17歳に設定（birthdate未設定の場合のみ）
            if (isMinor === true && dateOfBirth === undefined) {
                const today = new Date();
                const minorDate = new Date(today.getFullYear() - 17, today.getMonth(), today.getDate());
                updateData.dateOfBirth = minorDate;
            }

            await tx.users.update({
                where: { id: userId },
                data: updateData,
            });
        });

        // ポイント情報を更新 (指定された場合のみ)
        // ✅ point_transactions와 일관성을 유지하기 위해 grantPoints/consumePoints 사용
        // ⚠️ grantPoints/consumePoints가 자체 트랜잭션을 사용하므로 별도로 처리
        if (freePoints !== undefined || paidPoints !== undefined) {
            const { getPointBalance } = await import('@/lib/point-manager');
            const currentBalance = await getPointBalance(userId);
            
            // 무료 포인트 차이 계산 및 조정
            if (freePoints !== undefined) {
                const freeDiff = freePoints - currentBalance.totalFreePoints;
                if (freeDiff !== 0) {
                    if (freeDiff > 0) {
                        // 포인트 추가
                        const { grantPoints } = await import('@/lib/point-manager');
                        await grantPoints({
                            userId,
                            amount: freeDiff,
                            type: 'free',
                            source: 'admin_grant',
                            description: `管理者による無料ポイント調整`,
                        });
                    } else {
                        // 포인트 차감 (음수는 consumePoints 사용)
                        const { consumePoints } = await import('@/lib/point-manager');
                        await consumePoints({
                            userId,
                            amount: Math.abs(freeDiff),
                            usageType: 'other',
                            description: `管理者による無料ポイント調整`,
                        });
                    }
                }
            }
            
            // 유료 포인트 차이 계산 및 조정
            if (paidPoints !== undefined) {
                const paidDiff = paidPoints - currentBalance.totalPaidPoints;
                if (paidDiff !== 0) {
                    if (paidDiff > 0) {
                        // 포인트 추가
                        const { grantPoints } = await import('@/lib/point-manager');
                        await grantPoints({
                            userId,
                            amount: paidDiff,
                            type: 'paid',
                            source: 'admin_grant',
                            description: `管理者による有料ポイント調整`,
                        });
                    } else {
                        // 포인트 차감 (음수는 consumePoints 사용)
                        const { consumePoints } = await import('@/lib/point-manager');
                        await consumePoints({
                            userId,
                            amount: Math.abs(paidDiff),
                            usageType: 'other',
                            description: `管理者による有料ポイント調整`,
                        });
                    }
                }
            }
        }

        return NextResponse.json({ 
            success: true, 
            message: "ユーザー情報を更新しました。"
        });
    } catch (error) {
        console.error("ユーザー情報更新エラー:", error);
        return NextResponse.json({ error: "更新処理中にエラーが発生しました。" }, { status: 500 });
    }
}

