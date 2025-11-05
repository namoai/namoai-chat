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
 * - コードブロック (```...```) -> 状態窓スタイルで表示
 * - 「セリフ」 -> <span className="text-white">...</span> (白文字)
 * - 通常テキスト -> <span className="text-gray-400">...</span> (デフォルトは灰色)
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
  // ▼▼▼【コードブロック解析】まずコードブロックを抽出 ▼▼▼
  const codeBlockRegex = /```([\s\S]*?)```/g;
  const codeBlocks: Array<{ start: number; end: number; content: string }> = [];
  let match;
  
  while ((match = codeBlockRegex.exec(content)) !== null) {
    codeBlocks.push({
      start: match.index,
      end: match.index + match[0].length,
      content: match[1].trim(),
    });
  }

  // コードブロック以外の部分を処理
  let lastIndex = 0;
  const elements: React.ReactNode[] = [];

  codeBlocks.forEach((block, blockIndex) => {
    // コードブロックの前のテキストを処理
    if (block.start > lastIndex) {
      const textBefore = content.substring(lastIndex, block.start);
      elements.push(...parseTextContent(textBefore, blockIndex * 1000, characterImages, showImage, isMultiImage, onImageClick));
    }

    // コードブロックを状態窓スタイルで表示
    elements.push(
      <div
        key={`codeblock-${blockIndex}`}
        className="mt-3 mb-3 bg-gray-900/80 border border-gray-700 rounded-lg p-3 font-mono text-sm text-gray-300 whitespace-pre-wrap"
      >
        {block.content}
      </div>
    );

    lastIndex = block.end;
  });

  // 最後のコードブロック以降のテキストを処理
  if (lastIndex < content.length) {
    const textAfter = content.substring(lastIndex);
    elements.push(...parseTextContent(textAfter, codeBlocks.length * 1000, characterImages, showImage, isMultiImage, onImageClick));
  }

  return (
    <div className="whitespace-pre-wrap leading-relaxed">
      {elements}
    </div>
  );
}

/**
 * テキストコンテンツを解析してReact要素に変換
 * - 「セリフ」 -> 白文字
 * - 通常テキスト -> 灰色
 * - 画像タグ -> 画像コンポーネント
 */
function parseTextContent(
  text: string,
  baseIndex: number,
  characterImages: CharacterImage[],
  showImage: boolean,
  isMultiImage: boolean,
  onImageClick?: (url: string) => void
): React.ReactNode[] {
  // セリフ(「...」)、外部リンク画像、内部画像トークンを検出する正規表現
  const regex = /(「.*?」)|(!\[.*?\]\(.*?\))|(\{img:\d+\})/g;
  const parts = text.split(regex).filter(Boolean);
  
  let imageRendered = false;

  return parts.map((part, index) => {
    const globalIndex = baseIndex + index;

    // --- 「セリフ」の処理 (白文字) ---
    if (part.startsWith('「') && part.endsWith('」')) {
      return (
        <span key={`dialogue-${globalIndex}`} className="text-white">
          {part}
        </span>
      );
    }

    // --- ![](URL) 外部リンク画像の処理 ---
    const externalImageMatch = part.match(/!\[.*?\]\((.*?)\)/);
    if (externalImageMatch) {
      const imageUrl = externalImageMatch[1];
      return (
        <div key={`ext-img-${globalIndex}`} className="relative my-2 w-full max-w-md rounded-lg overflow-hidden shadow-lg">
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
      if (!isMultiImage && imageRendered) {
        return null;
      }

      const n = parseInt(internalImageMatch[1], 10);
      const image = characterImages[n - 1]; // 1始まりのインデックス

      if (image) {
        imageRendered = true;
        return (
          <div key={`int-img-${globalIndex}`} className="relative my-2 w-full max-w-xs rounded-lg overflow-hidden shadow-lg">
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

    // --- 通常テキストの処理 (デフォルトは灰色) ---
    return (
      <span key={`text-${globalIndex}`} className="text-gray-400">
        {part}
      </span>
    );
  });
}
