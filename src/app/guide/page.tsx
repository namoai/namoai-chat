"use client";

import { useState, useEffect } from 'react';
import { ChevronRight, ArrowLeft, Edit } from 'lucide-react';
import type { Session } from 'next-auth'; // Sessionの型定義をインポート

// ガイドデータの型定義
type Guide = {
  id: number;
  title: string;
  content: string;
};

// 階層化されたガイドデータの型定義
type StructuredGuides = {
  [mainCategory: string]: {
    [subCategory: string]: Guide[];
  };
};

// サイドバーのアコーディオンメニューコンポーネント
const AccordionMenu = ({ title, children, isOpen, onClick }: { title: string, children: React.ReactNode, isOpen: boolean, onClick: () => void }) => (
  <div>
    <button onClick={onClick} className="w-full flex justify-between items-center py-2 px-4 text-left font-semibold hover:bg-gray-800 rounded-md">
      <span>{title}</span>
      <ChevronRight size={16} className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} />
    </button>
    {isOpen && <div className="pl-4 border-l border-gray-700 ml-4">{children}</div>}
  </div>
);

export default function GuidePage() {
  const [guides, setGuides] = useState<StructuredGuides>({});
  const [selectedGuide, setSelectedGuide] = useState<Guide | null>(null);
  const [openMenus, setOpenMenus] = useState<{ [key: string]: boolean }>({});
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch('/api/auth/session');
        if (response.ok) {
          const data = await response.json();
          if (data && Object.keys(data).length > 0) {
            setSession(data);
          }
        }
      } catch (error) {
        console.error("セッションの取得に失敗:", error);
      }
    };

    const fetchGuides = async () => {
      try {
        const response = await fetch('/api/guides');
        if (response.ok) {
          const data: StructuredGuides = await response.json();
          setGuides(data);
          // 最初のガイドをデフォルトで選択状態にします。
          const firstMain = Object.keys(data)[0];
          if (firstMain) {
            const firstSub = Object.keys(data[firstMain])[0];
            if (firstSub) {
              setSelectedGuide(data[firstMain][firstSub][0]);
              setOpenMenus({ [firstMain]: true, [firstSub]: true });
            }
          }
        }
      } catch (error) {
        console.error("ガイドデータの取得に失敗:", error);
      } finally {
        setLoading(false);
      }
    };
    
    checkSession();
    fetchGuides();
  }, []);

  const toggleMenu = (key: string) => {
    setOpenMenus(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="bg-black min-h-screen text-white flex flex-col">
      <header className="sticky top-0 bg-black z-10 p-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center">
          {/* ▼▼▼ 変更点: ボタンをマイページへのリンクに変更しました ▼▼▼ */}
          <a href="/MyPage" className="p-2 mr-4 rounded-full hover:bg-pink-500/20 transition-colors cursor-pointer">
            <ArrowLeft size={24} />
          </a>
          <h1 className="text-xl font-bold">ユーザーガイド</h1>
        </div>
        {session?.user?.role === 'ADMIN' && (
          <a href="/admin/guides" className="flex items-center bg-pink-600 hover:bg-pink-700 text-white text-sm font-bold py-2 px-4 rounded-lg transition-colors">
            <Edit size={16} className="mr-2" />
            ガイド管理
          </a>
        )}
      </header>
      
      <div className="flex flex-grow">
        <aside className="w-1/4 p-4 border-r border-gray-800 overflow-y-auto">
          <nav className="space-y-2">
            {loading ? <p>読み込み中...</p> : Object.keys(guides).map(mainCategory => (
              <AccordionMenu 
                key={mainCategory} 
                title={mainCategory}
                isOpen={!!openMenus[mainCategory]}
                onClick={() => toggleMenu(mainCategory)}
              >
                {Object.keys(guides[mainCategory]).map(subCategory => (
                   <AccordionMenu 
                    key={subCategory} 
                    title={subCategory}
                    isOpen={!!openMenus[subCategory]}
                    onClick={() => toggleMenu(subCategory)}
                  >
                    <div className="py-1">
                      {guides[mainCategory][subCategory].map(guide => (
                        <button 
                          key={guide.id}
                          onClick={() => setSelectedGuide(guide)}
                          className={`block w-full text-left py-1 px-2 text-sm rounded-md ${selectedGuide?.id === guide.id ? 'text-pink-400 font-bold' : 'text-gray-400 hover:bg-gray-800'}`}
                        >
                          {guide.title}
                        </button>
                      ))}
                    </div>
                  </AccordionMenu>
                ))}
              </AccordionMenu>
            ))}
          </nav>
        </aside>

        <main className="w-3/4 p-8 overflow-y-auto">
          {selectedGuide ? (
            <article className="prose prose-invert max-w-none">
              <h1>{selectedGuide.title}</h1>
              {/* HTML文字列を安全にレンダリング */}
              <div dangerouslySetInnerHTML={{ __html: selectedGuide.content }} />
            </article>
          ) : (
            !loading && <p>表示するガイドを選択してください。</p>
          )}
        </main>
      </div>
    </div>
  );
}
