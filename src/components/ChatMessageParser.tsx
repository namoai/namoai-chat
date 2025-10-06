import React, { ReactElement } from 'react';
import Image from 'next/image';

// 型定義
type CharacterImage = {
  imageUrl: string;
  keyword?: string | null;
};

export type ChatMessageParserProps = {
  content: string;
  characterImages: CharacterImage[];
  showImage: boolean;
  isMultiImage: boolean;
  onImageClick?: (url: string) => void;
};

/**
 * 複数のマークダウン形式を検出し、対応するReact要素に変換するコンポーネント
 * - *地文* -> <span className="text-gray-400 italic">...</span> (アスタリスクは表示しない)
 * - 「セリフ」 -> <span className="font-bold text-white">...</span>
 * - ![](URL) -> 外部画像
 * - {img:n} -> 内部画像
 */
export default function ChatMessageParser({
  content,
  characterImages,
  showImage,
  isMultiImage,
  onImageClick,
}: ChatMessageParserProps): ReactElement {
  // 地文(*...*)、セリフ(「...」)、外部リンク画像、内部画像トークンを検出する正規表現
  const regex = /(\*.*?\*)|(「.*?」)|(!\[.*?\]\(.*?\))|(\{img:\d+\})/g;
  const parts = content.split(regex).filter(Boolean);

  // ▼▼▼【修正】単一画像モード（isMultiImageがfalse）の場合のみ、最初の画像以降の表示を制限するためのフラグ ▼▼▼
  let imageRendered = false;

  return (
    <div className="whitespace-pre-wrap leading-relaxed">
      {parts.map((part, index) => {
        // --- *地文* の処理 ---
        if (part.startsWith('*') && part.endsWith('*')) {
          return (
            <span key={`narration-${index}`} className="text-gray-400 italic">
              {part.substring(1, part.length - 1)}
            </span>
          );
        }

        // --- 「セリフ」の処理 ---
        if (part.startsWith('「') && part.endsWith('」')) {
          return (
            <span key={`dialogue-${index}`} className="font-semibold text-white">
              {part}
            </span>
          );
        }

        // --- ![](URL) 外部リンク画像の処理 ---
        const externalImageMatch = part.match(/!\[.*?\]\((.*?)\)/);
        if (externalImageMatch) {
          const imageUrl = externalImageMatch[1];
          return (
            <div key={`ext-img-${index}`} className="relative my-2 w-full max-w-md rounded-lg overflow-hidden shadow-lg">
              <Image
                src={imageUrl}
                alt="外部画像"
                width={500}
                height={300}
                className="object-contain cursor-zoom-in"
                onClick={() => onImageClick?.(imageUrl)}
              />
            </div>
          );
        }

        // --- {img:n} 内部画像の処理 ---
        const internalImageMatch = part.match(/\{img:(\d+)\}/);
        if (showImage && internalImageMatch) {
          // ▼▼▼【修正】isMultiImageがfalseで、かつ既に画像がレンダリングされている場合は、ここで処理を中断 ▼▼▼
          if (!isMultiImage && imageRendered) {
            return null;
          }

          const n = parseInt(internalImageMatch[1], 10);
          const image = characterImages[n - 1]; // 1始まりのインデックス

          if (image) {
            // 画像がレンダリングされたことを記録
            imageRendered = true; 
            return (
              <div key={`int-img-${index}`} className="relative my-2 w-full max-w-xs rounded-lg overflow-hidden shadow-lg">
                <Image
                  src={image.imageUrl}
                  alt={image.keyword || `キャラクター画像 ${n}`}
                  width={400}
                  height={300}
                  className="object-contain cursor-zoom-in"
                  priority={index < 3}
                  onClick={() => onImageClick?.(image.imageUrl)}
                />
              </div>
            );
          }
        }

        // --- 通常テキストの処理 ---
        return <span key={`text-${index}`}>{part}</span>;
      })}
    </div>
  );
}
