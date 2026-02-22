import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";
import FloatingWriteButtons from "@/components/FloatingWriteButtons";
import MusicPlayer from "@/components/MusicPlayer";
import { LocaleProvider } from "@/lib/i18n/LocaleContext";
import { AuthProvider } from "@/lib/auth/AuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "[ KDH ] 킹샷 연맹 | 공식 사이트",
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
        {/* 다국어(i18n) Context */}
        <LocaleProvider>
          {/* 인증 Context */}
          <AuthProvider>
            {/* 전체 페이지 최상단 고정 네비게이션 바 */}
            <NavBar />

            {/* BGM 플레이어 */}
            <MusicPlayer />

            {/* 네비게이션 바 높이(64px)만큼 상단 여백 확보 */}
            <main className="pt-16">
              {children}
            </main>

            {/* 모든 페이지 공통 — 우측 하단 고정형 글쓰기 플로팅 버튼 */}
            <FloatingWriteButtons />
          </AuthProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
