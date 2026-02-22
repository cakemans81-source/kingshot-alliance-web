"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import type { AuthUser } from "@/lib/auth/AuthContext";

/* ── bcrypt 없이 SHA-256 해시 (Web Crypto API) ── */
async function hashPassword(raw: string): Promise<string> {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function AuthPage() {
    const router = useRouter();
    const { login } = useAuth();

    const [tab, setTab] = useState<"login" | "register">("login");

    /* 공통 필드 */
    const [gameId, setGameId] = useState("");
    const [password, setPassword] = useState("");

    const [confirm, setConfirm] = useState("");
    const [bio, setBio] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    /* ── 로그인 ── */
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!gameId.trim() || !password.trim()) { setError("게임 ID와 비밀번호를 입력하세요."); return; }
        setLoading(true); setError(null);

        const hashed = await hashPassword(password);
        const { data, error: err } = await supabase
            .from("users")
            .select("id, game_id, nickname, bio, role")
            .eq("game_id", gameId.trim())
            .eq("password", hashed)
            .maybeSingle();

        if (err || !data) {
            setError("게임 ID 또는 비밀번호가 올바르지 않습니다.");
        } else {
            login(data as AuthUser);
            setSuccess("로그인 성공! 🎉");
            setTimeout(() => router.push("/"), 900);
        }
        setLoading(false);
    };

    /* ── 가입 ── */
    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!gameId.trim() || !password.trim()) {
            setError("게임 ID와 비밀번호는 필수입니다."); return;
        }
        if (password !== confirm) { setError("비밀번호가 일치하지 않습니다."); return; }
        if (password.length < 4) { setError("비밀번호는 최소 4자 이상이어야 합니다."); return; }

        setLoading(true); setError(null);

        /* 중복 확인 */
        const { data: dup } = await supabase.from("users").select("id").eq("game_id", gameId.trim()).maybeSingle();
        if (dup) { setError("이미 사용 중인 게임 ID입니다."); setLoading(false); return; }

        const hashed = await hashPassword(password);
        const { data, error: err } = await supabase
            .from("users")
            .insert({ game_id: gameId.trim(), nickname: gameId.trim(), bio: bio.trim() || null, password: hashed, role: "member" })
            .select("id, game_id, nickname, bio, role")
            .single();

        if (err || !data) {
            setError("가입에 실패했습니다: " + (err?.message ?? "알 수 없는 오류"));
        } else {
            login(data as AuthUser);
            setSuccess("가입 완료! 환영합니다 🎉");
            setTimeout(() => router.push("/"), 900);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-gray-950 flex items-center justify-center px-4 py-16">
            <div className="w-full max-w-md">

                {/* 헤더 */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
                        style={{ background: "linear-gradient(135deg,rgba(6,182,212,0.25),rgba(99,102,241,0.25))", border: "1px solid rgba(6,182,212,0.35)" }}>
                        <span className="text-3xl">⚔️</span>
                    </div>
                    <h1 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-indigo-400">
                        [ KDH ] 연맹원 포털
                    </h1>
                    <p className="mt-1 text-sm text-slate-400">게임 ID로 간편하게 가입하고 로그인하세요</p>
                </div>

                {/* 탭 */}
                <div className="flex rounded-2xl p-1 mb-6"
                    style={{ background: "rgba(15,23,42,0.8)", border: "1px solid rgba(51,65,85,0.5)" }}>
                    {(["login", "register"] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => { setTab(t); setError(null); setSuccess(null); }}
                            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-200"
                            style={{
                                background: tab === t ? "linear-gradient(135deg,rgba(6,182,212,0.35),rgba(99,102,241,0.35))" : "transparent",
                                color: tab === t ? "#22d3ee" : "#64748b",
                                border: tab === t ? "1px solid rgba(6,182,212,0.4)" : "1px solid transparent",
                            }}
                        >
                            {t === "login" ? "🔑 로그인" : "✍️ 가입"}
                        </button>
                    ))}
                </div>

                {/* 폼 카드 */}
                <div className="rounded-2xl p-6 space-y-4"
                    style={{ background: "rgba(15,23,42,0.85)", border: "1px solid rgba(51,65,85,0.55)", backdropFilter: "blur(12px)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>

                    {/* 에러 / 성공 */}
                    {error && (
                        <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">⚠️ {error}</div>
                    )}
                    {success && (
                        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 text-sm text-emerald-400">✅ {success}</div>
                    )}

                    <form onSubmit={tab === "login" ? handleLogin : handleRegister} className="space-y-4">

                        {/* 게임 ID */}
                        <Field label="게임 ID" required>
                            <input
                                type="text" value={gameId} onChange={(e) => setGameId(e.target.value)}
                                placeholder="인게임 ID를 입력하세요" maxLength={30}
                                className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none transition-all"
                                style={{ background: "rgba(30,41,59,0.8)", border: "1px solid rgba(71,85,105,0.5)" }}
                                onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px rgba(6,182,212,0.4)")}
                                onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                            />
                        </Field>



                        {/* 비밀번호 */}
                        <Field label="비밀번호" required>
                            <input
                                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                                placeholder={tab === "login" ? "비밀번호" : "4자 이상"} maxLength={50}
                                className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none transition-all"
                                style={{ background: "rgba(30,41,59,0.8)", border: "1px solid rgba(71,85,105,0.5)" }}
                                onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px rgba(6,182,212,0.4)")}
                                onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                            />
                        </Field>

                        {/* 비밀번호 확인 (가입) */}
                        {tab === "register" && (
                            <Field label="비밀번호 확인" required>
                                <input
                                    type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                                    placeholder="한 번 더 입력하세요" maxLength={50}
                                    className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none transition-all"
                                    style={{ background: "rgba(30,41,59,0.8)", border: "1px solid rgba(71,85,105,0.5)" }}
                                    onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px rgba(6,182,212,0.4)")}
                                    onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                                />
                            </Field>
                        )}

                        {/* 자기소개 (가입) */}
                        {tab === "register" && (
                            <Field label="자기소개" optional>
                                <textarea
                                    value={bio} onChange={(e) => setBio(e.target.value)}
                                    placeholder="간단한 자기소개 (선택)" maxLength={100} rows={2}
                                    className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none resize-none transition-all"
                                    style={{ background: "rgba(30,41,59,0.8)", border: "1px solid rgba(71,85,105,0.5)" }}
                                    onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px rgba(6,182,212,0.4)")}
                                    onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                                />
                            </Field>
                        )}

                        <button
                            type="submit"
                            disabled={loading || !!success}
                            className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0"
                            style={{
                                background: "linear-gradient(135deg,#06b6d4,#6366f1)",
                                boxShadow: "0 4px 20px rgba(6,182,212,0.3)",
                            }}
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    처리 중…
                                </span>
                            ) : tab === "login" ? "🔑 로그인" : "✍️ 가입하기"}
                        </button>
                    </form>
                </div>

                {/* 하단 안내 */}
                <p className="text-center text-xs text-slate-600 mt-4">
                    이메일 인증 없이 게임 ID로 바로 가입됩니다
                </p>
            </div>
        </div>
    );
}

/* 라벨 래퍼 */
function Field({ label, required, optional, children }: { label: string; required?: boolean; optional?: boolean; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-400">
                {label}
                {required && <span className="text-red-400 ml-1">*</span>}
                {optional && <span className="text-slate-600 font-normal ml-1">(선택)</span>}
            </label>
            {children}
        </div>
    );
}
