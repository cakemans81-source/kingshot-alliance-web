"use client";

import KdhGrid from "@/components/KdhGrid";
import type { Player, Structure, SimChanges } from "@/components/KdhGrid";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/lib/supabase/client";

export default function KdhGridSimPage() {
    const { t } = useLocale();
    const { user } = useAuth();
    const isAdmin = user?.role === "admin";

    const handleApply = async (_players: Player[], _structures: Structure[], changes: SimChanges) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ops: PromiseLike<any>[] = [];

        // 1. 삭제된 플레이어
        if (changes.playersDeleted.length > 0) {
            ops.push(
                supabase.from("kdh_players").delete()
                    .in("id", changes.playersDeleted.map(Number))
            );
        }

        // 2. 수정된 플레이어 (좌표/이름/메모)
        for (const p of changes.playersUpdated) {
            ops.push(
                supabase.from("kdh_players")
                    .update({ x: p.x, y: p.y, name: p.name, memo: p.memo || null })
                    .eq("id", Number(p.id))
            );
        }

        // 3. 추가된 플레이어 (sim_ ID 제거, Supabase 자동 생성)
        if (changes.playersAdded.length > 0) {
            ops.push(
                supabase.from("kdh_players").insert(
                    changes.playersAdded.map(p => ({
                        name: p.name, x: p.x, y: p.y, memo: p.memo || null,
                    }))
                )
            );
        }

        // 4. 변경/추가된 구조물
        for (const s of changes.structuresUpserted) {
            ops.push(
                supabase.from("kdh_structures").upsert({
                    struct_id: s.id,
                    struct_type: s.type,
                    label: s.label,
                    x: s.x,
                    y: s.y,
                    size: s.size,
                }, { onConflict: "struct_id" })
            );
        }

        // 5. 삭제된 구조물
        if (changes.structuresDeleted.length > 0) {
            ops.push(
                supabase.from("kdh_structures").delete()
                    .in("struct_id", changes.structuresDeleted)
            );
        }

        const results = await Promise.allSettled(ops);
        const failures = results.filter(r => r.status === "rejected");
        if (failures.length > 0) {
            alert("일부 변경 사항 적용에 실패했습니다. 콘솔을 확인해주세요.");
            console.error("Apply failures:", failures);
        } else {
            alert("적용 완료! 실제 좌표 그리드에 반영되었습니다.");
        }
    };

    if (!isAdmin) {
        return (
            <div className="relative min-h-screen bg-slate-950 text-white flex items-center justify-center">
                <p className="text-slate-400">관리자만 접근할 수 있습니다.</p>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen bg-slate-950 text-white">
            {/* 배경 그라데이션 */}
            <div
                aria-hidden
                className="pointer-events-none fixed inset-0 z-0"
                style={{
                    background: `
                        radial-gradient(ellipse 70% 50% at 60% 20%, rgba(245,158,11,0.08) 0%, transparent 60%),
                        radial-gradient(ellipse 50% 40% at 20% 70%, rgba(239,68,68,0.06) 0%, transparent 60%),
                        linear-gradient(to bottom right, #020617, #0f172a 50%, #020617)
                    `,
                }}
            />

            <section className="relative z-10 mx-auto max-w-2xl px-4 pt-8 pb-24 sm:px-6">
                {/* 페이지 헤더 */}
                <div className="text-center mb-6">
                    <div
                        className="mb-3 inline-flex items-center gap-2 rounded-full border px-3.5 py-1 text-[11px] font-semibold tracking-widest uppercase"
                        style={{
                            background: "rgba(245,158,11,0.08)",
                            borderColor: "rgba(245,158,11,0.28)",
                            color: "#fbbf24",
                        }}
                    >
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        SIMULATION
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight">
                        <span
                            className="block bg-clip-text text-transparent"
                            style={{
                                backgroundImage: "linear-gradient(135deg, #f59e0b 0%, #ef4444 50%, #ec4899 100%)",
                                filter: "drop-shadow(0 0 14px rgba(245,158,11,0.4))",
                            }}
                        >
                            {t.kdhPage.simPageTitle || "좌표 배치 시뮬레이션"}
                        </span>
                    </h1>
                    <p className="mt-2 text-sm text-slate-400">
                        {t.kdhPage.simPageDesc || "실제 데이터에 영향 없이 배치를 연습합니다. 완료 후 '적용' 버튼을 누르세요."}
                    </p>
                </div>

                {/* 시뮬레이션 그리드 */}
                <KdhGrid mode="simulation" onSimApply={handleApply} />
            </section>
        </div>
    );
}
