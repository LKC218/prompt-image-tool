import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('PC 自定义光标', () => {
    beforeEach(() => {
        vi.resetModules();
        document.body.innerHTML = '<main id="app"><button id="action" type="button">操作</button><button id="selected-action" class="selected" type="button">已选操作</button><input id="input"><div id="canvas" data-cursor="media">画布</div><div id="selected-canvas" class="selected" data-cursor="media">已选画布</div><div id="recent" class="pc-recent-item" data-cursor="action">最近使用<button id="favorite" data-cursor="favorite">收藏</button><button id="menu" data-cursor="menu">更多</button></div><div id="pointer-card" style="cursor:pointer">指针卡片</div><div id="native-card" data-cursor="native" style="cursor:pointer">原生卡片</div><button id="loading" aria-busy="true">加载中</button><button id="disabled" disabled>禁用</button></main>';
        window.matchMedia = vi.fn((query) => ({
            matches: query === '(hover: hover) and (pointer: fine)',
            addEventListener: vi.fn(),
            removeEventListener: vi.fn()
        }));
        window.requestAnimationFrame = vi.fn(() => 1);
        window.cancelAnimationFrame = vi.fn();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('在精细指针设备创建四角锁定层，并在按钮悬停时进入操作状态', async () => {
        const { initPcCursor } = await import('./pc-cursor.js');
        const app = document.getElementById('app');
        const action = document.getElementById('action');
        const controller = initPcCursor(app);

        action.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 120, clientY: 80 }));

        expect(app.classList.contains('pc-custom-cursor-enabled')).toBe(true);
        expect(document.querySelector('.pc-custom-cursor.is-custom-active.is-targeting')).not.toBeNull();
        expect(document.querySelectorAll('.pc-custom-cursor-corner')).toHaveLength(4);
        expect(action.classList.contains('pc-custom-cursor-target')).toBe(true);
        expect(document.querySelector('.pc-custom-cursor').style.getPropertyValue('--pc-accent')).toBe('');
        expect(document.querySelector('.pc-custom-cursor').style.getPropertyValue('--pc-accent-light')).toBe('');
        expect(document.querySelector('.pc-custom-cursor').style.getPropertyValue('--pc-accent-strong')).toBe('');

        controller.destroy();
        expect(document.querySelector('.pc-custom-cursor')).toBeNull();
    });

    it('文本输入区域保留原生插入光标，不进入目标锁定状态', async () => {
        const { initPcCursor } = await import('./pc-cursor.js');
        const app = document.getElementById('app');
        const input = document.getElementById('input');
        const controller = initPcCursor(app);

        input.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 80, clientY: 40 }));

        expect(document.querySelector('.pc-custom-cursor.is-targeting')).toBeNull();
        expect(input.classList.contains('pc-custom-cursor-target')).toBe(false);
        controller.destroy();
    });

    it('最近使用卡片的显式 pointer 光标会被自定义光标接管', async () => {
        const { initPcCursor } = await import('./pc-cursor.js');
        const app = document.getElementById('app');
        const recent = document.getElementById('recent');
        const controller = initPcCursor(app);

        recent.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 60, clientY: 40 }));

        expect(recent.classList.contains('pc-custom-cursor-target')).toBe(true);
        expect(document.querySelector('.pc-custom-cursor.is-targeting')).not.toBeNull();
        controller.destroy();
    });

    it('媒体标记优先进入媒体锁定状态', async () => {
        const { initPcCursor } = await import('./pc-cursor.js');
        const app = document.getElementById('app');
        const canvas = document.getElementById('canvas');
        const controller = initPcCursor(app);

        canvas.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 100, clientY: 60 }));

        expect(canvas.classList.contains('pc-custom-cursor-target')).toBe(true);
        expect(canvas.classList.contains('pc-custom-cursor-media-target')).toBe(true);
        expect(document.querySelector('.pc-custom-cursor.is-targeting.is-media')).not.toBeNull();
        controller.destroy();
    });

    it('卡片子控件以专属语义接管四角定位框', async () => {
        const { initPcCursor } = await import('./pc-cursor.js');
        const app = document.getElementById('app');
        const recent = document.getElementById('recent');
        const favorite = document.getElementById('favorite');
        const menu = document.getElementById('menu');
        const controller = initPcCursor(app);

        favorite.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 100, clientY: 40 }));
        expect(favorite.classList.contains('pc-custom-cursor-target')).toBe(true);
        expect(recent.classList.contains('pc-custom-cursor-target')).toBe(false);
        expect(document.querySelector('.pc-custom-cursor.is-favorite')).not.toBeNull();

        menu.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 120, clientY: 40 }));
        expect(menu.classList.contains('pc-custom-cursor-target')).toBe(true);
        expect(document.querySelector('.pc-custom-cursor.is-menu')).not.toBeNull();
        controller.destroy();
    });

    it('加载和禁用控件使用专属自定义光标状态', async () => {
        const { initPcCursor } = await import('./pc-cursor.js');
        const app = document.getElementById('app');
        const loading = document.getElementById('loading');
        const disabled = document.getElementById('disabled');
        const controller = initPcCursor(app);

        loading.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 100, clientY: 40 }));
        expect(loading.classList.contains('pc-custom-cursor-target')).toBe(true);
        expect(document.querySelector('.pc-custom-cursor.is-loading')).not.toBeNull();

        disabled.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 120, clientY: 40 }));
        expect(disabled.classList.contains('pc-custom-cursor-target')).toBe(true);
        expect(document.querySelector('.pc-custom-cursor.is-disabled')).not.toBeNull();
        controller.destroy();
    });

    it('已选中操作与媒体目标使用选中颜色状态', async () => {
        const { initPcCursor } = await import('./pc-cursor.js');
        const app = document.getElementById('app');
        const selectedAction = document.getElementById('selected-action');
        const selectedCanvas = document.getElementById('selected-canvas');
        const controller = initPcCursor(app);

        selectedAction.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 90, clientY: 40 }));
        expect(document.querySelector('.pc-custom-cursor.is-targeting.is-selected')).not.toBeNull();

        selectedCanvas.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 110, clientY: 60 }));
        expect(document.querySelector('.pc-custom-cursor.is-targeting.is-media.is-selected')).not.toBeNull();
        controller.destroy();
    });

    it('按住与释放操作目标会切换光标按压状态', async () => {
        const { initPcCursor } = await import('./pc-cursor.js');
        const app = document.getElementById('app');
        const action = document.getElementById('action');
        const controller = initPcCursor(app);

        action.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 120, clientY: 80 }));
        action.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(document.querySelector('.pc-custom-cursor.is-pressed')).not.toBeNull();

        window.dispatchEvent(new PointerEvent('pointerup'));
        expect(document.querySelector('.pc-custom-cursor.is-pressed')).toBeNull();
        controller.destroy();
    });

    it('普通 pointer 容器自动接管，native 标记优先保留原生语义', async () => {
        const { initPcCursor } = await import('./pc-cursor.js');
        const app = document.getElementById('app');
        const pointerCard = document.getElementById('pointer-card');
        const nativeCard = document.getElementById('native-card');
        const controller = initPcCursor(app);

        pointerCard.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 60, clientY: 40 }));
        expect(pointerCard.classList.contains('pc-custom-cursor-target')).toBe(true);

        nativeCard.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 80, clientY: 40 }));
        expect(nativeCard.classList.contains('pc-custom-cursor-target')).toBe(false);
        expect(document.querySelector('.pc-custom-cursor.is-custom-active')).toBeNull();
        controller.destroy();
    });

    it('减少动态效果或非精细指针设备不启用自定义光标', async () => {
        window.matchMedia = vi.fn(() => ({ matches: false }));
        const { initPcCursor } = await import('./pc-cursor.js');
        const app = document.getElementById('app');

        expect(initPcCursor(app)).toBeNull();
        expect(document.querySelector('.pc-custom-cursor')).toBeNull();
    });
});
