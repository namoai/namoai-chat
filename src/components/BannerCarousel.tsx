"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface Banner {
  id: number;
  title?: string | null;
  description?: string | null;
  imageUrl: string;
  link?: string | null;
  gradient?: string;
}

interface BannerCarouselProps {
  banners?: Banner[];
  mobile?: boolean;
}

const defaultBanners: Banner[] = [
  {
    id: 1,
    title: "新機能リリース",
    description: "より良い体験をお届けします",
    imageUrl: "",
    gradient: "from-blue-600 to-cyan-600",
  },
  {
    id: 2,
    title: "人気キャラクター",
    description: "今週のおすすめ",
    imageUrl: "",
    gradient: "from-purple-600 to-blue-600",
  },
  {
    id: 3,
    title: "イベント開催中",
    description: "特別キャンペーン実施中",
    imageUrl: "",
    gradient: "from-cyan-600 to-blue-600",
  },
];

export default function BannerCarousel({ banners: propBanners, mobile = false }: BannerCarouselProps) {
  const [banners, setBanners] = useState<Banner[]>(propBanners || []);
  const [loading, setLoading] = useState(!propBanners);

  useEffect(() => {
    if (propBanners) {
      setBanners(propBanners);
      setLoading(false);
      return;
    }

    // APIからバナーを取得
    const fetchBanners = async () => {
      try {
        const response = await fetch('/api/banners');
        if (response.ok) {
          const data = await response.json();
          console.log('[BannerCarousel] バナーデータ:', data);
          if (data && Array.isArray(data) && data.length > 0) {
            setBanners(data);
          } else {
            // バナーがない場合はデフォルトバナーを使用
            setBanners(defaultBanners);
          }
        } else {
          console.error('[BannerCarousel] API レスポンスエラー:', response.status);
          setBanners(defaultBanners);
        }
      } catch (error) {
        console.error('[BannerCarousel] バナーの取得に失敗:', error);
        setBanners(defaultBanners);
      } finally {
        setLoading(false);
      }
    };

    fetchBanners();
  }, [propBanners]);
  
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // バナーがない場合はデフォルトバナーを使用
  const displayBanners = banners.length > 0 ? banners : defaultBanners;

  useEffect(() => {
    if (!isAutoPlaying || displayBanners.length === 0) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % displayBanners.length);
    }, 5000); // 5秒ごとに自動スライド

    return () => clearInterval(interval);
  }, [isAutoPlaying, displayBanners.length]);

  const changeSlide = (direction: number) => {
    setIsAutoPlaying(false); // 手動操作時は自動再生を停止
    setCurrentSlide((prev) => {
      const newSlide = prev + direction;
      if (newSlide < 0) return displayBanners.length - 1;
      if (newSlide >= displayBanners.length) return 0;
      return newSlide;
    });
  };

  const goToSlide = (index: number) => {
    setIsAutoPlaying(false);
    setCurrentSlide(index);
  };

  const height = mobile ? "400px" : "500px";

  if (loading) {
    return (
      <div className="relative rounded-3xl overflow-hidden bg-gray-800/50" style={{ height }}>
        <div className="flex items-center justify-center h-full">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-gray-400">読み込み中...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-3xl overflow-hidden" style={{ height }}>
      {/* バナースライド */}
      <div className="relative w-full h-full">
        {displayBanners.map((banner, index) => {
          const BannerContent = (
            <div
              className={`absolute inset-0 transition-opacity duration-500 ${
                index === currentSlide ? "opacity-100 z-10" : "opacity-0 z-0"
              }`}
            >
              {banner.imageUrl ? (
                <div className="relative w-full h-full">
                  <Image
                    src={banner.imageUrl}
                    alt={banner.title || "バナー"}
                    fill
                    className="object-cover"
                    sizes="100vw"
                    priority={index === currentSlide}
                  />
                </div>
              ) : (
                <div className={`w-full h-full bg-gradient-to-br ${banner.gradient || "from-blue-600 to-cyan-600"} flex items-center justify-center`}>
                  <div className={`text-center ${mobile ? "px-6" : "px-12"}`}>
                    {banner.title && (
                      <h1 className={`${mobile ? "text-3xl" : "text-5xl"} font-bold text-white mb-4`}>
                        {banner.title}
                      </h1>
                    )}
                    {banner.description && (
                      <p className={`${mobile ? "text-lg" : "text-xl"} text-white/90 mb-8`}>
                        {banner.description}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );

          return banner.link ? (
            <Link key={banner.id} href={banner.link}>
              {BannerContent}
            </Link>
          ) : (
            <div key={banner.id}>{BannerContent}</div>
          );
        })}
      </div>

      {/* インジケーター */}
      <div className={`absolute ${mobile ? "bottom-4" : "bottom-6"} left-1/2 transform -translate-x-1/2 flex gap-2 z-20`}>
        {displayBanners.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`w-2 h-2 rounded-full bg-white transition-opacity ${
              index === currentSlide ? "opacity-100" : "opacity-50 hover:opacity-75"
            }`}
            aria-label={`スライド ${index + 1} に移動`}
          />
        ))}
      </div>

      {/* 前/次ボタン */}
      <button
        onClick={() => changeSlide(-1)}
        className={`absolute ${mobile ? "left-4" : "left-6"} top-1/2 transform -translate-y-1/2 ${
          mobile ? "w-10 h-10" : "w-12 h-12"
        } rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition-colors z-20 flex items-center justify-center`}
        aria-label="前のスライド"
      >
        <ChevronLeft className={mobile ? "w-6 h-6" : "w-6 h-6"} />
      </button>
      <button
        onClick={() => changeSlide(1)}
        className={`absolute ${mobile ? "right-4" : "right-6"} top-1/2 transform -translate-y-1/2 ${
          mobile ? "w-10 h-10" : "w-12 h-12"
        } rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition-colors z-20 flex items-center justify-center`}
        aria-label="次のスライド"
      >
        <ChevronRight className={mobile ? "w-6 h-6" : "w-6 h-6"} />
      </button>
    </div>
  );
}

