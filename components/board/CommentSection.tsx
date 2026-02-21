"use client";

/**
 * CommentSection
 *
 * Supabase `comments` 테이블 스키마 (최소):
 *   id          bigint  PK, auto-increment
 *   board_id    text    NOT NULL  -- 'notices' | 'free_board'
 *   post_id     bigint  NOT NULL
 *   author      text    NOT NULL
 *   content     text    NOT NULL
 *   created_at  timestamptz DEFAULT now()
 */

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleContext";

/* ═══════════════════════════════════════
   타입
   ═══════════════════════════════════════ */

interface Comment {
    id: number;
    board_id: string;
    post_id: number;
    author: string;
    content: string;
    created_at: string;
}

interface CommentSectionProps {
    boardId: "notices" | "free_board";
    postId: number;
}

/* ═══════════════════════════════════════
   날짜 포맷
   ═══════════════════════════════════════ */

function formatDate(iso: string) {
    return new Date(iso).toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

/* ═══════════════════════════════════════
   아바타 색상 (닉네임 해시)
   ═══════════════════════════════════════ */

const AVATAR_COLORS = [
    "#06b6d4", "#8b5cf6", "#f59e0b", "#10b981",
    "#ef4444", "#3b82f6", "#ec4899", "#14b8a6",
];

function avatarColor(name: string) {
    let hash = 0;
    for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/* ═══════════════════════════════════════
   CommentSection
   ═══════════════════════════════════════ */

export default function CommentSection({ boardId, postId }: CommentSectionProps) {
    const { t } = useLocale();
    const c = t.comments;

    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);

    const [author, setAuthor] = useState("");
    const [content, setContent] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    /* ── 댓글 로드 ── */
    useEffect(() => {
        setLoading(true);
        supabase
            .from("comments")
            .select("*")
            .eq("board_id", boardId)
            .eq("post_id", postId)
            .order("created_at", { ascending: false })
            .then(({ data, error: err }) => {
                if (!err && data) setComments(data as Comment[]);
                setLoading(false);
            });
    }, [boardId, postId]);

    /* ── 댓글 등록 ── */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!author.trim() || !content.trim()) {
            setError(c.validationError);
            return;
        }

        setSubmitting(true);
        setError(null);
        setSuccess(false);

        const newComment = {
            board_id: boardId,
            post_id: postId,
            author: author.trim(),
            content: content.trim(),
        };

        /* 낙관적 업데이트 — 즉시 UI 반영 */
        const optimistic: Comment = {
            id: Date.now(),
            ...newComment,
            created_at: new Date().toISOString(),
        };
        setComments((prev) => [optimistic, ...prev]);

        const { data, error: insertErr } = await supabase
            .from("comments")
            .insert(newComment)
            .select()
            .single();

        if (insertErr || !data) {
            /* 실패 시 optimistic item 제거 */
            setComments((prev) => prev.filter((c) => c.id !== optimistic.id));
            setError(c.submitError);
            console.error("[CommentSection] 댓글 등록 실패:", insertErr?.message);
        } else {
            /* 실제 DB 데이터로 교체 */
            setComments((prev) =>
                prev.map((cm) => (cm.id === optimistic.id ? (data as Comment) : cm))
            );
            setContent("");
            setSuccess(true);
            setTimeout(() => setSuccess(false), 2500);
        }

        setSubmitting(false);
    };

    /* ── textarea 자동 높이 조절 ── */
    const autoResize = () => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    };

    /* ════════════════════
       RENDER
       ════════════════════ */
    return (
        <section className="mt-6 space-y-4">

            {/* 섹션 헤더 */}
            <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-300">{c.title}</h2>
                <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                        background: "rgba(6,182,212,0.12)",
                        border: "1px solid rgba(6,182,212,0.3)",
                        color: "#67e8f9",
                    }}
                >
                    {loading ? "…" : comments.length}
                </span>
            </div>

            {/* ── 댓글 입력 폼 ── */}
            <form
                onSubmit={handleSubmit}
                className="rounded-2xl p-4 space-y-3"
                style={{
                    background: "rgba(15,23,42,0.75)",
                    border: "1px solid rgba(51,65,85,0.55)",
                    backdropFilter: "blur(10px)",
                }}
            >
                {/* 닉네임 */}
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        {c.authorLabel}
                    </label>
                    <input
                        type="text"
                        value={author}
                        onChange={(e) => setAuthor(e.target.value)}
                        placeholder={c.authorPlaceholder}
                        maxLength={20}
                        className="w-full rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none transition-all"
                        style={{
                            background: "rgba(30,41,59,0.8)",
                            border: "1px solid rgba(71,85,105,0.45)",
                        }}
                        onFocus={(e) =>
                            (e.currentTarget.style.boxShadow = "0 0 0 2px rgba(6,182,212,0.35)")
                        }
                        onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                    />
                </div>

                {/* 내용 */}
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        {c.contentLabel}
                    </label>
                    <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={(e) => { setContent(e.target.value); autoResize(); }}
                        placeholder={c.contentPlaceholder}
                        rows={3}
                        maxLength={500}
                        className="w-full rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none resize-none transition-all"
                        style={{
                            background: "rgba(30,41,59,0.8)",
                            border: "1px solid rgba(71,85,105,0.45)",
                            minHeight: "72px",
                        }}
                        onFocus={(e) =>
                            (e.currentTarget.style.boxShadow = "0 0 0 2px rgba(6,182,212,0.35)")
                        }
                        onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                    />
                    {/* 글자 수 */}
                    <p className="text-right text-[10px] text-slate-700">
                        {content.length} / 500
                    </p>
                </div>

                {/* 에러 */}
                {error && (
                    <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2">
                        ⚠️ {error}
                    </p>
                )}

                {/* 성공 */}
                {success && (
                    <p className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-3 py-2 animate-pulse">
                        ✅ 댓글이 등록됐습니다!
                    </p>
                )}

                {/* 제출 버튼 */}
                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={submitting}
                        className="px-4 py-2 text-xs font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                            background: submitting
                                ? "rgba(6,182,212,0.2)"
                                : "linear-gradient(135deg, rgba(6,182,212,0.8), rgba(59,130,246,0.8))",
                            border: "1px solid rgba(6,182,212,0.4)",
                            color: "#fff",
                            boxShadow: submitting ? "none" : "0 2px 12px rgba(6,182,212,0.3)",
                        }}
                    >
                        {submitting ? c.submitting : c.submit}
                    </button>
                </div>
            </form>

            {/* ── 댓글 목록 ── */}
            {loading ? (
                /* 스켈레톤 */
                <div className="space-y-3">
                    {[1, 2].map((i) => (
                        <div
                            key={i}
                            className="rounded-2xl p-4 animate-pulse"
                            style={{
                                background: "rgba(15,23,42,0.5)",
                                border: "1px solid rgba(51,65,85,0.4)",
                            }}
                        >
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-700/60 flex-shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-3 w-24 rounded bg-slate-700/70" />
                                    <div className="h-3 w-full rounded bg-slate-700/50" />
                                    <div className="h-3 w-4/5 rounded bg-slate-700/40" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : comments.length === 0 ? (
                /* 빈 상태 */
                <div
                    className="rounded-2xl py-10 flex flex-col items-center gap-2 text-center"
                    style={{
                        background: "rgba(15,23,42,0.4)",
                        border: "1px dashed rgba(51,65,85,0.5)",
                    }}
                >
                    <span className="text-3xl">💬</span>
                    <p className="text-sm text-slate-500">{c.empty}</p>
                </div>
            ) : (
                /* 댓글 카드 목록 */
                <div className="space-y-3">
                    {comments.map((cm, idx) => (
                        <div
                            key={cm.id}
                            className="rounded-2xl p-4 group transition-all duration-200 hover:-translate-y-0.5"
                            style={{
                                background: "rgba(15,23,42,0.65)",
                                border: "1px solid rgba(51,65,85,0.45)",
                                backdropFilter: "blur(8px)",
                                boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
                                animationDelay: `${idx * 40}ms`,
                            }}
                        >
                            <div className="flex gap-3">
                                {/* 아바타 */}
                                <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                                    style={{ background: avatarColor(cm.author) }}
                                >
                                    {cm.author[0]?.toUpperCase() ?? "?"}
                                </div>

                                <div className="flex-1 min-w-0">
                                    {/* 헤더: 닉네임 + 날짜 */}
                                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                        <span className="text-xs font-bold text-slate-200">
                                            {cm.author}
                                        </span>
                                        <span className="text-[10px] text-slate-600">
                                            {formatDate(cm.created_at)}
                                        </span>
                                    </div>

                                    {/* 내용 */}
                                    <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
                                        {cm.content}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
