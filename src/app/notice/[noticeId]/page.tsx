import NoticeDetailClient from '@/components/NoticeDetailClient';

// Netlify型衝突回避バージョン
/* eslint-disable @typescript-eslint/no-explicit-any */
export default function NoticeDetailPage({ params }: any) {
  return <NoticeDetailClient noticeId={params.noticeId} />;
}