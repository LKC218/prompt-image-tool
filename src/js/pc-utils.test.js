import { afterEach, describe, expect, it, vi } from 'vitest';
import { hideContextMenu, showContextMenu } from './pc-utils.js';

afterEach(() => {
    hideContextMenu(null, false);
    document.body.innerHTML = '';
    vi.useRealTimers();
});

describe('showContextMenu', () => {
    it('在右键坐标直接展示操作组并返回选中动作', async () => {
        const actionPromise = showContextMenu(24, 32, [{ action: 'copy', label: '复制' }]);
        const menu = document.getElementById('pcContextMenu');

        expect(menu.classList.contains('pc-context-active')).toBe(true);
        expect(menu.querySelector('.pc-context-action').getAttribute('role')).toBe('menuitem');

        menu.querySelector('.pc-context-action').click();
        await expect(actionPromise).resolves.toBe('copy');
    });

    it('三点入口延后展开并在关闭时归还焦点', async () => {
        vi.useFakeTimers();
        const anchor = document.createElement('button');
        document.body.appendChild(anchor);
        const actionPromise = showContextMenu(24, 32, [{ action: 'rename', label: '重命名' }], { anchor, source: 'more' });

        expect(anchor.classList.contains('pc-more-btn-opening')).toBe(true);
        expect(document.getElementById('pcContextMenu').classList.contains('pc-context-active')).toBe(false);

        await vi.advanceTimersByTimeAsync(219);
        expect(document.getElementById('pcContextMenu').classList.contains('pc-context-active')).toBe(false);

        await vi.advanceTimersByTimeAsync(1);
        expect(document.getElementById('pcContextMenu').classList.contains('pc-context-active')).toBe(true);

        hideContextMenu();
        await expect(actionPromise).resolves.toBeNull();
        expect(document.activeElement).toBe(anchor);
    });

    it('Escape 关闭菜单', async () => {
        const actionPromise = showContextMenu(24, 32, [{ action: 'delete', label: '删除' }]);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

        await expect(actionPromise).resolves.toBeNull();
    });

    it('保留焦点模式不会夺走输入框焦点', async () => {
        const input = document.createElement('textarea');
        input.value = '选中文本';
        document.body.appendChild(input);
        input.focus();
        input.setSelectionRange(0, 4);

        const actionPromise = showContextMenu(24, 32, [{ action: 'copy', label: '复制' }], {
            restoreFocusElement: input,
            focusMenu: false
        });
        const menu = document.getElementById('pcContextMenu');

        expect(document.activeElement).toBe(input);
        expect(menu.classList.contains('pc-context-preserve-focus')).toBe(true);
        menu.querySelector('.pc-context-action').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(document.activeElement).toBe(input);

        menu.querySelector('.pc-context-action').click();
        await expect(actionPromise).resolves.toBe('copy');
    });

    it('支持方向键循环导航、键盘执行与外部点击关闭', async () => {
        const actionPromise = showContextMenu(24, 32, [
            { action: 'rename', label: '重命名' },
            { action: 'copy', label: '复制' }
        ]);
        const menu = document.getElementById('pcContextMenu');
        const buttons = menu.querySelectorAll('.pc-context-action');

        expect(document.activeElement).toBe(buttons[0]);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        expect(document.activeElement).toBe(buttons[1]);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await expect(actionPromise).resolves.toBe('copy');

        const outsidePromise = showContextMenu(24, 32, [{ action: 'delete', label: '删除' }]);
        document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        await expect(outsidePromise).resolves.toBeNull();
    });

    it('快速切换三点入口时取消上一轮延迟展开', async () => {
        vi.useFakeTimers();
        const firstAnchor = document.createElement('button');
        const secondAnchor = document.createElement('button');
        document.body.append(firstAnchor, secondAnchor);

        const firstPromise = showContextMenu(24, 32, [{ action: 'rename', label: '重命名' }], { anchor: firstAnchor, source: 'more' });
        const secondPromise = showContextMenu(48, 32, [{ action: 'copy', label: '复制' }], { anchor: secondAnchor, source: 'more' });

        await expect(firstPromise).resolves.toBeNull();
        await vi.advanceTimersByTimeAsync(220);
        expect(document.getElementById('pcContextMenu').classList.contains('pc-context-active')).toBe(true);

        hideContextMenu();
        await expect(secondPromise).resolves.toBeNull();
    });

    it('右键入口按可用空间调整标签延伸方向', () => {
        showContextMenu(window.innerWidth - 10, 32, [{ action: 'copy', label: '复制' }]);
        const menu = document.getElementById('pcContextMenu');

        expect(menu.classList.contains('pc-context-extend-left')).toBe(true);
        expect(menu.querySelector('.pc-context-action').classList.contains('pc-context-action')).toBe(true);
    });

    it('虚拟选区锚点优先将菜单显示在选区上方', () => {
        const actionPromise = showContextMenu(120, 300, [{ action: 'copy', label: '复制' }], {
            referenceRect: { left: 100, top: 300, right: 140, bottom: 320, width: 40, height: 20 },
            placement: { preferredSide: 'top', fallbackSide: 'bottom', gap: 20, safeMargin: 24 }
        });
        const menu = document.getElementById('pcContextMenu');

        expect(menu.classList.contains('pc-context-open-above')).toBe(true);
        expect(menu.classList.contains('pc-context-extend-left')).toBe(false);
        hideContextMenu();
        return expect(actionPromise).resolves.toBeNull();
    });
});
