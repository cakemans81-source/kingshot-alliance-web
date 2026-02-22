"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import type { UserRole } from "@/lib/auth/AuthContext";

interface Member {
    id: number;
    game_id: string;
    nickname: string;
    bio: string | null;
    avatar_url: string | null;
    role: UserRole;
    created_at: string;
}

const ROLE_ORDER: UserRole[] = ["member", "staff", "admin"];
const ROLE_LABEL: Record<UserRole, string> = {
    admin: "👑 관리자",
    staff: "⭐ 간부",
    member: "🛡️ 연맹원",
};
const ROLE_COLOR: Record<UserRole, string> = {
    admin: "rgba(251,191,36,0.85)",
    staff: "rgba(99,102,241,0.85)",
    member: "rgba(6,182,212,0.7)",
};

export default function AdminPage() {
    const router = useRouter();
    const { user } = useAuth();

    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<UserRole | "all">("all");
    const [saving, setSaving] = useState<number | null>(null);
    const [msg, setMsg] = useState<{ id: number; text: string; ok: boolean } | null>(null);
    const [kickTarget, setKickTarget] = useState<Member | null>(null);
    const [kicking, setKicking] = useState(false);

    /* 권한 체크 */
    useEffect(() => {
        if (user === null) { router.replace("/auth"); return; }
        if (user.role !== "admin") { router.replace("/"); }
    }, [user, router]);

    /* 전체 멤버 로드 */
    const load = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase
            .from("users")
            .select("id, game_id, nickname, bio, role, avatar_url, created_at")
            .order("created_at", { ascending: true });
        if (data) setMembers(data as Member[]);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    /* 권한 변경 */
    const changeRole = async (id: number, newRole: UserRole) => {
        setSaving(id);
        const { error } = await supabase.from("users").update({ role: newRole }).eq("id", id);
        if (error) {
            setMsg({ id, text: "변경 실패: " + error.message, ok: false });
        } else {
            setMembers((prev) => prev.map((m) => m.id === id ? { ...m, role: newRole } : m));
            setMsg({ id, text: `${ROLE_LABEL[newRole]}으로 변경됨`, ok: true });
        }
        setSaving(null);
        setTimeout(() => setMsg(null), 2000);
    };

    /* 멤버 추방 */
    const handleKick = async () => {
        if (!kickTarget) return;
        setKicking(true);
        const { error } = await supabase.from("users").delete().eq("id", kickTarget.id);
        if (error) {
            alert("추방 실패: " + error.message);
        } else {
            setMembers((prev) => prev.filter((m) => m.id !== kickTarget.id));
            setKickTarget(null);
        }
        setKicking(false);
    };

    if (!user || user.role !== "admin") return null;

    const filtered = members.filter((m) => {
        const q = search.toLowerCase();
        const matchSearch = !q || m.game_id.toLowerCase().includes(q) || m.nickname.toLowerCase().includes(q);
        const matchFilter = filter === "all" || m.role === filter;
        return matchSearch && matchFilter;
    });

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-gray-950 text-white px-4 py-10">
            <div className="mx-auto max-w-4xl">

                {/* 헤더 */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">👑</span>
                        <h1 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-orange-400">
                            연맹 관리자 패널
                        </h1>
                    </div>
                    <p className="text-sm text-slate-400">전체 가입자를 관리하고 권한을 조정하세요.</p>
                </div>

                {/* 통계 카드 */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                    {(["member", "staff", "admin"] as UserRole[]).map((r) => {
                        const cnt = members.filter((m) => m.role === r).length;
                        return (
                            <div key={r} className="rounded-2xl p-4 text-center"
                                style={{ background: "rgba(15,23,42,0.7)", border: "1px solid rgba(51,65,85,0.5)" }}>
                                <p className="text-2xl font-extrabold" style={{ color: ROLE_COLOR[r] }}>{cnt}</p>
                                <p className="text-xs text-slate-500 mt-1">{ROLE_LABEL[r]}</p>
                            </div>
                        );
                    })}
                </div>

                {/* 검색 + 필터 */}
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                    <input
                        type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                        placeholder="🔍 게임ID 또는 닉네임 검색"
                        className="flex-1 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none"
                        style={{ background: "rgba(30,41,59,0.8)", border: "1px solid rgba(71,85,105,0.5)" }}
                        onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px rgba(6,182,212,0.35)")}
                        onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                    />
                    <div className="flex gap-1.5">
                        {(["all", "member", "staff", "admin"] as const).map((f) => (
                            <button key={f} onClick={() => setFilter(f)}
                                className="px-3 py-2 rounded-xl text-xs font-bold transition-all"
                                style={{
                                    background: filter === f ? "rgba(6,182,212,0.25)" : "rgba(30,41,59,0.6)",
                                    border: filter === f ? "1px solid rgba(6,182,212,0.5)" : "1px solid rgba(71,85,105,0.4)",
                                    color: filter === f ? "#22d3ee" : "#64748b",
                                }}>
                                {f === "all" ? "전체" : ROLE_LABEL[f]}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 멤버 테이블 */}
                <div className="rounded-2xl overflow-hidden"
                    style={{ background: "rgba(15,23,42,0.8)", border: "1px solid rgba(51,65,85,0.5)" }}>

                    {/* 헤더 행 */}
                    <div className="grid grid-cols-12 gap-2 px-4 py-3 text-[10px] font-semibold text-slate-600 uppercase tracking-wider"
                        style={{ borderBottom: "1px solid rgba(51,65,85,0.4)" }}>
                        <span className="col-span-1">#</span>
                        <span className="col-span-3">게임 ID</span>
                        <span className="col-span-3">닉네임</span>
                        <span className="col-span-2">현재 권한</span>
                        <span className="col-span-3 text-right">권한 변경</span>
                    </div>

                    {loading ? (
                        <div className="py-12 flex items-center justify-center">
                            <span className="inline-block w-6 h-6 border-2 border-slate-700 border-t-cyan-400 rounded-full animate-spin" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-12 text-center text-sm text-slate-600">검색 결과가 없습니다.</div>
                    ) : (
                        filtered.map((m, idx) => (
                            <div
                                key={m.id}
                                className="grid grid-cols-12 gap-2 px-4 py-3 items-center transition-colors hover:bg-white/[0.02]"
                                style={{ borderBottom: "1px solid rgba(51,65,85,0.25)" }}
                            >
                                <span className="col-span-1 text-[10px] text-slate-700">{idx + 1}</span>
                                <span className="col-span-3 text-xs text-slate-300 font-mono truncate">{m.game_id}</span>
                                <span className="col-span-3 text-xs text-white font-semibold truncate">{m.nickname}</span>
                                <span className="col-span-2">
                                    <span
                                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                        style={{
                                            background: `${ROLE_COLOR[m.role]}22`,
                                            color: ROLE_COLOR[m.role],
                                            border: `1px solid ${ROLE_COLOR[m.role]}55`,
                                        }}
                                    >
                                        {ROLE_LABEL[m.role]}
                                    </span>
                                </span>
                                <div className="col-span-3 flex items-center justify-end gap-1.5">
                                    {/* 메시지 */}
                                    {msg?.id === m.id && (
                                        <span className={`text-[10px] font-semibold ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>
                                            {msg.ok ? "✅" : "⚠️"} {msg.text}
                                        </span>
                                    )}
                                    {/* 권한 변경 드롭다운 (자기 자신 제외) */}
                                    {m.id !== user.id && (
                                        <div className="flex items-center gap-1.5">
                                            <select
                                                value={m.role}
                                                disabled={saving === m.id}
                                                onChange={(e) => changeRole(m.id, e.target.value as UserRole)}
                                                className="rounded-xl px-2 py-1.5 text-xs outline-none transition-all disabled:opacity-50 disabled:cursor-wait"
                                                style={{
                                                    background: "rgba(30,41,59,0.9)",
                                                    border: "1px solid rgba(71,85,105,0.5)",
                                                    color: "#cbd5e1",
                                                }}
                                            >
                                                {ROLE_ORDER.map((r) => (
                                                    <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                                                ))}
                                            </select>

                                            {/* 추방 버튼 */}
                                            <button
                                                onClick={() => setKickTarget(m)}
                                                className="p-1.5 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors"
                                                title="연맹에서 추방"
                                                style={{ border: "1px solid rgba(239, 68, 68, 0.3)" }}
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
                                                </svg>
                                            </button>
                                        </div>
                                    )}
                                    {m.id === user.id && (
                                        <span className="text-[10px] text-slate-700 italic">본인</span>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <p className="text-[10px] text-slate-700 mt-3 text-center">
                    총 {members.length}명 가입 · 현재 {filtered.length}명 표시
                </p>
            </div>

            {/* 추방 확인 모달 */}
            {kickTarget && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm"
                    onClick={(e) => { if (e.target === e.currentTarget) setKickTarget(null); }}
                >
                    <div
                        className="w-full max-w-sm rounded-3xl p-6 space-y-5 animate-in fade-in zoom-in duration-200"
                        style={{
                            background: "rgba(15,23,42,0.98)",
                            border: "1px solid rgba(239, 68, 68, 0.4)",
                            boxShadow: "0 0 40px rgba(239, 68, 68, 0.1)"
                        }}
                    >
                        <div className="text-center space-y-2">
                            <span className="text-4xl">⚠️</span>
                            <h2 className="text-xl font-bold text-white">연맹원 추방 확인</h2>
                            <p className="text-sm text-slate-400 leading-relaxed">
                                <span className="text-red-400 font-bold">[{kickTarget.nickname}]</span> 님을 연맹에서 정말로 추방하시겠습니까? <br />
                                <span className="text-[11px] text-slate-500 mt-1 block">(계정이 삭제되며 복구할 수 없습니다)</span>
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setKickTarget(null)}
                                className="flex-1 py-3 rounded-2xl text-sm font-semibold text-slate-400 hover:text-white transition-colors"
                                style={{ background: "rgba(51,65,85,0.4)", border: "1px solid rgba(71,85,105,0.3)" }}
                            >취소</button>
                            <button
                                onClick={handleKick}
                                disabled={kicking}
                                className="flex-1 py-3 rounded-2xl text-sm font-bold text-white transition-all hover:brightness-110 disabled:opacity-50"
                                style={{
                                    background: "linear-gradient(135deg, #ef4444, #b91c1c)",
                                    boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)"
                                }}
                            >
                                {kicking ? "추방 중..." : "확인, 추방합니다"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
