const isTauri = typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;
const isCapacitor = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();

const DEFAULT_PORT = 8888;
const PORT_SCAN_MAX = 10;
const API_BASE_FALLBACK = isTauri ? `http://localhost:${DEFAULT_PORT}` : '';

let resolvedApiBase = null;
let storageImpl = null;

async function probeHealth(baseUrl) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 800);
    try {
        const res = await fetch(`${baseUrl}/api/health`, { signal: controller.signal });
        return res.ok;
    } catch {
        return false;
    } finally {
        clearTimeout(timer);
    }
}

async function resolveApiBase() {
    if (resolvedApiBase !== null) return resolvedApiBase;
    if (!isTauri) {
        resolvedApiBase = '';
        return resolvedApiBase;
    }

    const cachedPort = Number(window.sessionStorage?.getItem('prompt-api-port'));
    if (Number.isFinite(cachedPort) && cachedPort > 0) {
        const cachedBase = `http://localhost:${cachedPort}`;
        if (await probeHealth(cachedBase)) {
            resolvedApiBase = cachedBase;
            return resolvedApiBase;
        }
    }

    for (let i = 0; i < PORT_SCAN_MAX; i += 1) {
        const port = DEFAULT_PORT + i;
        const base = `http://localhost:${port}`;
        if (await probeHealth(base)) {
            try {
                window.sessionStorage?.setItem('prompt-api-port', String(port));
            } catch {
                /* ignore */
            }
            resolvedApiBase = base;
            return resolvedApiBase;
        }
    }

    resolvedApiBase = API_BASE_FALLBACK;
    return resolvedApiBase;
}

const API_BASE = API_BASE_FALLBACK;

async function initStorage() {
    if (isCapacitor) {
        const mod = await import('./sqlite-storage.js');
        storageImpl = new mod.SqliteStorage();
    } else {
        const mod = await import('./api-storage.js');
        const base = await resolveApiBase();
        storageImpl = new mod.ApiStorage(base);
    }
    await storageImpl.init();
}

function getStorage() {
    if (!storageImpl) throw new Error('Storage not initialized');
    return storageImpl;
}

export { initStorage, getStorage, isTauri, isCapacitor, API_BASE, resolveApiBase };
