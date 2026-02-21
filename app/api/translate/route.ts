import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/translate
 *
 * Body: { text: string; targetLang: string; sourceLang?: string }
 * Response: { translatedText: string }
 *
 * MyMemory 무료 번역 API — 양방향 지원
 * - sourceLang 생략 시 "auto" (자동 감지)
 * - 한→영, 영→한, 중→한, 한→중 모두 지원
 *
 * https://mymemory.translated.net/doc/spec.php
 */

const LANG_MAP: Record<string, string> = {
    ko: "ko",
    en: "en",
    de: "de",
    zh: "zh-CN",
    ja: "ja",
    auto: "auto",          // MyMemory 자동 감지
};

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { text, targetLang, sourceLang } = body as {
            text: string;
            targetLang: string;
            sourceLang?: string;     // 없으면 auto
        };

        if (!text?.trim() || !targetLang) {
            return NextResponse.json({ error: "Missing text or targetLang" }, { status: 400 });
        }

        /* 이미 대상 언어로 쓰인 텍스트를 다시 번역하지 않도록 (같은 언어면 원문 반환) */
        const resolvedSource = LANG_MAP[sourceLang ?? "auto"] ?? "auto";
        const resolvedTarget = LANG_MAP[targetLang] ?? targetLang;

        /* src === target 이면 그냥 원문 반환 */
        if (resolvedSource !== "auto" && resolvedSource === resolvedTarget) {
            return NextResponse.json({ translatedText: text });
        }

        /*
         * MyMemory langpair 포맷: "ko|en", "en|ko", "auto|ko" 등
         * auto 를 source 로 설정하면 MyMemory 가 자동 감지 후 번역함
         */
        const langPair = `${resolvedSource}|${resolvedTarget}`;

        const apiUrl =
            `https://api.mymemory.translated.net/get` +
            `?q=${encodeURIComponent(text)}` +
            `&langpair=${encodeURIComponent(langPair)}`;

        const res = await fetch(apiUrl, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(7000),
        });

        if (!res.ok) {
            throw new Error(`MyMemory API responded with ${res.status}`);
        }

        const data = await res.json();

        if (data.responseStatus !== 200 && data.responseStatus !== "200") {
            throw new Error(`MyMemory error: ${data.responseDetails ?? "unknown"}`);
        }

        const translatedText: string = data.responseData?.translatedText ?? text;
        return NextResponse.json({ translatedText });

    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[/api/translate] 번역 오류:", msg);
        // 오류 시 원문을 그대로 반환 (UI 렛더링 보장)
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
