"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/* ═══════════════════════════════════════════════
   타입 정의
   ═══════════════════════════════════════════════ */

interface NavItem {
    label: string;
    href?: string;           // 단순 링크
    children?: SubItem[];   // 드롭다운 하위 메뉴
}

interface SubItem {
    label: string;
    href: string;
    icon: string;
}

interface Language {
    code: string;
    label: string;
    flag: string;
}

/* ═══════════════════════════════════════════════
   상수 데이터
   ═══════════════════════════════════════════════ */

const NAV_ITEMS: NavItem[] = [
    { label: "공지사항", href: "/notice" },
    {
        label: "공략",
        children: [
            { label: "성검 전투", href: "/strategy/holy-sword", icon: "⚔️" },
            { label: "삼대 연맹 전투", href: "/strategy/three-alliances", icon: "🛡️" },
        ],
    },
    { label: "자유 게시판", href: "/free-board" },
    { label: "연맹원 명부 & 외교", href: "/diplomacy" },
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
            {/* 드롭다운 화살표 장식 */}
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
                            <span>{item.label}</span>
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
   서브 컴포넌트 — 언어 선택 드롭다운
   ═══════════════════════════════════════════════ */

function LanguageSelector() {
    const [isOpen, setIsOpen] = useState(false);
    const [selected, setSelected] = useState<Language>(LANGUAGES[0]);
    const ref = useRef<HTMLDivElement>(null);

    // 바깥 클릭 시 닫기
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
        setSelected(lang);
        setIsOpen(false);
        // TODO: DeepL / ChatGPT API 연동 후 실제 언어 전환 로직 추가
        console.log(`[Language] 선택된 언어: ${lang.label} (${lang.code})`);
    }, []);

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
                <span className="text-base">{selected.flag}</span>
                <span className="hidden sm:inline">{selected.label}</span>
                {/* 화살표 아이콘 */}
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
                ${selected.code === lang.code
                                    ? "bg-cyan-500/20 text-cyan-300 font-semibold"
                                    : "text-slate-300 hover:bg-slate-700/60 hover:text-white"
                                }
              `}
                        >
                            <span className="text-base">{lang.flag}</span>
                            <span>{lang.label}</span>
                            {selected.code === lang.code && (
                                <span className="ml-auto">✓</span>
                            )}
                        </button>
                    ))}
                </div>
                <div className="px-4 py-2 border-t border-slate-700/40">
                    <p className="text-[10px] text-slate-600 italic">
                        번역 기능 준비 중 (DeepL / ChatGPT)
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
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [mobileStrategyOpen, setMobileStrategyOpen] = useState(false);
    const strategyRef = useRef<HTMLDivElement>(null);

    // 페이지 이동 시 모든 드롭다운 닫기
    useEffect(() => {
        setOpenDropdown(null);
        setMobileMenuOpen(false);
    }, [pathname]);

    // 공략 드롭다운 바깥 클릭 시 닫기
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (strategyRef.current && !strategyRef.current.contains(e.target as Node)) {
                setOpenDropdown(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

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
                <Link
                    href="/"
                    className="flex items-center gap-2.5 flex-shrink-0 group"
                >
                    <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold flex-shrink-0 group-hover:scale-110 transition-transform duration-200"
                        style={{
                            background: "linear-gradient(135deg, #06b6d4, #3b82f6, #8b5cf6)",
                            boxShadow: "0 0 16px rgba(6,182,212,0.4)",
                        }}
                    >
                        ⚔
                    </div>
                    <span className="hidden sm:flex items-center gap-1.5 font-extrabold text-base tracking-tight">
                        {/* [ KDH ] — 골드 포인트 */}
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
                        {/* 킹샷 연맹 — 사이안-블루 */}
                        <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                            킹샷 연맹
                        </span>
                    </span>
                </Link>

                {/* ─── 데스크탑 메뉴 ─── */}
                <div className="hidden md:flex items-center gap-1 flex-1 justify-center">
                    {NAV_ITEMS.map((item) => {
                        // 드롭다운이 있는 메뉴 (공략)
                        if (item.children) {
                            const isSubActive = item.children.some(
                                (child) => pathname === child.href
                            );
                            const isThisOpen = openDropdown === item.label;

                            return (
                                <div key={item.label} ref={strategyRef} className="relative">
                                    <button
                                        onMouseEnter={() => setOpenDropdown(item.label)}
                                        onMouseLeave={() =>
                                            // 자식 드롭다운에 커서가 없을 때만 닫기 (약간 딜레이)
                                            setTimeout(() => {
                                                if (
                                                    strategyRef.current &&
                                                    !strategyRef.current.matches(":hover")
                                                ) {
                                                    setOpenDropdown(null);
                                                }
                                            }, 80)
                                        }
                                        onClick={() =>
                                            setOpenDropdown(isThisOpen ? null : item.label)
                                        }
                                        className={`
                      flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold
                      transition-all duration-200
                      ${isSubActive || isThisOpen
                                                ? "text-cyan-300 bg-cyan-500/10"
                                                : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                                            }
                    `}
                                        aria-expanded={isThisOpen}
                                    >
                                        공략
                                        <svg
                                            className={`w-3.5 h-3.5 transition-transform duration-200 ${isThisOpen ? "rotate-180" : ""}`}
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            strokeWidth={2.5}
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
                                        </svg>
                                        {/* 활성 인디케이터 */}
                                        {isSubActive && (
                                            <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-cyan-400" />
                                        )}
                                    </button>

                                    {/* 공략 드롭다운 */}
                                    <div
                                        onMouseEnter={() => setOpenDropdown(item.label)}
                                        onMouseLeave={() => setOpenDropdown(null)}
                                    >
                                        <StrategyDropdown items={item.children} isOpen={isThisOpen} />
                                    </div>
                                </div>
                            );
                        }

                        // 단순 링크 메뉴
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.label}
                                href={item.href!}
                                className={`
                  relative px-4 py-2 rounded-xl text-sm font-semibold
                  transition-all duration-200
                  ${isActive
                                        ? "text-cyan-300 bg-cyan-500/10"
                                        : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                                    }
                `}
                            >
                                {item.label}
                                {isActive && (
                                    <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-cyan-400" />
                                )}
                            </Link>
                        );
                    })}
                </div>

                {/* ─── 우측: 언어 선택 + 모바일 햄버거 ─── */}
                <div className="flex items-center gap-3 flex-shrink-0">
                    <LanguageSelector />

                    {/* 모바일 햄버거 버튼 */}
                    <button
                        className="md:hidden flex flex-col gap-1.5 p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
                        onClick={() => setMobileMenuOpen((v) => !v)}
                        aria-label="모바일 메뉴 열기"
                    >
                        <span
                            className={`block w-5 h-0.5 bg-slate-300 transition-all duration-300 origin-center ${mobileMenuOpen ? "rotate-45 translate-y-2" : ""}`}
                        />
                        <span
                            className={`block w-5 h-0.5 bg-slate-300 transition-all duration-300 ${mobileMenuOpen ? "opacity-0 scale-x-0" : ""}`}
                        />
                        <span
                            className={`block w-5 h-0.5 bg-slate-300 transition-all duration-300 origin-center ${mobileMenuOpen ? "-rotate-45 -translate-y-2" : ""}`}
                        />
                    </button>
                </div>
            </div>

            {/* ─── 모바일 메뉴 패널 ─── */}
            <div
                className={`
          md:hidden overflow-hidden transition-all duration-300
          ${mobileMenuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}
        `}
                style={{
                    background: "rgba(2,6,23,0.98)",
                    borderTop: "1px solid rgba(51,65,85,0.4)",
                }}
            >
                <div className="px-4 py-3 space-y-1">
                    {NAV_ITEMS.map((item) => {
                        if (item.children) {
                            return (
                                <div key={item.label}>
                                    <button
                                        onClick={() => setMobileStrategyOpen((v) => !v)}
                                        className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors"
                                    >
                                        공략
                                        <svg
                                            className={`w-3.5 h-3.5 transition-transform duration-200 ${mobileStrategyOpen ? "rotate-180" : ""}`}
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            strokeWidth={2.5}
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
                                        </svg>
                                    </button>
                                    {mobileStrategyOpen && (
                                        <div className="ml-4 mt-1 space-y-1 border-l-2 border-slate-700/50 pl-4">
                                            {item.children.map((child) => (
                                                <Link
                                                    key={child.href}
                                                    href={child.href}
                                                    className={`
                            flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                            transition-colors duration-150
                            ${pathname === child.href
                                                            ? "text-cyan-300 bg-cyan-500/10 font-semibold"
                                                            : "text-slate-400 hover:text-white hover:bg-slate-700/40"
                                                        }
                          `}
                                                >
                                                    {child.icon} {child.label}
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.label}
                                href={item.href!}
                                className={`
                  block px-4 py-2.5 rounded-xl text-sm font-semibold
                  transition-colors duration-150
                  ${isActive
                                        ? "text-cyan-300 bg-cyan-500/10"
                                        : "text-slate-300 hover:bg-slate-700/50 hover:text-white"
                                    }
                `}
                            >
                                {item.label}
                            </Link>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
}
