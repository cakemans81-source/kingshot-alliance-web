"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House } from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleContext";
import type { LocaleCode } from "@/lib/i18n/LocaleContext";

/* ═══════════════════════════════════════════════
   타입 정의
   ═══════════════════════════════════════════════ */

interface SubItem {
    href: string;
    icon: string;
    labelKey: "holySword" | "threeAlliances";
}

interface Language {
    code: LocaleCode;
    label: string;
    flag: string;
}

/* ═══════════════════════════════════════════════
   상수 데이터
   ═══════════════════════════════════════════════ */

const SUB_ITEMS: SubItem[] = [
    { href: "/strategy/holy-sword", icon: "⚔️", labelKey: "holySword" },
    { href: "/strategy/three-alliances", icon: "🛡️", labelKey: "threeAlliances" },
];

const LANGUAGES: Language[] = [
    { code: "ko", label: "한국어", flag: "🇰🇷" },
    { code: "en", label: "English", flag: "🇺🇸" },
    { code: "de", label: "Deutsch", flag: "🇩🇪" },
    { code: "zh", label: "中文", flag: "🇨🇳" },
];

/* ═══════════════════════════════════════════════
   서브 컴포넌트 — 공략 드롭다운 메뉴
   ═══════════════════════════════════════════════ */

function StrategyDropdown({
    items,
    isOpen,
}: {
    items: SubItem[];
    isOpen: boolean;
}) {
    const pathname = usePathname();
    const { t } = useLocale();

    return (
        <div
            className={`
        absolute top-full left-1/2 -translate-x-1/2 mt-2
        w-52 rounded-xl overflow-hidden
        bg-slate-900/95 backdrop-blur-xl
        border border-slate-700/60
        shadow-2xl shadow-black/60
        transition-all duration-200 origin-top
        ${isOpen
                    ? "opacity-100 scale-y-100 pointer-events-auto translate-y-0"
                    : "opacity-0 scale-y-95 pointer-events-none -translate-y-1"
                }
      `}
            style={{ zIndex: 100 }}
        >
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 border-l border-t border-slate-700/60 rotate-45" />
            <div className="p-1.5 space-y-0.5">
                {items.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`
                flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-150 group
                ${isActive
                                    ? "bg-cyan-500/20 text-cyan-300"
                                    : "text-slate-300 hover:bg-slate-700/60 hover:text-white"
                                }
              `}
                        >
                            <span className="text-base group-hover:scale-110 transition-transform duration-150">
                                {item.icon}
                            </span>
                            <span>{t.nav[item.labelKey]}</span>
                            {isActive && (
                                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400" />
                            )}
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════
   서브 컴포넌트 — 언어 선택 드롭다운 (실제 동작)
   ═══════════════════════════════════════════════ */

function LanguageSelector() {
    const [isOpen, setIsOpen] = useState(false);
    const { locale, setLocale } = useLocale();
    const ref = useRef<HTMLDivElement>(null);

    const selectedLang = LANGUAGES.find((l) => l.code === locale) ?? LANGUAGES[0];

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = useCallback((lang: Language) => {
        setLocale(lang.code);
        setIsOpen(false);
    }, [setLocale]);

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setIsOpen((v) => !v)}
                className={`
          flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium
          border transition-all duration-200
          ${isOpen
                        ? "bg-slate-700/80 border-cyan-500/50 text-white"
                        : "bg-slate-800/60 border-slate-700/50 text-slate-300 hover:bg-slate-700/60 hover:text-white hover:border-slate-600/60"
                    }
        `}
                aria-label="언어 선택"
                aria-expanded={isOpen}
            >
                <span className="text-base">{selectedLang.flag}</span>
                <span className="hidden sm:inline">{selectedLang.label}</span>
                <svg
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
                </svg>
            </button>

            {/* 언어 드롭다운 */}
            <div
                className={`
          absolute top-full right-0 mt-2
          w-44 rounded-xl overflow-hidden
          bg-slate-900/95 backdrop-blur-xl
          border border-slate-700/60
          shadow-2xl shadow-black/60
          transition-all duration-200 origin-top-right
          ${isOpen
                        ? "opacity-100 scale-100 pointer-events-auto"
                        : "opacity-0 scale-95 pointer-events-none"
                    }
        `}
                style={{ zIndex: 100 }}
            >
                <div className="p-1.5 space-y-0.5">
                    {LANGUAGES.map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => handleSelect(lang)}
                            className={`
                w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm
                transition-all duration-150 text-left
                ${locale === lang.code
                                    ? "bg-cyan-500/20 text-cyan-300 font-semibold"
                                    : "text-slate-300 hover:bg-slate-700/60 hover:text-white"
                                }
              `}
                        >
                            <span className="text-base">{lang.flag}</span>
                            <span>{lang.label}</span>
                            {locale === lang.code && (
                                <span className="ml-auto">✓</span>
                            )}
                        </button>
                    ))}
                </div>
                {/* 활성화 표시 */}
                <div className="px-4 py-2 border-t border-slate-700/40">
                    <p className="text-[10px] text-cyan-600/70 font-medium">
                        ✅ i18n 실시간 적용 중
                    </p>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════
   메인 컴포넌트 — NavBar
   ═══════════════════════════════════════════════ */

export default function NavBar() {
    const pathname = usePathname();
    const { t } = useLocale();
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [mobileStrategyOpen, setMobileStrategyOpen] = useState(false);
    const strategyRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setOpenDropdown(null);
        setMobileMenuOpen(false);
    }, [pathname]);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (strategyRef.current && !strategyRef.current.contains(e.target as Node)) {
                setOpenDropdown(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    /* 단순 메뉴 항목 (번역 키 → 경로 매핑) */
    const NAV_SIMPLE = [
        { key: "notice" as const, href: "/notice" },
        { key: "freeBoard" as const, href: "/free-board" },
        { key: "diplomacy" as const, href: "/diplomacy" },
    ];

    return (
        <nav
            className="fixed top-0 left-0 right-0 z-50 h-16"
            style={{
                background:
                    "linear-gradient(to bottom, rgba(2,6,23,0.97) 0%, rgba(15,23,42,0.93) 100%)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                borderBottom: "1px solid rgba(51,65,85,0.5)",
                boxShadow: "0 4px 32px rgba(0,0,0,0.5)",
            }}
        >
            <div className="max-w-7xl mx-auto h-full px-4 flex items-center justify-between gap-6">
                {/* ─── 로고 ─── */}
                <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
                    {/* 홈 아이콘 */}
                    <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-110"
                        style={{
                            background: "linear-gradient(135deg, rgba(6,182,212,0.15), rgba(59,130,246,0.15))",
                            border: "1px solid rgba(6,182,212,0.3)",
                            boxShadow: "0 0 0 rgba(6,182,212,0)",
                        }}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.boxShadow = "0 0 18px rgba(6,182,212,0.45)";
                            (e.currentTarget as HTMLElement).style.borderColor = "rgba(6,182,212,0.7)";
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 rgba(6,182,212,0)";
                            (e.currentTarget as HTMLElement).style.borderColor = "rgba(6,182,212,0.3)";
                        }}
                    >
                        <House
                            size={18}
                            strokeWidth={2}
                            className="text-cyan-400 group-hover:text-cyan-300 transition-colors duration-200"
                        />
                    </div>
                    <span className="hidden sm:flex items-center gap-1.5 font-extrabold text-base tracking-tight">
                        <span
                            style={{
                                background: "linear-gradient(135deg, #f59e0b, #fcd34d, #f59e0b)",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                                filter: "drop-shadow(0 0 6px rgba(251,191,36,0.5))",
                                letterSpacing: "0.05em",
                            }}
                        >
                            [ KDH ]
                        </span>
                        <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                            {t.nav.allianceName}
                        </span>
                    </span>
                </Link>

                {/* ─── 데스크탑 메뉴 ─── */}
                <div className="hidden md:flex items-center gap-1 flex-1 justify-center">

                    {/* 공지사항 */}
                    {NAV_SIMPLE.slice(0, 1).map(({ key, href }) => {
                        const isActive = pathname === href;
                        return (
                            <Link
                                key={href}
                                href={href}
                                className={`relative px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${isActive ? "text-cyan-300 bg-cyan-500/10" : "text-slate-300 hover:text-white hover:bg-slate-700/50"}`}
                            >
                                {t.nav[key]}
                                {isActive && <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-cyan-400" />}
                            </Link>
                        );
                    })}

                    {/* 공략 드롭다운 */}
                    <div ref={strategyRef} className="relative">
                        <button
                            onMouseEnter={() => setOpenDropdown("strategy")}
                            onMouseLeave={() =>
                                setTimeout(() => {
                                    if (strategyRef.current && !strategyRef.current.matches(":hover")) {
                                        setOpenDropdown(null);
                                    }
                                }, 80)
                            }
                            onClick={() => setOpenDropdown(openDropdown === "strategy" ? null : "strategy")}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${SUB_ITEMS.some((s) => pathname === s.href) || openDropdown === "strategy"
                                ? "text-cyan-300 bg-cyan-500/10"
                                : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                                }`}
                            aria-expanded={openDropdown === "strategy"}
                        >
                            {t.nav.strategy}
                            <svg
                                className={`w-3.5 h-3.5 transition-transform duration-200 ${openDropdown === "strategy" ? "rotate-180" : ""}`}
                                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
                            </svg>
                        </button>
                        <div
                            onMouseEnter={() => setOpenDropdown("strategy")}
                            onMouseLeave={() => setOpenDropdown(null)}
                        >
                            <StrategyDropdown items={SUB_ITEMS} isOpen={openDropdown === "strategy"} />
                        </div>
                    </div>

                    {/* 자유게시판, 외교 */}
                    {NAV_SIMPLE.slice(1).map(({ key, href }) => {
                        const isActive = pathname === href;
                        return (
                            <Link
                                key={href}
                                href={href}
                                className={`relative px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${isActive ? "text-cyan-300 bg-cyan-500/10" : "text-slate-300 hover:text-white hover:bg-slate-700/50"}`}
                            >
                                {t.nav[key]}
                                {isActive && <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-cyan-400" />}
                            </Link>
                        );
                    })}
                </div>

                {/* ─── 우측: 언어 선택 + 모바일 햄버거 ─── */}
                <div className="flex items-center gap-3 flex-shrink-0">
                    <LanguageSelector />
                    <button
                        className="md:hidden flex flex-col gap-1.5 p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
                        onClick={() => setMobileMenuOpen((v) => !v)}
                        aria-label="모바일 메뉴 열기"
                    >
                        <span className={`block w-5 h-0.5 bg-slate-300 transition-all duration-300 origin-center ${mobileMenuOpen ? "rotate-45 translate-y-2" : ""}`} />
                        <span className={`block w-5 h-0.5 bg-slate-300 transition-all duration-300 ${mobileMenuOpen ? "opacity-0 scale-x-0" : ""}`} />
                        <span className={`block w-5 h-0.5 bg-slate-300 transition-all duration-300 origin-center ${mobileMenuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
                    </button>
                </div>
            </div>

            {/* ─── 모바일 메뉴 패널 ─── */}
            <div
                className={`md:hidden overflow-hidden transition-all duration-300 ${mobileMenuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}`}
                style={{
                    background: "rgba(2,6,23,0.98)",
                    borderTop: "1px solid rgba(51,65,85,0.4)",
                }}
            >
                <div className="px-4 py-3 space-y-1">
                    {/* 공지사항 */}
                    <Link
                        href="/notice"
                        className={`block px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-150 ${pathname === "/notice" ? "text-cyan-300 bg-cyan-500/10" : "text-slate-300 hover:bg-slate-700/50 hover:text-white"}`}
                    >
                        {t.nav.notice}
                    </Link>

                    {/* 공략 (아코디언) */}
                    <div>
                        <button
                            onClick={() => setMobileStrategyOpen((v) => !v)}
                            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors"
                        >
                            {t.nav.strategy}
                            <svg
                                className={`w-3.5 h-3.5 transition-transform duration-200 ${mobileStrategyOpen ? "rotate-180" : ""}`}
                                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
                            </svg>
                        </button>
                        {mobileStrategyOpen && (
                            <div className="ml-4 mt-1 space-y-1 border-l-2 border-slate-700/50 pl-4">
                                {SUB_ITEMS.map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors duration-150 ${pathname === item.href
                                            ? "text-cyan-300 bg-cyan-500/10 font-semibold"
                                            : "text-slate-400 hover:text-white hover:bg-slate-700/40"
                                            }`}
                                    >
                                        {item.icon} {t.nav[item.labelKey]}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 자유게시판, 외교 */}
                    {NAV_SIMPLE.slice(1).map(({ key, href }) => (
                        <Link
                            key={href}
                            href={href}
                            className={`block px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-150 ${pathname === href ? "text-cyan-300 bg-cyan-500/10" : "text-slate-300 hover:bg-slate-700/50 hover:text-white"}`}
                        >
                            {t.nav[key]}
                        </Link>
                    ))}
                </div>
            </div>
        </nav>
    );
}
