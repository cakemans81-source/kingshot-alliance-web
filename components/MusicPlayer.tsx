"use client";

import { useEffect, useRef, useState } from "react";

/* ═══════════════════════════════════════════════
   MusicPlayer — 전역 BGM 컴포넌트
   ─ layout.tsx에 마운트, 페이지 이동 시 음악 유지
   ─ 브라우저 Autoplay 정책: 첫 클릭 감지 후 자동 재생
   ═══════════════════════════════════════════════ */

export default function MusicPlayer() {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(0.35);
    const [showVolume, setShowVolume] = useState(false);
    const [hasMounted, setHasMounted] = useState(false);

    /* ── 마운트 후 audio 생성 (SSR 방지) ── */
    useEffect(() => {
        setHasMounted(true);

        const audio = new Audio("/bgm.mp3");
        audio.loop = true;
        audio.volume = 0.35;
        audioRef.current = audio;

        /* 브라우저 Autoplay 정책: 첫 사용자 상호작용 후 자동 재생 시도 */
        const tryAutoplay = () => {
            audio.play().then(() => {
                setIsPlaying(true);
            }).catch(() => {
                /* 차단된 경우 조용히 무시 — 버튼으로 수동 재생 */
            });
            document.removeEventListener("click", tryAutoplay);
            document.removeEventListener("keydown", tryAutoplay);
        };

        /* 즉시 시도 (일부 브라우저 허용) */
        audio.play().then(() => {
            setIsPlaying(true);
        }).catch(() => {
            /* 차단된 경우 첫 클릭/키 이벤트를 기다림 */
            document.addEventListener("click", tryAutoplay, { once: true });
            document.addEventListener("keydown", tryAutoplay, { once: true });
        });

        return () => {
            audio.pause();
            audio.src = "";
            document.removeEventListener("click", tryAutoplay);
            document.removeEventListener("keydown", tryAutoplay);
        };
    }, []);

    /* ── 볼륨 반영 ── */
    useEffect(() => {
        if (audioRef.current) audioRef.current.volume = volume;
    }, [volume]);

    /* ── 재생 / 일시정지 토글 ── */
    const togglePlay = () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (isPlaying) {
            audio.pause();
            setIsPlaying(false);
        } else {
            audio.play().catch(() => { });
            setIsPlaying(true);
        }
    };

    if (!hasMounted) return null;

    return (
        <div className="fixed top-[72px] right-3 z-40 flex flex-col items-end gap-1.5">
            {/* ── 볼륨 슬라이더 (버튼 위에 팝업) ── */}
            {showVolume && (
                <div
                    className="flex flex-col items-center gap-1.5 rounded-xl px-2.5 py-2"
                    style={{
                        background: "rgba(15,23,42,0.92)",
                        border: "1px solid rgba(6,182,212,0.25)",
                        backdropFilter: "blur(12px)",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                    }}
                >
                    <span className="text-[9px] text-slate-500 font-medium tracking-wider">VOL</span>
                    <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={volume}
                        onChange={(e) => setVolume(Number(e.target.value))}
                        className="h-20 cursor-pointer accent-cyan-400"
                        style={{ writingMode: "vertical-lr", direction: "rtl" }}
                        aria-label="볼륨 조절"
                    />
                    <span className="text-[9px] text-slate-400 font-mono">
                        {Math.round(volume * 100)}
                    </span>
                </div>
            )}

            {/* ── 메인 컨트롤 버튼 ── */}
            <div
                className="flex items-center gap-1.5 rounded-full px-3 py-2"
                style={{
                    background: "rgba(15,23,42,0.88)",
                    border: `1px solid ${isPlaying ? "rgba(6,182,212,0.45)" : "rgba(71,85,105,0.5)"}`,
                    backdropFilter: "blur(12px)",
                    boxShadow: isPlaying
                        ? "0 0 14px rgba(6,182,212,0.25), 0 2px 10px rgba(0,0,0,0.4)"
                        : "0 2px 10px rgba(0,0,0,0.4)",
                    transition: "border-color 0.3s, box-shadow 0.3s",
                }}
            >
                {/* 볼륨 게이지 아이콘 */}
                <button
                    onClick={() => setShowVolume((v) => !v)}
                    title="볼륨 조절"
                    className="flex items-center justify-center w-6 h-6 rounded-full hover:bg-slate-700/60 transition-colors"
                    aria-label="볼륨 조절"
                >
                    <svg
                        viewBox="0 0 24 24"
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke={showVolume ? "#22d3ee" : "#64748b"}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        {volume > 0.55 && <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />}
                        {volume > 0.05 && <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />}
                    </svg>
                </button>

                {/* 재생/일시정지 토글 */}
                <button
                    onClick={togglePlay}
                    title={isPlaying ? "음악 끄기" : "음악 켜기"}
                    aria-label={isPlaying ? "음악 끄기" : "음악 켜기"}
                    className="flex items-center justify-center w-7 h-7 rounded-full transition-all duration-200 hover:scale-110 active:scale-95"
                    style={{
                        background: isPlaying
                            ? "linear-gradient(135deg, #06b6d4, #3b82f6)"
                            : "rgba(51,65,85,0.7)",
                        boxShadow: isPlaying ? "0 0 10px rgba(6,182,212,0.4)" : "none",
                    }}
                >
                    {isPlaying ? (
                        /* 일시정지 아이콘 */
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="white">
                            <rect x="6" y="5" width="4" height="14" rx="1" />
                            <rect x="14" y="5" width="4" height="14" rx="1" />
                        </svg>
                    ) : (
                        /* 재생 아이콘 */
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="white">
                            <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                    )}
                </button>

                {/* 음파 애니메이션 — 재생 중일 때만 */}
                {isPlaying && (
                    <div className="flex items-end gap-[2px] h-4">
                        {[1, 2, 3].map((i) => (
                            <span
                                key={i}
                                className="w-[3px] rounded-full bg-cyan-400"
                                style={{
                                    animation: `music-bar ${0.7 + i * 0.15}s ease-in-out infinite alternate`,
                                    height: `${8 + i * 3}px`,
                                    opacity: 0.85,
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* 음파 키프레임 (인라인) */}
            <style>{`
        @keyframes music-bar {
          from { transform: scaleY(0.35); }
          to   { transform: scaleY(1); }
        }
      `}</style>
        </div>
    );
}
