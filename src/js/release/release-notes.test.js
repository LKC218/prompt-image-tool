import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readPcCss } from '../pc/pc-css-test-utils.js';

const pcUtilsMocks = vi.hoisted(() => ({
    closeModal: vi.fn(),
    showModal: vi.fn(),
    showToast: vi.fn(),
}));

const pcCss = readPcCss();

vi.mock('../pc/pc-utils.js', () => pcUtilsMocks);

describe('更新记录模块', () => {
    beforeEach(() => {
        vi.resetModules();
        localStorage.clear();
        document.head.innerHTML = '<meta name="version" content="2.5.2">';
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

    it('使用三段式弹窗布局，让阶段列表滚动并将操作区固定在底部', () => {
        const dialogRule = pcCss.match(/\.pc-release-notes\s*\{([\s\S]*?)\n\}/)?.[1] || '';
        const bodyRule = pcCss.match(/\.pc-release-notes-body\s*\{([\s\S]*?)\n\}/)?.[1] || '';
        const scrollRule = pcCss.match(/\.pc-release-notes-scroll\s*\{([\s\S]*?)\n\}/)?.[1] || '';
        const railRule = pcCss.match(/\.pc-release-phase-rail\s*\{([\s\S]*?)\n\}/)?.[1] || '';
        const actionsRule = pcCss.match(/\.pc-release-notes-actions\s*\{([\s\S]*?)\n\}/)?.[1] || '';

        expect(dialogRule).toContain('display: flex');
        expect(dialogRule).toContain('flex-direction: column');
        expect(bodyRule).toContain('display: flex');
        expect(scrollRule).toContain('flex: 1 1 auto');
        expect(scrollRule).toContain('min-height: 0');
        expect(scrollRule).toContain('overflow-y: auto');
        expect(scrollRule).toContain('scrollbar-width: none');
        expect(railRule).toContain('flex: 0 0 28px');
        expect(actionsRule).toContain('flex: 0 0 auto');
        expect(actionsRule).toContain('min-height: 86px');
    });

    it('打开弹窗：阶段轨每个版本仅一条刻度，与版本卡一一对应', async () => {
        const { openReleaseNotes } = await import('./release-notes.js');
        const { RELEASE_NOTES } = await import('./release-notes-data.js');
        const rendered = document.createElement('div');
        pcUtilsMocks.showModal.mockImplementationOnce((html) => {
            rendered.innerHTML = html;
            return rendered;
        });

        openReleaseNotes();

        const ticks = rendered.querySelectorAll('.pc-release-phase-tick');
        const phases = rendered.querySelectorAll('.pc-release-phase');
        const steps = rendered.querySelectorAll('.pc-release-step');

        expect(rendered.querySelector('.pc-release-phase-rail')).toBeTruthy();
        expect(rendered.querySelector('.pc-release-phase-tooltip')).toBeTruthy();
        expect(ticks.length).toBe(RELEASE_NOTES.length);
        expect(phases.length).toBe(RELEASE_NOTES.length);
        expect(steps.length).toBe(RELEASE_NOTES.reduce((sum, note) => sum + note.sections.length, 0));
        expect(rendered.querySelectorAll('.pc-release-phase-tick-section, .pc-release-phase-tick-tone-pink, .pc-release-step-count').length).toBe(0);

        const currentTick = rendered.querySelector('.pc-release-phase-tick.is-current');
        expect(currentTick?.dataset.phaseTarget).toBe('2.5.2');
        expect(currentTick?.dataset.stepLabel).toContain('v2.5.2');
        expect(currentTick?.getAttribute('aria-current')).toBe('true');

        const currentPhase = rendered.querySelector('.pc-release-phase-current');
        expect(currentPhase?.dataset.phaseVersion).toBe('2.5.2');

        ticks.forEach((tick) => {
            const stepId = tick.dataset.stepId;
            const phase = rendered.querySelector(`.pc-release-phase[data-step-id="${stepId}"]`);
            expect(phase).toBeTruthy();
            expect(phase.dataset.phaseVersion).toBe(tick.dataset.phaseTarget);
        });
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
        expect(localStorage.getItem(LAST_SEEN_VERSION_KEY)).toBe('2.5.2');
        expect(hasUnreadReleaseNotes()).toBe(false);
        syncReleaseNotesUnreadBadge();
        expect(button.classList.contains('pc-release-notes-unread')).toBe(false);
    });

    it('打开弹窗即写入已读，底栏仅保留单个关闭按钮', async () => {
        const { LAST_SEEN_VERSION_KEY, openReleaseNotes } = await import('./release-notes.js');
        const rendered = document.createElement('div');
        pcUtilsMocks.showModal.mockImplementationOnce((html) => {
            rendered.innerHTML = html;
            return rendered;
        });

        openReleaseNotes();

        expect(localStorage.getItem(LAST_SEEN_VERSION_KEY)).toBe('2.5.2');
        expect(rendered.querySelector('[data-release-close]')).toBeTruthy();
        expect(rendered.innerHTML).not.toContain('稍后查看');
        expect(rendered.innerHTML).not.toContain('我知道了');
        expect(rendered.querySelectorAll('[data-release-later], [data-release-acknowledge]').length).toBe(0);
    });
});
