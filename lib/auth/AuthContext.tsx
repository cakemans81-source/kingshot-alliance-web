"use client";

/**
 * AuthContext — 로그인 세션 전역 관리
 *
 * localStorage 키: kdh_user
 * 저장 구조: { id, game_id, nickname, bio, role }
 */

import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    type ReactNode,
} from "react";

/* ── 타입 ── */
export type UserRole = "member" | "staff" | "admin";

export interface AuthUser {
    id: number;
    game_id: string;
    nickname: string;
    bio: string | null;
    avatar_url: string | null;
    role: UserRole;
}

interface AuthContextValue {
    user: AuthUser | null;
    login: (u: AuthUser) => void;
    logout: () => void;
    updateUser: (partial: Partial<AuthUser>) => void;
}

const LS_KEY = "kdh_user";

const AuthContext = createContext<AuthContextValue>({
    user: null,
    login: () => { },
    logout: () => { },
    updateUser: () => { },
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);

    /* 저장된 세션 복원 + DB에서 최신 role 재확인 */
    useEffect(() => {
        (async () => {
            try {
                const raw = localStorage.getItem(LS_KEY);
                if (!raw) return;
                const cached = JSON.parse(raw) as AuthUser;
                setUser(cached); // 우선 캐시로 빠르게 복원

                // DB에서 최신 role 확인 (관리자가 바꿨을 경우를 위해)
                const { data } = await import("@/lib/supabase/client").then(m =>
                    m.supabase.from("users").select("role").eq("id", cached.id).maybeSingle()
                );
                if (data && data.role !== cached.role) {
                    // role이 바뀌었으면 업데이트
                    const updated = { ...cached, role: data.role as UserRole };
                    setUser(updated);
                    try { localStorage.setItem(LS_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
                }
            } catch { /* ignore */ }
        })();
    }, []);


    const login = useCallback((u: AuthUser) => {
        setUser(u);
        try { localStorage.setItem(LS_KEY, JSON.stringify(u)); } catch { /* ignore */ }
    }, []);

    const logout = useCallback(() => {
        setUser(null);
        try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
    }, []);

    const updateUser = useCallback((partial: Partial<AuthUser>) => {
        setUser((prev) => {
            if (!prev) return prev;
            const next = { ...prev, ...partial };
            try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
            return next;
        });
    }, []);

    return (
        <AuthContext.Provider value={{ user, login, logout, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
