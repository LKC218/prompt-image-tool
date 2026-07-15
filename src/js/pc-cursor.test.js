import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('PC 自定义光标', () => {
    beforeEach(() => {
        vi.resetModules();
        document.body.innerHTML = '<main id="app"><button id="action" type="button">操作</button><input id="input"><div id="canvas"></div><div id="recent" class="pc-recent-item" data-cursor="action">最近使用</div><div id="pointer-card" style="cursor:pointer">指针卡片</div><div id="native-card" data-cursor="native" style="cursor:pointer">原生卡片</div></main>';
        window.matchMedia = vi.fn((query) => ({
            matches: query === '(hover: hover) and (pointer: fine)',
            addEventListener: vi.fn(),
            removeEventListener: vi.fn()
        }));
        window.requestAnimationFrame = vi.fn((callback) => {
            callback();
            return 1;
        });
        window.cancelAnimationFrame = vi.fn();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('在精细指针设备创建主题色跟随层，并在按钮悬停时放大', async () => {
        const { initPcCursor } = await import('./pc-cursor.js');
        const app = document.getElementById('app');
        const action = document.getElementById('action');
        const controller = initPcCursor(app);

        action.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 120, clientY: 80 }));

        expect(app.classList.contains('pc-custom-cursor-enabled')).toBe(true);
        expect(app.querySelector('.pc-custom-cursor.is-visible.is-hovering')).not.toBeNull();
        expect(action.classList.contains('pc-custom-cursor-target')).toBe(true);

        controller.destroy();
        expect(app.querySelector('.pc-custom-cursor')).toBeNull();
    });

    it('文本输入区域保留原生插入光标，不进入悬停放大态', async () => {
        const { initPcCursor } = await import('./pc-cursor.js');
        const app = document.getElementById('app');
        const input = document.getElementById('input');
        const controller = initPcCursor(app);

        input.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 80, clientY: 40 }));

        expect(app.querySelector('.pc-custom-cursor.is-hovering')).toBeNull();
        expect(input.classList.contains('pc-custom-cursor-target')).toBe(false);
        controller.destroy();
    });

    it('最近使用卡片的显式 pointer 光标会被自定义光标接管', async () => {
        const { initPcCursor } = await import('./pc-cursor.js');
        const app = document.getElementById('app');
        const recent = document.getElementById('recent');
        const controller = initPcCursor(app);

        recent.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 60, clientY: 40 }));

        expect(recent.classList.contains('pc-custom-cursor-target')).toBe(true);
        expect(app.querySelector('.pc-custom-cursor.is-hovering')).not.toBeNull();
        controller.destroy();
    });

    it('普通 pointer 容器自动接管，native 标记优先保留原生语义', async () => {
        const { initPcCursor } = await import('./pc-cursor.js');
        const app = document.getElementById('app');
        const pointerCard = document.getElementById('pointer-card');
        const nativeCard = document.getElementById('native-card');
        const controller = initPcCursor(app);

        pointerCard.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 60, clientY: 40 }));
        expect(pointerCard.classList.contains('pc-custom-cursor-target')).toBe(true);

        nativeCard.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 80, clientY: 40 }));
        expect(nativeCard.classList.contains('pc-custom-cursor-target')).toBe(false);
        expect(app.querySelector('.pc-custom-cursor.is-custom-active')).toBeNull();
        controller.destroy();
    });

    it('减少动态效果或非精细指针设备不启用自定义光标', async () => {
        window.matchMedia = vi.fn(() => ({ matches: false }));
        const { initPcCursor } = await import('./pc-cursor.js');
        const app = document.getElementById('app');

        expect(initPcCursor(app)).toBeNull();
        expect(app.querySelector('.pc-custom-cursor')).toBeNull();
    });
});
