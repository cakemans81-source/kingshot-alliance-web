"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { supabase } from "@/lib/supabase/client";

/* ═══════════════════════════════════════════
   타입 & 상수
   ═══════════════════════════════════════════ */
interface Player {
    id: string;
    name: string;
    x: number;
    y: number;
    memo: string;
}

interface Structure {
    id: string;
    label: string;
    x: number;
    y: number;
    size: number;
    type: "hq" | "trap";
}

const STRUCTURES: Structure[] = [
    { id: "hq", label: "🏰 본부", x: 737, y: 757, size: 4, type: "hq" },
    { id: "trap1", label: "🪤 함정1", x: 730, y: 748, size: 4, type: "trap" },
    { id: "trap2", label: "🪤 함정2", x: 742, y: 752, size: 4, type: "trap" },
];

const INIT_PLAYERS: Player[] = [
    { id: "p1", name: "만두몬mandu", x: 736, y: 752, memo: "" },
    { id: "p2", name: "jerry", x: 739, y: 760, memo: "" },
    { id: "p3", name: "Nightmare1870", x: 748, y: 750, memo: "" },
];

/* 그리드 범위 */
const MIN_X = 724, MAX_X = 758;
const MIN_Y = 742, MAX_Y = 770;
const COLS = MAX_X - MIN_X + 1;
const ROWS = MAX_Y - MIN_Y + 1;
const CELL = 40; // 마름모 셀 크기

/* 마름모(isometric) 좌표 변환:
   게임 좌표 (gx, gy) → 화면 좌표 (px, py)
   X가 오른쪽-아래, Y가 왼쪽-아래로 향하는 다이아몬드 */
const ISO_HALF = CELL / 2;

function toIso(gx: number, gy: number) {
    const col = gx - MIN_X;
    const row = MAX_Y - gy; // Y 반전
    return {
        px: (col - row) * ISO_HALF,
        py: (col + row) * ISO_HALF / 2,
    };
}

/* ═══════════════════════════════════════════
   KdhGrid 컴포넌트
   ═══════════════════════════════════════════ */
export default function KdhGrid() {
    const { user } = useAuth();
    const { t } = useLocale();
    const isAdmin = user?.role === "admin";

    const [players, setPlayers] = useState<Player[]>(INIT_PLAYERS);
    const [loading, setLoading] = useState(true);

    const [search, setSearch] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const [filter, setFilter] = useState<"all" | "hq" | "trap1" | "trap2">("all");
    const [showModal, setShowModal] = useState(false);
    const [tooltip, setTooltip] = useState<{ name: string; coord: string; memo: string; x: number; y: number } | null>(null);

    /* 추가 폼 */
    const [fName, setFName] = useState("");
    const [fX, setFX] = useState("");
    const [fY, setFY] = useState("");
    const [fMemo, setFMemo] = useState("");

    /* Pan & Zoom 상태 */
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const panStart = useRef({ x: 0, y: 0 });
    const lastTouchDist = useRef(0);

    /* Supabase에서 데이터 로드 */
    const fetchPlayers = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("kdh_players")
            .select("*")
            .order("created_at", { ascending: true });
        if (!error && data && data.length > 0) {
            setPlayers(data.map((d: { id: number; name: string; x: number; y: number; memo: string | null }) => ({
                id: String(d.id),
                name: d.name,
                x: d.x,
                y: d.y,
                memo: d.memo || "",
            })));
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchPlayers(); }, [fetchPlayers]);

    /* 퍼지 검색: 부분 일치 + 순서 유지 서브시퀀스 */
    const searchMatches = useMemo(() => {
        if (!search) return [] as Player[];
        const q = search.toLowerCase();
        // 1차: 부분 문자열 매칭
        const exact = players.filter(p => p.name.toLowerCase().includes(q));
        if (exact.length > 0) return exact;
        // 2차: 순서 유지 서브시퀀스 (예: "mdu" → "mandu")
        return players.filter(p => {
            const name = p.name.toLowerCase();
            let qi = 0;
            for (let i = 0; i < name.length && qi < q.length; i++) {
                if (name[i] === q[qi]) qi++;
            }
            return qi === q.length;
        });
    }, [search, players]);

    const hitIds = selectedId ? [selectedId] : searchMatches.map(p => p.id);

    /* 검색 결과가 정확히 1개면 자동 선택 */
    useEffect(() => {
        if (searchMatches.length === 1) {
            const targetId = searchMatches[0].id;
            setSelectedId(targetId);
            setShowDropdown(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchMatches]);

    /* 드롭다운 바깥 클릭 시 닫기 */
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    /* 유저 선택 시 해당 위치로 줌인 이동 */
    const focusOnPlayer = useCallback((playerId: string) => {
        const p = players.find(pl => pl.id === playerId);
        if (!p || !containerRef.current) return;
        const { px, py } = toIso(p.x, p.y);
        const rect = containerRef.current.getBoundingClientRect();
        const zoomTo = 2.2;

        // SVG viewBox offset 계산 — toIso 좌표를 SVG 엘리먼트 내 실제 위치로 변환
        const allCorners = [
            toIso(MIN_X, MIN_Y), toIso(MAX_X, MIN_Y),
            toIso(MIN_X, MAX_Y), toIso(MAX_X, MAX_Y),
        ];
        const vbMinX = Math.min(...allCorners.map(c => c.px)) - 60;
        const vbMinY = Math.min(...allCorners.map(c => c.py)) - 30;

        // SVG 내부 좌표 → 화면 pixel 위치
        const screenX = (px - vbMinX) * zoomTo;
        const screenY = (py - vbMinY) * zoomTo;

        setScale(zoomTo);
        setPan({ x: rect.width / 2 - screenX, y: rect.height / 2 - screenY });
    }, [players]);

    /* selectedId 변경 시 포커스 */
    useEffect(() => {
        if (selectedId) focusOnPlayer(selectedId);
    }, [selectedId, focusOnPlayer]);

    /* 필터 */
    const filteredPlayers = (() => {
        if (filter === "all") return players;
        const struct = STRUCTURES.find(s => s.id === filter)!;
        const r = struct.size;
        return players.filter(p => Math.abs(p.x - struct.x) <= r && Math.abs(p.y - struct.y) <= r);
    })();

    /* 초기 중앙 정렬 (HQ 기준) */
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const hq = STRUCTURES[0];
        const { px, py } = toIso(hq.x, hq.y);
        const rect = el.getBoundingClientRect();
        // viewBox offset
        const allCorners = [
            toIso(MIN_X, MIN_Y), toIso(MAX_X, MIN_Y),
            toIso(MIN_X, MAX_Y), toIso(MAX_X, MAX_Y),
        ];
        const vbMinX = Math.min(...allCorners.map(c => c.px)) - 60;
        const vbMinY = Math.min(...allCorners.map(c => c.py)) - 30;
        setPan({ x: rect.width / 2 - (px - vbMinX), y: rect.height / 2 - (py - vbMinY) });
    }, []);

    /* ── 마우스 Pan ── */
    const onMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        isDragging.current = true;
        dragStart.current = { x: e.clientX, y: e.clientY };
        panStart.current = { ...pan };
    };
    const onMouseMove = (e: React.MouseEvent) => {
        if (!isDragging.current) return;
        setPan({
            x: panStart.current.x + (e.clientX - dragStart.current.x),
            y: panStart.current.y + (e.clientY - dragStart.current.y),
        });
    };
    const onMouseUp = () => { isDragging.current = false; };

    /* ── 마우스 휠 Zoom ── */
    const onWheel = useCallback((e: WheelEvent) => {
        e.preventDefault();
        setScale(s => Math.min(Math.max(0.4, s + e.deltaY * -0.001), 3));
    }, []);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, [onWheel]);

    /* ── 터치 Pan + 핀치 Zoom ── */
    const onTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            isDragging.current = true;
            dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            panStart.current = { ...pan };
        } else if (e.touches.length === 2) {
            isDragging.current = false;
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            lastTouchDist.current = Math.sqrt(dx * dx + dy * dy);
        }
    };
    const onTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 1 && isDragging.current) {
            setPan({
                x: panStart.current.x + (e.touches[0].clientX - dragStart.current.x),
                y: panStart.current.y + (e.touches[0].clientY - dragStart.current.y),
            });
        } else if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (lastTouchDist.current > 0) {
                const delta = dist / lastTouchDist.current;
                setScale(s => Math.min(Math.max(0.4, s * delta), 3));
            }
            lastTouchDist.current = dist;
        }
    };
    const onTouchEnd = () => { isDragging.current = false; lastTouchDist.current = 0; };

    /* 유저 추가 (Supabase) */
    const addPlayer = async () => {
        const name = fName.trim();
        const x = parseInt(fX);
        const y = parseInt(fY);
        if (!name || isNaN(x) || isNaN(y)) return;
        const { error } = await supabase.from("kdh_players").insert({ name, x, y, memo: fMemo.trim() || null });
        if (error) { alert(t.kdhPage.addFailed + error.message); return; }
        setFName(""); setFX(""); setFY(""); setFMemo("");
        setShowModal(false);
        fetchPlayers();
    };

    /* 유저 삭제 (Supabase) */
    const deletePlayer = async (id: string) => {
        if (!window.confirm(t.kdhPage.deleteConfirm)) return;
        const { error } = await supabase.from("kdh_players").delete().eq("id", parseInt(id));
        if (error) { alert(t.kdhPage.deleteFailed + error.message); return; }
        fetchPlayers();
    };

    /* ── 엑셀 양식 다운로드 ── */
    const downloadTemplate = () => {
        const header = "이름,X좌표,Y좌표,메모";
        const note = "# 좌표 기준: 2x2 마름모의 오른쪽 셀 (게임 내 표시 좌표 그대로 입력)";
        const example = "홍길동,735,755,본부 근처\n유저2,740,748,함정1";
        const csv = note + "\n" + header + "\n" + example;
        const bom = "\uFEFF";
        const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "KDH_좌표_양식.csv";
        a.click();
        URL.revokeObjectURL(url);
    };

    /* ── 엑셀(CSV) 업로드 ── */
    const fileInputRef = useRef<HTMLInputElement>(null);
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith("#"));
        // 첫 줄이 헤더면 건너뜀
        const startIdx = lines[0]?.includes("이름") || lines[0]?.toLowerCase().includes("name") ? 1 : 0;
        const toInsert: { name: string; x: number; y: number; memo: string | null }[] = [];
        for (let i = startIdx; i < lines.length; i++) {
            const cols = lines[i].split(",");
            const name = cols[0]?.trim();
            const x = parseInt(cols[1]?.trim());
            const y = parseInt(cols[2]?.trim());
            const memo = cols[3]?.trim() || null;
            if (name && !isNaN(x) && !isNaN(y)) {
                toInsert.push({ name, x, y, memo });
            }
        }
        if (toInsert.length === 0) { alert(t.kdhPage.noValidData); return; }
        if (!window.confirm(t.kdhPage.uploadConfirm.replace("{n}", String(toInsert.length)))) return;
        const { error } = await supabase.from("kdh_players").insert(toInsert);
        if (error) { alert(t.kdhPage.uploadFailed + error.message); return; }
        alert(t.kdhPage.uploadSuccess.replace("{n}", String(toInsert.length)));
        fetchPlayers();
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    /* 툴팁 */
    const showTip = (name: string, coord: string, memo: string, cx: number, cy: number) =>
        setTooltip({ name, coord, memo, x: cx + 12, y: cy - 12 });
    const hideTip = () => setTooltip(null);

    /* 마름모 그리드 라인 생성 */
    const gridLines: React.ReactNode[] = [];
    for (let c = 0; c <= COLS; c++) {
        const p1 = toIso(MIN_X + c, MAX_Y);
        const p2 = toIso(MIN_X + c, MIN_Y);
        gridLines.push(
            <line key={`c${c}`} x1={p1.px} y1={p1.py} x2={p2.px} y2={p2.py}
                stroke="rgba(51,65,85,0.35)" strokeWidth={0.5} />
        );
    }
    for (let r = 0; r <= ROWS; r++) {
        const p1 = toIso(MIN_X, MIN_Y + r);
        const p2 = toIso(MAX_X, MIN_Y + r);
        gridLines.push(
            <line key={`r${r}`} x1={p1.px} y1={p1.py} x2={p2.px} y2={p2.py}
                stroke="rgba(51,65,85,0.35)" strokeWidth={0.5} />
        );
    }

    /* SVG 뷰박스 계산 */
    const corners = [
        toIso(MIN_X, MIN_Y), toIso(MAX_X, MIN_Y),
        toIso(MIN_X, MAX_Y), toIso(MAX_X, MAX_Y),
    ];
    const svgMinX = Math.min(...corners.map(c => c.px)) - 60;
    const svgMinY = Math.min(...corners.map(c => c.py)) - 30;
    const svgMaxX = Math.max(...corners.map(c => c.px)) + 60;
    const svgMaxY = Math.max(...corners.map(c => c.py)) + 30;
    const svgW = svgMaxX - svgMinX;
    const svgH = svgMaxY - svgMinY;

    /* 마름모 셀 (다이아몬드) 패스 생성 */
    const diamondPath = (cx: number, cy: number, sz: number) => {
        const hw = sz * ISO_HALF;
        const hh = sz * ISO_HALF / 2;
        return `M${cx},${cy - hh} L${cx + hw},${cy} L${cx},${cy + hh} L${cx - hw},${cy} Z`;
    };

    return (
        <>
            {/* ── 카드 래퍼 ── */}
            <div
                className="mb-4 rounded-2xl border overflow-hidden"
                style={{
                    background: "rgba(15,23,42,0.75)",
                    borderColor: "rgba(51,65,85,0.55)",
                    backdropFilter: "blur(12px)",
                    boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
                }}
            >
                {/* ── 헤더 ── */}
                <div
                    className="px-4 py-3 border-b space-y-2"
                    style={{ borderColor: "rgba(51,65,85,0.45)" }}
                >
                    {/* 1줄: 타이틀 + 검색 */}
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-sm">🗺️</span>
                            <h2 className="text-sm font-bold text-slate-200 whitespace-nowrap">{t.kdhPage.mapTitle}</h2>
                            <span
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                                style={{ background: "rgba(6,182,212,0.15)", color: "#22d3ee" }}
                            >
                                {players.length}{t.kdhPage.playerCount}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                            {/* 검색 자동완성 */}
                            <div ref={searchRef} className="relative">
                                <input
                                    type="text"
                                    value={search}
                                    onChange={e => {
                                        setSearch(e.target.value);
                                        setSelectedId(null);
                                        setShowDropdown(true);
                                    }}
                                    onFocus={() => search && setShowDropdown(true)}
                                    placeholder={t.kdhPage.searchPlaceholder}
                                    className="h-7 rounded-lg px-2.5 text-xs outline-none w-28 sm:w-40"
                                    style={{
                                        background: "rgba(7,13,26,0.8)",
                                        border: `1px solid ${search ? (searchMatches.length > 0 ? "rgba(34,211,238,0.5)" : "rgba(239,68,68,0.5)") : "rgba(6,182,212,0.3)"}`,
                                        color: "#e2e8f0",
                                    }}
                                />
                                {/* 자동완성 드롭다운 */}
                                {showDropdown && search && searchMatches.length > 0 && !selectedId && (
                                    <div className="absolute top-full left-0 mt-1 w-64 rounded-xl overflow-hidden z-50"
                                        style={{
                                            background: "rgba(15,23,42,0.97)",
                                            border: "1px solid rgba(6,182,212,0.3)",
                                            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                                            backdropFilter: "blur(12px)",
                                        }}
                                    >
                                        <div className="p-1.5 max-h-48 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
                                            {searchMatches.map(p => (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedId(p.id);
                                                        setSearch(p.name);
                                                        setShowDropdown(false);
                                                    }}
                                                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs transition-all hover:bg-cyan-500/15 text-left"
                                                >
                                                    <span className="font-semibold text-white truncate">{p.name}</span>
                                                    <span className="text-[10px] text-slate-500 flex-shrink-0">X:{p.x} Y:{p.y}</span>
                                                </button>
                                            ))}
                                        </div>
                                        <div className="px-3 py-1.5 text-[9px] text-slate-600 border-t" style={{ borderColor: "rgba(51,65,85,0.3)" }}>
                                            {searchMatches.length}{t.kdhPage.matchCount}
                                        </div>
                                    </div>
                                )}
                            </div>
                            {search && (
                                <button type="button" onClick={() => {
                                    setSearch("");
                                    setSelectedId(null);
                                    setScale(1);
                                    const el = containerRef.current;
                                    if (!el) return;
                                    const hq = STRUCTURES[0];
                                    const { px, py } = toIso(hq.x, hq.y);
                                    const rect = el.getBoundingClientRect();
                                    const allC = [toIso(MIN_X, MIN_Y), toIso(MAX_X, MIN_Y), toIso(MIN_X, MAX_Y), toIso(MAX_X, MAX_Y)];
                                    const vbX = Math.min(...allC.map(c => c.px)) - 60;
                                    const vbY = Math.min(...allC.map(c => c.py)) - 30;
                                    setPan({ x: rect.width / 2 - (px - vbX), y: rect.height / 2 - (py - vbY) });
                                }}
                                    className="h-7 w-7 rounded-lg text-xs font-bold text-slate-500 hover:text-red-400 transition-colors flex items-center justify-center flex-shrink-0"
                                    style={{ background: "rgba(30,41,59,0.6)", border: "1px solid rgba(51,65,85,0.4)" }}
                                    title={t.kdhPage.searchReset}
                                >✕</button>
                            )}
                        </div>
                    </div>
                    {/* 2줄: 관리자 버튼 (관리자만 표시) */}
                    {isAdmin && (
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setShowModal(true)}
                                className="h-7 px-3 rounded-lg text-xs font-bold transition-all hover:brightness-110 active:scale-95 whitespace-nowrap flex-shrink-0"
                                style={{ background: "linear-gradient(135deg,#06b6d4,#3b82f6)", color: "#fff" }}
                            >
                                {t.kdhPage.addBtn}
                            </button>
                            <button
                                type="button"
                                onClick={downloadTemplate}
                                className="h-7 px-3 rounded-lg text-[11px] font-semibold transition-all hover:brightness-110 active:scale-95 flex items-center gap-1 whitespace-nowrap flex-shrink-0"
                                style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", color: "#34d399" }}
                                title="CSV 양식 다운로드"
                            >
                                {t.kdhPage.downloadBtn}
                            </button>
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="h-7 px-3 rounded-lg text-[11px] font-semibold transition-all hover:brightness-110 active:scale-95 flex items-center gap-1 whitespace-nowrap flex-shrink-0"
                                style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", color: "#fbbf24" }}
                                title="CSV 파일 업로드"
                            >
                                {t.kdhPage.uploadBtn}
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv,.txt"
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                        </div>
                    )}
                </div>

                {/* ── 필터 탭 ── */}
                <div
                    className="flex gap-1 px-3 py-2 border-b overflow-x-auto"
                    style={{ borderColor: "rgba(51,65,85,0.35)", scrollbarWidth: "none" }}
                >
                    {([
                        { key: "all", label: t.kdhPage.filterAll },
                        { key: "hq", label: t.kdhPage.filterHq },
                        { key: "trap1", label: t.kdhPage.filterTrap1 },
                        { key: "trap2", label: t.kdhPage.filterTrap2 },
                    ] as const).map(f => (
                        <button
                            key={f.key}
                            type="button"
                            onClick={() => setFilter(f.key)}
                            className="flex-shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all"
                            style={{
                                background: filter === f.key ? "rgba(6,182,212,0.2)" : "rgba(30,41,59,0.5)",
                                border: filter === f.key ? "1px solid rgba(6,182,212,0.5)" : "1px solid rgba(51,65,85,0.3)",
                                color: filter === f.key ? "#22d3ee" : "#64748b",
                            }}
                        >
                            {f.label}
                        </button>
                    ))}
                    {search && hitIds.length === 0 && (
                        <span className="ml-2 text-[10px] text-red-400 self-center whitespace-nowrap flex-shrink-0">{t.kdhPage.notFound}</span>
                    )}
                    {search && hitIds.length > 0 && (
                        <span className="ml-2 text-[10px] text-cyan-400 self-center font-bold whitespace-nowrap flex-shrink-0">{t.kdhPage.found.replace("{n}", String(hitIds.length))}</span>
                    )}
                </div>

                {/* ── 줌 컨트롤 ── */}
                <div className="flex items-center gap-2 px-3 py-1.5 border-b" style={{ borderColor: "rgba(51,65,85,0.3)" }}>
                    <button onClick={() => setScale(s => Math.min(s + 0.2, 3))}
                        className="w-6 h-6 rounded text-xs font-bold text-slate-400 hover:text-white transition-colors"
                        style={{ background: "rgba(30,41,59,0.6)", border: "1px solid rgba(51,65,85,0.4)" }}>+</button>
                    <button onClick={() => setScale(s => Math.max(s - 0.2, 0.4))}
                        className="w-6 h-6 rounded text-xs font-bold text-slate-400 hover:text-white transition-colors"
                        style={{ background: "rgba(30,41,59,0.6)", border: "1px solid rgba(51,65,85,0.4)" }}>−</button>
                    <span className="text-[10px] text-slate-600">{Math.round(scale * 100)}%</span>
                    <button onClick={() => {
                        setScale(1);
                        const el = containerRef.current;
                        if (!el) return;
                        const hq = STRUCTURES[0];
                        const { px, py } = toIso(hq.x, hq.y);
                        const rect = el.getBoundingClientRect();
                        const allC = [toIso(MIN_X, MIN_Y), toIso(MAX_X, MIN_Y), toIso(MIN_X, MAX_Y), toIso(MAX_X, MAX_Y)];
                        const vbX = Math.min(...allC.map(c => c.px)) - 60;
                        const vbY = Math.min(...allC.map(c => c.py)) - 30;
                        setPan({ x: rect.width / 2 - (px - vbX), y: rect.height / 2 - (py - vbY) });
                    }}
                        className="text-[10px] text-slate-500 hover:text-cyan-400 transition-colors ml-1"
                    >{t.kdhPage.zoomReset}</button>
                    <span className="ml-auto text-[9px] text-slate-700">{t.kdhPage.dragHint}</span>
                </div>

                {/* ── 마름모 지도 영역 ── */}
                <div
                    ref={containerRef}
                    className="relative overflow-hidden select-none"
                    style={{
                        height: 380,
                        cursor: isDragging.current ? "grabbing" : "grab",
                        background: "radial-gradient(ellipse at center, rgba(6,182,212,0.03) 0%, transparent 70%)",
                        touchAction: "none",
                    }}
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    onMouseLeave={onMouseUp}
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                >
                    <svg
                        width={svgW}
                        height={svgH}
                        viewBox={`${svgMinX} ${svgMinY} ${svgW} ${svgH}`}
                        style={{
                            position: "absolute",
                            left: pan.x,
                            top: pan.y,
                            transform: `scale(${scale})`,
                            transformOrigin: "0 0",
                        }}
                    >
                        {/* SVG 필터 정의 */}
                        <defs>
                            <filter id="hitGlow" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="4" result="blur" />
                                <feMerge>
                                    <feMergeNode in="blur" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        </defs>
                        {/* 그리드 라인 */}
                        {gridLines}

                        {/* 좌표 라벨 (X축) */}
                        {Array.from({ length: COLS }, (_, i) => i).filter(i => i % 4 === 0).map(i => {
                            const gx = MIN_X + i;
                            const { px, py } = toIso(gx, MAX_Y);
                            return <text key={`lx${i}`} x={px} y={py + 12} fill="rgba(100,116,139,0.6)" fontSize={8} textAnchor="middle" fontFamily="monospace">{gx}</text>;
                        })}
                        {/* 좌표 라벨 (Y축) */}
                        {Array.from({ length: ROWS }, (_, i) => i).filter(i => i % 4 === 0).map(i => {
                            const gy = MIN_Y + i;
                            const { px, py } = toIso(MIN_X, gy);
                            return <text key={`ly${i}`} x={px - 12} y={py + 3} fill="rgba(100,116,139,0.6)" fontSize={8} textAnchor="end" fontFamily="monospace">{gy}</text>;
                        })}

                        {/* 건물 오버레이 */}
                        {STRUCTURES.map(s => {
                            const center = toIso(s.x + s.size / 2 - 0.5, s.y + s.size / 2 - 0.5);
                            const isHQ = s.type === "hq";
                            return (
                                <g key={s.id}
                                    onMouseEnter={e => showTip(s.label, `X:${s.x} Y:${s.y}`, `${s.size}×${s.size} 건물`, e.clientX, e.clientY)}
                                    onMouseLeave={hideTip}
                                    style={{ cursor: "default" }}
                                >
                                    <path
                                        d={diamondPath(center.px, center.py, s.size)}
                                        fill={isHQ ? "rgba(6,182,212,0.25)" : "rgba(245,158,11,0.2)"}
                                        stroke={isHQ ? "#06b6d4" : "#f59e0b"}
                                        strokeWidth={2}
                                    />
                                    {isHQ && <path d={diamondPath(center.px, center.py, s.size)} fill="none" stroke="rgba(6,182,212,0.4)" strokeWidth={4} />}
                                    <text x={center.px} y={center.py + 1} fill={isHQ ? "#7dd3fc" : "#fcd34d"} fontSize={10} fontWeight={700} textAnchor="middle" dominantBaseline="middle">{s.label}</text>
                                </g>
                            );
                        })}

                        {/* 플레이어 오버레이 (2x2 마름모 — 좌표는 오른쪽 셀 기준) */}
                        {filteredPlayers.map(p => {
                            // 2x2 오브젝트: 좌표(X,Y)가 마름모 오른쪽 셀
                            // → 2x2 중심 = toIso(X, Y) (셀 꼭짓점 = 2x2 중심)
                            const center = toIso(p.x, p.y);
                            const isHit = hitIds.includes(p.id);
                            const displayName = p.name.length > 7 ? p.name.slice(0, 6) + "…" : p.name;
                            return (
                                <g key={p.id}
                                    onMouseEnter={e => showTip(p.name, `X:${p.x} Y:${p.y}`, p.memo, e.clientX, e.clientY)}
                                    onMouseLeave={hideTip}
                                    style={{ cursor: "pointer" }}
                                >
                                    {/* 하이라이트: 3중 파동 링 */}
                                    {isHit && (
                                        <>
                                            <path d={diamondPath(center.px, center.py, 3.5)} fill="none" stroke="#fbbf24" strokeWidth={1.5} opacity={0}>
                                                <animate attributeName="opacity" values="0;0.6;0" dur="2s" repeatCount="indefinite" />
                                            </path>
                                            <path d={diamondPath(center.px, center.py, 3)} fill="none" stroke="#22d3ee" strokeWidth={2} opacity={0}>
                                                <animate attributeName="opacity" values="0;0.8;0" dur="2s" begin="0.3s" repeatCount="indefinite" />
                                            </path>
                                            <path d={diamondPath(center.px, center.py, 2.5)} fill="none" stroke="#fbbf24" strokeWidth={2.5} opacity={0}>
                                                <animate attributeName="opacity" values="0.2;1;0.2" dur="1.5s" repeatCount="indefinite" />
                                            </path>
                                        </>
                                    )}
                                    {/* 메인 2x2 다이아몬드 */}
                                    <path
                                        d={diamondPath(center.px, center.py, 2)}
                                        fill={isHit ? "rgba(251,191,36,0.35)" : "rgba(99,102,241,0.2)"}
                                        stroke={isHit ? "#fbbf24" : "rgba(99,102,241,0.6)"}
                                        strokeWidth={isHit ? 2.5 : 1.5}
                                        filter={isHit ? "url(#hitGlow)" : undefined}
                                    />
                                    {/* 이름 */}
                                    <text x={center.px} y={center.py - 2} fill={isHit ? "#fff" : "#a5b4fc"} fontSize={isHit ? 8 : 7} fontWeight={700} textAnchor="middle" dominantBaseline="middle">{displayName}</text>
                                    {/* 하이라이트 좌표 뱃지 */}
                                    {isHit && (
                                        <text x={center.px} y={center.py + 8} fill="#fbbf24" fontSize={6} fontWeight={600} textAnchor="middle" dominantBaseline="middle" fontFamily="monospace">({p.x},{p.y})</text>
                                    )}
                                </g>
                            );
                        })}
                    </svg>
                </div>

                {/* ── 범례 + 플레이어 목록 ── */}
                <div className="border-t px-4 py-3" style={{ borderColor: "rgba(51,65,85,0.4)" }}>
                    <div className="flex items-center gap-3 mb-2.5 flex-wrap">
                        {[
                            { color: "rgba(6,182,212,0.25)", border: "#06b6d4", label: t.kdhPage.legendHq },
                            { color: "rgba(245,158,11,0.2)", border: "#f59e0b", label: t.kdhPage.legendTrap },
                            { color: "rgba(99,102,241,0.2)", border: "rgba(99,102,241,0.6)", label: t.kdhPage.legendUser },
                            { color: "rgba(6,182,212,0.3)", border: "#06b6d4", glow: true, label: t.kdhPage.legendHighlight },
                        ].map(l => (
                            <div key={l.label} className="flex items-center gap-1">
                                <div
                                    style={{
                                        width: 14, height: 9, borderRadius: 2,
                                        background: l.color,
                                        border: `1.5px solid ${l.border}`,
                                        boxShadow: l.glow ? "0 0 5px rgba(6,182,212,0.6)" : "none",
                                        transform: "rotate(45deg)",
                                    }}
                                />
                                <span className="text-[9px] text-slate-500">{l.label}</span>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col gap-1 max-h-28 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
                        {filteredPlayers.length === 0 ? (
                            <p className="text-xs text-slate-600 text-center py-2">해당 구역에 유저 없음</p>
                        ) : filteredPlayers.map(p => {
                            const isHit = hitIds.includes(p.id);
                            return (
                                <div
                                    key={p.id}
                                    className="flex items-center justify-between py-1.5 px-2.5 rounded-lg transition-all"
                                    style={{
                                        background: isHit ? "rgba(6,182,212,0.1)" : "rgba(15,23,42,0.5)",
                                        border: `1px solid ${isHit ? "rgba(6,182,212,0.4)" : "rgba(51,65,85,0.3)"}`,
                                    }}
                                >
                                    <div>
                                        <span className="text-xs font-bold text-slate-200">{p.name}</span>
                                        {p.memo && <span className="ml-1.5 text-[10px] text-slate-500">{p.memo}</span>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-mono text-slate-500">X:{p.x} Y:{p.y}</span>
                                        {isAdmin && (
                                            <button
                                                type="button"
                                                onClick={() => deletePlayer(p.id)}
                                                className="text-[11px] text-slate-700 hover:text-red-400 transition-colors"
                                                title="삭제"
                                            >✕</button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── 유저 추가 모달 ── */}
            {showModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center"
                    style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
                    onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
                >
                    <div
                        className="w-80 rounded-2xl p-6"
                        style={{ background: "#0d1829", border: "1px solid rgba(6,182,212,0.35)", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
                    >
                        <h3 className="text-base font-bold text-cyan-400 mb-4">{t.kdhPage.modalTitle}</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-[11px] text-slate-500 font-bold mb-1">{t.kdhPage.modalName}</label>
                                <input type="text" value={fName} onChange={e => setFName(e.target.value)} placeholder="예: 만두몬mandu"
                                    className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
                                    style={{ background: "rgba(7,13,26,0.8)", border: "1px solid rgba(71,85,105,0.5)" }} />
                            </div>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="block text-[11px] text-slate-500 font-bold mb-1">{t.kdhPage.modalX}</label>
                                    <input type="number" value={fX} onChange={e => setFX(e.target.value)} placeholder="740"
                                        className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
                                        style={{ background: "rgba(7,13,26,0.8)", border: "1px solid rgba(71,85,105,0.5)" }} />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-[11px] text-slate-500 font-bold mb-1">{t.kdhPage.modalY}</label>
                                    <input type="number" value={fY} onChange={e => setFY(e.target.value)} placeholder="755"
                                        className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
                                        style={{ background: "rgba(7,13,26,0.8)", border: "1px solid rgba(71,85,105,0.5)" }} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[11px] text-slate-500 font-bold mb-1">{t.kdhPage.modalMemo}</label>
                                <input type="text" value={fMemo} onChange={e => setFMemo(e.target.value)} placeholder="R5, 공격대장..."
                                    className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
                                    style={{ background: "rgba(7,13,26,0.8)", border: "1px solid rgba(71,85,105,0.5)" }} />
                            </div>
                        </div>
                        <div className="flex gap-2 mt-5">
                            <button type="button" onClick={addPlayer}
                                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:brightness-110"
                                style={{ background: "linear-gradient(135deg,#06b6d4,#3b82f6)", color: "#fff" }}>{t.kdhPage.modalAdd}</button>
                            <button type="button" onClick={() => setShowModal(false)}
                                className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white transition-colors"
                                style={{ background: "rgba(30,41,59,0.6)", border: "1px solid rgba(71,85,105,0.4)" }}>{t.kdhPage.modalCancel}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── 툴팁 ── */}
            {tooltip && (
                <div style={{
                    position: "fixed", left: tooltip.x, top: tooltip.y, background: "rgba(13,24,41,0.96)",
                    border: "1px solid rgba(6,182,212,0.3)", borderRadius: 8, padding: "7px 12px", fontSize: 11,
                    color: "#e2e8f0", pointerEvents: "none", zIndex: 9999, boxShadow: "0 8px 24px rgba(0,0,0,0.5)", minWidth: 110,
                }}>
                    <div style={{ fontWeight: 700, color: "#22d3ee", fontSize: 12 }}>{tooltip.name}</div>
                    <div style={{ color: "#64748b", fontSize: 10, fontFamily: "monospace" }}>{tooltip.coord}</div>
                    {tooltip.memo && <div style={{ color: "#94a3b8", fontSize: 10, marginTop: 2 }}>{tooltip.memo}</div>}
                </div>
            )}
        </>
    );
}
