"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/* ═══════════════════════════════════════════════
   MusicPlayer — 플레이리스트 BGM 컴포넌트
   ─ 토글 탭으로 접기/펼치기 (슬라이드 애니메이션)
   ═══════════════════════════════════════════════ */

const PLAYLIST = ["/bgm.mp3", "/bgm2.mp3", "/bgm3.mp3"];
const TRACK_NAMES = ["🎵 Track 1", "🎵 Track 2", "🎵 Track 3"];

export default function MusicPlayer() {
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(0.10);
    const [showVolume, setShowVolume] = useState(false);
    const [hasMounted, setHasMounted] = useState(false);
    const [trackIndex, setTrackIndex] = useState(0);
    const [trackChanging, setTrackChanging] = useState(false);

    /* ── 새로 추가: 패널 표시 여부 ── */
    const [visible, setVisible] = useState(true);

    /* ━━━ 트랙 전환 ━━━ */
    const playTrack = useCallback((index: number, autoPlay: boolean) => {
        const audio = audioRef.current;
        if (!audio) return;
        const nextIndex = index % PLAYLIST.length;
        setTrackChanging(true);
        setTimeout(() => setTrackChanging(false), 600);
        audio.pause();
        audio.src = PLAYLIST[nextIndex];
        audio.load();
        audio.volume = volume;
        if (autoPlay) {
            audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
        }
        setTrackIndex(nextIndex);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [volume]);

    /* ━━━ 마운트 ━━━ */
    useEffect(() => {
        setHasMounted(true);
        const audio = new Audio(PLAYLIST[0]);
        audio.volume = 0.10;
        audio.preload = "none";
        audioRef.current = audio;
        const handleEnded = () => {
            setTrackIndex((prev) => {
                const next = (prev + 1) % PLAYLIST.length;
                playTrack(next, true);
                return next;
            });
        };
        audio.addEventListener("ended", handleEnded);
        return () => { audio.removeEventListener("ended", handleEnded); audio.pause(); audio.src = ""; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* onEnded 재바인딩 */
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const handleEnded = () => {
            setTrackIndex((prev) => {
                const next = (prev + 1) % PLAYLIST.length;
                playTrack(next, true);
                return next;
            });
        };
        audio.addEventListener("ended", handleEnded);
        return () => audio.removeEventListener("ended", handleEnded);
    }, [playTrack]);

    /* 볼륨 동기화 */
    useEffect(() => {
        if (audioRef.current) audioRef.current.volume = volume;
    }, [volume]);

    /* 재생/정지 토글 */
    const togglePlay = () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (isPlaying) { audio.pause(); setIsPlaying(false); }
        else { audio.play().catch(() => { }); setIsPlaying(true); }
    };

    /* 다음 곡 */
    const handleNext = () => {
        const next = (trackIndex + 1) % PLAYLIST.length;
        playTrack(next, isPlaying);
    };

    if (!hasMounted) return null;

    return (
        <>
            {/* ── 키프레임 ── */}
            <style>{`
                @keyframes music-bar {
                    from { transform: scaleY(0.35); }
                    to   { transform: scaleY(1); }
                }
                @keyframes mp-slide-in {
                    from { opacity: 0; transform: translateX(18px) scale(0.92); }
                    to   { opacity: 1; transform: translateX(0)     scale(1); }
                }
                @keyframes mp-slide-out {
                    from { opacity: 1; transform: translateX(0)     scale(1); }
                    to   { opacity: 0; transform: translateX(18px) scale(0.92); }
                }
                @keyframes tab-pulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(6,182,212,0); }
                    50%      { box-shadow: 0 0 0 4px rgba(6,182,212,0.2); }
                }
            `}</style>

            <div className="fixed top-[72px] right-3 z-40 flex flex-col items-end gap-1.5">

                {/* ━━━ 볼륨 슬라이더 팝업 ━━━ */}
                {showVolume && visible && (
                    <div
                        className="flex flex-col items-center gap-1.5 rounded-xl px-2.5 py-2"
                        style={{
                            background: "rgba(15,23,42,0.92)",
                            border: "1px solid rgba(6,182,212,0.25)",
                            backdropFilter: "blur(12px)",
                            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                            animation: "mp-slide-in 0.22s ease-out both",
                        }}
                    >
                        <span className="text-[9px] text-slate-500 font-medium tracking-wider">VOL</span>
                        <input
                            type="range" min={0} max={1} step={0.05} value={volume}
                            onChange={(e) => setVolume(Number(e.target.value))}
                            className="h-20 cursor-pointer accent-cyan-400"
                            style={{ writingMode: "vertical-lr", direction: "rtl" }}
                            aria-label="볼륨 조절"
                        />
                        <span className="text-[9px] text-slate-400 font-mono">{Math.round(volume * 100)}</span>
                    </div>
                )}

                {/* ━━━ 메인 컨트롤 바 (토글) ━━━ */}
                <div className="flex items-center gap-1.5">

                    {/* 컨트롤 바 — visible 여부에 따라 표시/숨김 */}
                    <div
                        style={{
                            animation: visible
                                ? "mp-slide-in 0.25s cubic-bezier(0.34,1.56,0.64,1) both"
                                : "mp-slide-out 0.2s ease-in both",
                            display: visible ? "flex" : "none",
                            alignItems: "center",
                            gap: "6px",
                            borderRadius: "9999px",
                            padding: "8px 12px",
                            background: "rgba(15,23,42,0.88)",
                            border: `1px solid ${isPlaying ? "rgba(6,182,212,0.45)" : "rgba(71,85,105,0.5)"}`,
                            backdropFilter: "blur(12px)",
                            boxShadow: isPlaying
                                ? "0 0 14px rgba(6,182,212,0.25), 0 2px 10px rgba(0,0,0,0.4)"
                                : "0 2px 10px rgba(0,0,0,0.4)",
                            transition: "border-color 0.3s, box-shadow 0.3s",
                        }}
                    >
                        {/* 볼륨 버튼 */}
                        <button
                            onClick={() => setShowVolume((v) => !v)}
                            title="볼륨 조절"
                            className="flex items-center justify-center w-6 h-6 rounded-full hover:bg-slate-700/60 transition-colors"
                            aria-label="볼륨 조절"
                        >
                            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none"
                                stroke={showVolume ? "#22d3ee" : "#64748b"} strokeWidth={2}
                                strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                {volume > 0.55 && <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />}
                                {volume > 0.05 && <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />}
                            </svg>
                        </button>

                        {/* 재생/일시정지 */}
                        <button
                            onClick={togglePlay}
                            title={isPlaying ? "음악 끄기" : "음악 켜기"}
                            aria-label={isPlaying ? "음악 끄기" : "음악 켜기"}
                            className="flex items-center justify-center w-7 h-7 rounded-full transition-all duration-200 hover:scale-110 active:scale-95"
                            style={{
                                background: isPlaying ? "linear-gradient(135deg,#06b6d4,#3b82f6)" : "rgba(51,65,85,0.7)",
                                boxShadow: isPlaying ? "0 0 10px rgba(6,182,212,0.4)" : "none",
                            }}
                        >
                            {isPlaying ? (
                                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="white">
                                    <rect x="6" y="5" width="4" height="14" rx="1" />
                                    <rect x="14" y="5" width="4" height="14" rx="1" />
                                </svg>
                            ) : (
                                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="white">
                                    <polygon points="5 3 19 12 5 21 5 3" />
                                </svg>
                            )}
                        </button>

                        {/* 트랙 인디케이터 */}
                        <div
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full transition-all duration-300 ${trackChanging ? "opacity-0 scale-90" : "opacity-100 scale-100"}`}
                            title={TRACK_NAMES[trackIndex]}
                        >
                            {PLAYLIST.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => playTrack(i, isPlaying)}
                                    title={TRACK_NAMES[i]}
                                    className="transition-all duration-200 rounded-full hover:scale-125"
                                    style={{
                                        width: i === trackIndex ? "14px" : "5px",
                                        height: "5px",
                                        background: i === trackIndex
                                            ? "linear-gradient(90deg,#06b6d4,#3b82f6)"
                                            : "rgba(100,116,139,0.5)",
                                        boxShadow: i === trackIndex ? "0 0 6px rgba(6,182,212,0.6)" : "none",
                                    }}
                                    aria-label={TRACK_NAMES[i]}
                                />
                            ))}
                        </div>

                        {/* 다음 곡 */}
                        <button
                            onClick={handleNext}
                            title="다음 곡"
                            aria-label="다음 곡으로 건너뛰기"
                            className="flex items-center justify-center w-6 h-6 rounded-full hover:bg-slate-700/60 transition-all duration-200 hover:scale-110 active:scale-95"
                        >
                            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none"
                                stroke={isPlaying ? "#22d3ee" : "#64748b"} strokeWidth={2.2}
                                strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="5 4 15 12 5 20 5 4" />
                                <line x1="19" y1="5" x2="19" y2="19" />
                            </svg>
                        </button>

                        {/* 음파 애니메이션 */}
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

                    {/* ━━━ 토글 탭 버튼 ━━━ */}
                    <button
                        onClick={() => {
                            setVisible((v) => !v);
                            if (visible) setShowVolume(false); // 숨길 때 볼륨도 닫기
                        }}
                        title={visible ? "플레이어 숨기기" : "플레이어 열기"}
                        aria-label={visible ? "BGM 플레이어 숨기기" : "BGM 플레이어 열기"}
                        className="flex flex-col items-center justify-center w-8 h-8 rounded-full transition-all duration-300 hover:scale-110 active:scale-90 flex-shrink-0"
                        style={{
                            background: visible
                                ? "linear-gradient(135deg,rgba(6,182,212,0.25),rgba(99,102,241,0.2))"
                                : "rgba(15,23,42,0.85)",
                            border: `1px solid ${visible ? "rgba(6,182,212,0.5)" : "rgba(71,85,105,0.45)"}`,
                            backdropFilter: "blur(12px)",
                            boxShadow: visible
                                ? "0 0 12px rgba(6,182,212,0.2)"
                                : "0 2px 8px rgba(0,0,0,0.4)",
                            animation: isPlaying && !visible ? "tab-pulse 2s ease-in-out infinite" : "none",
                        }}
                    >
                        {/* 음표 아이콘 */}
                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none"
                            stroke={visible ? "#22d3ee" : (isPlaying ? "#06b6d4" : "#64748b")}
                            strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                        >
                            <path d="M9 18V5l12-2v13" />
                            <circle cx="6" cy="18" r="3" />
                            <circle cx="18" cy="16" r="3" />
                        </svg>
                        {/* 재생 중 표시 점 */}
                        {isPlaying && (
                            <span
                                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400"
                                style={{ boxShadow: "0 0 6px rgba(6,182,212,0.8)" }}
                            />
                        )}
                    </button>
                </div>

                {/* 트랙명 (재생 중 + visible) */}
                {isPlaying && visible && (
                    <div
                        className={`text-[9px] font-medium text-slate-500 px-2 py-0.5 rounded-full transition-all duration-300 ${trackChanging ? "opacity-0 translate-y-1" : "opacity-70 translate-y-0"}`}
                        style={{ letterSpacing: "0.05em" }}
                    >
                        {TRACK_NAMES[trackIndex]} · {trackIndex + 1}/{PLAYLIST.length}
                    </div>
                )}
            </div>
        </>
    );
}
