"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
   이미지 업로드 로직
   ═══════════════════════════════════════ */

async function uploadImage(file: File): Promise<string | null> {
    const ext = file.name.split(".").pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const filePath = `posts/${fileName}`;

    const { error } = await supabase.storage
        .from("post_images")
        .upload(filePath, file, { cacheControl: "3600", upsert: false });

    if (error) {
        console.error("[PostBoard] 이미지 업로드 실패:", error.message);
        return null;
    }

    const { data } = supabase.storage.from("post_images").getPublicUrl(filePath);
    return data.publicUrl;
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

    // 언어가 바뀌면 번역 초기화
    useEffect(() => {
        setTranslatedTitle(null);
        setTranslatedContent(null);
        setShowTranslated(false);
        setTranslateError(null);
    }, [locale]);

    const handleTranslate = async () => {
        if (locale === "ko") return; // 한국어면 번역 불필요

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
   메인 컴포넌트 — PostBoard
   ═══════════════════════════════════════ */

export default function PostBoard({
    tableName,
    pageTitle,
    pageSubtitle,
    accentColor,
    emptyMessage,
}: PostBoardConfig) {
    const { t } = useLocale();

    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const [posts, setPosts] = useState<Post[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        setImageFile(file);
        if (file) {
            const reader = new FileReader();
            reader.onload = () => setImagePreview(reader.result as string);
            reader.readAsDataURL(file);
        } else {
            setImagePreview(null);
        }
    };

    const handleRemoveImage = () => {
        setImageFile(null);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !content.trim()) {
            setError(t.board.validationError);
            return;
        }

        setIsSubmitting(true);
        setError(null);
        setSuccessMsg(null);

        let imageUrl: string | null = null;
        if (imageFile) {
            imageUrl = await uploadImage(imageFile);
            if (!imageUrl) {
                setError(t.board.uploadError);
                setIsSubmitting(false);
                return;
            }
        }

        const { error: insertError } = await supabase.from(tableName).insert({
            title: title.trim(),
            content: content.trim(),
            image_url: imageUrl,
        });

        if (insertError) {
            console.error(`[PostBoard][${tableName}] INSERT 실패:`, insertError.message);
            setError(`등록 실패: ${insertError.message}`);
            setIsSubmitting(false);
            return;
        }

        console.log(`[PostBoard][${tableName}] 게시글 등록 완료 ✅`);
        setSuccessMsg(t.board.successMsg);
        setTitle("");
        setContent("");
        handleRemoveImage();
        await fetchPosts();
        setIsSubmitting(false);
        setTimeout(() => setSuccessMsg(null), 3000);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-gray-950 text-white">
            <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">

                {/* ── 페이지 헤더 ── */}
                <div className="mb-8">
                    <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r ${accentColor}`}>
                        {pageTitle}
                    </h1>
                    <p className="mt-1.5 text-sm text-slate-400">{pageSubtitle}</p>
                </div>

                {/* ══ 글쓰기 폼 ══ */}
                <form
                    onSubmit={handleSubmit}
                    className="mb-10 rounded-2xl border p-5 sm:p-6 space-y-4"
                    style={{
                        background: "rgba(15,23,42,0.8)",
                        borderColor: "rgba(51,65,85,0.6)",
                        backdropFilter: "blur(12px)",
                        boxShadow: "0 4px 32px rgba(0,0,0,0.4)",
                    }}
                >
                    <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
                        {t.board.newPost}
                    </h2>

                    {/* 제목 */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                            {t.board.titleLabel} <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={t.board.titlePlaceholder}
                            maxLength={100}
                            className="w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition-all"
                            style={{ background: "rgba(30,41,59,0.8)", border: "1px solid rgba(71,85,105,0.5)" }}
                            onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px rgba(6,182,212,0.4)")}
                            onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                        />
                    </div>

                    {/* 내용 */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                            {t.board.contentLabel} <span className="text-red-400">*</span>
                        </label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder={t.board.contentPlaceholder}
                            rows={4}
                            className="w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none resize-none transition-all"
                            style={{ background: "rgba(30,41,59,0.8)", border: "1px solid rgba(71,85,105,0.5)" }}
                            onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px rgba(6,182,212,0.4)")}
                            onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                        />
                    </div>

                    {/* 이미지 업로드 */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                            {t.board.imageLabel} <span className="text-slate-600">{t.board.imageOptional}</span>
                        </label>

                        {!imagePreview ? (
                            <label
                                className="flex flex-col items-center justify-center gap-2 w-full h-28 rounded-xl cursor-pointer transition-all duration-200 hover:border-cyan-500/50 hover:bg-slate-700/40"
                                style={{ border: "2px dashed rgba(71,85,105,0.6)", background: "rgba(30,41,59,0.4)" }}
                            >
                                <span className="text-2xl">🖼️</span>
                                <span className="text-xs text-slate-400">{t.board.imageHint}</span>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/gif,image/webp"
                                    onChange={handleImageChange}
                                    className="hidden"
                                />
                            </label>
                        ) : (
                            <div className="relative rounded-xl overflow-hidden">
                                <img src={imagePreview} alt="preview" className="w-full max-h-56 object-cover rounded-xl" />
                                <button
                                    type="button"
                                    onClick={handleRemoveImage}
                                    className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white text-xs px-2.5 py-1 rounded-lg transition-colors backdrop-blur-sm"
                                >
                                    {t.board.removeImage}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* 에러 / 성공 */}
                    {error && (
                        <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
                            ⚠️ {error}
                        </div>
                    )}
                    {successMsg && (
                        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 text-sm text-emerald-400">
                            ✅ {successMsg}
                        </div>
                    )}

                    {/* 등록 버튼 */}
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0"
                        style={{
                            background: "linear-gradient(135deg, #06b6d4, #3b82f6)",
                            boxShadow: "0 4px 16px rgba(6,182,212,0.35)",
                        }}
                    >
                        {isSubmitting ? (
                            <>
                                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                {t.board.submitting}
                            </>
                        ) : t.board.submit}
                    </button>
                </form>

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

                    {isFetching && (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
                            <span className="inline-block w-6 h-6 border-2 border-slate-700 border-t-cyan-500 rounded-full animate-spin" />
                            <span className="text-sm">{t.board.loading}</span>
                        </div>
                    )}

                    {!isFetching && posts.length === 0 && (
                        <div
                            className="flex flex-col items-center justify-center py-16 rounded-2xl border text-slate-500 gap-3"
                            style={{ background: "rgba(15,23,42,0.5)", borderColor: "rgba(51,65,85,0.4)" }}
                        >
                            <span className="text-4xl opacity-40">📭</span>
                            <p className="text-sm">{emptyMessage}</p>
                        </div>
                    )}

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
