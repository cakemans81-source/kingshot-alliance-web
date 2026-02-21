import type { Metadata } from "next";
import PostBoard from "@/components/board/PostBoard";

export const metadata: Metadata = {
    title: "자유 게시판 | Kingshot Alliance",
    description: "킹샷 연맹 자유 게시판 — 사진 업로드 지원",
};

export default function FreeBoardPage() {
    return (
        <PostBoard
            tableName="free_board"
            pageTitle="💬 자유 게시판"
            pageSubtitle="연맹원들과 자유롭게 소통하세요. 사진 업로드도 지원됩니다!"
            accentColor="from-emerald-400 to-teal-400"
            emptyMessage="아직 작성된 게시글이 없습니다. 첫 글을 남겨보세요!"
        />
    );
}
