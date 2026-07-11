import { registerRoute, navigate, goBack, navigateToTab, getCurrentRoute, setRouteChangeCallback, initRouter, getRouteHandler, resolveRouteKey } from './pc-router.js';
import { showToast, closeModal, closeImageViewer, copyToClipboard, escapeHtml } from './pc-utils.js';
import '../css/pc.css';
import corgiHome from '../assets/mobile/mascots/corgi-home.png';
import appIcon from '../assets/pc/app-icon.png';
import navHome from '../assets/pc/nav-icons/home.png';
import navLibrary from '../assets/pc/nav-icons/library.png';
import navEditor from '../assets/pc/nav-icons/editor.png';
import navCategory from '../assets/pc/nav-icons/category.png';
import navSettings from '../assets/pc/nav-icons/settings.png';
import { render as renderHome, mount as mountHome, unmount as unmountHome } from './pc-home.js';
import { render as renderLibrary, mount as mountLibrary, unmount as unmountLibrary } from './pc-library.js';
import { render as renderDetail, mount as mountDetail, unmount as unmountDetail } from './pc-detail.js';
import { render as renderEditor, mount as mountEditor, unmount as unmountEditor } from './pc-editor.js';
import { render as renderCategory, mount as mountCategory, unmount as unmountCategory } from './pc-category.js';
import { render as renderSettings, mount as mountSettings, unmount as unmountSettings } from './pc-settings.js';
import { initRipple } from './ripple.js';

let appEl = null;
let pageContainer = null;
let activeNav = '/';
let activePage = null;
let currentAccent = 'pink';
let isSidebarCollapsed = false;

const NAV_ITEMS = [
    { path: '/', icon: navHome, label: '首页' },
    { path: '/library', icon: navLibrary, label: '提示词库' },
    { path: '/editor/', icon: navEditor, label: '新建/编辑' },
    { path: '/category', icon: navCategory, label: '分类与标签' }
];

const SETTINGS_NAV_ITEM = { path: '/settings', icon: navSettings, label: '设置' };

const TAB_ROUTES = ['/', '/library', '/category', '/settings'];
const SIDEBAR_COLLAPSED_KEY = 'pc-sidebar-collapsed';
const NAV_CLICK_MOTION_CLASS = 'pc-nav-clicking';

const navClickMotionCleanups = new WeakMap();

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
                ${NAV_ITEMS.map(item => `
                    <button class="pc-nav-item ${item.path === '/' ? 'pc-nav-active' : ''}" data-nav="${item.path}" aria-label="${item.label}" title="${item.label}"${item.path === '/' ? ' aria-current="page"' : ''}>
                        <div class="pc-nav-icon" aria-hidden="true" style="-webkit-mask-image:url(${item.icon});mask-image:url(${item.icon})"></div>
                        <span class="pc-nav-label">${item.label}</span>
                    </button>
                `).join('')}
            </nav>
            <div class="pc-sidebar-footer">
                <div class="pc-sidebar-utility-nav" aria-label="应用设置">
                    <button class="pc-nav-item pc-sidebar-settings-item" data-nav="${SETTINGS_NAV_ITEM.path}" aria-label="${SETTINGS_NAV_ITEM.label}" title="${SETTINGS_NAV_ITEM.label}">
                        <div class="pc-nav-icon" aria-hidden="true" style="-webkit-mask-image:url(${SETTINGS_NAV_ITEM.icon});mask-image:url(${SETTINGS_NAV_ITEM.icon})"></div>
                        <span class="pc-nav-label">${SETTINGS_NAV_ITEM.label}</span>
                    </button>
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
        <main class="pc-main" id="pcMain"></main>
    `;
}

async function mount(el) {
    appEl = el;
    isSidebarCollapsed = readSidebarCollapsedState();
    appEl.classList.add('pc-app');
    applySidebarState(isSidebarCollapsed);
    appEl.innerHTML = renderShell();
    pageContainer = document.getElementById('pcMain');

    const savedAccent = localStorage.getItem('pc-accent') || 'pink';
    setAccent(savedAccent);

    registerRoute('/', { render: renderHome, mount: mountHome, unmount: unmountHome });
    registerRoute('/library', { render: renderLibrary, mount: mountLibrary, unmount: unmountLibrary });
    registerRoute('/detail/:id', { render: renderDetail, mount: mountDetail, unmount: unmountDetail });
    registerRoute('/editor/:id', { render: renderEditor, mount: mountEditor, unmount: unmountEditor });
    registerRoute('/category', { render: renderCategory, mount: mountCategory, unmount: unmountCategory });
    registerRoute('/settings', { render: renderSettings, mount: mountSettings, unmount: unmountSettings });

    setupSidebarNav();
    setupSidebarToggle();
    setupKeyboardShortcuts();
    setupSidebarClock();
    initRipple(appEl);

    setRouteChangeCallback(handleRouteChange);
    initRouter();

    createPage('/', {}, 'tab');
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
}

function setupSidebarNav() {
    const nav = document.getElementById('pcSidebarNav');
    const settingsNav = appEl.querySelector('.pc-sidebar-utility-nav');
    const handleNavigation = (e) => {
        const item = e.target.closest('.pc-nav-item');
        if (!item) return;
        playNavIconClickMotion(item);
        const path = item.dataset.nav;
        if (path === '/editor/') {
            navigate('/editor/');
        } else if (TAB_ROUTES.includes(path)) {
            navigateToTab(path);
            updateNavHighlight(path);
        }
    };

    nav.addEventListener('click', handleNavigation);
    settingsNav?.addEventListener('click', handleNavigation);
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
        if (toggle.classList.contains('is-flying')) return;

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
            if (event.target !== icon) return;
            toggle.classList.remove('is-flying');
            toggle.removeAttribute('aria-busy');
            icon.removeEventListener('animationend', complete);
            applySidebarState(nextCollapsed, { persist: true });
        };

        toggle.classList.add('is-flying');
        toggle.setAttribute('aria-busy', 'true');
        icon.addEventListener('animationend', complete);
    });
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            const contextMenu = document.getElementById('pcContextMenu');
            if (contextMenu) contextMenu.classList.remove('pc-context-active');
            closeImageViewer();
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
            || (path.startsWith('/editor') && navPath === '/editor/');

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
    const path = newRoute.path || '';
    const routeKey = resolveRouteKey(path);

    if (TAB_ROUTES.includes(path)) {
        updateNavHighlight(path);
    } else if (path.startsWith('/detail')) {
        updateNavHighlight('/library');
    } else if (path.startsWith('/editor')) {
        updateNavHighlight('/editor/');
    }

    createPage(routeKey, newRoute.params || {}, direction);
}

function destroyCurrentPage() {
    if (!activePage) return;
    if (activePage.handler && activePage.handler.unmount) {
        activePage.handler.unmount(activePage.el);
    }
    if (activePage.el.parentNode) activePage.el.remove();
    activePage = null;
}

function createPage(routeKey, params = {}, direction = 'tab') {
    const handler = getRouteHandler(routeKey);
    if (!handler) {
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
        handler.mount(pageEl, params);
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
    currentAccent = color;
    if (appEl) appEl.setAttribute('data-accent', color);
    localStorage.setItem('pc-accent', color);
}

function getAccent() {
    return currentAccent;
}

function refreshCurrentPage() {
    const route = getCurrentRoute();
    if (!route) return;
    const routeKey = resolveRouteKey(route.path || '');
    createPage(routeKey, route.params || {}, 'tab');
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
