// src/components/chat/ImageLightbox.tsx
import React from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';

interface ImageLightboxProps {
  imageUrl: string;
  onClose: () => void;
}

/**
 * 画像をフルスクリーンで表示するライトボックスコンポーネント
 */
const ImageLightbox: React.FC<ImageLightboxProps> = ({ imageUrl, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="relative w-full h-full max-w-4xl max-h-[90vh]">
        <Image src={imageUrl} alt="lightbox" fill className="object-contain" />
      </div>
      <button onClick={onClose} className="absolute top-4 right-4 p-2 text-white">
        <X size={24} />
      </button>
    </div>
  );
};

export default ImageLightbox;
