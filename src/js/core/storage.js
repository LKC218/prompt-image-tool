const isTauri = typeof window !== 'undefined' && window.__TAURI_INTERNALS__;
const isCapacitor = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();

const API_BASE = isTauri ? 'http://localhost:8888' : '';

let storageImpl = null;

async function initStorage() {
    if (isCapacitor) {
        const mod = await import('./sqlite-storage.js');
        storageImpl = new mod.SqliteStorage();
    } else {
        const mod = await import('./api-storage.js');
        storageImpl = new mod.ApiStorage(API_BASE);
    }
    await storageImpl.init();
}

function getStorage() {
    if (!storageImpl) throw new Error('Storage not initialized');
    return storageImpl;
}

export { initStorage, getStorage, isTauri, isCapacitor, API_BASE };
