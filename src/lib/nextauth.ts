import { PrismaAdapter } from "@next-auth/prisma-adapter";
// 修正1: 未使用の 'NextAuth' のインポートを削除しました。
import { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { getPrisma } from '@/lib/prisma';
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { randomBytes } from 'crypto';

// PrismaAdapterが期待するモデル名(user, accountなど)と、
// 実際のスキーマのモデル名(users, sessionsなど)の不一致を解決するためのプロキシオブジェクトを作成します。
// PrismaAdapter를 lazy하게 초기화하되, Proxy를 사용하여 실제 메서드를 반환합니다.
let adapterInstance: ReturnType<typeof PrismaAdapter> | null = null;
let adapterPromise: Promise<ReturnType<typeof PrismaAdapter>> | null = null;

async function getAdapter(): Promise<ReturnType<typeof PrismaAdapter>> {
  if (adapterInstance) {
    return adapterInstance;
  }
  
  if (!adapterPromise) {
    adapterPromise = (async () => {
      const prisma = await getPrisma();
      // PrismaAdapter가 기대하는 모델명과 실제 스키마의 모델명을 매핑
      // PrismaAdapter는 prisma.user, prisma.account 등을 사용하지만,
      // 우리 스키마는 users, Account 등을 사용하므로 매핑이 필요합니다.
      // 
      // 작동 원리:
      // - PrismaAdapter가 adapterPrisma.user.findUnique()를 호출하면
      // - 실제로는 prisma.users.findUnique()가 실행됩니다 (JavaScript 객체 속성 매핑)
      // Prisma Client는 모델명을 camelCase로 변환합니다:
      // - model Account → prisma.account (소문자)
      // - model Session → prisma.session (소문자)
      // - model VerificationToken → prisma.verificationToken (camelCase)
      // - model users → prisma.users (그대로)
      const adapterPrisma = {
        ...prisma,
        user: prisma.users,                    // ✅ users (스키마) → user (PrismaAdapter 기대)
        account: prisma.account,               // ✅ account (Prisma Client) → account (PrismaAdapter 기대)
        session: prisma.session,              // ✅ session (Prisma Client) → session (PrismaAdapter 기대)
        verificationToken: prisma.verificationToken, // ✅ verificationToken (Prisma Client) → verificationToken (PrismaAdapter 기대)
      } as unknown as PrismaClient;
      return PrismaAdapter(adapterPrisma);
    })();
  }
  
  adapterInstance = await adapterPromise;
  return adapterInstance;
}

// Adapterの型定義
type Adapter = ReturnType<typeof PrismaAdapter>;

// Helper function to get prisma instance
async function getPrismaInstance() {
  return await getPrisma();
}

// Adapter 메서드를 동기적으로 접근할 수 있도록 래퍼 함수 생성
function createAdapterMethod(prop: string | symbol) {
  return function(...args: unknown[]) {
    // 비동기 함수를 반환하되, NextAuth가 이를 함수로 인식할 수 있도록 함
    return (async () => {
      const adapter = await getAdapter();
      const method = (adapter as Record<string | symbol, unknown>)[prop];
      if (typeof method === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument
        return method.apply(adapter, args);
      }
      throw new Error(`Adapter method ${String(prop)} is not a function`);
    })();
  };
}

// ▼▼▼【環境変数検証】▼▼▼
function validateAuthEnv() {
  const required = {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  };

  const missing: string[] = [];
  for (const [key, value] of Object.entries(required)) {
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    const errorMsg = `❌ NextAuth 환경 변수 누락: ${missing.join(', ')}`;
    console.error(errorMsg);
    console.error('❌ 다음 환경 변수를 설정하세요:');
    missing.forEach(key => {
      console.error(`   - ${key}`);
    });
    
    // 환경 변수가 없으면 빌드 실패
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  } else {
    console.log('✅ NextAuth 환경 변수 검증 완료');
    console.log(`   - GOOGLE_CLIENT_ID: ${process.env.GOOGLE_CLIENT_ID ? '설정됨' : '누락'}`);
    console.log(`   - GOOGLE_CLIENT_SECRET: ${process.env.GOOGLE_CLIENT_SECRET ? '설정됨' : '누락'}`);
    console.log(`   - NEXTAUTH_SECRET: ${process.env.NEXTAUTH_SECRET ? '설정됨' : '누락'}`);
  }
}
// ▲▲▲

// NextAuthの設定をオブジェクトとして定義し、エクスポートします。
// adapter는 lazy하게 초기화되지만, Proxy를 사용하여 실제 메서드를 반환합니다.
export const authOptions: NextAuthOptions = {
  // Adapter를 lazy하게 초기화하기 위한 Proxy
  // NextAuth는 adapter.getUserByAccount를 직접 호출하므로,
  // Proxy는 실제 메서드를 반환해야 합니다.
  // NextAuth v4는 adapter 메서드를 직접 호출하기 전에 메서드가 함수인지 확인하므로,
  // Proxy의 get이 실제 함수를 반환하도록 개선했습니다.
  adapter: new Proxy({} as Adapter, {
    get(_target, prop: string | symbol) {
      // NextAuth가 메서드를 확인할 때 함수를 반환해야 합니다.
      // createAdapterMethod는 동기 함수를 반환하지만, 내부에서 비동기 작업을 수행합니다.
      return createAdapterMethod(prop);
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    has(_target, _prop: string | symbol) {
      // NextAuth가 메서드 존재 여부를 확인할 때 true를 반환
      return true;
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ownKeys(_target) {
      // NextAuth가 adapter의 속성을 열거할 때 필요한 메서드 목록 반환
      return [
        'createUser',
        'getUser',
        'getUserByEmail',
        'getUserByAccount',
        'updateUser',
        'linkAccount',
        'createSession',
        'getSessionAndUser',
        'updateSession',
        'deleteSession',
        'createVerificationToken',
        'useVerificationToken',
        'deleteVerificationToken',
      ];
    },
    getOwnPropertyDescriptor(_target, prop) {
      // NextAuth가 속성 디스크립터를 요청할 때 함수임을 명시
      return {
        enumerable: true,
        configurable: true,
        value: createAdapterMethod(prop),
      };
    },
  }) as Adapter,

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // 既に同じメールアドレスを持つアカウントが存在する場合でも、Googleアカウントとのリンクを許可します。
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // 入力値の検証
        if (!credentials?.email || !credentials?.password) {
          console.log('認証失敗: メールアドレスまたはパスワードが未入力');
          return null;
        }

        try {
          // ユーザーをデータベースから検索
          const prisma = await getPrismaInstance();
          const user = await prisma.users.findUnique({
            where: { email: credentials.email },
          });

          // ユーザーが存在しない、またはパスワードが設定されていない場合
          if (!user) {
            console.log(`認証失敗: メールアドレス ${credentials.email} が登録されていません`);
            return null;
          }

          if (!user.password) {
            console.log(`認証失敗: ユーザー ${user.email} にパスワードが設定されていません (SNSログインのみ)`);
            return null;
          }

          // パスワードの検証
          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.password
          );

          if (!isPasswordValid) {
            console.log(`認証失敗: パスワードが正しくありません (ユーザー: ${user.email})`);
            return null;
          }

          // ▼▼▼【新機能】ユーザー停止チェック ▼▼▼
          if (user.suspendedUntil) {
            const now = new Date();
            if (user.suspendedUntil > now) {
              console.log(`認証失敗: ユーザー ${user.email} は停止中です (期限: ${user.suspendedUntil})`);
              // 停止情報をエラーとして返す
              throw new Error(`SUSPENDED:${user.suspensionReason || '不明な理由'}:${user.suspendedUntil.toISOString()}`);
            }
          }
          // ▲▲▲ 停止チェック完了 ▲▲▲

          // 認証成功
          console.log(`認証成功: ユーザー ${user.email} がログインしました`);
          return {
            id: user.id.toString(),
            email: user.email,
            name: user.name,
            nickname: user.nickname,
            role: user.role,
          };
        } catch (error) {
          console.error('認証処理中にエラーが発生しました:', error);
          // エラーを再スロー (停止エラーはクライアント側で処理)
          throw error;
        }
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30日間 (ログイン状態保持用)
    // セッション更新間隔を短くしてセキュリティを強化
    updateAge: 24 * 60 * 60, // 24時間ごとに更新
  },
  
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true, // XSS対策: JavaScriptからアクセス不可
        sameSite: 'strict', // CSRF対策強化: strictに変更（laxから）
        path: '/',
        secure: process.env.NODE_ENV === 'production', // HTTPSのみ（本番環境）
        // maxAgeは動的に設定できないため、デフォルトで30日間
        maxAge: 30 * 24 * 60 * 60, // 30日間
      },
    },
    callbackUrl: {
      name: `next-auth.callback-url`,
      options: {
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    csrfToken: {
      name: `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        const { email, name, image } = user;
  
        if (!email) {
          return false;
        }
        
        // 修正2: 'let' を 'const' に変更しました (ESLint prefer-constルール対応)
        const prisma = await getPrismaInstance();
        const dbUser = await prisma.users.findUnique({ 
          where: { email } 
        });

        if (!dbUser) {
          let newNickname = name || `user_${randomBytes(4).toString('hex')}`;
          
          const existingUserWithNickname = await prisma.users.findUnique({ where: { nickname: newNickname } });
          
          if (existingUserWithNickname) {
            newNickname = `${newNickname}_${randomBytes(4).toString('hex')}`;
          }

          await prisma.users.create({
            data: {
              email,
              name: name || "New User",
              nickname: newNickname,
              image_url: image,
              emailVerified: new Date(),
            },
          });
        } else {
          // ▼▼▼【新機能】OAuth ログイン時の停止チェック ▼▼▼
          if (dbUser.suspendedUntil) {
            const now = new Date();
            if (dbUser.suspendedUntil > now) {
              console.log(`OAuth認証失敗: ユーザー ${dbUser.email} は停止中です (期限: ${dbUser.suspendedUntil})`);
              // 停止中の場合は false を返してログインを拒否
              // URL リダイレクトは NextAuth のエラーハンドリングで処理
              return false;
            }
          }
          // ▲▲▲ 停止チェック完了 ▲▲▲
        }
        return true;
      }
      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        const prisma = await getPrismaInstance();
        const dbUser = await prisma.users.findUnique({
          where: { id: parseInt(user.id, 10) },
        });
        if (dbUser) {
            token.nickname = dbUser.nickname;
            token.role = dbUser.role;
        }
      }
      // remember me 정보는 user 객체에서 전달받을 수 없으므로,
      // 클라이언트에서 쿠키를 직접 설정하는 방식 사용
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        // トークンからユーザー情報を取得
        session.user.id = token.id;
        session.user.nickname = token.nickname;
        session.user.role = token.role;
        session.user.name = token.nickname as string;

        // ユーザーがまだデータベースに存在するか確認（削除済みアカウント対策）
        try {
          const prisma = await getPrismaInstance();
          const dbUser = await prisma.users.findUnique({
            where: { id: parseInt(token.id as string, 10) },
          });

          if (!dbUser) {
            console.log(`セッションエラー: ユーザー ID ${token.id} が存在しません（削除済み）`);
            // ユーザーが存在しない場合、セッションを無効化
            return null as unknown as typeof session;
          }

          // 最新のユーザー情報でセッションを更新
          session.user.name = dbUser.nickname;
          session.user.nickname = dbUser.nickname;
          session.user.role = dbUser.role;
          session.user.image = dbUser.image_url || undefined;
        } catch (error) {
          console.error('セッション取得中にエラーが発生しました:', error);
        }
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },
  
  secret: process.env.NEXTAUTH_SECRET,
};

// 환경 변수 검증 실행 (모듈 로드 시 즉시 실행)
validateAuthEnv();
