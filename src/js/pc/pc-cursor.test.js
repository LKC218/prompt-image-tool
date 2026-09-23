import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('PC 自定义圆环光标', () => {
    beforeEach(() => {
        vi.resetModules();
        document.body.innerHTML = '<main id="app"><button id="action" type="button">操作</button><input id="input"><div id="pointer-card" style="cursor:pointer">指针卡片</div><div id="native-card" data-cursor="native" style="cursor:pointer">原生卡片</div><button id="loading" aria-busy="true">加载中</button><button id="disabled" disabled>禁用</button><div id="legacy-media" data-cursor="media">媒体</div></main>';
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

    it('在精细指针设备创建单节点圆环，按钮悬停进入 hover 状态', async () => {
        const { initPcCursor } = await import('./pc-cursor.js');
        const app = document.getElementById('app');
        const action = document.getElementById('action');
        const controller = initPcCursor(app);

        action.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 120, clientY: 80 }));

        expect(app.classList.contains('pc-custom-cursor-enabled')).toBe(true);
        const cursor = document.querySelector('.pc-custom-cursor');
        expect(cursor).not.toBeNull();
        expect(cursor.children).toHaveLength(0);
        expect(cursor.classList.contains('is-custom-active')).toBe(true);
        expect(cursor.classList.contains('is-hover')).toBe(true);
        expect(cursor.classList.contains('is-pressed')).toBe(false);

        controller.destroy();
        expect(document.querySelector('.pc-custom-cursor')).toBeNull();
    });

    it('文本输入区域保留原生光标', async () => {
        const { initPcCursor } = await import('./pc-cursor.js');
        const app = document.getElementById('app');
        const input = document.getElementById('input');
        const controller = initPcCursor(app);

        input.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 80, clientY: 40 }));

        expect(app.classList.contains('pc-custom-cursor-native')).toBe(true);
        expect(document.querySelector('.pc-custom-cursor.is-custom-active')).toBeNull();
        controller.destroy();
    });

    it('普通 pointer 容器自动进入 hover，native 标记优先保留原生', async () => {
        const { initPcCursor } = await import('./pc-cursor.js');
        const app = document.getElementById('app');
        const pointerCard = document.getElementById('pointer-card');
        const nativeCard = document.getElementById('native-card');
        const controller = initPcCursor(app);

        pointerCard.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 60, clientY: 40 }));
        expect(document.querySelector('.pc-custom-cursor.is-hover')).not.toBeNull();

        nativeCard.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 80, clientY: 40 }));
        expect(app.classList.contains('pc-custom-cursor-native')).toBe(true);
        expect(document.querySelector('.pc-custom-cursor.is-custom-active')).toBeNull();
        controller.destroy();
    });

    it('加载和禁用控件使用对应光标状态', async () => {
        const { initPcCursor } = await import('./pc-cursor.js');
        const app = document.getElementById('app');
        const loading = document.getElementById('loading');
        const disabled = document.getElementById('disabled');
        const controller = initPcCursor(app);

        loading.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 100, clientY: 40 }));
        expect(document.querySelector('.pc-custom-cursor.is-loading')).not.toBeNull();

        disabled.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 120, clientY: 40 }));
        expect(document.querySelector('.pc-custom-cursor.is-disabled')).not.toBeNull();
        controller.destroy();
    });

    it('按住与释放操作目标会切换按压状态', async () => {
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

    it('遗留 data-cursor 语义标记仍按可点目标处理', async () => {
        const { initPcCursor } = await import('./pc-cursor.js');
        const app = document.getElementById('app');
        const legacyMedia = document.getElementById('legacy-media');
        const controller = initPcCursor(app);

        legacyMedia.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 90, clientY: 50 }));
        expect(document.querySelector('.pc-custom-cursor.is-hover')).not.toBeNull();
        expect(document.querySelector('.pc-custom-cursor.is-media')).toBeNull();
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
