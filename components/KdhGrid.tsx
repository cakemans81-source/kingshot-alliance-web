"use client";

import { useState, useRef, useCallback, useEffect } from "react";

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

const MIN_X = 724, MAX_X = 758;
const MIN_Y = 742, MAX_Y = 770;
const COLS = MAX_X - MIN_X + 1;
const ROWS = MAX_Y - MIN_Y + 1;
const CELL = 22; // px per grid cell

const STORAGE_KEY = "kdh-players-v2";

function toCol(gx: number) { return gx - MIN_X; }
function toRow(gy: number, size: number = 1) { return MAX_Y - (gy + size - 1); } // Y 반전 (입력좌표는 오브젝트의 가장 아래쪽 기준)

/* ═══════════════════════════════════════════
   KdhGrid 컴포넌트
   ═══════════════════════════════════════════ */
export default function KdhGrid() {
    const [players, setPlayers] = useState<Player[]>(() => {
        if (typeof window === "undefined") return INIT_PLAYERS;
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved ? JSON.parse(saved) : INIT_PLAYERS;
        } catch { return INIT_PLAYERS; }
    });

    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<"all" | "hq" | "trap1" | "trap2">("all");
    const [showModal, setShowModal] = useState(false);
    const [tooltip, setTooltip] = useState<{ name: string; coord: string; memo: string; x: number; y: number } | null>(null);

    // 추가 폼 상태
    const [fName, setFName] = useState("");
    const [fX, setFX] = useState("");
    const [fY, setFY] = useState("");
    const [fMemo, setFMemo] = useState("");

    const gridRef = useRef<HTMLDivElement>(null);

    /* 저장 */
    const savePlayers = useCallback((list: Player[]) => {
        setPlayers(list);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* noop */ }
    }, []);

    /* 검색 히트 */
    const hitIds = search
        ? players.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map(p => p.id)
        : [];

    /* 필터 */
    const filteredPlayers = (() => {
        if (filter === "all") return players;
        const struct = STRUCTURES.find(s => s.id === filter)!;
        return players.filter(p =>
            Math.abs(p.x - struct.x) <= 6 && Math.abs(p.y - struct.y) <= 6
        );
    })();

    /* 초기 스크롤: HQ 중심 */
    useEffect(() => {
        const el = gridRef.current;
        if (!el) return;
        const hq = STRUCTURES[0];
        el.scrollLeft = toCol(hq.x) * CELL - 60;
        el.scrollTop = toRow(hq.y, hq.size) * CELL - 40;
    }, []);

    /* 검색 시 첫 히트로 스크롤 */
    useEffect(() => {
        if (hitIds.length === 0) return;
        const p = players.find(pl => pl.id === hitIds[0]);
        if (!p || !gridRef.current) return;
        gridRef.current.scrollLeft = toCol(p.x) * CELL - 60;
        gridRef.current.scrollTop = toRow(p.y, 2) * CELL - 40;
    }, [hitIds, players]);

    /* 유저 추가 */
    const addPlayer = () => {
        const name = fName.trim();
        const x = parseInt(fX);
        const y = parseInt(fY);
        if (!name || isNaN(x) || isNaN(y)) return;
        const newPlayer: Player = { id: "p" + Date.now(), name, x, y, memo: fMemo.trim() };
        savePlayers([...players, newPlayer]);
        setFName(""); setFX(""); setFY(""); setFMemo("");
        setShowModal(false);
    };

    /* 유저 삭제 */
    const deletePlayer = (id: string) => {
        if (!window.confirm("정말 삭제하시겠습니까?")) return;
        savePlayers(players.filter(p => p.id !== id));
    };

    /* 툴팁 */
    const showTip = (name: string, coord: string, memo: string, clientX: number, clientY: number) => {
        setTooltip({ name, coord, memo, x: clientX + 10, y: clientY - 10 });
    };
    const hideTip = () => setTooltip(null);

    /* 오버레이 위치 스타일 */
    const overlayStyle = (col: number, row: number, size: number) => ({
        left: col * CELL,
        top: row * CELL,
        width: size * CELL,
        height: size * CELL,
    });

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
                    className="flex items-center justify-between px-4 py-3 border-b flex-wrap gap-2"
                    style={{ borderColor: "rgba(51,65,85,0.45)" }}
                >
                    <div className="flex items-center gap-2">
                        <span className="text-sm">🗺️</span>
                        <h2 className="text-sm font-bold text-slate-200">KDH 연맹 좌표 그리드</h2>
                        <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: "rgba(6,182,212,0.15)", color: "#22d3ee" }}
                        >
                            {players.length}명
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {/* 검색 */}
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="아이디 검색..."
                            className="h-7 rounded-lg px-2.5 text-xs outline-none w-32"
                            style={{
                                background: "rgba(7,13,26,0.8)",
                                border: "1px solid rgba(6,182,212,0.3)",
                                color: "#e2e8f0",
                            }}
                        />
                        {/* 추가 버튼 */}
                        <button
                            type="button"
                            onClick={() => setShowModal(true)}
                            className="h-7 px-2.5 rounded-lg text-xs font-bold transition-all hover:brightness-110 active:scale-95"
                            style={{
                                background: "linear-gradient(135deg,#06b6d4,#3b82f6)",
                                color: "#fff",
                            }}
                        >
                            ＋ 추가
                        </button>
                    </div>
                </div>

                {/* ── 필터 탭 ── */}
                <div
                    className="flex gap-1 px-3 py-2 border-b overflow-x-auto"
                    style={{ borderColor: "rgba(51,65,85,0.35)", scrollbarWidth: "none" }}
                >
                    {([
                        { key: "all", label: "🌐 전체" },
                        { key: "hq", label: "🏰 본부 인근" },
                        { key: "trap1", label: "🪤 함정1 인근" },
                        { key: "trap2", label: "🪤 함정2 인근" },
                    ] as const).map(f => (
                        <button
                            key={f.key}
                            type="button"
                            onClick={() => setFilter(f.key)}
                            className="flex-shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all"
                            style={{
                                background: filter === f.key
                                    ? "rgba(6,182,212,0.2)"
                                    : "rgba(30,41,59,0.5)",
                                border: filter === f.key
                                    ? "1px solid rgba(6,182,212,0.5)"
                                    : "1px solid rgba(51,65,85,0.3)",
                                color: filter === f.key ? "#22d3ee" : "#64748b",
                            }}
                        >
                            {f.label}
                        </button>
                    ))}

                    {/* 검색 없음 메시지 */}
                    {search && hitIds.length === 0 && (
                        <span className="ml-2 text-[10px] text-red-400 self-center">😔 찾을 수 없음</span>
                    )}
                </div>

                {/* ── 그리드 ── */}
                <div
                    ref={gridRef}
                    className="overflow-auto"
                    style={{ height: 220, scrollbarWidth: "thin" }}
                >
                    <div style={{ padding: "16px 24px 16px 32px" }}>
                        {/* 좌표 그리드 컨테이너 */}
                        <div
                            style={{
                                position: "relative",
                                width: COLS * CELL,
                                height: ROWS * CELL,
                                backgroundImage: `
                                    linear-gradient(rgba(51,65,85,0.22) 1px, transparent 1px),
                                    linear-gradient(90deg, rgba(51,65,85,0.22) 1px, transparent 1px)
                                `,
                                backgroundSize: `${CELL}px ${CELL}px`,
                                border: "1px solid rgba(51,65,85,0.3)",
                                borderRadius: 4,
                            }}
                        >
                            {/* X축 레이블 */}
                            {Array.from({ length: COLS }, (_, c) => c).filter(c => c % 3 === 0).map(c => (
                                <span
                                    key={c}
                                    style={{
                                        position: "absolute",
                                        left: c * CELL + 2,
                                        top: -14,
                                        fontSize: 8,
                                        color: "rgba(100,116,139,0.7)",
                                        fontFamily: "monospace",
                                        whiteSpace: "nowrap",
                                        pointerEvents: "none",
                                    }}
                                >
                                    {MIN_X + c}
                                </span>
                            ))}
                            {/* Y축 레이블 */}
                            {Array.from({ length: ROWS }, (_, r) => r).filter(r => r % 3 === 0).map(r => (
                                <span
                                    key={r}
                                    style={{
                                        position: "absolute",
                                        left: -26,
                                        top: r * CELL + 4,
                                        fontSize: 8,
                                        color: "rgba(100,116,139,0.7)",
                                        fontFamily: "monospace",
                                        pointerEvents: "none",
                                    }}
                                >
                                    {MAX_Y - r}
                                </span>
                            ))}

                            {/* 건물 오버레이 */}
                            {STRUCTURES.map(s => {
                                const col = toCol(s.x);
                                const row = toRow(s.y, s.size);
                                const isHQ = s.type === "hq";
                                return (
                                    <div
                                        key={s.id}
                                        style={{
                                            ...overlayStyle(col, row, s.size),
                                            position: "absolute",
                                            borderRadius: 4,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: 9,
                                            fontWeight: 700,
                                            textAlign: "center",
                                            cursor: "default",
                                            background: isHQ
                                                ? "linear-gradient(135deg,rgba(6,182,212,0.3),rgba(99,102,241,0.3))"
                                                : "linear-gradient(135deg,rgba(245,158,11,0.3),rgba(239,68,68,0.2))",
                                            border: `2px solid ${isHQ ? "rgba(6,182,212,0.7)" : "rgba(245,158,11,0.6)"}`,
                                            color: isHQ ? "#7dd3fc" : "#fcd34d",
                                            boxShadow: isHQ ? "0 0 12px rgba(6,182,212,0.25)" : "none",
                                            zIndex: 2,
                                        }}
                                        onMouseEnter={e => showTip(s.label, `X:${s.x}, Y:${s.y}`, `${s.size}×${s.size} 건물`, e.clientX, e.clientY)}
                                        onMouseLeave={hideTip}
                                    >
                                        {s.label}
                                    </div>
                                );
                            })}

                            {/* 플레이어 오버레이 */}
                            {filteredPlayers.map(p => {
                                const col = toCol(p.x);
                                const row = toRow(p.y, 2);
                                const isHit = hitIds.includes(p.id);
                                return (
                                    <div
                                        key={p.id}
                                        style={{
                                            ...overlayStyle(col, row, 2),
                                            position: "absolute",
                                            borderRadius: 4,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: 7,
                                            fontWeight: 700,
                                            textAlign: "center",
                                            overflow: "hidden",
                                            cursor: "pointer",
                                            background: isHit ? "rgba(6,182,212,0.2)" : "rgba(20,30,50,0.85)",
                                            border: `1.5px solid ${isHit ? "#06b6d4" : "rgba(99,102,241,0.5)"}`,
                                            color: isHit ? "#fff" : "#a5b4fc",
                                            boxShadow: isHit
                                                ? "0 0 0 3px rgba(6,182,212,0.3), 0 0 14px rgba(6,182,212,0.5)"
                                                : "none",
                                            animation: isHit ? "kdhPulse 1.2s ease-in-out infinite" : "none",
                                            zIndex: isHit ? 10 : 3,
                                            padding: 1,
                                            lineHeight: 1.1,
                                        }}
                                        onMouseEnter={e => showTip(p.name, `X:${p.x}, Y:${p.y}`, p.memo, e.clientX, e.clientY)}
                                        onMouseLeave={hideTip}
                                    >
                                        {p.name.length > 6 ? p.name.slice(0, 5) + "…" : p.name}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* ── 범례 + 플레이어 목록 ── */}
                <div
                    className="border-t px-4 py-3"
                    style={{ borderColor: "rgba(51,65,85,0.4)" }}
                >
                    {/* 범례 */}
                    <div className="flex items-center gap-3 mb-2.5 flex-wrap">
                        {[
                            { color: "rgba(6,182,212,0.5)", border: "#06b6d4", label: "본부 HQ" },
                            { color: "rgba(245,158,11,0.35)", border: "#f59e0b", label: "함정" },
                            { color: "rgba(20,30,50,0.85)", border: "rgba(99,102,241,0.5)", label: "유저 (2×2)" },
                            { color: "rgba(6,182,212,0.2)", border: "#06b6d4", glow: true, label: "검색 강조" },
                        ].map(l => (
                            <div key={l.label} className="flex items-center gap-1">
                                <div
                                    style={{
                                        width: 14, height: 9, borderRadius: 2,
                                        background: l.color,
                                        border: `1.5px solid ${l.border}`,
                                        boxShadow: l.glow ? "0 0 5px rgba(6,182,212,0.6)" : "none",
                                    }}
                                />
                                <span className="text-[9px] text-slate-500">{l.label}</span>
                            </div>
                        ))}
                    </div>

                    {/* 플레이어 목록 (스크롤) */}
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
                                        <button
                                            type="button"
                                            onClick={() => deletePlayer(p.id)}
                                            className="text-[11px] text-slate-700 hover:text-red-400 transition-colors"
                                            title="삭제"
                                        >
                                            ✕
                                        </button>
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
                        style={{
                            background: "#0d1829",
                            border: "1px solid rgba(6,182,212,0.35)",
                            boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
                        }}
                    >
                        <h3 className="text-base font-bold text-cyan-400 mb-4">➕ 유저 추가</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-[11px] text-slate-500 font-bold mb-1">게임 아이디</label>
                                <input
                                    type="text"
                                    value={fName}
                                    onChange={e => setFName(e.target.value)}
                                    placeholder="예: 만두몬mandu"
                                    className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
                                    style={{ background: "rgba(7,13,26,0.8)", border: "1px solid rgba(71,85,105,0.5)" }}
                                />
                            </div>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="block text-[11px] text-slate-500 font-bold mb-1">X 좌표</label>
                                    <input
                                        type="number"
                                        value={fX}
                                        onChange={e => setFX(e.target.value)}
                                        placeholder="740"
                                        className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
                                        style={{ background: "rgba(7,13,26,0.8)", border: "1px solid rgba(71,85,105,0.5)" }}
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-[11px] text-slate-500 font-bold mb-1">Y 좌표</label>
                                    <input
                                        type="number"
                                        value={fY}
                                        onChange={e => setFY(e.target.value)}
                                        placeholder="755"
                                        className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
                                        style={{ background: "rgba(7,13,26,0.8)", border: "1px solid rgba(71,85,105,0.5)" }}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[11px] text-slate-500 font-bold mb-1">메모 (선택)</label>
                                <input
                                    type="text"
                                    value={fMemo}
                                    onChange={e => setFMemo(e.target.value)}
                                    placeholder="R5, 공격대장..."
                                    className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
                                    style={{ background: "rgba(7,13,26,0.8)", border: "1px solid rgba(71,85,105,0.5)" }}
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 mt-5">
                            <button
                                type="button"
                                onClick={addPlayer}
                                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:brightness-110"
                                style={{ background: "linear-gradient(135deg,#06b6d4,#3b82f6)", color: "#fff" }}
                            >
                                추가
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white transition-colors"
                                style={{ background: "rgba(30,41,59,0.6)", border: "1px solid rgba(71,85,105,0.4)" }}
                            >
                                취소
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── 툴팁 ── */}
            {tooltip && (
                <div
                    style={{
                        position: "fixed",
                        left: tooltip.x,
                        top: tooltip.y,
                        background: "rgba(13,24,41,0.96)",
                        border: "1px solid rgba(6,182,212,0.3)",
                        borderRadius: 8,
                        padding: "7px 12px",
                        fontSize: 11,
                        color: "#e2e8f0",
                        pointerEvents: "none",
                        zIndex: 9999,
                        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                        minWidth: 110,
                    }}
                >
                    <div style={{ fontWeight: 700, color: "#22d3ee", fontSize: 12 }}>{tooltip.name}</div>
                    <div style={{ color: "#64748b", fontSize: 10, fontFamily: "monospace" }}>{tooltip.coord}</div>
                    {tooltip.memo && <div style={{ color: "#94a3b8", fontSize: 10, marginTop: 2 }}>{tooltip.memo}</div>}
                </div>
            )}

            {/* 애니메이션 키프레임 */}
            <style>{`
                @keyframes kdhPulse {
                    0%, 100% { box-shadow: 0 0 0 3px rgba(6,182,212,0.3), 0 0 14px rgba(6,182,212,0.5); }
                    50%       { box-shadow: 0 0 0 6px rgba(6,182,212,0.15), 0 0 26px rgba(6,182,212,0.7); }
                }
            `}</style>
        </>
    );
}
