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
        <div className="bg-black min-h-screen text-white flex flex-col items-center">
            <div className="w-full max-w-2xl">
                <header className="flex items-center p-4 sticky top-0 bg-black/80 backdrop-blur-sm z-10">
                    <button onClick={() => window.history.back()} className="p-2 rounded-full hover:bg-gray-700 transition-colors">
                        <ArrowLeft />
                    </button>
                    <h1 className="font-bold text-lg mx-auto">パスワード変更</h1>
                </header>
                
                <main className="p-4 md:p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2" htmlFor="currentPassword">
                                現在のパスワード
                            </label>
                            <input
                                id="currentPassword"
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2" htmlFor="newPassword">
                                新しいパスワード
                            </label>
                            <input
                                id="newPassword"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2" htmlFor="confirmPassword">
                                新しいパスワード (確認)
                            </label>
                            <input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
                                required
                            />
                        </div>
                        
                        {error && <p className="text-red-500 text-center">{error}</p>}
                        {success && <p className="text-green-500 text-center">{success}</p>}
                        
                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:bg-pink-800 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                        >
                           <KeyRound size={18} /> {isLoading ? '変更中...' : 'パスワードを変更'}
                        </button>
                    </form>
                </main>
            </div>
        </div>
    );
}
