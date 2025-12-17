#!/bin/bash

# 成人認証フィールド追加マイグレーションスクリプト
# IT環境と本番環境の両方に適用

echo "=========================================="
echo "成人認証フィールド追加マイグレーション"
echo "=========================================="

# IT環境
echo ""
echo "【IT環境】マイグレーション実行中..."
export DATABASE_URL="postgresql://postgres:namoai20250701@namoai-it.cluwk88i28od.ap-northeast-1.rds.amazonaws.com:5432/postgres"
psql $DATABASE_URL -f prisma/migrations/add_adult_verification_fields/migration.sql

if [ $? -eq 0 ]; then
    echo "✅ IT環境: マイグレーション成功"
else
    echo "❌ IT環境: マイグレーション失敗"
    exit 1
fi

# 本番環境（혼방）
echo ""
echo "【本番環境】マイグレーション実行中..."
export DATABASE_URL="postgresql://postgres:namoai20250701@namos-chat.cluwk88i28od.ap-northeast-1.rds.amazonaws.com:5432/postgres"
psql $DATABASE_URL -f prisma/migrations/add_adult_verification_fields/migration.sql

if [ $? -eq 0 ]; then
    echo "✅ 本番環境: マイグレーション成功"
else
    echo "❌ 本番環境: マイグレーション失敗"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ すべてのマイグレーションが完了しました"
echo "=========================================="

