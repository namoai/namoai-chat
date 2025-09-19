'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 存在しないURLにアクセスした際に表示されるカスタム404ページです。
 * 表示後、3秒で自動的にホームページにリダイレクトします。
 */
export default function NotFound() {
  const router = useRouter();

  useEffect(() => {
    // 3秒後にホームページにリダイレクトします。
    const timer = setTimeout(() => {
      router.push('/');
    }, 3000);

    // コンポーネントがアンマウントされたときにタイマーをクリアします。
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
      <h1 className="text-4xl font-bold mb-4">404</h1>
      <p className="text-lg mb-8">ページが見つかりませんでした。</p>
      <p className="text-gray-400">3秒後にホームページへ移動します...</p>
    </div>
  );
}
