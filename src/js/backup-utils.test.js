import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    buildBackupFilename,
    buildExportSuccessMessage,
    exportBackup,
    getBackupStats,
    saveJsonBackup,
} from './backup-utils.js';

const capacitorMocks = vi.hoisted(() => ({
    writeFile: vi.fn(),
}));

vi.mock('@capacitor/filesystem', () => ({
    Filesystem: {
        writeFile: capacitorMocks.writeFile,
    },
    Directory: {
        Documents: 'DOCUMENTS',
        Data: 'DATA',
    },
    Encoding: {
        UTF8: 'utf8',
    },
}));

const sampleBackup = {
    backup_meta: {
        imageCount: 1,
    },
    folders: [],
    prompt_sets: [{
        id: 'set-1',
        versions: [{
            version: 'v1',
            images: [{ id: 'img-1' }],
        }],
    }],
};

describe('backup-utils', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.useFakeTimers();
        capacitorMocks.writeFile.mockReset();
        delete globalThis.showSaveFilePicker;
        delete globalThis.Capacitor;
        delete window.__TAURI_INTERNALS__;
        delete window.__TAURI__;
        vi.stubGlobal('URL', {
            createObjectURL: vi.fn(() => 'blob:test'),
            revokeObjectURL: vi.fn(),
        });
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('生成带时间戳的备份文件名', () => {
        const date = new Date(2026, 4, 9, 8, 7, 6);
        expect(buildBackupFilename('prompt-backup', date)).toBe('prompt-backup-2026-05-09-080706.json');
    });

    it('统计提示词、版本、图片和文件大小', () => {
        const stats = getBackupStats(sampleBackup);
        expect(stats.promptSetCount).toBe(1);
        expect(stats.versionCount).toBe(1);
        expect(stats.imageCount).toBe(1);
        expect(stats.size).toBeGreaterThan(0);
        expect(stats.sizeLabel).toMatch(/B$/);
    });

    it('支持自定义位置时使用 showSaveFilePicker 保存', async () => {
        const write = vi.fn();
        const close = vi.fn();
        globalThis.showSaveFilePicker = vi.fn(async () => ({
            createWritable: vi.fn(async () => ({ write, close })),
        }));

        const result = await saveJsonBackup(sampleBackup, 'backup.json', { useFilePicker: true });

        expect(result.method).toBe('file-picker');
        expect(globalThis.showSaveFilePicker).toHaveBeenCalledWith(expect.objectContaining({
            suggestedName: 'backup.json',
        }));
        expect(write).toHaveBeenCalled();
        expect(close).toHaveBeenCalled();
    });

    it('普通 Web 环境回退到 a.download', async () => {
        globalThis.showSaveFilePicker = vi.fn();
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

        const result = await saveJsonBackup(sampleBackup, 'backup.json');

        expect(result.method).toBe('download');
        expect(globalThis.showSaveFilePicker).not.toHaveBeenCalled();
        expect(click).toHaveBeenCalled();
        expect(URL.createObjectURL).toHaveBeenCalled();
        expect(URL.revokeObjectURL).not.toHaveBeenCalled();
        vi.advanceTimersByTime(30000);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
    });

    it('Android 原生环境使用 Capacitor Filesystem 写入', async () => {
        globalThis.Capacitor = { isNativePlatform: () => true };
        capacitorMocks.writeFile.mockResolvedValue({ uri: 'file://backup.json' });

        const result = await saveJsonBackup(sampleBackup, 'backup.json');

        expect(result.method).toBe('capacitor');
        expect(capacitorMocks.writeFile).toHaveBeenCalledWith(expect.objectContaining({
            path: 'backups/backup.json',
            data: expect.stringContaining('"backup_meta"'),
            directory: 'DOCUMENTS',
            encoding: 'utf8',
            recursive: true,
        }));
    });

    it('桌面 WebView 优先使用后端兜底保存', async () => {
        window.__TAURI_INTERNALS__ = {};
        const storage = {
            exportData: vi.fn(),
            exportFile: vi.fn(async () => ({
                filename: 'backup.json',
                path: 'D:\\backup.json',
                size: 12,
                imageCount: 1,
                promptSetCount: 1,
                versionCount: 1,
            })),
        };

        const result = await exportBackup(storage, { filename: 'backup.json' });

        expect(result.method).toBe('backend');
        expect(storage.exportFile).toHaveBeenCalledWith('backup.json', expect.objectContaining({
            saveMode: 'downloads',
        }));
        expect(storage.exportData).not.toHaveBeenCalled();
    });

    it('后端兜底不可用时回退到前端下载', async () => {
        window.__TAURI_INTERNALS__ = {};
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const storage = {
            exportData: vi.fn(async () => sampleBackup),
            exportFile: vi.fn(async () => {
                throw new Error('API error 404: File not found');
            }),
        };

        const result = await exportBackup(storage, { filename: 'backup.json' });

        expect(result.method).toBe('download');
        expect(storage.exportFile).toHaveBeenCalledWith('backup.json', expect.objectContaining({
            saveMode: 'downloads',
        }));
        expect(storage.exportData).toHaveBeenCalled();
        expect(click).toHaveBeenCalled();
        vi.advanceTimersByTime(30000);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
    });

    it('自定义位置导出优先使用文件保存选择器', async () => {
        const write = vi.fn();
        const close = vi.fn();
        globalThis.showSaveFilePicker = vi.fn(async () => ({
            createWritable: vi.fn(async () => ({ write, close })),
        }));
        const storage = {
            exportData: vi.fn(async () => sampleBackup),
            exportFile: vi.fn(),
        };

        const result = await exportBackup(storage, { filename: 'backup.json', saveMode: 'custom' });

        expect(result.method).toBe('file-picker');
        expect(result.saveMode).toBe('custom');
        expect(storage.exportData).toHaveBeenCalled();
        expect(storage.exportFile).not.toHaveBeenCalled();
        expect(write).toHaveBeenCalled();
    });

    it('自定义位置导出在无文件选择器时回退到后端选择', async () => {
        const storage = {
            exportData: vi.fn(async () => sampleBackup),
            exportFile: vi.fn(async () => ({
                filename: 'backup.json',
                path: 'D:\\Backups\\backup.json',
                directory: 'D:\\Backups',
                saveMode: 'custom',
                size: 12,
                imageCount: 1,
                promptSetCount: 1,
                versionCount: 1,
            })),
        };

        const result = await exportBackup(storage, { filename: 'backup.json', saveMode: 'custom' });

        expect(result.method).toBe('backend');
        expect(result.saveMode).toBe('custom');
        expect(storage.exportFile).toHaveBeenCalledWith('backup.json', expect.objectContaining({
            saveMode: 'custom',
        }));
    });

    it('导出成功消息包含文件名、大小和图片数量', () => {
        expect(buildExportSuccessMessage({
            method: 'download',
            filename: 'backup.json',
            size: 2048,
            stats: { imageCount: 2, sizeLabel: '2 KB' },
        })).toBe('导出成功：2 张图片，2 KB');

        expect(buildExportSuccessMessage({
            method: 'backend',
            filename: 'backup.json',
            path: 'D:\\backups\\backup.json',
            stats: { imageCount: 2, sizeLabel: '2 KB' },
        })).toContain('backup.json');
    });
});
