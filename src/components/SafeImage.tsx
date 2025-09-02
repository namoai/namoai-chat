// src/components/SafeImage.tsx
"use client";

/**
 * 画像最適化ラッパー（next/image）
 * - <img> を直接使うと LCP が悪化しやすいため、本コンポーネントで共通化
 * - 外部ドメインの画像を使う場合は next.config.js の images.remotePatterns を設定すること
 */

import Image, { ImageProps } from "next/image";

type SafeImageProps = Omit<ImageProps, "src" | "alt"> & {
  /** 画像URL */
  src: string;
  /** 代替テキスト（アクセシビリティ） */
  alt: string;
  /** 幅（px）指定／デフォルト: 320 */
  w?: number;
  /** 高さ（px）指定／デフォルト: 180 */
  h?: number;
  /** 角丸などのユーティリティクラス */
  rounded?: string;
};

export default function SafeImage({
  src,
  alt,
  w = 320,
  h = 180,
  rounded = "rounded-md",
  className = "",
  ...rest
}: SafeImageProps) {
  return (
    <Image
      src={src}
      alt={alt}
      width={w}
      height={h}
      className={`${rounded} ${className}`}
      // layout/fill を使いたい場合は width/height を外し、親に相対配置＆サイズ指定を行う
      {...rest}
    />
  );
}