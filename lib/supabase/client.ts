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

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/* ─────────────────────────────────────────────
   DB 타입 정의 (strategy_frames 테이블 스키마 반영)
   ─────────────────────────────────────────────

   Supabase에서 아래 SQL로 테이블을 생성하세요 (대시보드 → SQL Editor):

   CREATE TABLE strategy_frames (
     id          BIGSERIAL PRIMARY KEY,
     label       TEXT        NOT NULL DEFAULT '',
     placement   JSONB       NOT NULL DEFAULT '{}',
     created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );

   -- 모든 사용자가 읽기 가능 (공개 공략 데이터)
   ALTER TABLE strategy_frames ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "allow_read"  ON strategy_frames FOR SELECT USING (true);
   CREATE POLICY "allow_insert" ON strategy_frames FOR INSERT WITH CHECK (true);
   ───────────────────────────────────────────── */

export interface StrategyFrameRow {
    id: number;
    label: string;
    /** { "m1": { "row": 2, "col": 3 }, ... } 형태의 JSON */
    placement: Record<string, { row: number; col: number }>;
    created_at: string;
}
