import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pcUtilsMocks = vi.hoisted(() => ({
    closeModal: vi.fn(),
    showModal: vi.fn(),
    showToast: vi.fn(),
}));

const pcCss = readFileSync(resolve(process.cwd(), 'src/css/pc.css'), 'utf8');

vi.mock('./pc-utils.js', () => pcUtilsMocks);

describe('更新记录模块', () => {
    beforeEach(() => {
        vi.resetModules();
        localStorage.clear();
        document.head.innerHTML = '<meta name="version" content="2.4.0">';
        document.body.innerHTML = '<button data-release-notes></button>';
        pcUtilsMocks.closeModal.mockClear();
        pcUtilsMocks.showModal.mockClear();
        pcUtilsMocks.showToast.mockClear();
    });

    afterEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = '';
    });

    it('遮罩提供背景模糊，更新记录弹窗仅保留单向环境阴影', () => {
        const overlayRule = pcCss.match(/\.pc-modal-overlay\s*\{([\s\S]*?)\n\}/)?.[1] || '';
        const releaseModalRule = pcCss.match(/\.pc-modal:has\(\.pc-release-notes\)\s*\{([\s\S]*?)\n\}/)?.[1] || '';

        expect(overlayRule).toContain('backdrop-filter: blur(10px) saturate(0.82)');
        expect(overlayRule).toContain('-webkit-backdrop-filter: blur(10px) saturate(0.82)');
        expect(releaseModalRule).toContain('box-shadow: 0 18px 36px var(--color-shadow-dark)');
        expect(releaseModalRule).not.toContain('-10px -10px');
    });

    it('使用三段式弹窗布局，让版本列表滚动并将操作区固定在底部', () => {
        const dialogRule = pcCss.match(/\.pc-release-notes\s*\{([\s\S]*?)\n\}/)?.[1] || '';
        const scrollRule = pcCss.match(/\.pc-release-notes-scroll\s*\{([\s\S]*?)\n\}/)?.[1] || '';
        const actionsRule = pcCss.match(/\.pc-release-notes-actions\s*\{([\s\S]*?)\n\}/)?.[1] || '';

        expect(dialogRule).toContain('display: flex');
        expect(dialogRule).toContain('flex-direction: column');
        expect(scrollRule).toContain('flex: 1 1 auto');
        expect(scrollRule).toContain('min-height: 0');
        expect(scrollRule).toContain('overflow-y: auto');
        expect(actionsRule).toContain('flex: 0 0 auto');
        expect(actionsRule).toContain('min-height: 86px');
    });

    it('当前版本首次显示为未读，并能同步侧栏提示点', async () => {
        const { hasUnreadReleaseNotes, syncReleaseNotesUnreadBadge } = await import('./release-notes.js');
        const button = document.querySelector('[data-release-notes]');

        expect(hasUnreadReleaseNotes()).toBe(true);
        syncReleaseNotesUnreadBadge();
        expect(button.classList.contains('pc-release-notes-unread')).toBe(true);
        expect(button.getAttribute('aria-label')).toBe('更新记录，有未读更新');
    });

    it('确认阅读后保存当前版本并清除未读状态', async () => {
        const { LAST_SEEN_VERSION_KEY, hasUnreadReleaseNotes, markCurrentReleaseNotesSeen, syncReleaseNotesUnreadBadge } = await import('./release-notes.js');
        const button = document.querySelector('[data-release-notes]');

        expect(markCurrentReleaseNotesSeen()).toBe(true);
        expect(localStorage.getItem(LAST_SEEN_VERSION_KEY)).toBe('2.4.0');
        expect(hasUnreadReleaseNotes()).toBe(false);
        syncReleaseNotesUnreadBadge();
        expect(button.classList.contains('pc-release-notes-unread')).toBe(false);
    });
});
