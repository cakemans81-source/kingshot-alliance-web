import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "공지사항 | Kingshot Alliance",
    description: "킹샷 연맹 공지사항 페이지",
};

export default function NoticePage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-gray-950 text-white px-6 py-12">
            <div className="max-w-3xl mx-auto space-y-6">
                <h1 className="text-3xl font-extrabold tracking-tight text-cyan-400">
                    📢 공지사항
                </h1>
                <p className="text-slate-400 text-sm">
                    연맹 운영진의 주요 공지를 확인하세요.
                </p>

                {/* TODO: Supabase notices 테이블과 연동 예정 */}
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 text-center text-slate-500">
                    아직 등록된 공지사항이 없습니다.
                </div>
            </div>
        </div>
    );
}
