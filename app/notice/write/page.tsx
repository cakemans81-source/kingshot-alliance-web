import type { Metadata } from "next";
import WriteForm from "@/components/board/WriteForm";

export const metadata: Metadata = {
    title: "공지사항 작성 | KDH 킹샷 연맹",
    description: "킹샷 연맹 공지사항 글쓰기",
};

export default function NoticeWritePage() {
    return (
        <WriteForm
            tableName="notices"
            pageTitle="📢 공지사항 작성"
            pageSubtitle="연맹 운영진의 주요 공지를 작성하세요."
            accentColor="from-sky-400 to-cyan-400"
            successRedirect="/notice"
        />
    );
}
