"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleContext";
import type { LocaleCode } from "@/lib/i18n/LocaleContext";
import CommentSection from "./CommentSection";
import QuillEditor from "./QuillEditor";

/* ═══════════════════════════════════════
   타입
   ═══════════════════════════════════════ */

interface Post {
    id: number | string;
    title: string;
    content: string;
    image_url: string | null;
    created_at: string;
    author: string | null;
    post_password: string | null;
}

/* 이전/다음 글 요약 타입 */
interface AdjacentPost {
    id: number | string;
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

    // 삭제 모달 상태
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletePassword, setDeletePassword] = useState("");
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    // 수정/삭제 선택 모달 (1단계: 비밀번호 확인)
    const [showActionModal, setShowActionModal] = useState(false);
    const [actionPassword, setActionPassword] = useState("");
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionMode, setActionMode] = useState<"verify" | "choose" | "edit" | "delete">("verify");

    // 수정 모드 상태
    const [editTitle, setEditTitle] = useState("");
    const [editContent, setEditContent] = useState("");
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    /* DB에서 게시글 fetch + 이전/다음 글 병렬 조회 */
    useEffect(() => {
        if (!postId) return;
        /* UUID 여부 판별: 순수 숫자이면 lt/gt 쿼리 가능, UUID면 스킵 */
        const numId = Number(postId);
        const isNumericId = !isNaN(numId) && numId > 0;

        setFetching(true);
        setPrevPost(null);
        setNextPost(null);

        const currentQuery = supabase.from(tableName).select("*").eq("id", postId).single();

        if (isNumericId) {
            /* 숫자 ID: 이전/다음 글 병렬 조회 */
            Promise.all([
                currentQuery,
                supabase.from(tableName).select("id, title").lt("id", numId).order("id", { ascending: false }).limit(1),
                supabase.from(tableName).select("id, title").gt("id", numId).order("id", { ascending: true }).limit(1),
            ]).then(([{ data: cur, error }, { data: prevData }, { data: nextData }]) => {
                if (error || !cur) { router.replace(listHref); return; }
                setPost(cur as Post);
                setFetching(false);
                if (prevData && prevData.length > 0) setPrevPost(prevData[0] as AdjacentPost);
                if (nextData && nextData.length > 0) setNextPost(nextData[0] as AdjacentPost);
            });
        } else {
            /* UUID ID: 현재 글만 조회 (이전/다음 없음) */
            currentQuery.then(({ data: cur, error }) => {
                if (error || !cur) { router.replace(listHref); return; }
                setPost(cur as Post);
                setFetching(false);
            });
        }
    }, [postId, tableName, listHref, router]);

    /* 게시글 삭제 핸들러 */
    const handleDelete = async () => {
        // 비밀번호 없는 글은 관리자 번호(3741)로 허용, 있는 글은 post_password 일치
        const stored = post?.post_password;
        const ok = stored ? deletePassword === stored : deletePassword === "3741";
        if (!ok) {
            setDeleteError(t.board.deletePwWrong);
            return;
        }
        setDeleting(true);
        setDeleteError(null);
        const { error } = await supabase
            .from(tableName)
            .delete()
            .eq("id", postId);
        setDeleting(false);
        if (error) {
            setDeleteError(`${t.board.deleteFailed}${error.message}`);
            return;
        }
        setShowDeleteModal(false);
        router.replace(listHref);
    };

    /* 수정/삭제 비밀번호 확인 */
    const handleVerifyAction = () => {
        if (!post) return;
        const stored = post.post_password;
        // 비밀번호 없는 글: 관리자 번호(3741)만 허용
        // 비밀번호 있는 글: 입력값이 정확히 일치해야 함
        const ok = stored ? actionPassword === stored : actionPassword === "3741";
        if (!ok) {
            setActionError(t.board.editPwWrong);
            return; // ← 검증 실패: 모드 변경하지 않음
        }
        setActionError(null);
        setActionMode("choose"); // ← 검증 성공 시에만 선택 화면으로 이동
    };

    /* 수정 저장 */
    const handleSaveEdit = async () => {
        if (!editTitle.trim() || !editContent.trim()) return;
        setSaving(true);
        const { error } = await supabase
            .from(tableName)
            .update({ title: editTitle.trim(), content: editContent.trim() })
            .eq("id", postId);
        setSaving(false);
        if (error) {
            setActionError(`${t.board.editFailed}${error.message}`);
            return;
        }
        // 로칷8 포스트 업데이트
        setPost((prev) => prev ? { ...prev, title: editTitle.trim(), content: editContent.trim() } : prev);
        // 번역 캐시 제거 (수정되면 이전 번역 무효)
        try {
            sessionStorage.removeItem(getCacheKey(locale, postId, "title"));
            sessionStorage.removeItem(getCacheKey(locale, postId, "content"));
        } catch { /* ignore */ }
        setTranslatedTitle(null);
        setTranslatedContent(null);
        setShowTranslated(false);
        setSaveSuccess(true);
        setTimeout(() => {
            setSaveSuccess(false);
            setShowActionModal(false);
            setActionPassword("");
            setActionMode("verify"); // 게시글 뷰로 복귀
        }, 1500);
    };

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

    /* ── 풀페이지 수정 모드 ── */
    if (actionMode === "edit" && post) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-gray-950 text-white">
                <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">

                    {/* 헤더 */}
                    <div className="mb-8">
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
                            ✏️ {t.board.editPost}
                        </h1>
                        <p className="mt-1.5 text-sm text-slate-400">내용을 수정한 뒤 저장 버튼을 눌러주세요.</p>
                    </div>

                    {/* 성공 메시지 */}
                    {saveSuccess && (
                        <div className="mb-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 px-5 py-4 text-sm text-emerald-400 flex items-center gap-3">
                            <span className="text-xl">✅</span>
                            <div>
                                <p className="font-bold">{t.board.editSuccess}</p>
                                <p className="text-xs text-emerald-500/70 mt-0.5">잠시 후 게시글로 이동합니다.</p>
                            </div>
                        </div>
                    )}

                    {/* 수정 폼 */}
                    <div
                        className="rounded-2xl border p-5 sm:p-7 space-y-5"
                        style={{
                            background: "rgba(15,23,42,0.8)",
                            borderColor: "rgba(51,65,85,0.6)",
                            backdropFilter: "blur(12px)",
                            boxShadow: "0 4px 32px rgba(0,0,0,0.4)",
                        }}
                    >
                        {/* 제목 */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                                {t.board.titleLabel} <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                placeholder={t.board.titlePlaceholder}
                                maxLength={100}
                                className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none transition-all"
                                style={{
                                    background: "rgba(30,41,59,0.8)",
                                    border: "1px solid rgba(71,85,105,0.5)",
                                }}
                                onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px rgba(6,182,212,0.4)")}
                                onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                            />
                        </div>

                        {/* 내용 — QuillEditor */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                                {t.board.contentLabel} <span className="text-red-400">*</span>
                            </label>
                            <QuillEditor
                                value={editContent}
                                onChange={setEditContent}
                                placeholder={t.board.contentPlaceholder}
                                disabled={saving}
                            />
                        </div>

                        {/* 에러 */}
                        {actionError && (
                            <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
                                ⚠️ {actionError}
                            </div>
                        )}

                        {/* 버튼 */}
                        <div className="flex items-center gap-3 pt-1">
                            <button
                                type="button"
                                onClick={() => {
                                    setActionMode("verify");
                                    setSaveSuccess(false);
                                    setActionError(null);
                                }}
                                className="px-5 py-3 rounded-xl text-sm font-semibold text-slate-400 hover:text-white transition-colors"
                                style={{
                                    background: "rgba(30,41,59,0.6)",
                                    border: "1px solid rgba(71,85,105,0.4)",
                                }}
                            >
                                {t.board.cancelBtn}
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveEdit}
                                disabled={saving || !!saveSuccess}
                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 hover:-translate-y-0.5"
                                style={{
                                    background: "linear-gradient(135deg, #6366f1, #3b82f6)",
                                    boxShadow: "0 4px 16px rgba(99,102,241,0.35)",
                                }}
                            >
                                {saving ? (
                                    <>
                                        <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        {t.board.submitting}
                                    </>
                                ) : (
                                    <>✅ {t.board.editSaveBtn}</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-gray-950 text-white">

            {/* 수정/삭제 통합 모달 */}
            {showActionModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center px-4"
                    style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}
                    onClick={(e) => { if (e.target === e.currentTarget) { setShowActionModal(false); setActionPassword(""); setActionError(null); setActionMode("verify"); setSaveSuccess(false); } }}
                >
                    <div
                        className="w-full max-w-sm rounded-2xl p-6 space-y-4"
                        style={{
                            background: "rgba(15,23,42,0.97)",
                            border: "1px solid rgba(99,102,241,0.35)",
                            boxShadow: "0 8px 40px rgba(99,102,241,0.18)",
                        }}
                    >
                        {/* 비밀번호 입력 단계 */}
                        {actionMode === "verify" && (
                            <>
                                <div className="flex items-center gap-2">
                                    <span className="text-xl">🔒</span>
                                    <h2 className="text-base font-bold text-indigo-300">{t.board.editOrDelete}</h2>
                                </div>
                                <p className="text-sm text-slate-400">{t.board.editPwPrompt}</p>
                                <input
                                    type="password"
                                    value={actionPassword}
                                    onChange={(e) => { setActionPassword(e.target.value); setActionError(null); }}
                                    onKeyDown={(e) => { if (e.key === "Enter") handleVerifyAction(); }}
                                    placeholder={t.board.deletePwPlaceholder}
                                    autoFocus
                                    className="w-full px-4 py-2.5 rounded-xl text-sm text-slate-200 placeholder-slate-600 outline-none"
                                    style={{
                                        background: "rgba(30,41,59,0.9)",
                                        border: actionError ? "1px solid rgba(239,68,68,0.6)" : "1px solid rgba(99,102,241,0.4)",
                                    }}
                                />
                                {actionError && (
                                    <p className="text-xs text-red-400 flex items-center gap-1"><span>⚠️</span>{actionError}</p>
                                )}
                                <div className="flex gap-2 pt-1">
                                    <button
                                        onClick={() => { setShowActionModal(false); setActionPassword(""); setActionError(null); }}
                                        className="flex-1 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:text-slate-200 transition-colors"
                                        style={{ background: "rgba(51,65,85,0.45)", border: "1px solid rgba(71,85,105,0.5)" }}
                                    >
                                        {t.board.deleteCancelBtn}
                                    </button>
                                    <button
                                        onClick={handleVerifyAction}
                                        disabled={!actionPassword.trim()}
                                        className="flex-1 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                                        style={{ background: "rgba(99,102,241,0.8)", border: "1px solid rgba(99,102,241,0.5)" }}
                                    >
                                        🔓 확인
                                    </button>
                                </div>
                            </>
                        )}

                        {/* 비밀번호 확인 후 선택 화면 */}
                        {actionMode === "choose" && (
                            <>
                                <div className="flex items-center gap-2">
                                    <span className="text-xl">✅</span>
                                    <h2 className="text-base font-bold text-emerald-300">{t.board.editOrDelete}</h2>
                                </div>
                                <p className="text-sm text-slate-400">비밀번호가 확인되었습니다. 원하는 작업을 선택하세요.</p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            setEditTitle(post?.title ?? "");
                                            setEditContent(post?.content ?? "");
                                            setShowActionModal(false);   // 모달 닫기
                                            setActionMode("edit");       // 풀페이지 수정 모드로
                                        }}
                                        className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                                        style={{ background: "rgba(99,102,241,0.75)", border: "1px solid rgba(99,102,241,0.5)" }}
                                    >
                                        {t.board.btnEdit}
                                    </button>
                                    <button
                                        onClick={() => setActionMode("delete")}
                                        className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                                        style={{ background: "rgba(239,68,68,0.75)", border: "1px solid rgba(239,68,68,0.5)" }}
                                    >
                                        {t.board.btnDelete}
                                    </button>
                                </div>
                                <button
                                    onClick={() => { setShowActionModal(false); setActionPassword(""); setActionMode("verify"); }}
                                    className="w-full py-2 rounded-xl text-xs text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    {t.board.deleteCancelBtn}
                                </button>
                            </>
                        )}

                        {/* 삭제 확인 */}
                        {actionMode === "delete" && (
                            <>
                                <div className="flex items-center gap-2">
                                    <span className="text-xl">🗑️</span>
                                    <h2 className="text-base font-bold text-red-400">{t.board.deletePost}</h2>
                                </div>
                                <p className="text-sm text-slate-400">정말 이 게시글을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.</p>
                                {deleteError && <p className="text-xs text-red-400">⚠️ {deleteError}</p>}
                                <div className="flex gap-2 pt-1">
                                    <button
                                        onClick={() => setActionMode("choose")}
                                        className="flex-1 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:text-slate-200 transition-colors"
                                        style={{ background: "rgba(51,65,85,0.45)", border: "1px solid rgba(71,85,105,0.5)" }}
                                    >
                                        {t.board.deleteCancelBtn}
                                    </button>
                                    <button
                                        onClick={async () => {
                                            setDeleting(true);
                                            setDeleteError(null);
                                            const { error } = await supabase.from(tableName).delete().eq("id", postId);
                                            setDeleting(false);
                                            if (error) { setDeleteError(`${t.board.deleteFailed}${error.message}`); return; }
                                            setShowActionModal(false);
                                            router.replace(listHref);
                                        }}
                                        disabled={deleting}
                                        className="flex-1 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
                                        style={{ background: "rgba(239,68,68,0.8)", border: "1px solid rgba(239,68,68,0.5)" }}
                                    >
                                        {deleting ? (
                                            <span className="flex items-center justify-center gap-1.5">
                                                <span className="inline-block w-3.5 h-3.5 border border-white/40 border-t-white rounded-full animate-spin" />
                                                {t.board.deletingBtn}
                                            </span>
                                        ) : t.board.deleteConfirmBtn}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* 기존 삭제 비밀번호 모달 (유지) */}
            {showDeleteModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center px-4"
                    style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}
                    onClick={(e) => { if (e.target === e.currentTarget) { setShowDeleteModal(false); setDeletePassword(""); setDeleteError(null); } }}
                >
                    <div
                        className="w-full max-w-sm rounded-2xl p-6 space-y-4"
                        style={{
                            background: "rgba(15,23,42,0.97)",
                            border: "1px solid rgba(239,68,68,0.35)",
                            boxShadow: "0 8px 40px rgba(239,68,68,0.18)",
                        }}
                    >
                        {/* 헤더 */}
                        <div className="flex items-center gap-2">
                            <span className="text-xl">🗑️</span>
                            <h2 className="text-base font-bold text-red-400">🗑️ {t.board.deletePost}</h2>
                        </div>
                        <p className="text-sm text-slate-400">{t.board.deleteDesc} <span className="text-slate-200 font-semibold">{t.board.deleteDescHighlight}</span>를 입력하세요.</p>

                        {/* 비밀번호 입력 */}
                        <input
                            type="password"
                            value={deletePassword}
                            onChange={(e) => { setDeletePassword(e.target.value); setDeleteError(null); }}
                            onKeyDown={(e) => { if (e.key === "Enter") handleDelete(); }}
                            placeholder={t.board.deletePwPlaceholder}
                            autoFocus
                            className="w-full px-4 py-2.5 rounded-xl text-sm text-slate-200 placeholder-slate-600 outline-none"
                            style={{
                                background: "rgba(30,41,59,0.9)",
                                border: deleteError ? "1px solid rgba(239,68,68,0.6)" : "1px solid rgba(51,65,85,0.7)",
                            }}
                        />

                        {/* 에러 표시 */}
                        {deleteError && (
                            <p className="text-xs text-red-400 flex items-center gap-1">
                                <span>⚠️</span>{deleteError}
                            </p>
                        )}

                        {/* 버튼 영역 */}
                        <div className="flex gap-2 pt-1">
                            <button
                                onClick={() => { setShowDeleteModal(false); setDeletePassword(""); setDeleteError(null); }}
                                className="flex-1 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:text-slate-200 transition-colors"
                                style={{ background: "rgba(51,65,85,0.45)", border: "1px solid rgba(71,85,105,0.5)" }}
                            >
                                {t.board.deleteCancelBtn}
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="flex-1 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
                                style={{ background: "rgba(239,68,68,0.8)", border: "1px solid rgba(239,68,68,0.5)" }}
                            >
                                {deleting ? (
                                    <span className="flex items-center justify-center gap-1.5">
                                        <span className="inline-block w-3.5 h-3.5 border border-white/40 border-t-white rounded-full animate-spin" />
                                        {t.board.deletingBtn}
                                    </span>
                                ) : t.board.deleteConfirmBtn}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">

                {/* 뒤로가기 */}
                <Link
                    href={listHref}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-cyan-400 transition-colors mb-6"
                >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    {t.board.backToList}
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
                                {translateError ?? t.board.originalShowing}
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

                {/* 제목 + 삭제 버튼 영역 */}
                <div
                    className="rounded-2xl border p-6 sm:p-8 space-y-4"
                    style={{
                        background: "rgba(15,23,42,0.75)",
                        borderColor: "rgba(51,65,85,0.55)",
                        backdropFilter: "blur(12px)",
                        boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
                    }}
                >
                    {/* 제목 행 + 삭제 버튼 */}
                    <div className="flex items-start justify-between gap-3">
                        <h1
                            className={`flex-1 text-xl sm:text-2xl font-extrabold leading-snug bg-clip-text text-transparent bg-gradient-to-r ${accentColor} transition-opacity duration-300 ${translating ? "opacity-30" : "opacity-100"}`}
                        >
                            {translating ? (
                                <span className="inline-block w-3/4 h-6 rounded bg-slate-700 animate-pulse" />
                            ) : displayTitle}
                        </h1>

                        {/* 수정/삭제 버튼 */}
                        <button
                            onClick={() => { setShowActionModal(true); setActionPassword(""); setActionError(null); setActionMode("verify"); }}
                            title={t.board.editOrDelete}
                            className="flex-shrink-0 px-3 h-8 rounded-lg flex items-center gap-1.5 text-xs font-semibold transition-all hover:scale-105 active:scale-95"
                            style={{
                                background: "rgba(99,102,241,0.12)",
                                border: "1px solid rgba(99,102,241,0.35)",
                                color: "#a5b4fc",
                            }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            {t.board.editOrDelete}
                        </button>
                    </div>

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
                                        <p className="text-[10px] text-slate-600 mb-0.5">{t.board.prevPost}</p>
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
                                    <span className="text-xs text-slate-700">{t.board.firstPost}</span>
                                </div>
                            )}

                            {/* 다음 글 */}
                            {nextPost ? (
                                <Link
                                    href={`${listHref}/${nextPost.id}`}
                                    className="group flex items-center justify-end gap-3 px-4 py-4 sm:px-5 sm:py-5 transition-all duration-200 hover:bg-slate-700/30"
                                >
                                    <div className="min-w-0 text-right">
                                        <p className="text-[10px] text-slate-600 mb-0.5">{t.board.nextPost}</p>
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
                                    <span className="text-xs text-slate-700">{t.board.lastPost}</span>
                                </div>
                            )}
                        </div>
                    </nav>
                )}

                {/* ── 댓글 섹션 — postId는 prop + useParams() dual-source로 안전 처리 */}
                <CommentSection boardId={tableName} postId={post.id} />

            </div>
        </div>
    );
}
