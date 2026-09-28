import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const overlayCss = readFileSync(resolve(process.cwd(), 'src/css/pc/05c-global-overlays.css'), 'utf8');

const detailMocks = vi.hoisted(() => ({
    render: vi.fn(() => `
        <div class="pc-detail-page-title">详情标题</div>
        <div class="pc-detail-page-name">详情标题</div>
        <div class="pc-detail-breadcrumb"></div>
        <div class="pc-detail-top-nav-actions">
            <button class="pc-detail-top-nav-btn" id="pcDetailStar" type="button">收藏</button>
            <button class="pc-detail-top-nav-btn" id="pcDetailMoreTop" type="button">更多</button>
            <button class="pc-detail-top-nav-btn" data-detail-action="collapse" type="button">收起</button>
            <button class="pc-detail-top-nav-btn" data-detail-action="close" type="button">关闭详情</button>
        </div>
    `),
    mount: vi.fn(async () => {}),
    unmount: vi.fn(),
}));

function minimizeActiveDetail() {
    document.querySelector('.pc-prompt-detail-modal:not(.pc-prompt-detail-modal-minimized) [data-detail-action="collapse"]')
        ?.click();
}

vi.mock('gsap', () => ({
    gsap: {
        fromTo: vi.fn(),
        set: vi.fn(),
        to: vi.fn(),
        timeline: vi.fn(() => ({
            to() { return this; },
            set() { return this; },
            kill: vi.fn(),
        })),
    },
}));

vi.mock('./pc-detail.js', () => detailMocks);

describe('pc-detail-modal background scroll lock', () => {
    beforeEach(() => {
        vi.resetModules();
        document.body.innerHTML = '<div id="pcApp"><main id="pcMain" style="overflow: auto"></main></div>';
        window.matchMedia = vi.fn(() => ({ matches: true }));
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('展开详情时锁定实际页面滚动容器，关闭后恢复原始样式', async () => {
        const { openPromptDetail, closePromptDetail } = await import('./pc-detail-modal.js');
        const main = document.getElementById('pcMain');

        await openPromptDetail('prompt-1');

        expect(main.style.overflow).toBe('hidden');
        expect(main.dataset.pcDetailModalOverflow).toBe('auto');

        await closePromptDetail('prompt-1');

        expect(main.style.overflow).toBe('auto');
        expect(main.dataset.pcDetailModalOverflow).toBeUndefined();
    });

    it('全部窗口最小化后恢复页面滚动', async () => {
        const { openPromptDetail, minimizePromptDetail } = await import('./pc-detail-modal.js');
        const main = document.getElementById('pcMain');

        await openPromptDetail('prompt-1');
        await minimizePromptDetail('prompt-1');

        expect(main.style.overflow).toBe('auto');
    });

    it('将多个最小化详情合并为一个带数量的恢复入口', async () => {
        const { openPromptDetail, minimizePromptDetail } = await import('./pc-detail-modal.js');

        await openPromptDetail('prompt-1');
        await minimizePromptDetail('prompt-1');
        await openPromptDetail('prompt-2');
        await minimizePromptDetail('prompt-2');

        const buttons = document.querySelectorAll('.pc-prompt-detail-minimized-button');
        expect(buttons).toHaveLength(1);
        expect(buttons[0].querySelector('.pc-prompt-detail-minimized-count')?.textContent).toBe('2');
        expect(buttons[0].getAttribute('aria-label')).toContain('共 2 项');
    });

    it('摘要入口展开可选列表且不直接恢复详情', async () => {
        const { openPromptDetail, minimizePromptDetail } = await import('./pc-detail-modal.js');

        await openPromptDetail('prompt-1');
        await minimizePromptDetail('prompt-1');
        await openPromptDetail('prompt-2');
        await minimizePromptDetail('prompt-2');
        document.querySelector('.pc-prompt-detail-minimized-button').click();

        expect(document.querySelectorAll('.pc-prompt-detail-minimized-item')).toHaveLength(2);
        expect(document.querySelector('.pc-prompt-detail-minimized-button')?.getAttribute('aria-expanded')).toBe('true');
        expect(document.querySelector('.pc-prompt-detail-minimized-count')?.textContent).toBe('2');
        expect(document.querySelector('.pc-prompt-detail-modal:not(.pc-prompt-detail-modal-minimized)')).toBeNull();
    });

    it('选择收纳列表中的指定详情后只恢复该项', async () => {
        const { openPromptDetail, minimizePromptDetail } = await import('./pc-detail-modal.js');

        await openPromptDetail('prompt-1');
        await minimizePromptDetail('prompt-1');
        await openPromptDetail('prompt-2');
        await minimizePromptDetail('prompt-2');
        document.querySelector('.pc-prompt-detail-minimized-button').click();
        document.querySelector('.pc-prompt-detail-minimized-item[data-prompt-id="prompt-1"]').click();
        await Promise.resolve();

        expect(document.querySelector('.pc-prompt-detail-modal[data-prompt-id="prompt-1"]')?.classList.contains('pc-prompt-detail-modal-minimized')).toBe(false);
        expect(document.querySelector('.pc-prompt-detail-modal[data-prompt-id="prompt-2"]')?.classList.contains('pc-prompt-detail-modal-minimized')).toBe(true);
        expect(document.querySelector('.pc-prompt-detail-minimized-count')?.textContent).toBe('1');
        expect(document.querySelector('.pc-prompt-detail-minimized-list')).toBeNull();
    });

    it('点击托盘外部或按 Escape 时收起选择列表', async () => {
        const { openPromptDetail, minimizePromptDetail } = await import('./pc-detail-modal.js');

        await openPromptDetail('prompt-1');
        await minimizePromptDetail('prompt-1');
        const button = document.querySelector('.pc-prompt-detail-minimized-button');
        button.click();
        document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

        expect(document.querySelector('.pc-prompt-detail-minimized-list')).toBeNull();
        button.click();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

        expect(document.querySelector('.pc-prompt-detail-minimized-list')).toBeNull();
        expect(button.getAttribute('aria-expanded')).toBe('false');
    });

    it('最小化状态下遮罩不拦截页面指针事件', () => {
        expect(overlayCss).toMatch(/\.pc-prompt-detail-modal-backdrop\s*\{[\s\S]*?pointer-events:\s*none;/);
        expect(overlayCss).toMatch(/\.pc-prompt-detail-modal-host-active\s+\.pc-prompt-detail-modal-backdrop\s*\{[\s\S]*?pointer-events:\s*auto;/);
    });

    it('双窗口时不降低非活动详情窗口的整体透明度', () => {
        expect(overlayCss).not.toMatch(/\.pc-prompt-detail-modal:not\(\.pc-prompt-detail-modal-active\)\s*\{[\s\S]*?opacity:/);
    });
});

describe('pc-detail-modal merged chrome (M1)', () => {
    beforeEach(async () => {
        vi.resetModules();
        const { renderWindowChrome } = await import('./pc-window-chrome.js');
        document.body.innerHTML = `<div id="pcApp">${renderWindowChrome()}<main id="pcMain" style="overflow: auto"></main></div>`;
        window.matchMedia = vi.fn(() => ({ matches: true }));
    });

    afterEach(() => {
        document.body.innerHTML = '';
        document.documentElement.classList.remove('pc-prompt-detail-open');
        vi.restoreAllMocks();
    });

    it('详情面板不渲染窗口按钮 − ×，软件三键仍在 chrome', async () => {
        const { openPromptDetail } = await import('./pc-detail-modal.js');
        await openPromptDetail('prompt-1');

        expect(document.querySelector('.pc-prompt-detail-modal-actions')).toBeNull();
        expect(document.querySelector('.pc-prompt-detail-modal-minimize')).toBeNull();
        expect(document.querySelector('.pc-prompt-detail-modal-close')).toBeNull();
        expect(document.querySelector('[data-window-action="minimize"]')).toBeTruthy();
        expect(document.querySelector('[data-window-action="maximize"]')).toBeTruthy();
        expect(document.querySelector('[data-window-action="close"]')).toBeTruthy();
    });

    it('详情打开时 chrome 仅显示面包屑，产品动作在面板头', async () => {
        const { openPromptDetail } = await import('./pc-detail-modal.js');
        await openPromptDetail('prompt-1');

        const detailBar = document.querySelector('.pc-window-chrome-detail');
        expect(detailBar).toBeTruthy();
        expect(detailBar.hidden).toBe(false);
        expect(document.querySelector('.pc-window-chrome-crumb-title')?.textContent).toBe('详情标题');
        expect(document.querySelector('.pc-window-chrome-detail [data-detail-action]')).toBeNull();
        expect(document.querySelector('.pc-prompt-detail-modal [data-detail-action="collapse"]')).toBeTruthy();
        expect(document.querySelector('.pc-prompt-detail-modal [data-detail-action="close"]')).toBeTruthy();
        expect(document.documentElement.classList.contains('pc-prompt-detail-open')).toBe(true);
    });

    it('面板头关闭详情按钮关闭活动窗口', async () => {
        const { openPromptDetail } = await import('./pc-detail-modal.js');
        await openPromptDetail('prompt-1');

        document.querySelector('.pc-prompt-detail-modal [data-detail-action="close"]').click();
        await Promise.resolve();
        await Promise.resolve();

        expect(document.querySelector('.pc-prompt-detail-modal')).toBeNull();
        expect(document.querySelector('.pc-window-chrome-detail')?.hidden).toBe(true);
        expect(document.documentElement.classList.contains('pc-prompt-detail-open')).toBe(false);
    });

    it('面板头收起按钮将详情收进托盘', async () => {
        const { openPromptDetail } = await import('./pc-detail-modal.js');
        await openPromptDetail('prompt-1');

        minimizeActiveDetail();
        await Promise.resolve();
        await Promise.resolve();

        expect(document.querySelector('.pc-prompt-detail-modal:not(.pc-prompt-detail-modal-minimized)')).toBeNull();
        expect(document.querySelector('.pc-prompt-detail-minimized-button')).toBeTruthy();
        expect(document.querySelector('.pc-window-chrome-detail')?.hidden).toBe(true);
    });

    it('Tab 焦点环包含面板头收起/关闭详情', async () => {
        const { openPromptDetail } = await import('./pc-detail-modal.js');
        await openPromptDetail('prompt-1');

        const panel = document.querySelector('.pc-prompt-detail-modal');
        const collapse = panel.querySelector('[data-detail-action="collapse"]');
        const closeDetail = panel.querySelector('[data-detail-action="close"]');
        expect(panel).toBeTruthy();
        expect(collapse).toBeTruthy();
        expect(closeDetail).toBeTruthy();

        closeDetail.focus();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        const focused = document.activeElement;
        expect(focused === collapse || focused === closeDetail || panel.contains(focused) || focused === panel).toBe(true);
    });
});
