import { createClient } from "@supabase/supabase-js";

/**
 * Supabase 클라이언트 싱글턴
 *
 * ─ NEXT_PUBLIC_ 접두사가 붙은 변수는 브라우저에도 노출됩니다.
 * ─ 서버 사이드(Server Actions, Route Handlers)에서는
 *   서비스 역할 키(SERVICE_ROLE_KEY)를 사용하는 별도의 admin 클라이언트를 만들어야 하지만,
 *   이 파일은 클라이언트 컴포넌트("use client")에서만 사용합니다.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        "[Supabase] 환경 변수가 설정되지 않았습니다.\n" +
        ".env.local 파일에 NEXT_PUBLIC_SUPABASE_URL 과 NEXT_PUBLIC_SUPABASE_ANON_KEY 를 추가해 주세요."
    );
}

/**
 * ── 스키마 캐시 오류(schema cache miss) 방지 ──────────────────────────
 * `db: { schema: "public" }` 를 명시하면 PostgREST가
 * 정확히 public 스키마를 바라보도록 강제합니다.
 * "Could not find the 'label' column of 'strategy_frames' in the schema cache"
 * 에러는 대부분 테이블이 없거나, 스키마 캐시가 비어 있을 때 발생합니다.
 * ─────────────────────────────────────────────────────────────────────── */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    db: { schema: "public" },
    auth: { persistSession: false },
});

/* ─────────────────────────────────────────────
   DB 타입 정의 (strategy_frames 테이블 스키마 반영)
   ─────────────────────────────────────────────

   ⚠️  반드시 Supabase 대시보드 → SQL Editor에서 아래 SQL을 실행해야 합니다.
   테이블이 존재하지 않으면 schema cache 에러가 계속 발생합니다.

   ── 테이블 생성 (처음 실행 시) ──────────────────────────────────────

   CREATE TABLE IF NOT EXISTS public.strategy_frames (
     id          BIGSERIAL    PRIMARY KEY,
     label       TEXT         NOT NULL DEFAULT '',
     placement   JSONB        NOT NULL DEFAULT '{}',
     created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
   );

   ── Row Level Security ────────────────────────────────────────────────

   ALTER TABLE public.strategy_frames ENABLE ROW LEVEL SECURITY;

   -- 기존 정책이 있으면 삭제 후 재생성
   DROP POLICY IF EXISTS "allow_read"   ON public.strategy_frames;
   DROP POLICY IF EXISTS "allow_insert" ON public.strategy_frames;

   CREATE POLICY "allow_read"   ON public.strategy_frames FOR SELECT USING (true);
   CREATE POLICY "allow_insert" ON public.strategy_frames FOR INSERT WITH CHECK (true);

   ── 스키마 캐시 강제 갱신 (위 SQL 실행 후 이것도 실행) ────────────────

   NOTIFY pgrst, 'reload schema';

   ─────────────────────────────────────────────────────────────────── */

export interface StrategyFrameRow {
    id: number;
    label: string;
    /** { "m1": { "row": 2, "col": 3 }, ... } 형태의 JSON */
    placement: Record<string, { row: number; col: number }>;
    created_at: string;
}
