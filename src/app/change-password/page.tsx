"use client";

import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, ArrowLeft, KeyRound, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { fetchWithCsrf } from '@/lib/csrf-client';
import { validatePassword, getPasswordStrengthDescription } from '@/lib/password-policy';

export default function ChangePasswordPage() {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    
    // パスワード検証結果
    const [passwordValidation, setPasswordValidation] = useState<ReturnType<typeof validatePassword> | null>(null);
    
    // パスワード一致確認
    const [passwordMatch, setPasswordMatch] = useState<boolean | null>(null);

    // 新しいパスワードが変更されたときに検証
    useEffect(() => {
        if (newPassword) {
            const validation = validatePassword(newPassword);
            setPasswordValidation(validation);
        } else {
            setPasswordValidation(null);
        }
    }, [newPassword]);

    // パスワード確認が変更されたときに一致確認
    useEffect(() => {
        if (confirmPassword) {
            setPasswordMatch(newPassword === confirmPassword);
        } else {
            setPasswordMatch(null);
        }
    }, [confirmPassword, newPassword]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // バリデーション
        if (!currentPassword) {
            setError('現在のパスワードを入力してください。');
            return;
        }

        if (!newPassword) {
            setError('新しいパスワードを入力してください。');
            return;
        }

        // パスワード検証
        const validation = validatePassword(newPassword);
        if (!validation.isValid) {
            setError(validation.errors.join('\n'));
            return;
        }

        // パスワード一致確認
        if (newPassword !== confirmPassword) {
            setError('新しいパスワードが一致しません。');
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetchWithCsrf('/api/users/change-password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'パスワードの変更に失敗しました。');
            }
            
            // 成功モーダルを表示
            setShowSuccessModal(true);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setPasswordValidation(null);
            setPasswordMatch(null);

        } catch (err) {
            setError(err instanceof Error ? err.message : '不明なエラーが発生しました。');
        } finally {
            setIsLoading(false);
        }
    };

    const getStrengthColor = (strength: string) => {
        switch (strength) {
            case 'weak': return 'text-red-400';
            case 'medium': return 'text-yellow-400';
            case 'strong': return 'text-blue-400';
            case 'very-strong': return 'text-green-400';
            default: return 'text-gray-400';
        }
    };

    return (
        <>
            {/* 成功モーダル */}
            {showSuccessModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex justify-center items-center p-4">
                    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-center mb-4">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
                                <CheckCircle size={32} className="text-green-400" />
                            </div>
                        </div>
                        <h2 className="text-xl font-bold mb-4 text-white text-center">
                            パスワード変更完了
                        </h2>
                        <p className="text-gray-200 mb-6 text-center leading-relaxed">
                            パスワードが正常に変更されました。
                        </p>
                        <div className="flex justify-end">
                            <button 
                                onClick={() => {
                                    setShowSuccessModal(false);
                                    window.history.back();
                                }} 
                                className="px-5 py-2.5 bg-blue-600 text-white hover:bg-blue-500 rounded-lg transition-all duration-200 font-medium shadow-lg hover:shadow-blue-500/50"
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-black min-h-screen text-white">
                {/* 背景装飾 */}
                <div className="fixed inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-96 h-96 bg-gray-800/30 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gray-800/30 rounded-full blur-3xl" />
                </div>

                <div className="relative z-10">
                    <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 pb-24">
                        <header className="flex items-center justify-center mb-8 sticky top-0 bg-black/80 backdrop-blur-xl z-10 py-4 -mx-4 md:-mx-6 px-4 md:px-6 border-b border-gray-900/50 relative">
                            <button onClick={() => window.history.back()} className="absolute left-4 md:left-6 p-2 rounded-xl hover:bg-blue-500/10 hover:text-blue-400 transition-all">
                                <ArrowLeft size={24} />
                            </button>
                            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                                パスワード変更
                            </h1>
                        </header>
                        
                        <main>
                            <form onSubmit={handleSubmit} className="space-y-6">
                                {/* 現在のパスワード */}
                                <div className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl border border-gray-800/50">
                                    <label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="currentPassword">
                                        現在のパスワード
                                    </label>
                                    <div className="relative">
                                        <input
                                            id="currentPassword"
                                            type={showCurrentPassword ? "text" : "password"}
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 pr-12 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all placeholder-gray-500"
                                            placeholder="現在のパスワードを入力"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                                        >
                                            {showCurrentPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    </div>
                                </div>

                                {/* 新しいパスワード */}
                                <div className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl border border-gray-800/50">
                                    <label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="newPassword">
                                        新しいパスワード
                                    </label>
                                    <div className="relative">
                                        <input
                                            id="newPassword"
                                            type={showNewPassword ? "text" : "password"}
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className={`w-full bg-gray-800/50 border rounded-xl px-4 py-3 pr-12 text-white focus:outline-none focus:ring-2 transition-all placeholder-gray-500 ${
                                                passwordValidation?.isValid 
                                                    ? 'border-green-500/50 focus:ring-green-500/50 focus:border-green-500/50' 
                                                    : passwordValidation && !passwordValidation.isValid
                                                    ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50'
                                                    : 'border-gray-700/50 focus:ring-blue-500/50 focus:border-blue-500/50'
                                            }`}
                                            placeholder="8文字以上（小文字・数字・特殊文字必須）"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                                        >
                                            {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    </div>
                                    
                                    {/* パスワード検証結果 */}
                                    {newPassword && passwordValidation && (
                                        <div className="mt-3 space-y-2">
                                            <div className="text-xs text-gray-400">
                                                <p className="font-semibold mb-1">パスワード要件:</p>
                                                <ul className="space-y-1">
                                                    <li className={`flex items-center gap-2 ${newPassword.length >= 8 ? 'text-green-400' : 'text-red-400'}`}>
                                                        {newPassword.length >= 8 ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                                        8文字以上
                                                    </li>
                                                    <li className={`flex items-center gap-2 ${/[a-z]/.test(newPassword) ? 'text-green-400' : 'text-red-400'}`}>
                                                        {/[a-z]/.test(newPassword) ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                                        小文字（a-z）を含む
                                                    </li>
                                                    <li className={`flex items-center gap-2 ${/[0-9]/.test(newPassword) ? 'text-green-400' : 'text-red-400'}`}>
                                                        {/[0-9]/.test(newPassword) ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                                        数字（0-9）を含む
                                                    </li>
                                                    <li className={`flex items-center gap-2 ${/[^a-zA-Z0-9]/.test(newPassword) ? 'text-green-400' : 'text-red-400'}`}>
                                                        {/[^a-zA-Z0-9]/.test(newPassword) ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                                        特殊文字（!@#$%^&*など）を含む
                                                    </li>
                                                </ul>
                                            </div>
                                            
                                            {/* パスワード強度 */}
                                            <div className="mt-2">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs text-gray-400">強度:</span>
                                                    <span className={`text-xs font-semibold ${getStrengthColor(passwordValidation.strength)}`}>
                                                        {getPasswordStrengthDescription(passwordValidation.strength)}
                                                    </span>
                                                </div>
                                                <div className="w-full bg-gray-700/50 rounded-full h-2">
                                                    <div 
                                                        className={`h-2 rounded-full transition-all ${
                                                            passwordValidation.strength === 'weak' ? 'bg-red-500' :
                                                            passwordValidation.strength === 'medium' ? 'bg-yellow-500' :
                                                            passwordValidation.strength === 'strong' ? 'bg-blue-500' :
                                                            'bg-green-500'
                                                        }`}
                                                        style={{ width: `${passwordValidation.score}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {/* エラーと警告 */}
                                            {passwordValidation.errors.length > 0 && (
                                                <div className="mt-2 space-y-1">
                                                    {passwordValidation.errors.map((err, idx) => (
                                                        <div key={idx} className="flex items-start gap-2 text-xs text-red-400">
                                                            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                                                            <span>{err}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {passwordValidation.warnings.length > 0 && (
                                                <div className="mt-2 space-y-1">
                                                    {passwordValidation.warnings.map((warn, idx) => (
                                                        <div key={idx} className="flex items-start gap-2 text-xs text-yellow-400">
                                                            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                                                            <span>{warn}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* パスワード確認 */}
                                <div className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl border border-gray-800/50">
                                    <label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="confirmPassword">
                                        新しいパスワード (確認)
                                    </label>
                                    <div className="relative">
                                        <input
                                            id="confirmPassword"
                                            type={showConfirmPassword ? "text" : "password"}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className={`w-full bg-gray-800/50 border rounded-xl px-4 py-3 pr-12 text-white focus:outline-none focus:ring-2 transition-all placeholder-gray-500 ${
                                                passwordMatch === true
                                                    ? 'border-green-500/50 focus:ring-green-500/50 focus:border-green-500/50'
                                                    : passwordMatch === false
                                                    ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50'
                                                    : 'border-gray-700/50 focus:ring-blue-500/50 focus:border-blue-500/50'
                                            }`}
                                            placeholder="新しいパスワードを再入力"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                                        >
                                            {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    </div>
                                    
                                    {/* パスワード一致確認 */}
                                    {confirmPassword && (
                                        <div className="mt-2">
                                            {passwordMatch === true ? (
                                                <div className="flex items-center gap-2 text-xs text-green-400">
                                                    <CheckCircle size={14} />
                                                    <span>パスワードが一致しています</span>
                                                </div>
                                            ) : passwordMatch === false ? (
                                                <div className="flex items-center gap-2 text-xs text-red-400">
                                                    <XCircle size={14} />
                                                    <span>パスワードが一致しません</span>
                                                </div>
                                            ) : null}
                                        </div>
                                    )}
                                </div>
                                
                                {error && (
                                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl">
                                        <div className="whitespace-pre-line">{error}</div>
                                    </div>
                                )}
                                
                                <button 
                                    type="submit" 
                                    disabled={isLoading || (passwordValidation && !passwordValidation.isValid) || passwordMatch === false}
                                    className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                                >
                                    <KeyRound size={20} /> {isLoading ? '変更中...' : 'パスワードを変更'}
                                </button>
                            </form>
                        </main>
                    </div>
                </div>
            </div>
        </>
    );
}
