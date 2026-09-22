import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderWindowChrome, mountWindowChrome, CHROME_ID } from './pc-window-chrome.js';

describe('pc-window-chrome', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div class="pc-app">${renderWindowChrome()}</div>`;
        vi.restoreAllMocks();
    });

    it('renders chrome with drag region and window controls', () => {
        const chrome = document.getElementById(CHROME_ID);
        expect(chrome).toBeTruthy();
        expect(chrome.querySelector('.pc-window-chrome-left')?.hasAttribute('data-tauri-drag-region')).toBe(true);
        expect(chrome.querySelector('.pc-window-chrome-drag')?.hasAttribute('data-tauri-drag-region')).toBe(true);
        expect(chrome.querySelector('[data-chrome-action="toggle-sidebar"]')).toBeTruthy();
        expect(chrome.querySelector('[data-chrome-action="back"]')).toBeTruthy();
        expect(chrome.querySelector('[data-chrome-action="forward"]')).toBeTruthy();
        expect(chrome.querySelector('[data-window-action="minimize"]')).toBeTruthy();
        expect(chrome.querySelector('[data-window-action="maximize"]')).toBeTruthy();
        expect(chrome.querySelector('[data-window-action="close"]')).toBeTruthy();
    });

    it('binds window actions without throwing when tauri is absent', async () => {
        const root = document.querySelector('.pc-app');
        const cleanup = mountWindowChrome(root);
        const minBtn = root.querySelector('[data-window-action="minimize"]');
        minBtn.click();
        await Promise.resolve();
        expect(typeof cleanup).toBe('function');
        cleanup();
    });

    it('toggles maximize on chrome double-click outside buttons', async () => {
        const root = document.querySelector('.pc-app');
        const cleanup = mountWindowChrome(root);
        const drag = root.querySelector('.pc-window-chrome-drag');
        drag.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        await Promise.resolve();
        cleanup();
    });
});
