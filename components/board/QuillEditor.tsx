"use client";

/**
 * RichEditor — 자체 리치 텍스트 에디터 (contenteditable 기반)
 *
 * ✅ 2026-02-21 이미지 삽입 완전 리뉴얼:
 *    - savedRange 패턴 : 툴바 클릭 전 커서 위치를 저장 → 포커스가 사라져도 정확한 위치에 이미지 삽입
 *    - <label htmlFor> 방식 : 이미지 버튼을 label로 교체해 브라우저 파일 다이얼로그 확실히 열림
 *    - 이미지 style 강화 : max-width, height:auto, object-fit:contain 적용
 */

import { useRef, useEffect, useCallback, useState } from "react";
import { supabase } from "@/lib/supabase/client";

/* ─────────────────────────────────────────────
   Supabase Storage 업로드
   ───────────────────────────────────────────── */
const BUCKET = "board-images";
const FILE_INPUT_ID = "rich-editor-img-input";

async function uploadToStorage(file: File): Promise<string | null> {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `inline/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
    if (error) {
        console.error("[RichEditor] 업로드 실패:", error.message, error);
        return null;
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
}

/* ─────────────────────────────────────────────
   툴바 버튼 — onMouseDown으로 에디터 포커스 유지
   ───────────────────────────────────────────── */
interface ToolBtnProps {
    title: string;
    onClick: () => void;
    active?: boolean;
    children: React.ReactNode;
}
function ToolBtn({ title, onClick, active, children }: ToolBtnProps) {
    return (
        <button
            type="button"
            title={title}
            onMouseDown={(e) => { e.preventDefault(); onClick(); }}
            className="w-7 h-7 flex items-center justify-center rounded-md text-sm font-bold transition-all duration-150 hover:bg-slate-600/60 active:scale-95"
            style={{
                color: active ? "#22d3ee" : "#94a3b8",
                background: active ? "rgba(6,182,212,0.15)" : "transparent",
            }}
        >
            {children}
        </button>
    );
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
   RichEditor
   ───────────────────────────────────────────── */
export default function QuillEditor({
    value,
    onChange,
    placeholder = "내용을 입력하세요...",
    disabled = false,
}: QuillEditorProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const [uploading, setUploading] = useState(false);

    /* ── 마지막 커서 위치 저장 (포커스가 날아가도 복원용) ── */
    const savedRange = useRef<Range | null>(null);

    const saveSelection = () => {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            savedRange.current = sel.getRangeAt(0).cloneRange();
        }
    };

    /* 외부 value → 에디터 동기화 (최초 마운트 or 리셋) */
    useEffect(() => {
        const el = editorRef.current;
        if (!el) return;
        if (value === "" && el.innerHTML !== "") {
            el.innerHTML = "";
        } else if (el.innerHTML === "" && value !== "") {
            el.innerHTML = value;
        }
    }, [value]);

    /* input 이벤트 → onChange */
    const handleInput = useCallback(() => {
        const el = editorRef.current;
        if (!el) return;
        onChange(el.innerHTML);
    }, [onChange]);

    /* execCommand 래퍼 */
    const exec = (cmd: string, val?: string) => {
        editorRef.current?.focus();
        document.execCommand(cmd, false, val);
        handleInput();
    };

    /* ── 이미지 파일 선택 후 처리 ── */
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = ""; // 같은 파일 재선택 허용
        if (!file) return;

        setUploading(true);
        const url = await uploadToStorage(file);
        setUploading(false);

        if (!url) {
            alert("이미지 업로드에 실패했습니다. 다시 시도해 주세요.");
            return;
        }

        const el = editorRef.current;
        if (!el) return;

        /* 저장해 둔 커서 위치 복원 후 이미지 삽입 */
        el.focus();
        const img = document.createElement("img");
        img.src = url;
        img.style.cssText =
            "max-width:100%;width:auto;height:auto;object-fit:contain;border-radius:8px;margin:8px 0;display:block;cursor:pointer;";
        img.alt = "첨부 이미지";

        const sel = window.getSelection();
        const range = savedRange.current ?? (sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null);

        if (range) {
            /* 저장된 범위가 에디터 내부인지 확인 */
            try {
                if (el.contains(range.commonAncestorContainer)) {
                    range.collapse(false);
                    range.insertNode(img);
                    const newRange = document.createRange();
                    newRange.setStartAfter(img);
                    newRange.collapse(true);
                    sel?.removeAllRanges();
                    sel?.addRange(newRange);
                    savedRange.current = newRange.cloneRange();
                } else {
                    el.appendChild(img);
                }
            } catch {
                el.appendChild(img);
            }
        } else {
            el.appendChild(img);
        }

        handleInput();
    };

    /* 링크 삽입 */
    const handleLink = () => {
        saveSelection();
        const url = window.prompt("링크 URL을 입력하세요:", "https://");
        if (url) exec("createLink", url);
    };

    return (
        <div
            className="rounded-xl overflow-hidden flex flex-col"
            style={{
                border: "1px solid rgba(51,65,85,0.55)",
                background: "rgba(15,23,42,0.8)",
                opacity: disabled ? 0.6 : 1,
                pointerEvents: disabled ? "none" : "auto",
            }}
        >
            {/* ── 숨긴 파일 Input (label로 트리거) ── */}
            <input
                id={FILE_INPUT_ID}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,image/heic"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading}
            />

            {/* ── 툴바 ── */}
            <div
                className="flex items-center gap-0.5 px-2 py-1.5 flex-wrap border-b"
                style={{
                    background: "rgba(15,23,42,0.7)",
                    borderColor: "rgba(51,65,85,0.55)",
                }}
            >
                {/* 단락 스타일 */}
                <select
                    onMouseDown={(e) => e.stopPropagation()}
                    onChange={(e) => exec("formatBlock", e.target.value)}
                    className="h-7 rounded-md text-xs px-1 outline-none appearance-none cursor-pointer"
                    style={{
                        background: "rgba(30,41,59,0.8)",
                        border: "1px solid rgba(71,85,105,0.4)",
                        color: "#94a3b8",
                    }}
                >
                    <option value="p">본문</option>
                    <option value="h1">H1</option>
                    <option value="h2">H2</option>
                    <option value="h3">H3</option>
                </select>

                <span className="w-px h-4 mx-1 bg-slate-700" />

                <ToolBtn title="굵게 (Bold)" onClick={() => exec("bold")}><b>B</b></ToolBtn>
                <ToolBtn title="기울임 (Italic)" onClick={() => exec("italic")}><i>I</i></ToolBtn>
                <ToolBtn title="밑줄 (Underline)" onClick={() => exec("underline")}><u>U</u></ToolBtn>
                <ToolBtn title="취소선 (Strike)" onClick={() => exec("strikeThrough")}>
                    <s>S</s>
                </ToolBtn>

                <span className="w-px h-4 mx-1 bg-slate-700" />

                <ToolBtn title="순서 있는 목록" onClick={() => exec("insertOrderedList")}>
                    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                        <path d="M2 2h1v4H2zm0 5h1v1H2zm0 2h1v1H2zM5 2h9v1H5zm0 5h9v1H5zm0 2h9v1H5z" />
                    </svg>
                </ToolBtn>
                <ToolBtn title="순서 없는 목록" onClick={() => exec("insertUnorderedList")}>
                    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                        <circle cx="2.5" cy="3" r="1" /><rect x="5" y="2.5" width="9" height="1" />
                        <circle cx="2.5" cy="7" r="1" /><rect x="5" y="6.5" width="9" height="1" />
                        <circle cx="2.5" cy="11" r="1" /><rect x="5" y="10.5" width="9" height="1" />
                    </svg>
                </ToolBtn>

                <span className="w-px h-4 mx-1 bg-slate-700" />

                <ToolBtn title="링크 삽입" onClick={handleLink}>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
                        <path d="M6.5 9.5a3 3 0 004.243 0l2-2a3 3 0 00-4.243-4.243L7.086 4.67" strokeLinecap="round" />
                        <path d="M9.5 6.5a3 3 0 00-4.243 0l-2 2a3 3 0 004.243 4.243L8.914 11.33" strokeLinecap="round" />
                    </svg>
                </ToolBtn>

                {/* ── 이미지 버튼: label 방식으로 파일다이얼로그 확실히 오픈 ── */}
                <label
                    htmlFor={FILE_INPUT_ID}
                    title="이미지 삽입 (Supabase 업로드)"
                    className="w-7 h-7 flex items-center justify-center rounded-md cursor-pointer transition-all duration-150 hover:bg-slate-600/60 active:scale-95"
                    style={{ color: uploading ? "#22d3ee" : "#94a3b8" }}
                    onMouseDown={(e) => {
                        /* 에디터 포커스 유지 + 현재 커서 저장 */
                        saveSelection();
                        /* label은 기본 동작(파일 다이얼로그)을 허용해야 하므로 stopPropagation만 */
                        e.stopPropagation();
                    }}
                >
                    {uploading ? (
                        <span className="inline-block w-3 h-3 border border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
                            <rect x="1" y="2" width="14" height="11" rx="1.5" />
                            <circle cx="5.5" cy="6" r="1.5" />
                            <path d="M1 11l3.5-3.5L8 11l2.5-2.5L15 12" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    )}
                </label>

                <span className="w-px h-4 mx-1 bg-slate-700" />

                <ToolBtn title="서식 지우기" onClick={() => exec("removeFormat")}>
                    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                        <path d="M3.204 5h6.8L8.832 15h-1.8L8.35 10H5.17l1.034-5zm2.316-4h-5l-.5 2h1.8l.241-1h3l-.241 1h1.8l.5-2h-1.6zm6.48 0-6 16h1.5l6-16h-1.5z" />
                    </svg>
                </ToolBtn>
            </div>

            {/* ── 에디터 영역 ── */}
            <div className="relative">
                <div
                    ref={editorRef}
                    contentEditable={!disabled}
                    suppressContentEditableWarning
                    onInput={handleInput}
                    onKeyUp={saveSelection}
                    onMouseUp={saveSelection}
                    onBlur={saveSelection}
                    onPaste={() => { setTimeout(handleInput, 0); }}
                    className="outline-none px-4 py-3 text-sm leading-7 text-slate-200 min-h-[240px] overflow-auto"
                    style={{
                        wordBreak: "break-word",
                        caretColor: "#22d3ee",
                    }}
                />
                {/* placeholder */}
                {!value && (
                    <div
                        className="absolute top-3 left-4 text-sm text-slate-600 pointer-events-none select-none"
                        aria-hidden
                    >
                        {placeholder}
                    </div>
                )}
            </div>

            {/* ── 에디터 내부 스타일 ── */}
            <style>{`
                [contenteditable] h1 { font-size:1.5rem; font-weight:700; margin:0.75rem 0 0.5rem; color:#e2e8f0; }
                [contenteditable] h2 { font-size:1.25rem; font-weight:700; margin:0.75rem 0 0.5rem; color:#e2e8f0; }
                [contenteditable] h3 { font-size:1.1rem; font-weight:600; margin:0.5rem 0 0.25rem; color:#e2e8f0; }
                [contenteditable] strong, [contenteditable] b { font-weight:700; color:#f1f5f9; }
                [contenteditable] em, [contenteditable] i { font-style:italic; }
                [contenteditable] u { text-decoration:underline; }
                [contenteditable] s { text-decoration:line-through; }
                [contenteditable] a { color:#22d3ee; text-decoration:underline; }
                [contenteditable] ul { list-style:disc; padding-left:1.5rem; margin:0.5rem 0; }
                [contenteditable] ol { list-style:decimal; padding-left:1.5rem; margin:0.5rem 0; }
                [contenteditable] li { margin-bottom:0.2rem; }
                [contenteditable] img {
                    display: block !important;
                    max-width: 100% !important;
                    width: auto !important;
                    height: auto !important;
                    object-fit: contain !important;
                    border-radius: 8px;
                    margin: 8px 0;
                }
                [contenteditable] blockquote { border-left:3px solid rgba(6,182,212,0.5); padding-left:1rem; color:#94a3b8; margin:0.5rem 0; }
                /* 업로드 중 힌트 */
                .ql-uploading-hint { color: #67e8f9; font-size: 0.75rem; padding: 4px 8px; }
            `}</style>

            {/* 업로드 중 안내 */}
            {uploading && (
                <div className="px-4 py-2 text-xs text-cyan-400 flex items-center gap-2 border-t"
                    style={{ borderColor: "rgba(51,65,85,0.4)", background: "rgba(6,182,212,0.05)" }}>
                    <span className="inline-block w-3 h-3 border border-cyan-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                    이미지를 Supabase에 업로드 중입니다...
                </div>
            )}
        </div>
    );
}
