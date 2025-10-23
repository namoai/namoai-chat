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
    <header className="flex items-center justify-between p-3 border-b border-gray-700 bg-black/50 backdrop-blur-sm sticky top-0 z-10">
      {/* 戻るボタン */}
      <button
        onClick={onBack}
        className="p-2 hover:bg-gray-700 rounded-full"
        aria-label="戻る"
      >
        <ArrowLeft size={24} />
      </button>

      {/* キャラクター詳細リンク */}
      <Link
        href={`/characters/${characterId}`}
        className="flex flex-col items-center"
        aria-label={`${displayName}の詳細`}
      >
        <div className="relative w-10 h-10 rounded-full overflow-hidden">
          {/* alt のコメントを行外に移動して JSX パースエラー回避 */}
          <Image
            src={avatarSrc}
            alt={displayName}
            fill
            className="object-cover"
            sizes="40px"
          />
        </div>
        <span className="text-sm font-semibold mt-1">{displayName}</span>
      </Link>

      {/* 設定ボタン */}
      <button
        onClick={onOpenSettings}
        className="p-2 hover:bg-gray-700 rounded-full"
        aria-label="設定を開く"
      >
        <Menu size={24} />
      </button>
    </header>
  );
};

export default ChatHeader;