import { registerRoute, navigate, goBack, navigateToTab, getCurrentRoute, setRouteChangeCallback, initRouter, clearStack, getRouteHandler, resolveRouteKey } from './mobile-router.js';
import { initStorage, getStorage, isCapacitor } from './storage.js';
import { showToast } from './utils.js';
import { initMobileUtils } from './mobile-utils.js';
import '../css/mobile.css';
import { render as renderHome, mount as mountHome, unmount as unmountHome } from './mobile-home.js';
import { render as renderLibrary, mount as mountLibrary, unmount as unmountLibrary } from './mobile-library.js';
import { render as renderDetail, mount as mountDetail, unmount as unmountDetail } from './mobile-detail.js';
import { render as renderEditor, mount as mountEditor, unmount as unmountEditor } from './mobile-editor.js';
import { render as renderCategory, mount as mountCategory, unmount as unmountCategory } from './mobile-category.js';
import { render as renderSettings, mount as mountSettings, unmount as unmountSettings } from './mobile-settings.js';
import navHome from '../assets/mobile/nav-icons/home.png';
import navLibrary from '../assets/mobile/nav-icons/library.png';
import navCategory from '../assets/mobile/nav-icons/category.png';
import navSettings from '../assets/mobile/nav-icons/settings.png';
import { mobileIcon } from './mobile-icon-assets.js';
import { initTheme } from './theme-service.js';

let appEl = null;
let pageContainer = null;
let activeTab = '/';
let activePages = {};
let App = null;
let backButtonRegistered = false;

if (isCapacitor) {
    import('@capacitor/app').then(mod => {
        App = mod.App;
        setupBackButton();
    });
}

const TAB_ROUTES = ['/', '/library', '/category', '/settings'];

function renderShell() {
    return `
        <div class="m-page-container" id="mPageContainer"></div>
        <nav class="m-bottom-nav" id="mBottomNav">
            <button class="m-nav-item m-nav-active" data-tab="/" aria-label="首页">
                <div class="m-nav-icon" style="-webkit-mask-image:url(${navHome});mask-image:url(${navHome})"></div>
                <span class="m-nav-label">首页</span>
            </button>
            <button class="m-nav-item" data-tab="/library" aria-label="提示词库">
                <div class="m-nav-icon" style="-webkit-mask-image:url(${navLibrary});mask-image:url(${navLibrary})"></div>
                <span class="m-nav-label">提示词库</span>
            </button>
            <div class="m-nav-center">
                <button class="m-nav-center-btn" id="mNavAddBtn" aria-label="新建">${mobileIcon('plus')}</button>
            </div>
            <button class="m-nav-item" data-tab="/category" aria-label="分类">
                <div class="m-nav-icon" style="-webkit-mask-image:url(${navCategory});mask-image:url(${navCategory})"></div>
                <span class="m-nav-label">分类</span>
            </button>
            <button class="m-nav-item" data-tab="/settings" aria-label="设置">
                <div class="m-nav-icon" style="-webkit-mask-image:url(${navSettings});mask-image:url(${navSettings})"></div>
                <span class="m-nav-label">设置</span>
            </button>
        </nav>
        <div class="m-toast" id="mToast"></div>
        <div class="m-action-sheet-overlay" id="mActionSheetOverlay">
            <div class="m-action-sheet" id="mActionSheet"></div>
        </div>
    `;
}

function mount(el) {
    appEl = el;
    initTheme();
    appEl.classList.add('mobile-app');
    appEl.innerHTML = renderShell();
    pageContainer = document.getElementById('mPageContainer');

    initMobileUtils({
        showMobileToast: _showMobileToast,
        showActionSheet: _showActionSheet,
        navigate: navigate,
        goBack: goBack
    });

    registerRoute('/', { render: renderHome, mount: mountHome, unmount: unmountHome });
    registerRoute('/library', { render: renderLibrary, mount: mountLibrary, unmount: unmountLibrary });
    registerRoute('/detail/:id', { render: renderDetail, mount: mountDetail, unmount: unmountDetail });
    registerRoute('/editor/:id', { render: renderEditor, mount: mountEditor, unmount: unmountEditor });
    registerRoute('/category', { render: renderCategory, mount: mountCategory, unmount: unmountCategory });
    registerRoute('/settings', { render: renderSettings, mount: mountSettings, unmount: unmountSettings });

    setupBottomNav();
    setupAddButton();
    setupBackButton();

    setRouteChangeCallback(handleRouteChange);
    initRouter();

    createPage('/', {}, 'tab');
}

function setupBottomNav() {
    const nav = document.getElementById('mBottomNav');
    nav.addEventListener('click', (e) => {
        const item = e.target.closest('.m-nav-item');
        if (!item) return;
        const tab = item.dataset.tab;
        if (tab === activeTab) return;
        switchTab(tab);
    });
}

function switchTab(tab) {
    activeTab = tab;
    updateNavHighlight(tab);
    navigateToTab(tab);
}

function updateNavHighlight(tab) {
    const navItems = document.querySelectorAll('.m-nav-item');
    navItems.forEach(item => {
        item.classList.remove('m-nav-active', 'm-nav-active-pink');
        if (item.dataset.tab === tab) {
            if (tab === '/library') {
                item.classList.add('m-nav-active-pink');
            } else {
                item.classList.add('m-nav-active');
            }
        }
    });
}

function setupAddButton() {
    document.getElementById('mNavAddBtn').addEventListener('click', () => {
        navigate('/editor/');
    });
}

function setupBackButton() {
    if (!App || backButtonRegistered) return;
    backButtonRegistered = true;
    App.addListener('backButton', () => {
        const route = getCurrentRoute();
        if (!route) return;

        if (TAB_ROUTES.includes(route.path)) {
            const now = Date.now();
            if (window._mLastBackPress && now - window._mLastBackPress < 2000) {
                App.exitApp();
            } else {
                window._mLastBackPress = now;
                _showMobileToast('再按一次退出应用', 'warning');
            }
        } else {
            goBack();
        }
    });
}

function handleRouteChange(newRoute, oldRoute, direction) {
    if (!newRoute) return;

    const path = newRoute.path || '';
    const isTab = TAB_ROUTES.includes(path);

    if (isTab) {
        activeTab = path;
        updateNavHighlight(path);
        document.getElementById('mBottomNav').style.display = '';
        destroyAllPages();
    } else {
        document.getElementById('mBottomNav').style.display = 'none';
    }

    const routeKey = resolveRouteKey(path);
    createPage(routeKey, newRoute.params || {}, direction);
}

function destroyAllPages() {
    Object.keys(activePages).forEach(key => {
        const page = activePages[key];
        if (page) {
            if (page.handler && page.handler.unmount) page.handler.unmount(page.el);
            if (page.el.parentNode) page.el.remove();
        }
    });
    activePages = {};
}

function destroyPage(routeKey) {
    const page = activePages[routeKey];
    if (!page) return;
    if (page.handler && page.handler.unmount) page.handler.unmount(page.el);
    if (page.el.parentNode) page.el.remove();
    delete activePages[routeKey];
}

function createPage(routeKey, params = {}, direction = 'tab') {
    const handler = getRouteHandler(routeKey);
    if (!handler) {
        console.warn('No route handler for:', routeKey);
        return;
    }

    if (activePages[routeKey]) {
        const oldPage = activePages[routeKey];
        if (oldPage.handler && oldPage.handler.unmount) oldPage.handler.unmount(oldPage.el);
        if (oldPage.el.parentNode) oldPage.el.remove();
        delete activePages[routeKey];
    }

    if (direction === 'push') {
        Object.keys(activePages).forEach(key => {
            const page = activePages[key];
            if (page && TAB_ROUTES.includes(key)) {
                page.el.classList.add('m-page-slide-left');
            }
        });
    }

    const pageEl = document.createElement('div');
    pageEl.className = 'm-page' + (TAB_ROUTES.includes(routeKey) ? '' : ' m-page-sub');
    pageEl.dataset.route = routeKey;
    pageEl.innerHTML = handler.render(params);
    pageContainer.appendChild(pageEl);
    activePages[routeKey] = { el: pageEl, handler };

    if (direction === 'push') {
        pageEl.classList.add('m-page-hidden');
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                pageEl.classList.remove('m-page-hidden');
            });
        });
    }

    if (direction === 'pop') {
        Object.keys(activePages).forEach(key => {
            if (key !== routeKey) {
                const page = activePages[key];
                if (page) {
                    page.el.classList.add('m-page-hidden');
                    setTimeout(() => destroyPage(key), 300);
                }
            }
        });
    }

    if (handler.mount) {
        handler.mount(pageEl, params);
    }
}

function _showMobileToast(msg, type = 'success') {
    const toast = document.getElementById('mToast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `m-toast m-toast-${type} m-toast-show`;
    clearTimeout(window._mToastTimer);
    window._mToastTimer = setTimeout(() => {
        toast.classList.remove('m-toast-show');
    }, 2500);
}

function _showActionSheet(items) {
    const overlay = document.getElementById('mActionSheetOverlay');
    const sheet = document.getElementById('mActionSheet');

    sheet.innerHTML = `
        <div class="m-action-sheet-handle"></div>
        ${items.map(item => `
            <button class="m-action-sheet-item ${item.danger ? 'm-sheet-danger' : ''}" data-action="${item.action}">
                <span class="m-action-sheet-icon">${item.icon || ''}</span>
                <span>${item.label}</span>
            </button>
        `).join('')}
    `;

    sheet.querySelectorAll('.m-action-sheet-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            hideActionSheet();
            const item = items.find(i => i.action === action);
            if (item && item.handler) item.handler();
        });
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) hideActionSheet();
    });

    overlay.classList.add('m-sheet-show');
}

function hideActionSheet() {
    const overlay = document.getElementById('mActionSheetOverlay');
    overlay.classList.remove('m-sheet-show');
}

function getActiveTab() {
    return activeTab;
}

function refreshCurrentPage() {
    const route = getCurrentRoute();
    if (!route) return;
    const routeKey = resolveRouteKey(route.path || '');
    const page = activePages[routeKey];
    if (!page) return;
    const handler = page.handler;
    if (handler.unmount) handler.unmount(page.el);
    page.el.innerHTML = handler.render(route.params);
    if (handler.mount) handler.mount(page.el, route.params);
}

export {
    mount,
    _showMobileToast as showMobileToast,
    _showActionSheet as showActionSheet,
    hideActionSheet,
    getActiveTab,
    navigate,
    goBack,
    refreshCurrentPage
};
