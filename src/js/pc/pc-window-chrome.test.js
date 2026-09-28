import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderWindowChrome, mountWindowChrome, setChromeDetailContext, syncChromeDetailTitle, CHROME_ID } from './pc-window-chrome.js';

describe('pc-window-chrome', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div class="pc-app">${renderWindowChrome()}</div>`;
        document.documentElement.classList.remove('pc-prompt-detail-open');
        setChromeDetailContext(null);
        vi.restoreAllMocks();
    });

    it('renders chrome with drag region and window controls', () => {
        const chrome = document.getElementById(CHROME_ID);
        expect(chrome).toBeTruthy();
        expect(chrome.querySelector('.pc-window-chrome-left')?.hasAttribute('data-tauri-drag-region')).toBe(true);
        expect(chrome.querySelector('.pc-window-chrome-drag')?.hasAttribute('data-tauri-drag-region')).toBe(true);
        expect(chrome.querySelector('[data-chrome-action]')).toBeNull();
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

    it('shows breadcrumb only when chrome detail context is set', () => {
        setChromeDetailContext({ title: 'GIT推送/汇总工作' });

        const chrome = document.getElementById(CHROME_ID);
        expect(chrome.classList.contains('pc-window-chrome-detail-mode')).toBe(true);
        expect(chrome.querySelector('.pc-window-chrome-detail')?.hidden).toBe(false);
        expect(chrome.querySelector('.pc-window-chrome-crumb-title')?.textContent).toBe('GIT推送/汇总工作');
        expect(chrome.querySelector('[data-detail-action]')).toBeNull();
        expect(document.documentElement.classList.contains('pc-prompt-detail-open')).toBe(true);
    });

    it('restores default chrome after clearing detail context', () => {
        setChromeDetailContext({ title: '标题B' });
        setChromeDetailContext(null);

        const chrome = document.getElementById(CHROME_ID);
        expect(chrome.classList.contains('pc-window-chrome-detail-mode')).toBe(false);
        expect(chrome.querySelector('.pc-window-chrome-detail')?.hidden).toBe(true);
        expect(document.documentElement.classList.contains('pc-prompt-detail-open')).toBe(false);
    });

    it('syncs detail title for dual-window focus switches', () => {
        setChromeDetailContext({ title: '旧标题' });
        syncChromeDetailTitle('新标题');
        expect(document.querySelector('.pc-window-chrome-crumb-title')?.textContent).toBe('新标题');
    });
});
