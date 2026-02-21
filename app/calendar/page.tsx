import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "게임 일정표 | KDH 킹샷 연맹",
    description: "킹샷 연맹 게임 이벤트 일정 — 성검 전투, 삼대 연맹전, 최강 왕국 등 주요 일정을 한눈에.",
};

export default function CalendarPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-gray-950 text-white">
            <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">

                {/* 헤더 */}
                <div className="mb-8">
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400">
                        📅 전체 게임 일정표
                    </h1>
                    <p className="mt-1.5 text-sm text-slate-400">
                        킹샷 연맹 주요 이벤트 & 전투 일정을 확인하세요.
                    </p>
                </div>

                {/* 준비 중 안내 */}
                <div
                    className="flex flex-col items-center justify-center gap-4 py-24 rounded-2xl border"
                    style={{
                        background: "rgba(15,23,42,0.7)",
                        borderColor: "rgba(51,65,85,0.5)",
                        backdropFilter: "blur(12px)",
                    }}
                >
                    <span className="text-5xl">🗓️</span>
                    <p className="text-lg font-bold text-slate-300">상세 일정표 준비 중</p>
                    <p className="text-sm text-slate-500 text-center max-w-xs">
                        전체 일정 페이지를 곧 오픈합니다. <br />
                        메인 화면의 &apos;오늘의 주요 일정&apos; 섹션을 이용해 주세요.
                    </p>
                </div>

            </div>
        </div>
    );
}
