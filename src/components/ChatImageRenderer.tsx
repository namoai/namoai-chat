"use client";

import React from 'react';
import Image from 'next/image';

type CharacterImageInfo = {
  imageUrl: string;
  keyword?: string | null;
};

type Props = {
  content: string;
  characterImages: CharacterImageInfo[];
  showImage: boolean;
  isMultiImage: boolean;
  onImageClick: (url: string) => void;
};

/**
 * ChatImageRenderer コンポーネント
 * @param {string} content - メッセージの全内容（テキスト＋画像トークン）
 * @param {CharacterImageInfo[]} characterImages - キャラクターの画像リスト
 * @param {boolean} showImage - 画像を表示するかどうかのフラグ
 * @param {boolean} isMultiImage - 複数の画像を表示するかどうかのフラグ
 * @param {(url: string) => void} onImageClick - 画像クリック時のコールバック
 * @description
 * - メッセージ内容全体を解析し、キーワードまたは{img:n}トークンに一致する画像をレンダリングする。
 * - このコンポーネントはテキスト自体はレンダリングせず、画像のみを担当する。
 */
const ChatImageRenderer: React.FC<Props> = ({
  content,
  characterImages,
  showImage,
  isMultiImage,
  onImageClick,
}) => {
  if (!showImage || !characterImages || characterImages.length === 0) {
    return null;
  }

  const imagesToRender: CharacterImageInfo[] = [];

  // 1. {img:n} トークンを最優先で探す
  const imgTokens = content.match(/\{img:(\d+)\}/g) || [];
  if (imgTokens.length > 0) {
    imgTokens.forEach(token => {
      const match = token.match(/\{img:(\d+)\}/);
      if (match) {
        const index = parseInt(match[1], 10);
        if (index > 0 && index <= characterImages.length) {
          const imageInfo = characterImages[index - 1];
          if (imageInfo && !imagesToRender.includes(imageInfo)) {
            imagesToRender.push(imageInfo);
          }
        }
      }
    });
  }

  // 2. {img:n} がない場合、キーワードで探す
  if (imagesToRender.length === 0) {
    for (const imageInfo of characterImages) {
      if (imageInfo.keyword && content.includes(imageInfo.keyword)) {
        imagesToRender.push(imageInfo);
        if (!isMultiImage) {
          break; // 単一画像モードの場合は最初に見つかったものだけ
        }
      }
    }
  }

  if (imagesToRender.length === 0) {
    return null;
  }

  const finalImages = isMultiImage ? imagesToRender : [imagesToRender[0]];

  return (
    <div className="flex flex-wrap gap-2 my-2">
      {finalImages.map((imageInfo, index) => (
        <div
          key={index}
          className="relative w-32 h-32 md:w-48 md:h-48 cursor-pointer overflow-hidden rounded-lg"
          onClick={() => onImageClick(imageInfo.imageUrl)}
        >
          <Image
            src={imageInfo.imageUrl}
            alt={imageInfo.keyword || `Chat Image ${index}`}
            fill
            className="object-cover transition-transform duration-300 hover:scale-110"
            sizes="(max-width: 768px) 128px, 192px"
          />
        </div>
      ))}
    </div>
  );
};

export default ChatImageRenderer;