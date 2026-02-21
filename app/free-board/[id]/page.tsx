import type { Metadata } from "next";
import PostDetailClient from "@/components/board/PostDetailClient";

export const revalidate = 0;

export const metadata: Metadata = {
    title: "자유게시판 | KDH 킹샷 연맹",
};

export default function FreeBoardDetailPage() {
    return (
        <PostDetailClient
            tableName="free_board"
            listHref="/free-board"
            accentColor="from-emerald-400 to-teal-400"
        />
    );
}
