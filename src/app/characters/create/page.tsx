"use client";

import CharacterForm from "@/components/CharacterForm";
import { useSession } from "next-auth/react";

export default function CharacterCreatePage() {
  const { data: session, status } = useSession();

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