import type { Metadata } from "next";
import WriteForm from "@/components/board/WriteForm";

export const metadata: Metadata = {
    title: "자유게시판 작성 | KDH 킹샷 연맹",
    description: "킹샷 연맹 자유게시판 글쓰기",
};

export default function FreeBoardWritePage() {
    return (
        <WriteForm
            tableName="free_board"
            pageTitle="💬 자유게시판 작성"
            pageSubtitle="연맹원들과 자유롭게 소통하세요. 사진 업로드도 지원됩니다!"
            accentColor="from-emerald-400 to-teal-400"
            successRedirect="/free-board"
        />
    );
}
