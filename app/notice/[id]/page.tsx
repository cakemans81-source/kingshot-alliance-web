import type { Metadata } from "next";
import PostDetailClient from "@/components/board/PostDetailClient";

export const revalidate = 0;

export const metadata: Metadata = {
    title: "공지사항 | KDH 킹샷 연맹",
};

export default function NoticeDetailPage() {
    return (
        <PostDetailClient
            tableName="notices"
            listHref="/notice"
            accentColor="from-sky-400 to-cyan-400"
        />
    );
}
