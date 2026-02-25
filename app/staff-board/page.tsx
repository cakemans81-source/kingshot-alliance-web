import type { Metadata } from "next";
import PostBoard from "@/components/board/PostBoard";

export const revalidate = 0;

export const metadata: Metadata = {
    title: "간부 전용 게시판 | KDH 킹샷 연맹",
    description: "킹샷 연맹 간부 전용 게시판 — 운영진 전용 공간",
};

export default function StaffBoardPage() {
    return (
        <PostBoard
            tableName="staff_board"
            pageTitle="⭐ 간부 전용 게시판"
            pageSubtitle="운영진 전용 공간입니다. 연맹 운영 관련 논의를 나눠주세요."
            accentColor="from-indigo-400 to-purple-400"
            emptyMessage="아직 작성된 게시글이 없습니다. 첫 글을 남겨보세요!"
        />
    );
}
