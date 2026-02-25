import type { Metadata } from "next";
import PostDetailClient from "@/components/board/PostDetailClient";

export const revalidate = 0;

export const metadata: Metadata = {
    title: "간부 전용 게시판 | KDH 킹샷 연맹",
};

export default function StaffBoardDetailPage() {
    return (
        <PostDetailClient
            tableName="staff_board"
            listHref="/staff-board"
            accentColor="from-indigo-400 to-purple-400"
        />
    );
}
