"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import CharacterForm from "../../../../components/CharacterForm";
import { Role } from "@prisma/client";
import { User } from "next-auth"; 

type Visibility = "public" | "link" | "private";

type CharacterData = {
  id: number;
  name: string;
  description: string | null;
  systemTemplate: string | null;
  firstSituation: string | null;
  firstMessage: string | null;
  visibility: Visibility | null;
  safetyFilter: boolean | null;
  category: string | null;
  hashtags: string[];
  detailSetting: string | null;
  statusWindowPrompt: string | null;
  statusWindowDescription: string | null;
  author_id: number | null;
  characterImages: { id: number; imageUrl: string; keyword: string | null }[];
  lorebooks: { id: number; content: string; keywords: string[] }[];
};

interface AppUser extends User {
  id: string;
  role: Role;
}

export default function CharacterEditPage() {
  const router = useRouter();
  const params = useParams();
  const { data: session, status } = useSession();
  const characterId = params.id as string;

  const [initialData, setInitialData] = useState<CharacterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCharacterData = useCallback(async () => {
    if (!characterId || !session?.user) return;
    // ▼▼▼【最適化】既にデータがある場合は再取得しない（ページ遷移時の強制リロード防止） ▼▼▼
    if (initialData) {
      console.log('[CharacterEditPage] データは既に存在するため、再取得をスキップします');
      return;
    }
    // ▲▲▲
    try {
      setLoading(true);
      const response = await fetch(`/api/characters/${characterId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("指定されたキャラクターが見つかりません。");
        }
        throw new Error("キャラクターデータの読み込みに失敗しました。");
      }
      const data = await response.json();

      const currentUser = session.user as AppUser;
      const isOwner = data.author_id === parseInt(currentUser.id, 10);
      const hasAdminPermission =
        currentUser.role === Role.CHAR_MANAGER ||
        currentUser.role === Role.SUPER_ADMIN;

      if (!isOwner && !hasAdminPermission) {
        setError("このキャラクターを編集する権限がありません。");
        setInitialData(null);
      } else {
        setInitialData(data);
      }
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "不明なエラーが発生しました。"
      );
    } finally {
      setLoading(false);
    }
  }, [characterId, session, initialData]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchCharacterData();
    } else if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, fetchCharacterData, router]);

  if (loading || status === "loading") {
    return (
      <div className="min-h-screen bg-black text-white flex justify-center items-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-pink-500/30 border-t-pink-500 rounded-full animate-spin" />
          <p className="text-gray-400">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col justify-center items-center">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={() => router.push("/MyPage")}
          className="text-pink-400 hover:underline"
        >
          マイページに戻る
        </button>
      </div>
    );
  }

  if (initialData) {
    const formCompatibleData = {
      ...initialData,
      id: initialData.id.toString(),
      description: initialData.description ?? undefined,
      systemTemplate: initialData.systemTemplate ?? undefined,
      firstSituation: initialData.firstSituation ?? undefined,
      firstMessage: initialData.firstMessage ?? undefined,
      visibility: (initialData.visibility ?? undefined) as
        | Visibility
        | undefined,
      safetyFilter: initialData.safetyFilter ?? undefined,
      category: initialData.category ?? undefined,
      detailSetting: initialData.detailSetting ?? undefined,
      statusWindowPrompt: initialData.statusWindowPrompt ?? undefined,
      statusWindowDescription: initialData.statusWindowDescription ?? undefined,
    };

    return (
      <CharacterForm
        isEditMode={true}
        initialData={formCompatibleData}
        session={session}
        status={status}
      />
    );
  }

  return null;
}