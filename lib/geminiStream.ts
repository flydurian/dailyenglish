// Gemini 스트리밍(streamGenerateContent?alt=sse) 호출: "응답이 시작되는지"와 "끝까지 받는지"를 나눠 기다립니다.
//
// 2026-11-13 실측: 매달리는 모델(3.8 Flash, 3.6 Flash 등)은 45초 동안 응답 헤더조차 보내지 않았고,
// 정상 모델은 첫 조각이 헤더와 함께 1~7초에 도착했습니다(thinking 모델은 생각을 마친 뒤 첫 조각).
// 그래서 전체 시간 한 가지로 기다리면 매달린 모델에 20~40초를 버리고, 짧게 잡으면 느리지만 정상인
// 긴 생성(강의 등)을 끊게 됩니다. 첫 조각 대기(firstChunkMs)와 전체 대기(totalMs)를 분리합니다.

import type { GeminiCandidate, GeminiError, GeminiResult } from './types.ts';

export interface StreamAccumulator {
    push(chunk: GeminiResult | null | undefined): void;
    result(): GeminiResult;
}

export interface StreamFetchOptions {
    url: string;
    init?: RequestInit;
    firstChunkMs: number;
    idleMs: number;
    totalMs: number;
    fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
    now?: () => number;
}

export type StreamFetchResult =
    | { ok: true; data: GeminiResult; firstChunkAfterMs: number | null }
    | { ok: false; status: number | 'network'; errorText?: string; timedOut?: boolean; reason?: string };

// SSE 버퍼에서 완성된 이벤트의 data 문자열만 꺼냅니다. 줄바꿈은 \n 으로 정규화돼 있어야 합니다.
export const parseSseEvents = (buffer: string): { events: string[]; rest: string } => {
    const events: string[] = [];
    let rest = buffer;
    let boundary: number;
    while ((boundary = rest.indexOf('\n\n')) >= 0) {
        const block = rest.slice(0, boundary);
        rest = rest.slice(boundary + 2);
        const data = block
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).replace(/^ /, ''))
            .join('\n');
        if (data) events.push(data);
    }
    return { events, rest };
};

// 스트림 조각들을 generateContent 응답 하나와 같은 모양으로 합칩니다 (생각 파트는 버림).
export const createStreamAccumulator = (): StreamAccumulator => {
    let text = '';
    let finishReason: string | undefined;
    let usageMetadata: unknown;
    let modelVersion: string | undefined;
    let promptFeedback: unknown;
    let error: GeminiError | null = null;

    return {
        push(chunk) {
            if (chunk?.error) {
                error = chunk.error;
                return;
            }
            const candidate = chunk?.candidates?.[0];
            for (const part of candidate?.content?.parts || []) {
                if (!part?.thought && typeof part?.text === 'string') text += part.text;
            }
            if (candidate?.finishReason) finishReason = candidate.finishReason;
            if (chunk?.usageMetadata) usageMetadata = chunk.usageMetadata;
            if (chunk?.modelVersion) modelVersion = chunk.modelVersion;
            if (chunk?.promptFeedback) promptFeedback = chunk.promptFeedback;
        },
        result() {
            if (error) return { error };
            const candidate: GeminiCandidate = { content: { role: 'model', parts: text ? [{ text }] : [] } };
            if (finishReason) candidate.finishReason = finishReason;
            const data: GeminiResult = { candidates: [candidate] };
            if (usageMetadata) data.usageMetadata = usageMetadata;
            if (modelVersion) data.modelVersion = modelVersion;
            if (promptFeedback) data.promptFeedback = promptFeedback;
            return data;
        },
    };
};

/**
 * 스트리밍으로 호출하고 끝까지 받아 하나의 응답으로 돌려줍니다.
 * - firstChunkMs 안에 첫 조각이 없으면 중단 (매달린 모델)
 * - 이후 idleMs 동안 새 조각이 없으면 중단 (중간에 멈춘 스트림)
 * - totalMs가 지나면 중단
 * @returns {Promise<{ok: true, data: object, firstChunkAfterMs: number}
 *   | {ok: false, status: number|'network', errorText?: string, timedOut?: boolean, reason?: string}>}
 */
export const fetchGeminiStream = async ({ url, init, firstChunkMs, idleMs, totalMs, fetchImpl = fetch, now = Date.now }: StreamFetchOptions): Promise<StreamFetchResult> => {
    const controller = new AbortController();
    const startedAt = now();
    let abortReason: string | null = null;
    const abort = (reason: string) => {
        if (abortReason) return;
        abortReason = reason;
        controller.abort();
    };

    const totalTimer = setTimeout(() => abort('total'), totalMs);
    let waitTimer = setTimeout(() => abort('first-chunk'), Math.min(firstChunkMs, totalMs));
    let firstChunkAfterMs: number | null = null;
    const onChunk = () => {
        if (firstChunkAfterMs === null) firstChunkAfterMs = now() - startedAt;
        clearTimeout(waitTimer);
        waitTimer = setTimeout(() => abort('idle'), idleMs);
    };

    const accumulator = createStreamAccumulator();
    const consume = (events: string[]) => {
        for (const data of events) {
            onChunk();
            try {
                accumulator.push(JSON.parse(data));
            } catch {
                // 깨진 조각은 건너뜁니다. 본문이 비면 호출부가 빈 응답으로 처리합니다.
            }
        }
    };

    try {
        const response = await fetchImpl(url, { ...init, signal: controller.signal });
        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            return { ok: false, status: response.status, errorText };
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
            const parsed = parseSseEvents(buffer);
            buffer = parsed.rest;
            consume(parsed.events);
        }
        buffer += decoder.decode().replace(/\r\n/g, '\n');
        consume(parseSseEvents(`${buffer}\n\n`).events);

        const data = accumulator.result();
        if (data.error) {
            const code = Number(data.error.code);
            return { ok: false, status: Number.isInteger(code) && code > 0 ? code : 'network', errorText: JSON.stringify({ error: data.error }) };
        }
        return { ok: true, data, firstChunkAfterMs };
    } catch (error) {
        if (abortReason) return { ok: false, status: 'network', timedOut: true, reason: abortReason };
        return { ok: false, status: 'network', timedOut: false, reason: (error as Error)?.name || 'error' };
    } finally {
        clearTimeout(totalTimer);
        clearTimeout(waitTimer);
    }
};
