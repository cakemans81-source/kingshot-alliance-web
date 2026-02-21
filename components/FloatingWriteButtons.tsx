"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useLocale } from "@/lib/i18n/LocaleContext";

/* ═══════════════════════════════════════════════
   서브 메뉴 아이템 타입
   ═══════════════════════════════════════════════ */

interface SubItem {
    href: string;
    icon: string;
    label: string;
    gradient: string;
    glow: string;
    border: string;
}

/* ═══════════════════════════════════════════════
   통합 확장형 FAB
   클릭 → 서브버튼 2개 위로 슬라이드업 + 배경 오버레이
   ═══════════════════════════════════════════════ */

export default function FloatingWriteButtons() {
    const { t } = useLocale();
    const [open, setOpen] = useState(false);
    const fabRef = useRef<HTMLDivElement>(null);

    /* 외부 클릭 시 닫기 */
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    /* ESC 키 닫기 */
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    const SUB_ITEMS: SubItem[] = [
        {
            href: "/free-board/write",
            icon: "💬",
            label: t.fab.freeBoard,
            gradient: "linear-gradient(135deg, #0891b2, #06b6d4)",
            glow: "rgba(6,182,212,0.55)",
            border: "rgba(6,182,212,0.6)",
        },
        {
            href: "/notice/write",
            icon: "📢",
            label: t.fab.notice,
            gradient: "linear-gradient(135deg, #7c3aed, #8b5cf6)",
            glow: "rgba(139,92,246,0.55)",
            border: "rgba(139,92,246,0.6)",
        },
    ];

    return (
        <>
            {/* ── 배경 오버레이 (메뉴 열릴 때) ── */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        key="overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
                        onClick={() => setOpen(false)}
                    />
                )}
            </AnimatePresence>

            {/* ── FAB 컨테이너 ── */}
            <div
                ref={fabRef}
                className="fixed bottom-6 right-4 sm:right-6 z-50 flex flex-col items-end gap-3"
            >
                {/* ── 서브 버튼 목록 (위쪽으로 펼쳐짐) ── */}
                <AnimatePresence>
                    {open && (
                        <motion.div
                            key="submenu"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="flex flex-col items-end gap-2.5"
                        >
                            {SUB_ITEMS.map((item, i) => (
                                <motion.div
                                    key={item.href}
                                    initial={{ opacity: 0, y: 20, scale: 0.85 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 12, scale: 0.9 }}
                                    transition={{
                                        type: "spring",
                                        stiffness: 380,
                                        damping: 24,
                                        delay: i * 0.07,
                                    }}
                                    className="flex items-center gap-2.5"
                                >
                                    {/* 텍스트 라벨 */}
                                    <span
                                        className="text-xs font-semibold px-3 py-1.5 rounded-xl whitespace-nowrap select-none"
                                        style={{
                                            background: "rgba(15,23,42,0.92)",
                                            border: "1px solid rgba(51,65,85,0.7)",
                                            color: "#e2e8f0",
                                            backdropFilter: "blur(8px)",
                                            boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
                                        }}
                                    >
                                        {item.icon} {item.label}
                                    </span>

                                    {/* 동그란 아이콘 버튼 */}
                                    <Link
                                        href={item.href}
                                        title={item.label}
                                        onClick={() => setOpen(false)}
                                        className="flex items-center justify-center w-12 h-12 rounded-full transition-transform duration-150 hover:scale-110 active:scale-95 select-none"
                                        style={{
                                            background: item.gradient,
                                            border: `2px solid ${item.border}`,
                                            boxShadow: `0 4px 20px ${item.glow}, inset 0 1px 1px rgba(255,255,255,0.2)`,
                                        }}
                                    >
                                        <span className="text-xl">{item.icon}</span>
                                    </Link>
                                </motion.div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── 메인 [+] FAB 버튼 ── */}
                <motion.button
                    onClick={() => setOpen((v) => !v)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.92 }}
                    transition={{ type: "spring", stiffness: 320, damping: 20 }}
                    className="relative w-14 h-14 rounded-full flex items-center justify-center select-none focus:outline-none"
                    style={{
                        background: open
                            ? "linear-gradient(135deg, #1e293b, #334155)"
                            : "linear-gradient(135deg, #0891b2 0%, #7c3aed 100%)",
                        border: open
                            ? "2px solid rgba(100,116,139,0.7)"
                            : "2px solid rgba(6,182,212,0.6)",
                        boxShadow: open
                            ? "0 4px 20px rgba(0,0,0,0.4)"
                            : "0 4px 24px rgba(6,182,212,0.45), 0 0 0 4px rgba(6,182,212,0.12)",
                    }}
                    aria-label={open ? "메뉴 닫기" : "글쓰기"}
                    aria-expanded={open}
                >
                    {/* [+] 아이콘 — 열리면 [×] 로 전환 */}
                    <motion.span
                        animate={{ rotate: open ? 45 : 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 22 }}
                        className="text-2xl font-black text-white leading-none"
                        style={{ display: "inline-block" }}
                    >
                        ✚
                    </motion.span>

                    {/* 닫힌 상태일 때 펄스 링 */}
                    {!open && (
                        <span
                            className="absolute inset-0 rounded-full animate-ping"
                            style={{ background: "rgba(6,182,212,0.2)" }}
                        />
                    )}
                </motion.button>
            </div>
        </>
    );
}
