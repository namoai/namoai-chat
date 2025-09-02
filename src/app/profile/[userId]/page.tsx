"use client";

/**
 * プロフィールページ（クライアントコンポーネント）
 * - 重要: React Hooks は「常に最上位で」呼び出す（条件分岐で囲まない）
 * - 分岐は useEffect の「内部」で行う（userId 未定義などの早期 return は effect 内）
 * - ESLint: no-explicit-any を満たすため、catch は unknown で受けて安全にメッセージ抽出
 * - 画像は next/image を使用（外部ドメインは next.config.ts の images.remotePatterns で許可）
 */

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  MoreVertical,
  Heart,
  MessageSquare,
  KeyRound,
  Mail,
  X,
  User,
} from "lucide-react";

/** API 応答の型 */
type ProfileData = {
  id: number;
  name: string;
  nickname: string;
  email: string;
  image_url: string | null;
  bio: string | null;
  totalMessageCount: number;
  characters: {
    id: number;
    name: string;
    characterImages: { imageUrl: string }[];
    _count: { favorites: number; chat: number };
  }[];
  _count: { followers: number; following: number };
};

/** パスワード変更用の型 */
type PasswordPayload = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

/** エラーメッセージ抽出ユーティリティ（unknown → string） */
const toErrorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : typeof e === "string" ? e : "不明なエラーが発生しました。";

/** 汎用モーダル */
const CustomModal = ({
  isOpen,
  onClose,
  title,
  message,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
      <div className="w-full max-w-sm mx-4 rounded-lg bg-gray-800 text-white p-6">
        <h2 className="text-lg font-bold mb-3">{title}</h2>
        <p className="text-sm text-gray-300 mb-6">{message}</p>
        <div className="text-right">
          <button
            onClick={onClose}
            className="rounded-lg bg-pink-600 hover:bg-pink-700 px-4 py-2"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

/** デフォルトアバター（画像未設定時の疑似アイコン） */
const DefaultAvatarIcon = ({ size = 80 }: { size?: number }) => (
  <div
    className="rounded-full bg-gray-700 flex items-center justify-center"
    style={{ width: size, height: size }}
  >
    <User size={size * 0.6} className="text-gray-400" />
  </div>
);

/** パスワード変更モーダル（内部の Hook は最上位で呼ばれるためルールに適合） */
const PasswordChangeModal = ({
  isOpen,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: PasswordPayload) => Promise<void>;
}) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  // モーダルを開く度にフィールド初期化
  useEffect(() => {
    if (isOpen) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    await onSave({ currentPassword, newPassword, confirmPassword });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
      <div className="w-full max-w-sm mx-4 rounded-lg bg-gray-800 text-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">パスワード変更</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-700"
          >
            <X size={22} />
          </button>
        </div>

        <div className="space-y-3">
          <input
            type="password"
            placeholder="現在のパスワード"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full bg-gray-700 rounded-md p-2 focus:ring-pink-500 focus:border-pink-500"
          />
          <input
            type="password"
            placeholder="新しいパスワード"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full bg-gray-700 rounded-md p-2 focus:ring-pink-500 focus:border-pink-500"
          />
          <input
            type="password"
            placeholder="新しいパスワード（確認）"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full bg-gray-700 rounded-md p-2 focus:ring-pink-500 focus:border-pink-500"
          />
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="border border-gray-600 hover:bg-gray-700 rounded-lg px-4 py-2"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-pink-600 hover:bg-pink-700 disabled:bg-pink-800 px-4 py-2"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * App Router ではクライアントコンポーネントでも params を引数で受け取れる。
 * これにより useParams() を避け、Hook を条件で呼ぶ状況を作らない。
 */
export default function ProfilePage({
  params,
}: {
  params: { userId?: string };
}) {
  const router = useRouter();
  const { data: session } = useSession();

  // Hook は「常に」最上位で宣言（条件で囲まない）
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [pwdModalOpen, setPwdModalOpen] = useState<boolean>(false);
  const [modal, setModal] = useState<{ isOpen: boolean; title: string; message: string }>({
    isOpen: false,
    title: "",
    message: "",
  });
  const menuRef = useRef<HTMLDivElement>(null);

  // データ取得（useEffect 自体は無条件で呼ぶ。内部で userId を検証）
  useEffect(() => {
    const userId = params?.userId;
    if (!userId) {
      setProfile(null);
      setLoading(false);
      setModal({
        isOpen: true,
        title: "エラー",
        message: "ユーザーIDが不正です。",
      });
      return;
    }

    let aborted = false;

    (async () => {
      try {
        setLoading(true);
        setModal((m) => ({ ...m, isOpen: false }));
        const res = await fetch(`/api/profile/${userId}`, { cache: "no-store" });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error || "プロファイルの読み込みに失敗しました。");
        }
        const data = (await res.json()) as ProfileData;
        if (!aborted) setProfile(data);
      } catch (e: unknown) {
        const msg = toErrorMessage(e);
        if (!aborted)
          setModal({
            isOpen: true,
            title: "エラー",
            message: msg,
          });
      } finally {
        if (!aborted) setLoading(false);
      }
    })();

    return () => {
      aborted = true;
    };
  }, [params?.userId]);

  // メニューの外側クリックで閉じる
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const isMyProfile =
    !!session?.user?.id && !!profile?.id && session.user.id === String(profile.id);

  const closeModal = () => setModal((m) => ({ ...m, isOpen: false }));

  const handlePasswordChange = async ({
    currentPassword,
    newPassword,
    confirmPassword,
  }: PasswordPayload) => {
    if (newPassword !== confirmPassword) {
      setModal({
        isOpen: true,
        title: "エラー",
        message: "新しいパスワードが一致しません。",
      });
      return;
    }
    try {
      const res = await fetch("/api/users/change-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error || "パスワードの変更に失敗しました。");
      setPwdModalOpen(false);
      setModal({ isOpen: true, title: "成功", message: "パスワードを更新しました。" });
    } catch (e: unknown) {
      const msg = toErrorMessage(e);
      setModal({
        isOpen: true,
        title: "エラー",
        message: msg,
      });
    }
  };

  const fmt = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  };

  // 表示部
  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        ローディング中...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        プロファイルが見つかりません。
      </div>
    );
  }

  return (
    <>
      <CustomModal
        isOpen={modal.isOpen}
        onClose={closeModal}
        title={modal.title}
        message={modal.message}
      />
      <PasswordChangeModal
        isOpen={pwdModalOpen}
        onClose={() => setPwdModalOpen(false)}
        onSave={handlePasswordChange}
      />

      <div className="bg-black min-h-screen text-white">
        <div className="mx-auto max-w-3xl">
          {/* ヘッダー */}
          <header className="sticky top-0 z-10 flex items-center justify-between p-4 bg-black/80 backdrop-blur-sm">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-full hover:bg-gray-800"
              aria-label="戻る"
            >
              <ArrowLeft />
            </button>
            <h1 className="font-bold text-lg">マイプロフィール</h1>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="p-2 rounded-full hover:bg-gray-800"
                aria-label="メニュー"
              >
                <MoreVertical />
              </button>
              {menuOpen && isMyProfile && (
                <div className="absolute right-0 mt-2 w-64 bg-[#2C2C2E] border border-gray-700 rounded-lg shadow-lg z-20">
                  <div className="p-4 border-b border-gray-700">
                    <p className="text-sm text-gray-400 flex items-center gap-2">
                      <Mail size={14} /> {profile.email}
                    </p>
                  </div>
                  <ul>
                    <li>
                      <button
                        onClick={() => {
                          setPwdModalOpen(true);
                          setMenuOpen(false);
                        }}
                        className="w-full text-left flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-gray-700"
                      >
                        <KeyRound size={16} /> パスワード変更
                      </button>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </header>

          {/* 本文 */}
          <main className="p-4">
            <section className="flex items中心 gap-4 mb-4">
              {profile.image_url ? (
                <Image
                  src={profile.image_url}
                  alt={profile.nickname}
                  width={80}
                  height={80}
                  className="rounded-full object-cover"
                />
              ) : (
                <DefaultAvatarIcon size={80} />
              )}
              <div>
                <h2 className="text-2xl font-bold">{profile.nickname}</h2>
                <div className="flex gap-4 text-sm text-gray-400">
                  <span>フォロワー {profile._count.followers}</span>
                  <span>フォロー {profile._count.following}</span>
                </div>
              </div>
            </section>

            <p className="text-gray-300 mb-4">
              {profile.bio || "自己紹介がありません。"}
            </p>

            {isMyProfile && (
              <Link
                href="/profile-edit"
                className="block w-full text-center rounded-lg bg-gray-800 hover:bg-gray-700 font-semibold py-2 mb-6"
              >
                プロフィール編集
              </Link>
            )}

            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">
                  {profile.characters.length}個のキャラクター | 会話量{" "}
                  {fmt(profile.totalMessageCount)}
                </h3>
                <span className="text-sm text-gray-400">会話量順</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {profile.characters.map((c) => (
                  <Link href={`/characters/${c.id}`} key={c.id} className="block group">
                    <div className="bg-[#1C1C1E] rounded-lg overflow-hidden transition-transform group-hover:scale-[1.02]">
                      <div className="relative aspect-[3/4]">
                        <Image
                          src={
                            c.characterImages[0]?.imageUrl ||
                            "https://placehold.co/300x400/1a1a1a/ffffff?text=?"
                          }
                          alt={c.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="p-3">
                        <h4 className="font-semibold truncate">{c.name}</h4>
                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                          <span className="flex items-center gap-1">
                            <Heart size={12} /> {c._count.favorites}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare size={12} /> {c._count.chat}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </main>
        </div>
      </div>
    </>
  );
}