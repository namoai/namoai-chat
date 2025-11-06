"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Lock, User, Phone, Smile, ArrowLeft } from "lucide-react"; // ✅ ボタンアイコンを追加

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
    const passwordRegex = /^.{8,16}$/;
    const nameRegex = /^[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー\s]+$/u;
    const phoneRegex = /^070-\d{4}-\d{4}$/;
    const nicknameRegex = /^.{2,12}$/;

    if (!emailRegex.test(form.email)) {
      alert("正しいメールアドレスを入力してください。");
      return false;
    }
    if (!passwordRegex.test(form.password)) {
      alert("パスワードは8〜16文字で入力してください。");
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
      const response = await fetch("/api/register", {
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
    <div className="min-h-screen bg-black text-white flex flex-col items-center px-4 py-8 relative">
      {/* ✅ ログイン画面に戻るボタンを追加 */}
      <button
        onClick={() => router.back()}
        className="absolute top-4 left-4 text-white bg-pink-500 hover:bg-pink-600 px-4 py-2 rounded-md cursor-pointer flex items-center gap-2"
      >
        <ArrowLeft size={16} />
        ログイン画面へ戻る
      </button>

      <h1 className="text-xl font-semibold mb-6">会員登録</h1>

      <Card className="w-full max-w-md bg-[#1a1a1a]">
        <CardContent className="p-6 space-y-4">
          <p className="text-sm text-white">
            以下の情報を入力して会員登録を完了してください。
          </p>

          <div className="space-y-3">
            {[{
              icon: <Mail size={16} className="text-white" />,
              field: "email",
              placeholder: "例: user@example.com",
            },
            {
              icon: <Lock size={16} className="text-white" />,
              field: "password",
              placeholder: "8〜16文字のパスワード",
              type: "password",
            },
            {
              icon: <User size={16} className="text-white" />,
              field: "name",
              placeholder: "例: 山田太郎",
            },
            {
              icon: <Phone size={16} className="text-white" />,
              field: "phone",
              placeholder: "例: 070-1234-5678",
            },
            {
              icon: <Smile size={16} className="text-white" />,
              field: "nickname",
              placeholder: "2〜12文字のニックネーム",
            }].map(({ icon, field, placeholder, type = "text" }) => (
              <div className="flex items-center gap-2" key={field}>
                {icon}
                <Input
                  type={type}
                  placeholder={placeholder}
                  className="bg-[#333] text-white placeholder-gray-400 border border-gray-600"
                  value={form[field as keyof typeof form]}
                  onChange={(e) => handleChange(field, e.target.value)}
                />
              </div>
            ))}

            <div className="flex items-center space-x-2 mt-4">
              <Checkbox
                id="terms"
                checked={agreed}
                onCheckedChange={(v) => setAgreed(!!v)}
              />
              <label htmlFor="terms" className="text-sm text-white">
                <span
                  className="text-pink-400 underline cursor-pointer"
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
              className="w-full bg-pink-500 hover:bg-pink-600"
            >
              会員登録
            </Button>
          </div>
        </CardContent>
      </Card>

      {showTerms && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white text-black rounded-lg w-11/12 max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold">利用規約</h2>
            <div className="text-sm max-h-64 overflow-y-auto">
              <p>
                本サービスを利用する前に、以下の規約をよくお読みください。利用することで、全ての条項に同意したことになります。
              </p>
              <p>1. 利用者は...</p>
              <p>2. 禁止事項...</p>
              <p>...</p>
            </div>
            <div className="text-right">
              <Button
                onClick={agreeFromPopup}
                className="bg-pink-500 hover:bg-pink-600"
              >
                同意します
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
