"use client";

import Link from "next/link";
import { motion } from "framer-motion";

/* ═══════════════════════════════════════════════
   플로팅 버튼 데이터
   ═══════════════════════════════════════════════ */

const FLOAT_BUTTONS = [
    {
        href: "/free-board",
        label: "자게",
        icon: "+",
        title: "자유게시판 글쓰기",
        /** 에메랄드 계열 */
        gradient: "linear-gradient(135deg, #059669, #10b981)",
        glow: "rgba(16,185,129,0.55)",
        border: "rgba(16,185,129,0.6)",
        hoverGlow: "0 8px 32px rgba(16,185,129,0.6)",
    },
    {
        href: "/notice",
        label: "공지",
        icon: "+",
        title: "공지사항 글쓰기",
        /** 골드/앰버 계열 — [ KDH ] 브랜드 컬러 */
        gradient: "linear-gradient(135deg, #d97706, #fbbf24)",
        glow: "rgba(251,191,36,0.55)",
        border: "rgba(251,191,36,0.6)",
        hoverGlow: "0 8px 32px rgba(251,191,36,0.6)",
    },
];

/* ═══════════════════════════════════════════════
   개별 플로팅 버튼
   ═══════════════════════════════════════════════ */

function FloatBtn({
    href,
    label,
    icon,
    title,
    gradient,
    glow,
    border,
    hoverGlow,
}: (typeof FLOAT_BUTTONS)[number]) {
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
                {/* + 아이콘 */}
                <span
                    className="text-2xl font-black leading-none text-white"
                    style={{ lineHeight: 1, marginTop: "-2px" }}
                >
                    {icon}
                </span>
                {/* 라벨 */}
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
    return (
        /**
         * fixed bottom-6 right-6 z-50
         * — 어떤 콘텐츠 위에도 항상 보이고, 스크롤해도 제자리
         */
        <div
            className="fixed bottom-6 right-4 sm:right-6 z-50 flex items-center gap-3"
            aria-label="빠른 글쓰기"
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
                ✏️ 빠른 글쓰기
            </motion.p>

            {/* 버튼 두 개 나란히 */}
            {FLOAT_BUTTONS.map((btn) => (
                <FloatBtn key={btn.href} {...btn} />
            ))}
        </div>
    );
}
