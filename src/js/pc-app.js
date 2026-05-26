import { registerRoute, navigate, goBack, navigateToTab, getCurrentRoute, setRouteChangeCallback, initRouter, getRouteHandler, resolveRouteKey } from './pc-router.js';
import { initStorage, getStorage } from './storage.js';
import { showToast, closeModal, closeImageViewer, copyToClipboard, escapeHtml, formatBytes } from './pc-utils.js';
import '../css/pc.css';
import corgiHome from '../assets/mobile/mascots/corgi-home.png';
import tipMascot from '../assets/mobile/mascots/tip-mascot.png';
import appIcon from '../assets/pc/app-icon.png';
import navHome from '../assets/pc/nav-icons/home.png';
import navLibrary from '../assets/pc/nav-icons/library.png';
import navEditor from '../assets/pc/nav-icons/editor.png';
import navCategory from '../assets/pc/nav-icons/category.png';
import navSettings from '../assets/pc/nav-icons/settings.png';
import sidebarStorageIcon from '../../UI设计稿/图标/插画设计/保存.png';
import { render as renderHome, mount as mountHome, unmount as unmountHome } from './pc-home.js';
import { render as renderLibrary, mount as mountLibrary, unmount as unmountLibrary } from './pc-library.js';
import { render as renderDetail, mount as mountDetail, unmount as unmountDetail } from './pc-detail.js';
import { render as renderEditor, mount as mountEditor, unmount as unmountEditor } from './pc-editor.js';
import { render as renderCategory, mount as mountCategory, unmount as unmountCategory } from './pc-category.js';
import { render as renderSettings, mount as mountSettings, unmount as unmountSettings } from './pc-settings.js';

let appEl = null;
let pageContainer = null;
let activeNav = '/';
let activePage = null;
let currentAccent = 'pink';
let sidebarStoragePercent = 0;
let sidebarStorageFrame = 0;
let isSidebarCollapsed = false;

const NAV_ITEMS = [
    { path: '/', icon: navHome, label: '首页' },
    { path: '/library', icon: navLibrary, label: '提示词库' },
    { path: '/editor/', icon: navEditor, label: '新建/编辑' },
    { path: '/category', icon: navCategory, label: '分类与标签' },
    { path: '/settings', icon: navSettings, label: '设置' }
];

const TAB_ROUTES = ['/', '/library', '/category', '/settings'];
const SIDEBAR_STORAGE_MAX_BYTES = 50 * 1024 * 1024;
const SIDEBAR_STORAGE_ANIMATION_MS = 700;
const SIDEBAR_STORAGE_HOVER_MS = 520;
const SIDEBAR_STORAGE_HOVER_BOOST = 6;
const SIDEBAR_STORAGE_TILT_MAX = 4;
const SIDEBAR_COLLAPSED_KEY = 'pc-sidebar-collapsed';
const NAV_CLICK_MOTION_CLASS = 'pc-nav-clicking';

const navClickMotionCleanups = new WeakMap();

const SIDEBAR_TOGGLE_ICON = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15 6 9 12l6 6"></path>
        <path d="M20 6 14 12l6 6"></path>
    </svg>
`;

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
                        <span class="pc-sidebar-toggle-icon">${SIDEBAR_TOGGLE_ICON}</span>
                        <span class="pc-sidebar-toggle-text">${isSidebarCollapsed ? '展开侧栏' : '收起侧栏'}</span>
                    </button>
                </div>
            </div>
            <nav class="pc-sidebar-nav" id="pcSidebarNav">
                ${NAV_ITEMS.map(item => `
                    <button class="pc-nav-item ${item.path === '/' ? 'pc-nav-active' : ''}" data-nav="${item.path}" aria-label="${item.label}" title="${item.label}">
                        <div class="pc-nav-icon" aria-hidden="true" style="-webkit-mask-image:url(${item.icon});mask-image:url(${item.icon})"></div>
                        <span class="pc-nav-label">${item.label}</span>
                    </button>
                `).join('')}
            </nav>
            <div class="pc-sidebar-footer">
                <div class="pc-sidebar-mascot" id="pcSidebarMascot">
                    <img class="pc-sidebar-mascot-img" src="${tipMascot}" alt="提示" style="width:100%;border-radius:var(--pc-radius-md);">
                </div>
                <div class="pc-sidebar-storage" id="pcSidebarStorage">
                    <div class="pc-sidebar-storage-copy">
                        <div class="pc-sidebar-storage-label">
                            <img class="pc-sidebar-storage-icon" src="${sidebarStorageIcon}" alt="" aria-hidden="true">
                            <span>本地数据</span>
                        </div>
                        <div class="pc-sidebar-storage-value" id="pcStorageValue">计算中...</div>
                    </div>
                    <div class="pc-sidebar-storage-ring" id="pcSidebarStorageRing" role="img" aria-label="本地数据占用 0%">
                        <span class="pc-sidebar-storage-ring-value" id="pcSidebarStorageRingValue">0%</span>
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
    setupSidebarStorageMotion();

    setRouteChangeCallback(handleRouteChange);
    initRouter();

    createPage('/', {}, 'tab');
    updateStorageInfo();
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
        if (toggleText) toggleText.textContent = isSidebarCollapsed ? '展开侧栏' : '收起侧栏';
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
    nav.addEventListener('click', (e) => {
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
    });
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
        applySidebarState(!isSidebarCollapsed, { persist: true });
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
        item.classList.remove('pc-nav-active');
        const navPath = item.dataset.nav;
        if (navPath === path) {
            item.classList.add('pc-nav-active');
        } else if (path.startsWith('/detail') && navPath === '/library') {
            item.classList.add('pc-nav-active');
        } else if (path.startsWith('/editor') && navPath === '/editor/') {
            item.classList.add('pc-nav-active');
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

function getSidebarStoragePercent(sizeBytes) {
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return 0;
    return Math.min(Math.round((sizeBytes / SIDEBAR_STORAGE_MAX_BYTES) * 100), 100);
}

function getSidebarStorageTone(percent) {
    if (percent >= 86) return '#FF6B9A';
    if (percent >= 61) return '#FFC94A';
    return '#2D8CFF';
}

function setSidebarStorageRing(percent, options = {}) {
    const ring = document.getElementById('pcSidebarStorageRing');
    const value = document.getElementById('pcSidebarStorageRingValue');
    if (!ring || !value) return;

    const normalized = Math.max(0, Math.min(Math.round(percent), 100));
    const tone = getSidebarStorageTone(normalized);
    ring.style.setProperty('--storage-ring-percent', `${normalized}%`);
    ring.style.setProperty('--storage-ring-color', tone);
    ring.setAttribute('aria-label', `本地数据占用 ${normalized}%`);
    value.textContent = `${normalized}%`;

    if (!options.preview) sidebarStoragePercent = normalized;
}

function animateSidebarStorageRing(targetPercent, duration = SIDEBAR_STORAGE_ANIMATION_MS, options = {}) {
    const ring = document.getElementById('pcSidebarStorageRing');
    if (!ring) return;

    if (sidebarStorageFrame) {
        cancelAnimationFrame(sidebarStorageFrame);
        sidebarStorageFrame = 0;
    }

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const from = options.from ?? sidebarStoragePercent;
    const target = Math.max(0, Math.min(Math.round(targetPercent), 100));

    if (reducedMotion || duration <= 0) {
        setSidebarStorageRing(target, options);
        return;
    }

    const startedAt = performance.now();
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);

    const tick = (now) => {
        const progress = Math.min((now - startedAt) / duration, 1);
        const eased = easeOut(progress);
        const current = from + (target - from) * eased;
        setSidebarStorageRing(current, options);

        if (progress < 1) {
            sidebarStorageFrame = requestAnimationFrame(tick);
            return;
        }

        sidebarStorageFrame = 0;
        setSidebarStorageRing(target, options);
    };

    sidebarStorageFrame = requestAnimationFrame(tick);
}

function pulseSidebarStorageRing() {
    if (sidebarStorageFrame) {
        cancelAnimationFrame(sidebarStorageFrame);
        sidebarStorageFrame = 0;
    }

    const peak = Math.min(sidebarStoragePercent + SIDEBAR_STORAGE_HOVER_BOOST, 100);
    const base = sidebarStoragePercent;
    const startedAt = performance.now();
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    const easeInOut = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const tick = (now) => {
        const progress = Math.min((now - startedAt) / SIDEBAR_STORAGE_HOVER_MS, 1);
        let current;

        if (progress < 0.46) {
            const local = easeOut(progress / 0.46);
            current = base + (peak - base) * local;
        } else {
            const local = easeInOut((progress - 0.46) / 0.54);
            current = peak + (base - peak) * local;
        }

        setSidebarStorageRing(current, { preview: true });

        if (progress < 1) {
            sidebarStorageFrame = requestAnimationFrame(tick);
            return;
        }

        sidebarStorageFrame = 0;
        setSidebarStorageRing(base, { preview: true });
    };

    sidebarStorageFrame = requestAnimationFrame(tick);
}

function setupSidebarStorageMotion() {
    const card = document.getElementById('pcSidebarStorage');
    if (!card) return;

    card.addEventListener('mouseenter', () => {
        card.classList.add('pc-sidebar-storage-hover');
        pulseSidebarStorageRing();
    });

    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        const rotateY = (x - 0.5) * SIDEBAR_STORAGE_TILT_MAX * 2;
        const rotateX = (0.5 - y) * SIDEBAR_STORAGE_TILT_MAX * 2;

        card.style.setProperty('--storage-glow-x', `${Math.round(x * 100)}%`);
        card.style.setProperty('--storage-glow-y', `${Math.round(y * 100)}%`);
        card.style.setProperty('--storage-tilt-x', `${rotateX.toFixed(2)}deg`);
        card.style.setProperty('--storage-tilt-y', `${rotateY.toFixed(2)}deg`);
    });

    card.addEventListener('mouseleave', () => {
        card.classList.remove('pc-sidebar-storage-hover');
        card.style.setProperty('--storage-tilt-x', '0deg');
        card.style.setProperty('--storage-tilt-y', '0deg');
        animateSidebarStorageRing(sidebarStoragePercent, 220, { preview: true });
    });
}

async function updateStorageInfo() {
    try {
        const storage = getStorage();
        if (storage && storage.estimateStorageSize) {
            const size = await storage.estimateStorageSize();
            const el = document.getElementById('pcStorageValue');
            if (el) el.textContent = formatBytes(size);
            animateSidebarStorageRing(getSidebarStoragePercent(size));
        } else {
            const el = document.getElementById('pcStorageValue');
            if (el) {
                const prompts = JSON.parse(localStorage.getItem('prompts') || '[]');
                el.textContent = `${prompts.length} 条记录`;
            }
            animateSidebarStorageRing(0);
        }
    } catch (e) {
        const el = document.getElementById('pcStorageValue');
        if (el) el.textContent = '本地存储';
        animateSidebarStorageRing(0);
    }
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
    getAccent,
    updateStorageInfo
};
