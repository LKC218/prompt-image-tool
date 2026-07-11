import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const imageUtilsMocks = vi.hoisted(() => ({
    convertImageBlob: vi.fn(),
}));

vi.mock('./image-utils.js', () => ({
    convertImageBlob: imageUtilsMocks.convertImageBlob,
}));

import {
    buildImageFilename,
    downloadImage,
    inferSourceFileFromUrl,
    replaceImageFilenameExtension,
    sanitizeImageFilename,
} from './image-download-utils.js';
import { clearDownloadHistory, getDownloadHistory } from './download-history.js';

function mockImageResponse(blob) {
    return {
        ok: true,
        status: 200,
        headers: { get: vi.fn().mockReturnValue(blob.type) },
        blob: vi.fn().mockResolvedValue(blob),
    };
}

describe('image-download-utils', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        global.fetch = vi.fn();
        global.URL.createObjectURL = vi.fn(() => 'blob:download');
        global.URL.revokeObjectURL = vi.fn();
        imageUtilsMocks.convertImageBlob.mockResolvedValue(new Blob(['jpg'], { type: 'image/jpeg' }));
        clearDownloadHistory();
    });

    afterEach(() => {
        delete global.showSaveFilePicker;
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('清理非法文件名并保留可用名称', () => {
        expect(sanitizeImageFilename('../坏:名字?.png')).toBe('坏_名字_.png');
    });

    it('根据 MIME 或地址补齐图片扩展名', () => {
        expect(buildImageFilename({ filename: 'preview', contentType: 'image/webp' })).toBe('preview.webp');
        expect(buildImageFilename({ filename: 'preview', url: '/images/a.jpg?x=1' })).toBe('preview.jpg');
        expect(buildImageFilename({ filename: 'preview' })).toBe('preview.png');
    });

    it('导出 JPG 时统一替换文件扩展名', () => {
        expect(replaceImageFilenameExtension('preview.png', '.jpg')).toBe('preview.jpg');
        expect(replaceImageFilenameExtension('preview.webp', 'jpg')).toBe('preview.jpg');
        expect(replaceImageFilenameExtension('preview', '.jpg')).toBe('preview.jpg');
    });

    it('从图片地址推断后端源文件名', () => {
        expect(inferSourceFileFromUrl('/images/test%201.png')).toBe('test 1.png');
        expect(inferSourceFileFromUrl('/api/images/cover.webp?cache=1')).toBe('cover.webp');
    });

    it('支持文件保存选择器下载', async () => {
        const write = vi.fn();
        const close = vi.fn();
        global.showSaveFilePicker = vi.fn(async () => ({
            createWritable: vi.fn(async () => ({ write, close })),
        }));
        const blob = new Blob(['image'], { type: 'image/png' });
        global.fetch = vi.fn().mockResolvedValue(mockImageResponse(blob));

        const result = await downloadImage({
            url: '/images/preview.png',
            filename: 'preview.png',
            preferFilePicker: true,
        });

        expect(result.method).toBe('file-picker');
        expect(global.showSaveFilePicker).toHaveBeenCalledWith(expect.objectContaining({
            suggestedName: 'preview.png',
        }));
        expect(write).toHaveBeenCalledWith(blob);
        expect(close).toHaveBeenCalled();
    });

    it('文件保存选择器取消时不继续回退下载', async () => {
        const error = new DOMException('canceled', 'AbortError');
        global.showSaveFilePicker = vi.fn(async () => { throw error; });
        global.fetch = vi.fn().mockResolvedValue(mockImageResponse(new Blob(['image'], { type: 'image/png' })));

        const result = await downloadImage({
            url: '/images/preview.png',
            filename: 'preview.png',
            preferFilePicker: true,
        });

        expect(result.canceled).toBe(true);
        expect(document.querySelector('a[download]')).toBeNull();
    });

    it('普通下载使用 Blob URL 和 a.download', async () => {
        global.fetch = vi.fn().mockResolvedValue(mockImageResponse(new Blob(['image'], { type: 'image/jpeg' })));

        const result = await downloadImage({
            url: '/images/preview.jpg',
            filename: 'preview',
        });
        const link = document.querySelector('a[download="preview.jpg"]');

        expect(result.method).toBe('download');
        expect(link).toBeTruthy();
        expect(link.href).toBe('blob:download');
    });

    it('JPG 导出会先转码并使用 .jpg 文件名', async () => {
        const sourceBlob = new Blob(['png'], { type: 'image/png' });
        const convertedBlob = new Blob(['jpg'], { type: 'image/jpeg' });
        imageUtilsMocks.convertImageBlob.mockResolvedValue(convertedBlob);
        global.fetch = vi.fn().mockResolvedValue(mockImageResponse(sourceBlob));

        const result = await downloadImage({
            url: '/images/preview.png',
            filename: 'preview.png',
            format: 'jpg',
            jpgQuality: 0.88,
        });
        const link = document.querySelector('a[download="preview.jpg"]');

        expect(result.filename).toBe('preview.jpg');
        expect(imageUtilsMocks.convertImageBlob).toHaveBeenCalledWith(sourceBlob, expect.objectContaining({
            outputType: 'image/jpeg',
            quality: 0.88,
            background: '#FFFFFF',
        }));
        expect(global.URL.createObjectURL).toHaveBeenCalledWith(convertedBlob);
        expect(link).toBeTruthy();
    });

    it('下载成功后写入历史记录', async () => {
        global.fetch = vi.fn().mockResolvedValue(mockImageResponse(new Blob(['image'], { type: 'image/png' })));

        await downloadImage({
            url: '/images/preview.png',
            filename: 'preview.png',
            historyContext: {
                platform: 'pc',
                source: '图片查看器',
                title: '预览图片',
            },
        });

        const history = getDownloadHistory();
        expect(history).toHaveLength(1);
        expect(history[0]).toEqual(expect.objectContaining({
            title: '预览图片',
            filename: 'preview.png',
            platform: 'pc',
            source: '图片查看器',
            status: 'success',
        }));
    });

    it('PC 后端自定义保存优先调用图片保存接口', async () => {
        const storage = {
            downloadImageFile: vi.fn(async () => ({
                success: true,
                filename: 'preview.png',
                path: 'D:\\Images\\preview.png',
            })),
        };

        const result = await downloadImage({
            url: '/images/preview.png',
            filename: 'preview.png',
            storage,
            preferBackend: true,
        });

        expect(result.method).toBe('backend');
        expect(storage.downloadImageFile).toHaveBeenCalledWith('preview.png', expect.objectContaining({
            filename: 'preview.png',
            saveMode: 'custom',
        }));
    });

    it('JPG 导出不走后端原文件保存接口', async () => {
        const storage = {
            downloadImageFile: vi.fn(async () => ({ success: true })),
        };
        global.fetch = vi.fn().mockResolvedValue(mockImageResponse(new Blob(['image'], { type: 'image/png' })));

        const result = await downloadImage({
            url: '/images/preview.png',
            filename: 'preview.png',
            storage,
            preferBackend: true,
            format: 'jpg',
        });

        expect(result.method).toBe('download');
        expect(result.filename).toBe('preview.jpg');
        expect(storage.downloadImageFile).not.toHaveBeenCalled();
    });
});
