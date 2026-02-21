import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Kingshot Alliance | 킹샷 연맹 공식 사이트",
  description:
    "킹샷 연맹 공식 웹사이트. 공지사항, 전투 공략, 자유 게시판, 연맹원 명부를 한곳에서.",
};

/* ───────────────────────────────────────────────
   퀵 링크 데이터
   ─────────────────────────────────────────────── */
const QUICK_LINKS = [
  {
    href: "/notice",
    icon: "📢",
    label: "공지사항 확인",
    description: "연맹 최신 소식",
    gradient: "from-sky-500 to-cyan-500",
    glow: "rgba(14,165,233,0.35)",
    border: "rgba(14,165,233,0.3)",
  },
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
];

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">

      {/* ══════════════════════════════════════════
          배경 레이어: 방사형 광원 그라데이션
          ══════════════════════════════════════════ */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 70% 40%, rgba(6,182,212,0.08) 0%, transparent 60%),
            radial-gradient(ellipse 60% 50% at 20% 70%, rgba(139,92,246,0.07) 0%, transparent 60%),
            linear-gradient(to bottom right, #020617, #0f172a 50%, #020617)
          `,
        }}
      />

      {/* ══════════════════════════════════════════
          배경 장식: 부유하는 빛 점들
          ══════════════════════════════════════════ */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {/* 큰 글로우 오브 */}
        <div
          className="absolute rounded-full blur-3xl animate-glow-pulse"
          style={{
            width: 600,
            height: 600,
            top: "-10%",
            right: "-5%",
            background: "radial-gradient(circle, rgba(6,182,212,0.6), transparent 70%)",
          }}
        />
        <div
          className="absolute rounded-full blur-3xl animate-glow-pulse-2"
          style={{
            width: 400,
            height: 400,
            bottom: "5%",
            left: "5%",
            background: "radial-gradient(circle, rgba(139,92,246,0.5), transparent 70%)",
          }}
        />
      </div>

      {/* ══════════════════════════════════════════
          메인 히어로 섹션
          ══════════════════════════════════════════ */}
      <section className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 sm:px-6 py-16 sm:py-20">
        <div className="mx-auto w-full max-w-7xl">

          {/* 모바일: 위에 이미지 / 데스크탑: 왼쪽 텍스트 + 오른쪽 이미지 */}
          <div className="flex flex-col-reverse items-center gap-6 sm:gap-10 lg:flex-row lg:items-center lg:gap-16">

            {/* ─── 좌측: 텍스트 + 버튼 영역 ─── */}
            <div className="flex flex-1 flex-col items-center text-center lg:items-start lg:text-left">

              {/* 배지 */}
              <div
                className="mb-5 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold tracking-widest uppercase"
                style={{
                  background: "rgba(6,182,212,0.08)",
                  borderColor: "rgba(6,182,212,0.3)",
                  color: "#67e8f9",
                  boxShadow: "0 0 12px rgba(6,182,212,0.15)",
                }}
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                Official Alliance Website
              </div>

              {/* 메인 타이틀 */}
              <h1 className="mb-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl">
                <span
                  className="block bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(135deg, #ffffff 0%, #e2e8f0 40%, #94a3b8 100%)",
                  }}
                >
                  킹샷 연맹
                </span>
                <span
                  className="block bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #8b5cf6 100%)",
                    filter: "drop-shadow(0 0 20px rgba(6,182,212,0.4))",
                  }}
                >
                  웹사이트
                </span>
                <span
                  className="mt-1 block text-lg font-bold sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl"
                  style={{
                    backgroundImage:
                      "linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 100%)",
                    backgroundClip: "text",
                    WebkitBackgroundClip: "text",
                    color: "transparent",
                  }}
                >
                  오신 것을 환영합니다
                </span>
              </h1>

              {/* 서브 타이틀 */}
              <p className="mb-7 max-w-xl text-sm leading-relaxed text-slate-400 sm:text-base md:text-lg lg:text-xl">
                함께 소통하고, 전략을 공유하며,{" "}
                <span className="font-semibold text-cyan-400">최고의 연맹</span>
                으로 나아갑시다! 🏆
              </p>

              {/* ─── 퀵 링크 버튼 3개 ─── */}
              <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:justify-center lg:justify-start">
                {QUICK_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="group relative flex items-center gap-3 overflow-hidden rounded-2xl px-5 py-4 transition-all duration-300 hover:scale-[1.03] hover:-translate-y-0.5 sm:w-auto w-full"
                    style={{
                      background: `linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.8))`,
                      border: `1px solid ${link.border}`,
                      boxShadow: `0 4px 24px ${link.glow}`,
                    }}
                  >
                    {/* 호버 시 그라데이션 오버레이 */}
                    <div
                      className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                      style={{
                        background: `linear-gradient(135deg, ${link.glow.replace("0.35", "0.12")}, transparent)`,
                      }}
                    />

                    {/* 아이콘 */}
                    <div
                      className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-xl transition-transform duration-300 group-hover:scale-110"
                      style={{
                        background: `linear-gradient(135deg, ${link.gradient.replace("from-", "").replace(" to-", ", ")})`.replace(
                          /from-\S+ to-\S+/,
                          ""
                        ),
                        backgroundImage: `linear-gradient(135deg, var(--tw-gradient-stops))`,
                        boxShadow: `0 4px 12px ${link.glow}`,
                      }}
                    >
                      <span
                        className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${link.gradient}`}
                        style={{ boxShadow: `0 4px 12px ${link.glow}` }}
                      >
                        {link.icon}
                      </span>
                    </div>

                    {/* 텍스트 */}
                    <div className="relative flex flex-col text-left">
                      <span className="text-sm font-bold text-white">
                        {link.label}
                      </span>
                      <span className="text-xs text-slate-400">
                        {link.description}
                      </span>
                    </div>

                    {/* 화살표 */}
                    <div className="relative ml-auto text-slate-500 transition-all duration-300 group-hover:translate-x-1 group-hover:text-white">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>

              {/* 하단 기능 소개 카드 3개 */}
              <div
                className="mt-8 w-full rounded-2xl border"
                style={{
                  background: "rgba(15,23,42,0.6)",
                  borderColor: "rgba(51,65,85,0.5)",
                  backdropFilter: "blur(12px)",
                }}
              >
                {/* 모바일: flex-col (1열), md 이상: flex-row (3열) */}
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
                        /* 세로 구분선: 모바일은 상단 border, md는 좌측 border */
                        i > 0
                          ? "border-t border-slate-700/40 md:border-t-0 md:border-l md:border-slate-700/40"
                          : "",
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
            </div>

            {/* ─── 우측 (모바일: 상단): 캐릭터 이미지 영역 ─── */}
            <div className="relative flex w-full flex-shrink-0 items-center justify-center sm:w-auto lg:w-[480px] xl:w-[540px]">

              {/* 이미지 뒤 글로우 효과 */}
              <div
                aria-hidden
                className="absolute inset-0 rounded-full blur-3xl"
                style={{
                  background:
                    "radial-gradient(circle at center, rgba(6,182,212,0.25) 0%, rgba(139,92,246,0.15) 50%, transparent 70%)",
                  transform: "scale(1.2)",
                }}
              />

              {/* 회전하는 테두리 장식 링 */}
              <div
                aria-hidden
                className="absolute rounded-full border opacity-20 animate-spin-slow"
                style={{
                  width: "110%",
                  height: "110%",
                  borderColor: "rgba(6,182,212,0.4)",
                  borderStyle: "dashed",
                }}
              />
              <div
                aria-hidden
                className="absolute rounded-full border opacity-10 animate-spin-slow-rev"
                style={{
                  width: "125%",
                  height: "125%",
                  borderColor: "rgba(139,92,246,0.4)",
                  borderStyle: "dashed",
                }}
              />

              {/* 메인 캐릭터 이미지 */}
              <div className="relative z-10">
                <Image
                  src="/kingshot_main.jpg"
                  alt="킹샷 메인 캐릭터"
                  width={480}
                  height={480}
                  priority
                  quality={95}
                  className="relative z-10 drop-shadow-2xl animate-float"
                  style={{
                    maxWidth: "min(320px, 78vw)",
                    height: "auto",
                    filter: "drop-shadow(0 0 40px rgba(6,182,212,0.3))",
                  }}
                />
              </div>

              {/* 이미지 하단 반사광 */}
              <div
                aria-hidden
                className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full blur-2xl opacity-30"
                style={{
                  width: "70%",
                  height: 40,
                  background: "linear-gradient(to right, #06b6d4, #8b5cf6)",
                }}
              />
            </div>

          </div>{/* flex row 종료 */}
        </div>
      </section>

    </div>
  );
}
