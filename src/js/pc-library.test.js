import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigateMock = vi.fn();
const getStorageMock = vi.fn();

vi.mock('./pc-app.js', () => ({
    navigate: navigateMock,
}));

vi.mock('./pc-utils.js', () => ({
    showToast: vi.fn(),
    showContextMenu: vi.fn(),
    setContextMenuTargetId: vi.fn(),
    copyToClipboard: vi.fn(),
    showImageViewer: vi.fn(),
    escapeHtml: (value = '') => String(value),
    formatRelativeTime: (value = '') => `relative:${value}`,
    formatDate: (value = '') => `date:${value}`,
}));

vi.mock('./pc-menu-actions.js', () => ({
    getPromptSetMenuItems: vi.fn(() => []),
}));

vi.mock('./pc-welcome-banner.js', () => ({
    renderPcWelcomeBanner: vi.fn(() => '<div class="pc-library-banner"></div>'),
    renderPcWelcomeWalkAnimation: vi.fn(() => ''),
}));

vi.mock('./pc-prompt-ui-utils.js', () => ({
    countPromptSetsByFolder: vi.fn(() => new Map()),
    getPromptFolderId: vi.fn((item) => item?.folderId || item?.folder_id || ''),
}));

vi.mock('./pc-icon-assets.js', () => ({
    pcIcon: vi.fn((name) => `<svg data-icon="${name}"></svg>`),
}));

vi.mock('./storage.js', () => ({
    getStorage: getStorageMock,
}));

function buildItems(total = 25) {
    return Array.from({ length: total }, (_, index) => {
        const id = `prompt-${index + 1}`;
        return {
            id,
            name: `提示词 ${index + 1}`,
            tags: JSON.stringify([index % 2 === 0 ? 'A' : 'B']),
            folderId: 'folder-1',
            createdAt: `2026-05-${String((index % 28) + 1).padStart(2, '0')} 10:00:00`,
            updatedAt: `2026-05-${String((index % 28) + 1).padStart(2, '0')} 12:00:00`,
            isFavorite: index % 3 === 0,
            versionCount: 1,
            imageCount: 0,
            firstImage: null,
            versions: [{
                version: `v${index + 1}`,
                prompt: `Prompt ${index + 1}`,
                createdAt: `2026-05-${String((index % 28) + 1).padStart(2, '0')} 09:00:00`,
            }],
        };
    });
}

function createStorageMock(items) {
    const detailMap = new Map(items.map(item => [item.id, item]));
    return {
        getPromptSets: vi.fn(async () => items.map(item => ({ ...item, versions: undefined }))),
        getFolders: vi.fn(async () => [{ id: 'folder-1', name: '文件夹一' }]),
        getPromptSet: vi.fn(async (id) => detailMap.get(id) || null),
        getImageUrl: vi.fn(async () => ''),
    };
}

function flushFrame() {
    return new Promise((resolve) => {
        if (typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(() => resolve());
        } else {
            setTimeout(resolve, 0);
        }
    });
}

async function mountLibraryPage() {
    const mod = await import('./pc-library.js');
    const pageEl = document.createElement('div');
    pageEl.className = 'pc-page';
    pageEl.innerHTML = mod.render();
    document.getElementById('pcMain').appendChild(pageEl);
    await mod.mount(pageEl, {});
    await flushFrame();
    await flushFrame();
    return { mod, pageEl };
}

describe('pc-library state restore', () => {
    beforeEach(() => {
        vi.resetModules();
        navigateMock.mockClear();
        document.body.innerHTML = '<div class="pc-app"><main class="pc-main" id="pcMain"></main></div>';
        if (!window.requestAnimationFrame) {
            window.requestAnimationFrame = (cb) => setTimeout(cb, 0);
        }
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('保留返回后的页码、选中项和滚动位置', async () => {
        const items = buildItems(25);
        getStorageMock.mockReturnValue(createStorageMock(items));

        let { mod, pageEl } = await mountLibraryPage();

        pageEl.querySelector('[data-page="2"]')?.click();
        await flushFrame();

        const pageMain = document.getElementById('pcMain');
        const tableScroll = pageEl.querySelector('.pc-library-table-scroll');
        pageMain.scrollTop = 180;
        tableScroll.scrollLeft = 84;

        pageEl.querySelector('tr[data-id="prompt-2"]')?.click();
        await flushFrame();

        expect(pageEl.querySelector('.pc-library-page-active')?.textContent).toBe('2');
        expect(pageEl.querySelector('tr.pc-library-row-active')?.dataset.id).toBe('prompt-2');

        mod.unmount(pageEl);
        pageMain.scrollTop = 0;

        pageEl.remove();

        ({ mod, pageEl } = await mountLibraryPage());

        expect(pageEl.querySelector('.pc-library-page-active')?.textContent).toBe('2');
        expect(pageEl.querySelector('tr.pc-library-row-active')?.dataset.id).toBe('prompt-2');
        expect(pageMain.scrollTop).toBe(180);
        expect(pageEl.querySelector('.pc-library-table-scroll').scrollLeft).toBe(84);
    });
});
