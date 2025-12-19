import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getPrisma } from '@/lib/prisma';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

type PageProps = {
  params: Promise<{ slug: string }>;
};

// Force dynamic rendering to avoid build-time Prisma access
export const dynamic = 'force-dynamic';

// マークダウンをHTMLに変換し、サニタイズ
async function markdownToHtml(markdown: string): Promise<string> {
  const html = await marked(markdown);
  // XSS対策: sanitize-htmlでサニタイズ
  return sanitizeHtml(html, {
    allowedTags: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'strong', 'em', 'u', 's',
      'ul', 'ol', 'li',
      'blockquote', 'pre', 'code',
      'a', 'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'hr', 'div', 'span'
    ],
    allowedAttributes: {
      'a': ['href', 'title', 'target'],
      'img': ['src', 'alt', 'title', 'width', 'height'],
      'code': ['class'],
      '*': ['class', 'id']
    },
    allowedSchemes: ['http', 'https', 'mailto'],
  });
}

export default async function TermPage({ params }: PageProps) {
  const { slug } = await params;
  const prisma = await getPrisma();
  
  const term = await prisma.terms.findUnique({
    where: { slug },
  });

  if (!term) {
    notFound();
  }

  const htmlContent = await markdownToHtml(term.content);

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
              {term.title}
            </h1>
            <p className="text-sm text-gray-500 mt-2">
              最終更新: {new Date(term.updatedAt).toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </header>

          {/* コンテンツ */}
          <>
            <style dangerouslySetInnerHTML={{ __html: `
              .term-markdown-content {
                color: #d1d5db;
                line-height: 1.8;
              }
              .term-markdown-content h1 {
                font-size: 2rem;
                font-weight: bold;
                margin-top: 2rem;
                margin-bottom: 1rem;
                color: #ffffff;
                border-bottom: 2px solid #ec4899;
                padding-bottom: 0.5rem;
              }
              .term-markdown-content h2 {
                font-size: 1.5rem;
                font-weight: bold;
                margin-top: 1.5rem;
                margin-bottom: 0.75rem;
                color: #ffffff;
                border-left: 4px solid #ec4899;
                padding-left: 1rem;
              }
              .term-markdown-content h3 {
                font-size: 1.25rem;
                font-weight: bold;
                margin-top: 1.25rem;
                margin-bottom: 0.5rem;
                color: #f3f4f6;
              }
              .term-markdown-content h4, .term-markdown-content h5, .term-markdown-content h6 {
                font-size: 1.125rem;
                font-weight: bold;
                margin-top: 1rem;
                margin-bottom: 0.5rem;
                color: #e5e7eb;
              }
              .term-markdown-content p {
                margin-top: 1rem;
                margin-bottom: 1rem;
              }
              .term-markdown-content ul, .term-markdown-content ol {
                margin-top: 1rem;
                margin-bottom: 1rem;
                padding-left: 2rem;
              }
              .term-markdown-content li {
                margin-top: 0.5rem;
                margin-bottom: 0.5rem;
              }
              .term-markdown-content ul {
                list-style-type: disc;
              }
              .term-markdown-content ol {
                list-style-type: decimal;
              }
              .term-markdown-content a {
                color: #ec4899;
                text-decoration: underline;
              }
              .term-markdown-content a:hover {
                color: #f472b6;
              }
              .term-markdown-content strong {
                color: #ec4899;
                font-weight: bold;
              }
              .term-markdown-content em {
                font-style: italic;
              }
              .term-markdown-content code {
                background-color: #1f2937;
                color: #ec4899;
                padding: 0.125rem 0.375rem;
                border-radius: 0.25rem;
                font-family: 'Courier New', monospace;
                font-size: 0.875em;
              }
              .term-markdown-content pre {
                background-color: #1f2937;
                color: #e5e7eb;
                padding: 1rem;
                border-radius: 0.5rem;
                overflow-x: auto;
                margin-top: 1rem;
                margin-bottom: 1rem;
              }
              .term-markdown-content pre code {
                background-color: transparent;
                color: inherit;
                padding: 0;
              }
              .term-markdown-content blockquote {
                border-left: 4px solid #ec4899;
                background-color: #1f2937;
                padding: 1rem 1.5rem;
                margin-top: 1rem;
                margin-bottom: 1rem;
                font-style: italic;
              }
              .term-markdown-content table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 1rem;
                margin-bottom: 1rem;
              }
              .term-markdown-content th, .term-markdown-content td {
                border: 1px solid #4b5563;
                padding: 0.75rem;
                text-align: left;
              }
              .term-markdown-content th {
                background-color: #1f2937;
                font-weight: bold;
                color: #ffffff;
              }
              .term-markdown-content tr:nth-child(even) {
                background-color: #111827;
              }
              .term-markdown-content hr {
                border: none;
                border-top: 1px solid #374151;
                margin-top: 2rem;
                margin-bottom: 2rem;
              }
              .term-markdown-content img {
                max-width: 100%;
                height: auto;
                border-radius: 0.5rem;
                margin-top: 1rem;
                margin-bottom: 1rem;
              }
            `}} />
            <article 
              className="term-markdown-content max-w-none bg-gray-900/30 backdrop-blur-sm p-6 md:p-8 rounded-2xl border border-gray-800/50"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          </>
        </div>
      </div>
    </div>
  );
}

