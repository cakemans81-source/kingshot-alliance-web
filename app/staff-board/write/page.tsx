import type { Metadata } from "next";
import WriteForm from "@/components/board/WriteForm";

export const metadata: Metadata = {
    title: "간부 전용 게시판 작성 | KDH 킹샷 연맹",
    description: "킹샷 연맹 간부 전용 게시판 글쓰기",
};

export default function StaffBoardWritePage() {
    return (
        <WriteForm
            tableName="staff_board"
            pageTitle="⭐ 간부 전용 게시판 작성"
            pageSubtitle="운영진 전용 공간입니다. 연맹 운영 관련 내용을 작성해주세요."
            accentColor="from-indigo-400 to-purple-400"
            successRedirect="/staff-board"
        />
    );
}
