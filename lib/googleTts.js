// Google Cloud TTS 서브 백엔드 + 무료 한도 가드.
// - 한도는 "사용자별"이 아니라 우리 프로젝트 전체(앱 전체) 기준입니다.
// - 그래서 로그인/계정 없이 서버에서 전역 카운터 1개만 관리하면 됩니다.
// - Upstash가 설정되지 않으면 과금 위험을 피하기 위해 구글 호출을 아예 건너뜁니다 (fail-closed).

const GOOGLE_TTS_ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const DEFAULT_MONTHLY_LIMIT = 900_000; // GCP 무료 1,000,000자에 100,000자 안전 마진
const DEFAULT_VOICE = 'en-GB-Chirp3-HD-Charon';

// 확인 + 증가 + 만료를 원자적으로 처리하는 Lua 스크립트.
// 동시 요청이 한도를 동시에 통과하는 것을 막습니다. 초과하면 -1을 반환합니다.
const RESERVE_SCRIPT = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local limit = tonumber(ARGV[1])
local inc = tonumber(ARGV[2])
if current + inc > limit then
  return -1
end
local nextValue = redis.call('INCRBY', KEYS[1], inc)
redis.call('EXPIREAT', KEYS[1], ARGV[3])
return nextValue
`;

const config = () => ({
    apiKey: process.env.GOOGLE_TTS_API_KEY,
    restUrl: process.env.UPSTASH_REDIS_REST_URL,
    restToken: process.env.UPSTASH_REDIS_REST_TOKEN,
    limit: Number(process.env.GOOGLE_TTS_MONTHLY_LIMIT || DEFAULT_MONTHLY_LIMIT),
    voice: process.env.GOOGLE_TTS_VOICE || DEFAULT_VOICE,
});

export const isGoogleTtsConfigured = () => {
    const { apiKey, restUrl, restToken, limit } = config();
    return Boolean(apiKey && restUrl && restToken && Number.isFinite(limit) && limit > 0);
};

// UTC 기준 월 키. GCP 청구 월과 몇 시간 차이가 나도 안전 마진(10만 자)으로 커버됩니다.
export const getUsageKey = (now = new Date()) => (
    `tts:google:${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
);

const endOfMonthEpoch = (now = new Date()) => Math.floor(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) / 1000
);

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
    });
    if (!response.ok) throw new Error(`Upstash HTTP ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data.result;
};

/**
 * 이번 달 남은 한도가 있으면 문자 수만큼 예약하고 true를 반환합니다.
 * 저장소 장애/미설정/한도 초과 → false (조용히 다음 후보로 넘어갑니다).
 */
export const reserveGoogleQuota = async (charCount, now = new Date()) => {
    if (!isGoogleTtsConfigured() || !Number.isFinite(charCount) || charCount <= 0) return false;
    const { limit } = config();
    const key = getUsageKey(now);
    const expireAt = endOfMonthEpoch(now);

    try {
        const result = await upstash([
            'EVAL', RESERVE_SCRIPT, '1', key,
            String(limit), String(Math.ceil(charCount)), String(expireAt),
        ]);
        return Number(result) >= 0;
    } catch (error) {
        console.error('[google-tts] 사용량 카운터 실패:', error?.message || error);
        return false;
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
 */
export const tryGoogleTts = async (text) => {
    if (!isGoogleTtsConfigured() || typeof text !== 'string' || !text.trim()) return null;
    if (!await reserveGoogleQuota(text.length)) return null;

    const { apiKey, voice } = config();
    try {
        const response = await fetch(GOOGLE_TTS_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify({
                input: { text },
                voice: { languageCode: 'en-GB', name: voice },
                audioConfig: { audioEncoding: 'MP3' },
            }),
        });

        if (!response.ok) {
            console.error(`[google-tts] HTTP ${response.status}:`, (await response.text()).slice(0, 200));
            return null;
        }

        const data = await response.json();
        if (typeof data.audioContent !== 'string' || !data.audioContent) {
            console.error('[google-tts] 오디오 응답이 없습니다.');
            return null;
        }

        return {
            bytes: new Uint8Array(Buffer.from(data.audioContent, 'base64')),
            mimeType: 'audio/mpeg',
        };
    } catch (error) {
        console.error('[google-tts] 합성 실패:', error?.message || error);
        return null;
    }
};
