# ⚡ Gemini 2.5 Pro 速度最適化プラン

## 📊 現状分析

### **問題点**

#### 1. プロンプトが長すぎる
- 不要な指示文が多い (`speedInstruction`, `conciseGuideline` など)
- 画像出力指示が複雑 (AI に `{img:1}` 形式を生成させる)
- トークン数が増加 → TTFB (Time To First Byte) が遅延

#### 2. 画像処理が非効率
- AI が画像番号を選択する必要がある
- プロンプトに画像リストを全て含める
- AI の判断が不正確な場合がある

#### 3. DB クエリの順序
- 現在は並列化されているが、さらに改善の余地あり

---

## ✨ 改善方案

### **Phase 1: プロンプト最適化** (即座に効果)

#### 変更点
1. ✅ 不要な指示文を削除
   - `speedInstruction` 削除 (効果なし)
   - `conciseGuideline` 削除 (systemTemplate で十分)
   - プロンプトを **約30-40%短縮**

2. 画像出力指示を削除
   - AI に画像番号を生成させない
   - 後処理でキーワードマッチング

#### 効果
- **トークン数削減**: 200-300 トークン削減
- **TTFB 改善**: 推定 0.5-1.0 秒短縮
- **応答精度向上**: 余計な指示がないため、ストーリーに集中

---

### **Phase 2: 画像を後処理に変更** (推奨)

#### 現在の方式 (非効率)
```
AI プロンプト:
"以下の画像から適切なものを選んで {img:番号} を挿入せよ
1. (キーワード: 笑顔)
2. (キーワード: 怒り)
3. (キーワード: 悲しみ)
..."

AI 応答:
"*彼女は微笑んだ。* {img:1}
「こんにちは」"
```

**問題点:**
- プロンプトが長い
- AI が判断ミスする可能性
- トークン消費が大きい

#### 改善方式 (効率的)

**1. AI は普通のテキストだけ生成**
```
AI 応答:
"*彼女は微笑んだ。*
「こんにちは」"
```

**2. バックエンドでキーワードマッチング**
```typescript
// サーバー側で自動選択
function selectImageByKeyword(
  aiResponse: string, 
  images: CharacterImageInfo[]
): string | null {
  const lowerResponse = aiResponse.toLowerCase();
  
  // 優先度順にマッチング
  for (const img of images) {
    if (img.keyword && lowerResponse.includes(img.keyword.toLowerCase())) {
      return img.imageUrl;
    }
  }
  
  return images[0]?.imageUrl || null; // デフォルト画像
}
```

**3. クライアントに画像 URL を送信**
```typescript
sendEvent('ai-message-saved', { 
  modelMessage: newModelMessage,
  imageUrl: selectImageByKeyword(finalResponseText, worldSetting.characterImages)
});
```

#### 効果
- **プロンプト削減**: 100-200 トークン削減
- **応答速度向上**: 0.3-0.5 秒短縮
- **精度向上**: キーワード完全一致で確実

---

### **Phase 3: ストリーミング最適化**

#### 現状
- すでにストリーミングを実装済み ✅
- Server-Sent Events (SSE) 使用中 ✅

#### 追加改善案

##### 1. チャンクサイズの最適化
```typescript
// 現在: 1文字ずつ送信
sendEvent('ai-update', { responseChunk: chunk });

// 改善: 10-20文字ごとにバッファリング
let buffer = "";
for await (const item of result.stream) {
  const chunk = item.candidates?.[0]?.content?.parts?.[0]?.text;
  buffer += chunk;
  
  if (buffer.length >= 20 || /* 最後のチャンク */) {
    sendEvent('ai-update', { responseChunk: buffer });
    buffer = "";
  }
}
```

**効果**: ネットワークオーバーヘッド削減、クライアント側のレンダリング負荷軽減

##### 2. キャッシング追加
```typescript
import { redis } from '@/lib/redis';

// 類似メッセージのキャッシュチェック
const cacheKey = `chat:${chatId}:${hashMessage(message)}`;
const cached = await redis.get(cacheKey);

if (cached) {
  // キャッシュから即座に返す
  sendEvent('ai-update', { responseChunk: cached, fromCache: true });
  return;
}

// キャッシュに保存 (5分間)
await redis.setex(cacheKey, 300, finalResponseText);
```

**効果**: 同じ質問への即座の応答 (0.1 秒未満)

---

### **Phase 4: DB クエリ最適化**

#### 現状分析
```typescript
// 既に並列化済み ✅
const [dbWriteResult, contextResult] = await Promise.all([
  dbWritePromise, 
  contextPromise
]);
```

#### 追加改善案

##### 1. インデックス確認
```sql
-- chat_message テーブルに適切なインデックスがあるか確認
CREATE INDEX IF NOT EXISTS idx_chat_message_chatid_active 
ON chat_message(chatId, isActive, createdAt);
```

##### 2. 履歴取得の制限
```typescript
// 現在: 最新 10 件
take: 10,

// 改善案: 設定で調整可能に (デフォルト 5 件)
take: settings?.historyLimit || 5,
```

**効果**: DB 負荷削減、メモリ使用量削減

---

## 📊 予想される改善効果

### **総合効果 (Phase 1-4 全実装)**

| 項目 | 現在 | 改善後 | 短縮 |
|------|------|--------|------|
| **TTFB (初回バイト)** | 2.0-3.0秒 | 1.0-1.5秒 | **50%短縮** |
| **完全応答時間** | 5.0-8.0秒 | 3.0-5.0秒 | **40%短縮** |
| **プロンプトトークン数** | 600-800 | 300-400 | **50%削減** |
| **DB クエリ時間** | 0.3-0.5秒 | 0.2-0.3秒 | **30%短縮** |
| **キャッシュヒット時** | - | **0.1秒未満** | **95%短縮** |

---

## 🎯 実装優先順位

### **即座に実装可能 (今日中)**
1. ✅ **プロンプト最適化** (完了)
   - 不要な指示文削除
   - トークン数削減

### **1-2日で実装**
2. **画像後処理への変更**
   - バックエンドでキーワードマッチング実装
   - フロントエンド対応

### **3-4日で実装**
3. **キャッシング追加**
   - Redis 統合
   - キャッシュキー設計

4. **DB インデックス最適化**
   - インデックス確認・追加
   - クエリパフォーマンス測定

### **5-7日で実装**
5. **チャンクバッファリング**
   - ストリーム処理改善
   - クライアント側レンダリング最適化

---

## 💡 追加の最適化アイデア

### **モデル選択の最適化**
```typescript
// 短いメッセージには軽量モデル
const modelToUse = message.length < 50 
  ? "gemini-2.5-flash"  // 超高速
  : "gemini-2.5-pro";   // 高品質
```

### **並列処理の拡大**
```typescript
// ロアブック検索と AI 生成を並列化
const [lorebookResults, aiResponse] = await Promise.all([
  searchLorebooks(message),
  generateAIResponse(chatHistory)
]);
```

---

## 📝 実装チェックリスト

### Phase 1 (完了)
- [x] 不要な指示文削除
- [x] プロンプト簡素化

### Phase 2 (次のステップ)
- [ ] 画像選択ロジックをバックエンドに実装
- [ ] フロントエンド対応 (画像 URL 受信)
- [ ] テスト (キーワードマッチング精度)

### Phase 3
- [ ] Redis キャッシング実装
- [ ] キャッシュキー設計
- [ ] キャッシュ無効化ロジック

### Phase 4
- [ ] DB インデックス確認・追加
- [ ] クエリパフォーマンス測定
- [ ] 履歴取得制限の設定化

### Phase 5
- [ ] チャンクバッファリング実装
- [ ] ネットワークオーバーヘッド測定
- [ ] クライアント側最適化

---

## 🚀 今すぐ始めるべきこと

**Phase 1 は完了しました！**

次は **Phase 2 (画像後処理)** を実装しましょう。

推定時間: **2-3時間**
- バックエンド実装: 1.5時間
- フロントエンド対応: 1時間
- テスト: 0.5時間

**実装を開始しますか？**


