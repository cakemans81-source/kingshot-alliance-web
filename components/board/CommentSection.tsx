"use client";

/**
 * CommentSection — 이모지 피커 + 댓글 수정/삭제 탑재
 */

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleContext";
import type { LocaleCode } from "@/lib/i18n/LocaleContext";
import { useAuth } from "@/lib/auth/AuthContext";

/* ═══ 번역 헬퍼 ═══ */
function cmCacheKey(locale: string, commentId: number): string { return `cm_tx_${locale}_${commentId}`; }
function cmReadCache(key: string): string | null { try { return sessionStorage.getItem(key); } catch { return null; } }
function cmWriteCache(key: string, val: string) { try { sessionStorage.setItem(key, val); } catch { /* ignore */ } }

function guessLang(text: string): string {
    const total = text.length || 1;
    if ((text.match(/[\uAC00-\uD7A3]/g) || []).length / total > 0.15) return "ko";
    if ((text.match(/[\u4E00-\u9FFF]/g) || []).length / total > 0.1) return "zh";
    if ((text.match(/[a-zA-Z]/g) || []).length / total > 0.3) return "en";
    return "auto";
}

async function translateComment(text: string, targetLang: LocaleCode): Promise<string> {
    if (!text.trim()) return text;
    const sourceLang = guessLang(text);
    if (sourceLang !== "auto" && sourceLang === targetLang) return text;
    const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, targetLang, sourceLang }),
    });
    if (!res.ok) throw new Error(`translate ${res.status}`);
    const data = await res.json();
    return (data.translatedText as string) ?? text;
}

/* ═══ 상수 ═══ */
const LS_NICK = "kdh_nickname";
const LS_ICON = "kdh_icon";

const ICON_SET = [
    "🦁", "🐯", "🐻", "🦊", "🐺", "🦅", "🦋", "🐲",
    "⚔️", "🛡️", "👑", "🏆", "💎", "🔥", "⚡", "🌟",
    "🎯", "🎮", "🚀", "💫", "🌙", "🌊", "🌹", "🍀",
];

/* 댓글 본문 삽입용 이모지 세트 */
const EMOJI_SET = [
    "😀", "😂", "🥹", "😍", "🤔", "😎", "🥳", "😭",
    "👍", "👏", "🙌", "🤝", "💪", "✌️", "🫡", "🫶",
    "🔥", "💯", "⚡", "✅", "❌", "❤️", "💙", "🎉",
    "🏆", "⚔️", "🛡️", "🎯", "🚀", "💎", "👑", "🌟",
];

const AVATAR_COLORS = [
    "#06b6d4", "#8b5cf6", "#f59e0b", "#10b981",
    "#ef4444", "#3b82f6", "#ec4899", "#14b8a6",
    "#f97316", "#6366f1",
];

/* ═══ 타입 ═══ */
interface Comment {
    id: number;
    board_id: string;
    post_id: number | string;
    author: string;
    author_icon: string | null;
    content: string;
    created_at: string;
}

interface CommentSectionProps {
    boardId: "notices" | "free_board";
    postId: number | string;
}

/* ═══ 유틸 ═══ */
function avatarColor(name: string): string {
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function relativeTime(iso: string, c: { justNow: string; minutesAgo: string; hoursAgo: string; daysAgo: string }): string {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return c.justNow;
    if (diff < 3600) return `${Math.floor(diff / 60)}${c.minutesAgo}`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}${c.hoursAgo}`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}${c.daysAgo}`;
    return new Date(iso).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
}

function lsGet(key: string): string { try { return localStorage.getItem(key) ?? ""; } catch { return ""; } }
function lsSet(key: string, val: string) { try { localStorage.setItem(key, val); } catch { /* noop */ } }

/* ═══ Avatar ═══ */
function Avatar({ name, icon, size = 32 }: { name: string; icon?: string | null; size?: number }) {
    const color = avatarColor(name);
    return (
        <div
            className="rounded-full flex items-center justify-center flex-shrink-0 font-bold select-none transition-all"
            style={{
                width: size, height: size,
                background: icon ? "rgba(30,41,59,0.95)" : color,
                border: icon ? `1.5px solid ${color}88` : `1.5px solid ${color}40`,
                fontSize: icon ? size * 0.6 : size * 0.38,
                color: "#fff",
                boxShadow: icon ? `0 0 15px ${color}33` : `0 0 0 2px ${color}22`,
            }}
        >
            {icon || name[0]?.toUpperCase() || "?"}
        </div>
    );
}

/* ═══ 아이콘 피커 (아바타용) ═══ */
function IconPicker({ selected, onSelect, onClose }: { selected: string; onSelect: (icon: string) => void; onClose: () => void; }) {
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
            <p className="text-[10px] text-slate-500 mb-2 font-semibold uppercase tracking-wider px-1">아이콘 선택</p>
            <div className="grid grid-cols-8 gap-1">
                <button
                    onClick={() => { onSelect(""); onClose(); }}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-bold transition-all hover:scale-110"
                    style={{
                        background: !selected ? "rgba(6,182,212,0.3)" : "rgba(51,65,85,0.4)",
                        color: "#94a3b8",
                        border: !selected ? "1px solid rgba(6,182,212,0.5)" : "1px solid transparent",
                    }}
                    title="이니셜 아바타"
                >Aa</button>
                {ICON_SET.map((ic) => (
                    <button
                        key={ic}
                        onClick={() => { onSelect(ic); onClose(); }}
                        className="h-7 w-7 rounded-lg flex items-center justify-center text-base transition-all hover:scale-125"
                        style={{
                            background: selected === ic ? "rgba(6,182,212,0.25)" : "rgba(51,65,85,0.3)",
                            border: selected === ic ? "1px solid rgba(6,182,212,0.5)" : "1px solid transparent",
                        }}
                    >{ic}</button>
                ))}
            </div>
        </div>
    );
}

/* ═══ 이모지 피커 (댓글 본문 삽입용) ═══ */
function EmojiPicker({ onSelect, onClose }: { onSelect: (emoji: string) => void; onClose: () => void; }) {
    return (
        <div
            className="absolute z-50 bottom-full mb-1 left-0 rounded-2xl p-3 shadow-2xl"
            style={{
                background: "rgba(15,23,42,0.98)",
                border: "1px solid rgba(51,65,85,0.7)",
                backdropFilter: "blur(16px)",
                width: 248,
            }}
        >
            <p className="text-[10px] text-slate-500 mb-2 font-semibold uppercase tracking-wider px-1">이모지 삽입</p>
            <div className="grid grid-cols-8 gap-1">
                {EMOJI_SET.map((em) => (
                    <button
                        key={em}
                        type="button"
                        onClick={() => { onSelect(em); onClose(); }}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-lg transition-all hover:scale-125 hover:bg-slate-700/50"
                    >{em}</button>
                ))}
            </div>
        </div>
    );
}

/* ═══ 삭제 확인 모달 ═══ */
function DeleteModal({ onConfirm, onCancel, loading }: { onConfirm: () => void; onCancel: () => void; loading: boolean; }) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
            onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
        >
            <div
                className="w-full max-w-xs rounded-2xl p-6 space-y-4"
                style={{
                    background: "rgba(15,23,42,0.97)",
                    border: "1px solid rgba(239,68,68,0.35)",
                    boxShadow: "0 8px 40px rgba(239,68,68,0.12)",
                }}
            >
                <div className="flex items-center gap-2">
                    <span className="text-xl">🗑️</span>
                    <h2 className="text-base font-bold text-red-400">댓글 삭제</h2>
                </div>
                <p className="text-sm text-slate-400">정말 이 댓글을 삭제하시겠습니까?</p>
                <div className="flex gap-2 pt-1">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:text-white transition-colors"
                        style={{ background: "rgba(51,65,85,0.5)", border: "1px solid rgba(71,85,105,0.5)" }}
                    >취소</button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className="flex-1 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
                        style={{ background: "rgba(239,68,68,0.85)", border: "1px solid rgba(239,68,68,0.5)" }}
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-1.5">
                                <span className="inline-block w-3.5 h-3.5 border border-white/40 border-t-white rounded-full animate-spin" />
                                삭제 중…
                            </span>
                        ) : "🗑️ 삭제"}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════
   CommentSection
   ═══════════════════════════════════════ */

export default function CommentSection({ boardId, postId }: CommentSectionProps) {
    const { t, locale } = useLocale();
    const { user } = useAuth();
    const c = t.comments;
    const b = t.board;

    const params = useParams();
    const resolvedPostId: number | string = (() => {
        if (postId && postId !== 0) {
            const asNum = Number(postId);
            if (!isNaN(asNum) && asNum > 0) return asNum;
            if (typeof postId === "string" && postId.length > 0) return postId;
        }
        const urlId = params?.id;
        if (urlId) {
            const asNum = Number(urlId);
            if (!isNaN(asNum) && asNum > 0) return asNum;
            if (typeof urlId === "string" && urlId.length > 0) return urlId;
        }
        return 0;
    })();

    /* 댓글 목록 */
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);

    /* 번역 */
    const [translatedContents, setTranslatedContents] = useState<Record<number, string>>({});
    const [translatingComments, setTranslatingComments] = useState(false);
    const [showTranslated, setShowTranslated] = useState(true);

    /* 입력 폼 */
    const [author, setAuthor] = useState("");
    const [selectedIcon, setSelectedIcon] = useState("");
    const [content, setContent] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState(false);

    /* UI */
    const [showIconPicker, setShowIconPicker] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [myNickname, setMyNickname] = useState("");
    const [deletingId, setDeletingId] = useState<number | null>(null);  // 삭제 진행 중 ID
    const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null); // 삭제 확인 모달

    /* 수정 상태 */
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editContent, setEditContent] = useState("");
    const [savingEdit, setSavingEdit] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const pickerRef = useRef<HTMLDivElement>(null);
    const emojiPickerRef = useRef<HTMLDivElement>(null);
    const editRef = useRef<HTMLTextAreaElement>(null);

    /* localStorage 초기화 */
    useEffect(() => {
        const nick = lsGet(LS_NICK);
        const icon = lsGet(LS_ICON);
        if (nick) { setAuthor(nick); setMyNickname(nick); }
        if (icon) setSelectedIcon(icon);
    }, []);

    /* 외부 클릭 닫기 (아이콘/이모지 피커) */
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowIconPicker(false);
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) setShowEmojiPicker(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    /* 댓글 로드 */
    useEffect(() => {
        if (!resolvedPostId) return;
        setLoading(true);
        supabase
            .from("comments")
            .select("*")
            .eq("board_id", boardId)
            .eq("post_id", resolvedPostId)
            .order("created_at", { ascending: true })
            .then(({ data, error }) => {
                if (!error && data) setComments(data as Comment[]);
                setLoading(false);
            });
    }, [boardId, resolvedPostId]);

    /* 댓글 번역 */
    useEffect(() => {
        if (locale === "ko" || comments.length === 0) { setTranslatedContents({}); return; }
        let cancelled = false;
        const run = async () => {
            setTranslatingComments(true);
            const result: Record<number, string> = {};
            await Promise.all(
                comments.map(async (cm) => {
                    const cacheKey = cmCacheKey(locale, cm.id);
                    const cached = cmReadCache(cacheKey);
                    if (cached) { result[cm.id] = cached; return; }
                    try {
                        const translated = await translateComment(cm.content, locale as LocaleCode);
                        result[cm.id] = translated;
                        cmWriteCache(cacheKey, translated);
                    } catch {
                        result[cm.id] = cm.content;
                    }
                })
            );
            if (!cancelled) { setTranslatedContents(result); setTranslatingComments(false); }
        };
        run();
        return () => { cancelled = true; };
    }, [comments, locale]);

    /* ── 이모지 → textarea 커서 위치 삽입 ── */
    const insertEmoji = (emoji: string) => {
        const el = textareaRef.current;
        if (!el) { setContent((prev) => prev + emoji); return; }
        const start = el.selectionStart ?? content.length;
        const end = el.selectionEnd ?? content.length;
        const next = content.slice(0, start) + emoji + content.slice(end);
        setContent(next);
        // 커서를 이모지 뒤로 이동
        setTimeout(() => {
            el.focus();
            el.setSelectionRange(start + emoji.length, start + emoji.length);
        }, 0);
    };

    /* ── 댓글 등록 ── */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!author.trim() || !content.trim()) { setFormError(c.validationError); return; }
        setSubmitting(true);
        setFormError(null);
        setSuccessMsg(false);
        lsSet(LS_NICK, author.trim());
        lsSet(LS_ICON, selectedIcon);
        setMyNickname(author.trim());

        const isInvalidId = !resolvedPostId || resolvedPostId === 0 || resolvedPostId === "";
        if (isInvalidId) { setFormError(c.refreshError); setSubmitting(false); return; }

        const fullPayload = { board_id: boardId, post_id: resolvedPostId, author: author.trim(), author_icon: selectedIcon || null, content: content.trim() };
        const temp: Comment = { id: Date.now(), ...fullPayload, created_at: new Date().toISOString() };
        setComments((prev) => [...prev, temp]);

        let data: Comment | null = null;
        let err: { message?: string } | null = null;

        const res1 = await supabase.from("comments").insert(fullPayload).select().single();
        if (res1.error) {
            const minPayload = { board_id: boardId, post_id: resolvedPostId, author: author.trim(), content: content.trim() };
            const res2 = await supabase.from("comments").insert(minPayload).select().single();
            if (res2.error) err = res2.error; else data = res2.data as Comment;
        } else {
            data = res1.data as Comment;
        }

        if (err || !data) {
            setComments((prev) => prev.filter((cm) => cm.id !== temp.id));
            setFormError(c.submitError);
        } else {
            setComments((prev) => prev.map((cm) => (cm.id === temp.id ? (data as Comment) : cm)));
            setContent("");
            setSuccessMsg(true);
            setTimeout(() => setSuccessMsg(false), 2500);
            if (textareaRef.current) textareaRef.current.style.height = "auto";
        }
        setSubmitting(false);
    };

    /* ── 댓글 삭제 ── */
    const handleDelete = async (id: number) => {
        setDeletingId(id);
        const { error } = await supabase.from("comments").delete().eq("id", id);
        if (!error) setComments((prev) => prev.filter((cm) => cm.id !== id));
        setDeletingId(null);
        setDeleteTargetId(null);
    };

    /* ── 댓글 수정 저장 ── */
    const handleSaveEdit = async (id: number) => {
        if (!editContent.trim()) return;
        setSavingEdit(true);
        const { error } = await supabase.from("comments").update({ content: editContent.trim() }).eq("id", id);
        if (!error) {
            setComments((prev) => prev.map((cm) => cm.id === id ? { ...cm, content: editContent.trim() } : cm));
            // 번역 캐시 무효화
            try { sessionStorage.removeItem(cmCacheKey(locale, id)); } catch { /* ignore */ }
            setTranslatedContents((prev) => { const n = { ...prev }; delete n[id]; return n; });
        }
        setSavingEdit(false);
        setEditingId(null);
        setEditContent("");
    };

    /* 자동 높이 (입력폼) */
    const autoResize = () => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    };

    /* ════════ RENDER ════════ */
    return (
        <section className="mt-6 space-y-4">

            {/* 삭제 확인 모달 */}
            {deleteTargetId !== null && (
                <DeleteModal
                    loading={deletingId === deleteTargetId}
                    onConfirm={() => handleDelete(deleteTargetId)}
                    onCancel={() => setDeleteTargetId(null)}
                />
            )}

            {/* 섹션 헤더 */}
            <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-slate-300">{c.title}</h2>
                <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(6,182,212,0.12)", border: "1px solid rgba(6,182,212,0.3)", color: "#67e8f9" }}
                >
                    {loading ? "…" : comments.length}
                </span>

                {locale !== "ko" && (
                    <div className="ml-auto flex items-center gap-2">
                        {translatingComments ? (
                            <span className="flex items-center gap-1 text-[10px] text-slate-500">
                                <span className="inline-block w-3 h-3 border border-slate-600 border-t-cyan-400 rounded-full animate-spin" />
                                {b.translating}
                            </span>
                        ) : Object.keys(translatedContents).length > 0 ? (
                            <button
                                type="button"
                                onClick={() => setShowTranslated((v) => !v)}
                                className="text-[10px] font-semibold px-2.5 py-1 rounded-xl transition-all duration-200"
                                style={{
                                    background: showTranslated ? "rgba(6,182,212,0.18)" : "rgba(51,65,85,0.4)",
                                    border: showTranslated ? "1px solid rgba(6,182,212,0.4)" : "1px solid rgba(71,85,105,0.4)",
                                    color: showTranslated ? "#22d3ee" : "#64748b",
                                }}
                            >
                                {showTranslated ? `🌐 ${b.translatedLabel}` : b.originalLabel}
                            </button>
                        ) : null}
                    </div>
                )}
            </div>

            {/* ══ 댓글 입력 폼 ══ */}
            {boardId === "notices" && (user?.role !== "admin" && user?.role !== "staff") ? (
                <div
                    className="rounded-2xl p-6 text-center"
                    style={{ background: "rgba(15,23,42,0.45)", border: "1px dashed rgba(51,65,85,0.5)" }}
                >
                    <p className="text-sm text-slate-500">📢 공지사항에는 간부 이상만 댓글을 작성할 수 있습니다.</p>
                </div>
            ) : (
                <form
                    onSubmit={handleSubmit}
                    className="rounded-2xl p-4 space-y-3"
                    style={{ background: "rgba(15,23,42,0.78)", border: "1px solid rgba(51,65,85,0.55)", backdropFilter: "blur(12px)" }}
                >
                    {/* 닉네임 + 아이콘 */}
                    <div className="flex items-center gap-2">
                        <div className="relative flex-shrink-0" ref={pickerRef}>
                            <button
                                type="button"
                                onClick={() => setShowIconPicker((v) => !v)}
                                className="transition-transform hover:scale-110 active:scale-95"
                                title={c.iconPickerTitle}
                            >
                                <Avatar name={author || "?"} icon={selectedIcon} size={36} />
                            </button>
                            {showIconPicker && (
                                <IconPicker selected={selectedIcon} onSelect={setSelectedIcon} onClose={() => setShowIconPicker(false)} />
                            )}
                        </div>
                        <div className="flex-1 flex flex-col gap-0.5">
                            <label className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider">{c.authorLabel}</label>
                            <input
                                type="text"
                                value={author}
                                onChange={(e) => setAuthor(e.target.value)}
                                placeholder={c.authorPlaceholder}
                                maxLength={20}
                                className="w-full rounded-xl px-3 py-1.5 text-sm text-white placeholder:text-slate-700 outline-none transition-all"
                                style={{ background: "rgba(30,41,59,0.8)", border: "1px solid rgba(71,85,105,0.45)" }}
                                onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px rgba(6,182,212,0.35)")}
                                onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                            />
                        </div>
                    </div>

                    <p className="text-[9px] text-slate-700 -mt-1 pl-11">{c.iconHint}</p>

                    {/* 댓글 내용 + 이모지 버튼 */}
                    <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider">{c.contentLabel}</label>
                        <textarea
                            ref={textareaRef}
                            value={content}
                            onChange={(e) => { setContent(e.target.value); autoResize(); }}
                            placeholder={c.contentPlaceholder}
                            maxLength={500}
                            rows={3}
                            className="w-full rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-700 outline-none resize-none transition-all"
                            style={{ background: "rgba(30,41,59,0.8)", border: "1px solid rgba(71,85,105,0.45)", minHeight: "72px" }}
                            onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px rgba(6,182,212,0.35)")}
                            onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                        />
                        <div className="flex items-center justify-between">
                            {/* 이모지 버튼 */}
                            <div className="relative" ref={emojiPickerRef}>
                                <button
                                    type="button"
                                    onClick={() => setShowEmojiPicker((v) => !v)}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all hover:scale-105 active:scale-95"
                                    style={{
                                        background: showEmojiPicker ? "rgba(6,182,212,0.2)" : "rgba(30,41,59,0.8)",
                                        border: showEmojiPicker ? "1px solid rgba(6,182,212,0.45)" : "1px solid rgba(71,85,105,0.4)",
                                        color: showEmojiPicker ? "#22d3ee" : "#64748b",
                                    }}
                                    title="이모지 삽입"
                                >
                                    😊 <span>이모지</span>
                                </button>
                                {showEmojiPicker && (
                                    <EmojiPicker
                                        onSelect={insertEmoji}
                                        onClose={() => setShowEmojiPicker(false)}
                                    />
                                )}
                            </div>
                            <p className="text-right text-[9px] text-slate-700">{content.length} / 500</p>
                        </div>
                    </div>

                    {formError && (
                        <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2">⚠️ {formError}</p>
                    )}
                    {successMsg && (
                        <p className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-3 py-2 animate-pulse">
                            {c.successMsg}
                        </p>
                    )}

                    <div className="flex items-center justify-between">
                        {myNickname && (
                            <p className="text-[10px] text-slate-600">
                                <span className="text-cyan-600">✓</span> {c.nickSaved}{" "}
                                <strong className="text-slate-500">{myNickname}</strong>
                            </p>
                        )}
                        <button
                            type="submit"
                            disabled={submitting}
                            className="ml-auto px-5 py-2 text-xs font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                                background: submitting ? "rgba(6,182,212,0.2)" : "linear-gradient(135deg, rgba(6,182,212,0.85), rgba(59,130,246,0.85))",
                                border: "1px solid rgba(6,182,212,0.4)",
                                color: "#fff",
                                boxShadow: submitting ? "none" : "0 2px 14px rgba(6,182,212,0.35)",
                            }}
                        >
                            {submitting ? c.submitting : c.submit}
                        </button>
                    </div>
                </form>
            )}

            {/* ══ 댓글 목록 ══ */}
            {loading ? (
                <div className="space-y-3">
                    {[0, 1].map((i) => (
                        <div key={i} className="rounded-2xl p-4 animate-pulse" style={{ background: "rgba(15,23,42,0.5)", border: "1px solid rgba(51,65,85,0.4)" }}>
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-700/60 flex-shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-3 w-24 rounded bg-slate-700/70" />
                                    <div className="h-3 w-full rounded bg-slate-700/50" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : comments.length === 0 ? (
                <div
                    className="rounded-2xl py-10 flex flex-col items-center gap-2 text-center"
                    style={{ background: "rgba(15,23,42,0.4)", border: "1px dashed rgba(51,65,85,0.5)" }}
                >
                    <span className="text-3xl">💬</span>
                    <p className="text-sm text-slate-500">{c.empty}</p>
                </div>
            ) : (
                <div className="space-y-2.5">
                    {comments.map((cm, idx) => {
                        const isMe = !!(myNickname && cm.author === myNickname);
                        const isDeleting = deletingId === cm.id;
                        const isEditing = editingId === cm.id;

                        return (
                            <div
                                key={cm.id}
                                className="rounded-2xl p-4 group transition-all duration-200 hover:-translate-y-0.5"
                                style={{
                                    background: isMe ? "rgba(6,182,212,0.05)" : "rgba(15,23,42,0.65)",
                                    border: isMe ? "1px solid rgba(6,182,212,0.22)" : "1px solid rgba(51,65,85,0.45)",
                                    backdropFilter: "blur(8px)",
                                    boxShadow: "0 2px 12px rgba(0,0,0,0.22)",
                                    animationDelay: `${idx * 40}ms`,
                                    opacity: isDeleting ? 0.4 : 1,
                                    transition: "opacity 0.2s, transform 0.2s",
                                }}
                            >
                                <div className="flex gap-3">
                                    <Avatar name={cm.author} icon={cm.author_icon} size={34} />

                                    <div className="flex-1 min-w-0">
                                        {/* 헤더 */}
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <span className="text-xs font-bold text-slate-200 flex items-center gap-1">
                                                {cm.author}
                                                {isMe && (
                                                    <span
                                                        className="text-[8px] font-bold px-1.5 py-0.5 rounded-full"
                                                        style={{ background: "rgba(6,182,212,0.2)", color: "#22d3ee", border: "1px solid rgba(6,182,212,0.35)" }}
                                                    >{c.meLabel}</span>
                                                )}
                                            </span>
                                            <span className="text-[10px] text-slate-600">{relativeTime(cm.created_at, c)}</span>
                                        </div>

                                        {/* 내용 또는 인라인 수정 폼 */}
                                        {isEditing ? (
                                            <div className="space-y-2 mt-1">
                                                <textarea
                                                    ref={editRef}
                                                    value={editContent}
                                                    onChange={(e) => setEditContent(e.target.value)}
                                                    maxLength={500}
                                                    rows={3}
                                                    autoFocus
                                                    className="w-full rounded-xl px-3 py-2 text-sm text-white outline-none resize-none transition-all"
                                                    style={{
                                                        background: "rgba(30,41,59,0.9)",
                                                        border: "1px solid rgba(99,102,241,0.5)",
                                                        boxShadow: "0 0 0 2px rgba(99,102,241,0.2)",
                                                        minHeight: "64px",
                                                    }}
                                                />
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => { setEditingId(null); setEditContent(""); }}
                                                        className="flex-1 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                                                        style={{ background: "rgba(51,65,85,0.5)", border: "1px solid rgba(71,85,105,0.4)" }}
                                                    >취소</button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSaveEdit(cm.id)}
                                                        disabled={savingEdit || !editContent.trim()}
                                                        className="flex-1 py-1.5 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
                                                        style={{ background: "rgba(99,102,241,0.85)", border: "1px solid rgba(99,102,241,0.5)" }}
                                                    >
                                                        {savingEdit ? (
                                                            <span className="flex items-center justify-center gap-1">
                                                                <span className="inline-block w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                                                                저장 중…
                                                            </span>
                                                        ) : "✅ 저장"}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            (() => {
                                                const displayText =
                                                    locale !== "ko" && showTranslated && translatedContents[cm.id]
                                                        ? translatedContents[cm.id]
                                                        : cm.content;
                                                const isTranslated =
                                                    locale !== "ko" && showTranslated &&
                                                    !!translatedContents[cm.id] && translatedContents[cm.id] !== cm.content;
                                                return (
                                                    <>
                                                        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap break-words">{displayText}</p>
                                                        {isTranslated && <p className="text-[9px] text-slate-700 mt-0.5">🌐 {b.translatedLabel}</p>}
                                                    </>
                                                );
                                            })()
                                        )}
                                    </div>

                                    {/* 수정/삭제 버튼 (내 댓글만, 수정 중 아닐 때) */}
                                    {isMe && !isEditing && (
                                        <div className="flex-shrink-0 self-start flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                                            {/* 수정 */}
                                            <button
                                                type="button"
                                                onClick={() => { setEditingId(cm.id); setEditContent(cm.content); }}
                                                className="p-1.5 rounded-lg hover:bg-indigo-500/20 transition-colors"
                                                title="수정"
                                                style={{ color: "#a5b4fc" }}
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                            </button>
                                            {/* 삭제 */}
                                            <button
                                                type="button"
                                                onClick={() => setDeleteTargetId(cm.id)}
                                                disabled={isDeleting}
                                                className="p-1.5 rounded-lg hover:bg-red-500/20 transition-colors disabled:cursor-wait"
                                                title="삭제"
                                                style={{ color: "#f87171" }}
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
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
