import { registerRoute, navigate, goBack, navigateToTab, getCurrentRoute, setRouteChangeCallback, initRouter, getRouteHandler, resolveRouteKey } from './pc-router.js';
import { initStorage, getStorage } from './storage.js';
import { showToast, closeModal, copyToClipboard, escapeHtml, formatBytes } from './pc-utils.js';
import '../css/pc.css';
import corgiHome from '../assets/mobile/mascots/corgi-home.png';
import tipMascot from '../assets/mobile/mascots/tip-mascot.png';
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

let appEl = null;
let pageContainer = null;
let activeNav = '/';
let activePage = null;
let currentAccent = 'pink';

const NAV_ITEMS = [
    { path: '/', icon: navHome, label: '首页' },
    { path: '/library', icon: navLibrary, label: '提示词库' },
    { path: '/editor/', icon: navEditor, label: '新建/编辑' },
    { path: '/category', icon: navCategory, label: '分类与标签' },
    { path: '/settings', icon: navSettings, label: '设置' }
];

const TAB_ROUTES = ['/', '/library', '/category', '/settings'];

function renderShell() {
    return `
        <aside class="pc-sidebar">
            <div class="pc-sidebar-header">
                <div class="pc-sidebar-logo">
                    <img class="pc-sidebar-logo-icon" src="${appIcon}" alt="图标">
                    <div>
                        <div class="pc-sidebar-logo-text">提示词管家</div>
                        <div class="pc-sidebar-logo-sub">本地提示词管理器</div>
                    </div>
                </div>
                <div class="pc-sidebar-badge">🛡️ 本地优先·隐私安全</div>
            </div>
            <nav class="pc-sidebar-nav" id="pcSidebarNav">
                ${NAV_ITEMS.map(item => `
                    <button class="pc-nav-item ${item.path === '/' ? 'pc-nav-active' : ''}" data-nav="${item.path}">
                        <div class="pc-nav-icon" style="-webkit-mask-image:url(${item.icon});mask-image:url(${item.icon})"></div>
                        <span>${item.label}</span>
                    </button>
                `).join('')}
            </nav>
            <div class="pc-sidebar-footer">
                <div class="pc-sidebar-mascot" id="pcSidebarMascot">
                    <img class="pc-sidebar-mascot-img" src="${tipMascot}" alt="提示" style="width:100%;border-radius:var(--pc-radius-md);">
                </div>
                <div class="pc-sidebar-storage" id="pcSidebarStorage">
                    <div class="pc-sidebar-storage-label">💾 本地数据</div>
                    <div class="pc-sidebar-storage-value" id="pcStorageValue">计算中...</div>
                </div>
            </div>
        </aside>
        <main class="pc-main" id="pcMain"></main>
    `;
}

async function mount(el) {
    appEl = el;
    appEl.classList.add('pc-app');
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
    setupKeyboardShortcuts();

    setRouteChangeCallback(handleRouteChange);
    initRouter();

    createPage('/', {}, 'tab');
    updateStorageInfo();
}

function setupSidebarNav() {
    const nav = document.getElementById('pcSidebarNav');
    nav.addEventListener('click', (e) => {
        const item = e.target.closest('.pc-nav-item');
        if (!item) return;
        const path = item.dataset.nav;
        if (path === '/editor/') {
            navigate('/editor/');
        } else if (TAB_ROUTES.includes(path)) {
            navigateToTab(path);
            updateNavHighlight(path);
        }
    });
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            const contextMenu = document.getElementById('pcContextMenu');
            if (contextMenu) contextMenu.classList.remove('pc-context-active');
            const viewer = document.getElementById('pcImageViewer');
            if (viewer) viewer.classList.remove('pc-image-viewer-active');
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

async function updateStorageInfo() {
    try {
        const storage = getStorage();
        if (storage && storage.estimateStorageSize) {
            const size = await storage.estimateStorageSize();
            const el = document.getElementById('pcStorageValue');
            if (el) el.textContent = formatBytes(size);
        } else {
            const el = document.getElementById('pcStorageValue');
            if (el) {
                const prompts = JSON.parse(localStorage.getItem('prompts') || '[]');
                el.textContent = `${prompts.length} 条记录`;
            }
        }
    } catch (e) {
        const el = document.getElementById('pcStorageValue');
        if (el) el.textContent = '本地存储';
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
