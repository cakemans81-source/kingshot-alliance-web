"use client";

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
   이모지 데이터 (카테고리별)
   ───────────────────────────────────────────── */
const EMOJI_CATEGORIES = [
    {
        label: "😊", name: "얼굴",
        emojis: ["😀", "😁", "😂", "🤣", "😃", "😄", "😅", "😆", "😇", "😉", "😊", "😋", "😌", "😍", "🥰", "😎", "😏", "😐", "😒", "😓", "😔", "😕", "☹️", "😖", "😗", "😘", "😙", "😚", "😛", "😜", "😝", "🤑", "🤓", "🧐", "😞", "😟", "😠", "😡", "🤬", "😢", "😣", "😤", "😥", "😦", "😧", "😨", "😩", "🥺", "😪", "😫", "🥱", "😬", "😭", "😮", "😯", "😰", "😱", "🥵", "🥶", "😲", "😳", "🤯", "😴", "🤤", "😵", "🤪", "🤔", "🤭", "🤫", "🤥", "😶", "🙄", "😷", "🤒", "🤕", "🤢", "🤮", "🤧", "🥳", "🤩", "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿", "😾"],
    },
    {
        label: "👋", name: "손/몸",
        emojis: ["👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💅", "🤳", "💪", "🦾", "🦵", "🦶", "👂", "🦻", "👃", "🧠", "🦷", "🦴", "👀", "👁️", "👅", "👄", "💋"],
    },
    {
        label: "❤️", name: "하트",
        emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "❤️‍🔥", "❤️‍🩹", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "♥️", "🫶", "💌"],
    },
    {
        label: "🎉", name: "특수",
        emojis: ["🎉", "🎊", "🎈", "🎁", "🎀", "🏆", "🥇", "🥈", "🥉", "🎖️", "🏅", "🔥", "✨", "⭐", "🌟", "💫", "⚡", "🌈", "💥", "🎯", "🎮", "🕹️", "🎲", "🧩", "🪄", "🎭", "🎨", "🎬", "🎤", "🎵", "🎶", "🎸", "📣", "🔔", "💢", "💬", "💭", "💤", "🔑", "🔒", "🔓", "👑", "💎", "🔮", "🪬", "🧿", "🎱", "🎰"],
    },
    {
        label: "🌸", name: "자연",
        emojis: ["🌸", "🌺", "🌻", "🌹", "🌷", "🌼", "🌿", "🍀", "🍃", "🌱", "🌲", "🌳", "🌴", "🌵", "🎋", "🎍", "🍁", "🍂", "🍄", "🌾", "💐", "🌊", "🌙", "🌛", "🌜", "🌝", "🌞", "☀️", "⛅", "🌧️", "⛈️", "🌩️", "🌨️", "🌪️", "🌈", "❄️", "☃️", "⛄", "🌁", "🌃", "🌆", "🌇", "🌉"],
    },
    {
        label: "🐶", name: "동물",
        emojis: ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🙈", "🙉", "🙊", "🐔", "🐧", "🐦", "🐤", "🦆", "🦅", "🦉", "🦇", "🐺", "🐗", "🦄", "🐝", "🐛", "🦋", "🐌", "🐞", "🐜", "🐢", "🐍", "🦎", "🐙", "🦑", "🦐", "🦀", "🐡", "🐠", "🐟", "🐬", "🐳", "🐋", "🦈", "🐊", "🐅", "🐆", "🦓", "🦍", "🐘", "🦒", "🦘", "🦬", "🐃", "🐄", "🐎", "🐖", "🐏", "🐑", "🦙", "🐐", "🦌", "🐕", "🐩", "🦮", "🐈", "🐓", "🦃", "🦤", "🦚", "🦜", "🦢", "🦩"],
    },
    {
        label: "🍕", name: "음식",
        emojis: ["🍕", "🍔", "🌮", "🌯", "🥗", "🍜", "🍝", "🍛", "🍣", "🍱", "🥟", "🍤", "🍙", "🍚", "🍘", "🍥", "🥮", "🍢", "🍳", "🥞", "🧇", "🥓", "🥩", "🍗", "🍖", "🌭", "🍟", "🧀", "🥙", "🥪", "🥐", "🍞", "🧈", "🍩", "🍪", "🎂", "🍰", "🧁", "🥧", "🍫", "🍬", "🍭", "🍮", "🍦", "🍧", "🍨", "🍡", "🍠", "🍎", "🍐", "🍊", "🍋", "🍇", "🍓", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🥑", "🍆", "🌽", "🥕", "🧄", "🧅", "🥔", "🍠", "🥜", "🌰"],
    },
];

/* ─────────────────────────────────────────────
   툴바 버튼
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
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [emojiCategory, setEmojiCategory] = useState(0);
    const emojiPickerRef = useRef<HTMLDivElement>(null);
    const savedRange = useRef<Range | null>(null);

    const saveSelection = () => {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            savedRange.current = sel.getRangeAt(0).cloneRange();
        }
    };

    /* 외부 클릭 시 이모지 피커 닫기 */
    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
                setShowEmojiPicker(false);
            }
        };
        if (showEmojiPicker) document.addEventListener("mousedown", handleOutsideClick);
        return () => document.removeEventListener("mousedown", handleOutsideClick);
    }, [showEmojiPicker]);

    /* 외부 value → 에디터 동기화 */
    useEffect(() => {
        const el = editorRef.current;
        if (!el) return;
        if (value === "" && el.innerHTML !== "") {
            el.innerHTML = "";
        } else if (el.innerHTML === "" && value !== "") {
            el.innerHTML = value;
        }
    }, [value]);

    const handleInput = useCallback(() => {
        const el = editorRef.current;
        if (!el) return;
        onChange(el.innerHTML);
    }, [onChange]);

    const exec = (cmd: string, val?: string) => {
        editorRef.current?.focus();
        document.execCommand(cmd, false, val);
        handleInput();
    };

    /* 이모지 삽입 */
    const insertEmoji = (emoji: string) => {
        const el = editorRef.current;
        if (!el) return;
        el.focus();
        const sel = window.getSelection();
        const range = savedRange.current ?? (sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null);

        if (range && el.contains(range.commonAncestorContainer)) {
            try {
                range.deleteContents();
                const textNode = document.createTextNode(emoji);
                range.insertNode(textNode);
                const newRange = document.createRange();
                newRange.setStartAfter(textNode);
                newRange.collapse(true);
                sel?.removeAllRanges();
                sel?.addRange(newRange);
                savedRange.current = newRange.cloneRange();
            } catch {
                document.execCommand("insertText", false, emoji);
            }
        } else {
            document.execCommand("insertText", false, emoji);
        }
        handleInput();
        // 피커 닫지 않음 → 연속 삽입 가능
    };

    /* 이미지 업로드 */
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
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

        el.focus();
        const img = document.createElement("img");
        img.src = url;
        img.style.cssText =
            "max-width:100%;width:auto;height:auto;object-fit:contain;border-radius:8px;margin:8px 0;display:block;cursor:pointer;";
        img.alt = "첨부 이미지";

        const sel = window.getSelection();
        const range = savedRange.current ?? (sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null);

        if (range) {
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

    const handleLink = () => {
        saveSelection();
        const url = window.prompt("링크 URL을 입력하세요:", "https://");
        if (url) exec("createLink", url);
    };

    return (
        <div
            className="rounded-xl flex flex-col"
            style={{
                border: "1px solid rgba(51,65,85,0.55)",
                background: "rgba(15,23,42,0.8)",
                opacity: disabled ? 0.6 : 1,
                pointerEvents: disabled ? "none" : "auto",
                overflow: "visible",
            }}
        >
            {/* 숨긴 파일 Input */}
            <input
                id={FILE_INPUT_ID}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,image/heic"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading}
            />

            {/* 툴바 */}
            <div
                className="flex items-center gap-0.5 px-2 py-1.5 flex-wrap border-b rounded-t-xl"
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
                <ToolBtn title="취소선 (Strike)" onClick={() => exec("strikeThrough")}><s>S</s></ToolBtn>

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

                {/* 이미지 버튼 */}
                <label
                    htmlFor={FILE_INPUT_ID}
                    title="이미지 삽입"
                    className="w-7 h-7 flex items-center justify-center rounded-md cursor-pointer transition-all duration-150 hover:bg-slate-600/60 active:scale-95"
                    style={{ color: uploading ? "#22d3ee" : "#94a3b8" }}
                    onMouseDown={(e) => { saveSelection(); e.stopPropagation(); }}
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

                {/* 이모지 피커 버튼 */}
                <div className="relative" ref={emojiPickerRef}>
                    <button
                        type="button"
                        title="이모지 삽입"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            saveSelection();
                            setShowEmojiPicker((v) => !v);
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded-md text-base leading-none transition-all duration-150 hover:bg-slate-600/60 active:scale-95"
                        style={{
                            color: showEmojiPicker ? "#22d3ee" : "#94a3b8",
                            background: showEmojiPicker ? "rgba(6,182,212,0.15)" : "transparent",
                        }}
                    >
                        😊
                    </button>

                    {/* 이모지 피커 패널 */}
                    {showEmojiPicker && (
                        <div
                            className="absolute left-0 z-50 rounded-2xl shadow-2xl"
                            style={{
                                top: "calc(100% + 6px)",
                                width: "280px",
                                background: "rgba(15,23,42,0.98)",
                                border: "1px solid rgba(71,85,105,0.6)",
                                boxShadow: "0 16px 48px rgba(0,0,0,0.65), 0 0 0 1px rgba(99,102,241,0.1)",
                                backdropFilter: "blur(20px)",
                            }}
                        >
                            {/* 카테고리 탭 */}
                            <div
                                className="flex items-center gap-0.5 px-2 pt-2 pb-1.5 border-b overflow-x-auto"
                                style={{ borderColor: "rgba(51,65,85,0.5)" }}
                            >
                                {EMOJI_CATEGORIES.map((cat, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onMouseDown={(e) => { e.preventDefault(); setEmojiCategory(idx); }}
                                        title={cat.name}
                                        className="flex-shrink-0 w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all"
                                        style={{
                                            background: emojiCategory === idx ? "rgba(6,182,212,0.2)" : "transparent",
                                            border: emojiCategory === idx ? "1px solid rgba(6,182,212,0.45)" : "1px solid transparent",
                                        }}
                                    >
                                        {cat.label}
                                    </button>
                                ))}
                            </div>

                            {/* 카테고리명 */}
                            <div className="px-3 pt-1.5 pb-1">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                    {EMOJI_CATEGORIES[emojiCategory].name}
                                </p>
                            </div>

                            {/* 이모지 그리드 */}
                            <div className="px-2 pb-2 overflow-y-auto" style={{ maxHeight: "192px" }}>
                                <div className="grid grid-cols-8 gap-0.5">
                                    {EMOJI_CATEGORIES[emojiCategory].emojis.map((emoji, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onMouseDown={(e) => { e.preventDefault(); insertEmoji(emoji); }}
                                            className="w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all active:scale-90"
                                            style={{ background: "transparent" }}
                                            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(99,102,241,0.2)")}
                                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 닫기 */}
                            <div
                                className="px-3 py-1.5 border-t flex justify-end"
                                style={{ borderColor: "rgba(51,65,85,0.4)" }}
                            >
                                <button
                                    type="button"
                                    onMouseDown={(e) => { e.preventDefault(); setShowEmojiPicker(false); }}
                                    className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
                                >
                                    닫기 ✕
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <span className="w-px h-4 mx-1 bg-slate-700" />

                <ToolBtn title="서식 지우기" onClick={() => exec("removeFormat")}>
                    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                        <path d="M3.204 5h6.8L8.832 15h-1.8L8.35 10H5.17l1.034-5zm2.316-4h-5l-.5 2h1.8l.241-1h3l-.241 1h1.8l.5-2h-1.6zm6.48 0-6 16h1.5l6-16h-1.5z" />
                    </svg>
                </ToolBtn>
            </div>

            {/* 에디터 영역 */}
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
                    className="outline-none px-4 py-3 text-sm leading-7 text-slate-200 min-h-[240px] overflow-auto rounded-b-xl"
                    style={{ wordBreak: "break-word", caretColor: "#22d3ee" }}
                />
                {!value && (
                    <div
                        className="absolute top-3 left-4 text-sm text-slate-600 pointer-events-none select-none"
                        aria-hidden
                    >
                        {placeholder}
                    </div>
                )}
            </div>

            {/* 에디터 내부 스타일 */}
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
                [contenteditable] img { display:block !important; max-width:100% !important; width:auto !important; height:auto !important; object-fit:contain !important; border-radius:8px; margin:8px 0; }
                [contenteditable] blockquote { border-left:3px solid rgba(6,182,212,0.5); padding-left:1rem; color:#94a3b8; margin:0.5rem 0; }
            `}</style>

            {/* 업로드 중 안내 */}
            {uploading && (
                <div
                    className="px-4 py-2 text-xs text-cyan-400 flex items-center gap-2 border-t"
                    style={{ borderColor: "rgba(51,65,85,0.4)", background: "rgba(6,182,212,0.05)" }}
                >
                    <span className="inline-block w-3 h-3 border border-cyan-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                    이미지를 Supabase에 업로드 중입니다...
                </div>
            )}
        </div>
    );
}
