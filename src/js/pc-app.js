import { registerRoute, navigate, goBack, navigateToTab, getCurrentRoute, setRouteChangeCallback, initRouter, getRouteHandler, resolveRouteKey } from './pc-router.js';
import { showToast, closeModal, closeImageViewer, copyToClipboard, escapeHtml, hideContextMenu } from './pc-utils.js';
import '../css/pc.css';
import corgiHome from '../assets/mobile/mascots/corgi-home.png';
import appIcon from '../assets/pc/app-icon.png';
import navHome from '../assets/pc/nav-icons/home.png';
import navLibrary from '../assets/pc/nav-icons/library.png';
import navEditor from '../assets/pc/nav-icons/editor.png';
import navGoals from '../assets/pc/nav-icons/目标计划.png';
import navCategory from '../assets/pc/nav-icons/category.png';
import navGames from '../assets/pc/nav-icons/games.png';
import navSettings from '../assets/pc/nav-icons/settings.png';
import { openReleaseNotes, showUnreadReleaseNotes, syncReleaseNotesUnreadBadge } from './release-notes.js';
import { runStartupUpdateCheck, runManualUpdateCheck } from './auto-updater.js';
import { initRipple } from './ripple.js';
import { initPcCursor } from './pc-cursor.js';
import { getThemeState, setAppearancePreference, setWorkbenchTheme } from './theme-service.js';
import { renderWindowChrome, mountWindowChrome } from './pc-window-chrome.js';

const LAZY_ROUTES = {
    '/': () => import('./pc-home.js'),
    '/library': () => import('./pc-library.js'),
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
let isSidebarCollapsed = false;
let isSidebarStageAnimating = false;

const NAV_ITEMS = [
    { path: '/', icon: navHome, label: '首页' },
    { path: '/library', icon: navLibrary, label: '提示词库' },
    { path: '/editor/', icon: navEditor, label: '新建/编辑' },
    { path: '/goals', icon: navGoals, label: '目标计划' },
    { path: '/category', icon: navCategory, label: '分类与标签' },
    { path: '/games', icon: navGames, label: '摸鱼时间' }
];

const SETTINGS_NAV_ITEM = { path: '/settings', icon: navSettings, label: '设置' };

const RELEASE_NOTES_ICON = `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M8 7h12M8 12h12M8 17h8"></path>
        <path d="M4 7h.01M4 12h.01M4 17h.01"></path>
    </svg>
`;

const CHECK_UPDATE_ICON = `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 4v10"></path>
        <path d="m8 10 4 4 4-4"></path>
        <path d="M5 18h14"></path>
        <path d="M7 21h10"></path>
    </svg>
`;

const THEME_TOGGLE_ICONS = {
    light: `
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="4"></circle>
            <path d="M12 2.5v2M12 19.5v2M21.5 12h-2M4.5 12h-2M18.72 5.28l-1.42 1.42M6.7 17.3l-1.42 1.42M18.72 18.72 17.3 17.3M6.7 6.7 5.28 5.28"></path>
        </svg>
    `,
    dark: `
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M20 15.2A8.5 8.5 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z"></path>
        </svg>
    `,
};

const MORE_MENU_ICON = `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="6" cy="12" r="1.35" fill="currentColor" stroke="none"></circle>
        <circle cx="12" cy="12" r="1.35" fill="currentColor" stroke="none"></circle>
        <circle cx="18" cy="12" r="1.35" fill="currentColor" stroke="none"></circle>
    </svg>
`;

const TAB_ROUTES = ['/', '/library', '/goals', '/category', '/games', '/settings'];
const SIDEBAR_COLLAPSED_KEY = 'pc-sidebar-collapsed';
const NAV_CLICK_MOTION_CLASS = 'pc-nav-clicking';
const SIDEBAR_STAGE_OPENING_CLASS = 'is-stagger-opening';
const SIDEBAR_STAGE_CLOSING_CLASS = 'is-stagger-closing';
const SIDEBAR_STAGE_ACTIVE_CLASS = 'is-stagger-active';
const SIDEBAR_COLLAPSING_CLASS = 'pc-sidebar-is-collapsing';
const SIDEBAR_EXPANDING_CLASS = 'pc-sidebar-is-expanding';

const navClickMotionCleanups = new WeakMap();
let activeThemeTransition = null;

const SIDEBAR_TOGGLE_ICON = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15 6 9 12l6 6"></path>
        <path d="M20 6 14 12l6 6"></path>
    </svg>
`;

function splitTextToSpans(text) {
    return text.split('').map((char, i) => {
        const displayChar = char === ' ' ? '&nbsp;' : escapeHtml(char);
        return `<span class="pc-sidebar-toggle-letter" style="--i:${i}">${displayChar}</span>`;
    }).join('');
}

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
        <div class="pc-sidebar-stage" id="pcSidebarStage">
            <div class="pc-sidebar-underlay pc-sidebar-underlay-far" aria-hidden="true"></div>
            <div class="pc-sidebar-underlay pc-sidebar-underlay-near" aria-hidden="true"></div>
            <aside class="pc-sidebar" id="pcSidebar">
            <div class="pc-sidebar-header">
                <div class="pc-sidebar-header-top">
                    <div class="pc-sidebar-logo">
                        <img class="pc-sidebar-logo-icon" src="${appIcon}" alt="图标">
                        <div class="pc-sidebar-logo-copy">
                            <div class="pc-sidebar-logo-text">提示词管家</div>
                            <div class="pc-sidebar-logo-sub">本地提示词管理器</div>
                        </div>
                    </div>
                </div>
                <div class="pc-sidebar-toggle-row">
                    <button
                        class="pc-sidebar-toggle"
                        id="pcSidebarToggle"
                        type="button"
                        aria-controls="pcSidebar"
                        aria-expanded="${String(!isSidebarCollapsed)}"
                        aria-label="${isSidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}"
                        title="${isSidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}"
                    >
                        <span class="pc-sidebar-toggle-outline" aria-hidden="true"></span>
                        <span class="pc-sidebar-toggle-icon">${SIDEBAR_TOGGLE_ICON}</span>
                        <span class="pc-sidebar-toggle-text" aria-hidden="true">${splitTextToSpans(isSidebarCollapsed ? '展开侧栏' : '收起侧栏')}</span>
                    </button>
                </div>
            </div>
            <nav class="pc-sidebar-nav" id="pcSidebarNav">
                ${NAV_ITEMS.map((item, index) => `
                    <button class="pc-nav-item ${item.path === '/' ? 'pc-nav-active' : ''}" data-nav="${item.path}" aria-label="${item.label}" title="${item.label}" style="--pc-sidebar-stagger-index:${index}"${item.path === '/' ? ' aria-current="page"' : ''}>
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
        ${renderWindowChrome()}
        <main class="pc-main" id="pcMain"></main>
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
    isSidebarCollapsed = readSidebarCollapsedState();
    appEl.classList.add('pc-app');
    appEl.dataset.appVersion = document.querySelector('meta[name="version"]')?.content || 'unknown';
    applySidebarState(isSidebarCollapsed);
    appEl.innerHTML = renderShell();
    pageContainer = document.getElementById('pcMain');

    currentAccent = getThemeState().workbenchTheme;

    registerAppRoutes();

    setupSidebarNav();
    setupSidebarToggle();
    setupKeyboardShortcuts();
    setupSidebarClock();
    mountWindowChrome(appEl);
    initRipple(appEl);
    initPcCursor(appEl);
    syncReleaseNotesUnreadBadge(appEl);
    syncSidebarMoreBadge();

    setRouteChangeCallback(handleRouteChange);
    const initialRoute = initRouter() || getCurrentRoute() || { path: '/', params: {} };
    const initialPath = initialRoute.path || '/';
    if (TAB_ROUTES.includes(initialPath)) {
        updateNavHighlight(initialPath);
    } else if (initialPath.startsWith('/detail')) {
        updateNavHighlight('/library');
    } else if (initialPath.startsWith('/editor')) {
        updateNavHighlight('/editor/');
    } else if (initialPath.startsWith('/goals')) {
        updateNavHighlight('/goals');
    } else if (initialPath === '/tetris' || initialPath === '/plane') {
        updateNavHighlight('/games');
    }
    await createPage(resolveRouteKey(initialPath), initialRoute.params || {}, 'tab');
    prefetchRouteModules();
    const initialSidebarStage = appEl.querySelector('#pcSidebarStage');
    window.requestAnimationFrame(() => {
        showUnreadReleaseNotes();
        if (!isSidebarCollapsed && !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
            playSidebarStageMotion(false, {
                persist: false,
                stage: initialSidebarStage,
            });
        }
        setTimeout(() => {
            runStartupUpdateCheck().catch(() => {});
        }, 2500);
    });
}

function readSidebarCollapsedState() {
    try {
        return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch (e) {
        return false;
    }
}

function applySidebarState(collapsed, options = {}) {
    isSidebarCollapsed = collapsed === true;

    if (appEl) {
        appEl.classList.toggle('pc-sidebar-collapsed', isSidebarCollapsed);
        appEl.setAttribute('data-sidebar', isSidebarCollapsed ? 'collapsed' : 'expanded');
    }

    const toggle = document.getElementById('pcSidebarToggle');
    if (toggle) {
        const label = isSidebarCollapsed ? '展开侧边栏' : '收起侧边栏';
        toggle.setAttribute('aria-expanded', String(!isSidebarCollapsed));
        toggle.setAttribute('aria-label', label);
        toggle.setAttribute('title', label);

        const toggleText = toggle.querySelector('.pc-sidebar-toggle-text');
        if (toggleText) toggleText.innerHTML = splitTextToSpans(isSidebarCollapsed ? '展开侧栏' : '收起侧栏');
    }

    if (options.persist) {
        try {
            localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isSidebarCollapsed));
        } catch (e) {
            console.warn('save sidebar state failed:', e);
        }
    }

    if (isSidebarCollapsed) {
        document.getElementById('pcSidebarStage')?.classList.remove(
            SIDEBAR_STAGE_OPENING_CLASS,
            SIDEBAR_STAGE_CLOSING_CLASS,
            SIDEBAR_STAGE_ACTIVE_CLASS,
        );
    }
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

    nav.addEventListener('click', handleNavigation);
    settingsNav?.addEventListener('click', handleNavigation);
    setupSidebarMoreMenu();
}

function getSidebarMoreMenuElements() {
    const wrap = appEl?.querySelector('.pc-sidebar-more-wrap');
    const trigger = wrap?.querySelector('[data-more-menu]');
    const menu = wrap?.querySelector('.pc-sidebar-more-menu');
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
}

function closeSidebarMoreMenu() {
    const { wrap, trigger, menu } = getSidebarMoreMenuElements();
    if (!wrap || !trigger || !menu) return;
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    wrap.classList.remove('is-open');
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
    const { wrap } = getSidebarMoreMenuElements();
    if (!wrap) return;

    const handleDocPointerDown = (event) => {
        if (!wrap.contains(event.target)) closeSidebarMoreMenu();
    };
    const handleKeyDown = (event) => {
        if (event.key === 'Escape' && isSidebarMoreMenuOpen()) {
            closeSidebarMoreMenu();
            getSidebarMoreMenuElements().trigger?.focus();
        }
    };

    document.addEventListener('pointerdown', handleDocPointerDown);
    document.addEventListener('keydown', handleKeyDown);

    const badgeSource = wrap.querySelector('.pc-release-notes-nav-badge');
    const updateBadge = wrap.querySelector('.pc-check-update-nav-badge');
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

    let cleanup = null;
    function handleAnimationEnd(event) {
        const isItemGlow = event.target === item;
        const isIconBounce = event.target.classList?.contains('pc-nav-icon');
        if (!isItemGlow && !isIconBounce) return;
        cleanup();
    }

    cleanup = () => {
        item.classList.remove(NAV_CLICK_MOTION_CLASS);
        item.removeEventListener('animationend', handleAnimationEnd);
        navClickMotionCleanups.delete(item);
    };

    item.classList.remove(NAV_CLICK_MOTION_CLASS);
    void item.offsetWidth;
    item.classList.add(NAV_CLICK_MOTION_CLASS);
    item.addEventListener('animationend', handleAnimationEnd);
    navClickMotionCleanups.set(item, cleanup);
}

function setupSidebarToggle() {
    const toggle = document.getElementById('pcSidebarToggle');
    if (!toggle) return;

    toggle.addEventListener('click', () => {
        if (toggle.classList.contains('is-flying') || isSidebarStageAnimating) return;

        if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
            applySidebarState(!isSidebarCollapsed, { persist: true });
            return;
        }

        const nextCollapsed = !isSidebarCollapsed;
        const icon = toggle.querySelector('.pc-sidebar-toggle-icon svg');
        if (!icon) {
            applySidebarState(nextCollapsed, { persist: true });
            return;
        }
        const complete = (event) => {
            if (event.target !== icon || event.animationName !== 'pc-sidebar-toggle-take-off') return;
            toggle.classList.remove('is-flying');
            toggle.removeAttribute('aria-busy');
            icon.removeEventListener('animationend', complete);
            playSidebarStageMotion(nextCollapsed);
        };

        toggle.classList.add('is-flying');
        toggle.setAttribute('aria-busy', 'true');
        icon.addEventListener('animationend', complete);
    });
}

function playSidebarStageMotion(nextCollapsed, options = {}) {
    const stage = options.stage || document.getElementById('pcSidebarStage');
    const sidebar = stage?.querySelector('#pcSidebar');
    if (!stage || !sidebar) {
        applySidebarState(nextCollapsed, { persist: true });
        return;
    }

    const opening = !nextCollapsed;
    const motionClass = opening ? SIDEBAR_STAGE_OPENING_CLASS : SIDEBAR_STAGE_CLOSING_CLASS;
    isSidebarStageAnimating = true;
    stage.classList.remove(
        SIDEBAR_STAGE_OPENING_CLASS,
        SIDEBAR_STAGE_CLOSING_CLASS,
        SIDEBAR_STAGE_ACTIVE_CLASS,
        SIDEBAR_COLLAPSING_CLASS,
        SIDEBAR_EXPANDING_CLASS,
    );

    if (opening) {
        stage.classList.add(SIDEBAR_EXPANDING_CLASS, motionClass);
        const complete = (event) => {
            if (event.target !== sidebar || event.propertyName !== 'transform') return;
            sidebar.removeEventListener('transitionend', complete);
            sidebar.removeEventListener('transitioncancel', complete);
            stage.classList.remove(SIDEBAR_STAGE_OPENING_CLASS, SIDEBAR_STAGE_ACTIVE_CLASS, SIDEBAR_EXPANDING_CLASS);
            isSidebarStageAnimating = false;
        };
        sidebar.addEventListener('transitionend', complete);
        sidebar.addEventListener('transitioncancel', complete);
        void stage.offsetWidth;
        applySidebarState(false, { persist: options.persist !== false });
        window.requestAnimationFrame(() => {
            if (!stage.isConnected) {
                isSidebarStageAnimating = false;
                return;
            }
            stage.classList.add(SIDEBAR_STAGE_ACTIVE_CLASS);
        });
        return;
    }

    stage.classList.add(SIDEBAR_COLLAPSING_CLASS);
    const complete = (event) => {
        if (event.target !== stage || event.propertyName !== 'width') return;
        stage.removeEventListener('transitionend', complete);
        stage.removeEventListener('transitioncancel', complete);
        stage.classList.remove(SIDEBAR_COLLAPSING_CLASS);
        isSidebarStageAnimating = false;
    };
    stage.addEventListener('transitionend', complete);
    stage.addEventListener('transitioncancel', complete);
    void stage.offsetWidth;
    applySidebarState(true, { persist: true });
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

function updateNavHighlight(path) {
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

    destroyCurrentPage();

    const pageEl = document.createElement('div');
    pageEl.className = 'pc-page';
    pageEl.dataset.route = routeKey;
    pageEl.innerHTML = handler.render(params);
    pageContainer.appendChild(pageEl);
    activePage = { el: pageEl, handler };

    if (handler.mount) {
        try {
            const result = handler.mount(pageEl, params);
            if (result && typeof result.then === 'function') {
                result.catch((error) => console.error('page mount error:', routeKey, error));
            }
        } catch (error) {
            console.error('page mount error:', routeKey, error);
        }
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
