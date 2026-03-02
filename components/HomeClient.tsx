"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLocale } from "@/lib/i18n/LocaleContext";
import type { LocaleCode } from "@/lib/i18n/LocaleContext";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/AuthContext";

/* ═══════════════════════════════════════════════
   타입
   ═══════════════════════════════════════════════ */

interface Item {
    id: number;
    title: string;
    created_at: string;
}

interface HomeClientProps {
    notices: Item[];
    freePosts: Item[];
}

/* ═══════════════════════════════════════════════
   날짜 포맷
   ═══════════════════════════════════════════════ */

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("ko-KR", {
        month: "2-digit",
        day: "2-digit",
    });
}

/* ═══════════════════════════════════════════════
   번역 헬퍼 및 캐시
   ═══════════════════════════════════════════════ */

function getCacheKey(locale: string, id: number, type: string) {
    return `tx_home_${locale}_${type}_${id}`;
}
function readCache(key: string): string | null {
    try { return sessionStorage.getItem(key); } catch { return null; }
}
function writeCache(key: string, value: string) {
    try { sessionStorage.setItem(key, value); } catch { /* ignore */ }
}

async function translateText(text: string, targetLang: LocaleCode): Promise<string> {
    if (!text.trim()) return text;
    const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, targetLang }),
    });
    if (!res.ok) throw new Error("Translation failed");
    const data = await res.json();
    return data.translatedText;
}

function guessLang(text: string): string {
    const koChars = (text.match(/[\uAC00-\uD7A3]/g) || []).length;
    const enChars = (text.match(/[a-zA-Z]/g) || []).length;
    const total = text.length || 1;
    return koChars / total > 0.15 ? "ko" : "en";
}

/* ═══════════════════════════════════════════════
   게임 일정 샘플 데이터
   ═══════════════════════════════════════════════ */



/* ═══════════════════════════════════════════════
   R4 간부 명단 데이터 (초기값)
   ✏️  수정 포인트: 아래 배열의 name·role을 편집하세요
   ═══════════════════════════════════════════════ */

interface Officer {
    id: string;
    name: string;
    role: string;
    icon: string;
    color: string;
    sort_order?: number;
}

const DEFAULT_OFFICERS: Officer[] = [
    {
        id: "r4-1",
        name: "닉네임 A",
        role: "role1",           /* i18n key 매핑 */
        icon: "🗡️",
        color: "rgba(139,92,246,0.35)",
    },
    {
        id: "r4-2",
        name: "닉네임 B",
        role: "role2",
        icon: "📢",
        color: "rgba(6,182,212,0.35)",
    },
    {
        id: "r4-3",
        name: "닉네임 C",
        role: "role3",
        icon: "🛡️",
        color: "rgba(16,185,129,0.35)",
    },
    {
        id: "r4-4",
        name: "닉네임 D",
        role: "role4",
        icon: "💼",
        color: "rgba(245,158,11,0.35)",
    },
];

/* Supabase 테이블: kdh_officers */

/* 관리자 비밀번호 */
const ADMIN_PASSWORD = "3741";

/* ═══════════════════════════════════════════════
   섹션 카드 (최근 공지 / 자게)
   ═══════════════════════════════════════════════ */

interface SectionCardProps {
    title: string;
    listHref: string;
    viewAllLabel: string;
    emptyHint: string;
    writeHint: string;
    badgeName: string;
    items: Item[];
    itemHref: (id: number) => string;
    type: string; // "notice" | "free"
}

function SectionCard({
    title, listHref, viewAllLabel, emptyHint, writeHint, badgeName, items, itemHref, type
}: SectionCardProps) {
    const { locale } = useLocale();
    const targetLocale = locale as LocaleCode;

    // 번역된 제목들 상태 관리
    const [translations, setTranslations] = useState<Record<number, string>>({});
    const [loadingMap, setLoadingMap] = useState<Record<number, boolean>>({});

    // 언어 변경 시 자동 번역
    useEffect(() => {
        if (targetLocale === "ko" || items.length === 0) return;
        const translateAll = async () => {
            for (const item of items) {
                if (translations[item.id]) continue;
                const isKo = guessLang(item.title) === "ko";
                if (!isKo) continue;

                const cacheKey = getCacheKey(targetLocale, item.id, type);
                const cached = readCache(cacheKey);
                if (cached) {
                    setTranslations(prev => ({ ...prev, [item.id]: cached }));
                    continue;
                }

                setLoadingMap(prev => ({ ...prev, [item.id]: true }));
                try {
                    const result = await translateText(item.title, targetLocale);
                    writeCache(cacheKey, result);
                    setTranslations(prev => ({ ...prev, [item.id]: result }));
                } catch (err) {
                    console.error("Auto translate error:", err);
                } finally {
                    setLoadingMap(prev => ({ ...prev, [item.id]: false }));
                }
            }
        };
        translateAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetLocale, items]);

    const handleItemTranslate = async (e: React.MouseEvent, item: Item) => {
        e.preventDefault();
        e.stopPropagation();

        if (translations[item.id]) {
            // 번역 토글 (원문 복원)
            setTranslations(prev => {
                const copy = { ...prev };
                delete copy[item.id];
                return copy;
            });
            return;
        }

        const cacheKey = getCacheKey(targetLocale, item.id, type);
        const cached = readCache(cacheKey);
        if (cached) {
            setTranslations(prev => ({ ...prev, [item.id]: cached }));
            return;
        }

        setLoadingMap(prev => ({ ...prev, [item.id]: true }));
        try {
            const result = await translateText(item.title, targetLocale);
            writeCache(cacheKey, result);
            setTranslations(prev => ({ ...prev, [item.id]: result }));
        } catch (err) {
            console.error("Home translation error:", err);
        } finally {
            setLoadingMap(prev => ({ ...prev, [item.id]: false }));
        }
    };
    return (
        <div
            className="mb-4 rounded-2xl border overflow-hidden"
            style={{
                background: "rgba(15,23,42,0.75)",
                borderColor: "rgba(51,65,85,0.55)",
                backdropFilter: "blur(12px)",
                boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
            }}
        >
            <div
                className="flex items-center justify-between px-5 py-3 border-b"
                style={{ borderColor: "rgba(51,65,85,0.45)" }}
            >
                <h2 className="text-sm font-bold text-slate-200">{title}</h2>
                <Link
                    href={listHref}
                    className="text-[11px] text-cyan-500 hover:text-cyan-300 transition-colors font-medium flex items-center gap-0.5"
                >
                    {viewAllLabel}
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                </Link>
            </div>

            {items.length === 0 ? (
                <div className="px-5 py-5 text-center text-slate-600 text-sm">
                    {emptyHint}&nbsp;
                    <strong className="text-amber-500">{badgeName}</strong>
                    {writeHint}
                </div>
            ) : (
                <ul className="divide-y" style={{ borderColor: "rgba(51,65,85,0.3)" }}>
                    {items.map((item, i) => {
                        const isKo = guessLang(item.title) === "ko";
                        const showTranslateBtn = !isKo && targetLocale === "ko" || isKo && targetLocale !== "ko";
                        const displayTitle = translations[item.id] || item.title;

                        return (
                            <li key={item.id}>
                                <Link
                                    href={itemHref(item.id)}
                                    className="flex items-center gap-2.5 px-4 py-2.5 transition-colors duration-150 hover:bg-slate-700/30 group"
                                >
                                    <span
                                        className="flex-shrink-0 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center translate-y-[-0.5px]"
                                        style={{
                                            background: i === 0 ? "linear-gradient(135deg, #f59e0b, #fbbf24)" : "rgba(51,65,85,0.6)",
                                            color: i === 0 ? "#fff" : "#64748b",
                                        }}
                                    >
                                        {i + 1}
                                    </span>
                                    <div className="flex-1 flex items-center min-w-0 gap-2">
                                        <span className="text-sm text-slate-300 group-hover:text-white transition-colors truncate">
                                            {displayTitle}
                                        </span>
                                        {showTranslateBtn && (
                                            <button
                                                type="button"
                                                onClick={(e) => handleItemTranslate(e, item)}
                                                disabled={loadingMap[item.id]}
                                                className="flex-shrink-0 text-[10px] text-slate-600 hover:text-cyan-400 p-1 rounded-md hover:bg-slate-800 transition-all flex items-center gap-1"
                                                title="Translate Title"
                                            >
                                                {loadingMap[item.id] ? (
                                                    <div className="w-2.5 h-2.5 border border-slate-700 border-t-cyan-500 rounded-full animate-spin" />
                                                ) : (
                                                    "🌐"
                                                )}
                                                {translations[item.id] && <span className="text-[8px] font-bold text-cyan-500/60 uppercase">Done</span>}
                                            </button>
                                        )}
                                    </div>
                                    <span className="flex-shrink-0 text-[10px] text-slate-600 whitespace-nowrap ml-1 opacity-80 group-hover:opacity-100">
                                        {formatDate(item.created_at)}
                                    </span>
                                    <svg
                                        className="flex-shrink-0 w-3.5 h-3.5 text-slate-800 group-hover:text-slate-400 transition-all transform group-hover:translate-x-0.5"
                                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════
   간부 명단 섹션 (관리자 수정 모드 포함)
   ═══════════════════════════════════════════════ */

function OfficersSection() {
    const { t } = useLocale();
    const o = t.officers;

    /* role key → 번역 텍스트 매핑 */
    const roleLabel = (key: string): string => {
        const map: Record<string, string> = {
            role1: o.role1,
            role2: o.role2,
            role3: o.role3,
            role4: o.role4,
        };
        /* 해상되지 않으면 사용자가 직접 입력한 텍스트로 간주 */
        return map[key] ?? key;
    };

    const [officers, setOfficers] = useState<Officer[]>(DEFAULT_OFFICERS);

    /* Supabase에서 간부 데이터 로드 */
    useEffect(() => {
        (async () => {
            const { data, error } = await supabase
                .from("kdh_officers")
                .select("*")
                .order("sort_order", { ascending: true });
            if (!error && data && data.length > 0) {
                setOfficers(data.map((d: { id: string; name: string; role: string; icon: string; color: string }) => ({
                    id: d.id,
                    name: d.name,
                    role: d.role,
                    icon: d.icon,
                    color: d.color,
                })));
            }
        })();
    }, []);
    const [isAdmin, setIsAdmin] = useState(false);
    const [editDraft, setEditDraft] = useState<Officer[]>([]);
    const [saveMsg, setSaveMsg] = useState<string | null>(null);

    /* 수정 버튼 유리크 — 비밀번호 확인 */
    const handleEditClick = () => {
        if (isAdmin) {
            setIsAdmin(false);
            setEditDraft([]);
            return;
        }
        const pw = window.prompt(t.officers.pwPrompt);
        if (pw === null) return;
        if (pw.trim() === ADMIN_PASSWORD) {
            setIsAdmin(true);
            setEditDraft(officers.map((of) => ({ ...of })));
        } else {
            alert(t.officers.pwWrong);
        }
    };

    const handleDraftChange = (id: string, field: "name" | "role", value: string) => {
        setEditDraft((prev) =>
            prev.map((of) => (of.id === id ? { ...of, [field]: value } : of))
        );
    };

    const handleSave = async () => {
        const newList = editDraft.map((of, i) => ({ ...of, sort_order: i }));
        setOfficers(newList);

        // Supabase에 저장 (upsert)
        for (const of2 of newList) {
            await supabase.from("kdh_officers").upsert({
                id: of2.id,
                name: of2.name,
                role: of2.role,
                icon: of2.icon,
                color: of2.color,
                sort_order: of2.sort_order,
            }, { onConflict: "id" });
        }

        setIsAdmin(false);
        setEditDraft([]);
        setSaveMsg(t.officers.saveSuccess);
        setTimeout(() => setSaveMsg(null), 2500);
    };

    return (
        <div
            className="mb-4 rounded-2xl border overflow-hidden"
            style={{
                background: "rgba(15,23,42,0.75)",
                borderColor: isAdmin ? "rgba(245,158,11,0.5)" : "rgba(51,65,85,0.55)",
                backdropFilter: "blur(12px)",
                boxShadow: isAdmin
                    ? "0 4px 24px rgba(245,158,11,0.15)"
                    : "0 4px 24px rgba(0,0,0,0.35)",
                transition: "border-color 0.3s, box-shadow 0.3s",
            }}
        >
            {/* 헤더 */}
            <div
                className="flex items-center gap-2 px-5 py-3 border-b"
                style={{ borderColor: isAdmin ? "rgba(245,158,11,0.35)" : "rgba(51,65,85,0.45)" }}
            >
                <span className="text-sm">👑</span>
                <h2 className="text-sm font-bold text-slate-200">{o.sectionTitle}</h2>
                <span
                    className="ml-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(245,158,11,0.15)", color: "#fbbf24" }}
                >
                    {o.teamCount}
                </span>

                {/* 저장 성공 메시지 */}
                {saveMsg && (
                    <span className="ml-2 text-[10px] font-semibold text-emerald-400 animate-pulse">
                        {saveMsg}
                    </span>
                )}

                {/* 수정 버튼 (우측) */}
                <button
                    type="button"
                    onClick={handleEditClick}
                    className="ml-auto flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-all duration-200 hover:opacity-80 active:scale-95"
                    style={{
                        background: isAdmin ? "rgba(245,158,11,0.2)" : "rgba(51,65,85,0.5)",
                        border: isAdmin ? "1px solid rgba(245,158,11,0.4)" : "1px solid rgba(71,85,105,0.4)",
                        color: isAdmin ? "#fbbf24" : "#94a3b8",
                    }}
                    title={isAdmin ? "수정 모드 종료" : "관리자 수정 모드"}
                >
                    {isAdmin ? (
                        <>
                            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                                <path d="M12.7 1.3a1 1 0 0 0-1.4 0L2.5 10.1 1 15l4.9-1.5 8.8-8.8a1 1 0 0 0 0-1.4l-2-2zM4.5 12.5l-2 .6.6-2 7-7 1.4 1.4-7 7z" />
                            </svg>
                            {o.editingBtn}
                        </>
                    ) : (
                        <>
                            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                                <path d="M12.7 1.3a1 1 0 0 0-1.4 0L2.5 10.1 1 15l4.9-1.5 8.8-8.8a1 1 0 0 0 0-1.4l-2-2zM4.5 12.5l-2 .6.6-2 7-7 1.4 1.4-7 7z" />
                            </svg>
                            {o.editBtn}
                        </>
                    )}
                </button>
            </div>

            {/* 관리자 모드: 인라인 편집 폼 */}
            {isAdmin ? (
                <div className="p-4 space-y-3">
                    <p className="text-[10px] text-amber-400/80 mb-2">
                        {o.adminMode}
                    </p>
                    {editDraft.map((officer) => (
                        <div
                            key={officer.id}
                            className="flex items-start gap-3 p-3 rounded-xl"
                            style={{
                                background: "rgba(30,41,59,0.6)",
                                border: "1px solid rgba(71,85,105,0.4)",
                            }}
                        >
                            <div
                                className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-lg mt-0.5"
                                style={{
                                    background: officer.color,
                                    border: `1px solid ${officer.color.replace("0.35", "0.6")}`,
                                }}
                            >
                                {officer.icon}
                            </div>
                            <div className="flex-1 space-y-1.5">
                                <input
                                    type="text"
                                    value={officer.name}
                                    onChange={(e) => handleDraftChange(officer.id, "name", e.target.value)}
                                    placeholder="닉네임"
                                    maxLength={30}
                                    className="w-full rounded-lg px-3 py-1.5 text-sm font-bold text-white outline-none"
                                    style={{
                                        background: "rgba(15,23,42,0.8)",
                                        border: "1px solid rgba(245,158,11,0.4)",
                                    }}
                                    onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px rgba(245,158,11,0.3)")}
                                    onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                                />
                                <input
                                    type="text"
                                    value={roleLabel(officer.role)}
                                    onChange={(e) => handleDraftChange(officer.id, "role", e.target.value)}
                                    placeholder="역할 설명"
                                    maxLength={60}
                                    className="w-full rounded-lg px-3 py-1.5 text-xs text-slate-400 outline-none"
                                    style={{
                                        background: "rgba(15,23,42,0.8)",
                                        border: "1px solid rgba(71,85,105,0.4)",
                                    }}
                                    onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px rgba(245,158,11,0.2)")}
                                    onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                                />
                            </div>
                            <span
                                className="flex-shrink-0 text-[9px] font-black px-2 py-0.5 rounded-full tracking-widest mt-1"
                                style={{
                                    background: "rgba(245,158,11,0.15)",
                                    border: "1px solid rgba(245,158,11,0.3)",
                                    color: "#fbbf24",
                                }}
                            >
                                {o.r4Label}
                            </span>
                        </div>
                    ))}

                    <div className="flex gap-2 pt-1">
                        <button
                            type="button"
                            onClick={handleSave}
                            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5"
                            style={{
                                background: "linear-gradient(135deg, #f59e0b, #fbbf24)",
                                color: "#1a1a1a",
                                boxShadow: "0 4px 14px rgba(245,158,11,0.3)",
                            }}
                        >
                            {o.saveBtn}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setIsAdmin(false); setEditDraft([]); }}
                            className="px-4 py-2.5 rounded-xl text-sm font-medium transition-colors hover:text-white"
                            style={{
                                background: "rgba(30,41,59,0.6)",
                                border: "1px solid rgba(71,85,105,0.4)",
                                color: "#94a3b8",
                            }}
                        >
                            {o.cancelBtn}
                        </button>
                    </div>
                </div>
            ) : (
                /* 일반 모드: 간부 리스트 */
                <ul className="divide-y" style={{ borderColor: "rgba(51,65,85,0.3)" }}>
                    {officers.map((officer) => (
                        <li key={officer.id}>
                            <div className="flex items-center gap-3 px-4 py-3">
                                <div
                                    className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                                    style={{
                                        background: officer.color,
                                        border: `1px solid ${officer.color.replace("0.35", "0.6")}`,
                                    }}
                                >
                                    {officer.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-slate-200 leading-tight">
                                        {officer.name}
                                    </p>
                                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5 truncate">
                                        {roleLabel(officer.role)}
                                    </p>
                                </div>
                                <span
                                    className="flex-shrink-0 text-[9px] font-black px-2 py-0.5 rounded-full tracking-widest"
                                    style={{
                                        background: "rgba(245,158,11,0.15)",
                                        border: "1px solid rgba(245,158,11,0.3)",
                                        color: "#fbbf24",
                                    }}
                                >
                                    {o.r4Label}
                                </span>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════
   메인 클라이언트 컴포넌트
   ═══════════════════════════════════════════════ */

export default function HomeClient({ notices, freePosts }: HomeClientProps) {
    const { t } = useLocale();
    const { user, logout } = useAuth();

    /* ── 검색 엔진 ── */
    const [searchTerm, setSearchTerm] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<(Item & { board: string; author: string })[]>([]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const query = searchTerm.trim();
        if (!query) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            // 공지사항 검색
            const { data: nData } = await supabase
                .from("notices")
                .select("id, title, author, content, created_at")
                .or(`author.ilike.%${query}%,title.ilike.%${query}%,content.ilike.%${query}%`)
                .limit(10);

            // 자유게시판 검색
            const { data: fData } = await supabase
                .from("free_board")
                .select("id, title, author, content, created_at")
                .or(`author.ilike.%${query}%,title.ilike.%${query}%,content.ilike.%${query}%`)
                .limit(10);

            const merged = [
                ...(nData || []).map(i => ({ ...i, board: "notice" })),
                ...(fData || []).map(i => ({ ...i, board: "free-board" }))
            ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            setSearchResults(merged as any);
        } catch (err) {
            console.error("Search failed:", err);
        } finally {
            setIsSearching(false);
        }
    };

    const QUICK_LINKS = [
        {
            href: "/kdh-grid",
            icon: "🗺️",
            label: t.quickLinks.kdhGrid,
            description: t.quickLinks.kdhGridDesc,
            gradient: "from-cyan-500 to-blue-600",
            glow: "rgba(6,182,212,0.35)",
            border: "rgba(6,182,212,0.3)",
        },
    ];

    return (
        <section className="relative z-10 mx-auto max-w-2xl px-4 pt-8 pb-24 sm:px-6">

            {/* ── [1] 환영 타이틀 ── */}
            <div className="text-center mb-6">
                <div
                    className="mb-3 inline-flex items-center gap-2 rounded-full border px-3.5 py-1 text-[11px] font-semibold tracking-widest uppercase"
                    style={{
                        background: "rgba(6,182,212,0.08)",
                        borderColor: "rgba(6,182,212,0.28)",
                        color: "#67e8f9",
                    }}
                >
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    {t.home.badge}
                </div>

                <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight tracking-tight">
                    <span
                        className="block bg-clip-text text-transparent mb-0.5"
                        style={{
                            backgroundImage: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 40%, #fcd34d 70%, #f59e0b 100%)",
                            filter: "drop-shadow(0 0 12px rgba(251,191,36,0.5))",
                            letterSpacing: "0.04em",
                        }}
                    >
                        {t.home.titleBrand}
                    </span>
                    <span
                        className="block bg-clip-text text-transparent"
                        style={{ backgroundImage: "linear-gradient(135deg, #ffffff 0%, #e2e8f0 40%, #94a3b8 100%)" }}
                    >
                        {t.home.titleLine1}
                    </span>
                    <span
                        className="block bg-clip-text text-transparent"
                        style={{
                            backgroundImage: "linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #8b5cf6 100%)",
                            filter: "drop-shadow(0 0 16px rgba(6,182,212,0.35))",
                        }}
                    >
                        {t.home.titleLine2}
                    </span>
                </h1>
                <p className="mt-2 text-sm sm:text-base text-slate-400 leading-relaxed">
                    {t.home.subtitle}{" "}
                    <span className="font-semibold text-cyan-400">{t.home.subtitleHighlight}</span>
                    {t.home.subtitleEnd}
                </p>
            </div>

            {/* ── [1.5] 사용자 환영 & 로그아웃 (로그인 시 노출) ── */}
            {user ? (
                <div
                    className="mb-8 rounded-2xl border animate-in fade-in slide-in-from-top-2 duration-500 overflow-hidden"
                    style={{
                        background: "linear-gradient(135deg, rgba(15,23,42,0.85), rgba(30,41,59,0.6))",
                        borderColor: "rgba(99,102,241,0.3)",
                        backdropFilter: "blur(12px)",
                        boxShadow: "0 4px 24px rgba(99,102,241,0.12), 0 0 0 1px rgba(99,102,241,0.08) inset",
                    }}
                >
                    {/* 상단: 유저 정보 */}
                    <div className="flex items-center gap-4 px-5 py-4">
                        {/* 아바타 */}
                        <div
                            className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold overflow-hidden flex-shrink-0"
                            style={{
                                background: "linear-gradient(135deg, rgba(99,102,241,0.35), rgba(6,182,212,0.25))",
                                border: "1.5px solid rgba(99,102,241,0.5)",
                                boxShadow: "0 0 12px rgba(99,102,241,0.25)",
                            }}
                        >
                            {user.avatar_url ? (
                                <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                            ) : (
                                "👤"
                            )}
                        </div>

                        {/* 텍스트 */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-base font-extrabold text-white truncate tracking-tight">
                                    {user.nickname}
                                </span>
                                <span
                                    className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest flex-shrink-0"
                                    style={{
                                        background: user.role === "admin"
                                            ? "linear-gradient(135deg, rgba(245,158,11,0.3), rgba(251,191,36,0.2))"
                                            : "rgba(99,102,241,0.2)",
                                        border: user.role === "admin"
                                            ? "1px solid rgba(245,158,11,0.5)"
                                            : "1px solid rgba(99,102,241,0.4)",
                                        color: user.role === "admin" ? "#fbbf24" : "#a5b4fc",
                                    }}
                                >
                                    {user.role}
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5 truncate">
                                환영합니다! 오늘 하루도 건승하세요 ⚔️
                            </p>
                        </div>
                    </div>

                    {/* 하단: 버튼 영역 */}
                    <div
                        className="flex items-center gap-2 px-5 py-3 border-t"
                        style={{ borderColor: "rgba(99,102,241,0.15)", background: "rgba(15,23,42,0.3)" }}
                    >
                        <Link
                            href="/profile"
                            className="flex-1 text-center py-2 rounded-xl text-xs font-bold transition-all duration-200 hover:brightness-110 active:scale-95"
                            style={{
                                background: "rgba(99,102,241,0.15)",
                                border: "1px solid rgba(99,102,241,0.3)",
                                color: "#a5b4fc",
                            }}
                        >
                            ✏️ 정보 수정
                        </Link>
                        <button
                            onClick={() => { if (confirm("로그아웃 하시겠습니까?")) logout(); }}
                            className="flex-1 py-2 rounded-xl text-xs font-bold transition-all duration-200 hover:brightness-110 active:scale-95"
                            style={{
                                background: "rgba(239,68,68,0.12)",
                                border: "1px solid rgba(239,68,68,0.3)",
                                color: "#f87171",
                            }}
                        >
                            🚪 로그아웃
                        </button>
                    </div>
                </div>
            ) : (
                <div
                    className="mb-8 p-6 rounded-2xl border text-center animate-in fade-in duration-500"
                    style={{
                        background: "linear-gradient(135deg, rgba(15, 23, 42, 0.6), rgba(30, 41, 59, 0.4))",
                        borderColor: "rgba(6, 182, 212, 0.2)",
                    }}
                >
                    <p className="text-sm text-slate-400 mb-4">로그인하시면 연맹 소식을 더욱 빠르게 확인하고 활동할 수 있습니다.</p>
                    <Link
                        href="/auth"
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black text-white hover:brightness-110 transition-all active:scale-95"
                        style={{
                            background: "linear-gradient(135deg, #06b6d4, #6366f1)",
                            boxShadow: "0 4px 15px rgba(6, 182, 212, 0.3)",
                        }}
                    >
                        🔑 로그인하여 시작하기
                    </Link>
                </div>
            )
            }



            {/* ── [2] 통합 검색창 ── */}
            <div className="mb-8">
                <form
                    onSubmit={handleSearch}
                    className="relative group flex items-center gap-2"
                >
                    <div className="relative flex-1">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={t.search.placeholder}
                            className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl px-5 py-3.5 text-sm text-white placeholder:text-slate-600 outline-none transition-all focus:border-cyan-500/50 focus:bg-slate-900/80"
                            style={{ backdropFilter: "blur(8px)" }}
                        />
                        <button
                            type="submit"
                            disabled={isSearching}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-cyan-400 transition-colors disabled:opacity-30"
                        >
                            {isSearching ? (
                                <div className="w-4 h-4 border-2 border-slate-600 border-t-cyan-500 rounded-full animate-spin" />
                            ) : (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            )}
                        </button>
                    </div>
                </form>

                {/* 검색 결과 표시 섹션 */}
                {searchTerm.trim() !== "" && (
                    <div
                        className="mt-4 rounded-2xl border overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300"
                        style={{
                            background: "rgba(15,23,42,0.9)",
                            borderColor: "rgba(6,182,212,0.3)",
                            boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(6,182,212,0.1)",
                        }}
                    >
                        <div className="px-5 py-2.5 bg-cyan-500/10 border-b border-cyan-500/20 flex items-center justify-between">
                            <h3 className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                                🔍 {t.search.results}
                                <span className="text-[10px] text-cyan-500/60 font-medium">({searchResults.length})</span>
                            </h3>
                            <span className="text-[10px] text-slate-500">{t.search.allBoards}</span>
                        </div>
                        {searchResults.length === 0 ? (
                            <div className="px-5 py-10 text-center">
                                <p className="text-sm text-slate-500 italic">{isSearching ? t.board.loading : t.search.noResults}</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-slate-800/50">
                                {searchResults.map((item) => (
                                    <li key={`${item.board}-${item.id}`}>
                                        <Link
                                            href={`/${item.board}/${item.id}`}
                                            className="flex flex-col gap-1 px-5 py-3 hover:bg-slate-800/40 transition-colors group"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-sm font-semibold text-slate-200 group-hover:text-cyan-300 transition-colors truncate">
                                                    {item.title}
                                                </span>
                                                <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 border border-slate-700">
                                                    {item.board === "notice" ? t.nav.notice : t.nav.freeBoard}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] text-slate-600">
                                                <span className="font-medium text-slate-500">👤 {item.author || "익명"}</span>
                                                <span className="text-slate-800">|</span>
                                                <span>{formatDate(item.created_at)}</span>
                                            </div>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <button
                            onClick={() => { setSearchTerm(""); setSearchResults([]); }}
                            className="w-full py-2 text-[10px] text-slate-600 hover:text-slate-400 transition-colors bg-slate-900/30"
                        >
                            닫기
                        </button>
                    </div>
                )}
            </div>

            {/* ── [3] 최근 공지사항 ── */}
            <SectionCard
                title={t.home.recentNotice}
                listHref="/notice"
                viewAllLabel={t.home.viewAll}
                emptyHint={t.home.noNotice}
                writeHint={t.home.writeHint}
                badgeName={t.fab.notice}
                items={notices}
                itemHref={(id) => `/notice/${id}`}
                type="notice"
            />

            {/* ── [4] 최근 자유게시판 ── */}
            <SectionCard
                title={t.home.recentFreeBoard}
                listHref="/free-board"
                viewAllLabel={t.home.viewAll}
                emptyHint={t.home.noFreePost}
                writeHint={t.home.writeHint}
                badgeName={t.fab.freeBoard}
                items={freePosts}
                itemHref={(id) => `/free-board/${id}`}
                type="free"
            />

            {/* ── [5] 퀵 링크 ── */}
            {
                QUICK_LINKS.map((link) => (
                    <Link
                        key={link.href}
                        href={link.href}
                        className="group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl px-5 py-4 mb-4 transition-all duration-300 hover:scale-[1.01] hover:-translate-y-0.5"
                        style={{
                            background: "linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.75))",
                            border: `1px solid ${link.border}`,
                            boxShadow: `0 4px 20px ${link.glow}`,
                        }}
                    >
                        <div
                            className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                            style={{ background: `linear-gradient(135deg, ${link.glow.replace("0.35", "0.10")}, transparent)` }}
                        />
                        <span
                            className={`relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-xl bg-gradient-to-br ${link.gradient} transition-transform duration-300 group-hover:scale-110`}
                            style={{ boxShadow: `0 3px 10px ${link.glow}` }}
                        >
                            {link.icon}
                        </span>
                        <div className="relative flex flex-col text-left min-w-0 flex-1">
                            <span className="text-sm font-bold text-white">{link.label}</span>
                            <span className="text-xs text-slate-400">{link.description}</span>
                        </div>
                        <div className="relative ml-auto text-slate-600 transition-all duration-300 group-hover:translate-x-1 group-hover:text-white flex-shrink-0">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </Link>
                ))
            }

            {/* ── [5-2] 연맹 이벤트 참여 현황 카드 (KDH 그리드 아래) ── */}
            <Link
                href="/event-attendance"
                className="group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl px-5 py-4 mb-4 transition-all duration-300 hover:scale-[1.01] hover:-translate-y-0.5"
                style={{
                    background: "linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.75))",
                    border: "1px solid rgba(245,158,11,0.3)",
                    boxShadow: "0 4px 20px rgba(245,158,11,0.12)",
                }}
            >
                {/* hover glow overlay */}
                <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.08), transparent)" }} />
                {/* 아이콘 */}
                <span className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-xl transition-transform duration-300 group-hover:scale-110"
                    style={{ background: "linear-gradient(135deg,rgba(245,158,11,0.7),rgba(251,191,36,0.7))", boxShadow: "0 3px 10px rgba(245,158,11,0.35)" }}>
                    📋
                </span>
                {/* 텍스트 */}
                <div className="relative flex flex-col text-left min-w-0 flex-1">
                    <span className="text-sm font-bold text-white">연맹 이벤트 참여 현황</span>
                    <span className="text-xs text-slate-400">이벤트별 출석 · 참석/불참 현황 관리</span>
                </div>
                {/* 화살표 */}
                <div className="relative ml-auto text-slate-600 transition-all duration-300 group-hover:translate-x-1 group-hover:text-amber-400 flex-shrink-0">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                </div>
            </Link>

            {/* ══════════════════════════════════════════
                [6] 👑 간부 (R4) 명단 — 최하단 배치
                관리자 비밀번호: 3741
                ══════════════════════════════════════════ */}
            <OfficersSection />


        </section>
    );
}
