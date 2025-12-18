"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { User, Phone, Smile, Calendar, Mail } from "lucide-react";
import { fetchWithCsrf } from "@/lib/csrf-client";

type FormState = {
  name: string;
  nickname: string;
  phone: string;
  birthdate: string;
};

export default function GoogleSignUpPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [form, setForm] = useState<FormState>({
    name: "",
    nickname: "",
    phone: "",
    birthdate: "",
  });

  // 約款同意
  const [agreed, setAgreed] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [agreedAge13, setAgreedAge13] = useState(false);
  const [agreedParental, setAgreedParental] = useState(false);

  // セッション確認とGoogleアカウント情報取得
  useEffect(() => {
    if (status === "loading") return;
    
    if (status === "unauthenticated") {
      // Googleログインしていない場合はログインページへ
      router.replace("/login?provider=google");
      return;
    }

    if (session?.user) {
      // Googleアカウントから取得できる情報を設定
      setForm((prev) => ({
        ...prev,
        name: session.user.name || "",
        nickname: session.user.name?.split(" ")[0] || "",
      }));
      setLoading(false);
    }
  }, [session, status, router]);

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    // バリデーション
    if (!form.name.trim()) {
      setError("氏名を入力してください。");
      return;
    }
    if (!form.nickname.trim() || form.nickname.length < 2 || form.nickname.length > 12) {
      setError("ニックネームは2〜12文字で入力してください。");
      return;
    }
    if (!form.phone.trim()) {
      setError("電話番号を入力してください。");
      return;
    }
    
    // 約款同意チェック
    if (!agreed) {
      setError("利用規約に同意してください。");
      return;
    }
    if (!agreedPrivacy) {
      setError("プライバシーポリシーに同意してください。");
      return;
    }
    if (!agreedAge13) {
      setError("13歳以上であることを確認してください。");
      return;
    }
    // 生年月日が入力されていて18歳未満の場合のみ保護者同意をチェック
    if (form.birthdate) {
      const birth = new Date(form.birthdate);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      if (age < 18 && !agreedParental) {
        setError("18歳未満の場合、保護者または法定代理人の同意が必要です。");
        return;
      }
    }

    setSaving(true);
    setError(null);
    
    try {
      const res = await fetchWithCsrf("/api/auth/complete-google-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "登録に失敗しました。");
      }
      
      // 登録成功後、セッションを更新してホームページへリダイレクト
      alert("会員登録が完了しました！");
      
      // セッションを更新するためにページをリロード
      // router.replace("/")だとセッションが更新されず、AppShellが再度リダイレクトする可能性がある
      window.location.href = "/";
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "エラーが発生しました。";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <p>読み込み中...</p>
      </div>
    );
  }

  if (!session?.user) {
    return null; // リダイレクト中
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* 背景装飾 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-xl mx-auto px-4 py-10 space-y-6">
        <header className="text-center">
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Googleアカウントで会員登録
          </h1>
          <p className="text-sm text-gray-400 mt-2">
            {session.user.email} でログイン中
          </p>
          <p className="text-sm text-gray-400 mt-1">
            サービスをご利用いただくため、以下の情報を入力してください。
          </p>
        </header>

        <div className="space-y-6 bg-gray-900/50 backdrop-blur-sm border border-gray-800/50 rounded-2xl p-6 md:p-8">
          {/* メールアドレス（表示のみ） */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Mail size={16} className="text-pink-400" />
              メールアドレス
            </label>
            <Input
              value={session.user.email || ""}
              disabled
              className="bg-gray-800/30 border border-gray-700/30 rounded-xl px-4 py-3 text-gray-400 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500">Googleアカウントのメールアドレス（変更不可）</p>
          </div>

          {/* 氏名 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <User size={16} className="text-pink-400" />
              氏名 <span className="text-red-400">*</span>
            </label>
            <Input
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              className="bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all"
              placeholder="例: 山田太郎"
            />
          </div>

          {/* ニックネーム */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Smile size={16} className="text-pink-400" />
              ニックネーム <span className="text-red-400">*</span>
            </label>
            <Input
              value={form.nickname}
              onChange={(e) => handleChange("nickname", e.target.value)}
              className="bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all"
              placeholder="2〜12文字のニックネーム"
              maxLength={12}
            />
          </div>

          {/* 電話番号 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Phone size={16} className="text-pink-400" />
              電話番号 <span className="text-red-400">*</span>
            </label>
            <Input
              value={form.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              className="bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all"
              placeholder="例: 070-1234-5678"
            />
            <p className="text-xs text-gray-500">数字・ハイフン・括弧・+・スペースのみ利用可</p>
          </div>

          {/* 生年月日 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Calendar size={16} className="text-pink-400" />
              生年月日（任意）
            </label>
            <Input
              type="date"
              value={form.birthdate}
              onChange={(e) => handleChange("birthdate", e.target.value)}
              className="bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all"
            />
            <p className="text-xs text-gray-500">入力すると年齢を自動判定します。</p>
          </div>

          {/* 約款同意 */}
          <div className="space-y-4 pt-4 border-t border-gray-700/50">
            <p className="text-sm font-medium text-gray-300">利用規約への同意</p>
            
            {/* 利用規約 */}
            <div className="flex items-start space-x-3">
              <Checkbox
                id="terms"
                checked={agreed}
                onCheckedChange={(v) => setAgreed(!!v)}
                className="mt-1"
              />
              <label htmlFor="terms" className="text-sm text-gray-300 leading-relaxed cursor-pointer">
                利用規約に同意します。<span className="text-red-400">（必須）</span>
              </label>
            </div>

            {/* プライバシーポリシー */}
            <div className="flex items-start space-x-3">
              <Checkbox
                id="privacy"
                checked={agreedPrivacy}
                onCheckedChange={(v) => setAgreedPrivacy(!!v)}
                className="mt-1"
              />
              <label htmlFor="privacy" className="text-sm text-gray-300 leading-relaxed cursor-pointer">
                プライバシーポリシーに同意します。<span className="text-red-400">（必須）</span>
              </label>
            </div>

            {/* 13歳以上 */}
            <div className="flex items-start space-x-3">
              <Checkbox
                id="age13"
                checked={agreedAge13}
                onCheckedChange={(v) => setAgreedAge13(!!v)}
                className="mt-1"
              />
              <label htmlFor="age13" className="text-sm text-gray-300 leading-relaxed cursor-pointer">
                13歳以上です。<span className="text-red-400">（必須）</span>
              </label>
            </div>

            {/* 18歳未満の場合、保護者同意 */}
            {form.birthdate && (() => {
              const birth = new Date(form.birthdate);
              const today = new Date();
              let age = today.getFullYear() - birth.getFullYear();
              const monthDiff = today.getMonth() - birth.getMonth();
              if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
                age--;
              }
              return age < 18;
            })() && (
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="parental"
                  checked={agreedParental}
                  onCheckedChange={(v) => setAgreedParental(!!v)}
                  className="mt-1"
                />
                <label htmlFor="parental" className="text-sm text-gray-300 leading-relaxed cursor-pointer">
                  保護者または法定代理人の同意を得ています。<span className="text-red-400">（必須）</span>
                </label>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <Button
            disabled={saving}
            onClick={handleSubmit}
            className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-pink-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "登録中..." : "会員登録を完了する"}
          </Button>
        </div>
      </div>
    </div>
  );
}

