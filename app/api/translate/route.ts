import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/translate
 *
 * Body: { text: string; targetLang: string; sourceLang?: string }
 * Response: { translatedText: string }
 *
 * MyMemory 무료 번역 API
 * - sourceLang 명시 권장 (auto 사용 시 감지 불안정)
 * - de= 파라미터로 일일 한도 5,000 → 10,000자로 증가
 *
 * https://mymemory.translated.net/doc/spec.php
 */

const LANG_MAP: Record<string, string> = {
    ko: "ko",
    en: "en",
    de: "de",
    zh: "zh-CN",
    ja: "ja",
};

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { text, targetLang, sourceLang } = body as {
            text: string;
            targetLang: string;
            sourceLang?: string;
        };

        if (!text?.trim() || !targetLang) {
            return NextResponse.json({ error: "Missing text or targetLang" }, { status: 400 });
        }

        const resolvedTarget = LANG_MAP[targetLang] ?? targetLang;

        // sourceLang이 없거나 LANG_MAP에 없으면 "ko"로 기본값 처리
        // (MyMemory는 "auto" langpair가 불안정하여 실제 언어 코드 명시가 필수)
        const resolvedSource =
            sourceLang && LANG_MAP[sourceLang]
                ? LANG_MAP[sourceLang]
                : "ko";

        /* src === target 이면 그냥 원문 반환 */
        if (resolvedSource === resolvedTarget) {
            return NextResponse.json({ translatedText: text });
        }

        /*
         * MyMemory langpair 포맷: "ko|en", "ko|de" 등
         * de= 파라미터: 이메일 주소 설정 시 일일 한도 5,000 → 10,000자로 증가
         */
        const langPair = `${resolvedSource}|${resolvedTarget}`;

        const apiUrl =
            `https://api.mymemory.translated.net/get` +
            `?q=${encodeURIComponent(text)}` +
            `&langpair=${encodeURIComponent(langPair)}` +
            `&de=kdh.alliance.web@gmail.com`;

        const res = await fetch(apiUrl, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) {
            throw new Error(`MyMemory API responded with ${res.status}`);
        }

        const data = await res.json();

        // 429: 일일 한도 초과
        if (data.responseStatus === 429 || data.responseStatus === "429") {
            throw new Error("MyMemory daily limit exceeded");
        }

        if (data.responseStatus !== 200 && data.responseStatus !== "200") {
            throw new Error(`MyMemory error: ${data.responseDetails ?? "unknown"}`);
        }

        const translatedText: string = data.responseData?.translatedText ?? text;

        // 번역 결과가 원문과 완전히 동일하면 실패로 간주 (API 한도 초과 시 왕왕 발생)
        if (!translatedText || translatedText.trim() === text.trim()) {
            throw new Error("Translation returned original text (possible API limit)");
        }

        return NextResponse.json({ translatedText });

    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[/api/translate] 번역 오류:", msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
