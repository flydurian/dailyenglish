// Google Cloud TTS 서브 백엔드 + 무료 한도 가드.
// - 한도는 "사용자별"이 아니라 우리 프로젝트 전체(앱 전체) 기준입니다.
// - 그래서 로그인/계정 없이 서버에서 전역 카운터 1개만 관리하면 됩니다.
// - 전역 한도와 함께 IP별 월 한도를 두어 한 사용자가 공유 한도를 독식하지 못하게 합니다.
//   IP는 저장하지 않고 서버 비밀로 HMAC 해시한 값만 씁니다.
// - Upstash가 설정되지 않으면 과금 위험을 피하기 위해 구글 호출을 아예 건너뜁니다 (fail-closed).

import { createHmac } from 'node:crypto';

const GOOGLE_TTS_ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';

// GCP Text-to-Speech 무료 한도: Chirp 3 HD 기준 월 1,000,000자 (결제 계정 단위).
const FREE_TIER_MONTHLY_CHARS = 1_000_000;
const DEFAULT_MONTHLY_LIMIT = 900_000; // 무료 한도에 100,000자 안전 마진
const DEFAULT_IP_MONTHLY_LIMIT = 100_000; // 한 사용자가 공유 한도를 독식하지 못하게
// 왕실 RP(여성)와 톤이 이어지도록 폴백도 여성 보이스를 기본으로 씁니다.
const DEFAULT_GB_VOICE = 'en-GB-Chirp3-HD-Achernar';
const DEFAULT_US_VOICE = 'en-US-Chirp3-HD-Kore';

// 무료 한도는 결제 계정 기준 월 단위(태평양 시간)로 초기화됩니다. UTC로 세면 월말
// 8시간 동안 지난달 카운터와 이번달 카운터가 겹쳐 두 달치를 쓸 수 있으므로,
// 청구 기준과 같은 태평양 시간의 연-월을 키로 씁니다.
const PACIFIC_MONTH = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
});
// 키가 달마다 새로 생기므로 만료는 "이번 달 + 여유"면 충분합니다.
const KEY_TTL_SECONDS = 40 * 24 * 60 * 60;
const UPSTASH_TIMEOUT_MS = 5_000;
const GOOGLE_TIMEOUT_MS = 10_000;
const IP_HASH_LENGTH = 16;

// 확인 + 증가 + 만료를 원자적으로 처리하는 Lua 스크립트.
// KEYS[1] = 전역 월 키, KEYS[2] = IP 월 키
// ARGV = [전역 한도, IP 한도(0이면 비활성), 증가량, TTL]
// 반환: 증가 후 전역 사용량, 전역 초과 -1, IP 초과 -2
const RESERVE_SCRIPT = `
local inc = tonumber(ARGV[3])
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
if current + inc > tonumber(ARGV[1]) then
  return -1
end
local ipLimit = tonumber(ARGV[2])
if ipLimit > 0 then
  local ipCurrent = tonumber(redis.call('GET', KEYS[2]) or '0')
  if ipCurrent + inc > ipLimit then
    return -2
  end
end
if ipLimit > 0 then
  redis.call('INCRBY', KEYS[2], inc)
  redis.call('EXPIRE', KEYS[2], ARGV[4])
end
local nextValue = redis.call('INCRBY', KEYS[1], inc)
redis.call('EXPIRE', KEYS[1], ARGV[4])
return nextValue
`;

// 합성 실패 시 예약한 문자 수를 되돌립니다. (실패한 요청으로 한도가 줄지 않도록)
// ARGV = [증가량, IP 키도 되돌릴지('1'|'0'), TTL]
const RELEASE_SCRIPT = `
local inc = tonumber(ARGV[1])
local value = redis.call('DECRBY', KEYS[1], inc)
if value < 0 then
  redis.call('SET', KEYS[1], 0)
  value = 0
end
redis.call('EXPIRE', KEYS[1], ARGV[3])
if ARGV[2] == '1' then
  local ipValue = redis.call('DECRBY', KEYS[2], inc)
  if ipValue < 0 then
    redis.call('SET', KEYS[2], 0)
  end
  redis.call('EXPIRE', KEYS[2], ARGV[3])
end
return value
`;

const normalizeLimit = (value, fallback, { allowZero = false } = {}) => {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    if (!allowZero && parsed === 0) return fallback;
    return parsed;
};

let warnedLimit = false;

const config = () => {
    const requestedLimit = normalizeLimit(process.env.GOOGLE_TTS_MONTHLY_LIMIT, DEFAULT_MONTHLY_LIMIT);
    if (requestedLimit > FREE_TIER_MONTHLY_CHARS && !warnedLimit) {
        warnedLimit = true;
        console.warn(
            `[google-tts] GOOGLE_TTS_MONTHLY_LIMIT(${requestedLimit})이 무료 한도를 넘어 `
            + `${FREE_TIER_MONTHLY_CHARS}자로 제한합니다.`
        );
    }
    return {
        apiKey: process.env.GOOGLE_TTS_API_KEY,
        restUrl: process.env.UPSTASH_REDIS_REST_URL,
        restToken: process.env.UPSTASH_REDIS_REST_TOKEN,
        limit: Math.min(requestedLimit, FREE_TIER_MONTHLY_CHARS),
        ipLimit: normalizeLimit(
            process.env.GOOGLE_TTS_IP_MONTHLY_LIMIT,
            DEFAULT_IP_MONTHLY_LIMIT,
            { allowZero: true }
        ),
        voiceGb: process.env.GOOGLE_TTS_VOICE || DEFAULT_GB_VOICE,
        voiceUs: process.env.GOOGLE_TTS_VOICE_US || DEFAULT_US_VOICE,
    };
};

export const isGoogleTtsConfigured = () => {
    const { apiKey, restUrl, restToken, limit } = config();
    return Boolean(apiKey && restUrl && restToken && Number.isFinite(limit) && limit > 0);
};

const monthStamp = (now = new Date()) => {
    const parts = Object.fromEntries(
        PACIFIC_MONTH.formatToParts(now).map((part) => [part.type, part.value])
    );
    return `${parts.year}-${parts.month}`;
};

export const getUsageKey = (now = new Date()) => `tts:google:${monthStamp(now)}`;

const normalizeIp = (clientIp) => (
    typeof clientIp === 'string' && clientIp && clientIp !== 'unknown' ? clientIp : null
);

// IP 원본 대신 HMAC 해시만 저장합니다. 해시 키는 서버에만 있는 Upstash 토큰입니다.
export const getIpUsageKey = (clientIp, now = new Date()) => {
    const ip = normalizeIp(clientIp);
    if (!ip) return null;
    const { restToken } = config();
    const digest = createHmac('sha256', restToken || 'dailyenglish')
        .update(ip)
        .digest('hex');
    return `tts:google:ip:${digest.slice(0, IP_HASH_LENGTH)}:${monthStamp(now)}`;
};

// Upstash REST 호출 (array 커맨드 형태).
const upstash = async (command) => {
    const { restUrl, restToken } = config();
    const response = await fetch(restUrl, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${restToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(command),
        signal: AbortSignal.timeout(UPSTASH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Upstash HTTP ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data.result;
};

/**
 * 이번 달 남은 전역/ IP 한도가 있으면 문자 수만큼 예약하고 true를 반환합니다.
 * 저장소 장애/미설정/한도 초과 → false (조용히 다음 후보로 넘어갑니다).
 */
export const reserveGoogleQuota = async (charCount, now = new Date(), clientIp) => {
    if (!isGoogleTtsConfigured() || !Number.isFinite(charCount) || charCount <= 0) return false;
    const { limit, ipLimit } = config();
    const globalKey = getUsageKey(now);
    const ipKey = getIpUsageKey(clientIp, now);
    const effectiveIpLimit = ipKey && ipLimit > 0 ? ipLimit : 0;

    try {
        const result = await upstash([
            'EVAL', RESERVE_SCRIPT, '2', globalKey, ipKey || globalKey,
            String(limit), String(effectiveIpLimit), String(Math.ceil(charCount)),
            String(KEY_TTL_SECONDS),
        ]);
        // INCRBY 결과는 항상 양수입니다. 0/음수/null은 비정상 응답이므로 호출하지 않습니다.
        return Number(result) > 0;
    } catch (error) {
        console.error('[google-tts] 사용량 카운터 실패:', error?.message || error);
        return false;
    }
};

/**
 * 예약했지만 실제로 합성하지 못한 문자 수를 되돌립니다.
 * 실패해도 조용히 넘어갑니다 (다음 예약 때 다시 집계됩니다).
 */
export const releaseGoogleQuota = async (charCount, now = new Date(), clientIp) => {
    if (!isGoogleTtsConfigured() || !Number.isFinite(charCount) || charCount <= 0) return;
    const { ipLimit } = config();
    const globalKey = getUsageKey(now);
    const ipKey = getIpUsageKey(clientIp, now);
    const ipEnabled = ipKey && ipLimit > 0 ? '1' : '0';

    try {
        await upstash([
            'EVAL', RELEASE_SCRIPT, '2', globalKey, ipKey || globalKey,
            String(Math.ceil(charCount)), ipEnabled, String(KEY_TTL_SECONDS),
        ]);
    } catch (error) {
        console.error('[google-tts] 사용량 반환 실패:', error?.message || error);
    }
};

// 현재월 누적 사용량 조회 (디버깅/헤더용).
export const getGoogleUsage = async (now = new Date()) => {
    if (!isGoogleTtsConfigured()) return null;
    try {
        const value = await upstash(['GET', getUsageKey(now)]);
        return value === null ? 0 : Number(value);
    } catch {
        return null;
    }
};

/**
 * 구글 TTS로 합성 시도. 성공하면 오디오 바이트를, 한도 초과·설정 누락·오류면 null을 반환합니다.
 * @param {string} text
 * @param {{ accent?: 'gb'|'us', clientIp?: string }} [options]
 */
export const tryGoogleTts = async (text, { accent = 'gb', clientIp } = {}) => {
    if (!isGoogleTtsConfigured() || typeof text !== 'string' || !text.trim()) return null;

    const charCount = text.length;
    const requestTime = new Date();
    if (!await reserveGoogleQuota(charCount, requestTime, clientIp)) return null;
    const refund = () => releaseGoogleQuota(charCount, requestTime, clientIp);

    const { apiKey, voiceGb, voiceUs } = config();
    const isUs = accent === 'us';
    const languageCode = isUs ? 'en-US' : 'en-GB';
    const voice = isUs ? voiceUs : voiceGb;

    try {
        const response = await fetch(GOOGLE_TTS_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify({
                input: { text },
                voice: { languageCode, name: voice },
                audioConfig: { audioEncoding: 'MP3' },
            }),
            signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
        });

        if (!response.ok) {
            console.error(`[google-tts] HTTP ${response.status}:`, (await response.text()).slice(0, 200));
            await refund();
            return null;
        }

        const data = await response.json();
        if (typeof data.audioContent !== 'string' || !data.audioContent) {
            console.error('[google-tts] 오디오 응답이 없습니다.');
            await refund();
            return null;
        }

        return {
            bytes: new Uint8Array(Buffer.from(data.audioContent, 'base64')),
            mimeType: 'audio/mpeg',
            accent: isUs ? 'us' : 'gb',
        };
    } catch (error) {
        console.error('[google-tts] 합성 실패:', error?.message || error);
        await refund();
        return null;
    }
};
