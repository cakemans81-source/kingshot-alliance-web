import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import HomeClient from "@/components/HomeClient";

export const metadata: Metadata = {
  title: "[ KDH ] 킹샷 연맹 | 공식 사이트",
  description:
    "[ KDH ] 킹샷 연맹 공식 웹사이트. 공지사항, 전투 공략, 자유 게시판, 연맹원 명부를 한곳에서.",
};

/* ═══════════════════════════════════════════════
   Server Component: Supabase 데이터 fetch
   ═══════════════════════════════════════════════ */

export const revalidate = 0; // 캐시 무시, 매 접속마다 새로고침

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

interface Notice {
  id: number;
  title: string;
  created_at: string;
}

interface FreePost {
  id: number;
  title: string;
  created_at: string;
}

async function fetchRecentNotices(): Promise<Notice[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("notices")
    .select("id, title, created_at")
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) {
    console.error("[HomePage] notices fetch 실패:", error.message);
    return [];
  }
  return (data as Notice[]) ?? [];
}

async function fetchRecentFreePosts(): Promise<FreePost[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("free_board")
    .select("id, title, created_at")
    .order("created_at", { ascending: false })
    .limit(4);
  if (error) {
    console.error("[HomePage] free_board fetch 실패:", error.message);
    return [];
  }
  return (data as FreePost[]) ?? [];
}

/* ═══════════════════════════════════════════════
   메인 페이지 (Server Component — async)
   ═══════════════════════════════════════════════ */

export default async function HomePage() {
  const [notices, freePosts] = await Promise.all([
    fetchRecentNotices(),
    fetchRecentFreePosts(),
  ]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">

      {/* ── 배경 그라데이션 ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 70% 30%, rgba(6,182,212,0.07) 0%, transparent 60%),
            radial-gradient(ellipse 60% 50% at 20% 70%, rgba(139,92,246,0.06) 0%, transparent 60%),
            linear-gradient(to bottom right, #020617, #0f172a 50%, #020617)
          `,
        }}
      />

      {/* ── 배경 글로우 오브 ── */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div
          className="absolute rounded-full blur-3xl animate-glow-pulse"
          style={{
            width: 500, height: 500,
            top: "-15%", right: "-10%",
            background: "radial-gradient(circle, rgba(6,182,212,0.5), transparent 70%)",
          }}
        />
        <div
          className="absolute rounded-full blur-3xl animate-glow-pulse-2"
          style={{
            width: 350, height: 350,
            bottom: "5%", left: "0%",
            background: "radial-gradient(circle, rgba(139,92,246,0.4), transparent 70%)",
          }}
        />
      </div>

      {/* ── 클라이언트 컴포넌트 (i18n 번역 적용) ── */}
      <HomeClient notices={notices} freePosts={freePosts} />

    </div>
  );
}
