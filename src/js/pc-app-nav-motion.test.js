import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const routerMocks = vi.hoisted(() => {
    const routes = new Map();
    return {
        routes,
        registerRoute: vi.fn((path, handler) => routes.set(path, handler)),
        navigate: vi.fn(),
        goBack: vi.fn(),
        navigateToTab: vi.fn(),
        getCurrentRoute: vi.fn(() => ({ path: '/' })),
        setRouteChangeCallback: vi.fn(),
        initRouter: vi.fn(),
        getRouteHandler: vi.fn((routeKey) => routes.get(routeKey) || routes.get('/')),
        resolveRouteKey: vi.fn((path) => path),
    };
});

const storageMocks = vi.hoisted(() => ({
    getStorage: vi.fn(() => ({
        estimateStorageSize: vi.fn(async () => 0),
    })),
}));

vi.mock('./pc-router.js', () => routerMocks);

vi.mock('./storage.js', () => ({
    initStorage: vi.fn(),
    getStorage: storageMocks.getStorage,
}));

vi.mock('./pc-utils.js', () => ({
    showToast: vi.fn(),
    closeModal: vi.fn(),
    closeImageViewer: vi.fn(),
    copyToClipboard: vi.fn(),
    escapeHtml: (value = '') => String(value),
    formatBytes: () => '0 B',
}));

function mockPage() {
    return {
        render: () => '<section data-testid="page"></section>',
        mount: vi.fn(),
        unmount: vi.fn(),
    };
}

vi.mock('./pc-home.js', () => mockPage());
vi.mock('./pc-library.js', () => mockPage());
vi.mock('./pc-detail.js', () => mockPage());
vi.mock('./pc-editor.js', () => mockPage());
vi.mock('./pc-category.js', () => mockPage());
vi.mock('./pc-settings.js', () => mockPage());

describe('PC 侧边栏导航点击动效', () => {
    beforeEach(() => {
        vi.resetModules();
        routerMocks.routes.clear();
        routerMocks.navigate.mockClear();
        routerMocks.navigateToTab.mockClear();
        localStorage.clear();
        document.body.innerHTML = '<div id="app"></div>';
        window.matchMedia = vi.fn(() => ({
            matches: false,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }));
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('点击当前激活导航项时播放一次性动效并在动画结束后清理', async () => {
        const { mount } = await import('./pc-app.js');
        const app = document.getElementById('app');
        await mount(app);

        const homeItem = app.querySelector('[data-nav="/"]');
        const homeIcon = homeItem.querySelector('.pc-nav-icon');

        homeItem.click();

        expect(routerMocks.navigateToTab).toHaveBeenCalledWith('/');
        expect(homeItem.classList.contains('pc-nav-clicking')).toBe(true);

        homeIcon.dispatchEvent(new Event('animationend', { bubbles: true }));

        expect(homeItem.classList.contains('pc-nav-clicking')).toBe(false);
    });

    it('收起态导航项点击时仍触发动效', async () => {
        localStorage.setItem('pc-sidebar-collapsed', 'true');
        const { mount } = await import('./pc-app.js');
        const app = document.getElementById('app');
        await mount(app);

        const libraryItem = app.querySelector('[data-nav="/library"]');
        libraryItem.click();

        expect(app.classList.contains('pc-sidebar-collapsed')).toBe(true);
        expect(routerMocks.navigateToTab).toHaveBeenCalledWith('/library');
        expect(libraryItem.classList.contains('pc-nav-clicking')).toBe(true);
    });

    it('系统减弱动态开启时不添加点击动画类', async () => {
        window.matchMedia = vi.fn(() => ({
            matches: true,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }));
        const { mount } = await import('./pc-app.js');
        const app = document.getElementById('app');
        await mount(app);

        const settingsItem = app.querySelector('[data-nav="/settings"]');
        settingsItem.click();

        expect(routerMocks.navigateToTab).toHaveBeenCalledWith('/settings');
        expect(settingsItem.classList.contains('pc-nav-clicking')).toBe(false);
    });

    it('当前导航项同步 aria-current 语义状态', async () => {
        const { mount } = await import('./pc-app.js');
        const app = document.getElementById('app');
        await mount(app);

        const homeItem = app.querySelector('[data-nav="/"]');
        const libraryItem = app.querySelector('[data-nav="/library"]');

        expect(homeItem.getAttribute('aria-current')).toBe('page');
        expect(libraryItem.hasAttribute('aria-current')).toBe(false);

        libraryItem.click();

        expect(homeItem.hasAttribute('aria-current')).toBe(false);
        expect(libraryItem.getAttribute('aria-current')).toBe('page');
    });

    it('设置从主导航分离到时钟上方的功能区，并能正常切换路由', async () => {
        const { mount } = await import('./pc-app.js');
        const app = document.getElementById('app');
        await mount(app);

        const primaryNav = app.querySelector('#pcSidebarNav');
        const utilityNav = app.querySelector('.pc-sidebar-utility-nav');
        const settingsItem = utilityNav.querySelector('[data-nav="/settings"]');

        expect(primaryNav.querySelector('[data-nav="/settings"]')).toBeNull();
        expect(utilityNav.nextElementSibling.id).toBe('pcSidebarClock');

        settingsItem.click();

        expect(routerMocks.navigateToTab).toHaveBeenCalledWith('/settings');
        expect(settingsItem.getAttribute('aria-current')).toBe('page');
        expect(settingsItem.classList.contains('pc-nav-active')).toBe(true);
    });

    it('折叠按钮在图标动效结束后更新侧栏状态并持久化', async () => {
        const { mount } = await import('./pc-app.js');
        const app = document.getElementById('app');
        await mount(app);

        const toggle = app.querySelector('#pcSidebarToggle');
        const icon = toggle.querySelector('.pc-sidebar-toggle-icon svg');
        toggle.click();

        expect(toggle.classList.contains('is-flying')).toBe(true);
        expect(toggle.getAttribute('aria-busy')).toBe('true');
        expect(app.classList.contains('pc-sidebar-collapsed')).toBe(false);

        icon.dispatchEvent(new Event('animationend'));

        expect(app.classList.contains('pc-sidebar-collapsed')).toBe(true);
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        expect(toggle.hasAttribute('aria-busy')).toBe(false);
        expect(localStorage.getItem('pc-sidebar-collapsed')).toBe('true');
    });

    it('减弱动效模式下折叠按钮立即更新侧栏状态', async () => {
        window.matchMedia = vi.fn(() => ({
            matches: true,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }));
        const { mount } = await import('./pc-app.js');
        const app = document.getElementById('app');
        await mount(app);

        const toggle = app.querySelector('#pcSidebarToggle');
        toggle.click();

        expect(toggle.classList.contains('is-flying')).toBe(false);
        expect(app.classList.contains('pc-sidebar-collapsed')).toBe(true);
        expect(localStorage.getItem('pc-sidebar-collapsed')).toBe('true');
    });

});
