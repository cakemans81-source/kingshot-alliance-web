"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useLocale } from "@/lib/i18n/LocaleContext";

/* ═══════════════════════════════════════════════
   개별 플로팅 버튼
   ═══════════════════════════════════════════════ */

interface FloatBtnProps {
    href: string;
    label: string;
    icon: string;
    title: string;
    gradient: string;
    glow: string;
    border: string;
    hoverGlow: string;
}

function FloatBtn({ href, label, icon, title, gradient, glow, border, hoverGlow }: FloatBtnProps) {
    return (
        <motion.div
            whileHover={{ scale: 1.15, y: -4 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: "spring", stiffness: 320, damping: 20 }}
        >
            <Link
                href={href}
                title={title}
                className="flex flex-col items-center justify-center w-14 h-14 rounded-full select-none"
                style={{
                    background: gradient,
                    border: `2px solid ${border}`,
                    boxShadow: `0 4px 20px ${glow}, inset 0 1px 1px rgba(255,255,255,0.25)`,
                }}
                onMouseEnter={(e) =>
                    (e.currentTarget.style.boxShadow = `${hoverGlow}, inset 0 1px 1px rgba(255,255,255,0.25)`)
                }
                onMouseLeave={(e) =>
                    (e.currentTarget.style.boxShadow = `0 4px 20px ${glow}, inset 0 1px 1px rgba(255,255,255,0.25)`)
                }
            >
                <span className="text-2xl font-black leading-none text-white" style={{ lineHeight: 1, marginTop: "-2px" }}>
                    {icon}
                </span>
                <span className="text-[10px] font-bold text-white/90 mt-0.5 tracking-wide">
                    {label}
                </span>
            </Link>
        </motion.div>
    );
}

/* ═══════════════════════════════════════════════
   메인 컴포넌트
   ═══════════════════════════════════════════════ */

export default function FloatingWriteButtons() {
    const { t } = useLocale();

    const FLOAT_BUTTONS: FloatBtnProps[] = [
        {
            href: "/free-board",
            label: t.fab.freeBoard,
            icon: "+",
            title: t.fab.freeBoardTitle,
            gradient: "linear-gradient(135deg, #059669, #10b981)",
            glow: "rgba(16,185,129,0.55)",
            border: "rgba(16,185,129,0.6)",
            hoverGlow: "0 8px 32px rgba(16,185,129,0.6)",
        },
        {
            href: "/notice",
            label: t.fab.notice,
            icon: "+",
            title: t.fab.noticeTitle,
            gradient: "linear-gradient(135deg, #d97706, #fbbf24)",
            glow: "rgba(251,191,36,0.55)",
            border: "rgba(251,191,36,0.6)",
            hoverGlow: "0 8px 32px rgba(251,191,36,0.6)",
        },
    ];

    return (
        <div
            className="fixed bottom-6 right-4 sm:right-6 z-50 flex items-center gap-3"
            aria-label={t.fab.quickWrite}
        >
            {/* 좌측 tooltip 힌트 (호버 시 표시) */}
            <motion.p
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 0 }}
                whileHover={{ opacity: 1, x: 0 }}
                className="hidden sm:block text-[11px] text-slate-400 bg-slate-800/80 backdrop-blur-sm
                   border border-slate-700/50 rounded-lg px-2.5 py-1.5 pointer-events-none
                   whitespace-nowrap"
            >
                {t.fab.quickWrite}
            </motion.p>

            {FLOAT_BUTTONS.map((btn) => (
                <FloatBtn key={btn.href} {...btn} />
            ))}
        </div>
    );
}
