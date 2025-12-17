# 💾 メモリ不足エラー対応ガイド

## 問題

`RangeError: Array buffer allocation failed` エラーが発生

これは Node.js プロセスがメモリ不足に陥っていることを示しています。

## 実施した対策

### 1. Node.js メモリ制限を増加

`package.json` の `dev` スクリプトを更新:

```json
"dev": "cross-env NODE_OPTIONS=--max-old-space-size=8192 next dev"
```

- 4096MB → 8192MB (8GB) に増加

### 2. Webpack キャッシュの削除

`.next` ディレクトリを削除してキャッシュをクリア

### 3. Webpack 警告の抑制

`next.config.ts` で `fs`/`path` モジュールの警告を抑制（サーバー専用なので問題なし）

## それでもメモリ不足が発生する場合

### 追加の対策

1. **メモリ制限をさらに増加**
   ```json
   "dev": "cross-env NODE_OPTIONS=--max-old-space-size=12288 next dev"
   ```
   (12GB まで増加可能)

2. **他のアプリケーションを閉じる**
   - ブラウザのタブを減らす
   - 他のメモリを多く使うアプリを閉じる

3. **システムメモリを増やす**
   - 物理メモリが不足している場合は、RAM の増設を検討

4. **開発環境の最適化**
   - VS Code の拡張機能を無効化
   - 不要なプロセスを終了

---

**最終更新**: 2025-01-XX



