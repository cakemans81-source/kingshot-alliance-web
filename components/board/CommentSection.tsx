"use client";

/**
 * CommentSection — 작성자 식별 시스템 탑재
 *
 * Supabase `comments` 테이블 스키마:
 *   id          bigint   PK auto-increment
 *   board_id    text     NOT NULL  ('notices' | 'free_board')
 *   post_id     bigint   NOT NULL
 *   author      text     NOT NULL
 *   author_icon text     (이모지 아이콘 — nullable)
 *   content     text     NOT NULL
 *   created_at  timestamptz DEFAULT now()
 *
 * localStorage 키:
 *   kdh_nickname  → 저장된 닉네임
 *   kdh_icon      → 저장된 아이콘 이모지
 */

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleContext";

/* ═══════════════════════════════════════
   상수
   ═══════════════════════════════════════ */

const LS_NICK = "kdh_nickname";
const LS_ICON = "kdh_icon";

const ICON_SET = [
    "🦁", "🐯", "🐻", "🦊", "🐺", "🦅", "🦋", "🐲",
    "⚔️", "🛡️", "👑", "🏆", "💎", "🔥", "⚡", "🌟",
    "🎯", "🎮", "🚀", "💫", "🌙", "🌊", "🌹", "🍀",
];

const AVATAR_COLORS = [
    "#06b6d4", "#8b5cf6", "#f59e0b", "#10b981",
    "#ef4444", "#3b82f6", "#ec4899", "#14b8a6",
    "#f97316", "#6366f1",
];

/* ═══════════════════════════════════════
   타입
   ═══════════════════════════════════════ */

interface Comment {
    id: number;
    board_id: string;
    post_id: number;
    author: string;
    author_icon: string | null;
    content: string;
    created_at: string;
}

interface CommentSectionProps {
    boardId: "notices" | "free_board";
    postId: number;
}

/* ═══════════════════════════════════════
   유틸
   ═══════════════════════════════════════ */

function avatarColor(name: string): string {
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function relativeTime(iso: string): string {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return "방금 전";
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
    return new Date(iso).toLocaleDateString("ko-KR", {
        month: "2-digit", day: "2-digit",
    });
}

function lsGet(key: string): string {
    try { return localStorage.getItem(key) ?? ""; } catch { return ""; }
}
function lsSet(key: string, val: string) {
    try { localStorage.setItem(key, val); } catch { /* noop */ }
}

/* ═══════════════════════════════════════
   아바타 컴포넌트
   ═══════════════════════════════════════ */

function Avatar({ name, icon, size = 32 }: { name: string; icon?: string | null; size?: number }) {
    const color = avatarColor(name);
    return (
        <div
            className="rounded-full flex items-center justify-center flex-shrink-0 font-bold select-none"
            style={{
                width: size,
                height: size,
                background: icon ? "rgba(30,41,59,0.9)" : color,
                border: `1.5px solid ${color}40`,
                fontSize: icon ? size * 0.55 : size * 0.38,
                color: "#fff",
                boxShadow: `0 0 0 2px ${color}22`,
            }}
        >
            {icon || name[0]?.toUpperCase() || "?"}
        </div>
    );
}

/* ═══════════════════════════════════════
   아이콘 피커 컴포넌트
   ═══════════════════════════════════════ */

function IconPicker({
    selected,
    onSelect,
    onClose,
}: {
    selected: string;
    onSelect: (icon: string) => void;
    onClose: () => void;
}) {
    return (
        <div
            className="absolute z-50 top-full left-0 mt-1 rounded-2xl p-3 shadow-2xl"
            style={{
                background: "rgba(15,23,42,0.98)",
                border: "1px solid rgba(51,65,85,0.7)",
                backdropFilter: "blur(16px)",
                width: 232,
            }}
        >
            <p className="text-[10px] text-slate-500 mb-2 font-semibold uppercase tracking-wider px-1">
                아이콘 선택
            </p>
            <div className="grid grid-cols-8 gap-1">
                {/* 기본(이니셜) 선택 */}
                <button
                    onClick={() => { onSelect(""); onClose(); }}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-bold transition-all hover:scale-110"
                    style={{
                        background: !selected ? "rgba(6,182,212,0.3)" : "rgba(51,65,85,0.4)",
                        color: "#94a3b8",
                        border: !selected ? "1px solid rgba(6,182,212,0.5)" : "1px solid transparent",
                    }}
                    title="이니셜 아바타"
                >
                    Aa
                </button>
                {ICON_SET.map((ic) => (
                    <button
                        key={ic}
                        onClick={() => { onSelect(ic); onClose(); }}
                        className="h-7 w-7 rounded-lg flex items-center justify-center text-base transition-all hover:scale-125"
                        style={{
                            background: selected === ic ? "rgba(6,182,212,0.25)" : "rgba(51,65,85,0.3)",
                            border: selected === ic ? "1px solid rgba(6,182,212,0.5)" : "1px solid transparent",
                        }}
                    >
                        {ic}
                    </button>
                ))}
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════
   CommentSection
   ═══════════════════════════════════════ */

export default function CommentSection({ boardId, postId }: CommentSectionProps) {
    const { t } = useLocale();
    const c = t.comments;

    /* ── 댓글 목록 ── */
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);

    /* ── 폼 상태 ── */
    const [author, setAuthor] = useState("");
    const [selectedIcon, setSelectedIcon] = useState("");
    const [content, setContent] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState(false);

    /* ── UI 상태 ── */
    const [showIconPicker, setShowIconPicker] = useState(false);
    const [myNickname, setMyNickname] = useState("");   // localStorage 저장값
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const pickerRef = useRef<HTMLDivElement>(null);

    /* ── localStorage 초기화 ── */
    useEffect(() => {
        const nick = lsGet(LS_NICK);
        const icon = lsGet(LS_ICON);
        if (nick) { setAuthor(nick); setMyNickname(nick); }
        if (icon) setSelectedIcon(icon);
    }, []);

    /* ── 피커 외부 클릭 닫기 ── */
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
                setShowIconPicker(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    /* ── 댓글 로드 ── */
    useEffect(() => {
        setLoading(true);
        supabase
            .from("comments")
            .select("*")
            .eq("board_id", boardId)
            .eq("post_id", postId)
            .order("created_at", { ascending: false })
            .then(({ data, error }) => {
                if (!error && data) setComments(data as Comment[]);
                setLoading(false);
            });
    }, [boardId, postId]);

    /* ── 댓글 등록 ── */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!author.trim() || !content.trim()) {
            setFormError(c.validationError);
            return;
        }

        setSubmitting(true);
        setFormError(null);
        setSuccessMsg(false);

        /* localStorage 저장 */
        lsSet(LS_NICK, author.trim());
        lsSet(LS_ICON, selectedIcon);
        setMyNickname(author.trim());

        /* ⚠️ post_id를 반드시 Number()로 정수 변환 — Supabase BIGINT 타입 일치 */
        const numericPostId = Number(postId);

        /* 🚫 NaN/0 가드: postId가 유효하지 않으면 즉시 차단 */
        if (!numericPostId || isNaN(numericPostId)) {
            setFormError("게시글 ID를 읽을 수 없습니다. 페이지를 새로고침 해주세요.");
            setSubmitting(false);
            console.error("[CommentSection] postId 변환 실패:", postId, "→", numericPostId);
            return;
        }

        const fullPayload = {
            board_id: boardId,
            post_id: numericPostId,
            author: author.trim(),
            author_icon: selectedIcon || null,
            content: content.trim(),
        };

        console.log("[CommentSection] insert payload:", fullPayload);

        /* 낙관적 업데이트 */
        const temp: Comment = {
            id: Date.now(),
            ...fullPayload,
            created_at: new Date().toISOString(),
        };
        setComments((prev) => [temp, ...prev]);

        let data: Comment | null = null;
        let err: { message?: string; details?: string; hint?: string; code?: string } | null = null;

        /* 1차: 전체 페이로드 */
        const res1 = await supabase.from("comments").insert(fullPayload).select().single();
        if (res1.error) {
            console.warn("[CommentSection] 1차 insert 실패 (에러:", res1.error.message, ")— author_icon 없이 재시도");
            /* 2차 시도: author_icon 제외 */
            const minPayload = {
                board_id: boardId,
                post_id: numericPostId,
                author: author.trim(),
                content: content.trim(),
            };
            const res2 = await supabase.from("comments").insert(minPayload).select().single();
            if (res2.error) {
                err = res2.error;
            } else {
                data = res2.data as Comment;
            }
        } else {
            data = res1.data as Comment;
        }

        if (err || !data) {
            setComments((prev) => prev.filter((cm) => cm.id !== temp.id));
            setFormError(c.submitError);
            console.error("[CommentSection] 등록 실패 — Supabase error:", {
                message: err?.message,
                details: err?.details,
                hint: err?.hint,
                code: err?.code,
            });
        } else {
            setComments((prev) =>
                prev.map((cm) => (cm.id === temp.id ? (data as Comment) : cm))
            );
            setContent("");
            setSuccessMsg(true);
            setTimeout(() => setSuccessMsg(false), 2500);
            if (textareaRef.current) {
                textareaRef.current.style.height = "auto";
            }
        }
        setSubmitting(false);
    };


    /* ── 댓글 삭제 ── */
    const handleDelete = async (id: number) => {
        if (!confirm(c.deleteConfirm)) return;
        setDeletingId(id);

        const { error } = await supabase.from("comments").delete().eq("id", id);
        if (!error) {
            setComments((prev) => prev.filter((cm) => cm.id !== id));
        } else {
            console.error("[CommentSection] 삭제 실패:", error.message);
        }
        setDeletingId(null);
    };

    /* ── textarea 자동 높이 ── */
    const autoResize = () => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    };

    /* ════════════════════════════════════
       RENDER
       ════════════════════════════════════ */
    return (
        <section className="mt-6 space-y-4">

            {/* ── 섹션 헤더 ── */}
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

            {/* ══════════════════════════════
                댓글 입력 폼
                ══════════════════════════════ */}
            <form
                onSubmit={handleSubmit}
                className="rounded-2xl p-4 space-y-3"
                style={{
                    background: "rgba(15,23,42,0.78)",
                    border: "1px solid rgba(51,65,85,0.55)",
                    backdropFilter: "blur(12px)",
                }}
            >
                {/* 닉네임 행 — 아이콘 피커 + 입력 */}
                <div className="flex items-center gap-2">
                    {/* 아이콘 선택 버튼 */}
                    <div className="relative flex-shrink-0" ref={pickerRef}>
                        <button
                            type="button"
                            onClick={() => setShowIconPicker((v) => !v)}
                            className="transition-transform hover:scale-110 active:scale-95"
                            title="아이콘 선택"
                        >
                            <Avatar name={author || "?"} icon={selectedIcon} size={36} />
                        </button>
                        {showIconPicker && (
                            <IconPicker
                                selected={selectedIcon}
                                onSelect={setSelectedIcon}
                                onClose={() => setShowIconPicker(false)}
                            />
                        )}
                    </div>

                    {/* 닉네임 입력 */}
                    <div className="flex-1 flex flex-col gap-0.5">
                        <label className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider">
                            {c.authorLabel}
                        </label>
                        <input
                            type="text"
                            value={author}
                            onChange={(e) => setAuthor(e.target.value)}
                            placeholder={c.authorPlaceholder}
                            maxLength={20}
                            className="w-full rounded-xl px-3 py-1.5 text-sm text-white placeholder:text-slate-700 outline-none transition-all"
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
                </div>

                {/* 아이콘 힌트 */}
                <p className="text-[9px] text-slate-700 -mt-1 pl-11">
                    👆 아이콘을 클릭해서 프로필을 커스텀하세요
                </p>

                {/* 댓글 내용 */}
                <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider">
                        {c.contentLabel}
                    </label>
                    <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={(e) => { setContent(e.target.value); autoResize(); }}
                        placeholder={c.contentPlaceholder}
                        maxLength={500}
                        rows={3}
                        className="w-full rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-700 outline-none resize-none transition-all"
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
                    <p className="text-right text-[9px] text-slate-700">{content.length} / 500</p>
                </div>

                {/* 에러 메시지 */}
                {formError && (
                    <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2">
                        ⚠️ {formError}
                    </p>
                )}

                {/* 성공 메시지 */}
                {successMsg && (
                    <p className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-3 py-2 animate-pulse">
                        ✅ 댓글이 등록됐습니다!
                    </p>
                )}

                {/* 제출 버튼 */}
                <div className="flex items-center justify-between">
                    {myNickname && (
                        <p className="text-[10px] text-slate-600">
                            <span className="text-cyan-600">✓</span> 닉네임 저장됨:{" "}
                            <strong className="text-slate-500">{myNickname}</strong>
                        </p>
                    )}
                    <button
                        type="submit"
                        disabled={submitting}
                        className="ml-auto px-5 py-2 text-xs font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                            background: submitting
                                ? "rgba(6,182,212,0.2)"
                                : "linear-gradient(135deg, rgba(6,182,212,0.85), rgba(59,130,246,0.85))",
                            border: "1px solid rgba(6,182,212,0.4)",
                            color: "#fff",
                            boxShadow: submitting ? "none" : "0 2px 14px rgba(6,182,212,0.35)",
                        }}
                    >
                        {submitting ? c.submitting : c.submit}
                    </button>
                </div>
            </form>

            {/* ══════════════════════════════
                댓글 목록
                ══════════════════════════════ */}
            {loading ? (
                /* 스켈레톤 */
                <div className="space-y-3">
                    {[0, 1].map((i) => (
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
                /* 비어있음 */
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
                /* 댓글 카드 */
                <div className="space-y-2.5">
                    {comments.map((cm, idx) => {
                        const isMe = myNickname && cm.author === myNickname;
                        const isDeleting = deletingId === cm.id;
                        return (
                            <div
                                key={cm.id}
                                className="rounded-2xl p-4 group transition-all duration-200 hover:-translate-y-0.5"
                                style={{
                                    background: isMe
                                        ? "rgba(6,182,212,0.05)"
                                        : "rgba(15,23,42,0.65)",
                                    border: isMe
                                        ? "1px solid rgba(6,182,212,0.22)"
                                        : "1px solid rgba(51,65,85,0.45)",
                                    backdropFilter: "blur(8px)",
                                    boxShadow: "0 2px 12px rgba(0,0,0,0.22)",
                                    animationDelay: `${idx * 40}ms`,
                                    opacity: isDeleting ? 0.4 : 1,
                                    transition: "opacity 0.2s, transform 0.2s",
                                }}
                            >
                                <div className="flex gap-3">
                                    {/* 아바타 */}
                                    <Avatar name={cm.author} icon={cm.author_icon} size={34} />

                                    <div className="flex-1 min-w-0">
                                        {/* 헤더 행 */}
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <span className="text-xs font-bold text-slate-200 flex items-center gap-1">
                                                {cm.author}
                                                {/* 내 댓글 뱃지 */}
                                                {isMe && (
                                                    <span
                                                        className="text-[8px] font-bold px-1.5 py-0.5 rounded-full"
                                                        style={{
                                                            background: "rgba(6,182,212,0.2)",
                                                            color: "#22d3ee",
                                                            border: "1px solid rgba(6,182,212,0.35)",
                                                        }}
                                                    >
                                                        나
                                                    </span>
                                                )}
                                            </span>
                                            {/* 상대적 시간 */}
                                            <span className="text-[10px] text-slate-600">
                                                {relativeTime(cm.created_at)}
                                            </span>
                                        </div>

                                        {/* 내용 */}
                                        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
                                            {cm.content}
                                        </p>
                                    </div>

                                    {/* 삭제 버튼 (본인만) */}
                                    {isMe && (
                                        <button
                                            onClick={() => handleDelete(cm.id)}
                                            disabled={isDeleting}
                                            className="flex-shrink-0 self-start opacity-0 group-hover:opacity-100 transition-all duration-200 p-1.5 rounded-lg hover:bg-red-500/20 disabled:cursor-wait"
                                            title="삭제"
                                            style={{ color: "#f87171" }}
                                        >
                                            <svg
                                                className="w-3.5 h-3.5"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                strokeWidth={2.5}
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
