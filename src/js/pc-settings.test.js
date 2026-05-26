import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as settingsPage from './pc-settings.js';
import { DOWNLOAD_HISTORY_KEY, clearDownloadHistory } from './download-history.js';

const storageMocks = vi.hoisted(() => ({
    getStorage: vi.fn(),
}));

const pcUtilsMocks = vi.hoisted(() => ({
    showToast: vi.fn(),
    showConfirmModal: vi.fn(),
    copyToClipboard: vi.fn(),
}));

vi.mock('./storage.js', () => ({
    getStorage: storageMocks.getStorage,
    isCapacitor: false,
}));

vi.mock('./pc-app.js', () => ({
    setAccent: vi.fn(),
    navigate: vi.fn(),
}));

vi.mock('./pc-utils.js', () => ({
    showToast: pcUtilsMocks.showToast,
    showConfirmModal: pcUtilsMocks.showConfirmModal,
    escapeHtml: (value = '') => String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;'),
    formatBytes: bytes => `${bytes} B`,
    copyToClipboard: pcUtilsMocks.copyToClipboard,
}));

vi.mock('./backup-utils.js', () => ({
    buildExportSuccessMessage: vi.fn(),
    exportBackup: vi.fn(),
    getErrorMessage: vi.fn(),
}));

vi.mock('./pc-welcome-banner.js', () => ({
    renderPcWelcomeBanner: ({ title = '' }) => `<div class="pc-welcome-banner">${title}</div>`,
    renderPcWelcomeWalkAnimation: () => '<div class="pc-welcome-pixel-stage"></div>',
}));

vi.mock('./pc-icon-assets.js', () => ({
    pcIcon: (name, className = '') => `<span class="${className}" data-icon="${name}"></span>`,
}));

function createStorage() {
    return {
        getPromptSets: vi.fn(async () => [{ id: 'prompt-1' }]),
        estimateStorageSize: vi.fn(async () => 1024),
        getHealth: vi.fn(async () => ({ dataDir: 'C:\\Users\\Tester\\AppData\\Roaming\\PromptImageManager\\data' })),
        getNetworkInfo: vi.fn(async () => ({ ip: '127.0.0.1', port: 8888 })),
        getSyncCapabilities: vi.fn(async () => ({ capabilities: ['pull'] })),
    };
}

async function mountPage() {
    const pageEl = document.createElement('div');
    pageEl.innerHTML = settingsPage.render({});
    document.body.appendChild(pageEl);
    await settingsPage.mount(pageEl, {});
    return pageEl;
}

describe('PC 设置页下载历史', () => {
    beforeEach(() => {
        storageMocks.getStorage.mockReturnValue(createStorage());
        document.body.innerHTML = '<div id="pcApp"></div>';
        localStorage.clear();
        clearDownloadHistory();
    });

    afterEach(() => {
        settingsPage.unmount(document.body);
        vi.clearAllMocks();
    });

    it('显示历史记录并支持清空', async () => {
        localStorage.setItem(DOWNLOAD_HISTORY_KEY, JSON.stringify([{
            id: 'history-1',
            title: '桌面预览图',
            filename: 'preview.png',
            source: '图片查看器',
            platform: 'pc',
            method: 'download',
            locationLabel: '浏览器下载',
            status: 'success',
            createdAt: '2026-05-24T10:00:00.000Z',
        }]));

        const pageEl = await mountPage();

        expect(pageEl.querySelectorAll('[data-settings-action]')).toHaveLength(3);
        expect(pageEl.querySelector('[data-settings-action="import-chatgpt-vault"]').textContent).toContain('导入 ChatGPT 对话');
        expect(pageEl.querySelector('#pcDataDirValue').textContent).toContain('PromptImageManager');

        expect(pageEl.querySelector('#pcDownloadHistoryCount').textContent).toBe('1');
        expect(pageEl.querySelector('#pcDownloadHistoryList').textContent).toContain('桌面预览图');

        pageEl.querySelector('#pcClearDownloadHistory').click();
        expect(pcUtilsMocks.showConfirmModal).toHaveBeenCalledWith(
            '确定要清空所有图片下载记录吗？',
            expect.any(Function)
        );

        pcUtilsMocks.showConfirmModal.mock.calls[0][1]();
        expect(localStorage.getItem(DOWNLOAD_HISTORY_KEY)).toBeNull();
        expect(pageEl.querySelector('#pcDownloadHistoryCount').textContent).toBe('0');
    });
});
