# Git ワークフロー

## 環境別ブランチ戦略

### ブランチ構成

- **`main`**: 本番環境（혼방 환경）
- **`develop`**: IT テスト環境
- **`staging`**: ステージング環境（必要に応じて）

### ワークフロー

#### 1. IT環境での作業（developブランチ）

```bash
# developブランチに切り替え
git checkout develop

# 機能開発・修正
# ... コードを編集 ...

# コミット
git add .
git commit -m "IT環境でテスト: [機能説明]"

# developブランチにプッシュ
git push origin develop
# → IT環境（Amplify developブランチ）に自動デプロイ
```

#### 2. 本番環境への反映（mainブランチ）

```bash
# developブランチでテスト完了後、mainブランチにマージ
git checkout main
git pull origin main

# developブランチをマージ
git merge develop

# コンフリクトがあれば解決
# ... コンフリクト解決 ...

# mainブランチにプッシュ
git push origin main
# → 本番環境（Amplify mainブランチ）に自動デプロイ
```

### 推奨ワークフロー

1. **IT環境で開発・テスト**
   - `develop`ブランチで作業
   - IT環境で動作確認
   - 問題なければ次のステップへ

2. **本番環境に反映**
   - `main`ブランチにマージ
   - 本番環境で最終確認

### 注意事項

- **IT環境では`STAGING_DATABASE_URL`は使用されません**
  - `APP_ENV=integration`の場合、`IT_DATABASE_URL`のみ使用
  - コードで明示的に無視されるように実装済み

- **環境変数の設定**
  - `develop`ブランチ（IT環境）: `APP_ENV=integration`, `IT_DATABASE_URL=...`
  - `main`ブランチ（本番環境）: `APP_ENV=staging`, `STAGING_DATABASE_URL=...`

### トラブルシューティング

#### マージコンフリクトが発生した場合

```bash
# コンフリクトを解決
git status  # コンフリクトファイルを確認
# ... ファイルを編集してコンフリクト解決 ...

# 解決後
git add .
git commit -m "マージコンフリクト解決: [説明]"
git push origin main
```

#### developブランチを最新に保つ

```bash
# mainブランチの変更をdevelopに反映
git checkout develop
git merge main
git push origin develop
```

