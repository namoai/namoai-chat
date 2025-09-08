"use client";

import CharacterForm from "@/components/CharacterForm";
import { useSession } from "next-auth/react";

export default function CharacterCreatePage() {
  const { data: session, status } = useSession();

  return (
    <CharacterForm
      isEditMode={false}
      session={session}
      status={status}
    />
  );
}