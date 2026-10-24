// TTS 오디오를 IndexedDB에 저장합니다.
// localStorage는 동기 I/O + 5MB 제한이 있어 오디오 캐시에 적합하지 않습니다.
const DB_NAME = 'dailyenglish-audio-v2';
const STORE_NAME = 'tts';
const DB_VERSION = 1;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 25;

let dbPromise = null;

const openDb = () => {
    if (typeof indexedDB === 'undefined') return Promise.resolve(null);
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve) => {
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

const runTransaction = async (mode, operation) => {
    const db = await openDb();
    if (!db) return null;

    try {
        return await new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, mode);
            const result = operation(tx.objectStore(STORE_NAME));
            tx.oncomplete = () => resolve(result);
            tx.onerror = () => resolve(null);
            tx.onabort = () => resolve(null);
        });
    } catch (error) {
        return null;
    }
};

export const getCachedAudio = async (text) => {
    const db = await openDb();
    if (!db || !text) return null;

    return new Promise((resolve) => {
        try {
            const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(text);
            request.onsuccess = () => {
                const entry = request.result;
                if (!entry || !entry.blob || !entry.timestamp || Date.now() - entry.timestamp > TTL_MS) {
                    if (entry) deleteCachedAudio(text);
                    resolve(null);
                    return;
                }
                resolve(entry.blob);
            };
            request.onerror = () => resolve(null);
        } catch (error) {
            resolve(null);
        }
    });
};

export const setCachedAudio = async (text, blob) => {
    if (!text || !blob) return;
    await runTransaction('readwrite', (store) => {
        store.put({ text, blob, timestamp: Date.now() });
    });
    await pruneCache();
};

export const deleteCachedAudio = async (text) => {
    await runTransaction('readwrite', (store) => {
        store.delete(text);
    });
};

const pruneCache = async () => {
    const entries = await new Promise((resolve) => {
        openDb().then((db) => {
            if (!db) { resolve([]); return; }
            try {
                const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => resolve([]);
            } catch (error) {
                resolve([]);
            }
        });
    });

    if (entries.length === 0) return;

    const now = Date.now();
    const expired = entries.filter((entry) => !entry.timestamp || now - entry.timestamp > TTL_MS);
    const alive = entries
        .filter((entry) => !expired.includes(entry))
        .sort((a, b) => a.timestamp - b.timestamp);
    const excess = alive.slice(0, Math.max(0, alive.length - MAX_ENTRIES));
    const toDelete = [...expired, ...excess];

    if (toDelete.length === 0) return;

    await runTransaction('readwrite', (store) => {
        toDelete.forEach((entry) => store.delete(entry.text));
    });
};

export const clearAudioCache = async () => {
    await runTransaction('readwrite', (store) => {
        store.clear();
    });
};
