import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "자유 게시판 | Kingshot Alliance",
    description: "킹샷 연맹 자유 게시판 — 사진 업로드 지원",
};

export default function FreeBoardPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-gray-950 text-white px-6 py-12">
            <div className="max-w-3xl mx-auto space-y-6">
                <h1 className="text-3xl font-extrabold tracking-tight text-emerald-400">
                    💬 자유 게시판
                </h1>
                <p className="text-slate-400 text-sm">
                    연맹원들의 자유로운 이야기를 나눠요. 사진 업로드도 지원됩니다.
                </p>

                {/* TODO: Supabase free_board 테이블 + Supabase Storage 연동 예정 */}
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 text-center text-slate-500">
                    아직 작성된 게시글이 없습니다.
                </div>
            </div>
        </div>
    );
}
