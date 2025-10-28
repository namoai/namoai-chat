import { PrismaAdapter } from "@next-auth/prisma-adapter";
// 修正1: 未使用の 'NextAuth' のインポートを削除しました。
import { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from '@/lib/prisma';
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { randomBytes } from 'crypto';

// PrismaAdapterが期待するモデル名(user, accountなど)と、
// 実際のスキーマのモデル名(users, sessionsなど)の不一致を解決するためのプロキシオブジェクトを作成します。
const adapterPrisma = {
  ...prisma,
  user: prisma.users,
  account: prisma.account,
  session: prisma.session,
  verificationToken: prisma.verificationToken,
} as unknown as PrismaClient;


// NextAuthの設定をオブジェクトとして定義し、エクスポートします。
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(adapterPrisma),

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
  },

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        const { email, name, image } = user;
  
        if (!email) {
          return false;
        }
        
        // 修正2: 'let' を 'const' に変更しました (ESLint prefer-constルール対応)
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
              // 停止情報をURLパラメータとして返す
              return `/suspended?reason=${encodeURIComponent(dbUser.suspensionReason || '不明な理由')}&until=${dbUser.suspendedUntil.toISOString()}`;
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
        const dbUser = await prisma.users.findUnique({
          where: { id: parseInt(user.id, 10) },
        });
        if (dbUser) {
            token.nickname = dbUser.nickname;
            token.role = dbUser.role;
        }
      }
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
          const dbUser = await prisma.users.findUnique({
            where: { id: parseInt(token.id as string, 10) },
          });

          if (!dbUser) {
            console.log(`セッションエラー: ユーザー ID ${token.id} が存在しません（削除済み）`);
            // ユーザーが存在しない場合、セッションを無効化
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return {} as any;
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

