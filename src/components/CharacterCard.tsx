"use client";

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

type Character = {
  id: number;
  name: string;
  description: string | null;
  characterImages: { imageUrl: string }[];
};

type CharacterCardProps = {
  character: Character;
};

export default function CharacterCard({ character }: CharacterCardProps) {
  const [imageError, setImageError] = useState(false);
  const originalSrc = character.characterImages[0]?.imageUrl;
  const placeholderSrc = 'https://placehold.co/300x400/1a1a1a/ffffff?text=?';
  const src = imageError || !originalSrc ? placeholderSrc : originalSrc;
  
  return (
    <Link href={`/characters/${character.id}`} className="group">
      <div className="flex-shrink-0 w-40 space-y-2 cursor-pointer">
        <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden bg-gradient-to-br from-gray-900 to-gray-800">
          <Image
            src={src}
            alt={character.name}
            fill
            className="object-cover group-hover:scale-110 transition-transform duration-500"
            onError={() => setImageError(true)}
          />
          {/* ホバー時のグラデーションオーバーレイ */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 via-cyan-500/0 to-blue-500/0 group-hover:from-blue-500/20 group-hover:via-cyan-500/10 group-hover:to-blue-500/20 transition-all duration-500" />
        </div>
        <h3 className="font-semibold text-white truncate group-hover:text-blue-400 transition-colors">
          {character.name}
        </h3>
        <p className="text-xs text-gray-400 truncate h-8">
          {character.description}
        </p>
      </div>
    </Link>
  );
}
