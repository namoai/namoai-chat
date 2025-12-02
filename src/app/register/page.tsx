"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Lock, User, Phone, Smile, ArrowLeft } from "lucide-react"; // ✅ ボタンアイコンを追加
import { fetchWithCsrf } from "@/lib/csrf-client";

export default function SignUpPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    phone: "",
    nickname: "",
  });

  const [agreed, setAgreed] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validate = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const nameRegex = /^[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー\s]+$/u;
    const phoneRegex = /^070-\d{4}-\d{4}$/;
    const nicknameRegex = /^.{2,12}$/;

    if (!emailRegex.test(form.email)) {
      alert("正しいメールアドレスを入力してください。");
      return false;
    }
    
    // パスワード検証（サーバー側のポリシーと一致）
    if (form.password.length < 8) {
      alert("パスワードは8文字以上である必要があります。");
      return false;
    }
    if (form.password.length > 128) {
      alert("パスワードは128文字以下である必要があります。");
      return false;
    }
    const hasLowercase = /[a-z]/.test(form.password);
    const hasNumber = /[0-9]/.test(form.password);
    const hasSpecialChar = /[^a-zA-Z0-9]/.test(form.password);
    
    if (!hasLowercase) {
      alert("パスワードには小文字（a-z）が含まれる必要があります。");
      return false;
    }
    if (!hasNumber) {
      alert("パスワードには数字（0-9）が含まれる必要があります。");
      return false;
    }
    if (!hasSpecialChar) {
      alert("パスワードには特殊文字（!@#$%^&*など）が含まれる必要があります。");
      return false;
    }
    if (!nameRegex.test(form.name)) {
      alert("氏名はひらがな・カタカナ・漢字のみ使用できます。");
      return false;
    }
    if (!phoneRegex.test(form.phone)) {
      alert("電話番号は070-1234-5678の形式で入力してください。");
      return false;
    }
    if (!nicknameRegex.test(form.nickname)) {
      alert("ニックネームは2〜12文字で入力してください。");
      return false;
    }

    if (!agreed) {
      alert("利用規約に同意してください。");
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      const response = await fetchWithCsrf("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const contentType = response.headers.get("content-type");

      let data: { error?: string; message?: string };
      if (contentType?.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error("⚠ JSON ではない応答:", text);
        alert("サーバーから不明な応答が返されました。");
        return;
      }

      if (!response.ok) {
        alert(data?.error || "登録に失敗しました。");
        return;
      }

      alert("登録成功！ログイン画面へ移動します。");
      // 登録成功後はreplaceを使用して履歴を残さない
      router.replace("/login");
    } catch (error) {
      console.error("通信エラー:", error);
      alert("サーバーエラーが発生しました。");
    }
  };

  const agreeFromPopup = () => {
    setAgreed(true);
    setShowTerms(false);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* 背景装飾 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center px-4 py-8 min-h-screen">
        <header className="w-full max-w-md flex items-center justify-center mb-8 relative">
          <button
            onClick={() => router.back()}
            className="absolute left-0 p-2 rounded-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            会員登録
          </h1>
        </header>

        <div className="w-full max-w-md bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-800/50 p-6 md:p-8 space-y-6">
          <p className="text-gray-300 text-center">
            以下の情報を入力して会員登録を完了してください。
          </p>

          <div className="space-y-4">
            {[{
              icon: <Mail size={18} className="text-pink-400" />,
              label: "メールアドレス",
              field: "email",
              placeholder: "例: user@example.com",
            },
            {
              icon: <Lock size={18} className="text-pink-400" />,
              label: "パスワード",
              field: "password",
              placeholder: "8文字以上（小文字・数字・特殊文字必須）",
              type: "password",
            },
            {
              icon: <User size={18} className="text-pink-400" />,
              label: "氏名",
              field: "name",
              placeholder: "例: 山田太郎",
            },
            {
              icon: <Phone size={18} className="text-pink-400" />,
              label: "電話番号",
              field: "phone",
              placeholder: "例: 070-1234-5678",
            },
            {
              icon: <Smile size={18} className="text-pink-400" />,
              label: "ニックネーム",
              field: "nickname",
              placeholder: "2〜12文字のニックネーム",
            }].map(({ icon, label, field, placeholder, type = "text" }) => (
              <div className="space-y-2" key={field}>
                <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  {icon}
                  {label}
                </label>
                <Input
                  type={type}
                  placeholder={placeholder}
                  className="bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all"
                  value={form[field as keyof typeof form]}
                  onChange={(e) => handleChange(field, e.target.value)}
                />
              </div>
            ))}

            <div className="flex items-start space-x-3 pt-2">
              <Checkbox
                id="terms"
                checked={agreed}
                onCheckedChange={(v) => setAgreed(!!v)}
                className="mt-1"
              />
              <label htmlFor="terms" className="text-sm text-gray-300 leading-relaxed">
                <span
                  className="text-pink-400 hover:text-pink-300 underline cursor-pointer transition-colors"
                  onClick={() => setShowTerms(true)}
                >
                  利用規約
                </span>
                に同意します。
              </label>
            </div>

            <Button
              disabled={!agreed}
              onClick={handleSubmit}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-pink-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              会員登録
            </Button>
          </div>
        </div>

        {showTerms && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900/95 backdrop-blur-xl rounded-2xl w-full max-w-md border border-gray-800/50 p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <h2 className="text-xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                利用規約
              </h2>
              <div className="text-sm text-gray-300 leading-relaxed space-y-2">
                <p>
                  本サービスを利用する前に、以下の規約をよくお読みください。利用することで、全ての条項に同意したことになります。
                </p>
                <p>1. 利用者は...</p>
                <p>2. 禁止事項...</p>
                <p>...</p>
              </div>
              <div className="text-right pt-4">
                <Button
                  onClick={agreeFromPopup}
                  className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold py-2 px-6 rounded-xl transition-all shadow-lg shadow-pink-500/30"
                >
                  同意します
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
