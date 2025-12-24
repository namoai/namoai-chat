import sanitizeHtml from "sanitize-html";
import { z } from "zod";
import { validatePassword } from "./password-policy";

// パスワード検証用のカスタムZodバリデーション
const passwordSchema = z.string()
  .min(8, "パスワードは8文字以上である必要があります。")
  .max(128, "パスワードは128文字以下である必要があります。")
  .refine((password) => {
    const result = validatePassword(password);
    return result.isValid;
  }, (password) => {
    const result = validatePassword(password);
    return {
      message: result.errors.join(" "),
    };
  });

export const registerSchema = z.object({
  email: z.string().email("正しいメールアドレスを入力してください。"),
  password: passwordSchema,
  name: z.string().min(1, "名前は必須です。").max(100, "名前は100文字以下である必要があります。"),
  phone: z.string().min(5, "電話番号は5文字以上である必要があります。").max(30, "電話番号は30文字以下である必要があります。"),
  nickname: z.string().min(2, "ニックネームは2文字以上である必要があります。").max(50, "ニックネームは50文字以下である必要があります。"),
  birthdate: z
    .string()
    .optional()
    .refine((value) => !value || !isNaN(Date.parse(value)), "生年月日が不正です。"),
  emailVerificationProof: z.string().min(1).optional(),
  referralCode: z.string().length(6).optional(), // 紹介コード (6文字、オプション)
});

// パスワード変更用スキーマ
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "現在のパスワードを入力してください。"),
  newPassword: passwordSchema,
  confirmPassword: z.string().min(1, "確認用パスワードを入力してください。"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "新しいパスワードと確認用パスワードが一致しません。",
  path: ["confirmPassword"],
});

export const sanitizeString = (value: string): string => {
  // HTMLタグのみを除去し、日本語文字を含むすべてのテキストを保持
  return sanitizeHtml(value, {
    allowedTags: [],
    allowedAttributes: {},
    // 日本語文字（ひらがな、カタカナ、漢字）を含むすべてのUnicode文字を許可
    textFilter: (text) => text,
  }).trim();
};

