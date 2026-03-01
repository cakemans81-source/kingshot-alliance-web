"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/lib/supabase/client";

/* ═══════════════════════════════════════
   타입
   ═══════════════════════════════════════ */
interface EventConfig {
    id: number;
    title: string;           // 이벤트 이름 (예: "성검전투 7회차")
    description: string;     // 상단 설명 텍스트
    columns: string[];       // 15개 열 레이블 (예: ["3/1", "3/2", ...])
}

interface AttendanceRecord {
    id?: number;
    event_id: number;
    member_name: string;
    slot_index: number;      // 0~14 (열 번호)
    status: "attend" | "absent" | "unknown";
}

interface Member {
    id: string;
    name: string;
    memo: string;
}

const DEFAULT_COLUMNS = Array.from({ length: 15 }, (_, i) => `${i + 1}회차`);
const STATUS_STYLES = {
    attend: { bg: "rgba(16,185,129,0.25)", border: "rgba(16,185,129,0.5)", text: "#34d399", label: "✓" },
    absent: { bg: "rgba(239,68,68,0.2)", border: "rgba(239,68,68,0.4)", text: "#f87171", label: "✗" },
    unknown: { bg: "rgba(30,41,59,0.4)", border: "rgba(51,65,85,0.3)", text: "#475569", label: "—" },
};

/* ═══════════════════════════════════════
   메인 컴포넌트
   ═══════════════════════════════════════ */
export default function EventAttendanceClient() {
    const { user } = useAuth();
    const isAdmin = user?.role === "admin";

    /* ── 상태 ── */
    const [events, setEvents] = useState<EventConfig[]>([]);
    const [activeEventId, setActiveEventId] = useState<number | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);

    /* 이벤트 설정 편집 */
    const [editingEvent, setEditingEvent] = useState(false);
    const [editTitle, setEditTitle] = useState("");
    const [editDesc, setEditDesc] = useState("");
    const [editCols, setEditCols] = useState<string[]>([...DEFAULT_COLUMNS]);

    /* 새 이벤트 추가 모달 */
    const [showNewEvent, setShowNewEvent] = useState(false);
    const [newTitle, setNewTitle] = useState("");

    /* ── 데이터 로드 ── */
    const fetchData = useCallback(async () => {
        setLoading(true);
        // 이벤트 목록
        const { data: evData } = await supabase
            .from("kdh_events")
            .select("*")
            .order("id", { ascending: false });
        const evList: EventConfig[] = (evData ?? []).map((r: Record<string, unknown>) => ({
            id: r.id as number,
            title: r.title as string,
            description: r.description as string ?? "",
            columns: (r.columns as string[]) ?? [...DEFAULT_COLUMNS],
        }));
        setEvents(evList);

        // 연맹원 목록
        const { data: mData } = await supabase
            .from("kdh_players")
            .select("id, name, memo")
            .order("name");
        setMembers((mData as Member[]) ?? []);

        // 기본 이벤트 선택
        if (evList.length > 0) {
            const firstId = evList[0].id;
            setActiveEventId(firstId);
            const { data: atData } = await supabase
                .from("kdh_attendance")
                .select("*")
                .eq("event_id", firstId);
            setAttendance((atData as AttendanceRecord[]) ?? []);
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    /* 이벤트 전환 시 출석 데이터 로드 */
    const switchEvent = useCallback(async (evId: number) => {
        setActiveEventId(evId);
        const { data } = await supabase.from("kdh_attendance").select("*").eq("event_id", evId);
        setAttendance((data as AttendanceRecord[]) ?? []);
    }, []);

    /* ── 출석 상태 토글 ── */
    const toggleStatus = useCallback(async (memberName: string, slotIndex: number) => {
        if (!isAdmin || activeEventId === null) return;
        const existing = attendance.find(a => a.member_name === memberName && a.slot_index === slotIndex);
        const order: AttendanceRecord["status"][] = ["unknown", "attend", "absent"];
        const nextStatus = order[(order.indexOf(existing?.status ?? "unknown") + 1) % 3];

        // Optimistic UI
        setAttendance(prev => {
            const filtered = prev.filter(a => !(a.member_name === memberName && a.slot_index === slotIndex));
            return [...filtered, { event_id: activeEventId, member_name: memberName, slot_index: slotIndex, status: nextStatus }];
        });

        if (existing?.id) {
            await supabase.from("kdh_attendance").update({ status: nextStatus }).eq("id", existing.id);
        } else {
            const { data } = await supabase.from("kdh_attendance")
                .insert({ event_id: activeEventId, member_name: memberName, slot_index: slotIndex, status: nextStatus })
                .select();
            if (data?.[0]) {
                setAttendance(prev => prev.map(a =>
                    a.member_name === memberName && a.slot_index === slotIndex ? { ...a, id: data[0].id } : a
                ));
            }
        }
    }, [isAdmin, activeEventId, attendance]);

    /* ── 이벤트 설정 저장 ── */
    const saveEventConfig = async () => {
        if (!activeEventId) return;
        await supabase.from("kdh_events")
            .update({ title: editTitle, description: editDesc, columns: editCols })
            .eq("id", activeEventId);
        setEvents(prev => prev.map(e => e.id === activeEventId
            ? { ...e, title: editTitle, description: editDesc, columns: editCols } : e));
        setEditingEvent(false);
    };

    /* ── 새 이벤트 생성 ── */
    const createEvent = async () => {
        if (!newTitle.trim()) return;
        const { data } = await supabase.from("kdh_events")
            .insert({ title: newTitle.trim(), description: "", columns: [...DEFAULT_COLUMNS] })
            .select();
        if (data?.[0]) {
            const ev: EventConfig = { id: data[0].id, title: data[0].title, description: "", columns: [...DEFAULT_COLUMNS] };
            setEvents(prev => [ev, ...prev]);
            setActiveEventId(ev.id);
            setAttendance([]);
        }
        setNewTitle(""); setShowNewEvent(false);
    };

    /* ── 이벤트 삭제 ── */
    const deleteEvent = async (evId: number) => {
        if (!confirm("이 이벤트를 삭제하시겠습니까?")) return;
        await supabase.from("kdh_attendance").delete().eq("event_id", evId);
        await supabase.from("kdh_events").delete().eq("id", evId);
        const remaining = events.filter(e => e.id !== evId);
        setEvents(remaining);
        if (remaining.length > 0) { switchEvent(remaining[0].id); }
        else { setActiveEventId(null); setAttendance([]); }
    };

    /* ── 계산 ── */
    const activeEvent = events.find(e => e.id === activeEventId);
    const getStatus = (name: string, slot: number): AttendanceRecord["status"] =>
        attendance.find(a => a.member_name === name && a.slot_index === slot)?.status ?? "unknown";
    const getSlotStats = (slot: number) => ({
        attend: attendance.filter(a => a.slot_index === slot && a.status === "attend").length,
        absent: attendance.filter(a => a.slot_index === slot && a.status === "absent").length,
    });
    const getMemberStats = (name: string) => ({
        attend: attendance.filter(a => a.member_name === name && a.status === "attend").length,
        absent: attendance.filter(a => a.member_name === name && a.status === "absent").length,
    });

    /* ═══════════════ RENDER ═══════════════ */
    return (
        <div className="min-h-screen pt-20 pb-16 px-4" style={{ background: "linear-gradient(to bottom right, #020617, #0f172a 50%, #020617)" }}>
            <div className="max-w-[1400px] mx-auto">

                {/* ── 페이지 헤더 ── */}
                <div className="mb-8 text-center">
                    <h1 className="text-2xl font-extrabold mb-1" style={{ background: "linear-gradient(135deg,#fbbf24,#f59e0b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                        📋 연맹 이벤트 참여 현황
                    </h1>
                    <p className="text-sm text-slate-500">연맹원 이벤트 참석/불참 현황 관리</p>
                </div>

                {/* ── 이벤트 탭 바 ── */}
                <div className="flex items-center gap-2 mb-6 flex-wrap">
                    {events.map(ev => (
                        <button key={ev.id}
                            onClick={() => switchEvent(ev.id)}
                            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:brightness-110"
                            style={{
                                background: activeEventId === ev.id ? "rgba(251,191,36,0.2)" : "rgba(30,41,59,0.6)",
                                border: `1px solid ${activeEventId === ev.id ? "rgba(251,191,36,0.5)" : "rgba(51,65,85,0.4)"}`,
                                color: activeEventId === ev.id ? "#fbbf24" : "#94a3b8",
                            }}>
                            {ev.title}
                        </button>
                    ))}
                    {isAdmin && (
                        <button onClick={() => setShowNewEvent(true)}
                            className="px-3 py-2 rounded-xl text-sm font-semibold transition-all hover:brightness-110"
                            style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.35)", color: "#a5b4fc" }}>
                            ＋ 새 이벤트
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="text-center py-20 text-slate-500">데이터 로딩 중...</div>
                ) : activeEvent ? (
                    <>
                        {/* ── 이벤트 설명 패널 ── */}
                        <div className="mb-6 rounded-2xl p-5" style={{ background: "rgba(15,23,42,0.8)", border: "1px solid rgba(51,65,85,0.4)", backdropFilter: "blur(12px)" }}>
                            {editingEvent ? (
                                /* 편집 모드 */
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-[11px] text-slate-500 font-bold mb-1">이벤트 제목</label>
                                        <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                                            className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
                                            style={{ background: "rgba(7,13,26,0.8)", border: "1px solid rgba(251,191,36,0.4)" }} />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] text-slate-500 font-bold mb-1">이벤트 설명 / 공지</label>
                                        <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={4}
                                            placeholder="이벤트 규칙, 일정, 참고사항 등을 입력하세요..."
                                            className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none resize-none"
                                            style={{ background: "rgba(7,13,26,0.8)", border: "1px solid rgba(51,65,85,0.5)" }} />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] text-slate-500 font-bold mb-2">열 이름 (1~15)</label>
                                        <div className="grid grid-cols-5 gap-1.5">
                                            {editCols.map((col, i) => (
                                                <input key={i} value={col} onChange={e => {
                                                    const next = [...editCols]; next[i] = e.target.value; setEditCols(next);
                                                }}
                                                    className="rounded-lg px-2 py-1.5 text-xs text-white outline-none text-center"
                                                    style={{ background: "rgba(7,13,26,0.8)", border: "1px solid rgba(51,65,85,0.5)" }}
                                                    placeholder={`${i + 1}회`} />
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 pt-1">
                                        <button onClick={saveEventConfig}
                                            className="px-4 py-2 rounded-xl text-sm font-bold transition-all hover:brightness-110"
                                            style={{ background: "linear-gradient(135deg,#d97706,#f59e0b)", color: "#0d1829" }}>
                                            ✓ 저장
                                        </button>
                                        <button onClick={() => setEditingEvent(false)}
                                            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white transition-colors"
                                            style={{ background: "rgba(30,41,59,0.6)", border: "1px solid rgba(51,65,85,0.4)" }}>
                                            취소
                                        </button>
                                        {isAdmin && (
                                            <button onClick={() => deleteEvent(activeEvent.id)}
                                                className="ml-auto px-3 py-2 rounded-xl text-sm font-medium text-red-400 hover:text-red-300 transition-colors"
                                                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
                                                🗑️ 이벤트 삭제
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                /* 보기 모드 */
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <h2 className="text-lg font-bold mb-2" style={{ color: "#fbbf24" }}>{activeEvent.title}</h2>
                                        {activeEvent.description ? (
                                            <p className="text-sm text-slate-400 whitespace-pre-wrap leading-relaxed">{activeEvent.description}</p>
                                        ) : (
                                            <p className="text-sm text-slate-600 italic">이벤트 설명이 없습니다. {isAdmin ? "편집 버튼으로 추가하세요." : ""}</p>
                                        )}
                                    </div>
                                    {isAdmin && (
                                        <button onClick={() => { setEditTitle(activeEvent.title); setEditDesc(activeEvent.description); setEditCols([...activeEvent.columns]); setEditingEvent(true); }}
                                            className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:brightness-110"
                                            style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.35)", color: "#a5b4fc" }}>
                                            ✏️ 편집
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* ── 범례 ── */}
                        <div className="flex items-center gap-4 mb-4 text-[11px] text-slate-500">
                            <span className="font-bold">범례:</span>
                            {Object.entries(STATUS_STYLES).map(([k, v]) => (
                                <span key={k} className="flex items-center gap-1.5">
                                    <span className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold"
                                        style={{ background: v.bg, border: `1px solid ${v.border}`, color: v.text }}>
                                        {v.label}
                                    </span>
                                    {k === "attend" ? "참석" : k === "absent" ? "불참" : "미정"}
                                </span>
                            ))}
                            {isAdmin && <span className="text-slate-600">· 셀 클릭으로 상태 변경</span>}
                        </div>

                        {/* ── 참여 현황 테이블 ── */}
                        <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(10,18,35,0.95)", border: "1px solid rgba(51,65,85,0.4)", backdropFilter: "blur(12px)" }}>
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse" style={{ minWidth: 900 }}>
                                    <thead>
                                        {/* 열 통계 행 */}
                                        <tr style={{ background: "rgba(15,23,42,0.8)", borderBottom: "2px solid rgba(51,65,85,0.5)" }}>
                                            <th className="sticky left-0 z-10 text-left px-4 py-3 text-[11px] font-bold text-slate-500 whitespace-nowrap"
                                                style={{ background: "rgba(10,18,35,0.98)", minWidth: 140, borderRight: "1px solid rgba(51,65,85,0.4)" }}>
                                                연맹원 / 회차
                                            </th>
                                            {activeEvent.columns.map((col, i) => (
                                                <th key={i} className="px-2 py-3 text-center" style={{ minWidth: 64 }}>
                                                    <div className="text-[10px] font-bold text-slate-300 mb-1">{col}</div>
                                                    <div className="flex gap-1 justify-center text-[9px]">
                                                        <span style={{ color: "#34d399" }}>✓{getSlotStats(i).attend}</span>
                                                        <span style={{ color: "#f87171" }}>✗{getSlotStats(i).absent}</span>
                                                    </div>
                                                </th>
                                            ))}
                                            <th className="px-3 py-3 text-center text-[10px] font-bold text-slate-500 whitespace-nowrap" style={{ minWidth: 80 }}>합계</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {members.length === 0 ? (
                                            <tr>
                                                <td colSpan={17} className="text-center py-12 text-slate-600 text-sm">
                                                    연맹원 데이터가 없습니다. (KDH 그리드에 연맹원을 먼저 추가하세요)
                                                </td>
                                            </tr>
                                        ) : members.map((m, mi) => {
                                            const stats = getMemberStats(m.name);
                                            return (
                                                <tr key={m.id}
                                                    style={{
                                                        background: mi % 2 === 0 ? "rgba(15,23,42,0.3)" : "transparent",
                                                        borderBottom: "1px solid rgba(30,41,59,0.5)",
                                                    }}
                                                    className="hover:brightness-110 transition-all">
                                                    {/* 연맹원 이름 (고정 컬럼) */}
                                                    <td className="sticky left-0 z-10 px-4 py-2.5"
                                                        style={{ background: mi % 2 === 0 ? "rgba(10,18,35,0.97)" : "rgba(10,18,35,0.95)", borderRight: "1px solid rgba(51,65,85,0.3)", minWidth: 140 }}>
                                                        <div className="text-xs font-bold text-slate-200 truncate max-w-[120px]">{m.name}</div>
                                                        {m.memo && <div className="text-[9px] text-slate-600 truncate">{m.memo}</div>}
                                                    </td>
                                                    {/* 15개 슬롯 */}
                                                    {activeEvent.columns.map((_, si) => {
                                                        const st = getStatus(m.name, si);
                                                        const sty = STATUS_STYLES[st];
                                                        return (
                                                            <td key={si} className="px-2 py-2 text-center">
                                                                <button
                                                                    onClick={() => toggleStatus(m.name, si)}
                                                                    disabled={!isAdmin}
                                                                    className="w-full h-7 rounded-lg text-xs font-bold transition-all hover:brightness-125 active:scale-95 disabled:cursor-default"
                                                                    style={{
                                                                        background: sty.bg,
                                                                        border: `1px solid ${sty.border}`,
                                                                        color: sty.text,
                                                                        minWidth: 48,
                                                                    }}>
                                                                    {sty.label}
                                                                </button>
                                                            </td>
                                                        );
                                                    })}
                                                    {/* 합계 */}
                                                    <td className="px-3 py-2 text-center">
                                                        <div className="text-[10px] font-mono">
                                                            <span style={{ color: "#34d399" }}>✓{stats.attend}</span>
                                                            {" / "}
                                                            <span style={{ color: "#f87171" }}>✗{stats.absent}</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                ) : (
                    /* 이벤트 없을 때 */
                    <div className="text-center py-20 rounded-2xl" style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(51,65,85,0.4)" }}>
                        <p className="text-slate-500 mb-4">등록된 이벤트가 없습니다.</p>
                        {isAdmin && (
                            <button onClick={() => setShowNewEvent(true)}
                                className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:brightness-110"
                                style={{ background: "linear-gradient(135deg,#d97706,#f59e0b)", color: "#0d1829" }}>
                                ＋ 첫 이벤트 만들기
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ── 새 이벤트 모달 ── */}
            {showNewEvent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
                    onClick={e => { if (e.target === e.currentTarget) setShowNewEvent(false); }}>
                    <div className="w-80 rounded-2xl p-6" style={{ background: "#0d1829", border: "1px solid rgba(251,191,36,0.4)", boxShadow: "0 24px 64px rgba(0,0,0,0.7)" }}>
                        <h3 className="text-base font-bold mb-4" style={{ color: "#fbbf24" }}>📋 새 이벤트 추가</h3>
                        <div className="mb-4">
                            <label className="block text-[11px] text-slate-500 font-bold mb-1">이벤트 제목</label>
                            <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") createEvent(); }}
                                placeholder="예: 성검전투 3월 1주차"
                                autoFocus
                                className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
                                style={{ background: "rgba(7,13,26,0.8)", border: "1px solid rgba(251,191,36,0.4)" }} />
                        </div>
                        <div className="flex gap-2">
                            <button onClick={createEvent}
                                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:brightness-110"
                                style={{ background: "linear-gradient(135deg,#d97706,#f59e0b)", color: "#0d1829" }}>
                                ✓ 생성
                            </button>
                            <button onClick={() => { setShowNewEvent(false); setNewTitle(""); }}
                                className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white transition-colors"
                                style={{ background: "rgba(30,41,59,0.6)", border: "1px solid rgba(51,65,85,0.4)" }}>
                                취소
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
