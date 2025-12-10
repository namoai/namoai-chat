# Refresh Token ログアウト機能の実装

## 実装内容

### 問題点
- NextAuthのJWT戦略を使用しているが、ログアウト時にrefresh tokenを明示的に無効化するメカニズムが実装されていなかった
- `events.signOut`コールバックが存在せず、ログアウト時にAccountテーブルのrefresh_tokenが削除されない
- ログアウト後もrefresh tokenを使用して再ログインできてしまう可能性があった

### 実装した解決策

#### 1. `events.signOut`コールバックの追加
**ファイル**: `src/lib/nextauth.ts`

```typescript
events: {
  async signOut({ session, token }) {
    try {
      const prisma = await getPrismaInstance();
      // sessionまたはtokenからuserIdを取得
      const userId = session?.user?.id || token?.sub || token?.id;
      
      if (userId) {
        const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
        
        if (!isNaN(userIdNum)) {
          // ユーザーのAccountレコードからrefresh tokenを無効化
          await prisma.account.updateMany({
            where: { userId: userIdNum },
            data: { 
              refresh_token: null,
              access_token: null,
              expires_at: null,
            },
          });
          console.log(`[signOut] ユーザー ID ${userIdNum} のrefresh tokenを無効化しました`);
        }
      }
    } catch (error) {
      // エラーが発生してもログアウト処理は続行
      console.error('[signOut] refresh token無効化エラー:', error);
    }
  },
},
```

#### 2. 動作フロー

1. **ユーザーがログアウトを実行**
   - `signOut()`関数が呼び出される
   - NextAuthが`events.signOut`コールバックを実行

2. **Refresh Token無効化**
   - Accountテーブルから該当ユーザーの`refresh_token`、`access_token`、`expires_at`を`null`に設定
   - これにより、refresh tokenを使用して新しいアクセストークンを取得できなくなる

3. **セッションタイムアウト時**
   - `useSessionTimeout.ts`で自動ログアウトが実行される
   - 同様に`events.signOut`が呼び出され、refresh tokenが無効化される

### 動作確認ポイント

1. **通常のログアウト**
   - ユーザーが手動でログアウトボタンをクリック
   - Accountテーブルのrefresh_tokenが`null`になることを確認

2. **セッションタイムアウト**
   - 30分間非活動状態
   - 自動ログアウトが実行され、refresh tokenが無効化されることを確認

3. **ログアウト後の再ログイン試行**
   - ログアウト後、refresh tokenを使用して再ログインできないことを確認
   - 新しいログインが必要であることを確認

### セキュリティ上の利点

- **トークン無効化**: ログアウト時にrefresh tokenが確実に無効化される
- **セッション管理**: セッションタイムアウト時にも自動的に無効化される
- **再ログイン防止**: ログアウト後、refresh tokenを使用してアクセスを維持できない

### 注意事項

- JWT戦略を使用しているため、セッション情報がJWTトークンに含まれる
- `events.signOut`はNextAuthがログアウト処理を実行する際に自動的に呼び出される
- エラーが発生してもログアウト処理は続行される（エラーハンドリング済み）

### テスト方法

1. ログイン後、データベースでAccountテーブルのrefresh_tokenを確認
2. ログアウトを実行
3. Accountテーブルのrefresh_tokenが`null`になっていることを確認
4. セッションタイムアウト（30分非活動）後に自動ログアウトが実行され、refresh tokenが無効化されることを確認


