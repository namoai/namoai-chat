"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import CharacterForm from "@/components/CharacterForm"; // パスが異なる場合は修正してください。
import { Role } from "@prisma/client"; // Role Enumをインポート

export default function CharacterEditPage() {
  const router = useRouter();
  const params = useParams();
  const { data: session, status } = useSession(); // sessionデータも取得
  const characterId = params.id as string;

  const [initialData, setInitialData] = useState<any>(null); // 型をanyに設定、または適切な型定義を推奨
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCharacterData = useCallback(async () => {
    if (!characterId || !session?.user) return; // sessionの存在も確認
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

      // ▼▼▼【重要】権限チェックロジックを追加 ▼▼▼
      const currentUser = session.user as any; // session.userの型を拡張した場合、anyは不要
      const isOwner = data.author_id === parseInt(currentUser.id, 10);
      const hasAdminPermission = currentUser.role === Role.CHAR_MANAGER || currentUser.role === Role.SUPER_ADMIN;

      if (!isOwner && !hasAdminPermission) {
        // 権限がない場合はエラーを設定
        setError("このキャラクターを編集する権限がありません。");
        setInitialData(null); // データは保持しない
      } else {
        // 権限がある場合のみデータをセット
        setInitialData(data);
      }
      // ▲▲▲ ここまで ▲▲▲

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "不明なエラーが発生しました。");
    } finally {
      setLoading(false);
    }
  }, [characterId, session]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchCharacterData();
    } else if (status === "unauthenticated") {
      router.push("/login"); // 日本語サイトに合わせて /login など適切なパスに変更
    }
  }, [status, fetchCharacterData, router]);

  if (loading || status === "loading") {
    return (
      <div className="min-h-screen bg-black text-white flex justify-center items-center">
        <p>ローディング中...</p>
      </div>
    );
  }

  if (error) {
    return (
        <div className="min-h-screen bg-black text-white flex flex-col justify-center items-center">
            <p className="text-red-500 mb-4">{error}</p>
            <button onClick={() => router.push('/MyPage')} className="text-pink-400 hover:underline">
                マイページに戻る
            </button>
        </div>
    );
  }

  // initialDataが存在し、かつエラーがない場合にのみフォームを表示
  if (initialData) {
    return <CharacterForm isEditMode={true} initialData={initialData} />;
  }
  
  // initialDataがなく、エラーも表示された後、ここに到達することがある
  return null;
}