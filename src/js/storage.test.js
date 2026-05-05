import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initStorage, getStorage, isTauri, isCapacitor } from './storage.js';

describe('storage', () => {
    beforeEach(() => {
        vi.resetModules();
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({ status: 'ok' }),
            text: vi.fn().mockResolvedValue('{"status":"ok"}'),
        });
    });

    describe('isTauri', () => {
        it('should be falsy when __TAURI_INTERNALS__ is not defined', () => {
            expect(isTauri).toBeFalsy();
        });
    });

    describe('isCapacitor', () => {
        it('should be falsy when Capacitor is not defined', () => {
            expect(isCapacitor).toBeFalsy();
        });
    });

    describe('getStorage', () => {
        it('should throw error when storage is not initialized', () => {
            expect(() => getStorage()).toThrow('Storage not initialized');
        });
    });

    describe('initStorage', () => {
        it('should initialize ApiStorage on non-Capacitor platform', async () => {
            await initStorage();
            const storage = getStorage();
            expect(storage).toBeTruthy();
            expect(storage.getPlatform()).toBe('pc');
        });
    });
});
