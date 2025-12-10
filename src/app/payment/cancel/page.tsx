"use client";

import Link from 'next/link';
import { XCircle } from 'lucide-react';

export default function PaymentCancelPage() {
  return (
    <div className="bg-black min-h-screen text-white">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex items-center justify-center min-h-screen px-4">
        <div className="bg-gray-900/50 backdrop-blur-sm p-8 rounded-2xl border border-gray-800/50 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold mb-4 bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
            決済がキャンセルされました
          </h1>
          <p className="text-gray-300 mb-6">
            決済がキャンセルされました。
            <br />
            再度お試しいただけます。
          </p>

          <div className="flex flex-col gap-3">
            <Link
              href="/points"
              className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-xl transition-all"
            >
              ポイントページへ戻る
            </Link>
            <Link
              href="/"
              className="border border-gray-700 hover:border-pink-400 text-white font-semibold py-3 px-6 rounded-xl transition-all"
            >
              ホームへ戻る
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}









