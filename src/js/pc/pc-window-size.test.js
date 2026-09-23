import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    DEFAULT_WIDTH,
    DEFAULT_HEIGHT,
    MIN_WIDTH,
    MIN_HEIGHT,
    fitAspect,
    shouldCorrect,
} from './pc-window-size.js';

describe('pc-window-size', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it('fitAspect keeps 16:9 when work area is large enough', () => {
        expect(fitAspect(1920, 1080)).toEqual({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
        expect(fitAspect(2560, 1440)).toEqual({ width: 1600, height: 900 });
    });

    it('fitAspect scales down proportionally on small work area', () => {
        const fitted = fitAspect(1280, 720);
        expect(fitted.width).toBeLessThanOrEqual(1280);
        expect(fitted.height).toBeLessThanOrEqual(720);
        expect(fitted.width).toBeGreaterThanOrEqual(MIN_WIDTH);
        expect(fitted.height).toBeGreaterThanOrEqual(MIN_HEIGHT);
        const ratio = fitted.width / fitted.height;
        expect(Math.abs(ratio - DEFAULT_WIDTH / DEFAULT_HEIGHT)).toBeLessThan(0.05);
    });

    it('fitAspect never drops below minimum size', () => {
        const fitted = fitAspect(800, 400);
        expect(fitted.width).toBeGreaterThanOrEqual(MIN_WIDTH);
        expect(fitted.height).toBeGreaterThanOrEqual(MIN_HEIGHT);
    });

    it('shouldCorrect detects shrink after minimize restore', () => {
        expect(shouldCorrect({ width: 1580, height: 880 }, { width: 1600, height: 900 })).toBe(true);
        expect(shouldCorrect({ width: 1600, height: 900 }, { width: 1600, height: 900 })).toBe(false);
        expect(shouldCorrect({ width: 1598, height: 898 }, { width: 1600, height: 900 })).toBe(false);
        expect(shouldCorrect({ width: 1597, height: 897 }, { width: 1600, height: 900 })).toBe(true);
        expect(shouldCorrect({ width: 1600, height: 897 }, { width: 1600, height: 900 })).toBe(true);
    });

    it('initWindowSizePolicy is a no-op outside tauri', async () => {
        const { initWindowSizePolicy } = await import('./pc-window-size.js');
        const cleanup = await initWindowSizePolicy();
        expect(typeof cleanup).toBe('function');
        cleanup();
    });
});
