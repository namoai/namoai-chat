"use client";

import React, { useState } from 'react';
import { ArrowLeft, KeyRound } from 'lucide-react';

export default function ChangePasswordPage() {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (newPassword !== confirmPassword) {
            setError('新しいパスワードが一致しません。');
            return;
        }
        if (newPassword.length < 8) {
            setError('新しいパスワードは8文字以上である必要があります。');
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch('/api/users/change-password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'パスワードの変更に失敗しました。');
            }
            
            setSuccess('パスワードが正常に変更されました。');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');

        } catch (err) {
            setError(err instanceof Error ? err.message : '不明なエラーが発生しました。');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-black min-h-screen text-white">
            {/* 背景装飾 */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10">
                <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 pb-24">
                    <header className="flex items-center justify-center mb-8 sticky top-0 bg-black/80 backdrop-blur-xl z-10 py-4 -mx-4 md:-mx-6 px-4 md:px-6 border-b border-gray-900/50 relative">
                        <button onClick={() => window.history.back()} className="absolute left-4 md:left-6 p-2 rounded-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all">
                            <ArrowLeft size={24} />
                        </button>
                        <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                            パスワード変更
                        </h1>
                    </header>
                    
                    <main>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl border border-gray-800/50">
                                <label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="currentPassword">
                                    現在のパスワード
                                </label>
                                <input
                                    id="currentPassword"
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all placeholder-gray-500"
                                    placeholder="現在のパスワードを入力"
                                    required
                                />
                            </div>
                            <div className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl border border-gray-800/50">
                                <label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="newPassword">
                                    新しいパスワード
                                </label>
                                <input
                                    id="newPassword"
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all placeholder-gray-500"
                                    placeholder="新しいパスワードを入力（8文字以上）"
                                    required
                                />
                            </div>
                            <div className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl border border-gray-800/50">
                                <label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="confirmPassword">
                                    新しいパスワード (確認)
                                </label>
                                <input
                                    id="confirmPassword"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all placeholder-gray-500"
                                    placeholder="新しいパスワードを再入力"
                                    required
                                />
                            </div>
                            
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-center">
                                    {error}
                                </div>
                            )}
                            {success && (
                                <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl text-center">
                                    {success}
                                </div>
                            )}
                            
                            <button 
                                type="submit" 
                                disabled={isLoading}
                                className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-lg shadow-pink-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                            >
                                <KeyRound size={20} /> {isLoading ? '変更中...' : 'パスワードを変更'}
                            </button>
                        </form>
                    </main>
                </div>
            </div>
        </div>
    );
}
