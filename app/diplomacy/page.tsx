import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "연맹원 명부 & 외교 현황 | Kingshot Alliance",
    description: "킹샷 연맹원 명부 및 외교 현황 페이지",
};

export default function DiplomacyPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-gray-950 text-white px-6 py-12">
            <div className="max-w-4xl mx-auto space-y-6">
                <h1 className="text-3xl font-extrabold tracking-tight text-amber-400">
                    🤝 연맹원 명부 및 외교 현황
                </h1>
                <p className="text-slate-400 text-sm">
                    연맹원 정보와 동맹·적대 연맹 현황을 확인하세요.
                </p>

                {/* TODO: Supabase members / diplomacy 테이블 연동 예정 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 text-center text-slate-500">
                        연맹원 명부 준비 중
                    </div>
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 text-center text-slate-500">
                        외교 현황 준비 중
                    </div>
                </div>
            </div>
        </div>
    );
}
