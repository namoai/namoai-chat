"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, ArrowLeft, Edit, Menu, X } from 'lucide-react';
import type { Session } from 'next-auth';

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
    <button 
      onClick={onClick} 
      className={`w-full flex justify-between items-center py-3 px-4 text-left font-semibold rounded-xl transition-all ${
        isOpen 
          ? 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-400 border border-blue-500/30' 
          : 'hover:bg-blue-500/10 hover:text-blue-400 text-gray-300'
      }`}
    >
      <span>{title}</span>
      <ChevronRight size={16} className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} />
    </button>
    {isOpen && <div className="pl-4 border-l border-blue-500/30 ml-4 mt-2">{children}</div>}
  </div>
);

export default function GuidePage() {
  const router = useRouter(); // useRouterフックを使用
  const [guides, setGuides] = useState<StructuredGuides>({});
  const [selectedGuide, setSelectedGuide] = useState<Guide | null>(null);
  const [openMenus, setOpenMenus] = useState<{ [key: string]: boolean }>({});
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // モバイル判定
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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

  const handleGoBack = () => {
    // リファラーをチェックして、適切なページに戻る
    if (typeof window !== 'undefined') {
      const referrer = document.referrer;
      // 管理ページから来た場合は管理ページに戻る
      if (referrer.includes('/admin/guides')) {
        router.push('/admin');
      } else {
        // それ以外は通常の戻る動作
        router.back();
      }
    } else {
      router.back();
    }
  };

  return (
    <div className="bg-black min-h-screen text-white flex flex-col">
      {/* 背景装飾 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col flex-grow">
        <header className="sticky top-0 bg-black/80 backdrop-blur-xl z-20 p-4 border-b border-gray-900/50 flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={handleGoBack} className="p-2 mr-4 rounded-xl hover:bg-blue-500/10 hover:text-blue-400 transition-all">
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
              ユーザーガイド
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {isMobile && (
              <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-xl hover:bg-blue-500/10 hover:text-blue-400 transition-all"
              >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            )}
            {session?.user?.role === 'ADMIN' && (
              <Link href="/admin/guides" className="flex items-center bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white text-sm font-semibold py-2 px-4 rounded-xl transition-all shadow-lg shadow-blue-500/30">
                <Edit size={16} className="mr-2" />
                ガイド管理
              </Link>
            )}
          </div>
        </header>
        
        <div className="flex flex-grow overflow-hidden">
          {/* モバイル: ドロワー形式のサイドバー */}
          {isMobile ? (
            <>
              {/* オーバーレイ */}
              {isMobileMenuOpen && (
                <div 
                  className="fixed inset-0 bg-black/50 z-30 lg:hidden"
                  onClick={() => setIsMobileMenuOpen(false)}
                />
              )}
              {/* サイドバー */}
              <aside 
                className={`fixed top-[73px] left-0 h-[calc(100vh-73px)] w-80 p-4 border-r border-gray-800/50 overflow-y-auto bg-gray-900/95 backdrop-blur-xl z-40 lg:hidden transition-transform duration-300 ${
                  isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
              >
                <nav className="space-y-2">
                  {loading ? (
                    <div className="flex justify-center py-8">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                        <p className="text-gray-400">読み込み中...</p>
                      </div>
                    </div>
                  ) : Object.keys(guides).map(mainCategory => (
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
                                onClick={() => {
                                  setSelectedGuide(guide);
                                  setIsMobileMenuOpen(false);
                                }}
                                className={`block w-full text-left py-2 px-3 text-sm rounded-xl transition-all ${
                                  selectedGuide?.id === guide.id 
                                    ? 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-400 font-semibold border border-blue-500/30' 
                                    : 'text-gray-400 hover:bg-blue-500/10 hover:text-blue-400'
                                }`}
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
            </>
          ) : (
            /* PC: 通常のサイドバー */
            <aside className="w-80 lg:w-96 p-4 border-r border-gray-800/50 overflow-y-auto bg-gray-900/30 backdrop-blur-sm flex-shrink-0">
              <nav className="space-y-2">
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                      <p className="text-gray-400">読み込み中...</p>
                    </div>
                  </div>
                ) : Object.keys(guides).map(mainCategory => (
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
                              className={`block w-full text-left py-2 px-3 text-sm rounded-xl transition-all ${
                                selectedGuide?.id === guide.id 
                                  ? 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-400 font-semibold border border-blue-500/30' 
                                  : 'text-gray-400 hover:bg-blue-500/10 hover:text-blue-400'
                              }`}
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
          )}

          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto min-w-0">
            {selectedGuide ? (
              <article className="prose prose-invert max-w-none bg-gray-900/30 backdrop-blur-sm p-4 md:p-6 lg:p-8 rounded-2xl border border-gray-800/50">
                <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  {selectedGuide.title}
                </h1>
                <div className="text-gray-300 leading-relaxed text-sm md:text-base" dangerouslySetInnerHTML={{ __html: selectedGuide.content }} />
              </article>
            ) : (
              !loading && (
                <div className="flex items-center justify-center h-full min-h-[60vh]">
                  <p className="text-gray-500 text-lg">表示するガイドを選択してください。</p>
                </div>
              )
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
