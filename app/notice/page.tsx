import type { Metadata } from "next";
import PostBoard from "@/components/board/PostBoard";

export const revalidate = 0;

export const metadata: Metadata = {
    title: "공지사항 | Kingshot Alliance",
    description: "킹샷 연맹 공식 공지사항",
};

export default function NoticePage() {
    return (
        <PostBoard
            tableName="notices"
            pageTitle="📢 공지사항"
            pageSubtitle="연맹 운영진의 주요 공지를 확인하세요."
            accentColor="from-sky-400 to-cyan-400"
            emptyMessage="아직 등록된 공지사항이 없습니다."
        />
    );
}
