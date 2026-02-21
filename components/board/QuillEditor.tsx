/**
 * QuillEditor — react-quill 래퍼 (클라이언트 전용)
 *
 * ⚠️  이 파일은 반드시 dynamic import + ssr:false 로 불러야 합니다.
 *     WriteForm에서: const QuillEditor = dynamic(() => import('./QuillEditor'), { ssr: false });
 *
 * 이미지 버튼 클릭 시:
 *   1) 파일 선택 창 열기
 *   2) board-images 버킷에 업로드
 *   3) 공개 URL → 커서 위치에 <img> 삽입
 */

"use client";

import ReactQuill, { Quill } from "react-quill";
import "react-quill/dist/quill.snow.css";
import { useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";

/* ─────────────────────────────────────────────
   Quill 이미지 크기 제한 — 글로벌 CSS 주입
   ───────────────────────────────────────────── */
const QUILL_IMG_STYLE = `
  .ql-editor img { max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0; }
  .ql-editor { min-height: 240px; font-size: 0.9375rem; line-height: 1.75; color: #e2e8f0; background: rgba(15,23,42,0.01); }
  .ql-toolbar.ql-snow { border-color: rgba(51,65,85,0.55) !important; background: rgba(15,23,42,0.7); border-radius: 12px 12px 0 0; flex-wrap: wrap; }
  .ql-container.ql-snow { border-color: rgba(51,65,85,0.55) !important; border-radius: 0 0 12px 12px; }
  .ql-toolbar .ql-stroke { stroke: #94a3b8; }
  .ql-toolbar .ql-fill { fill: #94a3b8; }
  .ql-toolbar button:hover .ql-stroke, .ql-toolbar button.ql-active .ql-stroke { stroke: #22d3ee !important; }
  .ql-toolbar button:hover .ql-fill, .ql-toolbar button.ql-active .ql-fill { fill: #22d3ee !important; }
  .ql-toolbar .ql-picker-label { color: #94a3b8; }
  .ql-toolbar .ql-picker-options { background: rgba(15,23,42,0.95); border-color: rgba(51,65,85,0.55); }
  .ql-picker-item { color: #e2e8f0 !important; }
  .ql-snow a { color: #22d3ee; }
  .ql-editor.ql-blank::before { color: #475569; font-style: normal; left: 16px; }
`;

/* ─────────────────────────────────────────────
   Supabase Storage 이미지 업로드
   ───────────────────────────────────────────── */
const BUCKET = "board-images";

async function uploadToStorage(file: File): Promise<string | null> {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `inline/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });

    if (error) {
        console.error("[QuillEditor] 이미지 업로드 실패:", error.message, error);
        return null;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
}

/* ─────────────────────────────────────────────
   Props
   ───────────────────────────────────────────── */
interface QuillEditorProps {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    disabled?: boolean;
}

/* ─────────────────────────────────────────────
   QuillEditor 컴포넌트
   ───────────────────────────────────────────── */
export default function QuillEditor({
    value,
    onChange,
    placeholder = "내용을 입력하세요...",
    disabled = false,
}: QuillEditorProps) {
    const quillRef = useRef<ReactQuill>(null);

    /* ── 커스텀 이미지 핸들러 ── */
    const imageHandler = () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/jpeg,image/png,image/gif,image/webp";

        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;

            // 업로드 중 임시 표시
            const editor = quillRef.current?.getEditor();
            if (!editor) return;

            const range = editor.getSelection(true);

            // 로딩 placeholder 삽입
            editor.insertText(range.index, "⏳ 이미지 업로드 중...", "user");
            editor.setSelection(range.index + 15, 0);

            const url = await uploadToStorage(file);

            // placeholder 제거
            editor.deleteText(range.index, 15);
            editor.setSelection(range.index, 0);

            if (url) {
                editor.insertEmbed(range.index, "image", url, "user");
                editor.setSelection(range.index + 1, 0);
            } else {
                editor.insertText(range.index, "[이미지 업로드 실패]", "user");
            }
        };

        input.click();
    };

    /* ── 툴바 모듈 (useMemo로 재생성 방지) ── */
    const modules = useMemo(() => ({
        toolbar: {
            container: [
                [{ header: [1, 2, 3, false] }],
                ["bold", "italic", "underline", "strike"],
                [{ color: [] }, { background: [] }],
                [{ list: "ordered" }, { list: "bullet" }],
                ["blockquote"],
                ["link", "image"],
                ["clean"],
            ],
            handlers: { image: imageHandler },
        },
        // imageHandler는 외부 의존성 없음 — 빈 deps
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), []);

    const formats = [
        "header", "bold", "italic", "underline", "strike",
        "color", "background", "list", "bullet",
        "blockquote", "link", "image",
    ];

    return (
        <>
            {/* 다크 테마 스타일 주입 */}
            <style>{QUILL_IMG_STYLE}</style>

            <div
                className="rounded-xl overflow-hidden"
                style={{
                    border: "1px solid rgba(51,65,85,0.55)",
                    background: "rgba(15,23,42,0.8)",
                    opacity: disabled ? 0.5 : 1,
                    pointerEvents: disabled ? "none" : "auto",
                }}
            >
                <ReactQuill
                    ref={quillRef}
                    theme="snow"
                    value={value}
                    onChange={onChange}
                    modules={modules}
                    formats={formats}
                    placeholder={placeholder}
                    readOnly={disabled}
                />
            </div>
        </>
    );
}
