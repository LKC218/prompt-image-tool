import { registerRoute, navigate, goBack, navigateToTab, getCurrentRoute, setRouteChangeCallback, initRouter, getRouteHandler, resolveRouteKey } from './pc-router.js';
import { showToast, closeModal, closeImageViewer, copyToClipboard, hideContextMenu } from './pc-utils.js';
import '../../css/pc.css';
import corgiHome from '../../assets/mobile/mascots/corgi-home.png';
import appIcon from '../../assets/pc/app-icon.png';
import navHome from '../../assets/pc/nav-icons/home.png';
import navLibrary from '../../assets/pc/nav-icons/library.png';
import navEditor from '../../assets/pc/nav-icons/editor.png';
import navGoals from '../../assets/pc/nav-icons/目标计划.png';
import navCategory from '../../assets/pc/nav-icons/category.png';
import navGames from '../../assets/pc/nav-icons/games.png';
import navSettings from '../../assets/pc/nav-icons/settings.png';
import navCompress from '../../assets/icons/image.svg?no-inline';
import { openReleaseNotes, showUnreadReleaseNotes, syncReleaseNotesUnreadBadge } from '../release/release-notes.js';
import { runStartupUpdateCheck, runManualUpdateCheck } from '../release/auto-updater.js';
import { initRipple } from '../shared/ripple.js';
import { initPcCursor } from './pc-cursor.js';
import { getThemeState, setAppearancePreference, setWorkbenchTheme } from '../core/theme-service.js';
import { renderWindowChrome, mountWindowChrome } from './pc-window-chrome.js';
import { setupSidebarHover } from './pc-sidebar.js';
import { initWindowSizePolicy } from './pc-window-size.js';
import { renderSvgIcon } from '../shared/svg-icons.js';
import { createSidebarJellyController, createPageTransitionOrchestrator } from './pc-page-transition.js';

const LAZY_ROUTES = {
    '/': () => import('./pc-home.js'),
    '/library': () => import('./pc-library.js'),
    '/compress': () => import('./pc-compress.js'),
    '/detail/:id': () => import('./pc-detail.js'),
    '/editor/:id': () => import('./pc-editor.js'),
    '/category': () => import('./pc-category.js'),
    '/goals': () => import('./pc-goal-projects.js'),
    '/goals/:id': () => import('./pc-goal-detail.js'),
    '/games': () => import('./pc-games-hub.js'),
    '/tetris': () => import('./pc-tetris.js'),
    '/plane': () => import('./pc-plane.js'),
    '/settings': () => import('./pc-settings.js'),
};

const lazyHandlerCache = new Map();
let createPageSeq = 0;

let appEl = null;
let pageContainer = null;
let activeNav = '/';
let activePage = null;
let currentAccent = 'sky';
let isSidebarCollapsed = true;
let cleanupSidebarHover = null;
let sidebarJelly = null;
let pageTransition = null;

const NAV_ITEMS = [
    { path: '/', icon: navHome, label: '首页' },
    { path: '/library', icon: navLibrary, label: '提示词库' },
    { path: '/editor/', icon: navEditor, label: '新建/编辑' },
    { path: '/compress', icon: navCompress, label: '图片处理' },
    { path: '/goals', icon: navGoals, label: '目标计划' },
    { path: '/category', icon: navCategory, label: '分类与标签' },
    { path: '/games', icon: navGames, label: '摸鱼时间' }
];

const SETTINGS_NAV_ITEM = { path: '/settings', icon: navSettings, label: '设置' };

const RELEASE_NOTES_ICON = renderSvgIcon('release-notes', { duotone: true });

const CHECK_UPDATE_ICON = renderSvgIcon('check-update', { duotone: true });

const THEME_TOGGLE_ICONS = {
    light: renderSvgIcon('sun', { duotone: true }),
    dark: renderSvgIcon('moon', { duotone: true }),
};

const MORE_MENU_ICON = renderSvgIcon('more-horizontal');

const TAB_ROUTES = ['/', '/library', '/compress', '/goals', '/category', '/games', '/settings'];
const NAV_CLICK_MOTION_CLASS = 'pc-nav-clicking';

const navClickMotionCleanups = new WeakMap();
let activeThemeTransition = null;

const CLOCK_MARKERS = Array.from({ length: 12 }, (_, i) => {
    const isMajor = i % 3 === 0;
    return `<div class="pc-clock-marker ${isMajor ? 'is-major' : ''}" style="--i:${i}"><div class="pc-clock-marker-dot"></div></div>`;
}).join('');

const CLOCK_NUMBERS = Array.from({ length: 12 }, (_, i) => {
    const num = i === 0 ? 12 : i;
    return `<div class="pc-clock-number" style="--i:${i}"><span>${num}</span></div>`;
}).join('');

function renderShell() {
    return `
        ${renderWindowChrome()}
        <div class="pc-shell-body">
        <div class="pc-sidebar-stage" id="pcSidebarStage">
            <aside class="pc-sidebar" id="pcSidebar">
            <div class="pc-sidebar-header">
                <div class="pc-sidebar-header-top">
                    <div class="pc-sidebar-logo">
                        <div class="pc-sidebar-logo-badge">
                            <img class="pc-sidebar-logo-icon" src="${appIcon}" alt="图标">
                        </div>
                        <div class="pc-sidebar-logo-copy">
                            <div class="pc-sidebar-logo-text">提示词管家</div>
                            <div class="pc-sidebar-logo-sub">本地提示词管理器</div>
                        </div>
                    </div>
                </div>
            </div>
            <nav class="pc-sidebar-nav" id="pcSidebarNav">
                ${NAV_ITEMS.map((item) => `
                    <button class="pc-nav-item ${item.path === '/' ? 'pc-nav-active' : ''}" data-nav="${item.path}" data-ripple="false" aria-label="${item.label}" title="${item.label}"${item.path === '/' ? ' aria-current="page"' : ''}>
                        <div class="pc-nav-icon" aria-hidden="true" style="-webkit-mask-image:url(${item.icon});mask-image:url(${item.icon})"></div>
                        <span class="pc-nav-label">${item.label}</span>
                    </button>
                `).join('')}
            </nav>
            <div class="pc-sidebar-footer">
                <div class="pc-sidebar-utility-nav" aria-label="应用设置">
                    <div class="pc-utility-group pc-utility-group-theme">
                        ${renderThemeToggle()}
                    </div>
                    <div class="pc-utility-divider" aria-hidden="true"></div>
                    <div class="pc-utility-group pc-utility-group-actions">
                        <div class="pc-sidebar-more-wrap">
                            <button
                                class="pc-nav-item pc-sidebar-utility-item pc-sidebar-more-item"
                                type="button"
                                data-more-menu
                                data-ripple="false"
                                aria-label="更多操作"
                                title="更多操作"
                                aria-haspopup="menu"
                                aria-expanded="false"
                                aria-controls="pcSidebarMoreMenu"
                            >
                                <span class="pc-more-nav-icon" aria-hidden="true">${MORE_MENU_ICON}</span>
                                <span class="pc-sidebar-more-badge" aria-hidden="true" hidden></span>
                            </button>
                            <div class="pc-sidebar-more-menu" id="pcSidebarMoreMenu" role="menu" hidden>
                                <button class="pc-nav-item pc-sidebar-more-menu-item pc-sidebar-release-notes-item" type="button" data-release-notes data-ripple="false" role="menuitem" aria-label="更新记录" title="更新记录">
                                    <span class="pc-release-notes-nav-icon" aria-hidden="true">${RELEASE_NOTES_ICON}</span>
                                    <span class="pc-more-menu-label">更新记录</span>
                                    <span class="pc-release-notes-nav-badge" aria-hidden="true"></span>
                                </button>
                                <button class="pc-nav-item pc-sidebar-more-menu-item pc-sidebar-check-update-item" type="button" data-check-update data-ripple="false" role="menuitem" aria-label="检查更新" title="检查更新">
                                    <span class="pc-check-update-nav-icon" aria-hidden="true">${CHECK_UPDATE_ICON}</span>
                                    <span class="pc-more-menu-label">检查更新</span>
                                    <span class="pc-check-update-nav-badge" aria-hidden="true" hidden></span>
                                </button>
                            </div>
                        </div>
                        <button class="pc-nav-item pc-sidebar-settings-item" type="button" data-nav="${SETTINGS_NAV_ITEM.path}" data-ripple="false" aria-label="${SETTINGS_NAV_ITEM.label}" title="${SETTINGS_NAV_ITEM.label}">
                            <div class="pc-nav-icon" aria-hidden="true" style="-webkit-mask-image:url(${SETTINGS_NAV_ITEM.icon});mask-image:url(${SETTINGS_NAV_ITEM.icon})"></div>
                        </button>
                    </div>
                </div>
                <div class="pc-sidebar-clock" id="pcSidebarClock" aria-label="当前时间">
                    <div class="pc-sidebar-clock-face" aria-hidden="true">
                        <div class="pc-clock-markers">${CLOCK_MARKERS}</div>
                        <div class="pc-clock-numbers">${CLOCK_NUMBERS}</div>
                        <div class="pc-clock-hand pc-clock-hour-hand" id="pcClockHour"></div>
                        <div class="pc-clock-hand pc-clock-minute-hand" id="pcClockMinute"></div>
                        <div class="pc-clock-hand pc-clock-second-hand" id="pcClockSecond"></div>
                        <div class="pc-clock-center-pin"></div>
                    </div>
                </div>
            </div>
            </aside>
        </div>
        <div class="pc-depth-dimmer" id="pcDepthDimmer" aria-hidden="true"></div>
        <main class="pc-main" id="pcMain"></main>
        </div>
    `;
}

function renderThemeToggle() {
    const appearance = getThemeState().appearance;
    const nextAppearance = appearance === 'dark' ? 'light' : 'dark';
    const label = `切换为${nextAppearance === 'dark' ? '深色' : '浅色'}主题`;

    return `
        <button class="pc-theme-toggle" type="button" role="switch" aria-checked="${String(appearance === 'dark')}" aria-label="${label}" title="${label}" data-ripple="false">
            <span class="pc-theme-toggle-track" aria-hidden="true">
                <span class="pc-theme-toggle-orbit pc-theme-toggle-orbit-light">${THEME_TOGGLE_ICONS.light}</span>
                <span class="pc-theme-toggle-orbit pc-theme-toggle-orbit-dark">${THEME_TOGGLE_ICONS.dark}</span>
                <span class="pc-theme-toggle-thumb">${THEME_TOGGLE_ICONS[appearance]}</span>
            </span>
        </button>
    `;
}

function registerAppRoutes() {
    Object.keys(LAZY_ROUTES).forEach((path) => {
        registerRoute(path, {
            key: path,
            lazy: true,
            render: () => '<div class="pc-page-loading" aria-live="polite"></div>',
            mount: () => {},
            unmount: () => {},
        });
    });
}

async function ensureRouteModule(routeKey) {
    if (lazyHandlerCache.has(routeKey)) return lazyHandlerCache.get(routeKey);
    const loader = LAZY_ROUTES[routeKey];
    if (!loader) return getRouteHandler(routeKey);
    const mod = await loader();
    const handler = {
        key: routeKey,
        render: mod.render,
        mount: mod.mount,
        unmount: mod.unmount,
    };
    lazyHandlerCache.set(routeKey, handler);
    return handler;
}

function prefetchRouteModules() {
    const schedule = typeof window.requestIdleCallback === 'function'
        ? window.requestIdleCallback
        : (cb) => window.setTimeout(cb, 600);
    schedule(() => {
        ensureRouteModule('/library').catch(() => {});
        ensureRouteModule('/category').catch(() => {});
    });
}

async function mount(el) {
    appEl = el;
    cleanupSidebarHover?.();
    sidebarJelly?.dispose();
    sidebarJelly = null;
    pageTransition?.abort();
    pageTransition = null;
    activePage = null;
    isSidebarCollapsed = !window.matchMedia?.('(hover: none)')?.matches;
    appEl.classList.add('pc-app');
    appEl.dataset.appVersion = document.querySelector('meta[name="version"]')?.content || 'unknown';
    applySidebarState(isSidebarCollapsed);
    appEl.innerHTML = renderShell();
    pageContainer = document.getElementById('pcMain');
    pageTransition = createPageTransitionOrchestrator(pageContainer);
    sidebarJelly = createSidebarJellyController(appEl);

    currentAccent = getThemeState().workbenchTheme;

    registerAppRoutes();

    setupSidebarNav();
    cleanupSidebarHover = setupSidebarHover(appEl, {
        onStateChange: applySidebarState,
        onLayoutChange: () => {
            positionSidebarMoreMenu();
            sidebarJelly?.sync(activeNav, { animate: false });
        },
    });
    setupKeyboardShortcuts();
    setupSidebarClock();
    mountWindowChrome(appEl);
    initWindowSizePolicy().catch((error) => {
        console.warn('initWindowSizePolicy failed:', error);
    });
    initRipple(appEl);
    initPcCursor(appEl);
    syncReleaseNotesUnreadBadge(appEl);
    syncSidebarMoreBadge();

    setRouteChangeCallback(handleRouteChange);
    const initialRoute = initRouter() || getCurrentRoute() || { path: '/', params: {} };
    const initialPath = initialRoute.path || '/';
    if (TAB_ROUTES.includes(initialPath)) {
        updateNavHighlight(initialPath, { animate: false });
    } else if (initialPath.startsWith('/detail')) {
        updateNavHighlight('/library', { animate: false });
    } else if (initialPath.startsWith('/editor')) {
        updateNavHighlight('/editor/', { animate: false });
    } else if (initialPath.startsWith('/goals')) {
        updateNavHighlight('/goals', { animate: false });
    } else if (initialPath === '/tetris' || initialPath === '/plane') {
        updateNavHighlight('/games', { animate: false });
    }
    await createPage(resolveRouteKey(initialPath), initialRoute.params || {}, 'tab');
    prefetchRouteModules();
    window.requestAnimationFrame(() => {
        showUnreadReleaseNotes();
        setTimeout(() => {
            runStartupUpdateCheck().catch(() => {});
        }, 2500);
    });
}

function applySidebarState(collapsed) {
    isSidebarCollapsed = collapsed === true;
    appEl?.classList.toggle('pc-sidebar-collapsed', isSidebarCollapsed);
    appEl?.setAttribute('data-sidebar', isSidebarCollapsed ? 'collapsed' : 'expanded');
}

function setupSidebarNav() {
    const nav = document.getElementById('pcSidebarNav');
    const settingsNav = appEl.querySelector('.pc-sidebar-utility-nav');
    const handleNavigation = (e) => {
        fetch('http://127.0.0.1:7777/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: 'pc-overlay-navigation',
                hypothesisId: 'navigation-hit',
                event: 'sidebar-click',
                target: e.target?.className || e.target?.tagName || null,
                navItem: e.target?.closest?.('.pc-nav-item')?.dataset?.nav || null,
                detailHostActive: document.documentElement.classList.contains('pc-prompt-detail-modal-host-active'),
                overlayState: document.getElementById('pcModalOverlay')?.className || null,
                timestamp: Date.now(),
            }),
        }).catch(() => {});
        const moreToggle = e.target.closest('[data-more-menu]');
        if (moreToggle) {
            e.preventDefault();
            e.stopPropagation();
            playNavIconClickMotion(moreToggle);
            toggleSidebarMoreMenu();
            return;
        }
        const themeToggle = e.target.closest('.pc-theme-toggle');
        if (themeToggle) {
            toggleAppearance(themeToggle);
            return;
        }
        const item = e.target.closest('.pc-nav-item');
        if (!item) return;
        if (item.hasAttribute('data-release-notes')) {
            openReleaseNotes();
            syncSidebarMoreBadge();
            closeSidebarMoreMenu();
            return;
        }
        if (item.hasAttribute('data-check-update')) {
            item.disabled = true;
            runManualUpdateCheck().finally(() => {
                item.disabled = false;
                syncSidebarMoreBadge();
            });
            closeSidebarMoreMenu();
            return;
        }
        if (item.classList.contains('pc-sidebar-more-menu-item')) {
            closeSidebarMoreMenu();
            return;
        }
        playNavIconClickMotion(item);
        const path = item.dataset.nav;
        if (path === '/editor/') {
            navigate('/editor/');
        } else if (TAB_ROUTES.includes(path)) {
            closeSidebarMoreMenu();
            navigateToTab(path);
            updateNavHighlight(path);
        }
    };

    // 再次按下时中断旧回弹，让按压样式立即接管，不积压动画。
    const stopPreviousMotion = event => {
        const item = event.target.closest('.pc-nav-item');
        navClickMotionCleanups.get(item)?.();
    };
    nav.addEventListener('pointerdown', stopPreviousMotion);
    settingsNav?.addEventListener('pointerdown', stopPreviousMotion);
    nav.addEventListener('click', handleNavigation);
    settingsNav?.addEventListener('click', handleNavigation);
    getSidebarMoreMenuElements().menu?.addEventListener('click', handleNavigation);
    setupSidebarMoreMenu();
}

function getSidebarMoreMenuElements() {
    const wrap = appEl?.querySelector('.pc-sidebar-more-wrap');
    const trigger = wrap?.querySelector('[data-more-menu]');
    const menu = appEl?.querySelector('.pc-sidebar-more-menu');
    return { wrap, trigger, menu };
}

function isSidebarMoreMenuOpen() {
    const { trigger, menu } = getSidebarMoreMenuElements();
    return Boolean(trigger && menu && trigger.getAttribute('aria-expanded') === 'true' && !menu.hidden);
}

function openSidebarMoreMenu() {
    const { wrap, trigger, menu } = getSidebarMoreMenuElements();
    if (!wrap || !trigger || !menu) return;
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    wrap.classList.add('is-open');
    positionSidebarMoreMenu();
    menu.classList.add('is-open');
}

function positionSidebarMoreMenu() {
    const { trigger, menu } = getSidebarMoreMenuElements();
    if (!trigger || !menu || menu.hidden) return;
    const rect = trigger.getBoundingClientRect();
    const margin = 12;
    // 使用布局尺寸，避免入场缩放动画影响测量。
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;
    let left = isSidebarCollapsed ? rect.right + 10 : rect.right - width;
    if (isSidebarCollapsed && left + width > window.innerWidth - margin) {
        left = rect.left - width - 10;
    }
    const top = isSidebarCollapsed ? rect.bottom - height : rect.top - height - 10;
    menu.style.left = `${Math.max(margin, Math.min(left, window.innerWidth - width - margin))}px`;
    menu.style.top = `${Math.max(margin, Math.min(top, window.innerHeight - height - margin))}px`;
}

function closeSidebarMoreMenu() {
    const { wrap, trigger, menu } = getSidebarMoreMenuElements();
    if (!wrap || !trigger || !menu) return;
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    wrap.classList.remove('is-open');
    menu.classList.remove('is-open');
}

function toggleSidebarMoreMenu() {
    if (isSidebarMoreMenuOpen()) {
        closeSidebarMoreMenu();
        return;
    }
    openSidebarMoreMenu();
    syncSidebarMoreBadge();
}

function syncSidebarMoreBadge() {
    const moreBadge = appEl?.querySelector('.pc-sidebar-more-badge');
    if (!moreBadge) return;
    const hasUnread = Boolean(appEl.querySelector('[data-release-notes].pc-release-notes-unread'));
    const updateBadge = appEl.querySelector('.pc-check-update-nav-badge');
    const hasUpdate = Boolean(updateBadge && !updateBadge.hidden);
    moreBadge.hidden = !(hasUnread || hasUpdate);
}

function setupSidebarMoreMenu() {
    const { wrap, menu } = getSidebarMoreMenuElements();
    if (!wrap || !menu) return;
    // 保留应用主题继承，同时离开侧栏的 overflow 与动画变换容器。
    appEl.append(menu);

    const handleDocPointerDown = (event) => {
        if (!wrap.contains(event.target) && !menu.contains(event.target)) closeSidebarMoreMenu();
    };
    const handleKeyDown = (event) => {
        if (event.key === 'Escape' && isSidebarMoreMenuOpen()) {
            closeSidebarMoreMenu();
            getSidebarMoreMenuElements().trigger?.focus();
        }
    };

    document.addEventListener('pointerdown', handleDocPointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', positionSidebarMoreMenu);

    const badgeSource = menu.querySelector('.pc-release-notes-nav-badge');
    const updateBadge = menu.querySelector('.pc-check-update-nav-badge');
    const observer = new MutationObserver(() => syncSidebarMoreBadge());
    if (badgeSource) {
        observer.observe(badgeSource.parentElement, { attributes: true, attributeFilter: ['class'] });
    }
    if (updateBadge) {
        observer.observe(updateBadge, { attributes: true, attributeFilter: ['hidden'] });
    }

    syncSidebarMoreBadge();
}

function toggleAppearance(toggle) {
    const nextAppearance = getThemeState().appearance === 'dark' ? 'light' : 'dark';
    const thumb = toggle.querySelector('.pc-theme-toggle-thumb');
    const rect = (thumb || toggle).getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.ceil(Math.max(
        Math.hypot(x, y),
        Math.hypot(window.innerWidth - x, y),
        Math.hypot(x, window.innerHeight - y),
        Math.hypot(window.innerWidth - x, window.innerHeight - y),
    ));
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const applyAppearance = () => {
        setAppearancePreference(nextAppearance);
        syncThemeToggle(toggle);
    };

    if (reducedMotion || typeof document.startViewTransition !== 'function') {
        applyAppearance();
        return;
    }

    activeThemeTransition?.skipTransition();
    document.documentElement.style.setProperty('--pc-theme-transition-x', `${x}px`);
    document.documentElement.style.setProperty('--pc-theme-transition-y', `${y}px`);
    document.documentElement.style.setProperty('--pc-theme-transition-radius', `${radius}px`);
    document.documentElement.dataset.themeTransitioning = 'true';
    const transition = document.startViewTransition(applyAppearance);
    activeThemeTransition = transition;
    const cleanupTransition = () => {
        if (activeThemeTransition !== transition) return;
        activeThemeTransition = null;
        delete document.documentElement.dataset.themeTransitioning;
    };
    transition.finished.then(cleanupTransition, cleanupTransition);
}

function syncThemeToggle(toggle) {
    const appearance = getThemeState().appearance;
    const nextAppearance = appearance === 'dark' ? 'light' : 'dark';
    const label = `切换为${nextAppearance === 'dark' ? '深色' : '浅色'}主题`;
    const thumb = toggle.querySelector('.pc-theme-toggle-thumb');

    toggle.setAttribute('aria-checked', String(appearance === 'dark'));
    toggle.setAttribute('aria-label', label);
    toggle.setAttribute('title', label);
    if (thumb) thumb.innerHTML = THEME_TOGGLE_ICONS[appearance];
}

function playNavIconClickMotion(item) {
    if (!item || window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;

    const previousCleanup = navClickMotionCleanups.get(item);
    if (previousCleanup) previousCleanup();

    const icon = item.querySelector('.pc-nav-icon, .pc-more-nav-icon');
    if (!icon) return;
    let cleanup = null;
    let cleanupTimer;
    function handleAnimationEnd(event) {
        // 扫光比回弹短；不能因伪元素结束而截断图标回弹。
        if (event.target !== icon) return;
        cleanup();
    }

    cleanup = () => {
        window.clearTimeout(cleanupTimer);
        item.classList.remove(NAV_CLICK_MOTION_CLASS);
        item.removeEventListener('animationend', handleAnimationEnd);
        navClickMotionCleanups.delete(item);
    };

    item.classList.remove(NAV_CLICK_MOTION_CLASS);
    void item.offsetWidth;
    item.classList.add(NAV_CLICK_MOTION_CLASS);
    item.addEventListener('animationend', handleAnimationEnd);
    // 动画被系统低动效设置或样式切换取消时，也不会留下点击态。
    cleanupTimer = window.setTimeout(cleanup, 450);
    navClickMotionCleanups.set(item, cleanup);
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            hideContextMenu();
            closeImageViewer({ immediate: true });
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            const saveBtn = document.querySelector('.pc-save-btn') || document.querySelector('.pc-editor-save-btn');
            if (saveBtn) {
                saveBtn.click();
            } else {
                showToast('当前页面无需保存', 'warning');
            }
        }
    });
}

function updateNavHighlight(path, options = { animate: true }) {
    activeNav = path;
    const navItems = document.querySelectorAll('.pc-nav-item');
    navItems.forEach(item => {
        const navPath = item.dataset.nav;
        const isActive = navPath === path
            || (path.startsWith('/detail') && navPath === '/library')
            || (path.startsWith('/editor') && navPath === '/editor/')
            || ((path === '/tetris' || path === '/plane') && navPath === '/games');

        item.classList.toggle('pc-nav-active', isActive);
        if (isActive) {
            item.setAttribute('aria-current', 'page');
        } else {
            item.removeAttribute('aria-current');
        }
    });
    sidebarJelly?.sync(activeNav, options);
}

function handleRouteChange(newRoute, oldRoute, direction) {
    if (!newRoute) return;
    closeSidebarMoreMenu();
    const path = newRoute.path || '';
    const routeKey = resolveRouteKey(path);
    fetch('http://127.0.0.1:7777/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sessionId: 'pc-overlay-navigation',
            hypothesisId: 'route-render',
            event: 'route-change',
            path,
            routeKey,
            detailHostActive: document.documentElement.classList.contains('pc-prompt-detail-modal-host-active'),
            overlayState: document.getElementById('pcModalOverlay')?.className || null,
            timestamp: Date.now(),
        }),
    }).catch(() => {});

    if (TAB_ROUTES.includes(path)) {
        updateNavHighlight(path);
    } else if (path.startsWith('/detail')) {
        updateNavHighlight('/library');
    } else if (path.startsWith('/editor')) {
        updateNavHighlight('/editor/');
    } else if (path.startsWith('/goals')) {
        updateNavHighlight('/goals');
    } else if (path === '/tetris' || path === '/plane') {
        updateNavHighlight('/games');
    }

    createPage(routeKey, newRoute.params || {}, direction).catch((error) => {
        console.error('createPage failed:', error);
    });
}

function destroyCurrentPage() {
    pageTransition?.abort();
    if (!activePage) return;
    if (activePage.handler && activePage.handler.unmount) {
        activePage.handler.unmount(activePage.el);
    }
    if (activePage.el.parentNode) activePage.el.remove();
    activePage = null;
}

async function createPage(routeKey, params = {}, direction = 'tab') {
    const seq = ++createPageSeq;
    let handler = null;
    try {
        handler = await ensureRouteModule(routeKey);
    } catch (error) {
        console.error('Failed to load route module:', routeKey, error);
    }
    if (seq !== createPageSeq) return;

    if (!handler || typeof handler.render !== 'function') {
        handler = getRouteHandler(routeKey);
    }
    if (!handler || typeof handler.render !== 'function') {
        console.warn('No route handler for:', routeKey);
        return;
    }

    const prevPage = activePage;
    const prevRouteKey = prevPage?.routeKey || null;
    const prevScrollTop = pageContainer?.scrollTop || 0;
    if (prevPage) {
        if (prevPage.handler && prevPage.handler.unmount) {
            prevPage.handler.unmount(prevPage.el);
        }
        activePage = null;
    }

    const pageEl = document.createElement('div');
    pageEl.className = 'pc-page';
    pageEl.dataset.route = routeKey;
    pageEl.innerHTML = handler.render(params);

    let transitionSession = null;
    if (pageTransition) {
        transitionSession = pageTransition.startTransition({
            oldPageEl: prevPage?.el || null,
            nextPageEl: pageEl,
            oldRouteKey: prevRouteKey,
            newRouteKey: routeKey,
            direction,
            prevScrollTop,
        });
    } else {
        if (prevPage?.el?.parentNode) prevPage.el.remove();
        pageContainer.appendChild(pageEl);
    }

    activePage = { el: pageEl, handler, routeKey };

    if (handler.mount) {
        try {
            const result = handler.mount(pageEl, params);
            if (result && typeof result.then === 'function') {
                result.then(
                    () => {
                        if (seq === createPageSeq) {
                            transitionSession?.onMounted();
                        }
                    },
                    (error) => console.error('page mount error:', routeKey, error)
                );
            } else {
                transitionSession?.onMounted();
            }
        } catch (error) {
            console.error('page mount error:', routeKey, error);
        }
    } else {
        transitionSession?.onMounted();
    }

    pageContainer.scrollTop = 0;
}

function setupSidebarClock() {
    const hourHand = document.getElementById('pcClockHour');
    const minuteHand = document.getElementById('pcClockMinute');
    const secondHand = document.getElementById('pcClockSecond');
    if (!hourHand || !minuteHand || !secondHand) return;

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

    function updateHands() {
        const now = new Date();
        const hours = now.getHours() % 12;
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();

        const hourDeg = hours * 30 + minutes * 0.5 + seconds * (0.5 / 60);
        const minuteDeg = minutes * 6 + seconds * 0.1;
        const secondDeg = seconds * 6;

        hourHand.style.transform = `translateX(-50%) rotate(${hourDeg}deg)`;
        minuteHand.style.transform = `translateX(-50%) rotate(${minuteDeg}deg)`;
        secondHand.style.transform = `translateX(-50%) rotate(${secondDeg}deg)`;
    }

    updateHands();

    if (reducedMotion) return;

    function scheduleNextTick() {
        updateHands();
        const now = Date.now();
        const delay = 1000 - (now % 1000);
        setTimeout(scheduleNextTick, delay);
    }

    scheduleNextTick();
}

function setAccent(color) {
    currentAccent = setWorkbenchTheme(color).workbenchTheme;
}

function getAccent() {
    return currentAccent;
}

function refreshCurrentPage() {
    const route = getCurrentRoute();
    if (!route) return;
    const routeKey = resolveRouteKey(route.path || '');
    createPage(routeKey, route.params || {}, 'tab').catch((error) => {
        console.error('refreshCurrentPage failed:', error);
    });
}

export {
    mount,
    navigate,
    goBack,
    navigateToTab,
    refreshCurrentPage,
    setAccent,
    getAccent
};
