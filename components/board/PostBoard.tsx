"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleContext";
import type { LocaleCode } from "@/lib/i18n/LocaleContext";

/* ═══════════════════════════════════════
   타입 정의
   ═══════════════════════════════════════ */

export interface Post {
    id: number;
    title: string;
    content: string;
    image_url: string | null;
    created_at: string;
}

export interface PostBoardConfig {
    tableName: "notices" | "free_board";
    pageTitle: string;
    pageSubtitle: string;
    accentColor: string;
    emptyMessage: string;
}

/* ═══════════════════════════════════════
   날짜 포맷 헬퍼
   ═══════════════════════════════════════ */

function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString("ko-KR", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit",
    });
}

/* ═══════════════════════════════════════
   번역 API 호출 헬퍼
   ═══════════════════════════════════════ */

async function translateText(text: string, targetLang: LocaleCode): Promise<string> {
    const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, targetLang }),
    });
    if (!res.ok) throw new Error(`translate API ${res.status}`);
    const data = await res.json();
    return data.translatedText as string;
}

/* ═══════════════════════════════════════
   서브 컴포넌트 — 게시글 카드 (번역 기능 포함)
   ═══════════════════════════════════════ */

function PostCard({ post }: { post: Post }) {
    const { locale, t } = useLocale();
    const [imgError, setImgError] = useState(false);

    // 번역 상태
    const [translating, setTranslating] = useState(false);
    const [translatedTitle, setTranslatedTitle] = useState<string | null>(null);
    const [translatedContent, setTranslatedContent] = useState<string | null>(null);
    const [translateError, setTranslateError] = useState<string | null>(null);
    const [showTranslated, setShowTranslated] = useState(false);

    // 언어 변경 시 번역 초기화
    useEffect(() => {
        setTranslatedTitle(null);
        setTranslatedContent(null);
        setShowTranslated(false);
        setTranslateError(null);
    }, [locale]);

    const handleTranslate = async () => {
        if (locale === "ko") return;

        // 이미 번역된 경우 토글
        if (translatedTitle && translatedContent) {
            setShowTranslated((v) => !v);
            return;
        }

        setTranslating(true);
        setTranslateError(null);
        try {
            const [tTitle, tContent] = await Promise.all([
                translateText(post.title, locale),
                translateText(post.content, locale),
            ]);
            setTranslatedTitle(tTitle);
            setTranslatedContent(tContent);
            setShowTranslated(true);
        } catch {
            setTranslateError(t.board.translateError);
        } finally {
            setTranslating(false);
        }
    };

    const displayTitle = showTranslated && translatedTitle ? translatedTitle : post.title;
    const displayContent = showTranslated && translatedContent ? translatedContent : post.content;

    return (
        <article
            className="group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl"
            style={{
                background: "rgba(15,23,42,0.7)",
                borderColor: "rgba(51,65,85,0.5)",
                backdropFilter: "blur(8px)",
                boxShadow: "0 2px 16px rgba(0,0,0,0.3)",
            }}
        >
            {/* 이미지 */}
            {post.image_url && !imgError && (
                <div className="relative h-52 w-full overflow-hidden">
                    <Image
                        src={post.image_url}
                        alt={post.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        onError={() => setImgError(true)}
                        sizes="(max-width: 768px) 100vw, 50vw"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-900/90 to-transparent" />
                </div>
            )}

            {/* 텍스트 */}
            <div className="p-5 space-y-2">
                {/* 번역 상태 배지 */}
                {showTranslated && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                        🌐 {t.board.translatedLabel}
                    </span>
                )}

                <h2 className="text-base font-bold text-white leading-snug line-clamp-2">
                    {displayTitle}
                </h2>
                <p className="text-sm text-slate-400 leading-relaxed line-clamp-3 whitespace-pre-wrap">
                    {displayContent}
                </p>
                <p className="text-[11px] text-slate-600 pt-1">
                    🕐 {formatDate(post.created_at)}
                </p>

                {/* 번역 에러 */}
                {translateError && (
                    <p className="text-[11px] text-red-400">{translateError}</p>
                )}

                {/* 번역 버튼 — 한국어가 아닐 때만 표시 */}
                {locale !== "ko" && (
                    <button
                        onClick={handleTranslate}
                        disabled={translating}
                        className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all duration-200 disabled:opacity-50"
                        style={{
                            background: showTranslated
                                ? "rgba(51,65,85,0.5)"
                                : "rgba(6,182,212,0.1)",
                            border: showTranslated
                                ? "1px solid rgba(51,65,85,0.5)"
                                : "1px solid rgba(6,182,212,0.3)",
                            color: showTranslated ? "#94a3b8" : "#67e8f9",
                        }}
                    >
                        {translating ? (
                            <>
                                <span className="inline-block w-3 h-3 border border-cyan-400/40 border-t-cyan-400 rounded-full animate-spin" />
                                {t.board.translating}
                            </>
                        ) : showTranslated ? (
                            t.board.originalLabel
                        ) : (
                            t.board.translateBtn
                        )}
                    </button>
                )}
            </div>

            {/* 호버 테두리 */}
            <div
                className="absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none"
                style={{ boxShadow: "inset 0 0 0 1px rgba(6,182,212,0.25)" }}
            />
        </article>
    );
}

/* ═══════════════════════════════════════
   메인 컴포넌트 — PostBoard (읽기 전용)
   글쓰기는 플로팅 버튼(FloatingWriteButtons)을 통해서만 진입
   ═══════════════════════════════════════ */

export default function PostBoard({
    tableName,
    pageTitle,
    pageSubtitle,
    accentColor,
    emptyMessage,
}: PostBoardConfig) {
    const { t } = useLocale();

    const [isFetching, setIsFetching] = useState(true);
    const [posts, setPosts] = useState<Post[]>([]);

    const fetchPosts = useCallback(async () => {
        setIsFetching(true);
        const { data, error } = await supabase
            .from(tableName)
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            console.error(`[PostBoard][${tableName}] 불러오기 실패:`, error.message);
        } else {
            setPosts((data as Post[]) ?? []);
        }
        setIsFetching(false);
    }, [tableName]);

    useEffect(() => { fetchPosts(); }, [fetchPosts]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-gray-950 text-white">
            <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">

                {/* ── 페이지 헤더 ── */}
                <div className="mb-8">
                    <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r ${accentColor}`}>
                        {pageTitle}
                    </h1>
                    <p className="mt-1.5 text-sm text-slate-400">{pageSubtitle}</p>

                    {/* 글쓰기 안내 문구 */}
                    <p className="mt-2 text-xs text-slate-600 flex items-center gap-1.5">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-500/60" />
                        새 글 작성은 화면 우측 하단 <strong className="text-cyan-600">✏️ 빠른 글쓰기</strong> 버튼을 이용하세요.
                    </p>
                </div>

                {/* ══ 게시글 목록 ══ */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-bold text-slate-300">
                            {t.board.postList}
                            {!isFetching && (
                                <span className="ml-2 text-xs font-normal text-slate-500">
                                    ({posts.length}건)
                                </span>
                            )}
                        </h2>
                        <button
                            onClick={fetchPosts}
                            disabled={isFetching}
                            className="text-xs text-slate-500 hover:text-cyan-400 transition-colors disabled:opacity-40 flex items-center gap-1"
                        >
                            <span className={isFetching ? "animate-spin inline-block" : ""}>↻</span>
                            {t.board.refresh}
                        </button>
                    </div>

                    {/* 로딩 */}
                    {isFetching && (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
                            <span className="inline-block w-6 h-6 border-2 border-slate-700 border-t-cyan-500 rounded-full animate-spin" />
                            <span className="text-sm">{t.board.loading}</span>
                        </div>
                    )}

                    {/* 빈 목록 */}
                    {!isFetching && posts.length === 0 && (
                        <div
                            className="flex flex-col items-center justify-center py-20 rounded-2xl border text-slate-500 gap-4"
                            style={{
                                background: "rgba(15,23,42,0.5)",
                                borderColor: "rgba(51,65,85,0.4)",
                            }}
                        >
                            <span className="text-5xl opacity-30">📭</span>
                            <p className="text-sm">{emptyMessage}</p>
                            <p className="text-xs text-slate-600">
                                우측 하단 ✏️ 버튼으로 첫 글을 작성해 보세요!
                            </p>
                        </div>
                    )}

                    {/* 게시글 카드 그리드 */}
                    {!isFetching && posts.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {posts.map((post) => (
                                <PostCard key={post.id} post={post} />
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
