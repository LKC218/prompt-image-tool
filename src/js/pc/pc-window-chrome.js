const CHROME_ID = 'pcWindowChrome';
const DRAG_ATTR = 'data-tauri-drag-region';
const DRAG_CLASS = 'pywebview-drag-region';

function isTauriRuntime() {
    return typeof window !== 'undefined' && !!(window.__TAURI_INTERNALS__ || window.__TAURI__);
}

function isPywebviewRuntime() {
    return typeof window !== 'undefined' && !!window.pywebview?.api;
}

function getWindowApi() {
    if (typeof window === 'undefined') return null;
    if (window.__TAURI__?.window?.getCurrentWindow) {
        return window.__TAURI__.window.getCurrentWindow();
    }
    return null;
}

function getPywebviewAdapter() {
    const api = typeof window !== 'undefined' ? window.pywebview?.api : null;
    if (!api) return null;
    return {
        kind: 'pywebview',
        minimize: async () => {
            if (typeof api.minimize === 'function') await api.minimize();
        },
        close: async () => {
            if (typeof api.close === 'function') await api.close();
            else window.close();
        },
        toggleMaximize: async () => {
            if (typeof api.toggle_maximize === 'function') await api.toggle_maximize();
        },
        isMaximized: async () => {
            if (typeof api.is_maximized !== 'function') return false;
            return Boolean(await api.is_maximized());
        },
    };
}

async function resolveWindowApi() {
    const existing = getWindowApi();
    if (existing) return existing;
    const pyBridge = getPywebviewAdapter();
    if (pyBridge) return pyBridge;
    if (!isTauriRuntime()) return null;
    try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        return getCurrentWindow();
    } catch (e) {
        console.warn('resolve tauri window api failed:', e);
        return null;
    }
}

const ICONS = {
    sidebar: `
        <svg viewBox="0 0 16 16" aria-hidden="true">
            <rect x="2" y="3" width="12" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/>
            <path d="M6 3v10" fill="none" stroke="currentColor" stroke-width="1.2"/>
        </svg>
    `,
    back: `
        <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10 3.5 5.5 8 10 12.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    `,
    forward: `
        <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    `,
    minimize: `
        <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2.2 6.2h7.6" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="round"/>
        </svg>
    `,
    maximize: `
        <svg viewBox="0 0 12 12" aria-hidden="true">
            <rect x="2.4" y="2.4" width="7.2" height="7.2" rx="0.5" fill="none" stroke="currentColor" stroke-width="1.15"/>
        </svg>
    `,
    restore: `
        <svg viewBox="0 0 12 12" aria-hidden="true">
            <rect x="2.2" y="3.6" width="5.6" height="5.6" rx="0.45" fill="none" stroke="currentColor" stroke-width="1.1"/>
            <path d="M4.2 3.5V2.9A.5.5 0 0 1 4.7 2.4h4a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-.5.5H8.3" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
        </svg>
    `,
    close: `
        <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3.4 3.4l5.2 5.2M8.6 3.4L3.4 8.6" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="round"/>
        </svg>
    `,
};

export function renderWindowChrome() {
    return `
        <header class="pc-window-chrome" id="${CHROME_ID}">
            <div class="pc-window-chrome-left ${DRAG_CLASS}" ${DRAG_ATTR}></div>
            <div class="pc-window-chrome-drag ${DRAG_CLASS}" ${DRAG_ATTR}></div>
            <div class="pc-window-controls" role="group" aria-label="窗口控制">
                <button type="button" class="pc-window-btn" data-window-action="minimize" aria-label="最小化" title="最小化">
                    ${ICONS.minimize}
                </button>
                <button type="button" class="pc-window-btn" data-window-action="maximize" aria-label="最大化" title="最大化" aria-pressed="false">
                    <span class="pc-window-btn-icon pc-window-btn-icon-maximize">${ICONS.maximize}</span>
                    <span class="pc-window-btn-icon pc-window-btn-icon-restore" hidden>${ICONS.restore}</span>
                </button>
                <button type="button" class="pc-window-btn pc-window-btn-close" data-window-action="close" aria-label="关闭" title="关闭">
                    ${ICONS.close}
                </button>
            </div>
        </header>
    `;
}

async function syncMaximizeState(root) {
    const api = await resolveWindowApi();
    const maxBtn = root?.querySelector('[data-window-action="maximize"]');
    if (!maxBtn) return;
    if (!api?.isMaximized) {
        maxBtn.setAttribute('aria-pressed', 'false');
        maxBtn.setAttribute('aria-label', '最大化');
        maxBtn.setAttribute('title', '最大化');
        return;
    }
    try {
        const maximized = await api.isMaximized();
        maxBtn.setAttribute('aria-pressed', maximized ? 'true' : 'false');
        maxBtn.setAttribute('aria-label', maximized ? '还原' : '最大化');
        maxBtn.setAttribute('title', maximized ? '还原' : '最大化');
        maxBtn.querySelector('.pc-window-btn-icon-maximize')?.toggleAttribute('hidden', maximized);
        maxBtn.querySelector('.pc-window-btn-icon-restore')?.toggleAttribute('hidden', !maximized);
    } catch (e) {
        console.warn('sync window maximize state failed:', e);
    }
}

function handleChromeAction(action) {
    if (action === 'toggle-sidebar') {
        document.getElementById('pcSidebarToggle')?.click();
        return;
    }
    if (action === 'back') {
        window.history.back();
        return;
    }
    if (action === 'forward') {
        window.history.forward();
    }
}

async function handleWindowAction(action) {
    const api = await resolveWindowApi();
    if (action === 'close') {
        if (api?.close) {
            await api.close().catch((e) => console.warn('window close failed:', e));
            return;
        }
        window.close();
        return;
    }
    if (!api) return;
    try {
        if (action === 'minimize' && api.minimize) {
            await api.minimize();
            return;
        }
        if (action === 'maximize') {
            if (api.toggleMaximize) {
                await api.toggleMaximize();
            } else if (api.isMaximized && api.maximize && api.unmaximize) {
                if (await api.isMaximized()) await api.unmaximize();
                else await api.maximize();
            }
        }
    } catch (e) {
        console.warn(`window action ${action} failed:`, e);
    }
}

export function mountWindowChrome(root) {
    const chrome = root?.querySelector(`#${CHROME_ID}`) || root?.querySelector('.pc-window-chrome');
    if (!chrome) return () => {};

    const onActionClick = (event) => {
        const chromeBtn = event.target.closest('[data-chrome-action]');
        if (chromeBtn && chrome.contains(chromeBtn)) {
            event.preventDefault();
            event.stopPropagation();
            handleChromeAction(chromeBtn.dataset.chromeAction);
            return;
        }
        const btn = event.target.closest('[data-window-action]');
        if (!btn || !chrome.contains(btn)) return;
        event.preventDefault();
        event.stopPropagation();
        handleWindowAction(btn.dataset.windowAction).finally(() => {
            syncMaximizeState(chrome);
        });
    };

    const onDragDoubleClick = (event) => {
        if (event.target.closest('[data-window-action], [data-chrome-action]')) return;
        if (!event.target.closest(`[${DRAG_ATTR}], .${DRAG_CLASS}`)) return;
        handleWindowAction('maximize').finally(() => {
            syncMaximizeState(chrome);
        });
    };

    chrome.addEventListener('click', onActionClick);
    chrome.addEventListener('dblclick', onDragDoubleClick);

    const onMaximizeChange = () => {
        syncMaximizeState(chrome);
    };
    window.addEventListener('resize', onMaximizeChange);

    let unlistenResized = null;
    resolveWindowApi().then(async (api) => {
        if (!api?.onResized) return;
        try {
            unlistenResized = await api.onResized(() => {
                syncMaximizeState(chrome);
            });
        } catch (e) {
            console.warn('listen window resized failed:', e);
        }
    });

    syncMaximizeState(chrome);

    return () => {
        chrome.removeEventListener('click', onActionClick);
        chrome.removeEventListener('dblclick', onDragDoubleClick);
        window.removeEventListener('resize', onMaximizeChange);
        if (typeof unlistenResized === 'function') {
            try { unlistenResized(); } catch (e) { /* ignore */ }
        }
    };
}

export { isTauriRuntime, isPywebviewRuntime, CHROME_ID };
