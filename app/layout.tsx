import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";
import FloatingWriteButtons from "@/components/FloatingWriteButtons";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kingshot Alliance",
  description: "킹샷 연맹 공식 공략 & 커뮤니티 사이트",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-950 text-white`}
      >
        {/* 전체 페이지 최상단 고정 네비게이션 바 */}
        <NavBar />

        {/* 네비게이션 바 높이(64px)만큼 상단 여백 확보 */}
        <main className="pt-16">
          {children}
        </main>

        {/* 모든 페이지 공통 — 우측 하단 고정형 글쓰기 플로팅 버튼 */}
        <FloatingWriteButtons />
      </body>
    </html>
  );
}
