import { describe, it, expect, vi, beforeEach } from 'vitest';

const galleryMocks = vi.hoisted(() => ({
    saveImageToGallery: vi.fn(),
}));

vi.mock('./storage.js', () => ({
    isCapacitor: true,
}));

vi.mock('./mobile-gallery.js', () => ({
    saveImageToGallery: galleryMocks.saveImageToGallery,
}));

import { downloadImage } from './image-download-utils.js';
import { clearDownloadHistory, getDownloadHistory } from './download-history.js';

describe('移动端图片下载', () => {
    beforeEach(() => {
        global.fetch = vi.fn();
        clearDownloadHistory();
        galleryMocks.saveImageToGallery.mockReset();
    });

    it('相册保存失败时抛出明确错误且不写入成功历史', async () => {
        const blob = new Blob(['image'], { type: 'image/png' });
        global.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            headers: { get: vi.fn().mockReturnValue('image/png') },
            blob: vi.fn().mockResolvedValue(blob),
        });
        galleryMocks.saveImageToGallery.mockRejectedValue(new Error('存储权限被拒绝'));

        await expect(downloadImage({
            url: '/images/preview.png',
            filename: 'preview.png',
        })).rejects.toThrow('保存到手机相册失败：存储权限被拒绝');

        expect(getDownloadHistory()).toHaveLength(0);
        expect(document.querySelector('a[download]')).toBeNull();
    });
});
