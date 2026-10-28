import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readPcCss } from './pc-css-test-utils.js';
import {
    KINETIC_INTENSITY,
    normalizeRouteAnchor,
    resolveTransitionVector,
    createSidebarJellyController,
    createPageTransitionOrchestrator,
} from './pc-page-transition.js';

const pcCss = readPcCss();

function createMockAnimation() {
    let resolveFinished;
    const finished = new Promise((resolve) => {
        resolveFinished = resolve;
    });
    const anim = {
        finished,
        cancel: vi.fn(() => {
            resolveFinished?.();
        }),
        finishNow: () => {
            resolveFinished?.();
        },
    };
    return anim;
}

describe('PC 切页多层速度差与物理弹簧编排（方案 A）', () => {
    let createdAnimations = [];
    let reducedMotion = false;

    beforeEach(() => {
        createdAnimations = [];
        reducedMotion = false;
        document.body.innerHTML = '';

        window.matchMedia = vi.fn((query) => ({
            matches: query.includes('prefers-reduced-motion') ? reducedMotion : false,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }));

        Element.prototype.animate = vi.fn(function mockAnimate(keyframes, options) {
            const anim = createMockAnimation();
            createdAnimations.push({ el: this, keyframes, options, anim });
            return anim;
        });
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete Element.prototype.animate;
        vi.restoreAllMocks();
    });

    it('固定动效力度为 1.25x，且注册了切页弹簧样式与低动效降级规则', () => {
        expect(KINETIC_INTENSITY).toBe(1.25);
        expect(pcCss).toContain('.pc-nav-jelly-bar');
        expect(pcCss).toContain('.pc-sidebar-nav.has-jelly-bar .pc-nav-item.pc-nav-active::before');
        expect(pcCss).toContain('.pc-page.pc-page-exiting');
        expect(pcCss).toContain('pointer-events: none');
        expect(pcCss).toContain('@media (prefers-reduced-motion: reduce)');
    });

    it('准确解析纵向 Tab 上下切换、横向详情推入返回与子路由归一化向量', () => {
        expect(normalizeRouteAnchor('/editor/')).toBe('/editor/:id');
        expect(normalizeRouteAnchor('/detail/:id')).toBe('/library');
        expect(normalizeRouteAnchor('/tetris')).toBe('/games');
        expect(normalizeRouteAnchor('/goals/:id')).toBe('/goals');

        expect(resolveTransitionVector(null, '/', 'tab')).toEqual({
            mode: 'initial',
            axis: 'y',
            sign: 1,
        });
        expect(resolveTransitionVector('/', '/goals', 'tab')).toEqual({
            mode: 'tab-down',
            axis: 'y',
            sign: 1,
        });
        expect(resolveTransitionVector('/settings', '/library', 'tab')).toEqual({
            mode: 'tab-up',
            axis: 'y',
            sign: -1,
        });
        expect(resolveTransitionVector('/library', '/detail/:id', 'push')).toEqual({
            mode: 'push',
            axis: 'x',
            sign: 1,
        });
        expect(resolveTransitionVector('/detail/:id', '/library', 'pop')).toEqual({
            mode: 'pop',
            axis: 'x',
            sign: -1,
        });
        expect(resolveTransitionVector('/library', '/library', 'tab')).toEqual({
            mode: 'refresh',
            axis: 'y',
            sign: 1,
        });
    });

    it('侧栏果冻滑条支持首屏静默定位、跨菜单拉伸超调、重复调用幂等及设置页隐藏', () => {
        const appEl = document.createElement('div');
        appEl.innerHTML = `
            <nav class="pc-sidebar-nav" id="pcSidebarNav">
                <button class="pc-nav-item pc-nav-active" data-nav="/"></button>
                <button class="pc-nav-item" data-nav="/library"></button>
                <button class="pc-nav-item" data-nav="/goals"></button>
            </nav>
        `;
        document.body.appendChild(appEl);

        const navEl = appEl.querySelector('#pcSidebarNav');
        const items = Array.from(navEl.querySelectorAll('.pc-nav-item'));
        items.forEach((item, index) => {
            Object.defineProperty(item, 'offsetHeight', { configurable: true, value: 48 });
            Object.defineProperty(item, 'offsetLeft', { configurable: true, value: 18 });
            Object.defineProperty(item, 'offsetTop', { configurable: true, value: 20 + index * 62 });
        });

        const controller = createSidebarJellyController(appEl);
        const jellyBar = navEl.querySelector('.pc-nav-jelly-bar');
        expect(jellyBar).toBeTruthy();

        // 首屏静默同步：不播动画，直接落位
        controller.sync('/', { animate: false });
        expect(navEl.classList.contains('has-jelly-bar')).toBe(true);
        expect(jellyBar.style.top).toBe('33px');
        expect(createdAnimations).toHaveLength(0);

        // 跨两格切换到 /goals：产生果冻拉伸与超调回缩动画
        controller.sync('/goals', { animate: true });
        expect(jellyBar.style.top).toBe('157px');
        expect(createdAnimations).toHaveLength(1);

        const stretchFrame = createdAnimations[0].keyframes[1];
        const overshootFrame = createdAnimations[0].keyframes[2];
        expect(stretchFrame.transform).toMatch(/^scaleY\(2\./);
        expect(overshootFrame.transform).toBe('scaleY(0.86)');

        // 连续重复同步同一路由：保持幂等，不打断正在飞行的动画
        controller.sync('/goals', { animate: true });
        expect(createdAnimations[0].anim.cancel).not.toHaveBeenCalled();

        // 切到底部工具区 /settings：隐藏主导航果冻条
        controller.sync('/settings', { animate: true });
        expect(navEl.classList.contains('has-jelly-bar')).toBe(false);

        controller.dispose();
        expect(navEl.querySelector('.pc-nav-jelly-bar')).toBeNull();
    });

    it('编排新旧页面交接、确保新页 DOM 优先命中，并支持异步 mount 卡片波浪弹射与二次生命力', async () => {
        const container = document.createElement('main');
        container.id = 'pcMain';
        document.body.appendChild(container);

        const oldPage = document.createElement('div');
        oldPage.className = 'pc-page';
        oldPage.innerHTML = '<div id="sharedProbe" data-owner="old"></div>';
        container.appendChild(oldPage);

        const nextPage = document.createElement('div');
        nextPage.className = 'pc-page';
        nextPage.innerHTML = `
            <div id="sharedProbe" data-owner="new"></div>
            <div class="pc-welcome-banner">
                <span class="pc-greeting-hand">👋</span>
                <div class="pc-welcome-mascot"><img alt="柯基" src="corgi.png"></div>
            </div>
            <div class="pc-home-search-bar"></div>
            <div class="pc-stat-card">
                <svg class="pc-stat-liquid-svg"></svg>
                <span id="pcStatTotal">0</span>
            </div>
        `;

        const orchestrator = createPageTransitionOrchestrator(container);
        const session = orchestrator.startTransition({
            oldPageEl: oldPage,
            nextPageEl: nextPage,
            oldRouteKey: '/',
            newRouteKey: '/library',
            direction: 'tab',
            prevScrollTop: 120,
        });

        // 新页必须排在容器首位，保证同屏交接期 getElementById 命中新页
        expect(container.firstElementChild).toBe(nextPage);
        expect(document.getElementById('sharedProbe')?.dataset.owner).toBe('new');
        expect(oldPage.classList.contains('pc-page-exiting')).toBe(true);
        expect(oldPage.style.top).toBe('-120px');
        expect(oldPage.getAttribute('aria-hidden')).toBe('true');

        // 模拟异步 mount 填充统计数字、最近卡片与进度条
        nextPage.querySelector('#pcStatTotal').textContent = '48';
        const asyncWrap = document.createElement('div');
        asyncWrap.innerHTML = `
            <div class="pc-recent-item">A</div>
            <div class="pc-recent-item">B</div>
            <div class="pc-goal-project-progress-fill"></div>
        `;
        nextPage.appendChild(asyncWrap);

        session.onMounted();

        const animatedElements = createdAnimations.map((item) => item.el);
        expect(animatedElements).toContain(oldPage);
        expect(animatedElements).toContain(nextPage);
        expect(animatedElements).toContain(nextPage.querySelector('.pc-welcome-mascot img'));
        expect(animatedElements).toContain(nextPage.querySelector('.pc-greeting-hand'));
        expect(animatedElements).toContain(nextPage.querySelector('.pc-home-search-bar'));
        expect(animatedElements).toContain(nextPage.querySelector('.pc-stat-liquid-svg'));
        expect(animatedElements).toContain(nextPage.querySelector('.pc-goal-project-progress-fill'));
        expect(animatedElements.filter((el) => el.classList?.contains('pc-recent-item'))).toHaveLength(2);

        // 退场动画完成后旧页自动销毁
        const exitEntry = createdAnimations.find((item) => item.el === oldPage);
        exitEntry.anim.finishNow();
        await exitEntry.anim.finished;
        expect(oldPage.parentNode).toBeNull();
    });

    it('快速连点切页时立即清理上一轮残留退场页并精确还原被中断的数字滚动', () => {
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 99);
        vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

        const container = document.createElement('main');
        document.body.appendChild(container);

        const page1 = document.createElement('div');
        page1.className = 'pc-page';
        container.appendChild(page1);

        const page2 = document.createElement('div');
        page2.className = 'pc-page';
        page2.innerHTML = '<span id="pcStatTotal">128</span>';

        const page3 = document.createElement('div');
        page3.className = 'pc-page';

        const orchestrator = createPageTransitionOrchestrator(container);
        orchestrator.startTransition({
            oldPageEl: page1,
            nextPageEl: page2,
            oldRouteKey: '/',
            newRouteKey: '/library',
            direction: 'tab',
        });

        // 模拟数字滚动中途停在半程文本
        page2.querySelector('#pcStatTotal').textContent = '37';
        expect(page1.parentNode).toBe(container);

        // 快速触发第二次切页：page1 必须立即移除，不产生三页同屏堆积，且 page2 数字还原为真实值
        orchestrator.startTransition({
            oldPageEl: page2,
            nextPageEl: page3,
            oldRouteKey: '/library',
            newRouteKey: '/goals',
            direction: 'tab',
        });

        expect(page1.parentNode).toBeNull();
        expect(page2.querySelector('#pcStatTotal').textContent).toBe('128');
        expect(container.children).toHaveLength(2);
        expect(container.firstElementChild).toBe(page3);
    });

    it('系统开启 prefers-reduced-motion: reduce 时零动画同步直出并立即移除旧页', () => {
        reducedMotion = true;
        const container = document.createElement('main');
        document.body.appendChild(container);

        const oldPage = document.createElement('div');
        oldPage.className = 'pc-page';
        container.appendChild(oldPage);

        const nextPage = document.createElement('div');
        nextPage.className = 'pc-page';

        const orchestrator = createPageTransitionOrchestrator(container);
        orchestrator.startTransition({
            oldPageEl: oldPage,
            nextPageEl: nextPage,
            oldRouteKey: '/',
            newRouteKey: '/settings',
            direction: 'tab',
        });

        expect(oldPage.parentNode).toBeNull();
        expect(nextPage.parentNode).toBe(container);
        expect(createdAnimations).toHaveLength(0);
    });
});
