// @upstash/redis パッケージから Redis クライアントをインポートします。
import { Redis } from '@upstash/redis';

// 環境変数 (process.env) から Upstash データベースのURLとトークンを読み込みます。
// '!' は、これらの変数が必ず存在することを TypeScript に伝えるための non-null assertion operator です。
// Netlify やローカルの runtime.json を通じて変数が設定されるため、安心して使用できます。
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});