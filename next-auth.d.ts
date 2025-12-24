import type { DefaultSession, DefaultUser } from "next-auth";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { JWT, DefaultJWT } from "next-auth/jwt";

declare module "next-auth/jwt" {
  /** JWTの型を拡張 */
  interface JWT extends DefaultJWT {
    id: string;
    nickname: string;
    role: string; // ✨ roleプロパティを追加
    needsProfileCompletion?: boolean;
    referralCode?: string; // 紹介コード
  }
}

declare module "next-auth" {
  /** Sessionのuserオブジェクトの型を拡張 */
  interface Session {
    user: {
      id: string;
      nickname: string;
      role: string; // ✨ roleプロパティを追加
      needsProfileCompletion?: boolean;
      referralCode?: string; // 紹介コード
    } & DefaultSession["user"]; // name, email, imageプロパティは維持
  }

  /** authorizeから返されるUserオブジェクトの型を拡張 */
  interface User extends DefaultUser {
    nickname: string;
    role: string; // ✨ roleプロパティを追加
    referralCode?: string; // 紹介コード
  }
}
