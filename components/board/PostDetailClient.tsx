"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleContext";
import type { LocaleCode } from "@/lib/i18n/LocaleContext";
import CommentSection from "./CommentSection";

/* ═══════════════════════════════════════
   타입
   ═══════════════════════════════════════ */

interface Post {
    id: number;
    title: string;
    content: string;
    image_url: string | null;
    created_at: string;
}

/* ═══════════════════════════════════════
   캐시 헬퍼
   ═══════════════════════════════════════ */

function getCacheKey(locale: string, id: number | string, field: "title" | "content") {
    return `tx_${locale}_${id}_${field}`;
}
function readCache(key: string): string | null {
    try { return sessionStorage.getItem(key); } catch { return null; }
}
function writeCache(key: string, value: string) {
    try { sessionStorage.setItem(key, value); } catch { /* ignore */ }
}

/* ═══════════════════════════════════════
   번역 API
   ═══════════════════════════════════════ */

async function translateText(text: string, targetLang: LocaleCode): Promise<string> {
    if (!text.trim()) return text;
    const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, targetLang }),
    });
    if (!res.ok) throw new Error(`translate API ${res.status}`);
    const data = await res.json();
    return data.translatedText as string;
}

/* HTML 태그 제거 후 순수 텍스트 추출 (HTML content 번역 전트리용) */
function stripHtml(html: string): string {
    if (typeof document !== "undefined") {
        const div = document.createElement("div");
        div.innerHTML = html;
        return div.textContent ?? div.innerText ?? "";
    }
    // SSR fallback: 정규식으로 태그 제거
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/* content가 HTML인지 (Quill 저장본 별도 체크) */
function isHtmlContent(text: string): boolean {
    return /<[a-z][^>]*>/i.test(text);
}

/* ═══════════════════════════════════════
   날짜 포맷
   ═══════════════════════════════════════ */

function formatDate(iso: string) {
    return new Date(iso).toLocaleString("ko-KR", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit",
    });
}

/* ═══════════════════════════════════════
   Props
   ═══════════════════════════════════════ */

interface PostDetailClientProps {
    tableName: "notices" | "free_board";
    listHref: string;
    accentColor: string;
}

/* ═══════════════════════════════════════
   PostDetailClient
   ═══════════════════════════════════════ */

export default function PostDetailClient({ tableName, listHref, accentColor }: PostDetailClientProps) {
    const params = useParams();
    const router = useRouter();
    const { locale, t } = useLocale();

    const postId = params.id as string;

    const [post, setPost] = useState<Post | null>(null);
    const [fetching, setFetching] = useState(true);
    const [imgError, setImgError] = useState(false);

    // 번역 상태
    const [translating, setTranslating] = useState(false);
    const [translatedTitle, setTranslatedTitle] = useState<string | null>(null);
    const [translatedContent, setTranslatedContent] = useState<string | null>(null);
    const [translateError, setTranslateError] = useState<string | null>(null);
    const [showTranslated, setShowTranslated] = useState(false);

    /* DB에서 게시글 fetch */
    useEffect(() => {
        if (!postId) return;
        setFetching(true);
        supabase
            .from(tableName)
            .select("*")
            .eq("id", postId)
            .single()
            .then(({ data, error }) => {
                if (error || !data) { router.replace(listHref); return; }
                setPost(data as Post);
                setFetching(false);
            });
    }, [postId, tableName, listHref, router]);

    /* 자동 번역 — post 로드 후 locale이 ko가 아니면 즉시 실행 */
    useEffect(() => {
        if (!post || locale === "ko") {
            setShowTranslated(false);
            return;
        }

        const ck1 = getCacheKey(locale, post.id, "title");
        const ck2 = getCacheKey(locale, post.id, "content");
        const ct = readCache(ck1);
        const cc = readCache(ck2);

        if (ct && cc) {
            setTranslatedTitle(ct);
            setTranslatedContent(cc);
            setShowTranslated(true);
            return;
        }

        let cancelled = false;
        setTranslating(true);
        setTranslateError(null);

        Promise.all([
            translateText(post.title, locale),
            // HTML content는 태그 제거 후 텍스트만 번역
            translateText(
                isHtmlContent(post.content) ? stripHtml(post.content) : post.content,
                locale
            ),
        ])
            .then(([tTitle, tContent]) => {
                if (cancelled) return;
                writeCache(ck1, tTitle);
                writeCache(ck2, tContent);
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
    }, [post?.id, locale]);

    const displayTitle = showTranslated && translatedTitle ? translatedTitle : post?.title ?? "";
    const displayContent = showTranslated && translatedContent ? translatedContent : post?.content ?? "";

    /* ── 로딩 ── */
    if (fetching) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-gray-950 flex items-center justify-center">
                <span className="inline-block w-8 h-8 border-2 border-slate-700 border-t-cyan-500 rounded-full animate-spin" />
            </div>
        );
    }

    if (!post) return null;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-gray-950 text-white">
            <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">

                {/* 뒤로가기 */}
                <Link
                    href={listHref}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-cyan-400 transition-colors mb-6"
                >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    목록으로
                </Link>

                {/* 번역 상태 바 */}
                {locale !== "ko" && (
                    <div
                        className="mb-5 flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-sm"
                        style={{
                            background: translating
                                ? "rgba(51,65,85,0.4)"
                                : showTranslated
                                    ? "rgba(6,182,212,0.08)"
                                    : "rgba(51,65,85,0.3)",
                            border: translating
                                ? "1px solid rgba(71,85,105,0.4)"
                                : showTranslated
                                    ? "1px solid rgba(6,182,212,0.25)"
                                    : "1px solid rgba(71,85,105,0.4)",
                        }}
                    >
                        {translating ? (
                            <span className="flex items-center gap-2 text-slate-400 text-xs">
                                <span className="inline-block w-3.5 h-3.5 border border-slate-400/40 border-t-slate-300 rounded-full animate-spin" />
                                {t.board.translating}
                            </span>
                        ) : showTranslated ? (
                            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-cyan-400">
                                🌐 {t.board.translatedLabel}
                            </span>
                        ) : (
                            <span className="text-[11px] text-slate-500">
                                {translateError ?? "원문을 표시 중입니다."}
                            </span>
                        )}

                        {/* 토글 */}
                        {translatedTitle && !translating && (
                            <button
                                onClick={() => setShowTranslated((v) => !v)}
                                className="flex-shrink-0 text-[11px] font-semibold px-3 py-1 rounded-lg transition-all hover:opacity-80"
                                style={{
                                    background: showTranslated ? "rgba(51,65,85,0.6)" : "rgba(6,182,212,0.15)",
                                    border: showTranslated ? "1px solid rgba(71,85,105,0.5)" : "1px solid rgba(6,182,212,0.35)",
                                    color: showTranslated ? "#94a3b8" : "#67e8f9",
                                }}
                            >
                                {showTranslated ? t.board.originalLabel : t.board.translateBtn}
                            </button>
                        )}
                    </div>
                )}

                {/* 이미지 — 원본 비율 유지 (잘림 없음) */}
                {post.image_url && !imgError && (
                    <div className="w-full rounded-2xl overflow-hidden mb-6"
                        style={{ boxShadow: "0 4px 28px rgba(0,0,0,0.45)" }}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={post.image_url}
                            alt={post.title}
                            onError={() => setImgError(true)}
                            style={{
                                width: "100%",
                                height: "auto",
                                display: "block",
                                objectFit: "contain",
                            }}
                        />
                    </div>
                )}

                {/* 제목 */}
                <div
                    className="rounded-2xl border p-6 sm:p-8 space-y-4"
                    style={{
                        background: "rgba(15,23,42,0.75)",
                        borderColor: "rgba(51,65,85,0.55)",
                        backdropFilter: "blur(12px)",
                        boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
                    }}
                >
                    <h1
                        className={`text-xl sm:text-2xl font-extrabold leading-snug bg-clip-text text-transparent bg-gradient-to-r ${accentColor} transition-opacity duration-300 ${translating ? "opacity-30" : "opacity-100"}`}
                    >
                        {translating ? (
                            <span className="inline-block w-3/4 h-6 rounded bg-slate-700 animate-pulse" />
                        ) : displayTitle}
                    </h1>

                    <p className="text-[11px] text-slate-600">
                        🕐 {formatDate(post.created_at)}
                    </p>

                    <hr style={{ borderColor: "rgba(51,65,85,0.45)" }} />

                    {/* 내용 — 원문 HTML 또는 번역 텍스트 */}
                    <div
                        className={`text-sm sm:text-base text-slate-300 leading-relaxed transition-opacity duration-300 ${translating ? "opacity-20" : "opacity-100"
                            }`}
                    >
                        {translating ? (
                            /* 스켈레톤 */
                            <div className="space-y-2.5">
                                {[1, 0.9, 0.8, 0.6, 0.7].map((w, i) => (
                                    <span
                                        key={i}
                                        className="block h-4 rounded bg-slate-700/60 animate-pulse"
                                        style={{ width: `${w * 100}%` }}
                                    />
                                ))}
                            </div>
                        ) : showTranslated && translatedContent ? (
                            /* 번역본: 텍스트 형식으로 표시 */
                            <p className="whitespace-pre-wrap">{translatedContent}</p>
                        ) : isHtmlContent(displayContent) ? (
                            /* 원문 HTML 콘텐츠: 안전하게 렌더링 */
                            <>
                                <style>{`
                                    .ql-rendered img { max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0; }
                                    .ql-rendered p { margin-bottom: 0.75rem; }
                                    .ql-rendered h1, .ql-rendered h2, .ql-rendered h3 { font-weight: bold; margin: 1rem 0 0.5rem; color: #e2e8f0; }
                                    .ql-rendered h1 { font-size: 1.4rem; }
                                    .ql-rendered h2 { font-size: 1.2rem; }
                                    .ql-rendered h3 { font-size: 1.05rem; }
                                    .ql-rendered ul, .ql-rendered ol { padding-left: 1.5rem; margin-bottom: 0.75rem; }
                                    .ql-rendered ul { list-style: disc; }
                                    .ql-rendered ol { list-style: decimal; }
                                    .ql-rendered li { margin-bottom: 0.25rem; }
                                    .ql-rendered strong { font-weight: 700; color: #f1f5f9; }
                                    .ql-rendered em { font-style: italic; }
                                    .ql-rendered a { color: #22d3ee; text-decoration: underline; }
                                    .ql-rendered blockquote { border-left: 3px solid rgba(6,182,212,0.4); padding-left: 1rem; color: #94a3b8; margin: 0.5rem 0; }
                                `}</style>
                                <div
                                    className="ql-rendered"
                                    dangerouslySetInnerHTML={{ __html: displayContent }}
                                />
                            </>
                        ) : (
                            /* 일반 텍스트 (Quill 이전 글) */
                            <p className="whitespace-pre-wrap">{displayContent}</p>
                        )}
                    </div>
                </div>

                {/* ── 댓글 섹션 ── */}
                <CommentSection boardId={tableName} postId={post.id} />

            </div>
        </div>
    );
}
