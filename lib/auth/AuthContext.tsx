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

    /* 저장된 세션 복원 */
    useEffect(() => {
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (raw) setUser(JSON.parse(raw) as AuthUser);
        } catch { /* ignore */ }
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
