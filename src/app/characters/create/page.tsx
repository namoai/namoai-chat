"use client";

import { useState, useEffect } from "react";
import CharacterForm from "@/components/CharacterForm";
import type { Session } from "next-auth";

export default function CharacterCreatePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch("/api/auth/session");
        if (response.ok) {
          const data = await response.json();
          if (data && Object.keys(data).length > 0) {
            setSession(data);
            setStatus("authenticated");
          } else {
            setStatus("unauthenticated");
          }
        } else {
          setStatus("unauthenticated");
        }
      } catch (error) {
        console.error("セッションの取得に失敗しました:", error);
        setStatus("unauthenticated");
      }
    };
    fetchSession();
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-black text-white flex justify-center items-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-pink-500/30 border-t-pink-500 rounded-full animate-spin" />
          <p className="text-gray-400">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <CharacterForm
      isEditMode={false}
      session={session}
      status={status}
    />
  );
}