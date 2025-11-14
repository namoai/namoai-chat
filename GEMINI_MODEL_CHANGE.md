# 🤖 Gemini Model Change Log

## 📅 変更日: 2024-11-14

### 🔄 変更内容

#### メインチャット API
**ファイル:** `src/app/api/chat/[chatId]/route.ts`

**変更点:**
1. **リージョン変更**
   - Before: `asia-northeast1` (東京)
   - After: `us-central1` (米国中部)

2. **モデル変更**
   - Before: `gemini-2.5-flash` (デフォルト)
   - After: `gemini-2.5-pro` (デフォルト) ⭐

3. **バックアップ**
   - バックアップファイル: `src/app/api/chat/[chatId]/route.ts.backup-flash-northeast`

#### 他のAPIは変更なし (Flash維持)
- ✅ `/api/chat/messages` - `gemini-2.5-flash` @ `asia-northeast1`
- ✅ `/api/chat/[chatId]/back-memory` - `gemini-2.5-flash` @ `asia-northeast1`
- ✅ `/api/chat/[chatId]/detailed-memories` - `gemini-2.5-flash` @ `asia-northeast1`
- ✅ 自動生成API - `gemini-2.5-flash` @ `asia-northeast1`

### 🎯 理由

- **応答品質向上**: Pro モデルでより高品質な会話
- **コスト最適化**: 要約・生成はFlashで高速・低コスト

### 📊 期待される効果

#### メリット:
- ✅ 会話品質の向上
- ✅ より一貫性のある応答
- ✅ 複雑な指示への理解度向上

#### デメリット:
- ⚠️ 応答速度: やや遅くなる可能性
- ⚠️ コスト: 約10倍増加（チャット部分のみ）

### 🔙 元に戻す方法

```bash
# バックアップから復元
cp src/app/api/chat/[chatId]/route.ts.backup-flash-northeast src/app/api/chat/[chatId]/route.ts
```

または手動で:
1. `location: "us-central1"` → `location: "asia-northeast1"`
2. `gemini-2.0-flash-exp` → `gemini-2.5-flash`

### ⚙️ デプロイ

```bash
git add -A
git commit -m "Change main chat to Gemini 2.0 Flash Exp with us-central1"
git push
```

