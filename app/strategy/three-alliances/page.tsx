import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "삼대 연맹 전투 공략 | Kingshot Alliance",
    description: "킹샷 삼대 연맹 전투 전략 공략 페이지",
};

export default function ThreeAlliancesPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-gray-950 text-white px-6 py-12">
            <div className="max-w-3xl mx-auto space-y-6">
                <h1 className="text-3xl font-extrabold tracking-tight text-purple-400">
                    ⚔️ 삼대 연맹 전투 공략
                </h1>
                <p className="text-slate-400 text-sm">
                    삼대 연맹 전투 전략을 공유하세요.
                </p>

                {/* TODO: StrategyMap 파생 컴포넌트 또는 별도 공략 에디터 삽입 예정 */}
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 text-center text-slate-500">
                    삼대 연맹 전투 공략 컨텐츠가 준비 중입니다.
                </div>
            </div>
        </div>
    );
}
