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
    author: string | null;
}

/* 이전/다음 글 요약 타입 */
interface AdjacentPost {
    id: number;
    title: string;
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

async function translateText(
    text: string,
    targetLang: LocaleCode,
    sourceLang = "auto",
): Promise<string> {
    if (!text.trim()) return text;
    const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, targetLang, sourceLang }),
    });
    if (!res.ok) throw new Error(`translate API ${res.status}`);
    const data = await res.json();
    return data.translatedText as string;
}

/* 언어 자동 감지: 한글/영문/한자 비율으로 원문 언어 폀지 */
function guessLang(text: string): string {
    const koChars = (text.match(/[\uAC00-\uD7A3]/g) || []).length;
    const enChars = (text.match(/[a-zA-Z]/g) || []).length;
    const zhChars = (text.match(/[\u4E00-\u9FFF]/g) || []).length;
    const total = text.length || 1;
    if (koChars / total > 0.15) return "ko";
    if (zhChars / total > 0.1) return "zh";
    if (enChars / total > 0.3) return "en";
    return "auto";
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

    // 이전/다음 글
    const [prevPost, setPrevPost] = useState<AdjacentPost | null>(null);
    const [nextPost, setNextPost] = useState<AdjacentPost | null>(null);

    // 번역 상태
    const [translating, setTranslating] = useState(false);
    const [translatedTitle, setTranslatedTitle] = useState<string | null>(null);
    const [translatedContent, setTranslatedContent] = useState<string | null>(null);
    const [translateError, setTranslateError] = useState<string | null>(null);
    const [showTranslated, setShowTranslated] = useState(false);

    /* DB에서 게시글 fetch + 이전/다음 글 병렬 조회 */
    useEffect(() => {
        if (!postId) return;
        const numId = Number(postId);
        setFetching(true);
        setPrevPost(null);
        setNextPost(null);

        Promise.all([
            /* 현재 글 */
            supabase.from(tableName).select("*").eq("id", postId).single(),
            /* 이전 글: id < 현재, 보른 순서 원하는 거 (id DESC 중 요는 id < numId에서 가장 큰 것) */
            supabase.from(tableName)
                .select("id, title")
                .lt("id", numId)
                .order("id", { ascending: false })
                .limit(1),
            /* 다음 글: id > 현재 */
            supabase.from(tableName)
                .select("id, title")
                .gt("id", numId)
                .order("id", { ascending: true })
                .limit(1),
        ]).then(([{ data: cur, error }, { data: prevData }, { data: nextData }]) => {
            if (error || !cur) { router.replace(listHref); return; }
            setPost(cur as Post);
            setFetching(false);
            if (prevData && prevData.length > 0) setPrevPost(prevData[0] as AdjacentPost);
            if (nextData && nextData.length > 0) setNextPost(nextData[0] as AdjacentPost);
        });
    }, [postId, tableName, listHref, router]);

    /* 양방향 자동 번역 — post 로드 후 실행
     * 원문 언어를 폀지하여 locale과 다르면 번역
     * ko 사용자도 영문/중문 글은 한국어로 번역됨 */
    useEffect(() => {
        if (!post) { setShowTranslated(false); return; }

        const rawText = post.title + " " + (isHtmlContent(post.content) ? stripHtml(post.content) : post.content).slice(0, 200);
        const guessedLang = guessLang(rawText);

        /* 원문 언어 === locale 이면 번역 불필요 */
        if (guessedLang === locale || (guessedLang === "auto" && locale === "ko")) {
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
            translateText(post.title, locale, guessedLang),
            translateText(
                isHtmlContent(post.content) ? stripHtml(post.content) : post.content,
                locale,
                guessedLang,
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

                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[11px] text-slate-600">
                            🕐 {formatDate(post.created_at)}
                        </p>
                        {post.author && (
                            <span
                                className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full"
                                style={{
                                    background: "rgba(6,182,212,0.1)",
                                    border: "1px solid rgba(6,182,212,0.25)",
                                    color: "#67e8f9",
                                }}
                            >
                                👤 {post.author}
                            </span>
                        )}
                    </div>

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

                {/* 이전/다음 글 네비게이션 */}
                {(prevPost || nextPost) && (
                    <nav
                        className="rounded-2xl overflow-hidden"
                        style={{
                            border: "1px solid rgba(51,65,85,0.5)",
                            background: "rgba(15,23,42,0.6)",
                            backdropFilter: "blur(8px)",
                        }}
                    >
                        <div
                            className="grid grid-cols-2"
                            style={{
                                borderTop: "none",
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                            }}
                        >
                            {/* 이전 글 */}
                            {prevPost ? (
                                <Link
                                    href={`${listHref}/${prevPost.id}`}
                                    className="group flex items-center gap-3 px-4 py-4 sm:px-5 sm:py-5 transition-all duration-200 hover:bg-slate-700/30"
                                    style={{ borderRight: "1px solid rgba(51,65,85,0.5)" }}
                                >
                                    <span
                                        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover:-translate-x-0.5"
                                        style={{
                                            background: "rgba(6,182,212,0.1)",
                                            border: "1px solid rgba(6,182,212,0.25)",
                                            color: "#22d3ee",
                                        }}
                                    >
                                        ◄
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-[10px] text-slate-600 mb-0.5">이전 글</p>
                                        <p className="text-xs sm:text-sm font-medium text-slate-300 truncate group-hover:text-cyan-300 transition-colors">
                                            {prevPost.title}
                                        </p>
                                    </div>
                                </Link>
                            ) : (
                                <div
                                    className="flex items-center justify-center px-4 py-4 sm:px-5 sm:py-5"
                                    style={{ borderRight: "1px solid rgba(51,65,85,0.5)" }}
                                >
                                    <span className="text-xs text-slate-700">첫 번째 글입니다</span>
                                </div>
                            )}

                            {/* 다음 글 */}
                            {nextPost ? (
                                <Link
                                    href={`${listHref}/${nextPost.id}`}
                                    className="group flex items-center justify-end gap-3 px-4 py-4 sm:px-5 sm:py-5 transition-all duration-200 hover:bg-slate-700/30"
                                >
                                    <div className="min-w-0 text-right">
                                        <p className="text-[10px] text-slate-600 mb-0.5">다음 글</p>
                                        <p className="text-xs sm:text-sm font-medium text-slate-300 truncate group-hover:text-purple-300 transition-colors">
                                            {nextPost.title}
                                        </p>
                                    </div>
                                    <span
                                        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover:translate-x-0.5"
                                        style={{
                                            background: "rgba(168,85,247,0.1)",
                                            border: "1px solid rgba(168,85,247,0.25)",
                                            color: "#c084fc",
                                        }}
                                    >
                                        ►
                                    </span>
                                </Link>
                            ) : (
                                <div className="flex items-center justify-center px-4 py-4 sm:px-5 sm:py-5">
                                    <span className="text-xs text-slate-700">마지막 글입니다</span>
                                </div>
                            )}
                        </div>
                    </nav>
                )}

                {/* ── 댓글 섹션 ── */}
                {/* postId를 URL 파라미터에서 직접 변환해 넓김으로써 bigint 타입과의 미스매치 방지 */}
                <CommentSection boardId={tableName} postId={Number(postId)} />

            </div>
        </div>
    );
}
