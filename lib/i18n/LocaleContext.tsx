"use client";

import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    type ReactNode,
} from "react";
import type { Dictionary } from "@/lib/i18n/dictionaries/ko";
import koDic from "@/lib/i18n/dictionaries/ko";

export type LocaleCode = "ko" | "en" | "de" | "zh";

const STORAGE_KEY = "kdh-locale";

/* ── 사전 동적 로드 ── */
async function loadDictionary(locale: LocaleCode): Promise<Dictionary> {
    switch (locale) {
        case "en": return (await import("@/lib/i18n/dictionaries/en")).default;
        case "de": return (await import("@/lib/i18n/dictionaries/de")).default;
        case "zh": return (await import("@/lib/i18n/dictionaries/zh")).default;
        default: return koDic;
    }
}

/* ── Context 타입 ── */
interface LocaleContextValue {
    locale: LocaleCode;
    t: Dictionary;
    setLocale: (code: LocaleCode) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
    locale: "ko",
    t: koDic,
    setLocale: () => { },
});

/* ── Provider ── */
export function LocaleProvider({ children }: { children: ReactNode }) {
    const [locale, setLocaleState] = useState<LocaleCode>("ko");
    const [t, setT] = useState<Dictionary>(koDic);

    /* 저장된 언어 복원 */
    useEffect(() => {
        const saved = (localStorage.getItem(STORAGE_KEY) ?? "ko") as LocaleCode;
        if (saved !== "ko") {
            setLocaleState(saved);
            loadDictionary(saved).then(setT);
        }
    }, []);

    const setLocale = useCallback((code: LocaleCode) => {
        setLocaleState(code);
        localStorage.setItem(STORAGE_KEY, code);
        loadDictionary(code).then(setT);
    }, []);

    return (
        <LocaleContext.Provider value={{ locale, t, setLocale }}>
            {children}
        </LocaleContext.Provider>
    );
}

/* ── 훅 ── */
export function useLocale() {
    return useContext(LocaleContext);
}
