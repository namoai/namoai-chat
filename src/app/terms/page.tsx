import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getPrisma } from '@/lib/prisma';

// Force dynamic rendering to avoid build-time Prisma access
export const dynamic = 'force-dynamic';

export default async function TermsIndexPage() {
  const prisma = await getPrisma();
  
  const terms = await prisma.terms.findMany({
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      slug: true,
      title: true,
      displayOrder: true,
      updatedAt: true,
    },
  });

  return (
    <div className="bg-black min-h-screen text-white">
      {/* 背景装飾 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8 pb-24">
          {/* ヘッダー */}
          <header className="mb-8">
            <Link 
              href="/"
              className="inline-flex items-center text-gray-400 hover:text-pink-400 transition-colors mb-4"
            >
              <ArrowLeft size={20} className="mr-2" />
              ホームに戻る
            </Link>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              約款・規約
            </h1>
          </header>

          {/* 約款一覧 */}
          <div className="space-y-4">
            {terms.length > 0 ? (
              terms.map((term) => (
                <Link
                  key={term.id}
                  href={`/terms/${term.slug}`}
                  className="block bg-gray-900/30 backdrop-blur-sm p-6 rounded-2xl border border-gray-800/50 hover:border-pink-500/30 transition-all hover:bg-gray-900/50"
                >
                  <h2 className="text-xl font-bold text-white mb-2 hover:text-pink-400 transition-colors">
                    {term.title}
                  </h2>
                  <p className="text-sm text-gray-400">
                    最終更新: {new Date(term.updatedAt).toLocaleDateString('ja-JP', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </Link>
              ))
            ) : (
              <div className="bg-gray-900/30 backdrop-blur-sm p-8 rounded-2xl border border-gray-800/50 text-center">
                <p className="text-gray-400">約款は登録されていません。</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

