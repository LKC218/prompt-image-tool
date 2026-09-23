import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const gsapMocks = vi.hoisted(() => ({
    set: vi.fn(),
    to: vi.fn((target, vars) => {
        const tween = { kill: vi.fn() };
        if (vars?.onComplete) {
            queueMicrotask(() => vars.onComplete());
        }
        return tween;
    }),
}));

vi.mock('gsap', () => ({
    gsap: gsapMocks,
}));

const utilsMocks = vi.hoisted(() => ({
    showToast: vi.fn(),
    showContextMenu: vi.fn(),
}));

vi.mock('./pc-utils.js', () => ({
    showToast: utilsMocks.showToast,
    showContextMenu: utilsMocks.showContextMenu,
}));

vi.mock('./pc-icon-assets.js', () => ({
    pcIcon: (name, className = '') => `<svg data-icon="${name}" class="${className}"></svg>`,
}));

vi.mock('../core/storage.js', () => ({
    getStorage: vi.fn(() => null),
}));

vi.mock('../shared/image-download-utils.js', () => ({
    downloadImage: vi.fn(),
}));

async function loadViewer() {
    vi.resetModules();
    gsapMocks.set.mockClear();
    gsapMocks.to.mockClear();
    return import('./pc-image-viewer.js');
}

function mountDom() {
    document.body.innerHTML = '<div id="pcApp"></div>';
    const source = document.createElement('img');
    source.src = 'https://local.test/source.webp';
    document.body.appendChild(source);
    return source;
}

function mockRect(el, rect) {
    el.getBoundingClientRect = () => ({
        x: rect.left,
        y: rect.top,
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        right: rect.left + rect.width,
        bottom: rect.top + rect.height,
    });
}

describe('pc-image-viewer', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('支持旧入参：字符串 URL', async () => {
        mountDom();
        const { openImageViewer, isOpen } = await loadViewer();
        openImageViewer('https://local.test/a.png');
        expect(isOpen()).toBe(true);
        expect(document.getElementById('pcImageViewerImg')?.src).toContain('a.png');
    });

    it('支持多图 urls 与 index', async () => {
        mountDom();
        const { openImageViewer } = await loadViewer();
        openImageViewer({
            urls: ['https://local.test/1.png', 'https://local.test/2.png'],
            index: 1,
        });
        expect(document.getElementById('pcImageViewerImg')?.src).toContain('2.png');
        expect(document.getElementById('pcImageViewerNav')?.classList.contains('is-hidden')).toBe(false);
        expect(document.getElementById('pcImageViewerNavIndex')?.textContent).toBe('2 / 2');
    });

    it('无 sourceEl 时仅打开，不进入 flipping', async () => {
        mountDom();
        const { openImageViewer } = await loadViewer();
        openImageViewer({ src: 'https://local.test/a.png' });
        const viewer = document.getElementById('pcImageViewer');
        expect(viewer?.classList.contains('pc-image-viewer-active')).toBe(true);
        expect(viewer?.classList.contains('pc-image-viewer-flipping')).toBe(false);
    });

    it('图片未加载完成时不做 FLIP（spec: fade）', async () => {
        const source = mountDom();
        const { openImageViewer } = await loadViewer();
        openImageViewer({ src: 'https://local.test/pending.png', sourceEl: source });
        const viewer = document.getElementById('pcImageViewer');
        const img = document.getElementById('pcImageViewerImg');
        expect(source.style.visibility).toBe('');
        expect(viewer?.classList.contains('pc-image-viewer-flipping')).toBe(false);
        expect(img.style.opacity === '' || img.style.opacity === '1').toBe(true);
    });

    it('sourceEl 且图已缓存时执行 FLIP，并恢复源可见性', async () => {
        const source = mountDom();
        mockRect(source, { left: 10, top: 20, width: 100, height: 80 });

        const { openImageViewer } = await loadViewer();
        openImageViewer({ src: 'https://local.test/ready.png', sourceEl: source });

        const img = document.getElementById('pcImageViewerImg');
        // jsdom: mark as loaded
        Object.defineProperty(img, 'complete', { configurable: true, get: () => true });
        Object.defineProperty(img, 'naturalWidth', { configurable: true, get: () => 800 });
        Object.defineProperty(img, 'offsetWidth', { configurable: true, get: () => 400 });
        mockRect(img, { left: 100, top: 50, width: 400, height: 320 });

        // Re-open now that viewer img is "complete"
        const { openImageViewer: open2 } = await import('./pc-image-viewer.js');
        open2({ src: 'https://local.test/ready.png', sourceEl: source });

        const viewer = document.getElementById('pcImageViewer');
        await vi.runAllTimersAsync();
        await Promise.resolve();

        expect(source.style.visibility).toBe('');
        expect(viewer?.classList.contains('pc-image-viewer-flipping')).toBe(false);
        expect(gsapMocks.to).toHaveBeenCalled();
    });

    it('closeImageViewer 会移除 active 并清空导航', async () => {
        mountDom();
        const { openImageViewer, closeImageViewer, isOpen } = await loadViewer();
        openImageViewer({ src: 'https://local.test/a.png' });
        await closeImageViewer();
        expect(isOpen()).toBe(false);
        expect(document.getElementById('pcImageViewerNavIndex')?.textContent).toBe('1 / 1');
    });

    it('reduced-motion 时不走 FLIP 隐藏源图', async () => {
        const source = mountDom();
        window.matchMedia = vi.fn().mockImplementation((query) => ({
            matches: query.includes('prefers-reduced-motion'),
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }));
        const { openImageViewer } = await loadViewer();
        openImageViewer({ src: 'https://local.test/a.png', sourceEl: source });
        await vi.runAllTimersAsync();
        expect(source.style.visibility).toBe('');
        const viewer = document.getElementById('pcImageViewer');
        expect(viewer?.classList.contains('pc-image-viewer-flipping')).toBe(false);
    });
});
