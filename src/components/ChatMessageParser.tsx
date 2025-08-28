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
 * - *地文* -> <span className="text-gray-400 italic">...</span>
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
  const regex = /(\*.*?\*)|(「.*?」)|(!\[.*?\]\(.*?\))|(\{img:\d+\})/g;
  const parts = content.split(regex).filter(Boolean);

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
            // ▼▼▼【修正点】固定のアスペクト比を削除します ▼▼▼
            <div key={`ext-img-${index}`} className="relative my-2 w-full max-w-md rounded-lg overflow-hidden shadow-lg">
              <Image
                src={imageUrl}
                alt="外部画像"
                width={500} // widthとheightの指定が推奨されます
                height={300}
                className="object-contain cursor-zoom-in"
                onClick={() => onImageClick?.(imageUrl)}
              />
            </div>
            // ▲▲▲ ここまで ▲▲▲
          );
        }

        // --- {img:n} 内部画像の処理 ---
        const internalImageMatch = part.match(/\{img:(\d+)\}/);
        if (showImage && internalImageMatch) {
          if (!isMultiImage && imageRendered) return null;

          const n = parseInt(internalImageMatch[1], 10);
          const image = characterImages[n - 1]; // 1始まりのインデックスを想定

          if (image) {
            imageRendered = true;
            return (
              // ▼▼▼【修正点】固定のアスペクト比を削除します ▼▼▼
              <div key={`int-img-${index}`} className="relative my-2 w-full max-w-xs rounded-lg overflow-hidden shadow-lg">
                <Image
                  src={image.imageUrl}
                  alt={image.keyword || `キャラクター画像 ${n}`}
                  width={400} // widthとheightの指定が推奨されます
                  height={300}
                  className="object-contain cursor-zoom-in"
                  priority={index < 3}
                  onClick={() => onImageClick?.(image.imageUrl)}
                />
              </div>
              // ▲▲▲ ここまで ▲▲▲
            );
          }
        }

        // --- 通常テキストの処理 ---
        return <span key={`text-${index}`}>{part}</span>;
      })}
    </div>
  );
}
