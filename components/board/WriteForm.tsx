"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleContext";

/* ═══════════════════════════════════════
   이미지 업로드
   ═══════════════════════════════════════ */

async function uploadImage(file: File): Promise<string | null> {
    const ext = file.name.split(".").pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const filePath = `posts/${fileName}`;

    const { error } = await supabase.storage
        .from("post_images")
        .upload(filePath, file, { cacheControl: "3600", upsert: false });

    if (error) {
        console.error("[WriteForm] 이미지 업로드 실패:", error.message);
        return null;
    }

    const { data } = supabase.storage.from("post_images").getPublicUrl(filePath);
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
    const [content, setContent] = useState("");
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

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
                            <p className="text-xs text-emerald-500/70 mt-0.5">목록 페이지로 이동 중...</p>
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

                    {/* 내용 */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                            {t.board.contentLabel} <span className="text-red-400">*</span>
                        </label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder={t.board.contentPlaceholder}
                            rows={6}
                            className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none resize-none transition-all"
                            style={{
                                background: "rgba(30,41,59,0.8)",
                                border: "1px solid rgba(71,85,105,0.5)",
                            }}
                            onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px rgba(6,182,212,0.4)")}
                            onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                        />
                    </div>

                    {/* 이미지 업로드 */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                            {t.board.imageLabel}{" "}
                            <span className="text-slate-600">{t.board.imageOptional}</span>
                        </label>

                        {!imagePreview ? (
                            <label
                                className="flex flex-col items-center justify-center gap-2 w-full h-28 rounded-xl cursor-pointer transition-all duration-200 hover:border-cyan-500/50 hover:bg-slate-700/40"
                                style={{
                                    border: "2px dashed rgba(71,85,105,0.6)",
                                    background: "rgba(30,41,59,0.4)",
                                }}
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
                                <img
                                    src={imagePreview}
                                    alt="preview"
                                    className="w-full max-h-60 object-cover rounded-xl"
                                />
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
                            ← 취소
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
