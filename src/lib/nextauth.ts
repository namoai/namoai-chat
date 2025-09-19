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
        if (!credentials?.email || !credentials?.password) {
          throw new Error("メールアドレスとパスワードを入力してください。");
        }

        const user = await prisma.users.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) {
          throw new Error("登録されていないか、パスワードでのログインが許可されていません。");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          throw new Error("パスワードが正しくありません。");
        }

        return {
          id: user.id.toString(),
          email: user.email,
          name: user.name,
          nickname: user.nickname,
          role: user.role,
        };
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
        session.user.id = token.id;
        session.user.nickname = token.nickname;
        session.user.role = token.role;
        session.user.name = token.nickname as string;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },
  
  secret: process.env.NEXTAUTH_SECRET,
};

