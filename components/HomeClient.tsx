"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/LocaleContext";

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
   게임 일정 샘플 데이터
   ═══════════════════════════════════════════════ */

interface ScheduleEvent {
    id: string;
    icon: string;
    title: string;
    subtitle: string;
    time: string;
    status: "live" | "soon" | "ended";
    gradient: string;
    border: string;
    glow: string;
}

const SCHEDULE_EVENTS: ScheduleEvent[] = [
    {
        id: "holy-sword",
        icon: "⚔️",
        title: "성검 전투",
        subtitle: "전 연맹 필참",
        time: "매일 20:00",
        status: "live",
        gradient: "from-violet-600 to-purple-700",
        border: "rgba(139,92,246,0.45)",
        glow: "rgba(139,92,246,0.3)",
    },
    {
        id: "three-alliances",
        icon: "🏰",
        title: "삼대 연맹전",
        subtitle: "3대 연맹 참전",
        time: "토·일 21:00",
        status: "soon",
        gradient: "from-sky-500 to-blue-600",
        border: "rgba(14,165,233,0.45)",
        glow: "rgba(14,165,233,0.3)",
    },
    {
        id: "top-kingdom",
        icon: "👑",
        title: "최강 왕국",
        subtitle: "왕국 랭킹전",
        time: "금~일 진행",
        status: "live",
        gradient: "from-amber-500 to-yellow-600",
        border: "rgba(245,158,11,0.45)",
        glow: "rgba(245,158,11,0.3)",
    },
    {
        id: "divine-beast",
        icon: "🦄",
        title: "신수의 선물",
        subtitle: "신수 사냥 보상",
        time: "매일 18:00",
        status: "live",
        gradient: "from-emerald-500 to-teal-600",
        border: "rgba(16,185,129,0.45)",
        glow: "rgba(16,185,129,0.3)",
    },
    {
        id: "supply-drop",
        icon: "📦",
        title: "보급 지원",
        subtitle: "연맹 물자 강화",
        time: "화·목 15:00",
        status: "soon",
        gradient: "from-rose-500 to-pink-600",
        border: "rgba(244,63,94,0.45)",
        glow: "rgba(244,63,94,0.3)",
    },
    {
        id: "world-boss",
        icon: "🐉",
        title: "월드 보스",
        subtitle: "공통 공격 이벤트",
        time: "수·토 19:30",
        status: "ended",
        gradient: "from-slate-500 to-gray-600",
        border: "rgba(100,116,139,0.45)",
        glow: "rgba(100,116,139,0.2)",
    },
];

const STATUS_BADGE: Record<ScheduleEvent["status"], { label: string; color: string; bg: string }> = {
    live: { label: "● LIVE", color: "#4ade80", bg: "rgba(74,222,128,0.12)" },
    soon: { label: "◎ 예정", color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
    ended: { label: "✕ 종료", color: "#64748b", bg: "rgba(100,116,139,0.12)" },
};

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
}

function SectionCard({
    title, listHref, viewAllLabel, emptyHint, writeHint, badgeName, items, itemHref,
}: SectionCardProps) {
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
                    {items.map((item, i) => (
                        <li key={item.id}>
                            <Link
                                href={itemHref(item.id)}
                                className="flex items-center gap-3 px-5 py-2 transition-colors duration-150 hover:bg-slate-700/30 group"
                            >
                                <span
                                    className="flex-shrink-0 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center"
                                    style={{
                                        background: i === 0 ? "linear-gradient(135deg, #f59e0b, #fbbf24)" : "rgba(51,65,85,0.6)",
                                        color: i === 0 ? "#fff" : "#64748b",
                                    }}
                                >
                                    {i + 1}
                                </span>
                                <span className="flex-1 text-sm text-slate-300 group-hover:text-white transition-colors truncate">
                                    {item.title}
                                </span>
                                <span className="flex-shrink-0 text-[11px] text-slate-600 whitespace-nowrap">
                                    {formatDate(item.created_at)}
                                </span>
                                <svg
                                    className="flex-shrink-0 w-3.5 h-3.5 text-slate-700 group-hover:text-slate-400 transition-colors"
                                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                            </Link>
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

    const QUICK_LINKS = [
        {
            href: "/strategy/holy-sword",
            icon: "⚔️",
            label: t.quickLinks.holySword,
            description: t.quickLinks.holySwordDesc,
            gradient: "from-violet-500 to-purple-600",
            glow: "rgba(139,92,246,0.35)",
            border: "rgba(139,92,246,0.3)",
        },
        {
            href: "/free-board",
            icon: "💬",
            label: t.quickLinks.freeBoard,
            description: t.quickLinks.freeBoardDesc,
            gradient: "from-emerald-500 to-teal-500",
            glow: "rgba(16,185,129,0.35)",
            border: "rgba(16,185,129,0.3)",
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

            {/* ══════════════════════════════════════════
                [2] 오늘의 게임 일정 섹션 — 가로 스크롤 카드
                ══════════════════════════════════════════ */}
            <div
                className="mb-4 rounded-2xl border overflow-hidden"
                style={{
                    background: "rgba(15,23,42,0.75)",
                    borderColor: "rgba(51,65,85,0.55)",
                    backdropFilter: "blur(12px)",
                    boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
                }}
            >
                {/* 섹션 헤더 */}
                <div
                    className="flex items-center justify-between px-5 py-3 border-b"
                    style={{ borderColor: "rgba(51,65,85,0.45)" }}
                >
                    <div className="flex items-center gap-2">
                        <span className="text-sm">📅</span>
                        <h2 className="text-sm font-bold text-slate-200">오늘의 주요 일정</h2>
                        <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80" }}
                        >
                            LIVE
                        </span>
                    </div>
                    <Link
                        href="/calendar"
                        className="text-[11px] text-cyan-500 hover:text-cyan-300 transition-colors font-medium flex items-center gap-0.5"
                    >
                        전체 일정표
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </Link>
                </div>

                {/* 가로 스크롤 카드 영역 */}
                <div
                    className="flex gap-3 px-4 py-4 overflow-x-auto"
                    style={{ scrollbarWidth: "none" }}
                >
                    {SCHEDULE_EVENTS.map((ev) => {
                        const badge = STATUS_BADGE[ev.status];
                        return (
                            <div
                                key={ev.id}
                                className="flex-shrink-0 w-[136px] rounded-xl border overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer"
                                style={{
                                    background: "rgba(15,23,42,0.85)",
                                    borderColor: ev.border,
                                    boxShadow: `0 2px 12px ${ev.glow}`,
                                }}
                            >
                                {/* 카드 상단 그라데이션 */}
                                <div
                                    className={`flex items-center justify-center h-14 bg-gradient-to-br ${ev.gradient}`}
                                    style={{ opacity: ev.status === "ended" ? 0.5 : 1 }}
                                >
                                    <span className="text-2xl filter drop-shadow-md">{ev.icon}</span>
                                </div>

                                {/* 카드 내용 */}
                                <div className="px-3 py-2.5 space-y-1.5">
                                    <div
                                        className="inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                                        style={{ background: badge.bg, color: badge.color }}
                                    >
                                        {badge.label}
                                    </div>
                                    <p className="text-xs font-bold text-white leading-snug line-clamp-1">{ev.title}</p>
                                    <p className="text-[10px] text-slate-400 line-clamp-1">{ev.subtitle}</p>
                                    <p className="text-[10px] text-slate-600 flex items-center gap-0.5">
                                        <span>🕐</span> {ev.time}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
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
            />

            {/* ── [5] 퀵 링크 (성검 + 자유게시판) ── */}
            <div className="flex gap-3">
                {QUICK_LINKS.map((link) => (
                    <Link
                        key={link.href}
                        href={link.href}
                        className="group relative flex items-center gap-3 overflow-hidden rounded-2xl px-4 py-3.5 transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 flex-1"
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
                            className={`relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-lg bg-gradient-to-br ${link.gradient} transition-transform duration-300 group-hover:scale-110`}
                            style={{ boxShadow: `0 3px 10px ${link.glow}` }}
                        >
                            {link.icon}
                        </span>
                        <div className="relative flex flex-col text-left min-w-0">
                            <span className="text-sm font-bold text-white truncate">{link.label}</span>
                            <span className="text-xs text-slate-400 truncate">{link.description}</span>
                        </div>
                        <div className="relative ml-auto text-slate-600 transition-all duration-300 group-hover:translate-x-1 group-hover:text-white flex-shrink-0">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </Link>
                ))}
            </div>

        </section>
    );
}
