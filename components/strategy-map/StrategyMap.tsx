"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
// ─────────────────────────────────────────────
// Drag & Drop  — @dnd-kit
// ─────────────────────────────────────────────
import {
    DndContext,
    DragOverlay,
    useDraggable,
    useDroppable,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    type DragStartEvent,
    type DragEndEvent,
} from "@dnd-kit/core";
// ─────────────────────────────────────────────
// 애니메이션     — framer-motion
// ─────────────────────────────────────────────
import { motion, AnimatePresence } from "framer-motion";
// ─────────────────────────────────────────────
// Supabase 클라이언트 & 타입
// ─────────────────────────────────────────────
import { supabase, type StrategyFrameRow } from "@/lib/supabase/client";

/* ═══════════════════════════════════════════════
   1. 타입 정의
   ═══════════════════════════════════════════════ */

/** 맵 위의 개별 연맹원(말) */
interface AllianceMember {
    id: string;
    name: string;
    color: string; // 아이콘 배경색
    emoji: string; // 프로필 아이콘 대용 이모지
}

/** 맵 칸 좌표 */
interface CellPosition {
    row: number;
    col: number;
}

/** 배치 상태 — 연맹원 id → 칸 좌표 */
type Placement = Record<string, CellPosition>;

/** 패턴(프레임) 하나 */
interface PatternFrame {
    id: number;
    label: string; // 설명 텍스트
    placement: Placement; // 스냅샷
}

/* ═══════════════════════════════════════════════
   2. 상수
   ═══════════════════════════════════════════════ */

/** 그리드 크기 (8×8 체스판) */
const GRID_ROWS = 8;
const GRID_COLS = 8;

/** 셀 크기 (px) — 애니메이션 계산용 (실제 렌더는 CSS로 반응형 처리) */
const CELL_SIZE = 64;
/** 애니메이션 모드에서 실제 셀 px (JS로 계산, 모바일 기준) */
const ANIM_CELL = 40;

/** 더미 연맹원 데이터 */
const INITIAL_MEMBERS: AllianceMember[] = [
    { id: "m1", name: "영웅A", color: "#f43f5e", emoji: "⚔️" },
    { id: "m2", name: "영웅B", color: "#3b82f6", emoji: "🛡️" },
    { id: "m3", name: "영웅C", color: "#22c55e", emoji: "🏹" },
    { id: "m4", name: "영웅D", color: "#a855f7", emoji: "🧙" },
    { id: "m5", name: "영웅E", color: "#f59e0b", emoji: "🗡️" },
    { id: "m6", name: "영웅F", color: "#06b6d4", emoji: "🔮" },
];

/* ═══════════════════════════════════════════════
   3. 유틸 함수
   ═══════════════════════════════════════════════ */

/** "row-col" 형식의 셀 ID를 파싱 */
function parseCellId(cellId: string): CellPosition | null {
    const parts = cellId.replace("cell-", "").split("-");
    if (parts.length !== 2) return null;
    return { row: Number(parts[0]), col: Number(parts[1]) };
}

/** CellPosition → 픽셀 좌표 (그리드 왼쪽 상단 기준) */
function cellToPixel(pos: CellPosition) {
    return {
        x: pos.col * CELL_SIZE,
        y: pos.row * CELL_SIZE,
    };
}

/* ═══════════════════════════════════════════════
   4. 서브 컴포넌트 — DraggablePiece (드래그 가능한 말)
   ═══════════════════════════════════════════════ */

interface DraggablePieceProps {
    member: AllianceMember;
    isOnBoard: boolean; // 보드 위에 올라간 상태인지
}

/* ═══════════════════════════════════════════════
   AI ASSET PLACEHOLDER — 캐릭터 아바타
   ═══════════════════════════════════════════════
   현재 DraggablePiece는 이모지 + 텍스트로 연맹원을 표현합니다.
   향후 미드저니(Midjourney) 또는 DALL-E 3로 생성한
   캐릭터 프로필 이미지로 교체할 수 있습니다.

   교체 방법:
   1. AI 이미지 생성 후 /public/avatars/{memberId}.png 로 저장
   2. AllianceMember 인터페이스에 avatarUrl?: string 필드 추가
   3. 아래 DraggablePiece 내부의 emoji <span> 자리에:
      <Image src={member.avatarUrl} alt={member.name} width={40} height={40} className="rounded-full" />
      으로 교체하면 됩니다.
   ─────────────────────────────────────────────── */

function DraggablePiece({ member, isOnBoard }: DraggablePieceProps) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: member.id,
        data: { member },
    });

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            // touch-none: 모바일 드래그 시 페이지 스크롤 방지
            className={`
        touch-none flex flex-col items-center justify-center 
        rounded-xl cursor-grab active:cursor-grabbing select-none
        transition-all duration-150
        ${isDragging ? "opacity-30 scale-90" : "opacity-100 scale-100"}
        ${isOnBoard ? "w-full h-full" : "w-11 h-11 sm:w-14 sm:h-14"}
      `}
            style={{
                background: `linear-gradient(135deg, ${member.color}cc, ${member.color}88)`,
                boxShadow: isDragging
                    ? "none"
                    : `0 4px 12px ${member.color}66, inset 0 1px 1px rgba(255,255,255,0.3)`,
                border: `2px solid ${member.color}`,
            }}
            title={member.name}
        >
            <span className="text-base sm:text-xl leading-none">{member.emoji}</span>
            <span className="text-[8px] sm:text-[9px] font-bold text-white/90 mt-0.5 truncate max-w-[42px] sm:max-w-[54px]">
                {member.name}
            </span>
        </div>
    );
}

/* ═══════════════════════════════════════════════
   5. 서브 컴포넌트 — DroppableCell (드롭 가능한 셀)
   ═══════════════════════════════════════════════ */

interface DroppableCellProps {
    row: number;
    col: number;
    children?: React.ReactNode;
}

function DroppableCell({ row, col, children }: DroppableCellProps) {
    const cellId = `cell-${row}-${col}`;
    const { setNodeRef, isOver } = useDroppable({ id: cellId });

    return (
        <div
            ref={setNodeRef}
            className={`
        relative flex items-center justify-center
        transition-all duration-200
        border border-white/10
        ${isOver
                    ? "bg-cyan-400/20 border-cyan-400/60 ring-2 ring-cyan-400/50 ring-inset"
                    : "bg-transparent hover:bg-white/5"
                }
      `}
            // 고정 픽셀 제거 → 부모 grid 셀 크기를 100% 따름
            style={{ width: "100%", height: "100%" }}
        >
            <span
                className="absolute top-0.5 left-0.5 text-[6px] sm:text-[8px] text-white/25 pointer-events-none select-none"
                style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
            >
                {String.fromCharCode(65 + col)}{row + 1}
            </span>
            {children}
        </div>
    );
}

/* ═══════════════════════════════════════════════
   6. 서브 컴포넌트 — AnimatedPiece (애니메이션 재생용)
   ═══════════════════════════════════════════════ */

interface AnimatedPieceProps {
    member: AllianceMember;
    position: CellPosition;
}

function AnimatedPiece({ member, position }: AnimatedPieceProps) {
    // 모바일 반응형: 실제 셀 크기는 ANIM_CELL 기준
    const pixel = {
        x: position.col * ANIM_CELL,
        y: position.row * ANIM_CELL,
    };

    return (
        <motion.div
            layoutId={`anim-${member.id}`}
            className="absolute flex flex-col items-center justify-center rounded-lg pointer-events-none"
            style={{
                width: ANIM_CELL - 2,
                height: ANIM_CELL - 2,
                background: `linear-gradient(135deg, ${member.color}cc, ${member.color}88)`,
                boxShadow: `0 4px 16px ${member.color}88, inset 0 1px 1px rgba(255,255,255,0.3)`,
                border: `2px solid ${member.color}`,
            }}
            animate={{ x: pixel.x + 1, y: pixel.y + 1 }}
            transition={{ type: "spring", stiffness: 120, damping: 18, mass: 0.8 }}
        >
            <span className="text-sm leading-none">{member.emoji}</span>
            <span className="text-[7px] font-bold text-white/90 mt-0.5">
                {member.name}
            </span>
        </motion.div>
    );
}

/* ═══════════════════════════════════════════════
   7. 메인 컴포넌트 — StrategyMap
   ═══════════════════════════════════════════════ */

export default function StrategyMap() {
    // ─────── 연맹원 목록 ───────
    const [members] = useState<AllianceMember[]>(INITIAL_MEMBERS);

    // ─────── 현재 배치 상태 ───────
    const [placement, setPlacement] = useState<Placement>({});

    // ─────── 패턴(프레임) 저장소 ───────
    const [patterns, setPatterns] = useState<PatternFrame[]>([]);
    const [description, setDescription] = useState("");

    // ─────── 드래그 오버레이용 ───────
    const [activeDrag, setActiveDrag] = useState<AllianceMember | null>(null);

    // ─────── 애니메이션 재생 모드 ───────
    const [isPlaying, setIsPlaying] = useState(false);
    const [playIndex, setPlayIndex] = useState(0);
    const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ─────── Supabase DB 통신 상태 ───────
    const [isSaving, setIsSaving] = useState(false);   // INSERT 진행 중
    const [isFetching, setIsFetching] = useState(true); // SELECT 진행 중 (초기 로드)
    const [dbError, setDbError] = useState<string | null>(null); // 마지막 에러 메시지

    // ─────── dnd-kit 센서 설정 (PC + 모바일 터치 모두 지원) ───────
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 },
        }),
        useSensor(TouchSensor, {
            // 터치 시 250ms 홀드 OR 5px 이동 후 드래그 시작
            // → 짧은 탭은 드래그로 인식 안 함, 스크롤과 구분
            activationConstraint: { delay: 250, tolerance: 5 },
        })
    );

    /* ──────────────────────────────────
       드래그 시작 핸들러
       ────────────────────────────────── */
    const handleDragStart = useCallback(
        (event: DragStartEvent) => {
            const memberId = event.active.id as string;
            const member = members.find((m) => m.id === memberId);
            if (member) setActiveDrag(member);
        },
        [members]
    );

    /* ──────────────────────────────────
       드래그 종료 핸들러 — 셀에 드롭하면 배치
       ────────────────────────────────── */
    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            setActiveDrag(null);

            const { active, over } = event;
            if (!over) return; // 맵 밖에 드롭

            const memberId = active.id as string;
            const cellId = over.id as string;

            // 셀 위에 드롭한 경우만 처리
            if (!cellId.startsWith("cell-")) return;

            const pos = parseCellId(cellId);
            if (!pos) return;

            // 같은 칸에 다른 유저가 이미 있으면 → 그 유저를 보드에서 제거(스왑 대신 제거)
            setPlacement((prev) => {
                const next = { ...prev };

                // 해당 셀에 이미 있는 유저 찾기
                const occupantId = Object.keys(next).find(
                    (id) => next[id].row === pos.row && next[id].col === pos.col
                );

                // 점유자가 있으면 제거 (자기 자신이 아닌 경우)
                if (occupantId && occupantId !== memberId) {
                    delete next[occupantId];
                }

                // 새 위치에 배치
                next[memberId] = pos;
                return next;
            });
        },
        []
    );

    /* ──────────────────────────────────
     DB에서 패턴 목록 불러오기 (마운트 시 1회 호출)
     ────────────────────────────────── */
    const fetchFramesFromDB = useCallback(async () => {
        setIsFetching(true);
        setDbError(null);
        console.log("[StrategyMap] Supabase에서 패턴 목록을 불러오는 중...");

        const { data, error } = await supabase
            .from("strategy_frames")
            .select("*")
            .order("created_at", { ascending: true });

        if (error) {
            console.error("[StrategyMap] fetchFramesFromDB 실패:", error.message);
            setDbError(`불러오기 실패: ${error.message}`);
            setIsFetching(false);
            return;
        }

        if (data && data.length > 0) {
            // DB 행 → PatternFrame 형식으로 변환
            const loaded: PatternFrame[] = (data as StrategyFrameRow[]).map(
                (row, idx) => ({
                    id: idx + 1,           // UI용 순번 재부여
                    label: row.label,
                    placement: row.placement,
                })
            );
            setPatterns(loaded);
            console.log(`[StrategyMap] ${loaded.length}개 패턴 로드 완료`
            );
        } else {
            console.log("[StrategyMap] 저장된 패턴이 없습니다.");
        }

        setIsFetching(false);
    }, []);

    /* ──────────────────────────────────
       패턴 저장 핸들러 (로컬 State + Supabase INSERT)
       ────────────────────────────────── */
    const handleSavePattern = useCallback(async () => {
        const resolvedLabel = description || `패턴 ${patterns.length + 1}`;
        const resolvedPlacement: Placement = JSON.parse(JSON.stringify(placement)); // deep copy

        // 1) 로컬 State에 즉시 반영 (Optimistic Update)
        const newPattern: PatternFrame = {
            id: patterns.length + 1,
            label: resolvedLabel,
            placement: resolvedPlacement,
        };
        setPatterns((prev) => [...prev, newPattern]);
        setDescription("");

        // 2) Supabase DB에 INSERT
        setIsSaving(true);
        setDbError(null);
        console.log("[StrategyMap] Supabase에 패턴 저장 중...", {
            label: resolvedLabel,
            placement: resolvedPlacement,
        });

        /**
         * ── schema cache miss 방지 ─────────────────────────────────────
         * insert()에 배열 형식을 전달하면 PostgREST가
         * 컬럼 타입을 더 안정적으로 추론합니다.
         * 에러 발생 시 Supabase SQL Editor에서:
         *   1) CREATE TABLE IF NOT EXISTS public.strategy_frames (...) 실행
         *   2) NOTIFY pgrst, 'reload schema'; 실행으로 캐시 갱신
         * ──────────────────────────────────────────────────────────────── */
        const { error } = await supabase
            .from("strategy_frames")
            .insert([
                {
                    label: resolvedLabel,
                    placement: resolvedPlacement,
                },
            ]);

        if (error) {
            console.error("[StrategyMap] INSERT 실패:", error.message);

            // schema cache 관련 에러인지 감지
            const isSchemaErr =
                error.message.includes("schema cache") ||
                error.message.includes("column") ||
                error.message.includes("relation");

            setDbError(
                isSchemaErr
                    ? `저장 실패: Supabase 테이블이 존재하지 않거나 스키마 캐시가 오래됐습니다.\n` +
                    `Supabase SQL Editor에서 strategy_frames 테이블 생성 후 "NOTIFY pgrst, 'reload schema';" 를 실행하세요.\n` +
                    `(원인: ${error.message})`
                    : `저장 실패: ${error.message}`
            );
            // Optimistic Update 롤백
            setPatterns((prev) => prev.filter((p) => p.id !== newPattern.id));
        } else {
            console.log("[StrategyMap] DB 저장 완료 ✅");
        }

        setIsSaving(false);
    }, [patterns.length, description, placement]);

    /* ──────────────────────────────────
       패턴 삭제 핸들러
       ────────────────────────────────── */
    const handleDeletePattern = useCallback((patternId: number) => {
        setPatterns((prev) => prev.filter((p) => p.id !== patternId));
    }, []);

    /* ──────────────────────────────────
       패턴 불러오기 핸들러
       ────────────────────────────────── */
    const handleLoadPattern = useCallback((pattern: PatternFrame) => {
        setPlacement(JSON.parse(JSON.stringify(pattern.placement)));
        setDescription(pattern.label);
    }, []);

    /* ──────────────────────────────────
       보드에서 유저 제거 핸들러
       ────────────────────────────────── */
    const handleRemoveFromBoard = useCallback((memberId: string) => {
        setPlacement((prev) => {
            const next = { ...prev };
            delete next[memberId];
            return next;
        });
    }, []);

    /* ──────────────────────────────────
       애니메이션 재생 로직
       ────────────────────────────────── */
    const handlePlay = useCallback(() => {
        if (patterns.length < 2) return; // 최소 2개 패턴 필요
        setIsPlaying(true);
        setPlayIndex(0);
    }, [patterns.length]);

    const handleStop = useCallback(() => {
        setIsPlaying(false);
        setPlayIndex(0);
        if (playTimerRef.current) {
            clearTimeout(playTimerRef.current);
            playTimerRef.current = null;
        }
    }, []);

    // 재생 모드에서 패턴 순환
    useEffect(() => {
        if (!isPlaying) return;

        if (playIndex >= patterns.length) {
            // 재생 끝 → 정지
            setIsPlaying(false);
            setPlayIndex(0);
            return;
        }

        // 현재 패턴의 설명을 반영
        setDescription(patterns[playIndex].label);

        // 다음 패턴으로 전환 (2.5초 후)
        playTimerRef.current = setTimeout(() => {
            setPlayIndex((prev) => prev + 1);
        }, 2500);

        return () => {
            if (playTimerRef.current) clearTimeout(playTimerRef.current);
        };
    }, [isPlaying, playIndex, patterns]);

    // ─────── 마운트 시 DB에서 패턴 불러오기 ───────
    useEffect(() => {
        fetchFramesFromDB();
    }, [fetchFramesFromDB]);

    // ─────── 배치된 유저 / 미배치 유저 분리 ───────
    const placedMemberIds = Object.keys(placement);
    const unplacedMembers = members.filter((m) => !placedMemberIds.includes(m.id));

    // ─────── 현재 재생 중인 패턴의 배치 데이터 ───────
    const animPlacement =
        isPlaying && patterns[playIndex] ? patterns[playIndex].placement : null;

    /* ═══════════════════════════════════════════════
       렌더링
       ═══════════════════════════════════════════════ */
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-gray-950 text-white flex flex-col items-center py-8 px-4 gap-6">
            {/* ──────── 헤더 ──────── */}
            <header className="text-center space-y-2">
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 bg-clip-text text-transparent">
                    ⚔️ 성검 전투 공략 시뮬레이션
                </h1>
                <p className="text-sm text-slate-400">
                    연맹원을 맵에 배치하고, 패턴을 저장해 전략 움직임을 시뮬레이션하세요.
                </p>
            </header>

            <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                {/* ─── 전체 레이아웃: 모바일=세로(맵 위에 연맹원), PC=가로(좌사이드+맵+우사이드) ─── */}
                <div className="flex flex-col lg:flex-row gap-4 items-start w-full max-w-6xl">

                    {/* ═══════════════════════════════════
             연맹원 패널
             모바일: 맵 위에 가로 스크롤 한 줄
             PC(lg): 좌측 세로 사이드바
             ═══════════════════════════════════ */}
                    <aside className="
                        w-full lg:w-48 lg:flex-shrink-0
                        bg-slate-800/50 backdrop-blur-md rounded-2xl
                        border border-slate-700/60 p-3
                    ">
                        <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                            <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block flex-shrink-0" />
                            연맹원 목록
                        </h2>

                        {/* ── 미배치 연맹원 ── */}
                        {/* 모바일: flex-row + overflow-x-auto (가로 스크롤) */}
                        {/* PC: flex-col (세로 목록) */}
                        <div className="
                            flex flex-row gap-2 overflow-x-auto pb-1
                            lg:flex-col lg:overflow-x-visible lg:pb-0 lg:space-y-2
                            scrollbar-thin
                        ">
                            {unplacedMembers.length === 0 && (
                                <p className="text-xs text-slate-500 italic whitespace-nowrap">
                                    모두 배치됨 ✅
                                </p>
                            )}
                            {unplacedMembers.map((member) => (
                                /* 모바일: 아이콘만 / PC: 아이콘+이름 가로 배치 */
                                <div key={member.id} className="flex-shrink-0 flex flex-col lg:flex-row items-center gap-1 lg:gap-2">
                                    <DraggablePiece member={member} isOnBoard={false} />
                                    <span className="text-[9px] lg:text-xs text-slate-400 whitespace-nowrap">{member.name}</span>
                                </div>
                            ))}
                        </div>

                        {/* ── 배치된 연맹원 (PC 전용, 모바일은 공간 절약을 위해 숨김) ── */}
                        {placedMemberIds.length > 0 && (
                            <div className="hidden lg:block mt-3 space-y-1">
                                <hr className="border-slate-700/50 mb-2" />
                                <h3 className="text-xs font-medium text-slate-400">배치됨 ({placedMemberIds.length})</h3>
                                {placedMemberIds.map((id) => {
                                    const member = members.find((m) => m.id === id);
                                    if (!member) return null;
                                    const pos = placement[id];
                                    return (
                                        <div key={id} className="flex items-center justify-between bg-slate-700/30 rounded-lg px-2 py-1">
                                            <span className="text-xs text-slate-300">{member.emoji} {member.name}</span>
                                            <span className="text-[10px] text-slate-500">
                                                {String.fromCharCode(65 + pos.col)}{pos.row + 1}
                                            </span>
                                            <button
                                                onClick={() => handleRemoveFromBoard(id)}
                                                className="text-[10px] text-rose-400 hover:text-rose-300 transition-colors ml-1"
                                                title="보드에서 제거"
                                            >✕</button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </aside>

                    {/* ═══════════════════════
             중앙: 체스판 맵
             ═══════════════════════ */}
                    <div className="flex-1 flex flex-col items-center gap-4 w-full">
                        {/* 맵 컨테이너 — 모바일: 100% 너비 + aspect-square, PC: 그대로 정사각형 */}
                        <div
                            className="relative w-full rounded-2xl overflow-hidden border-2 border-amber-700/50 shadow-2xl shadow-black/60 touch-none"
                            style={{ aspectRatio: "1 / 1", maxWidth: `${GRID_COLS * CELL_SIZE}px` }}
                        >
                            {/*
               * ── AI ASSET PLACEHOLDER — Runway Gen-2 배경 모션 영상 ──────────
               * 향후 Runway Gen-2(또는 Sora, Pika Labs)로 생성한
               * '성검 전투' 테마의 배경 영상을 아래와 같이 배치할 수 있습니다:
               *
               * <video
               *   autoPlay loop muted playsInline
               *   className="absolute inset-0 w-full h-full object-cover object-center"
               * >
               *   <source src="/videos/holy_sword_bg.mp4" type="video/mp4" />
               * </video>
               *
               * ※ 영상 적용 시 아래 <Image> 태그는 제거하세요.
               * ─────────────────────────────────────────────────────────────── */}

                            {/* ─── 배경 레이어 1: 실제 성검 전투 맵 이미지 ─── */}
                            <Image
                                src="/holy_sword_map.jpg"
                                alt="성검 전투 맵"
                                fill
                                style={{ objectFit: "cover", objectPosition: "center" }}
                                priority
                                draggable={false}
                            />

                            {/* ─── 배경 레이어 2: 가독성을 위한 아주 얇은 어둠 오버레이 ─── */}
                            <div className="absolute inset-0 bg-black/15 pointer-events-none" />

                            {/* ─── 배치 모드: 드롭 가능한 그리드 (이미지 위에 투명하게) ─── */}
                            {!isPlaying && (
                                <div
                                    className="absolute inset-0 z-10 grid touch-none"
                                    style={{
                                        gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
                                        gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
                                    }}
                                >
                                    {Array.from({ length: GRID_ROWS }).map((_, row) =>
                                        Array.from({ length: GRID_COLS }).map((_, col) => {
                                            // 이 칸에 배치된 유저 찾기
                                            const occupantId = Object.keys(placement).find(
                                                (id) =>
                                                    placement[id].row === row && placement[id].col === col
                                            );
                                            const occupant = occupantId
                                                ? members.find((m) => m.id === occupantId)
                                                : null;

                                            return (
                                                <DroppableCell key={`${row}-${col}`} row={row} col={col}>
                                                    {occupant && (
                                                        <DraggablePiece member={occupant} isOnBoard={true} />
                                                    )}
                                                </DroppableCell>
                                            );
                                        })
                                    )}
                                </div>
                            )}

                            {/* ─── 재생 모드: framer-motion 애니메이션 (이미지 위에 오버레이) ─── */}
                            {isPlaying && animPlacement && (
                                <div className="absolute inset-0 z-10">
                                    {/* 애니메이션 말들 — 이미지 배경 그대로 보임 */}
                                    <AnimatePresence>
                                        {Object.entries(animPlacement).map(([memberId, pos]) => {
                                            const member = members.find((m) => m.id === memberId);
                                            if (!member) return null;
                                            return (
                                                <AnimatedPiece
                                                    key={member.id}
                                                    member={member}
                                                    position={pos}
                                                />
                                            );
                                        })}
                                    </AnimatePresence>
                                </div>
                            )}
                        </div>

                        {/* ──────── 설명 입력 + 패턴 저장 ──────── */}
                        <div className="flex flex-col gap-2 w-full max-w-lg">
                            <div className="flex flex-col sm:flex-row items-center gap-3">
                                <input
                                    type="text"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="예: 1페이즈 진형, 우측 러시..."
                                    disabled={isPlaying}
                                    className="flex-1 w-full bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/60 transition-all disabled:opacity-40"
                                />
                                <button
                                    onClick={handleSavePattern}
                                    disabled={isPlaying || placedMemberIds.length === 0 || isSaving}
                                    className="flex-shrink-0 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-cyan-900/40 hover:shadow-cyan-700/50 active:scale-95 flex items-center gap-2 min-w-[140px] justify-center"
                                >
                                    {isSaving ? (
                                        <>
                                            <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                            저장 중...
                                        </>
                                    ) : (
                                        <>📌 패턴 {patterns.length + 1} 저장</>
                                    )}
                                </button>
                            </div>

                            {/*
               * ── AI ASSET PLACEHOLDER — DeepL / ChatGPT API 자동 번역 버튼 ──
               * 입력한 패턴 설명을 글로벌 연맹원을 위해 다국어로 번역합니다.
               * 구현 방법:
               *   1. /app/api/translate/route.ts  (Next.js Route Handler) 생성
               *   2. DeepL API 또는 OpenAI ChatGPT API 호출
               *   3. 아래 버튼 클릭 시 description 값을 POST로 전송
               *   4. 응답받은 번역문을 별도 state에 저장 후 패턴에 함께 기록
               * ─────────────────────────────────────────────────────────────── */}
                            <div className="flex items-center gap-2 px-1">
                                <span className="text-[10px] text-slate-500">🌐 번역 (향후 AI 연동):</span>
                                {["🇺🇸 EN", "🇩🇪 DE", "🇨🇳 ZH"].map((lang) => (
                                    <button
                                        key={lang}
                                        disabled
                                        title="DeepL / ChatGPT API 연동 후 활성화"
                                        className="text-[10px] px-2 py-1 rounded-md bg-slate-700/40 text-slate-500 border border-slate-600/30 cursor-not-allowed opacity-50"
                                    >
                                        {lang}
                                    </button>
                                ))}
                                <span className="text-[9px] text-slate-600 italic">DeepL / ChatGPT API 연동 예정</span>
                            </div>

                            {/* DB 에러 메시지 */}
                            {dbError && (
                                <p className="text-xs text-rose-400 bg-rose-900/20 border border-rose-800/40 rounded-lg px-3 py-2">
                                    ⚠️ {dbError}
                                </p>
                            )}
                        </div>

                        {/* ──────── 재생 컨트롤 ──────── */}
                        <div className="flex items-center gap-3">
                            {!isPlaying ? (
                                <button
                                    onClick={handlePlay}
                                    disabled={patterns.length < 2}
                                    className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-emerald-900/40 hover:shadow-emerald-700/50 active:scale-95 flex items-center gap-2"
                                >
                                    <span className="text-lg">▶</span> 재생
                                </button>
                            ) : (
                                <button
                                    onClick={handleStop}
                                    className="bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-rose-900/40 hover:shadow-rose-700/50 active:scale-95 flex items-center gap-2"
                                >
                                    <span className="text-lg">⏹</span> 정지
                                </button>
                            )}

                            {/* 재생 진행 표시 */}
                            {isPlaying && (
                                <div className="flex items-center gap-2">
                                    {patterns.map((p, idx) => (
                                        <div
                                            key={p.id}
                                            className={`w-3 h-3 rounded-full transition-all duration-300 ${idx === playIndex
                                                ? "bg-cyan-400 scale-125 shadow-lg shadow-cyan-400/60"
                                                : idx < playIndex
                                                    ? "bg-cyan-700"
                                                    : "bg-slate-600"
                                                }`}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ──────── 현재 설명 표시 (재생 중) ──────── */}
                        <AnimatePresence mode="wait">
                            {isPlaying && (
                                <motion.div
                                    key={`desc-${playIndex}`}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.4 }}
                                    className="text-center bg-gradient-to-r from-cyan-900/40 to-blue-900/40 border border-cyan-700/30 backdrop-blur-sm rounded-xl px-6 py-3"
                                >
                                    <p className="text-xs text-cyan-400 font-medium mb-1">
                                        패턴 {playIndex + 1} / {patterns.length}
                                    </p>
                                    <p className="text-base font-semibold text-white">
                                        {patterns[playIndex]?.label}
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* ═══════════════════════
             우측: 저장된 패턴 목록
             ═══════════════════════ */}
                    <aside className="flex-shrink-0 bg-slate-800/50 backdrop-blur-md rounded-2xl border border-slate-700/60 p-4 space-y-3 w-full lg:w-56">
                        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
                            저장된 패턴 ({patterns.length})
                        </h2>

                        {patterns.length === 0 && (
                            <p className="text-xs text-slate-500 italic">
                                아직 저장된 패턴이 없습니다.
                                <br />
                                연맹원을 배치하고 패턴을 저장해 보세요!
                            </p>
                        )}

                        <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                            {patterns.map((pattern) => {
                                const memberCount = Object.keys(pattern.placement).length;
                                return (
                                    <div
                                        key={pattern.id}
                                        className="bg-slate-700/30 border border-slate-600/40 rounded-xl p-3 space-y-2 hover:border-purple-500/40 transition-colors"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-purple-300">
                                                패턴 {pattern.id}
                                            </span>
                                            <span className="text-[10px] text-slate-500">
                                                {memberCount}명 배치
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-300 line-clamp-2">
                                            {pattern.label}
                                        </p>

                                        {/* 미니 프리뷰 — 배치된 유저 아이콘 */}
                                        <div className="flex flex-wrap gap-1">
                                            {Object.keys(pattern.placement).map((mId) => {
                                                const m = members.find((x) => x.id === mId);
                                                if (!m) return null;
                                                return (
                                                    <span
                                                        key={mId}
                                                        className="text-xs rounded-md px-1.5 py-0.5"
                                                        style={{
                                                            background: `${m.color}33`,
                                                            color: m.color,
                                                        }}
                                                    >
                                                        {m.emoji}
                                                    </span>
                                                );
                                            })}
                                        </div>

                                        <div className="flex gap-1.5">
                                            <button
                                                onClick={() => handleLoadPattern(pattern)}
                                                disabled={isPlaying}
                                                className="flex-1 text-[10px] font-medium bg-slate-600/50 hover:bg-slate-500/50 text-slate-300 rounded-lg py-1.5 transition-all disabled:opacity-30"
                                            >
                                                불러오기
                                            </button>
                                            <button
                                                onClick={() => handleDeletePattern(pattern.id)}
                                                disabled={isPlaying}
                                                className="text-[10px] font-medium bg-rose-900/40 hover:bg-rose-800/50 text-rose-400 rounded-lg px-2.5 py-1.5 transition-all disabled:opacity-30"
                                            >
                                                삭제
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </aside>
                </div>

                {/* ═══════════════════════
           드래그 오버레이 (드래그 중 마우스에 따라다니는 고스트)
           ═══════════════════════ */}
                <DragOverlay dropAnimation={null}>
                    {activeDrag && (
                        <div
                            className="flex flex-col items-center justify-center w-14 h-14 rounded-xl shadow-2xl pointer-events-none"
                            style={{
                                background: `linear-gradient(135deg, ${activeDrag.color}ee, ${activeDrag.color}aa)`,
                                border: `2px solid ${activeDrag.color}`,
                                boxShadow: `0 8px 24px ${activeDrag.color}80`,
                            }}
                        >
                            <span className="text-xl">{activeDrag.emoji}</span>
                            <span className="text-[9px] font-bold text-white/90 mt-0.5">
                                {activeDrag.name}
                            </span>
                        </div>
                    )}
                </DragOverlay>
            </DndContext>

            {/* ──────── 사용법 안내 ──────── */}
            <footer className="text-center max-w-lg space-y-1 mt-4">
                <p className="text-xs text-slate-500 leading-relaxed">
                    💡 <strong className="text-slate-400">사용법:</strong> 좌측 연맹원을
                    맵에 드래그 → 설명 입력 → [패턴 저장] → 반복 → [재생]으로
                    전략 시뮬레이션!
                </p>
                <p className="text-[10px] text-slate-600">
                    최소 2개 패턴을 저장하면 재생 버튼이 활성화됩니다.
                </p>
            </footer>
        </div>
    );
}
