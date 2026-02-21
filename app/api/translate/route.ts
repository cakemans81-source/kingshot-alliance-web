import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/translate
 *
 * Body: { text: string; targetLang: "en" | "de" | "zh" }
 * Response: { translatedText: string }
 *
 * MyMemory 무료 번역 API (월 10만 단어 무료, 회원가입 불필요)
 * https://mymemory.translated.net/doc/spec.php
 */

// MyMemory API 언어 코드 매핑
const LANG_MAP: Record<string, string> = {
    ko: "ko",
    en: "en",
    de: "de",
    zh: "zh-CN",
};

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { text, targetLang } = body as { text: string; targetLang: string };

        if (!text || !targetLang) {
            return NextResponse.json({ error: "Missing text or targetLang" }, { status: 400 });
        }

        // 한국어 → 대상 언어
        const langPair = `${LANG_MAP["ko"]}|${LANG_MAP[targetLang] ?? targetLang}`;

        const apiUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`;

        const res = await fetch(apiUrl, {
            headers: { "Accept": "application/json" },
            // 5초 타임아웃
            signal: AbortSignal.timeout(5000),
        });

        if (!res.ok) {
            throw new Error(`MyMemory API responded with ${res.status}`);
        }

        const data = await res.json();

        // MyMemory 응답 구조: { responseData: { translatedText: string }, responseStatus: number }
        if (data.responseStatus !== 200 && data.responseStatus !== "200") {
            throw new Error(`MyMemory error: ${data.responseDetails ?? "unknown"}`);
        }

        const translatedText: string = data.responseData?.translatedText ?? text;

        return NextResponse.json({ translatedText });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[/api/translate] 번역 오류:", msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
