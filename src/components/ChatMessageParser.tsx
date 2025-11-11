import React, { ReactElement } from 'react';
import Image from 'next/image';

// 型定義
type CharacterImage = {
  imageUrl: string;
  keyword?: string | null;
  isMain?: boolean;
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
 * - --- -> 水平線
 * - |-| -> 空のボーダーボックス
 * - |内容| -> 内容付きボーダーボックス
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
  // テキストを行に分割し、各行を処理
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let lineIndex = 0;
  
  // セリフ(「...」)、外部リンク画像、内部画像トークン、ボーダーボックス(|...|)を検出する正規表現
  const regex = /(「.*?」)|(!\[.*?\]\(.*?\))|(\{img:\d+\})|(\|[^|]+\|)/g;
  
  let imageRendered = false;
  let isAfterSeparator = false; // |-|-| 区切り線以降かどうかを追跡

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    const globalIndex = baseIndex + lineIndex;

    // --- 水平線の処理 (---) ---
    if (trimmedLine === '---') {
      elements.push(
        <hr key={`hr-${globalIndex}`} className="my-4 border-t border-gray-600" />
      );
      lineIndex++;
      continue;
    }

    // --- 空のボーダーボックスの処理 (|-|) ---
    if (trimmedLine === '|-|') {
      elements.push(
        <div key={`border-${globalIndex}`} className="my-2 border border-pink-400/50 rounded p-2 min-h-[20px]" />
      );
      lineIndex++;
      continue;
    }

    // --- 区切り線の処理 (|-|-|) ---
    if (trimmedLine === '|-|-|') {
      isAfterSeparator = true;
      // 区切り線は視覚的に表示しない（または細い線で表示）
      lineIndex++;
      continue;
    }

    // 空行の処理
    if (trimmedLine === '') {
      if (i < lines.length - 1) {
        elements.push(<br key={`br-${globalIndex}`} />);
        lineIndex++;
      }
      continue;
    }

    // 行内の特殊要素を検出して処理
    const parts = line.split(regex).filter(Boolean);
    const lineElements: React.ReactNode[] = [];

    for (const part of parts) {
      // --- ボーダーボックスの処理 (|内容|) ---
      const borderBoxMatch = part.match(/^\|([^|]+)\|$/);
      if (borderBoxMatch) {
        const content = borderBoxMatch[1];
        // 区切り線以降なら通常背景、以前なら黒背景タイトルスタイル
        if (isAfterSeparator) {
          // 通常背景説明スタイル
          lineElements.push(
            <span key={`border-box-${globalIndex}-${lineElements.length}`} className="inline-block my-1 mx-1 border border-gray-600 rounded px-3 py-2 text-gray-300 bg-gray-900/30">
              {content}
            </span>
          );
        } else {
          // 黒背景タイトルスタイル
          lineElements.push(
            <span key={`border-box-${globalIndex}-${lineElements.length}`} className="inline-block my-1 mx-1 border border-gray-600 rounded px-3 py-2 text-white bg-gray-900">
              {content}
            </span>
          );
        }
        continue;
      }
      // --- 「セリフ」の処理 (白文字) ---
      if (part.startsWith('「') && part.endsWith('」')) {
        lineElements.push(
          <span key={`dialogue-${globalIndex}-${lineElements.length}`} className="text-white">
            {part}
          </span>
        );
        continue;
      }

      // --- ![](URL) 外部リンク画像の処理 ---
      const externalImageMatch = part.match(/!\[.*?\]\((.*?)\)/);
      if (externalImageMatch) {
        const imageUrl = externalImageMatch[1];
        lineElements.push(
          <div key={`ext-img-${globalIndex}-${lineElements.length}`} className="relative my-2 w-full max-w-md rounded-lg overflow-hidden shadow-lg">
            <Image
              src={imageUrl}
              alt="外部画像"
              width={500}
              height={300}
              className="object-contain cursor-zoom-in"
              onClick={() => onImageClick?.(imageUrl)}
              unoptimized={imageUrl.startsWith('http')}
            />
          </div>
        );
        continue;
      }

      // --- {img:n} 内部画像の処理 ---
      const internalImageMatch = part.match(/\{img:(\d+)\}/);
      if (showImage && internalImageMatch) {
        if (!isMultiImage && imageRendered) {
          continue;
        }

        const n = parseInt(internalImageMatch[1], 10);
        // ▼▼▼【修正】parseImageTagsと同様にnonMainImagesを使用 (isMain=falseの画像のみ)
        const nonMainImages = characterImages.filter(img => !img.isMain);
        const imgIndex = n - 1; // 1-indexed to 0-indexed
        const image = imgIndex >= 0 && imgIndex < nonMainImages.length ? nonMainImages[imgIndex] : null;
        // ▲▲▲

        if (image) {
          imageRendered = true;
          lineElements.push(
            <div key={`int-img-${globalIndex}-${lineElements.length}`} className="relative my-2 w-full max-w-xs rounded-lg overflow-hidden shadow-lg">
              <Image
                src={image.imageUrl}
                alt={image.keyword || `キャラクター画像 ${n}`}
                width={400}
                height={300}
                className="object-contain cursor-zoom-in"
                priority={imgIndex < 3}
                onClick={() => onImageClick?.(image.imageUrl)}
              />
            </div>
          );
          continue;
        } else {
          // ▼▼▼【デバッグ】画像が見つからない場合の警告
          console.warn(`⚠️ ChatMessageParser: 無効な画像インデックス {img:${n}} (非メイン画像数: ${nonMainImages.length})`);
          // ▲▲▲
        }
      }

      // --- 通常テキストの処理 (デフォルトは灰色) ---
      if (part.trim()) {
        lineElements.push(
          <span key={`text-${globalIndex}-${lineElements.length}`} className="text-gray-400">
            {part}
          </span>
        );
      }
    }

    // 行の要素を追加
    if (lineElements.length > 0) {
      elements.push(
        <React.Fragment key={`line-${globalIndex}`}>
          {lineElements}
          {i < lines.length - 1 && <br />}
        </React.Fragment>
      );
      lineIndex++;
    }
  }

  return elements;
}
