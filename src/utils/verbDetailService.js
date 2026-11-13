// 구동사 상세 정보(뉘앙스/용법/예문)를 모달을 열 때 Gemini로 그때그때 생성합니다.
// 사전 데이터(phrasalVerbDetails)에 없는 구동사만 여기서 생성하고, 결과는
// localStorage에 캐시해 같은 구동사는 두 번 요청하지 않습니다.
import { callGeminiAPI } from './apiUtils';

const DETAIL_MODEL = 'gemini-3.5-flash-lite';
const CACHE_KEY = 'dailyenglish.verbDetails.v1';
const CACHE_MAX_ENTRIES = 200;

// --- localStorage 캐시 ---
let cacheMap = null;

const loadCache = () => {
    if (cacheMap) return cacheMap;
    try {
        const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        cacheMap = new Map(Object.entries(raw));
    } catch {
        cacheMap = new Map();
    }
    return cacheMap;
};

const persistCache = () => {
    try {
        while (cacheMap.size > CACHE_MAX_ENTRIES) {
            cacheMap.delete(cacheMap.keys().next().value);
        }
        localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(cacheMap)));
    } catch (error) {
        console.warn('[verbDetail] 캐시 저장 실패:', error);
    }
};

// 같은 구동사를 여러 카드에서 동시에 열 때 중복 요청을 막습니다.
const inflight = new Map();

// 캐시된 항목을 동기적으로 확인 (컴포넌트에서 로딩 없이 쓰기 위함)
export const getCachedVerbDetail = (verbName) => {
    if (!verbName) return null;
    const key = String(verbName).trim().toLowerCase();
    return loadCache().get(key) || null;
};

const cleanText = (value) => (typeof value === 'string' ? value.trim().replace(/^["“”']+|["“”']+$/g, '') : '');

// get together → get/gets/got/getting 처럼 활용형까지 인정
const IRREGULAR_PAST = {
    get: 'got', go: 'went', come: 'came', run: 'ran', take: 'took', make: 'made',
    put: 'put', set: 'set', break: 'broke', bring: 'brought', cut: 'cut',
    keep: 'kept', hold: 'held', let: 'let', stand: 'stood', give: 'gave',
    find: 'found', think: 'thought', buy: 'bought', catch: 'caught',
    teach: 'taught', leave: 'left', feel: 'felt', mean: 'meant', meet: 'met',
    lead: 'led', lose: 'lost', blow: 'blew', grow: 'grew', know: 'knew',
    throw: 'threw', draw: 'drew', fly: 'flew', fall: 'fell', rise: 'rose',
    write: 'wrote', drive: 'drove', speak: 'spoke', wake: 'woke', win: 'won',
    sit: 'sat', hang: 'hung', stick: 'stuck', strike: 'struck', build: 'built',
    send: 'sent', spend: 'spent', pay: 'paid', say: 'said', tell: 'told',
    sell: 'sold', shut: 'shut', split: 'split', cast: 'cast', burst: 'burst',
    lay: 'laid', lie: 'lay', wear: 'wore', tear: 'tore', swear: 'swore',
    choose: 'chose', steal: 'stole', freeze: 'froze',
};

const verbFormRegex = (verbName) => {
    const base = String(verbName).trim().toLowerCase().split(/\s+/)[0].replace(/[^a-z]/g, '');
    if (!base) return null;

    const forms = new Set([base]);
    if (!base.endsWith('s')) forms.add(base + 's');
    if (base.endsWith('e')) {
        forms.add(base + 'd');
        forms.add(base.slice(0, -1) + 'ing');
    } else {
        forms.add(base + 'ed');
        forms.add(base + 'ing');
    }
    // 자음-모음-자음으로 끝나면 자음을 겹쳐 씀 (get → getting)
    const doubled = base.match(/^[^aeiou]*[aeiou]([^aeiouwy])$/);
    if (doubled) {
        forms.add(base + doubled[1] + 'ed');
        forms.add(base + doubled[1] + 'ing');
    }
    const past = IRREGULAR_PAST[base];
    if (past) {
        forms.add(past);
        forms.add(past + 's');
        forms.add(past + 'ing');
    }
    return new RegExp(`\\b(${[...forms].join('|')})\\b`, 'i');
};

// 생성 결과 검증: 불량 예문은 걷어내고, 부족하면 null 반환해 재시도/오류로 갑니다.
const sanitizeEntry = (raw, verbName) => {
    if (!raw || typeof raw !== 'object') return null;

    const nuance = cleanText(raw.nuance);
    const usage = cleanText(raw.usage);
    if (!/[가-힣]/.test(nuance) || !/[가-힣]/.test(usage)) return null;
    if (nuance.length < 20 || usage.length < 20) return null;
    if (nuance === usage) return null;

    const formRegex = verbFormRegex(verbName);
    const seen = new Set();
    const situations = [];
    for (const example of Array.isArray(raw.examples) ? raw.examples : []) {
        const text = cleanText(example);
        if (!text || /[가-힣]/.test(text)) continue;
        if (text.length < 10 || text.length > 180) continue;
        if (formRegex && !formRegex.test(text)) continue;

        const fingerprint = text.toLowerCase().replace(/[^a-z0-9 ]/g, '').slice(0, 40);
        if (seen.has(fingerprint)) continue;
        seen.add(fingerprint);
        // 기존 사전 데이터와 동일한 표시 형식(따옴표 감싸기)을 유지합니다.
        situations.push(`"${text}"`);
        if (situations.length === 4) break;
    }

    if (situations.length < 2) return null;
    return { nuance, usage, situations };
};

const buildPrompt = (verbName, meaning, contextSentence, isRetry) => {
    const context = contextSentence
        ? `\n실제 사용된 문맥(참고용): "${contextSentence.slice(0, 300)}"`
        : '';

    return `당신은 영어 구동사 학습 앱의 영어 선생님입니다. 아래 구동사에 대한 학습 정보를 만드세요.

구동사: ${verbName}
의미: ${meaning || '사전에 주어진 의미'}${context}

아래 JSON 형식 그대로만 응답하세요. 다른 설명이나 코드 블록은 쓰지 마세요.
{
  "nuance": "...",
  "usage": "...",
  "examples": ["...", "...", "...", "..."]
}

nuance (한국어, 2~3문장): 이 구동사만이 가진 뉘앙스. 비슷한 의미의 다른 표현(단어나 구동사)과 무엇이 어떻게 다른지, 어떤 감정·태도·격식의 느낌을 주는지 설명하세요. "언제 어디서 쓰이는지"는 여기에 쓰지 마세요.
usage (한국어, 2~3문장): 실제로 어떤 상황에서 주로 쓰이는지. 일상 대화/직장/뉴스 등 주 사용 맥락과 격식 여부, 자주 쓰이는 문형(자동사/타동사, 분리 가능 여부)을 설명하세요. nuance의 내용을 반복하지 마세요.
examples (영어, 정확히 4개): 이 구동사가 실제로 가장 자주 쓰이는 대표적인 문장. 각각 다른 상황과 서로 다른 문장 구조를 사용하고, 구동사를 정확한 문법으로 사용하세요(시제·인칭 변형 허용).

규칙:
- 예문은 서로 같은 패턴을 복사한 모양이어서는 안 됩니다. (예: "Can you ~ the answer?" 식의 틀에 구동사만 끼워 넣기 금지)
- 구동사가 목적어를 필요로 하는 용법이면 목적어를 반드시 포함하고, 자동사 용법이면 목적어 없이 쓰세요.
- 예문 문법이 틀리면 안 됩니다. 실제 원어민이 쓰는 자연스러운 문장만.
- nuance와 usage는 반드시 내용이 달라야 합니다.${isRetry ? '\n\n이전 응답은 검증을 통과하지 못했습니다. 위 규칙을 더 엄격히 지키세요.' : ''}`;
};

/**
 * 구동사 상세 정보를 생성하거나 캐시에서 가져옵니다.
 * @param {string} verbName 구동사 (예: "get together")
 * @param {string} meaning 한국어 뜻 (예: "모이다")
 * @param {string} contextSentence 사용자가 본 문장 (프롬프트 참고용)
 * @returns {Promise<{nuance: string, usage: string, situations: string[]} | null>}
 *          두 번 시도 후 실패하면 null. 컴포넌트는 null이면 오류 UI를 보여줍니다.
 */
export const getPhrasalVerbDetail = async (verbName, meaning, contextSentence = '') => {
    const key = String(verbName).trim().toLowerCase();
    if (!key) return null;

    const cached = getCachedVerbDetail(key);
    if (cached) return cached;
    if (inflight.has(key)) return inflight.get(key);

    const task = (async () => {
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const payload = {
                    contents: [{ role: 'user', parts: [{ text: buildPrompt(key, meaning, contextSentence, attempt > 0) }] }],
                    generationConfig: {
                        responseMimeType: 'application/json',
                        maxOutputTokens: 2048,
                        temperature: 0.4,
                    },
                };

                const result = await callGeminiAPI(payload, DETAIL_MODEL, 1);
                const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
                const parsed = JSON.parse(text);
                const entry = sanitizeEntry(Array.isArray(parsed) ? parsed[0] : parsed, key);

                if (entry) {
                    loadCache().set(key, entry);
                    persistCache();
                    return entry;
                }
                console.warn(`[verbDetail] ${key} 검증 실패 (시도 ${attempt + 1}/2)`);
            } catch (error) {
                console.error(`[verbDetail] ${key} 생성 실패 (시도 ${attempt + 1}/2):`, error?.message || error);
            }
        }
        return null;
    })();

    inflight.set(key, task);
    try {
        return await task;
    } finally {
        inflight.delete(key);
    }
};
