"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fetchWithCsrf } from "@/lib/csrf-client";

type FormState = {
  nickname: string;
  phone: string;
  birthdate: string;
  ageConfirmation: "adult" | "minor";
};

export default function CompleteProfilePage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    nickname: "",
    phone: "",
    birthdate: "",
    ageConfirmation: "adult",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/users/complete-profile", {
          cache: "no-store",
          credentials: "include", // 쿠키가 확실히 전송되도록 명시
        });
        if (res.status === 401) {
          router.replace(`/login?callbackUrl=/complete-profile`);
          return;
        }
        if (!res.ok) throw new Error("プロフィール情報の取得に失敗しました。");
        const data = await res.json();
        setForm({
          nickname: data.nickname || "",
          phone: data.phone || "",
          birthdate: data.birthdate || "",
          ageConfirmation: data.ageConfirmation || "adult",
        });
      } catch (e: any) {
        setError(e.message || "エラーが発生しました。");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetchWithCsrf("/api/users/complete-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "保存に失敗しました。");
      }
      alert("プロフィールを更新しました。");
      router.replace("/");
    } catch (e: any) {
      setError(e.message || "エラーが発生しました。");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <p>読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-xl mx-auto px-4 py-10 space-y-6">
        <h1 className="text-2xl font-bold">追加情報の入力</h1>
        <p className="text-sm text-gray-400">
          Googleで登録した方は、ニックネーム・電話番号・年齢確認を入力してください。
        </p>

        <div className="space-y-4 bg-gray-900/60 border border-gray-800 rounded-2xl p-6">
          <div className="space-y-2">
            <label className="text-sm text-gray-300">ニックネーム (2〜12文字)</label>
            <Input
              value={form.nickname}
              onChange={(e) => handleChange("nickname", e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white"
              maxLength={12}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-300">電話番号</label>
            <Input
              value={form.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white"
              placeholder="070-1234-5678"
            />
            <p className="text-xs text-gray-500">数字・ハイフン・括弧・+・スペースのみ利用可</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-300">生年月日 (任意)</label>
            <Input
              type="date"
              value={form.birthdate}
              onChange={(e) => handleChange("birthdate", e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white"
            />
            <p className="text-xs text-gray-500">入力すると年齢を自動判定します。</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-300">年齢区分</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: "adult", label: "18歳以上" },
                { value: "minor", label: "18歳未満" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleChange("ageConfirmation", opt.value as "adult" | "minor")}
                  className={`border rounded-xl p-3 text-sm font-semibold transition-all ${
                    form.ageConfirmation === opt.value
                      ? "border-pink-500 bg-pink-500/10 text-pink-100"
                      : "border-gray-700 bg-gray-800/50 text-gray-300 hover:border-pink-500/60"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <Button
            disabled={saving}
            onClick={handleSubmit}
            className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold py-3 rounded-xl transition-all"
          >
            {saving ? "保存中..." : "保存して続行"}
          </Button>
        </div>
      </div>
    </div>
  );
}

