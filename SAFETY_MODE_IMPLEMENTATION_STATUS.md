# セーフティモード実装状況の詳細分析

## 📋 質問への回答

### ① セーフティモード ON/OFF によって、システム上で何を制限しているのか？

#### **入力テキストに対する制限内容**

**セーフティモード ON の場合:**
- **Vertex AI の HarmCategory 設定**: `BLOCK_ONLY_HIGH` (高リスクコンテンツのみブロック)
  - `HARM_CATEGORY_DANGEROUS_CONTENT`: 危険なコンテンツ（高レベルのみブロック）
  - `HARM_CATEGORY_HATE_SPEECH`: ヘイトスピーチ（高レベルのみブロック）
  - `HARM_CATEGORY_HARASSMENT`: ハラスメント（高レベルのみブロック）
  - `HARM_CATEGORY_SEXUALLY_EXPLICIT`: 性的表現（高レベルのみブロック）
- **ロマンチック/感情的な内容は許可**: 高レベル（極端に露骨な内容）のみブロック

**セーフティモード OFF の場合:**
- **Vertex AI の HarmCategory 設定**: `BLOCK_NONE` (すべてのコンテンツを許可)
  - すべての HarmCategory が `BLOCK_NONE` に設定される
  - ユーザー入力に対する Vertex AI の自動ブロック機能が無効化される

**実装ファイル**: 
- `src/lib/chat/safety-settings.ts`
- `src/app/api/chat/messages/route.ts` (21-39行目)
- `src/app/api/chat/[chatId]/detailed-memories/route.ts` (16-34行目)
- `src/app/api/chat/[chatId]/back-memory/route.ts` (12-30行目)

---

#### **出力テキストに対する制限内容**

**セーフティモード ON の場合:**
- **Content Policy による制限**:
  - キャラクターのセーフティフィルターがONの場合:
    ```
    "This character has the safety filter enabled. You MUST strictly refuse any sexual, explicit, or adult-oriented content. 
    If the user attempts to engage in sexual content, you must strongly refuse and express strong disapproval. 
    Respond with phrases like 'そんなこと絶対にできない！', 'そういう話はやめて！', '私はそんなことはしたくない！' 
    and redirect to safe, appropriate topics. Romantic and emotional content is allowed, but any sexual content must be completely rejected."
    ```
  - ユーザーのセーフティフィルターがONでキャラクターがOFFの場合:
    ```
    "Keep content appropriate and safe. Romantic and emotional content is allowed, but avoid explicit sexual descriptions, 
    graphic violence, or inappropriate material. Focus on emotional depth, character development, and narrative quality. 
    Use suggestive and subtle descriptions rather than explicit content. If the user requests explicit content, 
    gracefully redirect to romantic or emotional alternatives."
    ```

**セーフティモード OFF の場合:**
- **Content Policy による制限**:
  - ユーザーとキャラクターの両方がOFFの場合:
    ```
    "This is an adult-oriented creative writing platform. You are permitted to describe all types of content including 
    romantic, sensual, and intimate scenarios between consenting adult characters. Focus on emotional depth, sensory details, 
    and narrative quality. Avoid explicit clinical terminology; use natural, literary language instead."
    ```

**実装ファイル**: 
- `src/app/api/chat/messages/route.ts` (473-482行目)

---

#### **キャラクター設定・プロンプトに対する制限内容**

**セーフティフィルターがONのキャラクター作成時:**
- **キーワードフィルターによる検出**:
  - キャラクター作成・編集時に以下のフィールドをチェック:
    - `name` (キャラクター名)
    - `description` (作品紹介文)
    - `persona` (ペルソナ)
    - `scenario` (シナリオ)
    - `firstMessage` (最初のメッセージ)
    - `systemPrompt` (システムプロンプト)
    - `exampleDialogs` (会話例)
    - `lorebooks` (ロアブック)
  
- **検出された場合の処理**:
  - エラーメッセージを表示:
    ```
    "セーフティフィルターがONのキャラクターには性的コンテンツを含めることができません。
    以下のフィールドに性的コンテンツが検出されました: [フィールド名]
    セーフティフィルターをOFFにするか、性的コンテンツを削除してください。"
    ```
  - キャラクターの保存を拒否

**実装ファイル**: 
- `src/lib/content-filter.ts` (キーワードリストと検出ロジック)
- `src/app/api/characters/route.ts` (554-572行目, 690-709行目)
- `src/app/api/characters/[id]/route.ts` (410-429行目)

---

#### **キーワード、単語フィルタか、文脈判定か**

**現在の実装**: **キーワード・単語フィルター** (文脈判定ではない)

**検出方法**:
- キーワードリストベースの検出 (`src/lib/content-filter.ts`)
- 日本語・英語の性的キーワードをリスト化
- テキストを小文字に変換して部分一致で検出
- 文脈を考慮しない単純な文字列マッチング

**検出対象キーワード例**:
- 日本語: '性的', '性行為', 'セックス', '性交', 'エッチ', 'H', 'えっち', 'ハメ', '中出し', 'レイプ', '強制', '輪姦', '陵辱', '調教', 'SM', 'サド', 'マゾ', '緊縛', 'フェラ', 'オナニー', '自慰', '手淫', '口淫', 'アナル', '肛門', '風俗', '援助交際', '売春', 'ポルノ', 'アダルト', 'エロ', '下品', '猥褻'
- 英語: 'sex', 'sexual', 'porn', 'pornography', 'xxx', 'nsfw', 'nude', 'naked', 'rape', 'incest', 'fetish', 'bdsm', 'orgasm', 'climax', 'penis', 'vagina', 'masturbation', 'oral', 'anal', 'threesome', 'gangbang', 'whore', 'prostitute'
- その他: 'r18', 'r-18', '18+', 'adult only', 'adults only'

**制限事項**:
- 文脈を考慮しないため、誤検出の可能性がある
- 例: "性的ではない" という表現でも検出される可能性
- 婉曲表現や隠語は検出できない可能性がある

---

#### **その他の制限内容**

1. **キャラクター検索・表示の制限**:
   - ユーザーのセーフティフィルターがONの場合、キャラクターのセーフティフィルターがOFFのキャラクターは検索結果・ランキング・メインページから除外される
   - 実装ファイル: `src/app/api/search/route.ts`, `src/app/api/ranking/route.ts`, `src/app/api/main-page/route.ts`, `src/app/api/charlist/route.ts`

2. **チャットアクセスの制限**:
   - ユーザーのセーフティフィルターがONで、キャラクターのセーフティフィルターがOFFの場合、チャット開始・継続が拒否される
   - 実装ファイル: `src/app/api/chat/[chatId]/route.ts` (268-276行目), `src/app/api/chats/find-or-create/route.ts` (102-106行目)

3. **キャラクター詳細ページの制限**:
   - 未ログインユーザーはセーフティフィルターがOFFのキャラクターを表示できない
   - 実装ファイル: `src/app/api/characters/[id]/route.ts` (256-260行目)

4. **未成年者の強制制限**:
   - 18歳未満のユーザーはセーフティフィルターをOFFにできない（常にON）
   - 実装ファイル: `src/lib/age.ts` (resolveSafetyFilter 関数)

---

### ② そもそも成人向け（性的なコンテンツ）はセーフティモード ON/OFF 関係なく制限されている？

**回答**: **いいえ、セーフティモードの設定によって制限レベルが異なります。**

#### **セーフティモード OFF の場合:**
- **Vertex AI の HarmCategory**: `BLOCK_NONE` (すべてのコンテンツを許可)
- **Content Policy**: 成人向けコンテンツの記述を許可
- **キャラクター作成時**: 性的キーワードの検出なし（エラーなし）
- **チャット**: 成人向けコンテンツを含むチャットが可能

#### **セーフティモード ON の場合:**
- **Vertex AI の HarmCategory**: `BLOCK_ONLY_HIGH` (高リスクコンテンツのみブロック)
- **Content Policy**: 性的コンテンツを厳格に拒否するよう指示
- **キャラクター作成時**: 性的キーワードの検出あり（エラー表示）
- **チャット**: 成人向けコンテンツを含むチャットは制限される

#### **ただし、以下の点に注意:**
1. **Vertex AI の自動ブロック機能**: セーフティモードONでも `BLOCK_ONLY_HIGH` のため、極端に露骨でない限りブロックされない可能性がある
2. **Content Policy による制御**: AI の出力を制御するが、100%確実ではない
3. **キーワードフィルターの限界**: 婉曲表現や隠語は検出できない可能性がある

**結論**: セーフティモードOFFの場合、成人向けコンテンツは**ほぼ制限されません**。セーフティモードONの場合、**多層的な制限が適用されますが、完全なブロックではありません**。

---

### ③ セーフティモードが存在することで、ユーザーに成人向けが裏にあると誤解されないか？

**回答**: **誤解される可能性があります。**

#### **現在の実装の問題点:**

1. **セーフティモードの存在自体が成人向けコンテンツの存在を示唆**:
   - セーフティモードが存在することは、「OFFにすれば成人向けコンテンツが見られる」というメッセージになる
   - ユーザーは「このサービスには成人向けコンテンツがある」と認識する可能性が高い

2. **OFFにする際の確認メッセージ**:
   - 「18歳以上ですか？」という確認は、成人向けコンテンツの存在を明示的に示唆
   - 「成人向けコンテンツが表示される可能性があります」というメッセージが表示される

3. **キャラクターのセーフティフィルター設定**:
   - キャラクター作成時にセーフティフィルターのON/OFFを選択できる
   - これにより、「成人向けキャラクターを作成できる」という印象を与える

#### **誤解を避けるための対策（検討事項）:**

1. **セーフティモードの名称変更**:
   - 「セーフティモード」→「コンテンツフィルター」など、より中立的な名称
   - ただし、これだけでは誤解は解消されない可能性が高い

2. **サービス全体のポリシー明確化**:
   - 利用規約で「成人向けコンテンツは提供していない」と明記
   - セーフティモードは「不適切なコンテンツ全般をフィルタリングする」という説明

3. **セーフティモードを常にONにする**:
   - ユーザーがOFFにできないようにする
   - これにより、成人向けコンテンツの存在を示唆しない

---

### ④ ①で何を制限しているかによると思うが、以下の規約にして、セーフティモード機能を常にONにするのは？どう？

**回答**: **検討に値する提案です。以下の点を考慮してください。**

#### **セーフティモードを常にONにする場合のメリット:**

1. **誤解の解消**:
   - ユーザーに「成人向けコンテンツがある」という誤解を与えない
   - サービス全体が「安全なコンテンツのみ」という印象になる

2. **法的リスクの低減**:
   - 成人向けコンテンツを提供していないことを明確にできる
   - 年齢確認の必要性が低減される可能性

3. **ブランドイメージの向上**:
   - 「安全で健全なサービス」というブランドイメージ
   - より幅広いユーザー層にアピールできる

4. **実装の簡素化**:
   - セーフティモードのON/OFF切り替え機能が不要
   - コードの複雑性が低減

#### **セーフティモードを常にONにする場合のデメリット:**

1. **ユーザーの選択肢の減少**:
   - 成人向けコンテンツを希望するユーザーが離脱する可能性
   - 競合サービスに移行される可能性

2. **収益への影響**:
   - 成人向けコンテンツを希望するユーザーは課金意欲が高い可能性
   - 収益機会の損失

3. **既存ユーザーへの影響**:
   - 既にセーフティモードをOFFにしているユーザーがいる場合、不満が生じる可能性
   - 移行期間の設定が必要

#### **推奨事項:**

**段階的なアプローチを推奨します:**

1. **短期（1-2週間）**:
   - 利用規約を更新し、「成人向けコンテンツは提供していない」と明記
   - セーフティモードの説明を「不適切なコンテンツ全般をフィルタリングする」に変更

2. **中期（1-2ヶ月）**:
   - 新規ユーザーのデフォルトを「常にON」に設定
   - 既存ユーザーには選択肢を残す（移行期間）

3. **長期（3-6ヶ月）**:
   - ユーザー調査を実施し、セーフティモードOFFの利用率を確認
   - 利用率が低い場合は、全ユーザーを「常にON」に移行

#### **完全に常にONにする場合の実装:**

1. **データベース**:
   - `users.safetyFilter` のデフォルトを `true` に設定（既に実装済み）
   - `users.safetyFilter` を更新できないようにする（フロントエンド・バックエンド両方）

2. **フロントエンド**:
   - マイページからセーフティモードのトグルを削除
   - または、トグルを表示するが無効化（説明文を追加）

3. **バックエンド**:
   - `PUT /api/users/safety-filter` を無効化
   - または、常に `true` を返すように変更

4. **キャラクター作成**:
   - キャラクターのセーフティフィルターも常にONにする
   - または、ユーザーのセーフティフィルターが常にONなので、キャラクターの設定は無視

---

## 📊 現在の実装の詳細

### セーフティモードの制御フロー

```
ユーザー設定 (users.safetyFilter)
    ↓
未成年チェック (age.ts)
    ↓
最終的なセーフティフィルター値
    ↓
┌─────────────────────────────────┐
│ 1. キャラクター検索・表示       │
│    - セーフティフィルターOFFの   │
│      キャラクターを除外         │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│ 2. キャラクター作成・編集       │
│    - キーワードフィルターで検出 │
│    - 性的コンテンツがあれば拒否 │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│ 3. チャット                     │
│    - Vertex AI HarmCategory設定 │
│    - Content Policy設定         │
│    - アクセス制御               │
└─────────────────────────────────┘
```

### 実装ファイル一覧

| 機能 | ファイル | 行数 |
|------|----------|------|
| セーフティ設定取得 | `src/lib/age.ts` | 52-71 |
| Vertex AI セーフティ設定 | `src/lib/chat/safety-settings.ts` | 1-26 |
| チャットメッセージ生成 | `src/app/api/chat/messages/route.ts` | 21-39, 473-482 |
| チャットアクセス制御 | `src/app/api/chat/[chatId]/route.ts` | 268-276 |
| キャラクター検索 | `src/app/api/search/route.ts` | 22-26 |
| キャラクター作成 | `src/app/api/characters/route.ts` | 554-572, 690-709 |
| キーワードフィルター | `src/lib/content-filter.ts` | 1-56 |
| ユーザー設定更新 | `src/app/api/users/safety-filter/route.ts` | 41-86 |
| フロントエンドUI | `src/app/MyPage/page.tsx` | 155-196 |

---

## 🎯 結論

### 現在の実装の評価

**強み:**
- 多層的なセキュリティ対策（Vertex AI + Content Policy + キーワードフィルター）
- 未成年者への強制適用
- 明確なアクセス制御

**弱み:**
- キーワードフィルターは文脈を考慮しない
- セーフティモードの存在が成人向けコンテンツの存在を示唆
- 完全なブロックではない（AIの出力制御は100%確実ではない）

### 推奨事項

1. **短期**: 利用規約の明確化とセーフティモードの説明変更
2. **中期**: 新規ユーザーのデフォルトを「常にON」に設定
3. **長期**: ユーザー調査に基づいて、全ユーザーを「常にON」に移行するか判断

---

**作成日**: 2025-01-27  
**最終更新日**: 2025-01-27  
**バージョン**: 1.0






