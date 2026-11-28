// TTS 오디오를 IndexedDB에 저장합니다.
// localStorage는 동기 I/O + 5MB 제한이 있어 오디오 캐시에 적합하지 않습니다.
export const AUDIO_CACHE_DB_NAME = 'dailyenglish-audio-v2';

// 예전 버전이 쓰던 DB 이름입니다. 시작할 때 이 DB들만 지웁니다.
// 현재 쓰는 DB(AUDIO_CACHE_DB_NAME)를 여기에 넣으면 캐시가 매번 사라지므로 절대 넣지 마세요.
export const LEGACY_AUDIO_CACHE_DB_NAMES: readonly string[] = ['dailyenglish-audio'];

const DB_NAME = AUDIO_CACHE_DB_NAME;
const STORE_NAME = 'tts';
const DB_VERSION = 1;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 25;

interface AudioEntry {
    text: string;
    blob: Blob;
    timestamp: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

const openDb = (): Promise<IDBDatabase | null> => {
    if (typeof indexedDB === 'undefined') return Promise.resolve(null);
    if (dbPromise) return dbPromise;

    dbPromise = new Promise<IDBDatabase | null>((resolve) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'text' });
                store.createIndex('timestamp', 'timestamp');
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
    });

    return dbPromise;
};

const runTransaction = async <T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | null> => {
    const db = await openDb();
    if (!db) return null;

    try {
        return await new Promise<T | null>((resolve) => {
            const tx = db.transaction(STORE_NAME, mode);
            const result = operation(tx.objectStore(STORE_NAME));
            tx.oncomplete = () => resolve(result ? result.result : null);
            tx.onerror = () => resolve(null);
            tx.onabort = () => resolve(null);
        });
    } catch {
        return null;
    }
};

export const getCachedAudio = async (text: string): Promise<Blob | null> => {
    const db = await openDb();
    if (!db || !text) return null;

    return new Promise<Blob | null>((resolve) => {
        try {
            const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(text);
            request.onsuccess = () => {
                const entry = request.result as AudioEntry | undefined;
                if (!entry?.blob || !entry.timestamp || Date.now() - entry.timestamp > TTL_MS) {
                    if (entry) void deleteCachedAudio(text);
                    resolve(null);
                    return;
                }
                resolve(entry.blob);
            };
            request.onerror = () => resolve(null);
        } catch {
            resolve(null);
        }
    });
};

export const setCachedAudio = async (text: string, blob: Blob): Promise<void> => {
    if (!text || !blob) return;
    await runTransaction('readwrite', (store) => {
        store.put({ text, blob, timestamp: Date.now() } satisfies AudioEntry);
    });
    await pruneCache();
};

export const deleteCachedAudio = async (text: string): Promise<void> => {
    await runTransaction('readwrite', (store) => {
        store.delete(text);
    });
};

const pruneCache = async (): Promise<void> => {
    const db = await openDb();
    if (!db) return;

    // timestamp 인덱스의 key cursor만 순회하면 오디오 Blob 본문을 RAM으로 읽지 않고 정리할 수 있습니다.
    const toDelete = await new Promise<IDBValidKey[]>((resolve) => {
        try {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const index = store.index('timestamp');
            const now = Date.now();
            const expiredKeys: IDBValidKey[] = [];
            const aliveKeys: IDBValidKey[] = [];

            const request = index.openKeyCursor();
            request.onsuccess = () => {
                const cursor = request.result;
                if (!cursor) {
                    const excessCount = Math.max(0, aliveKeys.length - MAX_ENTRIES);
                    resolve([...expiredKeys, ...aliveKeys.slice(0, excessCount)]);
                    return;
                }
                const ts = typeof cursor.key === 'number' ? cursor.key : 0;
                if (!ts || now - ts > TTL_MS) {
                    expiredKeys.push(cursor.primaryKey);
                } else {
                    aliveKeys.push(cursor.primaryKey);
                }
                cursor.continue();
            };
            request.onerror = () => resolve([]);
        } catch {
            resolve([]);
        }
    });

    if (toDelete.length === 0) return;

    await runTransaction('readwrite', (store) => {
        toDelete.forEach((key) => store.delete(key));
    });
};

export const clearAudioCache = async (): Promise<void> => {
    await runTransaction('readwrite', (store) => {
        store.clear();
    });
};
