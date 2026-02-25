"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House } from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleContext";
import type { LocaleCode } from "@/lib/i18n/LocaleContext";
import { useAuth } from "@/lib/auth/AuthContext";

/* ═══════════════════════════════════════════════
   타입 정의
   ═══════════════════════════════════════════════ */

interface Language {
    code: LocaleCode;
    label: string;
    flag: string;
}

/* ═══════════════════════════════════════════════
   상수 데이터
   ═══════════════════════════════════════════════ */

const LANGUAGES: Language[] = [
    { code: "ko", label: "한국어", flag: "🇰🇷" },
    { code: "en", label: "English", flag: "🇺🇸" },
    { code: "de", label: "Deutsch", flag: "🇩🇪" },
    { code: "zh", label: "中文", flag: "🇨🇳" },
];

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
                        : "bg-slate-800/60 border-cyan-500/30 text-slate-200 hover:bg-slate-700/60 hover:text-white hover:border-cyan-400/60"
                    }
        `}
                aria-label="Language / 언어 선택"
                aria-expanded={isOpen}
            >
                <span className="text-sm">🌐</span>
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

            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════
   서브 컴포넌트 — 권한별 데스크탑 메뉴
   ═══════════════════════════════════════════════ */

function AuthMenuDesktop() {
    const { user } = useAuth();
    const pathname = usePathname();
    if (!user || (user.role !== "staff" && user.role !== "admin")) return null;

    return (
        <>
            {/* 간부 전용 게시판 */}
            <Link
                href="/staff-board"
                className={`relative px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${pathname.startsWith("/staff-board")
                    ? "text-indigo-300 bg-indigo-500/15"
                    : "text-indigo-300/70 hover:text-indigo-200 hover:bg-indigo-500/10"
                    }`}
                style={{ border: "1px solid rgba(99,102,241,0.25)" }}
            >
                ⭐ 간부 전용 게시판
            </Link>
            {/* 연맹 관리 (admin 전용) */}
            {user.role === "admin" && (
                <Link
                    href="/admin"
                    className={`relative px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${pathname === "/admin"
                        ? "text-yellow-300 bg-yellow-500/15"
                        : "text-yellow-300/70 hover:text-yellow-200 hover:bg-yellow-500/10"
                        }`}
                    style={{ border: "1px solid rgba(251,191,36,0.25)" }}
                >
                    👑 연맹 관리
                </Link>
            )}
        </>
    );
}

/* ═══════════════════════════════════════════════
   서브 컴포넌트 — 우측 로그인 / 프로필 버튼
   ═══════════════════════════════════════════════ */

function AuthButtonDesktop() {
    const { user } = useAuth();
    if (!user) {
        return (
            <Link
                href="/auth"
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5"
                style={{
                    background: "linear-gradient(135deg,rgba(6,182,212,0.7),rgba(99,102,241,0.7))",
                    border: "1px solid rgba(6,182,212,0.4)",
                    boxShadow: "0 2px 12px rgba(6,182,212,0.25)",
                }}
            >
                🔑 로그인
            </Link>
        );
    }
    <Link
        href="/profile"
        className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5"
        style={{
            background: "rgba(30,41,59,0.8)",
            border: "1px solid rgba(71,85,105,0.5)",
            color: "#94a3b8",
        }}
    >
        <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold overflow-hidden"
            style={{ background: "rgba(6,182,212,0.3)", color: "#22d3ee", border: "1px solid rgba(6,182,212,0.4)" }}
        >
            {user.avatar_url ? (
                <img src={user.avatar_url} alt="p" className="w-full h-full object-cover" />
            ) : (
                user.nickname[0]?.toUpperCase() ?? "?"
            )}
        </div>
        <span className="text-slate-300 max-w-[80px] truncate">{user.nickname}</span>
    </Link>
}

/* ═══════════════════════════════════════════════
   서브 컴포넌트 — 권한별 모바일 메뉴
   ═══════════════════════════════════════════════ */

function AuthMenuMobile() {
    const { user } = useAuth();

    return (
        <>
            {/* 로그인 / 프로필 */}
            {!user ? (
                <Link
                    href="/auth"
                    className="block px-4 py-2.5 rounded-xl text-sm font-semibold text-cyan-300 hover:bg-cyan-500/10 transition-colors"
                >
                    🔑 로그인 / 가입
                </Link>
            ) : (
                <Link
                    href="/profile"
                    className="block px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:bg-slate-700/50 transition-colors"
                >
                    👤 내 프로필 ({user.nickname})
                </Link>
            )}

            {/* 간부 전용 (staff / admin) */}
            {user && (user.role === "staff" || user.role === "admin") && (
                <Link
                    href="/staff-board"
                    className="block px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-300 hover:bg-indigo-500/10 transition-colors"
                >
                    ⭐ 간부 전용 게시판
                </Link>
            )}

            {/* 연맹 관리 (admin) */}
            {user?.role === "admin" && (
                <Link
                    href="/admin"
                    className="block px-4 py-2.5 rounded-xl text-sm font-semibold text-yellow-300 hover:bg-yellow-500/10 transition-colors"
                >
                    👑 연맹 관리
                </Link>
            )}
        </>
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
        { key: "kdhGrid" as const, href: "/kdh-grid" },
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

                    {/* 자유게시판, 외교, 좌표그리드 */}
                    {NAV_SIMPLE.slice(1).map(({ key, href }) => {
                        const isActive = pathname === href;
                        return (
                            <Link
                                key={href}
                                href={href}
                                className={`relative px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${isActive ? "text-cyan-300 bg-cyan-500/10" : "text-slate-300 hover:text-white hover:bg-slate-700/50"}`}
                            >
                                {key === "kdhGrid" ? "🗺️ " : ""}{t.nav[key]}
                                {isActive && <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-cyan-400" />}
                            </Link>
                        );
                    })}

                    {/* ── 간부 전용 게시판 (staff / admin) ── */}
                    <AuthMenuDesktop />
                </div>

                {/* ─── 우측: 로그인/프로필 + 언어 선택 + 모바일 햄버거 ─── */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    <AuthButtonDesktop />
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

                    {/* 자유게시판, 외교, 좌표그리드 */}
                    {NAV_SIMPLE.slice(1).map(({ key, href }) => (
                        <Link
                            key={href}
                            href={href}
                            className={`block px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-150 ${pathname === href ? "text-cyan-300 bg-cyan-500/10" : "text-slate-300 hover:bg-slate-700/50 hover:text-white"}`}
                        >
                            {key === "kdhGrid" ? "🗺️ " : ""}{t.nav[key]}
                        </Link>
                    ))}

                    {/* ── 권한 메뉴 (모바일) ── */}
                    <AuthMenuMobile />
                </div>
            </div>
        </nav>
    );
}
