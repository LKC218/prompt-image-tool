const DEFAULT_WIDTH = 1600;
const DEFAULT_HEIGHT = 900;
const MIN_WIDTH = 1024;
const MIN_HEIGHT = 576;
const SIZE_EPSILON = 2;
const SIZE_KEY = 'pc-window-last-good-size';

function isTauriRuntime() {
    return typeof window !== 'undefined' && !!(window.__TAURI_INTERNALS__ || window.__TAURI__);
}

async function getTauriWindow() {
    if (!isTauriRuntime()) return null;
    try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        return getCurrentWindow();
    } catch (e) {
        console.warn('pc-window-size: load tauri window api failed:', e);
        return null;
    }
}

function readStoredSize() {
    try {
        const raw = window.localStorage?.getItem(SIZE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (
            parsed
            && Number.isFinite(parsed.width)
            && Number.isFinite(parsed.height)
            && parsed.width >= MIN_WIDTH
            && parsed.height >= MIN_HEIGHT
        ) {
            return { width: Math.round(parsed.width), height: Math.round(parsed.height) };
        }
    } catch {
        /* ignore */
    }
    return null;
}

function writeStoredSize(width, height) {
    try {
        window.localStorage?.setItem(SIZE_KEY, JSON.stringify({ width, height }));
    } catch {
        /* ignore */
    }
}

function fitAspect(workWidth, workHeight) {
    const targetRatio = DEFAULT_WIDTH / DEFAULT_HEIGHT;
    let width = DEFAULT_WIDTH;
    let height = DEFAULT_HEIGHT;
    if (workWidth < width || workHeight < height) {
        const scale = Math.min(workWidth / DEFAULT_WIDTH, workHeight / DEFAULT_HEIGHT);
        width = Math.max(MIN_WIDTH, Math.floor(DEFAULT_WIDTH * scale));
        height = Math.max(MIN_HEIGHT, Math.floor(width / targetRatio));
        if (height > workHeight) {
            height = Math.max(MIN_HEIGHT, Math.floor(workHeight));
            width = Math.max(MIN_WIDTH, Math.floor(height * targetRatio));
        }
    }
    return { width, height };
}

function shouldCorrect(current, expected) {
    return current.width < expected.width - SIZE_EPSILON
        || current.height < expected.height - SIZE_EPSILON;
}

/**
 * 启动时校验默认 16:9 尺寸，并在最小化还原后纠偏，避免 Win 无边框窗口尺寸漂移。
 * 仅在 Tauri 壳生效；浏览器 / pywebview 直接 no-op。
 */
export async function initWindowSizePolicy() {
    const win = await getTauriWindow();
    if (!win?.setSize) return () => {};

    const { LogicalSize } = await import('@tauri-apps/api/dpi');
    let lastGood = readStoredSize() || { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
    let wasMinimized = false;
    let correcting = false;

    const applySize = async (width, height) => {
        if (correcting) return;
        correcting = true;
        try {
            await win.setSize(new LogicalSize(width, height));
            lastGood = { width, height };
            writeStoredSize(width, height);
        } catch (e) {
            console.warn('pc-window-size: set size failed:', e);
        } finally {
            correcting = false;
        }
    };

    try {
        const monitor = (await win.currentMonitor?.()) || (await win.primaryMonitor?.());
        const work = monitor?.workSize || monitor?.size;
        const workWidth = Math.floor(work?.width || DEFAULT_WIDTH);
        const workHeight = Math.floor(work?.height || DEFAULT_HEIGHT);
        const fitted = fitAspect(workWidth, workHeight);
        const current = await (win.outerSize?.() || win.innerSize?.());
        if (current?.width && current?.height && shouldCorrect(
            { width: Math.floor(current.width), height: Math.floor(current.height) },
            fitted,
        )) {
            await applySize(fitted.width, fitted.height);
        } else if (!readStoredSize()) {
            lastGood = fitted;
            writeStoredSize(fitted.width, fitted.height);
        }
    } catch (e) {
        console.warn('pc-window-size: startup fit failed:', e);
    }

    const onResized = async () => {
        try {
            const minimized = await win.isMinimized?.();
            if (minimized) {
                wasMinimized = true;
                return;
            }
            const maximized = await win.isMaximized?.();
            const size = await (win.outerSize?.() || win.innerSize?.());
            if (!size?.width || !size?.height) return;
            const current = { width: Math.floor(size.width), height: Math.floor(size.height) };

            if (wasMinimized && !maximized) {
                wasMinimized = false;
                if (shouldCorrect(current, lastGood)) {
                    await applySize(lastGood.width, lastGood.height);
                }
                return;
            }

            if (!maximized && current.width >= MIN_WIDTH && current.height >= MIN_HEIGHT) {
                lastGood = current;
                writeStoredSize(current.width, current.height);
            }
        } catch (e) {
            console.warn('pc-window-size: resize policy failed:', e);
        }
    };

    let unlisten = null;
    try {
        if (win.onResized) {
            unlisten = await win.onResized(onResized);
        }
    } catch (e) {
        console.warn('pc-window-size: listen resized failed:', e);
    }

    window.addEventListener('resize', () => {
        onResized();
    });

    return () => {
        if (typeof unlisten === 'function') {
            try { unlisten(); } catch { /* ignore */ }
        }
    };
}

export {
    DEFAULT_WIDTH,
    DEFAULT_HEIGHT,
    MIN_WIDTH,
    MIN_HEIGHT,
    fitAspect,
    shouldCorrect,
    isTauriRuntime,
};
