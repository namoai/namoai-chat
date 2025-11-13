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
 * - `characterInfo.name` が `string | undefined` の場合でも型安全に扱う
 * - alt は必ず string を渡す（Next/Image の型要件）
 */
const ChatHeader: React.FC<ChatHeaderProps> = ({
  characterId,
  characterInfo,
  onBack,
  onOpenSettings,
}) => {
  // --- undefined の場合でも必ず string に確定させる ---
  const displayName: string = characterInfo?.name ?? 'キャラクター';
  const avatarSrc: string =
    characterInfo?.characterImages?.[0]?.imageUrl ?? '/default-avatar.png';

  return (
    <header className="flex items-center justify-between p-4 border-b border-gray-800/50 bg-gray-900/50 backdrop-blur-xl sticky top-0 z-10">
      {/* 戻るボタン */}
      <button
        onClick={onBack}
        className="p-2 rounded-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all"
        aria-label="戻る"
      >
        <ArrowLeft size={24} />
      </button>

      {/* キャラクター詳細リンク */}
      <Link
        href={`/characters/${characterId}`}
        className="flex items-center gap-3 group"
        aria-label={`${displayName}の詳細`}
      >
        <div className="relative w-12 h-12 rounded-xl overflow-hidden ring-2 ring-pink-500/20 group-hover:ring-pink-500/40 transition-all">
          <Image
            src={avatarSrc}
            alt={displayName}
            fill
            className="object-cover"
            sizes="48px"
          />
        </div>
        <span className="text-base font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent group-hover:from-pink-300 group-hover:to-purple-300 transition-all">
          {displayName}
        </span>
      </Link>

      {/* 設定ボタン */}
      <button
        onClick={onOpenSettings}
        className="p-2 rounded-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all"
        aria-label="設定を開く"
      >
        <Menu size={24} />
      </button>
    </header>
  );
};

export default ChatHeader;