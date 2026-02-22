"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleContext";
import QuillEditor from "./QuillEditor";

/* ═══════════════════════════════════════
   이미지 업로드 — Supabase Storage: board-images
   ═══════════════════════════════════════ */

const BUCKET = "board-images"; // ← 사용자가 생성한 버킷명

/* 커버 이미지 업로드 (별도 첨부 파일용, 에디터 본문 삽입과 별개) */
async function uploadImage(
    file: File,
    onProgress?: (pct: number) => void
): Promise<string | null> {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const filePath = `covers/${fileName}`;

    onProgress?.(10);

    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type,
        });

    if (error) {
        console.error("[WriteForm] 커버 이미지 업로드 실패 —", error.message, error);
        return null;
    }

    onProgress?.(90);
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
    onProgress?.(100);
    return data.publicUrl;
}


/* ═══════════════════════════════════════
   Props
   ═══════════════════════════════════════ */

interface WriteFormProps {
    tableName: "notices" | "free_board";
    pageTitle: string;
    pageSubtitle: string;
    accentColor: string;
    /** 등록 성공 후 이동할 경로 */
    successRedirect: string;
}

/* ═══════════════════════════════════════
   WriteForm 컴포넌트
   ═══════════════════════════════════════ */

export default function WriteForm({
    tableName,
    pageTitle,
    pageSubtitle,
    accentColor,
    successRedirect,
}: WriteFormProps) {
    const router = useRouter();
    const { t } = useLocale();

    const [title, setTitle] = useState("");
    const [author, setAuthor] = useState("");
    const [content, setContent] = useState("");
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number>(0);
    const [isDragOver, setIsDragOver] = useState(false);
    const [postPassword, setPostPassword] = useState("");

    /* localStorage 닉네임 자동 로드 (CommentSection과 동일 키 공유) */
    useEffect(() => {
        try {
            const saved = localStorage.getItem("kdh_nickname");
            if (saved) setAuthor(saved);
        } catch { /* noop */ }
    }, []);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const applyFile = (file: File | null) => {
        setImageFile(file);
        setUploadProgress(0);
        if (file) {
            const reader = new FileReader();
            reader.onload = () => setImagePreview(reader.result as string);
            reader.readAsDataURL(file);
        } else {
            setImagePreview(null);
        }
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        applyFile(e.target.files?.[0] ?? null);
    };

    const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith("image/")) applyFile(file);
    };

    const handleRemoveImage = () => {
        setImageFile(null);
        setImagePreview(null);
        setUploadProgress(0);
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

        /* 닉네임 localStorage 저장 */
        try { localStorage.setItem("kdh_nickname", author.trim()); } catch { /* noop */ }

        let imageUrl: string | null = null;
        if (imageFile) {
            setUploadProgress(5);
            imageUrl = await uploadImage(imageFile, setUploadProgress);
            if (!imageUrl) {
                setError(t.board.uploadError);
                setIsSubmitting(false);
                setUploadProgress(0);
                return;
            }
        }

        const { error: insertError } = await supabase.from(tableName).insert({
            title: title.trim(),
            content: content.trim(),
            image_url: imageUrl,
            author: author.trim() || null,
            post_password: postPassword.trim() || null,
        });

        if (insertError) {
            console.error(`[WriteForm][${tableName}] INSERT 실패:`, insertError.message);
            setError(`등록 실패: ${insertError.message}`);
            setIsSubmitting(false);
            return;
        }

        // 성공 → 잠시 알림 후 목록으로 이동
        setSuccessMsg(t.board.successMsg);
        setTimeout(() => {
            router.push(successRedirect);
        }, 1200);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-gray-950 text-white">
            <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">

                {/* 헤더 */}
                <div className="mb-8">
                    <h1
                        className={`text-2xl sm:text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r ${accentColor}`}
                    >
                        {pageTitle}
                    </h1>
                    <p className="mt-1.5 text-sm text-slate-400">{pageSubtitle}</p>
                </div>

                {/* 성공 메시지 */}
                {successMsg && (
                    <div className="mb-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 px-5 py-4 text-sm text-emerald-400 flex items-center gap-3">
                        <span className="text-xl">✅</span>
                        <div>
                            <p className="font-bold">{successMsg}</p>
                            <p className="text-xs text-emerald-500/70 mt-0.5">{t.board.successRedirecting}</p>
                        </div>
                    </div>
                )}

                {/* 글쓰기 폼 */}
                <form
                    onSubmit={handleSubmit}
                    className="rounded-2xl border p-5 sm:p-7 space-y-5"
                    style={{
                        background: "rgba(15,23,42,0.8)",
                        borderColor: "rgba(51,65,85,0.6)",
                        backdropFilter: "blur(12px)",
                        boxShadow: "0 4px 32px rgba(0,0,0,0.4)",
                    }}
                >
                    {/* 닉네임 (작성자) */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                            {t.board.nicknameLabel} <span className="text-slate-600 font-normal">{t.board.nicknameOptional}</span>
                        </label>
                        <input
                            type="text"
                            value={author}
                            onChange={(e) => setAuthor(e.target.value)}
                            placeholder={t.board.nicknamePlaceholder}
                            maxLength={20}
                            className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none transition-all"
                            style={{
                                background: "rgba(30,41,59,0.8)",
                                border: "1px solid rgba(71,85,105,0.5)",
                            }}
                            onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px rgba(6,182,212,0.4)")}
                            onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                        />
                    </div>

                    {/* 게시 비밀번호 */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                            {t.board.postPwLabel} <span className="text-slate-600 font-normal">{t.board.nicknameOptional}</span>
                        </label>
                        <input
                            type="password"
                            value={postPassword}
                            onChange={(e) => setPostPassword(e.target.value)}
                            placeholder={t.board.postPwPlaceholder}
                            maxLength={30}
                            className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none transition-all"
                            style={{
                                background: "rgba(30,41,59,0.8)",
                                border: "1px solid rgba(71,85,105,0.5)",
                            }}
                            onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px rgba(6,182,212,0.4)")}
                            onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                        />
                        <p className="mt-1 text-[10px] text-slate-600">
                            🔒 {t.board.postPwHint}
                        </p>
                    </div>

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
                            className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none transition-all"
                            style={{
                                background: "rgba(30,41,59,0.8)",
                                border: "1px solid rgba(71,85,105,0.5)",
                            }}
                            onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px rgba(6,182,212,0.4)")}
                            onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                        />
                    </div>

                    {/* 내용 — QuillEditor (리치 텍스트) */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                            {t.board.contentLabel} <span className="text-red-400">*</span>
                        </label>
                        <QuillEditor
                            value={content}
                            onChange={setContent}
                            placeholder={t.board.contentPlaceholder}
                            disabled={isSubmitting}
                        />
                        {/* 에디터 이미지 삽입 안내 */}
                        <p className="mt-1.5 text-[10px] text-slate-600">
                            {t.board.editorImageHint}
                        </p>
                    </div>


                    {/* 에러 */}
                    {error && (
                        <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
                            ⚠️ {error}
                        </div>
                    )}

                    {/* 버튼 그룹 */}
                    <div className="flex items-center gap-3 pt-1">
                        {/* 취소 */}
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-5 py-3 rounded-xl text-sm font-semibold text-slate-400 hover:text-white transition-colors"
                            style={{
                                background: "rgba(30,41,59,0.6)",
                                border: "1px solid rgba(71,85,105,0.4)",
                            }}
                        >
                            {t.board.cancelBtn}
                        </button>

                        {/* 등록 */}
                        <button
                            type="submit"
                            disabled={isSubmitting || !!successMsg}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 hover:-translate-y-0.5"
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
                    </div>
                </form>

            </div>
        </div>
    );
}
