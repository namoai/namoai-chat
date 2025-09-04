import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { NextAuthOptions, DefaultSession } from "next-auth"; // DefaultSessionをインポート
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import { compare } from "bcrypt";

// NextAuthの型定義を拡張して、セッションにカスタムプロパティを追加します。
declare module "next-auth" {
    /**
     * Session interfaceを拡張し、userオブジェクトにカスタムプロパティを追加します。
     * これにより、useSession()などで型安全にアクセスできるようになります。
     */
    interface Session {
        // userオブジェクトの型を、デフォルト型とカスタムプロパティを結合した形に上書きします。
        user: {
            id: string;
            nickname: string;
            role: string;
        } & DefaultSession["user"]; // DefaultSession['user'] は { name, email, image } を含みます。
    }

    /**
     * User interfaceを拡張し、authorizeコールバックやDBから返されるUserモデルに
     * カスタムプロパティを追加します。
     */
    interface User {
        nickname: string;
        role: string;
    }
}

declare module "next-auth/jwt" {
    /**
     * JWT interfaceを拡張し、カスタムプロパティを追加します。
     * これにより、jwtコールバックで型安全に扱えます。
     */
    interface JWT {
        id: string;
        nickname: string;
        role: string;
    }
}

// 認証オプション：NextAuthの設定を定義します。
// この'authOptions'がAPIルートで必要になります。
export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma),
    secret: process.env.NEXTAUTH_SECRET,
    session: {
        strategy: 'jwt'
    },
    pages: {
        signIn: '/login', // ログインページのパス
    },
    providers: [
        // ここではメールとパスワードによる認証（CredentialsProvider）を設定しています。
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            // ▼▼▼【修正】サーバーエラーを防ぐため、try...catchブロックを追加しました。▼▼▼
            async authorize(credentials) {
                try {
                    // 認証ロジック
                    if (!credentials?.email || !credentials.password) {
                        console.error("認証情報が不足しています。");
                        return null;
                    }

                    const existingUser = await prisma.users.findUnique({
                        where: { email: credentials.email }
                    });

                    if (!existingUser || !existingUser.password) {
                        console.error("ユーザーが存在しないか、パスワードが設定されていません。");
                        return null;
                    }

                    // パスワードの比較（bcryptを使用）
                    const passwordMatch = await compare(credentials.password, existingUser.password);

                    if (!passwordMatch) {
                        console.error("パスワードが一致しません。");
                        return null;
                    }

                    // 認証が成功した場合、NextAuthにユーザー情報を返します。
                    return {
                        id: `${existingUser.id}`,
                        name: existingUser.name,
                        nickname: existingUser.nickname,
                        email: existingUser.email,
                        role: existingUser.role,
                        image: existingUser.image_url,
                    }
                } catch (error) {
                    // 予期せぬエラーが発生した場合の処理
                    console.error("Authorize関数でエラーが発生しました:", error);
                    return null; // エラーが発生した場合はnullを返し、認証失敗とします。
                }
            }
            // ▲▲▲ 修正完了 ▲▲▲
        })
    ],
    callbacks: {
        // JWTトークンにユーザー情報を追加
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.nickname = user.nickname;
                token.role = user.role;
            }
            return token
        },
        // セッションオブジェクトにJWTの情報を反映
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id;
                session.user.nickname = token.nickname;
                session.user.role = token.role;
            }
            return session;
        },
    }
}

