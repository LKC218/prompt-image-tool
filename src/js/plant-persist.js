import { STORAGE_KEY, forceResetCycle, normalizeState } from './plant-core.js';
import { loadPlantState, savePlantState } from './plant-tracker.js';

export const PLANT_SCHEMA_VERSION = 1;

let lastPersistSource = 'idle';
let apiFailStreak = 0;

export function getLastPersistSource() {
    return lastPersistSource;
}

export function getApiFailStreak() {
    return apiFailStreak;
}

export function isOfflineHintVisible() {
    return apiFailStreak >= 2;
}

function hasStorage(storage) {
    return Boolean(storage && typeof storage.getItem === 'function');
}

/**
 * 从业务存储（API）读取植物档。
 * @returns {Promise<{source:'api'|null, payload:object|null, plant:object|null}>}
 */
export async function loadPlantFromApi(apiStorage) {
    if (!apiStorage || typeof apiStorage.getPlant !== 'function') {
        return { source: null, payload: null, plant: null };
    }
    try {
        const payload = await apiStorage.getPlant();
        if (!payload || !payload.plant) {
            return { source: 'api', payload: payload || null, plant: null };
        }
        const plant = normalizeState(payload.plant);
        return { source: 'api', payload, plant };
    } catch (e) {
        console.warn('plant load from api failed', e);
        return { source: null, payload: null, plant: null };
    }
}

export async function savePlantToApi(apiStorage, plant) {
    if (!apiStorage || typeof apiStorage.savePlant !== 'function') return false;
    if (!plant || typeof plant !== 'object') return false;
    const payload = {
        schemaVersion: PLANT_SCHEMA_VERSION,
        plant,
        updatedAt: new Date().toISOString(),
    };
    try {
        await apiStorage.savePlant(payload);
        apiFailStreak = 0;
        lastPersistSource = 'api';
        return true;
    } catch (e) {
        console.warn('plant save to api failed', e);
        apiFailStreak += 1;
        lastPersistSource = 'local';
        return false;
    }
}

/**
 * 启动加载：API → localStorage 迁移 → 新建。
 * @returns {Promise<{plant:object, source:'api'|'migrate'|'new'|'local'}>}
 */
export async function loadPlantWithFallback(apiStorage, localStorageLike = window.localStorage) {
    const fromApi = await loadPlantFromApi(apiStorage);
    if (fromApi.plant) {
        // 双写 LS 作离线缓存
        if (hasStorage(localStorageLike)) {
            try {
                savePlantState(fromApi.plant, localStorageLike);
            } catch { /* ignore */ }
        }
        return { plant: fromApi.plant, source: 'api' };
    }

    let localPlant = null;
    let hasLocalRaw = false;
    if (hasStorage(localStorageLike)) {
        try {
            const raw = localStorageLike.getItem(STORAGE_KEY);
            hasLocalRaw = Boolean(raw && String(raw).trim());
            if (hasLocalRaw) {
                localPlant = loadPlantState(localStorageLike, STORAGE_KEY);
            }
        } catch {
            localPlant = null;
            hasLocalRaw = false;
        }
    }

    if (hasLocalRaw && localPlant) {
        const migrated = await savePlantToApi(apiStorage, localPlant);
        return { plant: localPlant, source: migrated ? 'migrate' : 'local' };
    }

    const fresh = normalizeState(null);
    await savePlantToApi(apiStorage, fresh);
    if (hasStorage(localStorageLike)) {
        try {
            savePlantState(fresh, localStorageLike);
        } catch { /* ignore */ }
    }
    return { plant: fresh, source: 'new' };
}

/**
 * 保存：API + LS 双写；API 失败仍写 LS。
 */
export async function persistPlant(apiStorage, plant, localStorageLike = window.localStorage) {
    if (!plant) return false;
    if (hasStorage(localStorageLike)) {
        try {
            savePlantState(plant, localStorageLike);
        } catch { /* ignore */ }
    }
    return savePlantToApi(apiStorage, plant);
}

/**
 * 备份导入：写 API + LS。
 */
export async function restorePlantFromBackup(apiStorage, backupPlantPayload, localStorageLike = window.localStorage) {
    if (!backupPlantPayload || typeof backupPlantPayload !== 'object') return false;
    const rawPlant = backupPlantPayload.plant || backupPlantPayload;
    const plant = normalizeState(rawPlant);
    const payload = {
        schemaVersion: Number(backupPlantPayload.schemaVersion) || PLANT_SCHEMA_VERSION,
        plant,
        updatedAt: new Date().toISOString(),
    };
    try {
        if (apiStorage?.savePlant) await apiStorage.savePlant(payload);
    } catch (e) {
        console.warn('restore plant to api failed', e);
    }
    if (hasStorage(localStorageLike)) {
        try {
            savePlantState(plant, localStorageLike);
        } catch { /* ignore */ }
    }
    return true;
}

/**
 * 设置页：强制重置为第 1 天（保留 totalCycles）。
 */
export async function resetPlant(apiStorage, localStorageLike = window.localStorage) {
    let current = null;
    if (hasStorage(localStorageLike)) {
        try {
            current = loadPlantState(localStorageLike, STORAGE_KEY);
        } catch {
            current = null;
        }
    }
    if (!current) {
        try {
            const fromApi = await loadPlantFromApi(apiStorage);
            current = fromApi.plant;
        } catch {
            current = null;
        }
    }
    const next = forceResetCycle(current || normalizeState(null), Date.now());
    await persistPlant(apiStorage, next, localStorageLike);
    try {
        if (typeof localStorageLike?.removeItem === 'function') {
            localStorageLike.removeItem('pc-plant-debug-state');
            localStorageLike.removeItem('pc-plant-debug');
        }
    } catch { /* ignore */ }
    return next;
}
