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
  return (
    <Link href={`/characters/${character.id}`}>
      <div className="flex-shrink-0 w-40 space-y-2 cursor-pointer">
        <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden">
          {/* ▼▼▼ 変更点: 基本キャラクター画像を追加 ▼▼▼ */}
          <Image
            src={character.characterImages[0]?.imageUrl || 'https://placehold.co/300x400/1a1a1a/ffffff?text=?'}
            alt={character.name}
            fill
            className="object-cover"
          />
        </div>
        <h3 className="font-semibold text-white truncate">{character.name}</h3>
        <p className="text-xs text-gray-400 truncate h-8">
          {character.description}
        </p>
      </div>
    </Link>
  );
}
