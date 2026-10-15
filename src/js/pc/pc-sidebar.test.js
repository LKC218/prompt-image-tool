import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { setupSidebarHover } from './pc-sidebar.js';

describe('悬停推开式侧栏', () => {
    let root, stage, menu, outside, cleanup, state, media, onStateChange;
    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = '<div id="root"><aside id="pcSidebarStage"><button>导航</button></aside><div id="pcSidebarMoreMenu" hidden><button>菜单</button></div><button id="outside">正文</button></div>';
        root = document.querySelector('#root');
        stage = document.querySelector('#pcSidebarStage');
        menu = document.querySelector('#pcSidebarMoreMenu');
        outside = document.querySelector('#outside');
        media = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
        window.matchMedia = vi.fn(() => media);
        onStateChange = vi.fn(collapsed => { state = collapsed; });
        cleanup = setupSidebarHover(root, { onStateChange });
    });
    afterEach(() => { cleanup(); vi.useRealTimers(); document.body.innerHTML = ''; });
    const enter = () => stage.dispatchEvent(new Event('pointerenter'));
    const leave = () => stage.dispatchEvent(new Event('pointerleave'));

    it('默认收起、立即展开、移出150毫秒后收起', () => {
        expect(state).toBe(true);
        enter(); expect(state).toBe(false);
        leave(); vi.advanceTimersByTime(149); expect(state).toBe(false);
        vi.advanceTimersByTime(1); expect(state).toBe(true);
    });
    it('再次移入取消收起并允许随时反向，不依赖动画结束事件', () => {
        enter(); leave(); vi.advanceTimersByTime(100); enter();
        vi.advanceTimersByTime(200); expect(state).toBe(false);
        leave(); vi.advanceTimersByTime(150); expect(state).toBe(true);
        enter(); expect(state).toBe(false);
    });
    it('首屏不落定，真实收起才添加反馈，重新移入立即取消', () => {
        expect(root.classList.contains('pc-sidebar-collapse-feedback')).toBe(false);
        enter(); leave(); vi.advanceTimersByTime(150);
        expect(root.classList.contains('pc-sidebar-collapse-feedback')).toBe(true);
        // 重复同步不移除反馈类，也不会让 CSS 重播动画。
        leave(); vi.advanceTimersByTime(150);
        expect(root.classList.contains('pc-sidebar-collapse-feedback')).toBe(true);
        enter();
        expect(root.classList.contains('pc-sidebar-collapse-feedback')).toBe(false);
    });
    it('低动效只切换布局，不添加落定反馈', () => {
        window.matchMedia.mockImplementation(query => ({ matches: query.includes('reduced-motion') }));
        enter(); leave(); vi.advanceTimersByTime(150);
        expect(state).toBe(true);
        expect(root.classList.contains('pc-sidebar-collapse-feedback')).toBe(false);
    });
    it('卸载移除落定反馈，重新挂载不残留', () => {
        enter(); leave(); vi.advanceTimersByTime(150);
        cleanup();
        expect(root.classList.contains('pc-sidebar-collapse-feedback')).toBe(false);
    });
    it('鼠标点击留下的焦点不会锁住侧栏', () => {
        enter();
        stage.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        stage.querySelector('button').focus();
        leave(); vi.advanceTimersByTime(150);
        expect(state).toBe(true);
    });
    it('键盘焦点在内部保持展开、离开后收起', async () => {
        stage.querySelector('button').focus();
        expect(state).toBe(false);
        outside.focus(); await vi.advanceTimersByTimeAsync(150);
        expect(state).toBe(true);
    });
    it('外置菜单打开保持展开，关闭后恢复鼠标控制', async () => {
        enter(); menu.hidden = false; await Promise.resolve();
        leave(); vi.advanceTimersByTime(500); expect(state).toBe(false);
        menu.hidden = true; await Promise.resolve();
        vi.advanceTimersByTime(150); expect(state).toBe(true);
    });
    it('键盘从侧栏移入菜单不收起', async () => {
        menu.hidden = false;
        menu.querySelector('button').focus();
        await vi.advanceTimersByTimeAsync(300);
        expect(state).toBe(false);
    });
    it('无悬停设备保持展开，设备模式变化后重新计算', () => {
        media.matches = true;
        media.addEventListener.mock.calls[0][1]();
        leave(); vi.advanceTimersByTime(500);
        expect(state).toBe(false);
        media.matches = false;
        media.addEventListener.mock.calls[0][1]();
        vi.advanceTimersByTime(150); expect(state).toBe(true);
    });
    it('卸载清理计时器和监听，不回写旧状态', () => {
        enter(); leave(); cleanup();
        const calls = onStateChange.mock.calls.length;
        vi.advanceTimersByTime(500); enter();
        expect(onStateChange).toHaveBeenCalledTimes(calls);
        expect(media.removeEventListener).toHaveBeenCalled();
    });
    it('触摸进入事件不误判为悬停', () => {
        const event = new Event('pointerenter');
        Object.defineProperty(event, 'pointerType', { value: 'touch' });
        stage.dispatchEvent(event);
        expect(state).toBe(true);
    });
});
