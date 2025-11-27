export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { prisma } from "@/lib/prisma";
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

        return NextResponse.json(user);
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

        const parseResult = await safeJsonParse<{ userId: number; name?: string; nickname?: string; email?: string; phone?: string; bio?: string; role?: string; freePoints?: number; paidPoints?: number }>(request);
        if (!parseResult.success) return parseResult.error;
        const { userId, name, nickname, email, phone, bio, role, freePoints, paidPoints } = parseResult.data;

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
            } = {};
            
            if (name !== undefined) updateData.name = name;
            if (nickname !== undefined) updateData.nickname = nickname;
            if (email !== undefined) updateData.email = email;
            if (phone !== undefined) updateData.phone = phone || null;
            if (bio !== undefined) updateData.bio = bio || null;
            if (roleValue !== undefined) updateData.role = roleValue;

            await tx.users.update({
                where: { id: userId },
                data: updateData,
            });

            // ポイント情報を更新 (指定された場合のみ)
            if (freePoints !== undefined || paidPoints !== undefined) {
                const existingPoints = await tx.points.findUnique({
                    where: { user_id: userId }
                });

                if (existingPoints) {
                    await tx.points.update({
                        where: { user_id: userId },
                        data: {
                            free_points: freePoints !== undefined ? freePoints : existingPoints.free_points,
                            paid_points: paidPoints !== undefined ? paidPoints : existingPoints.paid_points,
                        },
                    });
                } else {
                    // ポイントレコードが存在しない場合は作成
                    await tx.points.create({
                        data: {
                            user_id: userId,
                            free_points: freePoints || 0,
                            paid_points: paidPoints || 0,
                        },
                    });
                }
            }
        });

        return NextResponse.json({ 
            success: true, 
            message: "ユーザー情報を更新しました。"
        });
    } catch (error) {
        console.error("ユーザー情報更新エラー:", error);
        return NextResponse.json({ error: "更新処理中にエラーが発生しました。" }, { status: 500 });
    }
}

