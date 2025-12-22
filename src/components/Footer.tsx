"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText } from 'lucide-react';
import { useEffect, useState } from 'react';

type Term = {
  slug: string;
  title: string;
};

export default function Footer() {
  const pathname = usePathname();
  const [terms, setTerms] = useState<Term[]>([]);

  // 約款一覧を取得
  useEffect(() => {
    fetch('/api/terms')
      .then(res => res.json())
      .then(data => setTerms(data))
      .catch(err => console.error('約款取得エラー:', err));
  }, []);

  // 一部のページではフッターを非表示
  const hideFooterPaths = ['/login', '/register', '/chat/', '/complete-profile'];
  const shouldHide = hideFooterPaths.some(path => pathname.startsWith(path));

  if (shouldHide || terms.length === 0) {
    return null;
  }

  return (
    <footer className="bg-black/80 backdrop-blur-xl border-t border-gray-900/50 mt-auto w-full">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          {/* 約款リンク */}
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {terms.map((term) => (
              <Link
                key={term.slug}
                href={`/terms/${term.slug}`}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-blue-400 transition-colors"
              >
                <FileText size={14} />
                <span>{term.title}</span>
              </Link>
            ))}
          </nav>

          {/* コピーライト */}
          <div className="text-xs text-gray-500 text-center md:text-right">
            <p>© {new Date().getFullYear()} ナモアイ. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

