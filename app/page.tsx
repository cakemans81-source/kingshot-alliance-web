import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export const metadata: Metadata = {
  title: "[ KDH ] 킹샷 연맹 | 공식 사이트",
  description:
    "[ KDH ] 킹샷 연맹 공식 웹사이트. 공지사항, 전투 공략, 자유 게시판, 연맹원 명부를 한곳에서.",
};

/* ═══════════════════════════════════════════════
   타입 정의
   ═══════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════
   Server Component: Supabase 데이터 fetch
   ═══════════════════════════════════════════════ */

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/** 공지사항 최신 5개 */
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

/** 자유게시판 최신 5개 */
async function fetchRecentFreePosts(): Promise<FreePost[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("free_board")
    .select("id, title, created_at")
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) {
    console.error("[HomePage] free_board fetch 실패:", error.message);
    return [];
  }
  return (data as FreePost[]) ?? [];
}

/* ═══════════════════════════════════════════════
   날짜 포맷 헬퍼
   ═══════════════════════════════════════════════ */

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
  });
}

/* ═══════════════════════════════════════════════
   공용 — 섹션 카드 (공지 / 자게 동일 디자인)
   ═══════════════════════════════════════════════ */

interface SectionCardProps {
  title: string;        // "📢 최근 공지사항"
  listHref: string;     // 전체보기 링크
  accentColor: string;  // 배지 색 (hex or rgba)
  emptyHint: string;    // 빈 상태 안내문
  items: { id: number; title: string; created_at: string }[];
  itemHref: (id: number) => string; // 각 항목 클릭 시 이동 경로
  badgeName: string;    // 빈 상태일 때 강조 텍스트
}

function SectionCard({
  title,
  listHref,
  emptyHint,
  items,
  itemHref,
  badgeName,
}: SectionCardProps) {
  return (
    <div
      className="mb-6 rounded-2xl border overflow-hidden"
      style={{
        background: "rgba(15,23,42,0.75)",
        borderColor: "rgba(51,65,85,0.55)",
        backdropFilter: "blur(12px)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
      }}
    >
      {/* 섹션 헤더 */}
      <div
        className="flex items-center justify-between px-5 py-3.5 border-b"
        style={{ borderColor: "rgba(51,65,85,0.45)" }}
      >
        <h2 className="text-sm font-bold text-slate-200">{title}</h2>
        <Link
          href={listHref}
          className="text-[11px] text-cyan-500 hover:text-cyan-300 transition-colors font-medium flex items-center gap-0.5"
        >
          전체보기
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* 리스트 */}
      {items.length === 0 ? (
        <div className="px-5 py-6 text-center text-slate-600 text-sm">
          {emptyHint}&nbsp;
          <strong className="text-amber-500">{badgeName}</strong> 버튼으로 첫 글을 작성해 보세요!
        </div>
      ) : (
        <ul className="divide-y" style={{ borderColor: "rgba(51,65,85,0.3)" }}>
          {items.map((item, i) => (
            <li key={item.id}>
              {/*
               * ✅ 클릭 시 → 상세/목록 페이지 (itemHref)
               *    글쓰기는 오직 플로팅 버튼(FloatingWriteButtons)으로만!
               */}
              <Link
                href={itemHref(item.id)}
                className="flex items-center gap-3 px-5 py-3 transition-colors duration-150 hover:bg-slate-700/30 group"
              >
                {/* 순번 배지 — 1위는 골드, 나머지는 회색 */}
                <span
                  className="flex-shrink-0 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center"
                  style={{
                    background:
                      i === 0
                        ? "linear-gradient(135deg, #f59e0b, #fbbf24)"
                        : "rgba(51,65,85,0.6)",
                    color: i === 0 ? "#fff" : "#64748b",
                  }}
                >
                  {i + 1}
                </span>

                {/* 제목 */}
                <span className="flex-1 text-sm text-slate-300 group-hover:text-white transition-colors truncate">
                  {item.title}
                </span>

                {/* 날짜 */}
                <span className="flex-shrink-0 text-[11px] text-slate-600 whitespace-nowrap">
                  {formatDate(item.created_at)}
                </span>

                {/* 화살표 */}
                <svg
                  className="flex-shrink-0 w-3.5 h-3.5 text-slate-700 group-hover:text-slate-400 transition-colors"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   퀵 링크 데이터
   ═══════════════════════════════════════════════ */

const QUICK_LINKS = [
  {
    href: "/strategy/holy-sword",
    icon: "⚔️",
    label: "성검 전투 공략",
    description: "전략 시뮬레이션 맵",
    gradient: "from-violet-500 to-purple-600",
    glow: "rgba(139,92,246,0.35)",
    border: "rgba(139,92,246,0.3)",
  },
  {
    href: "/free-board",
    icon: "💬",
    label: "자유 게시판",
    description: "연맹원과 자유롭게 소통",
    gradient: "from-emerald-500 to-teal-500",
    glow: "rgba(16,185,129,0.35)",
    border: "rgba(16,185,129,0.3)",
  },
  {
    href: "/diplomacy",
    icon: "🤝",
    label: "외교 현황",
    description: "동맹 · 적대 연맹 정보",
    gradient: "from-amber-500 to-orange-500",
    glow: "rgba(245,158,11,0.35)",
    border: "rgba(245,158,11,0.3)",
  },
];

/* ═══════════════════════════════════════════════
   메인 페이지 (Server Component — async)
   ═══════════════════════════════════════════════ */

export default async function HomePage() {
  // 공지 + 자유게시판 병렬 fetch
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

      {/* ════════════════════════════════════════
          콘텐츠 영역
          ════════════════════════════════════════ */}
      <section className="relative z-10 mx-auto max-w-2xl px-4 pt-10 pb-28 sm:px-6">

        {/* ── [1] 환영 타이틀 ── */}
        <div className="text-center mb-6">
          {/* 배지 */}
          <div
            className="mb-4 inline-flex items-center gap-2 rounded-full border px-3.5 py-1 text-[11px] font-semibold tracking-widest uppercase"
            style={{
              background: "rgba(6,182,212,0.08)",
              borderColor: "rgba(6,182,212,0.28)",
              color: "#67e8f9",
            }}
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Official Alliance Website
          </div>

          {/* 타이틀 */}
          <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight tracking-tight">
            <span
              className="block bg-clip-text text-transparent mb-0.5"
              style={{
                backgroundImage: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 40%, #fcd34d 70%, #f59e0b 100%)",
                filter: "drop-shadow(0 0 12px rgba(251,191,36,0.5))",
                letterSpacing: "0.04em",
              }}
            >
              [ KDH ]
            </span>
            <span
              className="block bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, #ffffff 0%, #e2e8f0 40%, #94a3b8 100%)" }}
            >
              킹샷 연맹 웹사이트에
            </span>
            <span
              className="block bg-clip-text text-transparent"
              style={{
                backgroundImage: "linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #8b5cf6 100%)",
                filter: "drop-shadow(0 0 16px rgba(6,182,212,0.35))",
              }}
            >
              오신 것을 환영합니다 👋
            </span>
          </h1>

          {/* 서브타이틀 */}
          <p className="mt-3 text-sm sm:text-base text-slate-400 leading-relaxed">
            함께 소통하고, 전략을 공유하며,{" "}
            <span className="font-semibold text-cyan-400">최고의 연맹</span>
            으로 나아갑시다! 🏆
          </p>
        </div>

        {/* ── [2] 메인 캐릭터 이미지 ── */}
        <div className="flex justify-center mb-7">
          <div className="relative">
            <div
              aria-hidden
              className="absolute inset-0 rounded-full blur-2xl"
              style={{
                background: "radial-gradient(circle, rgba(6,182,212,0.2), rgba(139,92,246,0.12), transparent 70%)",
                transform: "scale(1.3)",
              }}
            />
            <div
              aria-hidden
              className="absolute rounded-full border opacity-20 animate-spin-slow"
              style={{ inset: "-10%", borderColor: "rgba(6,182,212,0.5)", borderStyle: "dashed" }}
            />
            <Image
              src="/kingshot_main.jpg"
              alt="킹샷 메인 캐릭터"
              width={200}
              height={200}
              priority
              quality={90}
              className="relative z-10 animate-float drop-shadow-2xl"
              style={{
                filter: "drop-shadow(0 0 24px rgba(6,182,212,0.3))",
                maxWidth: "min(200px, 45vw)",
                height: "auto",
              }}
            />
          </div>
        </div>

        {/* ── [3] 최근 공지사항 TOP 5 ── */}
        <SectionCard
          title="📢 최근 공지사항"
          listHref="/notice"
          accentColor="#f59e0b"
          emptyHint="아직 등록된 공지사항이 없습니다. 우측 하단"
          badgeName="공지"
          items={notices}
          /* 공지 항목 클릭 → 공지사항 목록 페이지 (/notice) */
          itemHref={() => "/notice"}
        />

        {/* ── [4] 최근 자유게시판 TOP 5 ── */}
        <SectionCard
          title="💬 최근 자유게시판"
          listHref="/free-board"
          accentColor="#10b981"
          emptyHint="아직 작성된 글이 없습니다. 우측 하단"
          badgeName="자게"
          items={freePosts}
          /* 자유게시판 항목 클릭 → 자유게시판 목록 페이지 (/free-board) */
          itemHref={() => "/free-board"}
        />

        {/* ── [5] 빠른 이동 버튼 3개 ── */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:gap-3 mb-7">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group relative flex items-center gap-3 overflow-hidden rounded-2xl px-4 py-3.5 transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 flex-1"
              style={{
                background: "linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.75))",
                border: `1px solid ${link.border}`,
                boxShadow: `0 4px 20px ${link.glow}`,
              }}
            >
              <div
                className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{ background: `linear-gradient(135deg, ${link.glow.replace("0.35", "0.10")}, transparent)` }}
              />
              <span
                className={`relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-lg bg-gradient-to-br ${link.gradient} transition-transform duration-300 group-hover:scale-110`}
                style={{ boxShadow: `0 3px 10px ${link.glow}` }}
              >
                {link.icon}
              </span>
              <div className="relative flex flex-col text-left min-w-0">
                <span className="text-sm font-bold text-white truncate">{link.label}</span>
                <span className="text-xs text-slate-400 truncate">{link.description}</span>
              </div>
              <div className="relative ml-auto text-slate-600 transition-all duration-300 group-hover:translate-x-1 group-hover:text-white flex-shrink-0">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>

        {/* ── [6] 하단 기능 소개 카드 ── */}
        <div
          className="w-full rounded-2xl border"
          style={{
            background: "rgba(15,23,42,0.6)",
            borderColor: "rgba(51,65,85,0.45)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div className="flex flex-col md:flex-row">
            {[
              { value: "연맹 공략", label: "전략 시뮬레이션", icon: "🗺️" },
              { value: "실시간 공유", label: "자유 게시판", icon: "📡" },
              { value: "다국어 지원", label: "글로벌 연맹", icon: "🌐" },
            ].map((stat, i) => (
              <div
                key={i}
                className={[
                  "flex flex-1 items-center gap-3 px-5 py-4",
                  i > 0 ? "border-t border-slate-700/40 md:border-t-0 md:border-l md:border-slate-700/40" : "",
                ].join(" ")}
              >
                <span className="text-2xl flex-shrink-0">{stat.icon}</span>
                <div>
                  <p className="text-sm font-bold text-white leading-tight">{stat.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </section>
    </div>
  );
}
