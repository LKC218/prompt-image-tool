import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as homePage from './mobile-home.js';
import * as libraryPage from './mobile-library.js';
import * as detailPage from './mobile-detail.js';
import * as editorPage from './mobile-editor.js';
import * as categoryPage from './mobile-category.js';
import * as settingsPage from './mobile-settings.js';
import { DOWNLOAD_HISTORY_KEY, clearDownloadHistory } from './download-history.js';

const storageMocks = vi.hoisted(() => ({
    getStorage: vi.fn(),
}));

const mobileUtilsMocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    goBack: vi.fn(),
    showMobileToast: vi.fn(),
    showActionSheet: vi.fn(),
    initMobileUtils: vi.fn(),
}));

const routerMocks = vi.hoisted(() => ({
    getCurrentRoute: vi.fn(() => ({ path: '/', search: '' })),
}));

const imageDownloadMocks = vi.hoisted(() => ({
    downloadImage: vi.fn(async () => ({ success: true, method: 'download' })),
}));

vi.mock('./storage.js', () => ({
    getStorage: storageMocks.getStorage,
    initStorage: vi.fn(),
    isCapacitor: false,
    isTauri: false,
}));

vi.mock('./mobile-utils.js', () => ({
    navigate: mobileUtilsMocks.navigate,
    goBack: mobileUtilsMocks.goBack,
    showMobileToast: mobileUtilsMocks.showMobileToast,
    showActionSheet: mobileUtilsMocks.showActionSheet,
    initMobileUtils: mobileUtilsMocks.initMobileUtils,
    iconImg: (src, alt = '') => `<img src="${src}" alt="${alt}" class="m-icon-img">`,
}));

vi.mock('./mobile-router.js', () => ({
    getCurrentRoute: routerMocks.getCurrentRoute,
}));

vi.mock('./image-download-utils.js', () => ({
    downloadImage: imageDownloadMocks.downloadImage,
}));

const folders = [
    { id: 'folder-1', name: '插画', color: '#2580D6', sortOrder: 0 },
    { id: 'folder-2', name: '写实', color: '#C4A030', sortOrder: 1 },
];

const promptSets = [
    {
        id: 'prompt-1',
        name: '移动端回归提示词',
        folderId: 'folder-1',
        tags: JSON.stringify(['插画', '回归']),
        isFavorite: true,
        updatedAt: '2026-05-15T10:00:00.000Z',
        createdAt: '2026-05-15T09:00:00.000Z',
        versionCount: 1,
        imageCount: 0,
        versions: [{
            id: 'version-1',
            version: 'v1',
            prompt: 'positive prompt',
            negativePrompt: 'negative prompt',
            aspectRatio: '16:9',
            note: 'smoke',
            images: [{
                id: 'image-1',
                name: 'preview.png',
                file: 'preview.png',
                note: '预览图',
            }],
            createdAt: '2026-05-15T09:00:00.000Z',
        }],
    },
    {
        id: 'prompt-2',
        name: '未收藏提示词',
        folderId: 'folder-2',
        tags: JSON.stringify(['写实']),
        isFavorite: false,
        updatedAt: '2026-05-14T10:00:00.000Z',
        createdAt: '2026-05-14T09:00:00.000Z',
        versionCount: 1,
        imageCount: 0,
        versions: [{
            id: 'version-2',
            version: 'v1',
            prompt: 'second prompt',
            negativePrompt: '',
            aspectRatio: '1:1',
            images: [],
            createdAt: '2026-05-14T09:00:00.000Z',
        }],
    },
];

function createStorage() {
    const state = {
        promptSets: structuredClone(promptSets),
        folders: structuredClone(folders),
    };

    return {
        getPromptSets: vi.fn(async () => state.promptSets),
        getFolders: vi.fn(async () => state.folders),
        getPromptSet: vi.fn(async (id) => state.promptSets.find(item => item.id === id) || null),
        getImageUrl: vi.fn(async () => 'data:image/png;base64,ZmFrZQ=='),
        toggleFavorite: vi.fn(async (id) => {
            const item = state.promptSets.find(prompt => prompt.id === id);
            item.isFavorite = !item.isFavorite;
            return { isFavorite: item.isFavorite };
        }),
        createPromptSet: vi.fn(async (name, folderId, tags) => {
            const created = {
                id: 'prompt-new',
                name,
                folderId,
                tags,
                versions: [{ id: 'version-new', prompt: '', negativePrompt: '', images: [] }],
                isFavorite: false,
                updatedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
            };
            state.promptSets.push(created);
            return { id: created.id, versions: created.versions };
        }),
        updatePromptSet: vi.fn(async (id, patch) => {
            const item = state.promptSets.find(prompt => prompt.id === id);
            if (item) Object.assign(item, patch);
            return item;
        }),
        deletePromptSet: vi.fn(async (id) => {
            state.promptSets = state.promptSets.filter(prompt => prompt.id !== id);
        }),
        createFolder: vi.fn(async (name, color) => {
            state.folders.push({ id: 'folder-new', name, color });
        }),
        updateFolder: vi.fn(async (id, patch) => {
            const folder = state.folders.find(item => item.id === id);
            if (folder) Object.assign(folder, patch);
        }),
        deleteFolder: vi.fn(async (id) => {
            state.folders = state.folders.filter(folder => folder.id !== id);
        }),
        uploadImage: vi.fn(async (id, data, name) => ({ file: `${id}-${name}` })),
        exportData: vi.fn(async () => ({ folders: state.folders, prompt_sets: state.promptSets })),
        importData: vi.fn(async () => ({ added: 1, updated: 0, imagesRestored: 0 })),
    };
}

async function mountPage(pageModule, params = {}) {
    const pageEl = document.createElement('div');
    pageEl.innerHTML = pageModule.render(params);
    document.body.appendChild(pageEl);
    await pageModule.mount(pageEl, params);
    return pageEl;
}

function click(selector, root = document) {
    const el = root.querySelector(selector);
    expect(el).toBeTruthy();
    el.click();
    return el;
}

async function flush() {
    await new Promise(resolve => setTimeout(resolve, 0));
}

describe('移动端页面全功能回归冒烟', () => {
    let storage;

    beforeEach(() => {
        storage = createStorage();
        storageMocks.getStorage.mockReturnValue(storage);
        routerMocks.getCurrentRoute.mockReturnValue({ path: '/', search: '' });
        document.body.innerHTML = '<div id="mobileApp"></div>';
        localStorage.clear();
        clearDownloadHistory();
        vi.restoreAllMocks();
        vi.clearAllMocks();
        imageDownloadMocks.downloadImage.mockResolvedValue({ success: true, method: 'download' });
        storageMocks.getStorage.mockReturnValue(storage);
        vi.stubGlobal('fetch', vi.fn());
        vi.stubGlobal('URL', {
            createObjectURL: vi.fn(() => 'blob:mobile-regression'),
            revokeObjectURL: vi.fn(),
        });
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        Object.assign(navigator, {
            clipboard: { writeText: vi.fn(async () => {}) },
            storage: { estimate: vi.fn(async () => ({ usage: 1024, quota: 4096 })) },
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('首页展示统计、最近提示词、收藏分类并支持快捷入口', async () => {
        const pageEl = await mountPage(homePage);

        expect(pageEl.querySelector('#mStatTotal').textContent).toBe('2');
        expect(pageEl.querySelector('#mStatCategories').textContent).toBe('2');
        expect(pageEl.querySelector('#mStatFavorites').textContent).toBe('1');
        expect(pageEl.querySelectorAll('.m-prompt-card')).toHaveLength(2);
        expect(pageEl.querySelectorAll('.m-category-card')).toHaveLength(2);

        click('#mViewAllBtn', pageEl);
        expect(mobileUtilsMocks.navigate).toHaveBeenCalledWith('/library');

        click('#mQuickCreate', pageEl);
        expect(mobileUtilsMocks.navigate).toHaveBeenCalledWith('/editor/');

        click('.m-star-btn[data-id="prompt-1"]', pageEl);
        await flush();
        expect(storage.toggleFavorite).toHaveBeenCalledWith('prompt-1');
    });

    it('提示词库支持筛选、搜索、详情跳转、收藏和导出入口', async () => {
        const pageEl = await mountPage(libraryPage);

        expect(pageEl.querySelectorAll('.m-prompt-list-card')).toHaveLength(2);
        click('[data-filter="favorite"]', pageEl);
        expect(pageEl.querySelectorAll('.m-prompt-list-card')).toHaveLength(1);

        click('#mLibSearchBtn', pageEl);
        const input = pageEl.querySelector('#mLibSearchInput');
        input.value = '不存在';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        expect(pageEl.querySelector('.m-empty-text').textContent).toContain('未找到');

        input.value = '移动端';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        expect(pageEl.querySelectorAll('.m-prompt-list-card')).toHaveLength(1);

        click('.m-prompt-list-card', pageEl);
        expect(mobileUtilsMocks.navigate).toHaveBeenCalledWith('/detail/prompt-1');

        click('#mLibMoreBtn', pageEl);
        expect(mobileUtilsMocks.showActionSheet).toHaveBeenCalledWith(
            expect.arrayContaining([expect.objectContaining({ action: 'export' })])
        );
    });

    it('详情页支持收藏、复制、编辑入口和提示词全文弹层', async () => {
        routerMocks.getCurrentRoute.mockReturnValue({ path: '/detail/prompt-1', search: '' });
        const pageEl = await mountPage(detailPage, { id: 'prompt-1' });

        expect(pageEl.querySelector('#mDetailTitle').textContent).toBe('移动端回归提示词');
        expect(pageEl.querySelector('#mPositiveText').textContent).toContain('positive prompt');

        click('#mDetailStar', pageEl);
        await flush();
        expect(storage.toggleFavorite).toHaveBeenCalledWith('prompt-1');

        click('#mDetailCopy', pageEl);
        await flush();
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('positive prompt'));

        click('#mDetailEdit', pageEl);
        expect(mobileUtilsMocks.navigate).toHaveBeenCalledWith('/editor/prompt-1');

        click('#mDetailPositive', pageEl);
        expect(document.querySelector('.m-prompt-detail-overlay')).toBeTruthy();
    });

    it('详情页图片预览在返回和卸载时自动清理全局遮罩', async () => {
        routerMocks.getCurrentRoute.mockReturnValue({ path: '/detail/prompt-1', search: '' });
        const pageEl = await mountPage(detailPage, { id: 'prompt-1' });

        click('#mCoverImage', pageEl);
        expect(document.querySelector('.m-image-viewer-overlay')).toBeTruthy();

        click('#mDetailBack', pageEl);
        expect(mobileUtilsMocks.goBack).toHaveBeenCalled();
        expect(document.querySelector('.m-image-viewer-overlay')).toBeNull();

        click('#mCoverImage', pageEl);
        expect(document.querySelector('.m-image-viewer-overlay')).toBeTruthy();
        detailPage.unmount(pageEl);
        expect(document.querySelector('.m-image-viewer-overlay')).toBeNull();
    });

    it('详情页图片预览提供当前图片下载按钮', async () => {
        routerMocks.getCurrentRoute.mockReturnValue({ path: '/detail/prompt-1', search: '' });
        const pageEl = await mountPage(detailPage, { id: 'prompt-1' });

        click('#mCoverImage', pageEl);
        const downloadBtn = document.querySelector('#mViewerDownload');
        expect(downloadBtn).toBeTruthy();

        downloadBtn.click();
        await flush();

        expect(imageDownloadMocks.downloadImage).toHaveBeenCalledWith(expect.objectContaining({
            url: 'data:image/png;base64,ZmFrZQ==',
            filename: 'preview.png',
            sourceFile: 'preview.png',
        }));
        expect(mobileUtilsMocks.showMobileToast).toHaveBeenCalledWith('图片下载已完成');
    });

    it('编辑页支持校验、预览、比例选择和新建保存', async () => {
        routerMocks.getCurrentRoute.mockReturnValue({ path: '/editor/', search: '' });
        const pageEl = await mountPage(editorPage);

        click('#mEditorSave', pageEl);
        expect(pageEl.querySelector('#mNameError').style.display).toBe('block');
        expect(pageEl.querySelector('#mPositiveError').style.display).toBe('block');

        pageEl.querySelector('#mEditorName').value = '移动端新增提示词';
        pageEl.querySelector('#mEditorName').dispatchEvent(new Event('input', { bubbles: true }));
        pageEl.querySelector('#mEditorPositive').value = 'new positive';
        pageEl.querySelector('#mEditorPositive').dispatchEvent(new Event('input', { bubbles: true }));
        click('[data-ratio="16:9"]', pageEl);
        expect(pageEl.querySelector('[data-ratio="16:9"]').classList.contains('m-ratio-active')).toBe(true);

        click('#mPreviewPositive', pageEl);
        expect(pageEl.querySelector('#mPreviewOverlay').classList.contains('m-preview-show')).toBe(true);

        click('#mEditorSave', pageEl);
        await flush();
        expect(storage.createPromptSet).toHaveBeenCalledWith('移动端新增提示词', null, '[]');
        expect(storage.updatePromptSet).toHaveBeenCalledWith(
            'prompt-new',
            expect.objectContaining({
                versions: [expect.objectContaining({ prompt: 'new positive', aspectRatio: '16:9' })],
            })
        );
        expect(mobileUtilsMocks.goBack).toHaveBeenCalled();
    });

    it('分类与标签页支持分段切换、新建分类和快速操作入口', async () => {
        const pageEl = await mountPage(categoryPage);

        expect(pageEl.querySelectorAll('.m-category-list-item')).toHaveLength(2);
        click('[data-segment="tag"]', pageEl);
        expect(pageEl.querySelector('#mTagView').style.display).toBe('');
        expect(pageEl.querySelectorAll('.m-tag-manageable').length).toBeGreaterThan(0);

        click('#mCreateFolderBtn', pageEl);
        const nameInput = pageEl.querySelector('#mFolderNameInput');
        nameInput.value = '新分类';
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
        click('#mFolderDialogOk', pageEl);
        await flush();
        expect(storage.createFolder).toHaveBeenCalledWith('新分类', expect.any(String));

        click('#mSortBtn', pageEl);
        expect(mobileUtilsMocks.showMobileToast).toHaveBeenCalledWith('拖拽分类右侧手柄即可调整顺序');
    });

    it('设置页支持主题色、导入导出入口、局域网连接测试和同步模式切换', async () => {
        localStorage.setItem(DOWNLOAD_HISTORY_KEY, JSON.stringify([{
            id: 'history-1',
            title: '移动端预览图',
            filename: 'preview.png',
            source: '图片查看器',
            platform: 'mobile',
            method: 'native-gallery',
            locationLabel: '手机相册',
            status: 'success',
            createdAt: '2026-05-24T10:00:00.000Z',
        }]));
        global.fetch.mockResolvedValue({
            ok: true,
            json: vi.fn(async () => ({
                status: 'ok',
                port: 8890,
                device_name: '测试 PC',
                capabilities: ['pull', 'push', 'bidirectional'],
                pairing_required: false,
            })),
        });
        const pageEl = await mountPage(settingsPage);
        await flush();

        expect(pageEl.querySelector('#mDownloadHistoryCount').textContent).toBe('1 条');
        expect(pageEl.querySelector('#mDownloadHistoryList').textContent).toContain('移动端预览图');
        expect(pageEl.querySelector('#mClearDownloadHistory').disabled).toBe(false);

        click('#mClearDownloadHistory', pageEl);
        expect(mobileUtilsMocks.showActionSheet).toHaveBeenCalledWith(
            expect.arrayContaining([expect.objectContaining({ action: 'confirm' })])
        );
        mobileUtilsMocks.showActionSheet.mock.calls[0][0][0].handler();
        expect(localStorage.getItem(DOWNLOAD_HISTORY_KEY)).toBeNull();
        expect(pageEl.querySelector('#mDownloadHistoryCount').textContent).toBe('0 条');
        expect(pageEl.querySelector('#mClearDownloadHistory').disabled).toBe(true);

        click('[data-color-idx="2"]', pageEl);
        expect(localStorage.getItem('accent')).toBe('blue');

        click('#mLocalBackup', pageEl);
        await flush();
        expect(storage.exportData).toHaveBeenCalled();

        click('#mImportData', pageEl);
        expect(mobileUtilsMocks.showActionSheet).toHaveBeenCalledWith(
            expect.arrayContaining([expect.objectContaining({ action: 'confirm' })])
        );

        click('[data-lan-mode="bidirectional"]', pageEl);
        expect(localStorage.getItem('lan-sync-mode')).toBe('bidirectional');
        expect(pageEl.querySelector('#mStartLanSyncBtn').textContent).toBe('双向');

        pageEl.querySelector('#mLanIpInput').value = '192.168.6.109:8890';
        click('#mTestLanBtn', pageEl);
        await flush();
        expect(global.fetch).toHaveBeenCalledWith('http://192.168.6.109:8890/api/health');
        expect(pageEl.querySelector('#mLanSyncStatus').textContent).toContain('连接成功');
    });
});
