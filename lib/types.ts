// lib/ 과 api/ 가 함께 쓰는 공용 타입.
// @vercel/node 패키지가 없으므로 Vercel 함수의 req/res는 실제 쓰이는 필드만 정의합니다.

// JSON으로 주고받는 값의 재귀적 형태 (parse된 요청 본문/응답 데이터).
export type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;
export interface JsonObject {
    [key: string]: JsonValue;
}

// Vercel 함수 요청 객체 (Node IncomingMessage + Vercel query/body).
export interface ApiHeaders {
    origin?: string;
    'content-type'?: string;
    'content-length'?: string;
    'x-real-ip'?: string | string[];
    'x-forwarded-for'?: string | string[];
    [key: string]: string | string[] | undefined;
}

export interface ApiRequest {
    method?: string;
    headers: ApiHeaders;
    body?: JsonObject;
    query: Record<string, string | string[] | undefined>;
    socket?: { remoteAddress?: string };
}

// Vercel 함수 응답 객체 (res.status().json() / res.end() 체인).
export interface ApiResponse {
    setHeader(name: string, value: string | number | string[]): void;
    status(code: number): ApiResponse;
    json(body: unknown): ApiResponse;
    end(body?: unknown): ApiResponse;
}

// Gemini 응답의 공통 모양 (GenerationContent / StreamChunk 모두 이 형태).
export interface GeminiError {
    code?: number | string;
    message?: string;
    status?: string;
    [key: string]: unknown;
}

export interface GeminiPart {
    text?: string;
    thought?: unknown;
    inlineData?: { data?: string; mimeType?: string };
    [key: string]: unknown;
}

export interface GeminiCandidate {
    content?: { role?: string; parts?: GeminiPart[] };
    finishReason?: string;
    [key: string]: unknown;
}

export interface GeminiResult {
    error?: GeminiError;
    candidates?: GeminiCandidate[];
    usageMetadata?: unknown;
    modelVersion?: string;
    promptFeedback?: unknown;
    [key: string]: unknown;
}

export type GenerationConfig = Record<string, unknown>;

export interface SanitizedPayload {
    contents: Array<{ role?: string; parts: Array<{ text: string }> }>;
    generationConfig: GenerationConfig;
}

// 모델 체인 설정과 시도 결과.
export type ModelTier = 'generate' | 'fast' | 'tts';

export interface ChainEntry {
    model: string;
    timeoutMs: number;
    thinkingLevel?: string;
    thinkingHeadroom?: number;
    firstChunkMs?: number;
    voiceName?: string;
}

export interface FailureInfo {
    status?: number | 'network';
    errorText?: string;
    timedOut?: boolean;
    empty?: boolean;
}

export type ChainAttemptResult =
    | { ok: true; value: unknown }
    | { ok: false; status?: number | 'network'; errorText?: string; timedOut?: boolean; empty?: boolean };

export type ChainOutcome =
    | { ok: true; value: unknown; model: string; tried: string[] }
    | { ok: false; status: number; retryAfterSec: number; tried: string[] };

export interface CooldownTracker {
    isCooling(model: string, now?: number): boolean;
    remainingMs(model: string, now?: number): number;
    coolDown(model: string, ms: number, now?: number): void;
    clear(model: string): boolean;
}

export interface RunChainOptions {
    tier: ModelTier;
    attempt: (entry: ChainEntry, timeoutMs: number) => Promise<ChainAttemptResult>;
    cooldowns: CooldownTracker;
    now?: () => number;
    chain?: ChainEntry[];
    budgetMs?: number;
}

export interface AudioBytes {
    bytes: Uint8Array;
    mimeType: string;
}
