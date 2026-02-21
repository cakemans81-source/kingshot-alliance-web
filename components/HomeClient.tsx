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
   섹션 카드 (번역 지원)
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
            className="mb-6 rounded-2xl border overflow-hidden"
            style={{
                background: "rgba(15,23,42,0.75)",
                borderColor: "rgba(51,65,85,0.55)",
                backdropFilter: "blur(12px)",
                boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
            }}
        >
            <div
                className="flex items-center justify-between px-5 py-3.5 border-b"
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
                <div className="px-5 py-6 text-center text-slate-600 text-sm">
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
                                className="flex items-center gap-3 px-5 py-3 transition-colors duration-150 hover:bg-slate-700/30 group"
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
        {
            href: "/diplomacy",
            icon: "🤝",
            label: t.quickLinks.diplomacy,
            description: t.quickLinks.diplomacyDesc,
            gradient: "from-amber-500 to-orange-500",
            glow: "rgba(245,158,11,0.35)",
            border: "rgba(245,158,11,0.3)",
        },
    ];

    const FEATURES = [
        { value: t.features.strategy, label: t.features.strategyLabel, icon: "🗺️" },
        { value: t.features.realtime, label: t.features.realtimeLabel, icon: "📡" },
        { value: t.features.multilang, label: t.features.multilangLabel, icon: "🌐" },
    ];

    return (
        <section className="relative z-10 mx-auto max-w-2xl px-4 pt-10 pb-28 sm:px-6">

            {/* ── [1] 환영 타이틀 ── */}
            <div className="text-center mb-8">
                <div
                    className="mb-4 inline-flex items-center gap-2 rounded-full border px-3.5 py-1 text-[11px] font-semibold tracking-widest uppercase"
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

                <p className="mt-3 text-sm sm:text-base text-slate-400 leading-relaxed">
                    {t.home.subtitle}{" "}
                    <span className="font-semibold text-cyan-400">{t.home.subtitleHighlight}</span>
                    {t.home.subtitleEnd}
                </p>
            </div>

            {/* ── [2] 최근 공지사항 ── */}
            <SectionCard
                title={t.home.recentNotice}
                listHref="/notice"
                viewAllLabel={t.home.viewAll}
                emptyHint={t.home.noNotice}
                writeHint={t.home.writeHint}
                badgeName={t.fab.notice}
                items={notices}
                itemHref={() => "/notice"}
            />

            {/* ── [3] 최근 자유게시판 ── */}
            <SectionCard
                title={t.home.recentFreeBoard}
                listHref="/free-board"
                viewAllLabel={t.home.viewAll}
                emptyHint={t.home.noFreePost}
                writeHint={t.home.writeHint}
                badgeName={t.fab.freeBoard}
                items={freePosts}
                itemHref={() => "/free-board"}
            />

            {/* ── [4] 퀵 링크 ── */}
            <div className="flex flex-col gap-2.5 sm:flex-row sm:gap-3 mb-7">
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

            {/* ── [5] 기능 소개 카드 ── */}
            <div
                className="w-full rounded-2xl border"
                style={{
                    background: "rgba(15,23,42,0.6)",
                    borderColor: "rgba(51,65,85,0.45)",
                    backdropFilter: "blur(8px)",
                }}
            >
                <div className="flex flex-col md:flex-row">
                    {FEATURES.map((stat, i) => (
                        <div
                            key={i}
                            className={[
                                "flex flex-1 items-center gap-3 px-5 py-4",
                                i > 0 ? "border-t border-slate-700/40 md:border-t-0 md:border-l md:border-slate-700/40" : "",
                            ].join(" ")}
                        >
                            <span className="text-2xl flex-shrink-0">{stat.icon}</span>
                            <div>
                                <p className="text-sm font-bold text-white leading-tight">{stat.value}</p>
                                <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

        </section>
    );
}
