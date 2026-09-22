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
    minimize: `
        <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2 6.25h8" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
    `,
    maximize: `
        <svg viewBox="0 0 12 12" aria-hidden="true">
            <rect x="2.25" y="2.25" width="7.5" height="7.5" rx="0.6" fill="none" stroke="currentColor" stroke-width="1.2"/>
        </svg>
    `,
    restore: `
        <svg viewBox="0 0 12 12" aria-hidden="true">
            <rect x="1.75" y="3.25" width="6.2" height="6.2" rx="0.55" fill="none" stroke="currentColor" stroke-width="1.15"/>
            <path d="M3.9 3.1V2.55A.55.55 0 0 1 4.45 2h4.1a.55.55 0 0 1 .55.55v4.1a.55.55 0 0 1-.55.55H8.5" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="round"/>
        </svg>
    `,
    close: `
        <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3.2 3.2l5.6 5.6M8.8 3.2L3.2 8.8" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
    `,
};

export function renderWindowChrome() {
    return `
        <div class="pc-window-chrome ${DRAG_CLASS}" id="${CHROME_ID}" ${DRAG_ATTR}>
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
        </div>
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
        const btn = event.target.closest('[data-window-action]');
        if (!btn || !chrome.contains(btn)) return;
        event.preventDefault();
        event.stopPropagation();
        handleWindowAction(btn.dataset.windowAction).finally(() => {
            syncMaximizeState(chrome);
        });
    };

    const onDragDoubleClick = (event) => {
        if (event.target.closest('[data-window-action]')) return;
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
