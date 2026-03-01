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
    x: number;   // 중심 X
    y: number;   // 중심 Y
    size: number; // 4=4×4 건물, 1=깃발
    type: "hq" | "trap" | "flag";
}

const DEFAULT_STRUCTURES: Structure[] = [
    { id: "hq", label: "🏰 본부", x: 737, y: 757, size: 4, type: "hq" },
    { id: "trap1", label: "🪤 함정1", x: 730, y: 748, size: 4, type: "trap" },
    { id: "trap2", label: "🪤 함정2", x: 742, y: 752, size: 4, type: "trap" },
    { id: "flag", label: "🚩 깃발", x: 738, y: 757, size: 1, type: "flag" },
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
    // -90° 회전 + 정사각 다이아몬드 (hw = hh = ISO_HALF/2)
    return {
        px: (col + row) * ISO_HALF / 2,
        py: (row - col) * ISO_HALF / 2,
    };
}

/* toIso 역변환: SVG 좌표 (px, py) → 게임 좌표 (gx, gy) */
function fromIso(px: number, py: number) {
    // px = (col+row)*ISO_HALF/2, py = (row-col)*ISO_HALF/2
    // 풀기: col=(px-py)/ISO_HALF, row=(px+py)/ISO_HALF
    const col = (px - py) / ISO_HALF;
    const row = (px + py) / ISO_HALF;
    return {
        gx: col + MIN_X,
        gy: MAX_Y - row,
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

    /* 좌표 테이블 입력 모달 */
    const [showCoordModal, setShowCoordModal] = useState(false);
    const [coordTab, setCoordTab] = useState<"player" | "structure">("player");
    const [coordName, setCoordName] = useState("");
    const [coordMemo, setCoordMemo] = useState("");
    const [coordPairs, setCoordPairs] = useState([
        { x: "", y: "" }, { x: "", y: "" },
        { x: "", y: "" }, { x: "", y: "" },
    ]);
    /* 특수건물 입력 */
    const [structTarget, setStructTarget] = useState<"hq" | "trap1" | "trap2" | "flag">("hq");
    const [structXmin, setStructXmin] = useState("");
    const [structYmin, setStructYmin] = useState("");

    /* Pan & Zoom 상태 */
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const panStart = useRef({ x: 0, y: 0 });
    const lastTouchDist = useRef(0);

    /* 플레이어 드래그 (관리자 전용) */
    const playerDragRef = useRef<{ id: string; startClientX: number; startClientY: number; origGx: number; origGy: number } | null>(null);
    const [dragGamePos, setDragGamePos] = useState<{ id: string; gx: number; gy: number } | null>(null);
    const [hoveredPlayerId, setHoveredPlayerId] = useState<string | null>(null);
    const [isDragEditMode, setIsDragEditMode] = useState(false);
    const panRef = useRef(pan);
    const scaleRef = useRef(scale);
    useEffect(() => { panRef.current = pan; }, [pan]);
    useEffect(() => { scaleRef.current = scale; }, [scale]);

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

    /* 건물(구조옵) 상태 */
    const [structures, setStructures] = useState<Structure[]>(DEFAULT_STRUCTURES);
    const [hoveredStructureId, setHoveredStructureId] = useState<string | null>(null);

    /* localStorage 헬퍼 */
    const STRUCT_KEY = "kdh_structures_v1";
    const saveStructures = (list: Structure[]) => {
        try { localStorage.setItem(STRUCT_KEY, JSON.stringify(list)); } catch { }
    };
    const loadStructures = (): Structure[] | null => {
        try {
            const raw = localStorage.getItem(STRUCT_KEY);
            return raw ? (JSON.parse(raw) as Structure[]) : null;
        } catch { return null; }
    };

    /* Supabase에서 구조물 로드 (실패 시 localStorage → DEFAULT 순으로 fallback) */
    const fetchStructures = useCallback(async () => {
        const { data, error } = await supabase
            .from("kdh_structures")
            .select("*");
        if (!error && data && data.length > 0) {
            const mapped = data.map((d: { struct_id: string; struct_type: string; label: string; x: number; y: number; size: number }) => ({
                id: d.struct_id,
                label: d.label,
                x: d.x,
                y: d.y,
                size: d.size,
                type: d.struct_type as "hq" | "trap" | "flag",
            }));
            setStructures(mapped);
            saveStructures(mapped); // Supabase 데이터 → localStorage 동기화
        } else {
            // Supabase 테이블 없음 → localStorage에서 복원
            const stored = loadStructures();
            if (stored !== null) {
                setStructures(stored);
            }
            // 없으면 DEFAULT_STRUCTURES 유지
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* 구조물 삭제 — localStorage + Supabase 동시 저장 */
    const deleteStructure = async (id: string) => {
        if (!window.confirm("해당 건물을 삭제하시겠어요?")) return;
        // ① Supabase 먼저 삭제
        const { error } = await supabase.from("kdh_structures").delete().eq("struct_id", id);
        if (error) {
            console.error("구조물 삭제 실패:", error.message);
            alert(`삭제 실패: ${error.message}\n\nSupabase SQL Editor에서 아래를 실행해주세요:\nDROP POLICY IF EXISTS "allow_auth_write" ON kdh_structures;\nCREATE POLICY "allow_all_write" ON kdh_structures FOR ALL USING (true) WITH CHECK (true);`);
            return;
        }
        // ② Supabase 성공 → 로컬 + localStorage 반영
        setStructures(prev => {
            const next = prev.filter(s => s.id !== id);
            saveStructures(next);
            return next;
        });
    };

    /* 구조물 Upsert — Supabase 먼저, 성공 시 로컬 반영 */
    const upsertStructure = async (s: Structure) => {
        // ① Supabase 저장
        const { error } = await supabase.from("kdh_structures").upsert({
            struct_id: s.id,
            struct_type: s.type,
            label: s.label,
            x: s.x,
            y: s.y,
            size: s.size,
        }, { onConflict: "struct_id" });
        if (error) {
            console.error("구조물 저장 실패:", error.message);
            // Supabase 실패해도 localStorage에는 저장 (오프라인 fallback)
        }
        // ② 로컬 + localStorage 반영 (Supabase 실패해도 UI는 즉시 반영)
        setStructures(prev => {
            const exists = prev.find(p => p.id === s.id);
            const next = exists ? prev.map(p => p.id === s.id ? s : p) : [...prev, s];
            saveStructures(next);
            return next;
        });
        return true;
    };

    useEffect(() => { fetchPlayers(); fetchStructures(); }, [fetchPlayers, fetchStructures]);


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
        // 2×2 오브젝트 중심 = 좌하단 좌표에서 +0.5 오프셋
        const { px, py } = toIso(p.x + 0.5, p.y + 0.5);
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
        const struct = structures.find((s: Structure) => s.id === filter);
        if (!struct) return players;
        const r = struct.size;
        // 2×2 오브젝트 4개 셀 점유: (x,y) (x+1,y) (x,y+1) (x+1,y+1)
        // 4개 셀 중 하나라도 구조물 범위 안에 있으면 포함
        return players.filter(p => {
            const cells = [
                { x: p.x, y: p.y },
                { x: p.x + 1, y: p.y },
                { x: p.x, y: p.y + 1 },
                { x: p.x + 1, y: p.y + 1 },
            ];
            return cells.some(c =>
                Math.abs(c.x - struct.x) <= r && Math.abs(c.y - struct.y) <= r
            );
        });
    })();

    /* 초기 중앙 정렬 (HQ 기준) */
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const hq = structures.find((s: Structure) => s.type === "hq") ?? structures[0];
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

    /* screen 좌표 → 게임 좌표 변환 */
    const screenToGame = useCallback((clientX: number, clientY: number) => {
        if (!containerRef.current) return null;
        const rect = containerRef.current.getBoundingClientRect();
        const corners = [
            toIso(MIN_X, MIN_Y), toIso(MAX_X, MIN_Y),
            toIso(MIN_X, MAX_Y), toIso(MAX_X, MAX_Y),
        ];
        const vbMinX = Math.min(...corners.map(c => c.px)) - 60;
        const vbMinY = Math.min(...corners.map(c => c.py)) - 30;
        const curPan = panRef.current;
        const curScale = scaleRef.current;
        // screen → SVG 좌표
        const svgPx = (clientX - rect.left - curPan.x) / curScale + vbMinX;
        const svgPy = (clientY - rect.top - curPan.y) / curScale + vbMinY;
        // SVG → 게임 좌표 (좌하단 기준: x-0.5, y-0.5)
        const { gx, gy } = fromIso(svgPx, svgPy);
        return {
            gx: Math.max(MIN_X, Math.min(MAX_X - 1, Math.round(gx - 0.5))),
            gy: Math.max(MIN_Y, Math.min(MAX_Y - 1, Math.round(gy - 0.5))),
        };
    }, []);

    /* ── 마우스 Pan ── */
    const onMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        if (playerDragRef.current) return; // 플레이어 드래그 중에는 패닝 무시
        isDragging.current = true;
        dragStart.current = { x: e.clientX, y: e.clientY };
        panStart.current = { ...pan };
    };
    const onMouseMove = (e: React.MouseEvent) => {
        // 플레이어 드래그 중
        if (playerDragRef.current) {
            const game = screenToGame(e.clientX, e.clientY);
            if (game) setDragGamePos({ id: playerDragRef.current.id, ...game });
            return;
        }
        if (!isDragging.current) return;
        setPan({
            x: panStart.current.x + (e.clientX - dragStart.current.x),
            y: panStart.current.y + (e.clientY - dragStart.current.y),
        });
    };
    const onMouseUp = async () => {
        // 플레이어 드래그 종료 → Supabase 저장
        if (playerDragRef.current && dragGamePos) {
            const { id } = playerDragRef.current;
            const { gx, gy } = dragGamePos;
            const { error } = await supabase
                .from("kdh_players")
                .update({ x: gx, y: gy })
                .eq("id", parseInt(id));
            if (!error) {
                setPlayers(prev => prev.map(p =>
                    p.id === id ? { ...p, x: gx, y: gy } : p
                ));
            }
            playerDragRef.current = null;
            setDragGamePos(null);
            return;
        }
        isDragging.current = false;
    };

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

    /* 2×2 좌표 검증: X 2개 × Y 2개가 연속 블록인지 확인 → x_min, y_min 반환 */
    const validateCoordPairs = () => {
        const parsed = coordPairs.map(p => ({ x: parseInt(p.x), y: parseInt(p.y) }));
        if (parsed.some(p => isNaN(p.x) || isNaN(p.y))) return null;
        const xs = [...new Set(parsed.map(p => p.x))].sort((a, b) => a - b);
        const ys = [...new Set(parsed.map(p => p.y))].sort((a, b) => a - b);
        if (xs.length !== 2 || ys.length !== 2) return null;
        if (xs[1] - xs[0] !== 1 || ys[1] - ys[0] !== 1) return null;
        const allExist = [
            [xs[0], ys[0]], [xs[0], ys[1]], [xs[1], ys[0]], [xs[1], ys[1]],
        ].every(([ex, ey]) => parsed.some(p => p.x === ex && p.y === ey));
        if (!allExist) return null;
        return { x: xs[0], y: ys[0] };
    };

    /* 좌표 테이블 모달로 등록 */
    const addPlayerFromCoords = async () => {
        const name = coordName.trim();
        if (!name) { alert("연맹원 ID를 입력하세요"); return; }
        const result = validateCoordPairs();
        if (!result) {
            alert("올바른 2×2 좌표 4개를 입력하세요.\n(연속된 X 2개 × Y 2개 조합)");
            return;
        }
        const { error } = await supabase.from("kdh_players").insert({
            name, x: result.x, y: result.y, memo: coordMemo.trim() || null,
        });
        if (error) { alert(t.kdhPage.addFailed + error.message); return; }
        setCoordName(""); setCoordMemo("");
        setCoordPairs([{ x: "", y: "" }, { x: "", y: "" }, { x: "", y: "" }, { x: "", y: "" }]);
        setShowCoordModal(false);
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
        const note = "# 좌표 기준: 2×2 오브젝트의 좌하단(최소) X,Y 좌표를 입력하세요\n# 예시) 오브젝트가 (736,752)(737,752)(736,753)(737,753) 점유 시 → X:736 Y:752";
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
        // 정사각 다이아몬드: hw = hh = ISO_HALF/2 (45° 탑뷰 스타일)
        const hw = sz * ISO_HALF / 2;
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
                                    const hq = structures.find((s: Structure) => s.type === "hq") ?? structures[0];
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
                        <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                            {/* 관리자 레이블 배지 */}
                            <span
                                className="text-[10px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap flex-shrink-0"
                                style={{ background: "rgba(51,65,85,0.5)", color: "#64748b", border: "1px solid rgba(51,65,85,0.6)" }}
                            >
                                관리자
                            </span>
                            {/* 구분선 */}
                            <div className="h-4 w-px flex-shrink-0" style={{ background: "rgba(51,65,85,0.6)" }} />
                            {/* 📍 좌표 입력 */}
                            <button
                                type="button"
                                onClick={() => setShowCoordModal(true)}
                                className="h-7 px-3 rounded-lg text-[11px] font-semibold transition-all hover:brightness-125 active:scale-95 whitespace-nowrap flex-shrink-0 flex items-center gap-1"
                                style={{ background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.4)", color: "#c4b5fd" }}
                            >
                                📍 좌표 입력
                            </button>
                            {/* 🗑️ 건물 삭제 — HTML 버튼으로 SVG 이벤트 충돌 방지 */}
                            <div className="relative flex-shrink-0">
                                <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-slate-600 font-bold whitespace-nowrap">🗑️ 건물:</span>
                                    {structures.map((s: Structure) => (
                                        <button
                                            key={s.id}
                                            type="button"
                                            onClick={() => deleteStructure(s.id)}
                                            className="h-6 px-2 rounded-md text-[10px] font-semibold transition-all hover:brightness-125 active:scale-95 flex items-center gap-0.5 whitespace-nowrap"
                                            style={{
                                                background: "rgba(239,68,68,0.12)",
                                                border: "1px solid rgba(239,68,68,0.3)",
                                                color: "#fca5a5",
                                            }}
                                            title={`${s.label} 삭제`}
                                        >
                                            {s.label} <span style={{ color: "#ef4444", fontWeight: 900 }}>✕</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* 구분선 */}
                            <div className="h-4 w-px flex-shrink-0" style={{ background: "rgba(51,65,85,0.6)" }} />
                            {/* ✌️ 드래그 편집 / ✓ 편집완료 토글 */}
                            {!isDragEditMode ? (
                                <button
                                    type="button"
                                    onClick={() => setIsDragEditMode(true)}
                                    className="h-7 px-3 rounded-lg text-[11px] font-semibold transition-all hover:brightness-125 active:scale-95 whitespace-nowrap flex-shrink-0 flex items-center gap-1"
                                    style={{ background: "rgba(6,182,212,0.12)", border: "1px solid rgba(6,182,212,0.35)", color: "#22d3ee" }}
                                >
                                    ✌️ 드래그 편집
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsDragEditMode(false);
                                        playerDragRef.current = null;
                                        setDragGamePos(null);
                                    }}
                                    className="h-7 px-3 rounded-lg text-[11px] font-bold transition-all hover:brightness-125 active:scale-95 whitespace-nowrap flex-shrink-0 flex items-center gap-1"
                                    style={{ background: "rgba(34,197,94,0.2)", border: "1px solid rgba(34,197,94,0.5)", color: "#4ade80" }}
                                >
                                    ✓ 편집완료
                                </button>
                            )}
                        </div>
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
                        const hq = structures.find((s: Structure) => s.type === "hq") ?? structures[0];
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
                {/* 드래그 편집 모드 배너 */}
                {isAdmin && isDragEditMode && (
                    <div
                        className="flex items-center justify-between px-4 py-2 text-[11px] font-semibold"
                        style={{ background: "rgba(6,182,212,0.12)", borderBottom: "1px solid rgba(6,182,212,0.3)", color: "#22d3ee" }}
                    >
                        <span>✌️ 드래그 편집 모드 — 플레이어를 끌어서 이동하세요</span>
                        <button
                            type="button"
                            onClick={() => { setIsDragEditMode(false); playerDragRef.current = null; setDragGamePos(null); }}
                            className="h-6 px-3 rounded-md text-[10px] font-bold transition-all hover:brightness-125"
                            style={{ background: "rgba(34,197,94,0.2)", border: "1px solid rgba(34,197,94,0.4)", color: "#4ade80" }}
                        >✓ 편집완료</button>
                    </div>
                )}
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
                        {structures.map((s: Structure) => {
                            const isHQ = s.type === "hq";
                            const isFlag = s.type === "flag";
                            const isTrap = s.type === "trap";
                            const center = toIso(s.x, s.y);
                            const isStructHovered = hoveredStructureId === s.id;
                            // 툴팁 텍스트 생성
                            let tipDetail = `${s.size}×${s.size} 건물`;
                            if (isFlag) tipDetail = "깃발 (1×1)";
                            return (
                                <g key={s.id}
                                    onMouseEnter={e => { setHoveredStructureId(s.id); showTip(s.label, `X:${s.x} Y:${s.y}`, tipDetail, e.clientX, e.clientY); }}
                                    onMouseLeave={() => { setHoveredStructureId(null); hideTip(); }}
                                    style={{ cursor: isAdmin ? "pointer" : "default" }}
                                >
                                    {isFlag ? (
                                        /* 깃발: 작은 다이아몬드 */
                                        <path
                                            d={diamondPath(center.px, center.py, 1.2)}
                                            fill="rgba(239,68,68,0.35)"
                                            stroke="#ef4444"
                                            strokeWidth={2}
                                        />
                                    ) : (
                                        <>
                                            <path
                                                d={diamondPath(center.px, center.py, s.size)}
                                                fill={isHQ ? "rgba(6,182,212,0.25)" : isTrap ? "rgba(245,158,11,0.2)" : "rgba(99,102,241,0.2)"}
                                                stroke={isHQ ? "#06b6d4" : isTrap ? "#f59e0b" : "#a5b4fc"}
                                                strokeWidth={2}
                                            />
                                            {isHQ && <path d={diamondPath(center.px, center.py, s.size)} fill="none" stroke="rgba(6,182,212,0.4)" strokeWidth={4} />}
                                        </>
                                    )}
                                    <text x={center.px} y={center.py + 1}
                                        fill={isHQ ? "#7dd3fc" : isFlag ? "#fca5a5" : "#fcd34d"}
                                        fontSize={isFlag ? 9 : 10} fontWeight={700}
                                        textAnchor="middle" dominantBaseline="middle"
                                    >{s.label}</text>
                                    {/* 관리자 모드: 건물 클릭 시 삭제는 툴바 버튼으로 처리 */}
                                </g>
                            );
                        })}

                        {/* 플레이어 오버레이 (2×2 오브젝트 — x,y는 좌하단 최소좌표 기준) */}
                        {filteredPlayers.map(p => {
                            // 드래그 중이면 dragGamePos 위치로 오버라이드
                            const activePosX = (dragGamePos?.id === p.id) ? dragGamePos.gx : p.x;
                            const activePosY = (dragGamePos?.id === p.id) ? dragGamePos.gy : p.y;
                            const center = toIso(activePosX + 0.5, activePosY + 0.5);
                            const isHit = hitIds.includes(p.id);
                            const isDraggingThis = dragGamePos?.id === p.id;
                            const isHovered = hoveredPlayerId === p.id;
                            const displayName = p.name.length > 7 ? p.name.slice(0, 6) + "…" : p.name;
                            return (
                                <g key={p.id}
                                    onMouseEnter={e => {
                                        setHoveredPlayerId(p.id);
                                        showTip(p.name, `X:${p.x}~${p.x + 1}  Y:${p.y}~${p.y + 1}`, p.memo, e.clientX, e.clientY);
                                    }}
                                    onMouseLeave={() => {
                                        setHoveredPlayerId(null);
                                        hideTip();
                                    }}
                                    style={{ cursor: isAdmin && isDragEditMode ? (isDraggingThis ? "grabbing" : "grab") : "pointer" }}
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
                                    {/* 메인 2×2 다이아몬드 */}
                                    <path
                                        d={diamondPath(center.px, center.py, 2)}
                                        fill={
                                            isDraggingThis ? "rgba(34,211,238,0.35)" :
                                                isHit ? "rgba(251,191,36,0.35)" : "rgba(99,102,241,0.2)"
                                        }
                                        stroke={
                                            isDraggingThis ? "#22d3ee" :
                                                isHit ? "#fbbf24" : "rgba(99,102,241,0.6)"
                                        }
                                        strokeWidth={isDraggingThis ? 2.5 : isHit ? 2.5 : 1.5}
                                        strokeDasharray={isDraggingThis ? "4 2" : undefined}
                                        filter={isHit ? "url(#hitGlow)" : undefined}
                                        onMouseDown={isAdmin && isDragEditMode ? (e) => {
                                            e.stopPropagation();
                                            hideTip();
                                            playerDragRef.current = {
                                                id: p.id,
                                                startClientX: e.clientX,
                                                startClientY: e.clientY,
                                                origGx: p.x,
                                                origGy: p.y,
                                            };
                                            setDragGamePos({ id: p.id, gx: p.x, gy: p.y });
                                        } : undefined}
                                    />
                                    {/* 이름 */}
                                    <text x={center.px} y={center.py - 2} fill={isDraggingThis ? "#22d3ee" : isHit ? "#fff" : "#a5b4fc"} fontSize={isHit ? 8 : 7} fontWeight={700} textAnchor="middle" dominantBaseline="middle">{displayName}</text>
                                    {/* 하이라이트 좌표 배지 — 다이아몰드 아래 pill 스타일 */}
                                    {isHit && (() => {
                                        const label = `X ${activePosX}~${activePosX + 1}  Y ${activePosY}~${activePosY + 1}`;
                                        const bw = label.length * 4.6 + 12;
                                        const bh = 14;
                                        const by = center.py + 22;
                                        return (
                                            <g>
                                                <rect x={center.px - bw / 2} y={by - bh / 2} width={bw} height={bh}
                                                    rx={4} ry={4}
                                                    fill="rgba(10,18,35,0.88)" stroke="#fbbf24" strokeWidth={1}
                                                />
                                                <text x={center.px} y={by} fill="#fde68a" fontSize={7.5} fontWeight={700}
                                                    textAnchor="middle" dominantBaseline="middle" fontFamily="monospace"
                                                >{label}</text>
                                            </g>
                                        );
                                    })()}
                                    {/* 드래그 중 좌표 표시 — pill 스타일 */}
                                    {isDraggingThis && (() => {
                                        const label = `X ${activePosX}~${activePosX + 1}  Y ${activePosY}~${activePosY + 1}`;
                                        const bw = label.length * 4.6 + 12;
                                        const bh = 14;
                                        const by = center.py + 22;
                                        return (
                                            <g>
                                                <rect x={center.px - bw / 2} y={by - bh / 2} width={bw} height={bh}
                                                    rx={4} ry={4}
                                                    fill="rgba(10,18,35,0.9)" stroke="#22d3ee" strokeWidth={1}
                                                />
                                                <text x={center.px} y={by} fill="#67e8f9" fontSize={7.5} fontWeight={700}
                                                    textAnchor="middle" dominantBaseline="middle" fontFamily="monospace"
                                                >{label}</text>
                                            </g>
                                        );
                                    })()}
                                    {/* 삭제 버튼 (관리자 hover 시) */}
                                    {isAdmin && isHovered && !isDraggingThis && (
                                        <g
                                            onClick={e => { e.stopPropagation(); deletePlayer(p.id); }}
                                            style={{ cursor: "pointer" }}
                                        >
                                            <circle cx={center.px + 12} cy={center.py - 12} r={7} fill="rgba(239,68,68,0.9)" stroke="#fff" strokeWidth={1} />
                                            <text x={center.px + 12} y={center.py - 12} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="white" fontWeight={900}>×</text>
                                        </g>
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
                                        <span className="text-[10px] font-mono text-slate-500">X:{p.x}~{p.x + 1} Y:{p.y}~{p.y + 1}</span>
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

            {/* ── 좌표 테이블 입력 모달 ── */}
            {showCoordModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center"
                    style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}
                    onClick={e => { if (e.target === e.currentTarget) setShowCoordModal(false); }}
                >
                    <div
                        className="w-[420px] rounded-2xl p-6"
                        style={{ background: "#0d1829", border: "1px solid rgba(139,92,246,0.4)", boxShadow: "0 24px 64px rgba(0,0,0,0.7)", maxHeight: "90vh", overflowY: "auto" }}
                    >
                        <h3 className="text-base font-bold mb-3" style={{ color: "#c4b5fd" }}>📍 좌표 입력</h3>

                        {/* 탭 선택 */}
                        <div className="flex gap-1 mb-5 rounded-xl p-1" style={{ background: "rgba(15,23,42,0.8)" }}>
                            {(["player", "structure"] as const).map(tab => (
                                <button
                                    key={tab}
                                    type="button"
                                    onClick={() => setCoordTab(tab)}
                                    className="flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                                    style={{
                                        background: coordTab === tab ? "rgba(139,92,246,0.3)" : "transparent",
                                        color: coordTab === tab ? "#c4b5fd" : "#64748b",
                                        border: coordTab === tab ? "1px solid rgba(139,92,246,0.4)" : "1px solid transparent",
                                    }}
                                >
                                    {tab === "player" ? "👤 연맹원" : "🏰 특수건물"}
                                </button>
                            ))}
                        </div>

                        {/* ── 연맹원 탭 ── */}
                        {coordTab === "player" && (
                            <>
                                <p className="text-[11px] text-slate-500 mb-4">2×2 오브제트의 4개 좌표쌍을 모두 입력하세요</p>
                                {/* 이름 */}
                                <div className="mb-4">
                                    <label className="block text-[11px] text-slate-500 font-bold mb-1">연맹원 ID</label>
                                    <input
                                        type="text" value={coordName}
                                        onChange={e => setCoordName(e.target.value)}
                                        placeholder="예: Halley's_헬리혜성"
                                        className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
                                        style={{ background: "rgba(7,13,26,0.8)", border: "1px solid rgba(71,85,105,0.5)" }}
                                    />
                                </div>
                                {/* 좌표 테이블 */}
                                <div className="rounded-xl overflow-hidden border mb-3" style={{ borderColor: "rgba(139,92,246,0.3)" }}>
                                    <div className="grid text-[10px] font-bold px-3 py-2 border-b"
                                        style={{ gridTemplateColumns: "2.5rem 1fr 5rem 5rem", background: "rgba(139,92,246,0.12)", borderColor: "rgba(139,92,246,0.25)", color: "#c4b5fd" }}
                                    >
                                        <span className="text-center">No</span><span className="pl-1">ID</span>
                                        <span className="text-center">X</span><span className="text-center">Y</span>
                                    </div>
                                    {coordPairs.map((pair, idx) => (
                                        <div key={idx} className="grid items-center px-3 py-2 border-b"
                                            style={{ gridTemplateColumns: "2.5rem 1fr 5rem 5rem", borderColor: "rgba(51,65,85,0.25)", background: idx % 2 === 0 ? "rgba(7,13,26,0.6)" : "rgba(15,23,42,0.3)" }}
                                        >
                                            {idx === 0 ? <span className="text-[10px] text-slate-500 text-center font-mono">1</span> : <span />}
                                            {idx === 0 ? <span className="text-[11px] pl-1 truncate font-medium" style={{ color: "#a78bfa" }}>{coordName || "—"}</span> : <span />}
                                            <input type="number" value={pair.x}
                                                onChange={e => { const u = [...coordPairs]; u[idx] = { ...u[idx], x: e.target.value }; setCoordPairs(u); }}
                                                placeholder="745"
                                                className="text-center text-xs text-white rounded-md px-1 py-1.5 outline-none mx-1"
                                                style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.3)" }}
                                            />
                                            <input type="number" value={pair.y}
                                                onChange={e => { const u = [...coordPairs]; u[idx] = { ...u[idx], y: e.target.value }; setCoordPairs(u); }}
                                                placeholder="753"
                                                className="text-center text-xs text-white rounded-md px-1 py-1.5 outline-none mx-1"
                                                style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.3)" }}
                                            />
                                        </div>
                                    ))}
                                </div>
                                {/* 유효성 프리뷰 */}
                                {coordPairs.every(p => p.x && p.y) && (() => {
                                    const result = validateCoordPairs();
                                    return result ? (
                                        <div className="text-[10px] rounded-lg px-3 py-2 mb-3 flex items-center gap-2"
                                            style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", color: "#34d399" }}
                                        >
                                            <span>✓ 유효한 2×2 좌표</span>
                                            <span className="font-mono ml-auto" style={{ color: "#6ee7b7" }}>저장 기준 → X:{result.x} Y:{result.y}</span>
                                        </div>
                                    ) : (
                                        <div className="text-[10px] rounded-lg px-3 py-2 mb-3"
                                            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}
                                        >✗ X 2개 · Y 2개가 각각 연속(차이=1)되어야 합니다</div>
                                    );
                                })()}
                                {/* 메모 */}
                                <div className="mb-5">
                                    <label className="block text-[11px] text-slate-500 font-bold mb-1">메모 (선택)</label>
                                    <input type="text" value={coordMemo} onChange={e => setCoordMemo(e.target.value)}
                                        placeholder="R5, 공격대장..."
                                        className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
                                        style={{ background: "rgba(7,13,26,0.8)", border: "1px solid rgba(71,85,105,0.5)" }}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button type="button" onClick={addPlayerFromCoords}
                                        className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:brightness-110"
                                        style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "#fff" }}
                                    >등록</button>
                                    <button type="button" onClick={() => setShowCoordModal(false)}
                                        className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white transition-colors"
                                        style={{ background: "rgba(30,41,59,0.6)", border: "1px solid rgba(71,85,105,0.4)" }}
                                    >취소</button>
                                </div>
                            </>
                        )}

                        {/* ── 특수건물 탭 ── */}
                        {coordTab === "structure" && (() => {
                            const STRUCT_OPTS = [
                                { id: "hq" as const, label: "🏰 평원 본부", type: "hq" as const, size: 4 },
                                { id: "trap1" as const, label: "🩤 곰덟 함정숴1", type: "trap" as const, size: 4 },
                                { id: "trap2" as const, label: "🩤 곰덟 함정숴2", type: "trap" as const, size: 4 },
                                { id: "flag" as const, label: "🚩 깃발", type: "flag" as const, size: 1 },
                            ];
                            const sel = STRUCT_OPTS.find(o => o.id === structTarget)!;
                            const isFlag = sel.size === 1;
                            const xn = parseInt(structXmin);
                            const yn = parseInt(structYmin);
                            const validInputs = !isNaN(xn) && !isNaN(yn);
                            // 4×4 건물: 중심 = xmin+2, ymin+2
                            // 깃발: 중심 = xmin, ymin
                            const cx = isFlag ? xn : xn + 2;
                            const cy = isFlag ? yn : yn + 2;

                            const save = async () => {
                                if (!validInputs) return;
                                const ok = await upsertStructure({
                                    id: sel.id,
                                    label: sel.label,
                                    x: cx,
                                    y: cy,
                                    size: sel.size,
                                    type: sel.type,
                                });
                                if (ok) { setStructXmin(""); setStructYmin(""); setShowCoordModal(false); }
                            };

                            return (
                                <>
                                    <p className="text-[11px] text-slate-500 mb-4">건물 종류를 선택하고 최소(xmin, ymin) 좌표를 입력하세요</p>
                                    {/* 건물 종류 선택 */}
                                    <div className="grid grid-cols-2 gap-2 mb-4">
                                        {STRUCT_OPTS.map(o => (
                                            <button
                                                key={o.id}
                                                type="button"
                                                onClick={() => setStructTarget(o.id)}
                                                className="py-2 rounded-xl text-[11px] font-bold transition-all hover:brightness-110"
                                                style={{
                                                    background: structTarget === o.id ? "rgba(139,92,246,0.25)" : "rgba(15,23,42,0.6)",
                                                    border: structTarget === o.id ? "1px solid rgba(139,92,246,0.5)" : "1px solid rgba(51,65,85,0.4)",
                                                    color: structTarget === o.id ? "#c4b5fd" : "#64748b",
                                                }}
                                            >{o.label}</button>
                                        ))}
                                    </div>
                                    {/* 좌표 입력 */}
                                    <div className="rounded-xl p-4 mb-3" style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(51,65,85,0.5)" }}>
                                        <p className="text-[10px] text-slate-600 mb-3">
                                            {isFlag ? "깃발 좌표 (1×1)" : `${sel.label} 최소 좌표 — 건물이 점유하는 ${sel.size * sel.size}개 셀의 좌하단 좌표`}
                                        </p>
                                        <div className="flex gap-3">
                                            <div className="flex-1">
                                                <label className="block text-[10px] text-slate-500 mb-1">X최소</label>
                                                <input type="number" value={structXmin} onChange={e => setStructXmin(e.target.value)}
                                                    placeholder="735"
                                                    className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none text-center"
                                                    style={{ background: "rgba(7,13,26,0.8)", border: "1px solid rgba(139,92,246,0.4)" }}
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-[10px] text-slate-500 mb-1">Y최소</label>
                                                <input type="number" value={structYmin} onChange={e => setStructYmin(e.target.value)}
                                                    placeholder="755"
                                                    className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none text-center"
                                                    style={{ background: "rgba(7,13,26,0.8)", border: "1px solid rgba(139,92,246,0.4)" }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    {/* 프리뷰 */}
                                    {validInputs && (
                                        <div className="rounded-xl p-3 mb-4 text-[10px]" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", color: "#34d399" }}>
                                            <p className="font-bold mb-1">✓ {sel.label} 저장 미리보기</p>
                                            {isFlag ? (
                                                <p className="font-mono text-[9px]">X:{xn}  Y:{yn}</p>
                                            ) : (
                                                <>
                                                    <p className="font-mono text-[9px]">X: {xn} ~ {xn + sel.size - 1}  ({sel.size}칸)</p>
                                                    <p className="font-mono text-[9px]">Y: {yn} ~ {yn + sel.size - 1}  ({sel.size}칸)</p>
                                                    <p className="font-mono text-[9px] mt-1" style={{ color: "#6ee7b7" }}>중심 → X:{cx} Y:{cy}</p>
                                                    <div className="mt-2 grid gap-0.5" style={{ gridTemplateColumns: `repeat(${sel.size}, 1fr)` }}>
                                                        {Array.from({ length: sel.size * sel.size }, (_, i) => {
                                                            const col = i % sel.size;
                                                            const row = Math.floor(i / sel.size);
                                                            return (
                                                                <div key={i} className="text-center rounded text-[8px] py-0.5"
                                                                    style={{ background: "rgba(16,185,129,0.15)", color: "#6ee7b7" }}>
                                                                    {xn + col},{yn + row}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                    <div className="flex gap-2">
                                        <button type="button" onClick={save} disabled={!validInputs}
                                            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:brightness-110 disabled:opacity-40"
                                            style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "#fff" }}
                                        >저장</button>
                                        <button type="button" onClick={() => setShowCoordModal(false)}
                                            className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white transition-colors"
                                            style={{ background: "rgba(30,41,59,0.6)", border: "1px solid rgba(71,85,105,0.4)" }}
                                        >취소</button>
                                    </div>
                                </>
                            );
                        })()}
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
