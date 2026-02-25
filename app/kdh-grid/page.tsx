"use client";

import KdhGrid from "@/components/KdhGrid";
import { useLocale } from "@/lib/i18n/LocaleContext";

export default function KdhGridPage() {
    const { t } = useLocale();

    return (
        <div className="relative min-h-screen bg-slate-950 text-white">
            {/* 배경 그라데이션 */}
            <div
                aria-hidden
                className="pointer-events-none fixed inset-0 z-0"
                style={{
                    background: `
                        radial-gradient(ellipse 70% 50% at 60% 20%, rgba(6,182,212,0.08) 0%, transparent 60%),
                        radial-gradient(ellipse 50% 40% at 20% 70%, rgba(99,102,241,0.06) 0%, transparent 60%),
                        linear-gradient(to bottom right, #020617, #0f172a 50%, #020617)
                    `,
                }}
            />

            <section className="relative z-10 mx-auto max-w-2xl px-4 pt-8 pb-24 sm:px-6">
                {/* 페이지 헤더 */}
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
                        KDH Alliance
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight">
                        <span
                            className="block bg-clip-text text-transparent"
                            style={{
                                backgroundImage: "linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #8b5cf6 100%)",
                                filter: "drop-shadow(0 0 14px rgba(6,182,212,0.4))",
                            }}
                        >
                            {t.kdhPage.pageTitle}
                        </span>
                    </h1>
                    <p className="mt-2 text-sm text-slate-400">
                        {t.kdhPage.pageDesc}
                    </p>
                </div>

                {/* 그리드 컴포넌트 */}
                <KdhGrid />
            </section>
        </div>
    );
}
