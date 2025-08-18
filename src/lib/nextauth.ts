import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from '@/lib/prisma';
import bcrypt from "bcrypt";

// NextAuthの設定をオブジェクトとして定義し、エクスポートします。
// これにより、他のサーバーサイドのファイルでこの設定を再利用できます。
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
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

        if (!user) {
          throw new Error("登録されていないユーザーです。");
        }

        // user.password가 null이 아닌 경우에만 bcrypt.compare를 호출합니다.
        if (!user.password) {
            throw new Error("このアカウントはパスワードでログインできません。");
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
          role: user.role, // ✨ ユーザーの役割(role)を返すように追加
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    // ✅ このjwtコールバックを修正しました
    async jwt({ token, user }) {
      // 1. 初回サインイン時（userオブジェクトが存在する場合）
      if (user) {
        token.id = user.id;
        token.nickname = user.nickname;
        token.role = user.role;
        return token;
      }

      // 2. 既存のセッションで、トークンにrole情報がない場合 (例: Googleログイン後など)
      //    DBからユーザー情報を取得してトークンに追加します。
      if (!token.role) {
        const dbUser = await prisma.users.findUnique({
          where: { id: parseInt(token.id, 10) }, // token.idは文字列なので数値に変換
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.nickname = dbUser.nickname;
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      // セッションオブジェクトのユーザー情報に、トークンの情報を反映
      if (session.user) {
        session.user.id = token.id;
        session.user.nickname = token.nickname;
        session.user.role = token.role; // ✨ セッションに役割(role)情報を追加
        session.user.name = token.nickname as string; // 表示名をニックネームに設定
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

// 定義した設定オブジェクトを使ってNextAuthを初期化します
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
