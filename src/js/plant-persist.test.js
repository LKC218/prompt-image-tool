import { describe, expect, it, vi } from 'vitest';
import {
    loadPlantFromApi,
    loadPlantWithFallback,
    persistPlant,
    restorePlantFromBackup,
    savePlantToApi,
} from './plant-persist.js';
import { STORAGE_KEY } from './plant-core.js';

function memoryStorage() {
    const map = new Map();
    return {
        getItem: (k) => (map.has(k) ? map.get(k) : null),
        setItem: (k, v) => { map.set(k, String(v)); },
        removeItem: (k) => { map.delete(k); },
        _map: map,
    };
}

describe('plant-persist', () => {
    it('loadPlantFromApi 成功返回 plant', async () => {
        const start = Date.UTC(2026, 8, 1);
        const api = {
            getPlant: vi.fn(async () => ({
                schemaVersion: 1,
                plant: { cycleStartAt: start, cycleDay: 5, care: {} },
            })),
        };
        const r = await loadPlantFromApi(api);
        expect(r.source).toBe('api');
        expect(r.plant.cycleStartAt).toBe(start);
    });

    it('API 失败返回 null 不抛', async () => {
        const api = { getPlant: vi.fn(async () => { throw new Error('down'); }) };
        const r = await loadPlantFromApi(api);
        expect(r.plant).toBeNull();
    });

    it('savePlantToApi 包装 schemaVersion', async () => {
        const api = { savePlant: vi.fn(async () => ({})) };
        const ok = await savePlantToApi(api, { cycleDay: 1 });
        expect(ok).toBe(true);
        expect(api.savePlant.mock.calls[0][0].schemaVersion).toBe(1);
    });

    it('无 API 档时从 localStorage 迁移', async () => {
        const ls = memoryStorage();
        const now = Date.now();
        const day1 = now - 7 * 86400000;
        const today = new Date(now);
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        ls.setItem(STORAGE_KEY, JSON.stringify({
            cycleStartAt: day1,
            todayKey: `${y}-${m}-${d}`,
            care: { watered: true, fertilized: false, deugged: false },
            activeDays: 3,
        }));
        const api = {
            getPlant: vi.fn(async () => ({ plant: null })),
            savePlant: vi.fn(async (p) => p),
        };
        const r = await loadPlantWithFallback(api, ls);
        expect(r.source).toBe('migrate');
        expect(r.plant.care.watered).toBe(true);
        expect(r.plant.cycleStartAt).toBe(day1);
        expect(r.plant.cycleDay).toBe(8);
        expect(api.savePlant).toHaveBeenCalled();
    });

    it('双无时新建并落 API', async () => {
        const ls = memoryStorage();
        const api = {
            getPlant: vi.fn(async () => ({ plant: null })),
            savePlant: vi.fn(async (p) => p),
        };
        const r = await loadPlantWithFallback(api, ls);
        expect(r.source).toBe('new');
        expect(r.plant.cycleDay).toBe(1);
        expect(api.savePlant).toHaveBeenCalled();
        expect(ls.getItem(STORAGE_KEY)).toBeTruthy();
    });

    it('persistPlant API 失败仍写 LS', async () => {
        const ls = memoryStorage();
        const api = { savePlant: vi.fn(async () => { throw new Error('x'); }) };
        const plant = { cycleDay: 3, cycleStartAt: 1, care: {} };
        const ok = await persistPlant(api, plant, ls);
        expect(ok).toBe(false);
        expect(ls.getItem(STORAGE_KEY)).toContain('cycleDay');
    });

    it('restorePlantFromBackup 写 API 与 LS', async () => {
        const ls = memoryStorage();
        const api = { savePlant: vi.fn(async (p) => p) };
        const start = Date.now() - 11 * 86400000;
        const ok = await restorePlantFromBackup(api, {
            schemaVersion: 1,
            plant: { cycleStartAt: start },
        }, ls);
        expect(ok).toBe(true);
        expect(api.savePlant).toHaveBeenCalled();
        const saved = JSON.parse(ls.getItem(STORAGE_KEY));
        expect(saved.cycleStartAt).toBe(start);
        expect(saved.cycleDay).toBe(12);
    });
});
