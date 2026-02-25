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
const FIRST_VISIT_KEY = "kdh-locale-set";

/* ── 지원 언어 매핑 ── */
const SUPPORTED: Record<string, LocaleCode> = {
    ko: "ko",
    en: "en",
    de: "de",
    zh: "zh",
};

/* 브라우저 언어 → 지원 언어 코드 */
function detectBrowserLocale(): LocaleCode {
    if (typeof navigator === "undefined") return "ko";
    const langs = navigator.languages || [navigator.language];
    for (const lang of langs) {
        const code = lang.toLowerCase().split("-")[0];
        if (SUPPORTED[code]) return SUPPORTED[code];
    }
    return "ko";
}

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

    /* 저장된 언어 복원 또는 브라우저 언어 자동 감지 */
    useEffect(() => {
        const hasVisited = localStorage.getItem(FIRST_VISIT_KEY);
        const saved = localStorage.getItem(STORAGE_KEY) as LocaleCode | null;

        if (saved) {
            // 이미 언어를 선택한 적이 있으면 복원
            if (saved !== "ko") {
                setLocaleState(saved);
                loadDictionary(saved).then(setT);
            }
        } else if (!hasVisited) {
            // 첫 방문: 브라우저 언어 자동 감지
            const detected = detectBrowserLocale();
            localStorage.setItem(FIRST_VISIT_KEY, "1");
            if (detected !== "ko") {
                setLocaleState(detected);
                localStorage.setItem(STORAGE_KEY, detected);
                loadDictionary(detected).then(setT);
            }
        }
    }, []);

    const setLocale = useCallback((code: LocaleCode) => {
        setLocaleState(code);
        localStorage.setItem(STORAGE_KEY, code);
        localStorage.setItem(FIRST_VISIT_KEY, "1");
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
