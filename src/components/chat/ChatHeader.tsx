// src/components/chat/ChatHeader.tsx
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Menu } from 'lucide-react';
import type { CharacterInfo } from '@/types/chat'; // 型定義は別途ファイルにまとめることを推奨

interface ChatHeaderProps {
  characterId: string;
  characterInfo: CharacterInfo;
  onBack: () => void;
  onOpenSettings: () => void;
}

/**
 * チャット画面のヘッダーUIコンポーネント
 */
const ChatHeader: React.FC<ChatHeaderProps> = ({ characterId, characterInfo, onBack, onOpenSettings }) => {
  return (
    <header className="flex items-center justify-between p-3 border-b border-gray-700 bg-black/50 backdrop-blur-sm sticky top-0 z-10">
      <button onClick={onBack} className="p-2 hover:bg-gray-700 rounded-full">
        <ArrowLeft size={24} />
      </button>
      <Link href={`/characters/${characterId}`} className="flex flex-col items-center">
        <div className="relative w-10 h-10 rounded-full overflow-hidden">
          <Image
            src={characterInfo.characterImages[0]?.imageUrl || "/default-avatar.png"}
            alt={characterInfo.name}
            fill
            className="object-cover"
          />
        </div>
        <span className="text-sm font-semibold mt-1">{characterInfo.name}</span>
      </Link>
      <button onClick={onOpenSettings} className="p-2 hover:bg-gray-700 rounded-full">
        <Menu size={24} />
      </button>
    </header>
  );
};

export default ChatHeader;
