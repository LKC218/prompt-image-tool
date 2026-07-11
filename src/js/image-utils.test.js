import { describe, expect, it } from 'vitest';
import {
    convertImageBlob,
    estimateDataUrlSize,
    getDataUrlMimeType,
    getImageExtensionByMime,
    normalizeImageOutputType,
    optimizeImageDataUrl
} from './image-utils.js';

function mockCanvasPipeline({ blobType = 'image/webp', blobContent = 'x' } = {}) {
    const ctx = {
        drawImage: vi.fn(),
        fillRect: vi.fn(),
        fillStyle: '',
    };
    const toBlob = vi.fn((callback, type) => {
        callback(new Blob([blobContent], { type: type || blobType }));
    });
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
        if (String(tagName).toLowerCase() !== 'canvas') {
            return originalCreateElement(tagName, options);
        }
        return {
            width: 0,
            height: 0,
            getContext: vi.fn(() => ctx),
            toBlob,
        };
    });

    class MockImage {
        constructor() {
            this.naturalWidth = 16;
            this.naturalHeight = 8;
            this.width = 16;
            this.height = 8;
            this.onload = null;
            this.onerror = null;
        }

        set src(value) {
            this._src = value;
            queueMicrotask(() => this.onload?.());
        }

        get src() {
            return this._src;
        }
    }

    vi.stubGlobal('Image', MockImage);
    URL.createObjectURL = vi.fn(() => 'blob:test-image');
    URL.revokeObjectURL = vi.fn();

    return { ctx, toBlob, createElementSpy };
}

describe('image-utils', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('estimates base64 data url byte size with padding', () => {
        expect(estimateDataUrlSize('data:image/png;base64,YQ==')).toBe(1);
        expect(estimateDataUrlSize('data:image/png;base64,YWI=')).toBe(2);
        expect(estimateDataUrlSize('data:image/png;base64,YWJj')).toBe(3);
    });

    it('reads mime type from data url and falls back to png', () => {
        expect(getDataUrlMimeType('data:image/webp;base64,abc')).toBe('image/webp');
        expect(getDataUrlMimeType('data:image/JPEG;base64,abc')).toBe('image/jpeg');
        expect(getDataUrlMimeType('invalid')).toBe('image/png');
    });

    it('maps supported image mime types to storage extensions', () => {
        expect(getImageExtensionByMime('image/jpeg')).toBe('jpg');
        expect(getImageExtensionByMime('image/jpg')).toBe('jpg');
        expect(getImageExtensionByMime('image/webp')).toBe('webp');
        expect(getImageExtensionByMime('image/gif')).toBe('gif');
        expect(getImageExtensionByMime('image/png')).toBe('png');
    });

    it('规范化图片输出 MIME 类型', () => {
        expect(normalizeImageOutputType('image/jpg')).toBe('image/jpeg');
        expect(normalizeImageOutputType('image/webp')).toBe('image/webp');
        expect(normalizeImageOutputType('text/plain')).toBe('image/jpeg');
    });

    it('按 WebP 输出优化后的 Data URL', async () => {
        const { toBlob } = mockCanvasPipeline({ blobType: 'image/webp' });

        const result = await optimizeImageDataUrl('data:image/png;base64,QUJDRA==', {
            outputType: 'image/webp',
            quality: 0.86,
        });

        expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/webp', 0.86);
        expect(result.mimeType).toBe('image/webp');
        expect(result.extension).toBe('webp');
        expect(result.usedOriginal).toBe(false);
    });

    it('转换 JPG Blob 前填充指定背景色', async () => {
        const { ctx, toBlob } = mockCanvasPipeline({ blobType: 'image/jpeg' });
        const input = new Blob(['png-data'], { type: 'image/png' });

        const result = await convertImageBlob(input, {
            outputType: 'image/jpeg',
            quality: 0.92,
            background: '#FFFFFF',
        });

        expect(ctx.fillStyle).toBe('#FFFFFF');
        expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 16, 8);
        expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.92);
        expect(result.type).toBe('image/jpeg');
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-image');
    });
});
