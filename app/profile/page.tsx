"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/AuthContext";

export default function ProfilePage() {
    const router = useRouter();
    const { user, updateUser, logout } = useAuth();

    const [nickname, setNickname] = useState("");
    const [bio, setBio] = useState("");
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /* 로그인 체크 */
    useEffect(() => {
        if (user === null) {
            router.replace("/auth");
        } else {
            setNickname(user.nickname);
            setBio(user.bio ?? "");
        }
    }, [user, router]);

    if (!user) return null;

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nickname.trim()) { setError("닉네임을 입력해 주세요."); return; }
        setSaving(true); setError(null); setSuccess(false);

        const { error: err } = await supabase
            .from("users")
            .update({ nickname: nickname.trim(), bio: bio.trim() || null })
            .eq("id", user.id);

        if (err) {
            setError("저장 실패: " + err.message);
        } else {
            updateUser({ nickname: nickname.trim(), bio: bio.trim() || null });
            setSuccess(true);
            setTimeout(() => setSuccess(false), 2500);
        }
        setSaving(false);
    };

    const roleLabel: Record<string, string> = {
        admin: "👑 관리자",
        staff: "⭐ 간부",
        member: "🛡️ 연맹원",
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-gray-950 flex items-center justify-center px-4 py-16">
            <div className="w-full max-w-md">

                {/* 헤더 */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
                        style={{ background: "linear-gradient(135deg,rgba(6,182,212,0.25),rgba(99,102,241,0.25))", border: "1px solid rgba(6,182,212,0.35)" }}>
                        <span className="text-3xl">👤</span>
                    </div>
                    <h1 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-indigo-400">
                        내 프로필
                    </h1>
                    {/* 현재 권한 뱃지 */}
                    <span
                        className="inline-block mt-2 text-xs font-bold px-3 py-1 rounded-full"
                        style={{
                            background: user.role === "admin" ? "rgba(251,191,36,0.2)" : user.role === "staff" ? "rgba(99,102,241,0.2)" : "rgba(6,182,212,0.15)",
                            color: user.role === "admin" ? "#fbbf24" : user.role === "staff" ? "#a5b4fc" : "#22d3ee",
                            border: `1px solid ${user.role === "admin" ? "rgba(251,191,36,0.4)" : user.role === "staff" ? "rgba(99,102,241,0.4)" : "rgba(6,182,212,0.3)"}`,
                        }}
                    >
                        {roleLabel[user.role] ?? user.role}
                    </span>
                </div>

                {/* 정보 카드 */}
                <div className="rounded-2xl p-6 space-y-5"
                    style={{ background: "rgba(15,23,42,0.85)", border: "1px solid rgba(51,65,85,0.55)", backdropFilter: "blur(12px)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>

                    {/* 게임 ID (읽기 전용) */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-400">게임 ID <span className="text-slate-600 font-normal">(변경 불가)</span></label>
                        <div
                            className="w-full rounded-xl px-4 py-3 text-sm text-slate-500"
                            style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(51,65,85,0.4)" }}
                        >
                            {user.game_id}
                        </div>
                    </div>

                    {/* 에러 / 성공 */}
                    {error && <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">⚠️ {error}</div>}
                    {success && <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 text-sm text-emerald-400">✅ 저장되었습니다!</div>}

                    <form onSubmit={handleSave} className="space-y-4">
                        {/* 닉네임 */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-slate-400">닉네임 <span className="text-red-400">*</span></label>
                            <input
                                type="text" value={nickname} onChange={(e) => setNickname(e.target.value)}
                                placeholder="닉네임" maxLength={20}
                                className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none transition-all"
                                style={{ background: "rgba(30,41,59,0.8)", border: "1px solid rgba(71,85,105,0.5)" }}
                                onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px rgba(6,182,212,0.4)")}
                                onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                            />
                        </div>

                        {/* 자기소개 */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-slate-400">자기소개 <span className="text-slate-600 font-normal">(선택)</span></label>
                            <textarea
                                value={bio} onChange={(e) => setBio(e.target.value)}
                                placeholder="한 줄 소개를 입력하세요" maxLength={100} rows={3}
                                className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none resize-none transition-all"
                                style={{ background: "rgba(30,41,59,0.8)", border: "1px solid rgba(71,85,105,0.5)" }}
                                onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px rgba(6,182,212,0.4)")}
                                onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                            />
                        </div>

                        <div className="flex gap-3 pt-1">
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all duration-200 disabled:opacity-50 hover:brightness-110 hover:-translate-y-0.5"
                                style={{ background: "linear-gradient(135deg,#06b6d4,#6366f1)", boxShadow: "0 4px 16px rgba(6,182,212,0.3)" }}
                            >
                                {saving ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        저장 중…
                                    </span>
                                ) : "✅ 저장"}
                            </button>
                            <button
                                type="button"
                                onClick={() => { logout(); router.push("/"); }}
                                className="px-5 py-3 rounded-xl text-sm font-semibold text-slate-400 hover:text-red-400 transition-colors"
                                style={{ background: "rgba(30,41,59,0.6)", border: "1px solid rgba(71,85,105,0.4)" }}
                            >
                                🚪 로그아웃
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
