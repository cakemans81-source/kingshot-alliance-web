"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { supabase } from "@/lib/supabase/client";

/* ═══════════════════════════════════════════
   타입 & 상수
   ═══════════════════════════════════════════ */
export interface Player {
    id: string;
    name: string;
    x: number;
    y: number;
    memo: string;
}

export interface Structure {
    id: string;
    label: string;
    x: number;   // 중심 X
    y: number;   // 중심 Y
    size: number; // 4=4×4 건물, 1=깃발
    type: "hq" | "trap" | "flag";
}

export interface SimChanges {
    playersAdded: Player[];
    playersUpdated: Player[];
    playersDeleted: string[];
    structuresUpserted: Structure[];
    structuresDeleted: string[];
}

interface KdhGridProps {
    mode?: "live" | "simulation";
    onSimApply?: (players: Player[], structures: Structure[], changes: SimChanges) => Promise<void>;
}

const DEFAULT_STRUCTURES: Structure[] = [
    { id: "hq", label: "🏰 본부", x: 737, y: 757, size: 4, type: "hq" },
    { id: "trap1", label: "🪤 함정1", x: 730, y: 748, size: 4, type: "trap" },
    { id: "trap2", label: "🪤 함정2", x: 742, y: 752, size: 4, type: "trap" },
    { id: "flag1", label: "🚩 깃발1", x: 738, y: 757, size: 1, type: "flag" },
];

const INIT_PLAYERS: Player[] = [
    { id: "p1", name: "만두몬mandu", x: 736, y: 752, memo: "" },
    { id: "p2", name: "jerry", x: 739, y: 760, memo: "" },
    { id: "p3", name: "Nightmare1870", x: 748, y: 750, memo: "" },
];

/* 그리드 범위 — 오른쪽 하단 확장 (MAX_X +50, MIN_Y -30) */
const MIN_X = 689, MAX_X = 941;
const MIN_Y = 682, MAX_Y = 804;
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
export default function KdhGrid({ mode = "live", onSimApply }: KdhGridProps = {}) {
    const isSim = mode === "simulation";
    const { user } = useAuth();
    const { t } = useLocale();
    const isAdmin = user?.role === "admin";

    const [players, setPlayers] = useState<Player[]>(INIT_PLAYERS);
    const [loading, setLoading] = useState(true);

    /* 시뮬레이션 모드: 초기 스냅샷 (diff 계산용) */
    const [simInitialPlayers, setSimInitialPlayers] = useState<Player[] | null>(null);
    const [simInitialStructures, setSimInitialStructures] = useState<Structure[] | null>(null);
    /* 시뮬레이션 임시저장 */
    const SIM_SNAP_KEY = "kdh-sim-snapshot";
    const [simLastSaved, setSimLastSaved] = useState<Date | null>(null);
    const [simSnapRestored, setSimSnapRestored] = useState(false);

    const [search, setSearch] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
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

    /* ── 배치 팝업 (셀 클릭 → 타입 선택 → 연맹원/구조물) ── */
    const [placePopup, setPlacePopup] = useState<{ gx: number; gy: number; sx: number; sy: number } | null>(null);
    const [placeStep, setPlaceStep] = useState<"select" | "member">("select");
    /* 구조물 커서 배치 모드 (마우스 따라가는 3×3 미리보기) */
    const [structCursor, setStructCursor] = useState<{ structType: "trap" | "hq" | "flag"; gx: number; gy: number } | null>(null);
    /* 연맹원 이동 모드 — 더블클릭으로 활성화, 드래그로 이동 */
    const [movingPlayerId, setMovingPlayerId] = useState<string | null>(null);
    const movingPlayerIdRef = useRef<string | null>(null);
    const setMovingPlayerIdSynced = (id: string | null) => {
        movingPlayerIdRef.current = id;
        setMovingPlayerId(id);
    };
    /* 구조물 이동 모드 — 더블클릭으로 활성화, 드래그로 이동 */
    const [movingStructureId, setMovingStructureId] = useState<string | null>(null);
    const movingStructureIdRef = useRef<string | null>(null);
    const setMovingStructureIdSynced = (id: string | null) => {
        movingStructureIdRef.current = id;
        setMovingStructureId(id);
    };
    const lastStructClickRef = useRef<{ id: string; time: number } | null>(null);
    const structHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const structDragRef = useRef<{ id: string; origGx: number; origGy: number; size: number; type: "hq" | "trap" | "flag"; label: string } | null>(null);
    const [dragStructPos, setDragStructPos] = useState<{ id: string; gx: number; gy: number } | null>(null);
    const dragStructPosRef = useRef<{ id: string; gx: number; gy: number } | null>(null);
    const setDragStructPosSynced = (pos: { id: string; gx: number; gy: number } | null) => {
        dragStructPosRef.current = pos;
        setDragStructPos(pos);
    };
    /* 더블클릭 후 팝업이 열리지 않도록 억제 */
    const suppressPopupRef = useRef(false);
    /* 더블클릭 감지용: 마지막 클릭 시간 + 플레이어 ID */
    const lastPlayerClickRef = useRef<{ id: string; time: number } | null>(null);
    /* 등록 폼 공통 입력 */
    const [clickName, setClickName] = useState("");
    const [clickMemo, setClickMemo] = useState("");
    const clickNameRef = useRef<HTMLInputElement>(null);

    /* Pan & Zoom 상태 */
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const panStart = useRef({ x: 0, y: 0 });
    const lastTouchDist = useRef(0);
    const lastTouchMid = useRef({ x: 0, y: 0 }); // 핀치 중심점 추적

    const playerDragRef = useRef<{ id: string; startClientX: number; startClientY: number; origGx: number; origGy: number } | null>(null);
    const [dragGamePos, setDragGamePos] = useState<{ id: string; gx: number; gy: number } | null>(null);
    const dragGamePosRef = useRef<{ id: string; gx: number; gy: number } | null>(null); // stale closure 방지
    const setDragGamePosSynced = (pos: { id: string; gx: number; gy: number } | null) => {
        dragGamePosRef.current = pos;
        setDragGamePos(pos);
    };
    const [hoveredPlayerId, setHoveredPlayerId] = useState<string | null>(null);
    const [isDragEditMode, setIsDragEditMode] = useState(false);
    const panRef = useRef(pan);
    const scaleRef = useRef(scale);
    useEffect(() => { panRef.current = pan; }, [pan]);
    useEffect(() => { scaleRef.current = scale; }, [scale]);

    /* 화면 크기 반응형 (모바일 vs PC) */
    const [isMobile, setIsMobile] = useState(false);
    const [gridHeight, setGridHeight] = useState(380);
    useEffect(() => {
        const update = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            // 모바일: 화면 높이의 약 58% (네비바 + 컨트롤 영역 제외)
            // PC: 고정 380px
            setGridHeight(mobile ? Math.round(window.innerHeight * 0.58) : 380);
        };
        update();
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, []);

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
                // 레거시 id="flag" → "flag1" 마이그레이션
                id: d.struct_id === "flag" ? "flag1" : d.struct_id,
                label: d.label === "🚩 깃발" ? "🚩 깃발1" : d.label,
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
                // 레거시 id="flag" → "flag1" 마이그레이션
                const migrated = stored.map(s =>
                    s.id === "flag" ? { ...s, id: "flag1", label: "🚩 깃발1" } : s
                );
                setStructures(migrated);
            }
            // 없으면 DEFAULT_STRUCTURES 유지
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* 구조물 삭제 — localStorage + Supabase 동시 저장 */
    const deleteStructure = async (id: string) => {
        if (!window.confirm("해당 건물을 삭제하시겠어요?")) return;
        if (!isSim) {
            // ① Supabase 먼저 삭제
            const { error } = await supabase.from("kdh_structures").delete().eq("struct_id", id);
            if (error) {
                console.error("구조물 삭제 실패:", error.message);
                alert(`삭제 실패: ${error.message}\n\nSupabase SQL Editor에서 아래를 실행해주세요:\nDROP POLICY IF EXISTS "allow_auth_write" ON kdh_structures;\nCREATE POLICY "allow_all_write" ON kdh_structures FOR ALL USING (true) WITH CHECK (true);`);
                return;
            }
        }
        // ② 로컬 반영 (시뮬레이션: localStorage skip)
        setStructures(prev => {
            const next = prev.filter(s => s.id !== id);
            if (!isSim) saveStructures(next);
            return next;
        });
    };

    /* 구조물 Upsert — Supabase 먼저, 성공 시 로컬 반영 */
    const upsertStructure = async (s: Structure) => {
        if (!isSim) {
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
            }
        }
        // ② 로컬 반영 (시뮬레이션: localStorage skip)
        setStructures(prev => {
            const exists = prev.find(p => p.id === s.id);
            const next = exists ? prev.map(p => p.id === s.id ? s : p) : [...prev, s];
            if (!isSim) saveStructures(next);
            return next;
        });
        return true;
    };

    useEffect(() => { fetchPlayers(); fetchStructures(); }, [fetchPlayers, fetchStructures]);

    /* 시뮬레이션 모드: 로딩 완료 후 초기 스냅샷 캡처 */
    useEffect(() => {
        if (isSim && !loading && simInitialPlayers === null) {
            setSimInitialPlayers(structuredClone(players));
        }
    }, [isSim, loading, players, simInitialPlayers]);
    useEffect(() => {
        if (isSim && !loading && simInitialStructures === null) {
            setSimInitialStructures(structuredClone(structures));
        }
    }, [isSim, loading, structures, simInitialStructures]);

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
        // 2×2 오브젝트 중심 = 좌하단 좌표에서 +1 오프셋 (x+1, y+1이 2×2 블록의 기하학적 중심)
        const { px, py } = toIso(p.x + 1, p.y + 1);
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
        if (playerDragRef.current) return;
        if (structDragRef.current) return;
        dragStart.current = { x: e.clientX, y: e.clientY };
        if (structCursor) return;
        // 구조물 이동 모드 중 → Pan 금지 + 드래그 시작
        if (movingStructureIdRef.current) {
            const ms = structures.find(s => s.id === movingStructureIdRef.current);
            if (ms) {
                structDragRef.current = { id: ms.id, origGx: ms.x, origGy: ms.y, size: ms.size, type: ms.type, label: ms.label };
                setDragStructPosSynced({ id: ms.id, gx: ms.x, gy: ms.y });
                suppressPopupRef.current = true;
            }
            return;
        }
        if (movingPlayerIdRef.current) {
            const mp = players.find(p => p.id === movingPlayerIdRef.current);
            if (mp) {
                playerDragRef.current = {
                    id: mp.id,
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    origGx: mp.x,
                    origGy: mp.y,
                };
                setDragGamePosSynced({ id: mp.id, gx: mp.x, gy: mp.y });
                suppressPopupRef.current = true;
            }
            return;
        }
        isDragging.current = true;
        panStart.current = { ...pan };
    };
    const onMouseMove = (e: React.MouseEvent) => {
        if (structCursor) {
            const game = screenToGame(e.clientX, e.clientY);
            if (game) setStructCursor(prev => prev ? { ...prev, gx: game.gx, gy: game.gy } : null);
            return;
        }
        // 구조물 드래그 중: 위치 업데이트
        if (structDragRef.current) {
            const game = screenToGame(e.clientX, e.clientY);
            if (game) setDragStructPosSynced({ id: structDragRef.current.id, ...game });
            return;
        }
        if (playerDragRef.current) {
            const game = screenToGame(e.clientX, e.clientY);
            if (game) setDragGamePosSynced({ id: playerDragRef.current.id, ...game });
            return;
        }
        if (movingStructureIdRef.current && !structDragRef.current) {
            // 이동 모드인데 드래그가 아직 시작 안된 경우 → 자동 드래그 시작
            const ms = structures.find(s => s.id === movingStructureIdRef.current);
            if (ms) {
                structDragRef.current = { id: ms.id, origGx: ms.x, origGy: ms.y, size: ms.size, type: ms.type, label: ms.label };
                setDragStructPosSynced({ id: ms.id, gx: ms.x, gy: ms.y });
            }
            return;
        }
        if (movingStructureIdRef.current) return; // 구조물 이동 모드 중 Pan 금지
        if (movingPlayerIdRef.current) return;
        if (!isDragging.current) return;
        setPan({
            x: panStart.current.x + (e.clientX - dragStart.current.x),
            y: panStart.current.y + (e.clientY - dragStart.current.y),
        });
    };
    const onMouseUp = async (e: React.MouseEvent) => {
        // 구조물 드래그 종료
        if (structDragRef.current && dragStructPosRef.current) {
            const { id, origGx, origGy, size, type, label } = structDragRef.current;
            const { gx, gy } = dragStructPosRef.current;
            // origGx/origGy는 드래그 시작 시점의 좌표 (stale closure 없이 ref에서 직접 사용)
            if (origGx !== gx || origGy !== gy) {
                // 자기 자신의 원래 위치 셀을 제외하고 충돌 체크
                const selfCells = new Set(
                    size === 1
                        ? [`${origGx},${origGy}`]
                        : getStructCells(origGx, origGy, size)
                );
                const targetCells = size === 1
                    ? [`${gx},${gy}`]
                    : getStructCells(gx, gy, size);
                const hasConflict = targetCells.some(c => occupiedCells.has(c) && !selfCells.has(c));
                if (hasConflict) {
                    alert("⚠️ 해당 위치에 이미 건물/연맹원이 있습니다.");
                } else {
                    await upsertStructure({ id, label, x: gx, y: gy, size, type });
                }
            }
            structDragRef.current = null;
            dragStructPosRef.current = null;
            setDragStructPos(null);
            setMovingStructureIdSynced(null);
            isDragging.current = false;
            return;
        }
        // 플레이어 드래그 종료
        if (playerDragRef.current && dragGamePosRef.current) {
            const { id } = playerDragRef.current;
            const { gx, gy } = dragGamePosRef.current;
            const origPlayer = players.find(p => p.id === id);
            if (origPlayer && (origPlayer.x !== gx || origPlayer.y !== gy)) {
                const selfCells = new Set(getMemberCells(origPlayer.x, origPlayer.y));
                const targetCells = getMemberCells(gx, gy);
                const hasConflict = targetCells.some(c => occupiedCells.has(c) && !selfCells.has(c));
                if (hasConflict) {
                    alert("⚠️ 해당 위치에 이미 건물/연맹원이 있습니다.");
                } else {
                    if (isSim) {
                        setPlayers(prev => prev.map(p => p.id === id ? { ...p, x: gx, y: gy } : p));
                    } else {
                        const { error } = await supabase
                            .from("kdh_players")
                            .update({ x: gx, y: gy })
                            .eq("id", Number(id))
                            .select();
                        if (error) {
                            console.error("❌ 좌표 저장 실패:", error);
                            alert(`⚠️ 저장 실패: ${error.message}\nSupabase UPDATE 정책을 확인해주세요.`);
                        } else {
                            setPlayers(prev => prev.map(p => p.id === id ? { ...p, x: gx, y: gy } : p));
                        }
                    }
                }
            }
            playerDragRef.current = null;
            dragGamePosRef.current = null;
            setDragGamePos(null);
            setMovingPlayerIdSynced(null);
            return;
        }
        const dx = Math.abs(e.clientX - dragStart.current.x);
        const dy = Math.abs(e.clientY - dragStart.current.y);
        if (structCursor && isAdmin && dx < 5 && dy < 5) {
            const isFlag = structCursor.structType === "flag";
            const sz = isFlag ? 1 : 3;
            const cells = isFlag ? [`${structCursor.gx},${structCursor.gy}`] : getStructCells(structCursor.gx, structCursor.gy, 3);
            if (cells.some(c => occupiedCells.has(c))) {
                alert("⚠️ 해당 위치에 이미 건물/플레이어가 있습니다.");
            } else {
                if (isFlag) {
                    // 기존 깃발 번호 목록 ("flag" 기본 id 제외, "flag1"~"flagN" 형태)에서 다음 번호 결정
                    const flagNums = new Set(
                        structures
                            .filter(s => s.type === "flag")
                            .map(s => { const m = s.id.match(/^flag(\d+)$/); return m ? parseInt(m[1]) : 0; })
                    );
                    let nextNum = 1;
                    while (flagNums.has(nextNum)) nextNum++;
                    const flagId = `flag${nextNum}`;
                    await upsertStructure({ id: flagId, label: `🚩 깃발${nextNum}`, x: structCursor.gx, y: structCursor.gy, size: 1, type: "flag" });
                } else {
                    if (structCursor.structType === "hq") {
                        await upsertStructure({ id: "hq", label: "🏰 본부", x: structCursor.gx, y: structCursor.gy, size: sz, type: "hq" });
                    } else {
                        // 깃발과 동일한 번호제: trap1~trapN
                        const trapNums = new Set(
                            structures
                                .filter(s => s.type === "trap")
                                .map(s => { const m = s.id.match(/^trap(\d+)$/); return m ? parseInt(m[1]) : 0; })
                        );
                        let nextNum = 1;
                        while (trapNums.has(nextNum)) nextNum++;
                        const trapId = `trap${nextNum}`;
                        await upsertStructure({ id: trapId, label: `🪤 함정${nextNum}`, x: structCursor.gx, y: structCursor.gy, size: sz, type: "trap" });
                    }
                }
                setStructCursor(null);
            }
            isDragging.current = false;
            return;
        }
        if (suppressPopupRef.current) {
            suppressPopupRef.current = false;
            isDragging.current = false;
            return;
        }
        if (isAdmin && !isDragEditMode && !structCursor && !movingPlayerId && !movingStructureId && dx < 5 && dy < 5) {
            const game = screenToGame(e.clientX, e.clientY);
            if (game) {
                const existing = players.find(p =>
                    game.gx >= p.x && game.gx <= p.x + 1 &&
                    game.gy >= p.y && game.gy <= p.y + 1
                );
                setPlacePopup({ gx: game.gx, gy: game.gy, sx: e.clientX, sy: e.clientY });
                setPlaceStep("select");
                setClickName(existing ? existing.name : "");
                setClickMemo(existing ? existing.memo : "");
            }
            isDragging.current = false;
            return;
        }
        if (movingStructureIdRef.current && dx < 5 && dy < 5) {
            setMovingStructureIdSynced(null);
        }
        if (movingPlayerIdRef.current && dx < 5 && dy < 5) {
            setMovingPlayerIdSynced(null);
        }
        isDragging.current = false;
    };

    /* ESC 키로 이동 모드 취소 */
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                movingPlayerIdRef.current = null;
                setMovingPlayerId(null);
                playerDragRef.current = null;
                setDragGamePos(null);
                // 구조물 이동 모드도 취소
                movingStructureIdRef.current = null;
                setMovingStructureId(null);
                structDragRef.current = null;
                setDragStructPos(null);
            }
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, []);

    /* 연맹원 배치 등록 (겹침 체크 포함) */
    const addMemberPlace = async () => {
        if (!clickName.trim() || !placePopup) return;
        const cells = getMemberCells(placePopup.gx, placePopup.gy);
        if (cells.some(c => occupiedCells.has(c))) { alert("⚠️ 해당 위치에 이미 팀원/건물이 있습니다!"); return; }
        if (isSim) {
            setPlayers(prev => [...prev, { id: `sim_${Date.now()}`, name: clickName.trim(), x: placePopup.gx, y: placePopup.gy, memo: clickMemo.trim() }]);
        } else {
            const { data, error } = await supabase
                .from("kdh_players")
                .insert({ name: clickName.trim(), x: placePopup.gx, y: placePopup.gy, memo: clickMemo.trim() || null })
                .select();
            if (!error && data?.[0]) {
                setPlayers(prev => [...prev, { id: String(data[0].id), name: data[0].name, x: data[0].x, y: data[0].y, memo: data[0].memo || "" }]);
            }
        }
        setPlacePopup(null); setClickName(""); setClickMemo("");
    };

    /* ── 마우스 휠 Zoom (커서 위치 기준) ── */
    const onWheel = useCallback((e: WheelEvent) => {
        e.preventDefault();
        const el = containerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        // 컨테이너 내부 커서 위치
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const oldScale = scaleRef.current;
        const newScale = Math.min(Math.max(0.4, oldScale + e.deltaY * -0.001), 3);
        const delta = newScale / oldScale;
        scaleRef.current = newScale; // 다음 이벤트에서 즉시 읽을 수 있도록 동기 업데이트
        // 커서 위치를 기준으로 pan 보정
        setPan(p => ({
            x: mouseX - (mouseX - p.x) * delta,
            y: mouseY - (mouseY - p.y) * delta,
        }));
        setScale(newScale);
    }, []);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, [onWheel]);

    /* ── 터치 Pan + 핑치 Zoom ── */
    const onTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            // 구조물 이동 모드 중 → Pan 금지 + 구조물 드래그 시작
            if (movingStructureIdRef.current) {
                const ms = structures.find(s => s.id === movingStructureIdRef.current);
                if (ms) {
                    structDragRef.current = { id: ms.id, origGx: ms.x, origGy: ms.y, size: ms.size, type: ms.type, label: ms.label };
                    setDragStructPosSynced({ id: ms.id, gx: ms.x, gy: ms.y });
                    suppressPopupRef.current = true;
                }
                isDragging.current = false; // Pan 절대 금지
                return;
            }
            if (movingPlayerIdRef.current) {
                const mp = players.find(p => p.id === movingPlayerIdRef.current);
                if (mp) {
                    playerDragRef.current = {
                        id: mp.id,
                        startClientX: e.touches[0].clientX,
                        startClientY: e.touches[0].clientY,
                        origGx: mp.x,
                        origGy: mp.y,
                    };
                    setDragGamePos({ id: mp.id, gx: mp.x, gy: mp.y });
                    suppressPopupRef.current = true;
                }
                return;
            }
            isDragging.current = true;
            panStart.current = { ...pan };
        } else if (e.touches.length === 2) {
            isDragging.current = false;
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            lastTouchDist.current = Math.sqrt(dx * dx + dy * dy);
            // 두 손가락 중심점 기록
            const el = containerRef.current;
            if (el) {
                const rect = el.getBoundingClientRect();
                lastTouchMid.current = {
                    x: ((e.touches[0].clientX + e.touches[1].clientX) / 2) - rect.left,
                    y: ((e.touches[0].clientY + e.touches[1].clientY) / 2) - rect.top,
                };
            }
        }
    };
    const onTouchMove = (e: React.TouchEvent) => {
        // 구조물 드래그 중: 위치 업데이트
        if (e.touches.length === 1 && structDragRef.current) {
            const game = screenToGame(e.touches[0].clientX, e.touches[0].clientY);
            if (game) setDragStructPosSynced({ id: structDragRef.current.id, ...game });
            return;
        }
        if (movingStructureIdRef.current) return; // 구조물 이동 모드 중 Pan 절대 금지
        // 플레이어 드래그 중: 위치 업데이트
        if (e.touches.length === 1 && playerDragRef.current) {
            const game = screenToGame(e.touches[0].clientX, e.touches[0].clientY);
            if (game) setDragGamePosSynced({ id: playerDragRef.current.id, ...game });
            return;
        }
        if (movingPlayerIdRef.current) return;
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
                const el = containerRef.current;
                const mid = lastTouchMid.current;
                const rect = el?.getBoundingClientRect();
                // 현재 두 손가락 중심점
                const curMidX = rect ? ((e.touches[0].clientX + e.touches[1].clientX) / 2) - rect.left : mid.x;
                const curMidY = rect ? ((e.touches[0].clientY + e.touches[1].clientY) / 2) - rect.top : mid.y;
                // scale 업데이트
                const oldScale = scaleRef.current;
                const newScale = Math.min(Math.max(0.4, oldScale * delta), 3);
                scaleRef.current = newScale; // 다음 이벤트에서 즉시 읽을 수 있도록 동기 업데이트
                // 손가락 중심점 기준으로 pan 보정
                setPan(p => ({
                    x: curMidX - (curMidX - p.x) * (newScale / oldScale),
                    y: curMidY - (curMidY - p.y) * (newScale / oldScale),
                }));
                setScale(newScale);
                // 중심점 업데이트
                lastTouchMid.current = { x: curMidX, y: curMidY };
            }
            lastTouchDist.current = dist;
        }
    };

    const onTouchEnd = () => {
        isDragging.current = false;
        lastTouchDist.current = 0;
        // 구조물 드래그 종료 시 저장 (터치)
        if (structDragRef.current && dragStructPosRef.current) {
            const { id, origGx, origGy, size, type, label } = structDragRef.current;
            const { gx, gy } = dragStructPosRef.current;
            if (origGx !== gx || origGy !== gy) {
                const selfCells = new Set(
                    size === 1
                        ? [`${origGx},${origGy}`]
                        : getStructCells(origGx, origGy, size)
                );
                const targetCells = size === 1
                    ? [`${gx},${gy}`]
                    : getStructCells(gx, gy, size);
                const hasConflict = targetCells.some(c => occupiedCells.has(c) && !selfCells.has(c));
                if (!hasConflict) {
                    upsertStructure({ id, label, x: gx, y: gy, size, type });
                } else {
                    alert("⚠️ 해당 위치에 이미 건물/연맹원이 있습니다.");
                }
            }
            structDragRef.current = null;
            dragStructPosRef.current = null;
            setDragStructPos(null);
            setMovingStructureIdSynced(null);
            return;
        }
        // 플레이어 드래그 종료 시 저장
        if (playerDragRef.current && dragGamePosRef.current) {
            const { id } = playerDragRef.current;
            const { gx, gy } = dragGamePosRef.current;
            const origPlayer = players.find(p => p.id === id);
            if (origPlayer && (origPlayer.x !== gx || origPlayer.y !== gy)) {
                const selfCells = new Set(getMemberCells(origPlayer.x, origPlayer.y));
                const targetCells = getMemberCells(gx, gy);
                const hasConflict = targetCells.some(c => occupiedCells.has(c) && !selfCells.has(c));
                if (!hasConflict) {
                    if (isSim) {
                        setPlayers(prev => prev.map(p => p.id === id ? { ...p, x: gx, y: gy } : p));
                    } else {
                        supabase.from("kdh_players").update({ x: gx, y: gy }).eq("id", parseInt(id))
                            .then(({ error }) => { if (!error) setPlayers(prev => prev.map(p => p.id === id ? { ...p, x: gx, y: gy } : p)); });
                    }
                } else {
                    alert("⚠️ 해당 위치에 이미 건물/연맹원이 있습니다.");
                }
            }
            playerDragRef.current = null;
            dragGamePosRef.current = null;
            setDragGamePos(null);
            setMovingPlayerIdSynced(null);
        }
    };

    /* 유저 추가 (Supabase) */
    const addPlayer = async () => {
        const name = fName.trim();
        const x = parseInt(fX);
        const y = parseInt(fY);
        if (!name || isNaN(x) || isNaN(y)) return;
        if (isSim) {
            setPlayers(prev => [...prev, { id: `sim_${Date.now()}`, name, x, y, memo: fMemo.trim() }]);
        } else {
            const { error } = await supabase.from("kdh_players").insert({ name, x, y, memo: fMemo.trim() || null });
            if (error) { alert(t.kdhPage.addFailed + error.message); return; }
            fetchPlayers();
        }
        setFName(""); setFX(""); setFY(""); setFMemo("");
        setShowModal(false);
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
        if (isSim) {
            setPlayers(prev => [...prev, { id: `sim_${Date.now()}`, name, x: result.x, y: result.y, memo: coordMemo.trim() }]);
        } else {
            const { error } = await supabase.from("kdh_players").insert({
                name, x: result.x, y: result.y, memo: coordMemo.trim() || null,
            });
            if (error) { alert(t.kdhPage.addFailed + error.message); return; }
            fetchPlayers();
        }
        setCoordName(""); setCoordMemo("");
        setCoordPairs([{ x: "", y: "" }, { x: "", y: "" }, { x: "", y: "" }, { x: "", y: "" }]);
        setShowCoordModal(false);
    };

    /* 유저 삭제 (Supabase) */
    const deletePlayer = async (id: string) => {
        if (!window.confirm(t.kdhPage.deleteConfirm)) return;
        if (isSim) {
            setPlayers(prev => prev.filter(p => p.id !== id));
        } else {
            const { error } = await supabase.from("kdh_players").delete().eq("id", parseInt(id));
            if (error) { alert(t.kdhPage.deleteFailed + error.message); return; }
            fetchPlayers();
        }
    };

    /* 유저 수정 (Supabase) */
    const updatePlayer = async (id: string, name: string, memo: string) => {
        if (!name.trim()) return;
        if (isSim) {
            setPlayers(prev => prev.map(p => p.id === id ? { ...p, name: name.trim(), memo: memo.trim() } : p));
        } else {
            const { error } = await supabase
                .from("kdh_players")
                .update({ name: name.trim(), memo: memo.trim() || null })
                .eq("id", parseInt(id));
            if (error) { alert("수정 실패: " + error.message); return; }
            setPlayers(prev => prev.map(p => p.id === id ? { ...p, name: name.trim(), memo: memo.trim() } : p));
        }
        setPlacePopup(null);
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
        if (isSim) {
            const newPlayers = toInsert.map((p, i) => ({
                id: `sim_csv_${Date.now()}_${i}`, name: p.name, x: p.x, y: p.y, memo: p.memo || "",
            }));
            setPlayers(prev => [...prev, ...newPlayers]);
            alert(t.kdhPage.uploadSuccess.replace("{n}", String(toInsert.length)));
        } else {
            const { error } = await supabase.from("kdh_players").insert(toInsert);
            if (error) { alert(t.kdhPage.uploadFailed + error.message); return; }
            alert(t.kdhPage.uploadSuccess.replace("{n}", String(toInsert.length)));
            fetchPlayers();
        }
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    /* 툴팁 */
    const showTip = (name: string, coord: string, memo: string, cx: number, cy: number) =>
        setTooltip({ name, coord, memo, x: cx + 12, y: cy - 12 });
    const hideTip = () => setTooltip(null);

    /* 필터링된 플레이어 목록 (현재는 구역 필터 없이 전체 표시) */
    const filteredPlayers = players;

    /* 구조물 라벨 번역 헬퍼: type + id의 번호를 추출해 i18n 라벨 반환 */
    const getStructLabel = (s: Structure): string => {
        const emoji = s.type === "hq" ? "🏰" : s.type === "trap" ? "🪤" : "🚩";
        if (s.type === "hq") return `${emoji} ${t.kdhPage.structHq.replace(/^.+? /, "")}`;
        if (s.type === "trap") {
            const num = s.id.match(/(\d+)$/)?.[1] ?? "";
            return `${emoji} ${t.kdhPage.structTrap1.replace(/^.+? /, "").replace(/\d+$/, "")}${num}`;
        }
        // flag
        const num = s.id.match(/(\d+)$/)?.[1] ?? "";
        return `🚩 깃발${num}`;
    };

    /* ── 겹침 체크 헬퍼 ── */
    const occupiedCells = useMemo(() => {
        const set = new Set<string>();
        players.forEach(p => {
            for (let dx = 0; dx <= 1; dx++) for (let dy = 0; dy <= 1; dy++) set.add(`${p.x + dx},${p.y + dy}`);
        });
        structures.forEach(s => {
            const h = Math.floor(s.size / 2);
            for (let dx = -h; dx <= h; dx++) for (let dy = -h; dy <= h; dy++) set.add(`${s.x + dx},${s.y + dy}`);
        });
        return set;
    }, [players, structures]);
    const getMemberCells = (gx: number, gy: number) =>
        [`${gx},${gy}`, `${gx + 1},${gy}`, `${gx},${gy + 1}`, `${gx + 1},${gy + 1}`];
    const getStructCells = (gx: number, gy: number, size: number) => {
        const h = Math.floor(size / 2); const cells: string[] = [];
        for (let dx = -h; dx <= h; dx++) for (let dy = -h; dy <= h; dy++) cells.push(`${gx + dx},${gy + dy}`);
        return cells;
    };

    /* 깃발 중심 — 7×7 정사각형 범위 Map 계산 (총 49칸)
       아이소메트릭 그리드에서 게임 좌표 7×7 정사각형 → 화면에서 마름모(다이아몬드) 형태로 표시
       Map 값 = 해당 셀을 덮는 깃발 개수 (1: 단독 빨강, 2+: 겹침 주황) */
    const flagZoneCells = useMemo(() => {
        const map = new Map<string, number>();
        structures.filter(s => s.type === "flag").forEach(f => {
            for (let dx = -3; dx <= 3; dx++) {
                for (let dy = -3; dy <= 3; dy++) {
                    const key = `${f.x + dx},${f.y + dy}`;
                    map.set(key, (map.get(key) ?? 0) + 1);
                }
            }
        });
        return map;
    }, [structures]);

    /* 마름모 그리드 라인 생성 — 5칸 단위 강조 + 일반 세선 */
    const gridLines: React.ReactNode[] = [];

    // 셀 내부 체커보드 채우기
    // ㆍ깃발 단독 영역: 빨간 단색 (rgba(220,38,38,0.55))
    // ㆍ깃발 겹침 영역: 주황 단색 (rgba(249,115,22,0.70)) — 2개 이상 깃발이 커버
    // ㆍ일반 영역: 체커보드 패턴
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
            const gx = MIN_X + c;
            const gy = MIN_Y + r;
            const tl = toIso(gx, gy + 1);
            const tr = toIso(gx + 1, gy + 1);
            const br = toIso(gx + 1, gy);
            const bl = toIso(gx, gy);
            const cellKey = `${gx},${gy}`;
            const flagCount = flagZoneCells.get(cellKey) ?? 0;

            if (flagCount >= 2) {
                // 겹침 영역 — 주황 단색 (두 깃발 구역이 교차)
                gridLines.push(
                    <path key={`f${c}_${r}`}
                        d={`M${tl.px},${tl.py} L${tr.px},${tr.py} L${br.px},${br.py} L${bl.px},${bl.py} Z`}
                        fill="rgba(249,115,22,0.75)"
                        stroke="none"
                    />
                );
            } else if (flagCount === 1) {
                // 단독 깃발 영역 — 빨간 단색
                gridLines.push(
                    <path key={`f${c}_${r}`}
                        d={`M${tl.px},${tl.py} L${tr.px},${tr.py} L${br.px},${br.py} L${bl.px},${bl.py} Z`}
                        fill="rgba(220,38,38,0.55)"
                        stroke="none"
                    />
                );
            } else {
                const isEven = (c + r) % 2 === 0;
                const isAccX = c % 5 === 0;
                const isAccY = r % 5 === 0;
                const fillOpacity = isAccX && isAccY ? 0.10
                    : (isAccX || isAccY) ? 0.07
                        : isEven ? 0.05 : 0.02;
                gridLines.push(
                    <path key={`f${c}_${r}`}
                        d={`M${tl.px},${tl.py} L${tr.px},${tr.py} L${br.px},${br.py} L${bl.px},${bl.py} Z`}
                        fill={isAccX && isAccY ? `rgba(6,182,212,${fillOpacity})` : `rgba(99,102,241,${fillOpacity})`}
                        stroke="none"
                    />
                );
            }
        }
    }

    // 세로 라인 (X 방향)
    for (let c = 0; c <= COLS; c++) {
        const p1 = toIso(MIN_X + c, MAX_Y);
        const p2 = toIso(MIN_X + c, MIN_Y);
        const isAcc = c % 5 === 0;
        gridLines.push(
            <line key={`c${c}`} x1={p1.px} y1={p1.py} x2={p2.px} y2={p2.py}
                stroke={isAcc ? "rgba(6,182,212,0.55)" : "rgba(71,85,105,0.45)"}
                strokeWidth={isAcc ? 1.0 : 0.6} />
        );
    }
    // 가로 라인 (Y 방향)
    for (let r = 0; r <= ROWS; r++) {
        const p1 = toIso(MIN_X, MIN_Y + r);
        const p2 = toIso(MAX_X, MIN_Y + r);
        const isAcc = r % 5 === 0;
        gridLines.push(
            <line key={`r${r}`} x1={p1.px} y1={p1.py} x2={p2.px} y2={p2.py}
                stroke={isAcc ? "rgba(6,182,212,0.55)" : "rgba(71,85,105,0.45)"}
                strokeWidth={isAcc ? 1.0 : 0.6} />
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
        const hw = sz * ISO_HALF / 2;
        const hh = sz * ISO_HALF / 2;
        return `M${cx},${cy - hh} L${cx + hw},${cy} L${cx},${cy + hh} L${cx - hw},${cy} Z`;
    };

    /* ── 시뮬레이션: 변경분 계산 ── */
    const computeChanges = useCallback((): SimChanges | null => {
        if (!simInitialPlayers || !simInitialStructures) return null;
        const initPMap = new Map(simInitialPlayers.map(p => [p.id, p]));
        const curPMap = new Map(players.map(p => [p.id, p]));
        const playersAdded = players.filter(p => !initPMap.has(p.id));
        const playersDeleted = simInitialPlayers.filter(p => !curPMap.has(p.id)).map(p => p.id);
        const playersUpdated = players.filter(p => {
            const orig = initPMap.get(p.id);
            return orig && (orig.x !== p.x || orig.y !== p.y || orig.name !== p.name || orig.memo !== p.memo);
        });
        const initSMap = new Map(simInitialStructures.map(s => [s.id, s]));
        const curSMap = new Map(structures.map(s => [s.id, s]));
        const structuresUpserted = structures.filter(s => {
            const orig = initSMap.get(s.id);
            return !orig || orig.x !== s.x || orig.y !== s.y;
        });
        const structuresDeleted = simInitialStructures.filter(s => !curSMap.has(s.id)).map(s => s.id);
        return { playersAdded, playersUpdated, playersDeleted, structuresUpserted, structuresDeleted };
    }, [players, structures, simInitialPlayers, simInitialStructures]);

    const simChanges = isSim ? computeChanges() : null;
    const simChangeCount = simChanges
        ? simChanges.playersAdded.length + simChanges.playersUpdated.length + simChanges.playersDeleted.length
        + simChanges.structuresUpserted.length + simChanges.structuresDeleted.length
        : 0;

    const resetSimulation = () => {
        if (!simInitialPlayers || !simInitialStructures) return;
        if (!window.confirm("시뮬레이션 변경 사항을 모두 초기화하시겠습니까?")) return;
        setPlayers(structuredClone(simInitialPlayers));
        setStructures(structuredClone(simInitialStructures));
    };

    /* ── 시뮬레이션 임시저장 ── */
    const saveSimSnapshot = useCallback(() => {
        try {
            const snap = { players, structures, savedAt: new Date().toISOString() };
            localStorage.setItem(SIM_SNAP_KEY, JSON.stringify(snap));
            setSimLastSaved(new Date());
        } catch (e) {
            console.error("임시저장 실패:", e);
            alert("임시저장에 실패했습니다.");
        }
    }, [players, structures]);

    const clearSimSnapshot = useCallback(() => {
        localStorage.removeItem(SIM_SNAP_KEY);
        setSimLastSaved(null);
    }, []);

    /* 시뮬레이션 로딩 완료 후 임시저장 복원 제안 */
    useEffect(() => {
        if (!isSim || loading || simSnapRestored) return;
        setSimSnapRestored(true);
        const raw = localStorage.getItem(SIM_SNAP_KEY);
        if (!raw) return;
        try {
            const snap = JSON.parse(raw) as { players: Player[]; structures: Structure[]; savedAt: string };
            const savedAt = new Date(snap.savedAt);
            const timeStr = savedAt.toLocaleString("ko-KR");
            if (window.confirm(`💾 임시저장된 데이터가 있습니다.\n저장 시각: ${timeStr}\n\n복원하시겠습니까?`)) {
                setPlayers(snap.players);
                setStructures(snap.structures);
                setSimLastSaved(savedAt);
            }
        } catch (e) {
            console.error("임시저장 복원 실패:", e);
            localStorage.removeItem(SIM_SNAP_KEY);
        }
    }, [isSim, loading, simSnapRestored, setPlayers, setStructures]);

    const handleSimApply = async () => {
        if (!simChanges || simChangeCount === 0) { alert("변경 사항이 없습니다."); return; }
        if (!window.confirm(`${simChangeCount}건의 변경 사항을 실제 데이터에 적용하시겠습니까?`)) return;
        if (onSimApply) {
            await onSimApply(players, structures, simChanges);
            // 적용 후 스냅샷 갱신 + 임시저장 삭제
            setSimInitialPlayers(structuredClone(players));
            setSimInitialStructures(structuredClone(structures));
            clearSimSnapshot();
        }
    };

    return (

        <>
            {/* ── 시뮬레이션 모드 배너 ── */}
            {isSim && (
                <div className="mb-3 rounded-xl px-4 py-2.5"
                    style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.35)" }}>
                    {/* 1줄: SIMULATION 뱃지 + 변경 건수 + 버튼들 */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-extrabold tracking-widest uppercase px-2 py-0.5 rounded"
                                style={{ background: "rgba(245,158,11,0.2)", color: "#fbbf24" }}>SIMULATION</span>
                            <span className="text-[11px] text-amber-200/70">
                                {simChangeCount > 0 ? `${simChangeCount}건 변경 대기 중` : "변경 사항 없음"}
                            </span>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            {/* 임시저장 */}
                            <button onClick={saveSimSnapshot}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all hover:brightness-110 active:scale-95"
                                style={{ background: "rgba(99,102,241,0.25)", border: "1px solid rgba(99,102,241,0.5)", color: "#a5b4fc" }}
                                title="현재 시뮬레이션 상태를 브라우저에 임시저장">
                                💾 임시저장
                            </button>
                            {/* 초기화 */}
                            <button onClick={resetSimulation}
                                className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all hover:brightness-110 active:scale-95"
                                style={{ background: "rgba(71,85,105,0.4)", border: "1px solid rgba(71,85,105,0.5)", color: "#94a3b8" }}>
                                ↺ 초기화
                            </button>
                            {/* 적용 */}
                            <button onClick={handleSimApply} disabled={simChangeCount === 0}
                                className="px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
                                style={{
                                    background: "linear-gradient(135deg,#f59e0b,#ef4444)", color: "#fff",
                                    boxShadow: simChangeCount > 0 ? "0 0 12px rgba(245,158,11,0.4)" : "none"
                                }}>
                                ✅ 실제 적용 ({simChangeCount})
                            </button>
                        </div>
                    </div>
                    {/* 2줄: 마지막 임시저장 시각 */}
                    {simLastSaved && (
                        <div className="mt-1.5 flex items-center justify-between">
                            <span className="text-[10px] text-amber-300/50">
                                💾 마지막 임시저장: {simLastSaved.toLocaleString("ko-KR")}
                            </span>
                            <button onClick={() => { if (window.confirm("임시저장 데이터를 삭제하시겠습니까?")) clearSimSnapshot(); }}
                                className="text-[10px] text-slate-600 hover:text-red-400 transition-colors">
                                🗑️ 삭제
                            </button>
                        </div>
                    )}
                </div>
            )}

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
                                    className="h-8 rounded-lg px-3 text-sm outline-none w-48 sm:w-72"
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
                                📥 좌표 삭제
                            </button>

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
                        height: gridHeight,
                        cursor: isDragging.current ? "grabbing" : "grab",
                        background: "radial-gradient(ellipse at 50% 40%, rgba(6,182,212,0.07) 0%, rgba(99,102,241,0.04) 40%, rgba(7,13,26,0.95) 100%)",
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


                        {/* 좌표 라벨 (X축) — 5칸 간격, 배경 박스 포함 */}
                        {Array.from({ length: COLS + 1 }, (_, i) => i).filter(i => i % 5 === 0).map(i => {
                            const gx = MIN_X + i;
                            const { px, py } = toIso(gx, MAX_Y);
                            const bw = 18, bh = 10;
                            return (
                                <g key={`lx${i}`}>
                                    <rect x={px - bw / 2} y={py + 10} width={bw} height={bh} rx={2} fill="rgba(6,182,212,0.12)" />
                                    <text x={px} y={py + 17} fill="rgba(6,182,212,0.75)" fontSize={7} textAnchor="middle" fontFamily="monospace" fontWeight={600}>{gx}</text>
                                </g>
                            );
                        })}
                        {/* 좌표 라벨 (Y축) — 5칸 간격 */}
                        {Array.from({ length: ROWS + 1 }, (_, i) => i).filter(i => i % 5 === 0).map(i => {
                            const gy = MIN_Y + i;
                            const { px, py } = toIso(MIN_X, gy);
                            const bw = 18, bh = 10;
                            return (
                                <g key={`ly${i}`}>
                                    <rect x={px - bw - 4} y={py - bh / 2} width={bw} height={bh} rx={2} fill="rgba(99,102,241,0.12)" />
                                    <text x={px - 4 - bw / 2} y={py + 3} fill="rgba(165,180,252,0.75)" fontSize={7} textAnchor="middle" fontFamily="monospace" fontWeight={600}>{gy}</text>
                                </g>
                            );
                        })}

                        {/* 건물 오버레이 — 특수건물 전부 노란색(amber) */}
                        {structures.map((s: Structure) => {
                            const isFlag = s.type === "flag";
                            const isMovingThis = movingStructureId === s.id;
                            const isDraggingThis = dragStructPos?.id === s.id;
                            // 드래그 중이면 dragStructPos 위치로 오버라이드
                            const activeGx = isDraggingThis ? (dragStructPos?.gx ?? s.x) : s.x;
                            const activeGy = isDraggingThis ? (dragStructPos?.gy ?? s.y) : s.y;
                            const center = toIso(activeGx + 0.5, activeGy + 0.5);
                            let tipDetail = `${s.size}×${s.size} 건물`;
                            if (isFlag) tipDetail = "깃발 (1×1)";
                            return (
                                <g key={s.id}
                                    onMouseEnter={e => { if (structHoverTimerRef.current) clearTimeout(structHoverTimerRef.current); setHoveredStructureId(s.id); showTip(getStructLabel(s), `X:${s.x} Y:${s.y}`, tipDetail, e.clientX, e.clientY); }}
                                    onMouseLeave={() => { structHoverTimerRef.current = setTimeout(() => { setHoveredStructureId(null); hideTip(); }, 150); }}
                                    onMouseDown={isAdmin ? (e) => {
                                        const now = Date.now();
                                        const last = lastStructClickRef.current;
                                        if (last?.id === s.id && now - last.time < 350) {
                                            // ✨ 더블클릭 → 이동 모드 토글
                                            e.stopPropagation();
                                            suppressPopupRef.current = true;
                                            setPlacePopup(null);
                                            const newId = movingStructureIdRef.current === s.id ? null : s.id;
                                            movingStructureIdRef.current = newId;
                                            setMovingStructureId(newId);
                                            lastStructClickRef.current = null;
                                            hideTip();
                                        } else if (movingStructureIdRef.current === s.id) {
                                            // 🟡 이동 모드 중 — 드래그 시작
                                            e.stopPropagation();
                                            suppressPopupRef.current = true;
                                            hideTip();
                                            dragStart.current = { x: e.clientX, y: e.clientY };
                                            structDragRef.current = { id: s.id, origGx: s.x, origGy: s.y, size: s.size, type: s.type, label: s.label };
                                            setDragStructPosSynced({ id: s.id, gx: s.x, gy: s.y });
                                            lastStructClickRef.current = { id: s.id, time: now };
                                        } else {
                                            lastStructClickRef.current = { id: s.id, time: now };
                                        }
                                    } : undefined}
                                    style={{ cursor: isAdmin ? (isMovingThis ? (isDraggingThis ? "grabbing" : "grab") : "pointer") : "default" }}
                                >
                                    {/* 이동 모드 — amber 펄스 테두리 (모든 구조물 공통) */}
                                    {isMovingThis && (
                                        <>
                                            <path d={diamondPath(center.px, center.py, (isFlag ? 1.2 : s.size) + 0.8)} fill="none"
                                                stroke="#f59e0b" strokeWidth={2} opacity={0}>
                                                <animate attributeName="opacity" values="0;0.8;0" dur="1s" repeatCount="indefinite" />
                                            </path>
                                            <path d={diamondPath(center.px, center.py, (isFlag ? 1.2 : s.size) + 0.4)} fill="none"
                                                stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="6 2"
                                                opacity={0.9} />
                                            {/* 이름 위 상태 뱃지 */}
                                            <text x={center.px} y={center.py - ((isFlag ? 1.2 : s.size) * 10) - 6}
                                                fill="#fcd34d" fontSize={6.5} fontWeight={700}
                                                textAnchor="middle" dominantBaseline="middle"
                                                style={{ filter: "drop-shadow(0 0 3px rgba(245,158,11,0.8))" }}
                                            >✥ 드래그로 이동</text>
                                        </>
                                    )}
                                    {isFlag ? (
                                        <>
                                            <path
                                                d={diamondPath(center.px, center.py, 1.2)}
                                                fill={isMovingThis ? "rgba(251,191,36,0.5)" : "rgba(251,191,36,0.4)"}
                                                stroke={isMovingThis ? "#fbbf24" : "#fbbf24"}
                                                strokeWidth={isMovingThis ? 2.5 : 2}
                                                strokeDasharray={isDraggingThis ? "6 2" : undefined}
                                            />

                                        </>
                                    ) : (
                                        <>
                                            <path
                                                d={diamondPath(center.px, center.py, s.size)}
                                                fill={isDraggingThis ? "rgba(251,191,36,0.35)" : isMovingThis ? "rgba(251,191,36,0.25)" : "rgba(251,191,36,0.18)"}
                                                stroke={isDraggingThis ? "#fbbf24" : "#f59e0b"}
                                                strokeWidth={isMovingThis ? 2.5 : 2}
                                                strokeDasharray={isDraggingThis ? "6 2" : undefined}
                                            />
                                            {s.type === "hq" && <path d={diamondPath(center.px, center.py, s.size)} fill="none" stroke="rgba(251,191,36,0.5)" strokeWidth={4} />}

                                        </>
                                    )}
                                    <text x={center.px} y={center.py + 1}
                                        fill="#fde68a"
                                        fontSize={isFlag ? 9 : 10} fontWeight={700}
                                        textAnchor="middle" dominantBaseline="middle"
                                    >
                                        {getStructLabel(s)}
                                    </text>
                                </g>
                            );
                        })}

                        {/* 플레이어 오버레이 (2×2 오브젝트 — x,y는 좌하단 최소좌표 기준) */}
                        {filteredPlayers.map(p => {
                            // 드래그 중이면 dragGamePos 위치로 오버라이드
                            const activePosX = (dragGamePos?.id === p.id) ? dragGamePos.gx : p.x;
                            const activePosY = (dragGamePos?.id === p.id) ? dragGamePos.gy : p.y;
                            const center = toIso(activePosX + 1, activePosY + 1);
                            const isHit = hitIds.includes(p.id);
                            const isDraggingThis = dragGamePos?.id === p.id;
                            const isMovingThis = movingPlayerId === p.id;
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
                                    onMouseDown={isAdmin ? (e) => {
                                        const now = Date.now();
                                        const last = lastPlayerClickRef.current;
                                        if (last?.id === p.id && now - last.time < 350) {
                                            // ✨ 더블클릭 감지
                                            e.stopPropagation();
                                            suppressPopupRef.current = true;
                                            setPlacePopup(null);
                                            const newId = movingPlayerIdRef.current === p.id ? null : p.id;
                                            movingPlayerIdRef.current = newId;
                                            setMovingPlayerId(newId);
                                            lastPlayerClickRef.current = null;
                                            hideTip();
                                        } else if (movingPlayerIdRef.current === p.id) {
                                            // 🟢 이동 모드 중 — 어느 곳을 클릭해도 드래그 시작 (Pan 차단)
                                            e.stopPropagation();
                                            suppressPopupRef.current = true;
                                            hideTip();
                                            dragStart.current = { x: e.clientX, y: e.clientY };
                                            playerDragRef.current = {
                                                id: p.id,
                                                startClientX: e.clientX,
                                                startClientY: e.clientY,
                                                origGx: p.x,
                                                origGy: p.y,
                                            };
                                            setDragGamePosSynced({ id: p.id, gx: p.x, gy: p.y });
                                            lastPlayerClickRef.current = { id: p.id, time: now };
                                        } else {
                                            // 단일 클릭 — 시간 기록, 이벤트 버블링 허용
                                            lastPlayerClickRef.current = { id: p.id, time: now };
                                        }
                                    } : undefined}
                                    style={{ cursor: isAdmin ? (isMovingThis ? (isDraggingThis ? "grabbing" : "grab") : "pointer") : "default" }}
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
                                    {/* 이동 모드 — 초록 펄스 테두리 (더블클릭 활성화 시) */}
                                    {isMovingThis && (
                                        <>
                                            <path d={diamondPath(center.px, center.py, 3.2)} fill="none"
                                                stroke="#10b981" strokeWidth={2} opacity={0}>
                                                <animate attributeName="opacity" values="0;0.8;0" dur="1s" repeatCount="indefinite" />
                                            </path>
                                            <path d={diamondPath(center.px, center.py, 2.6)} fill="none"
                                                stroke="#34d399" strokeWidth={1.5} strokeDasharray="4 2"
                                                opacity={0.9} />
                                            {/* 이름 위 상태 뱃지 */}
                                            <text x={center.px} y={center.py - 16}
                                                fill="#6ee7b7" fontSize={6.5} fontWeight={700}
                                                textAnchor="middle" dominantBaseline="middle"
                                                style={{ filter: "drop-shadow(0 0 3px rgba(16,185,129,0.8))" }}
                                            >✥ 드래그로 이동</text>
                                        </>
                                    )}
                                    {/* 메인 2×2 다이아몬드 */}
                                    <path
                                        d={diamondPath(center.px, center.py, 2)}
                                        fill={
                                            isDraggingThis ? "rgba(16,185,129,0.35)" :
                                                isMovingThis ? "rgba(16,185,129,0.18)" :
                                                    isHit ? "rgba(251,191,36,0.35)" : "rgba(99,102,241,0.2)"
                                        }
                                        stroke={
                                            isDraggingThis ? "#10b981" :
                                                isMovingThis ? "#34d399" :
                                                    isHit ? "#fbbf24" : "rgba(99,102,241,0.6)"
                                        }
                                        strokeWidth={isDraggingThis || isMovingThis ? 2.5 : isHit ? 2.5 : 1.5}
                                        strokeDasharray={isDraggingThis ? "4 2" : isMovingThis ? "6 2" : undefined}
                                        filter={(isHit || isMovingThis) ? "url(#hitGlow)" : undefined}
                                        onMouseDown={isAdmin && (isDragEditMode || isMovingThis) ? (e) => {
                                            e.stopPropagation();
                                            hideTip();
                                            dragStart.current = { x: e.clientX, y: e.clientY };
                                            playerDragRef.current = {
                                                id: p.id,
                                                startClientX: e.clientX,
                                                startClientY: e.clientY,
                                                origGx: p.x,
                                                origGy: p.y,
                                            };
                                            setDragGamePosSynced({ id: p.id, gx: p.x, gy: p.y });
                                        } : undefined}
                                    />
                                    {/* 이름 */}
                                    <text x={center.px} y={center.py - 2} fill={isDraggingThis ? "#22d3ee" : isHit ? "#fff" : "#a5b4fc"} fontSize={isHit ? 8 : 7} fontWeight={700} textAnchor="middle" dominantBaseline="middle">{displayName}</text>
                                    {/* 하이라이트 좌표 배지 — 4개 셀 2×2 그리드 */}
                                    {isHit && (() => {
                                        const gx = activePosX, gy = activePosY;
                                        const cells = [
                                            { lbl: "↙", x: gx, y: gy },
                                            { lbl: "↘", x: gx + 1, y: gy },
                                            { lbl: "↖", x: gx, y: gy + 1 },
                                            { lbl: "↗", x: gx + 1, y: gy + 1 },
                                        ];
                                        const cw = 44, ch = 18, gap = 2;
                                        const totalW = cw * 2 + gap + 8;
                                        const totalH = ch * 2 + gap + 8;
                                        const bx = center.px - totalW / 2;
                                        const by = center.py + 24;
                                        return (
                                            <g>
                                                {/* 배경 패널 */}
                                                <rect x={bx - 2} y={by - 2} width={totalW + 4} height={totalH + 4}
                                                    rx={6} ry={6} fill="rgba(7,13,26,0.92)" stroke="#fbbf24" strokeWidth={1} />
                                                {cells.map((c, i) => {
                                                    const col = i % 2, row = Math.floor(i / 2);
                                                    const cx2 = bx + 4 + col * (cw + gap);
                                                    const cy2 = by + 4 + row * (ch + gap);
                                                    return (
                                                        <g key={i}>
                                                            <rect x={cx2} y={cy2} width={cw} height={ch} rx={3} ry={3}
                                                                fill="rgba(6,182,212,0.08)" stroke="rgba(6,182,212,0.3)" strokeWidth={0.8} />
                                                            <text x={cx2 + 3} y={cy2 + 5} fill="#64748b" fontSize={5} fontWeight={600}>{c.lbl}</text>
                                                            <text x={cx2 + cw / 2} y={cy2 + ch / 2 + 2} fill="#67e8f9" fontSize={6.5} fontWeight={700}
                                                                textAnchor="middle" dominantBaseline="middle" fontFamily="monospace">
                                                                {c.x},{c.y}
                                                            </text>
                                                        </g>
                                                    );
                                                })}
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
                                    {/* 삭제 버튼 — 삭제 모드(isDragEditMode) + 관리자 hover 시만 표시 */}
                                    {isAdmin && isDragEditMode && hoveredPlayerId === p.id && !isDraggingThis && (
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
                        {/* 연맹원 배치 미리보기 (placeStep==="member"일 때 2×2 다이아몬드) */}
                        {placePopup && placeStep === "member" && (() => {
                            const center = toIso(placePopup.gx + 1, placePopup.gy + 1);
                            const conflict = getMemberCells(placePopup.gx, placePopup.gy).some((c: string) => occupiedCells.has(c));
                            return (
                                <path
                                    d={diamondPath(center.px, center.py, 2)}
                                    fill={conflict ? "rgba(239,68,68,0.25)" : "rgba(34,197,94,0.25)"}
                                    stroke={conflict ? "#ef4444" : "#22c55e"}
                                    strokeWidth={2} strokeDasharray="6 3" pointerEvents="none"
                                />
                            );
                        })()}
                        {/* 구조물 커서 미리보기 (깃발 1×1 / 건물 3×3) */}
                        {structCursor && (() => {
                            const isFlag = structCursor.structType === "flag";
                            const sz = isFlag ? 1 : 3;
                            const center = toIso(structCursor.gx + 0.5, structCursor.gy + 0.5);
                            const cells = isFlag ? [`${structCursor.gx},${structCursor.gy}`] : getStructCells(structCursor.gx, structCursor.gy, 3);
                            const conflict = cells.some((c: string) => occupiedCells.has(c));
                            const color = isFlag ? (conflict ? "#ef4444" : "#f87171") : (conflict ? "#ef4444" : "#fbbf24");
                            return (
                                <path
                                    d={diamondPath(center.px, center.py, sz)}
                                    fill={conflict ? "rgba(239,68,68,0.2)" : isFlag ? "rgba(239,68,68,0.15)" : "rgba(251,191,36,0.2)"}
                                    stroke={color}
                                    strokeWidth={2.5} strokeDasharray="8 4" pointerEvents="none"
                                />
                            );
                        })()}
                    </svg>
                </div>
            </div>

            {/* ── 배치 선택 팝업 (셀 클릭 시) ── */}
            {placePopup && isAdmin && (() => {
                const closePopup = () => { setPlacePopup(null); setClickName(""); setClickMemo(""); };
                const popLeft = Math.min(placePopup.sx + 8, window.innerWidth - 290);
                const popTop = Math.min(placePopup.sy + 12, window.innerHeight - 340);
                return (
                    <div className="fixed z-[60]" style={{ left: popLeft, top: popTop, width: 270, background: "rgba(10,18,35,0.98)", border: "1px solid rgba(99,102,241,0.4)", borderRadius: 18, boxShadow: "0 16px 48px rgba(0,0,0,0.7)", backdropFilter: "blur(16px)", padding: "16px" }}>
                        {/* 헤더 */}
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[12px] font-bold" style={{ color: "#a5b4fc" }}>📌 배치 선택</span>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8" }}>
                                    ({placePopup.gx}, {placePopup.gy})
                                </span>
                            </div>
                            <button onClick={closePopup} className="text-slate-600 hover:text-red-400 text-sm font-bold transition-colors">✕</button>
                        </div>

                        {placeStep === "select" && (
                            <div className="space-y-2">
                                {/* 연맹원 */}
                                <button onClick={() => { setPlaceStep("member"); setTimeout(() => clickNameRef.current?.focus(), 50); }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:brightness-110 active:scale-[0.98]"
                                    style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)" }}>
                                    <div style={{ width: 24, height: 16, background: "rgba(99,102,241,0.3)", border: "1.5px solid #a5b4fc", borderRadius: 2, transform: "rotate(45deg)", flexShrink: 0 }} />
                                    <div>
                                        <div className="text-xs font-bold text-white">
                                            {players.some(p =>
                                                placePopup.gx >= p.x && placePopup.gx <= p.x + 1 &&
                                                placePopup.gy >= p.y && placePopup.gy <= p.y + 1
                                            ) ? "👤 연맹원 수정" : "👤 연맹원 추가"}
                                        </div>
                                        <div className="text-[10px] text-slate-500">2×2 점유 · 이름/메모 등록</div>
                                    </div>
                                    <span className="ml-auto text-slate-600 text-xs">→</span>
                                </button>
                                {/* 함정 */}
                                <button onClick={() => { closePopup(); setStructCursor({ structType: "trap", gx: placePopup.gx, gy: placePopup.gy }); }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:brightness-110 active:scale-[0.98]"
                                    style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)" }}>
                                    <div style={{ width: 24, height: 16, background: "rgba(251,191,36,0.25)", border: "1.5px solid #fbbf24", borderRadius: 2, transform: "rotate(45deg)", flexShrink: 0 }} />
                                    <div>
                                        <div className="text-xs font-bold" style={{ color: "#fde68a" }}>🪤 함정</div>
                                        <div className="text-[10px] text-slate-500">3×3 · 마우스로 이동 후 클릭 배치</div>
                                    </div>
                                    <span className="ml-auto text-slate-600 text-xs">→</span>
                                </button>
                                {/* 본부 */}
                                <button onClick={() => { closePopup(); setStructCursor({ structType: "hq", gx: placePopup.gx, gy: placePopup.gy }); }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:brightness-110 active:scale-[0.98]"
                                    style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(245,158,11,0.35)" }}>
                                    <div style={{ width: 24, height: 16, background: "rgba(245,158,11,0.3)", border: "1.5px solid #f59e0b", borderRadius: 2, transform: "rotate(45deg)", flexShrink: 0 }} />
                                    <div>
                                        <div className="text-xs font-bold" style={{ color: "#fde68a" }}>🏰 본부</div>
                                        <div className="text-[10px] text-slate-500">3×3 · 마우스로 이동 후 클릭 배치</div>
                                    </div>
                                    <span className="ml-auto text-slate-600 text-xs">→</span>
                                </button>
                                {/* 깃발 */}
                                <button onClick={() => { closePopup(); setStructCursor({ structType: "flag", gx: placePopup.gx, gy: placePopup.gy }); }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:brightness-110 active:scale-[0.98]"
                                    style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)" }}>
                                    <div style={{ width: 16, height: 16, background: "rgba(239,68,68,0.25)", border: "1.5px solid #f87171", borderRadius: 2, transform: "rotate(45deg)", flexShrink: 0 }} />
                                    <div>
                                        <div className="text-xs font-bold" style={{ color: "#fca5a5" }}>🚩 깃발</div>
                                        <div className="text-[10px] text-slate-500">1×1 · 마우스로 이동 후 클릭 배치</div>
                                    </div>
                                    <span className="ml-auto text-slate-600 text-xs">→</span>
                                </button>
                            </div>
                        )}

                        {placeStep === "member" && (() => {
                            const conflict = getMemberCells(placePopup.gx, placePopup.gy).some((c: string) => occupiedCells.has(c));
                            return (
                                <>
                                    {/* 겹침 상태 배너 */}
                                    <div className="flex items-center gap-2 mb-3 px-2.5 py-1.5 rounded-lg text-[10px]"
                                        style={{ background: conflict ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.08)", border: `1px solid ${conflict ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.25)"}`, color: conflict ? "#f87171" : "#86efac" }}>
                                        <span>{conflict ? "⚠️ 이미 배치된 위치" : "✓ 배치 가능"}</span>
                                        <span className="ml-auto font-mono">X:{placePopup.gx}~{placePopup.gx + 1} Y:{placePopup.gy}~{placePopup.gy + 1}</span>
                                    </div>
                                    <div className="mb-2.5">
                                        <label className="block text-[10px] text-slate-500 font-bold mb-1">연맹원 ID *</label>
                                        <input ref={clickNameRef} type="text" value={clickName} onChange={e => setClickName(e.target.value)}
                                            onKeyDown={e => { if (e.key === "Enter") addMemberPlace(); if (e.key === "Escape") closePopup(); }}
                                            placeholder="예: 만두몬mandu" autoFocus
                                            className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
                                            style={{ background: "rgba(7,13,26,0.8)", border: `1px solid ${clickName.trim() ? "rgba(99,102,241,0.5)" : "rgba(71,85,105,0.5)"}` }} />
                                    </div>
                                    <div className="mb-4">
                                        <label className="block text-[10px] text-slate-500 font-bold mb-1">메모 (선택)</label>
                                        <input type="text" value={clickMemo} onChange={e => setClickMemo(e.target.value)}
                                            onKeyDown={e => { if (e.key === "Enter") addMemberPlace(); if (e.key === "Escape") closePopup(); }}
                                            placeholder="R5, 공격대장..."
                                            className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
                                            style={{ background: "rgba(7,13,26,0.8)", border: "1px solid rgba(71,85,105,0.4)" }} />
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => setPlaceStep("select")} className="px-3 py-2 rounded-xl text-[11px] text-slate-400 hover:text-white transition-colors" style={{ background: "rgba(30,41,59,0.6)", border: "1px solid rgba(51,65,85,0.4)" }}>← 뒤로</button>
                                        {(() => {
                                            const existing = players.find(p =>
                                                placePopup.gx >= p.x && placePopup.gx <= p.x + 1 &&
                                                placePopup.gy >= p.y && placePopup.gy <= p.y + 1
                                            );
                                            return (
                                                <>
                                                    {existing && (
                                                        <button onClick={() => { deletePlayer(existing.id); closePopup(); }}
                                                            className="px-3 py-2 rounded-xl text-[12px] font-bold transition-all hover:brightness-110 active:scale-95"
                                                            style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", color: "#f87171" }}>
                                                            🗑️
                                                        </button>
                                                    )}
                                                    <button onClick={() => existing ? updatePlayer(existing.id, clickName, clickMemo) : addMemberPlace()}
                                                        disabled={!clickName.trim() || (existing ? false : conflict)}
                                                        className="flex-1 py-2 rounded-xl text-[12px] font-bold transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
                                                        style={{
                                                            background: existing ? "linear-gradient(135deg,#06b6d4,#3b82f6)" : "linear-gradient(135deg,#4f46e5,#7c3aed)",
                                                            color: "#fff",
                                                            boxShadow: !conflict && clickName.trim() ? "0 0 12px rgba(99,102,241,0.4)" : "none"
                                                        }}>
                                                        ✓ {existing ? "수정" : "등록"}
                                                    </button>
                                                </>
                                            );
                                        })()}
                                    </div>

                                    <p className="text-[9px] text-slate-700 mt-2 text-center">Enter로 등록 · Esc로 취소</p>
                                </>
                            );
                        })()}
                    </div>
                );
            })()}

            {/* ── 연맹원 드래그 이동 모드 배너 ── */}
            {movingPlayerId && isAdmin && (() => {
                const mp = players.find(p => p.id === movingPlayerId);
                if (!mp) return null;
                return (
                    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] rounded-2xl"
                        onTouchStart={e => e.stopPropagation()}
                        style={{
                            background: "rgba(10,18,35,0.98)",
                            border: "1px solid rgba(16,185,129,0.5)",
                            boxShadow: "0 8px 32px rgba(0,0,0,0.7), 0 0 24px rgba(16,185,129,0.15)",
                            backdropFilter: "blur(16px)",
                            minWidth: 240,
                            maxWidth: "calc(100vw - 32px)",
                            padding: "10px 16px",
                        }}>
                        {/* 1행: 이동 모드 뱃지 + 대상 이름 */}
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-sm font-bold whitespace-nowrap" style={{ color: "#34d399" }}>
                                {t.kdhPage.moveModeTitle}
                            </span>
                            <span className="font-semibold text-[12px] px-2 py-0.5 rounded-lg truncate"
                                style={{ background: "rgba(16,185,129,0.15)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.3)" }}>
                                {mp.name}
                            </span>
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded whitespace-nowrap ml-auto"
                                style={{ background: "rgba(16,185,129,0.1)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.2)" }}>
                                X:{mp.x} Y:{mp.y}
                            </span>
                        </div>
                        {/* 2행: 안내 텍스트 + 취소 버튼 */}
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-400 whitespace-nowrap">{t.kdhPage.moveModeHint}</span>
                            <span className="text-[10px] text-slate-600 whitespace-nowrap">{t.kdhPage.moveModeCancel}</span>
                            <button
                                onClick={() => setMovingPlayerId(null)}
                                className="ml-auto px-3 py-1 rounded-lg text-[11px] font-medium text-slate-400 hover:text-red-400 transition-colors whitespace-nowrap"
                                style={{ background: "rgba(30,41,59,0.6)", border: "1px solid rgba(51,65,85,0.4)" }}
                            >{t.kdhPage.cancelBtn}</button>
                        </div>
                    </div>
                );
            })()}

            {/* ── 구조물 드래그 이동 모드 배너 ── */}
            {movingStructureId && isAdmin && (() => {
                const ms = structures.find(s => s.id === movingStructureId);
                if (!ms) return null;
                const structLabel = ms.label;
                return (
                    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] rounded-2xl"
                        onTouchStart={e => e.stopPropagation()}
                        style={{
                            background: "rgba(10,18,35,0.98)",
                            border: "1px solid rgba(251,191,36,0.5)",
                            boxShadow: "0 8px 32px rgba(0,0,0,0.7), 0 0 24px rgba(251,191,36,0.15)",
                            backdropFilter: "blur(16px)",
                            minWidth: 240,
                            maxWidth: "calc(100vw - 32px)",
                            padding: "10px 16px",
                        }}>
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-sm font-bold whitespace-nowrap" style={{ color: "#fbbf24" }}>
                                ✥ {structLabel}
                            </span>
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded whitespace-nowrap ml-auto"
                                style={{ background: "rgba(251,191,36,0.1)", color: "#fcd34d", border: "1px solid rgba(251,191,36,0.25)" }}>
                                X:{dragStructPos?.id === ms.id ? (dragStructPos?.gx ?? ms.x) : ms.x} Y:{dragStructPos?.id === ms.id ? (dragStructPos?.gy ?? ms.y) : ms.y}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-400 whitespace-nowrap">{t.kdhPage.moveModeHint}</span>
                            <span className="text-[10px] text-slate-600 whitespace-nowrap">{t.kdhPage.moveModeCancel}</span>
                            <div className="ml-auto flex items-center gap-2">
                                <button
                                    onClick={() => { setMovingStructureIdSynced(null); deleteStructure(ms.id); }}
                                    className="px-3 py-1 rounded-lg text-[11px] font-bold transition-all hover:brightness-110 active:scale-95 whitespace-nowrap"
                                    style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", color: "#f87171" }}
                                >🗑️ 삭제</button>
                                <button
                                    onClick={() => setMovingStructureIdSynced(null)}
                                    className="px-3 py-1 rounded-lg text-[11px] font-medium text-slate-400 hover:text-white transition-colors whitespace-nowrap"
                                    style={{ background: "rgba(30,41,59,0.6)", border: "1px solid rgba(51,65,85,0.4)" }}
                                >{t.kdhPage.cancelBtn}</button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ── 구조물 배치 모드 배너 ── */}
            {structCursor && isAdmin && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] rounded-2xl"
                    onTouchStart={e => e.stopPropagation()}
                    style={{
                        background: "rgba(10,18,35,0.96)",
                        border: "1px solid rgba(251,191,36,0.5)",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                        backdropFilter: "blur(12px)",
                        minWidth: 240,
                        maxWidth: "calc(100vw - 32px)",
                        padding: "10px 16px",
                    }}>
                    {/* 1행: 배치 모드 제목 + 좌표 */}
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm font-bold whitespace-nowrap" style={{ color: structCursor.structType === "flag" ? "#f87171" : "#fbbf24" }}>
                            {structCursor.structType === "hq" ? t.kdhPage.structHq : structCursor.structType === "flag" ? "🚩 깃발" : t.kdhPage.structTrap1} 배치
                        </span>
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded ml-auto whitespace-nowrap"
                            style={{ background: "rgba(251,191,36,0.1)", color: "#fcd34d", border: "1px solid rgba(251,191,36,0.25)" }}>
                            ({structCursor.gx}, {structCursor.gy})
                        </span>
                    </div>
                    {/* 2행: 안내 + 취소 */}
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400 whitespace-nowrap">{t.kdhPage.structModeHint}</span>
                        <button
                            onClick={() => setStructCursor(null)}
                            className="ml-auto px-3 py-1 rounded-lg text-[11px] font-medium text-slate-400 hover:text-red-400 transition-colors whitespace-nowrap"
                            style={{ background: "rgba(30,41,59,0.6)", border: "1px solid rgba(51,65,85,0.4)" }}
                        >{t.kdhPage.structModeCancel}</button>
                    </div>
                </div>
            )}

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
