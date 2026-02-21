"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
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
   번역 캐시 (sessionStorage)
   ═══════════════════════════════════════ */

function getCacheKey(locale: string, postId: number, field: "title" | "content") {
    return `tx_${locale}_${postId}_${field}`;
}

function readCache(key: string): string | null {
    try { return sessionStorage.getItem(key); } catch { return null; }
}

function writeCache(key: string, value: string) {
    try { sessionStorage.setItem(key, value); } catch { /* ignore */ }
}

/* ═══════════════════════════════════════
   번역 API 호출
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
   게시글 카드 — 자동 번역 포함
   ═══════════════════════════════════════ */

interface PostCardProps {
    post: Post;
    tableName: "notices" | "free_board";
}

function PostCard({ post, tableName }: PostCardProps) {
    const { locale, t } = useLocale();
    const [imgError, setImgError] = useState(false);

    const [translating, setTranslating] = useState(false);
    const [translatedTitle, setTranslatedTitle] = useState<string | null>(null);
    const [translatedContent, setTranslatedContent] = useState<string | null>(null);
    const [translateError, setTranslateError] = useState<string | null>(null);
    const [showTranslated, setShowTranslated] = useState(false);

    // 상세 페이지 경로
    const detailHref = tableName === "notices"
        ? `/notice/${post.id}`
        : `/free-board/${post.id}`;

    /* 자동 번역: locale이 ko가 아닐 때 마운트/변경 시 즉시 실행 */
    useEffect(() => {
        if (locale === "ko") {
            setShowTranslated(false);
            return;
        }

        // 캐시 확인
        const cachedTitle = readCache(getCacheKey(locale, post.id, "title"));
        const cachedContent = readCache(getCacheKey(locale, post.id, "content"));

        if (cachedTitle && cachedContent) {
            setTranslatedTitle(cachedTitle);
            setTranslatedContent(cachedContent);
            setShowTranslated(true);
            return;
        }

        // API 번역
        let cancelled = false;
        setTranslating(true);
        setTranslateError(null);

        Promise.all([
            translateText(post.title, locale),
            translateText(post.content, locale),
        ])
            .then(([tTitle, tContent]) => {
                if (cancelled) return;
                writeCache(getCacheKey(locale, post.id, "title"), tTitle);
                writeCache(getCacheKey(locale, post.id, "content"), tContent);
                setTranslatedTitle(tTitle);
                setTranslatedContent(tContent);
                setShowTranslated(true);
            })
            .catch(() => {
                if (!cancelled) setTranslateError(t.board.translateError);
            })
            .finally(() => {
                if (!cancelled) setTranslating(false);
            });

        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [locale, post.id]);

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
                <Link href={detailHref} className="block">
                    <div className="relative h-48 w-full overflow-hidden">
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
                </Link>
            )}

            <div className="p-5 space-y-2">
                {/* 상태 배지 행 */}
                <div className="flex items-center gap-2 flex-wrap min-h-[20px]">
                    {/* 번역 중 스켈레톤 */}
                    {translating && (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-400 border border-slate-600/40 animate-pulse">
                            <span className="inline-block w-2.5 h-2.5 border border-slate-400/40 border-t-slate-300 rounded-full animate-spin" />
                            {t.board.translating}
                        </span>
                    )}
                    {/* 번역됨 배지 */}
                    {showTranslated && !translating && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/12 text-cyan-400 border border-cyan-500/25">
                            🌐 {t.board.translatedLabel}
                        </span>
                    )}
                    {/* 원문 / 번역 토글 버튼 */}
                    {locale !== "ko" && translatedTitle && !translating && (
                        <button
                            onClick={() => setShowTranslated((v) => !v)}
                            className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full transition-all duration-150 hover:opacity-80"
                            style={{
                                background: "rgba(51,65,85,0.4)",
                                border: "1px solid rgba(71,85,105,0.4)",
                                color: "#94a3b8",
                            }}
                        >
                            {showTranslated ? t.board.originalLabel : t.board.translateBtn}
                        </button>
                    )}
                </div>

                {/* 제목 — 클릭 시 상세 페이지로 */}
                <Link href={detailHref} className="block group/title">
                    <h2 className={`text-base font-bold leading-snug line-clamp-2 transition-colors duration-150 group-hover/title:text-cyan-300 ${translating ? "text-slate-500" : "text-white"}`}>
                        {translating ? (
                            <span className="inline-block w-3/4 h-4 rounded bg-slate-700 animate-pulse" />
                        ) : displayTitle}
                    </h2>
                </Link>

                {/* 내용 */}
                <p className={`text-sm leading-relaxed line-clamp-3 whitespace-pre-wrap ${translating ? "text-slate-700" : "text-slate-400"}`}>
                    {translating ? (
                        <span className="block space-y-1.5">
                            <span className="block w-full h-3 rounded bg-slate-700/70 animate-pulse" />
                            <span className="block w-5/6 h-3 rounded bg-slate-700/70 animate-pulse" />
                            <span className="block w-4/6 h-3 rounded bg-slate-700/70 animate-pulse" />
                        </span>
                    ) : displayContent}
                </p>

                {/* 번역 오류 */}
                {translateError && (
                    <p className="text-[10px] text-red-400/80">{translateError}</p>
                )}

                <div className="flex items-center justify-between pt-1">
                    <p className="text-[11px] text-slate-600">
                        🕐 {formatDate(post.created_at)}
                    </p>
                    <Link
                        href={detailHref}
                        className="text-[11px] text-slate-600 hover:text-cyan-400 transition-colors flex items-center gap-0.5"
                    >
                        자세히
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </Link>
                </div>
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
   메인 컴포넌트 — PostBoard (목록 전용)
   ═══════════════════════════════════════ */

export default function PostBoard({
    tableName, pageTitle, pageSubtitle, accentColor, emptyMessage,
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

                <div className="mb-8">
                    <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r ${accentColor}`}>
                        {pageTitle}
                    </h1>
                    <p className="mt-1.5 text-sm text-slate-400">{pageSubtitle}</p>
                    <p className="mt-2 text-xs text-slate-600 flex items-center gap-1.5">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-500/60" />
                        새 글 작성은 화면 우측 하단 <strong className="text-cyan-600">✏️ 빠른 글쓰기</strong> 버튼을 이용하세요.
                    </p>
                </div>

                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-bold text-slate-300">
                            {t.board.postList}
                            {!isFetching && (
                                <span className="ml-2 text-xs font-normal text-slate-500">({posts.length}건)</span>
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

                    {isFetching && (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
                            <span className="inline-block w-6 h-6 border-2 border-slate-700 border-t-cyan-500 rounded-full animate-spin" />
                            <span className="text-sm">{t.board.loading}</span>
                        </div>
                    )}

                    {!isFetching && posts.length === 0 && (
                        <div
                            className="flex flex-col items-center justify-center py-20 rounded-2xl border text-slate-500 gap-4"
                            style={{ background: "rgba(15,23,42,0.5)", borderColor: "rgba(51,65,85,0.4)" }}
                        >
                            <span className="text-5xl opacity-30">📭</span>
                            <p className="text-sm">{emptyMessage}</p>
                            <p className="text-xs text-slate-600">우측 하단 ✏️ 버튼으로 첫 글을 작성해 보세요!</p>
                        </div>
                    )}

                    {!isFetching && posts.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {posts.map((post) => (
                                <PostCard key={post.id} post={post} tableName={tableName} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
