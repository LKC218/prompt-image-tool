import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    buildGoalCoverFileName,
    optimizeGoalCoverDataUrl,
    resolveGoalCoverExtension,
    importGoalProjectCover,
    GOAL_COVER_OPTIMIZE_OPTIONS,
    GOAL_COVER_ALLOWED_TYPES,
    GOAL_COVER_MAX_SOURCE_BYTES
} from './goal-utils.js';

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
            this.naturalWidth = 3200;
            this.naturalHeight = 1800;
            this.width = 3200;
            this.height = 1800;
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

describe('goal cover optimize', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        vi.resetModules();
    });

    it('exports cover defaults aligned with task-image webp strategy', () => {
        expect(GOAL_COVER_OPTIMIZE_OPTIONS).toMatchObject({
            quality: 0.85,
            maxSide: 1600,
            outputType: 'image/webp',
        });
        expect(GOAL_COVER_ALLOWED_TYPES).toEqual(['image/jpeg', 'image/png', 'image/webp']);
        expect(GOAL_COVER_MAX_SOURCE_BYTES).toBe(15 * 1024 * 1024);
    });

    it('optimizeGoalCoverDataUrl re-encodes via canvas webp', async () => {
        const { toBlob } = mockCanvasPipeline({ blobType: 'image/webp' });

        const result = await optimizeGoalCoverDataUrl('data:image/png;base64,QUJDRA==');

        expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/webp', 0.85);
        expect(result.mimeType).toBe('image/webp');
        expect(result.extension).toBe('webp');
        expect(result.usedOriginal).toBe(false);
        expect(result.resized).toBe(true);
        expect(result.width).toBe(1600);
        expect(result.height).toBe(900);
    });

    it('optimizeGoalCoverDataUrl falls back to original data url on optimize failure', async () => {
        class BrokenImage {
            constructor() {
                this.onload = null;
                this.onerror = null;
            }

            set src(_) {
                queueMicrotask(() => this.onerror?.(new Error('decode failed')));
            }
        }

        vi.stubGlobal('Image', BrokenImage);
        const input = 'data:image/png;base64,QUJDRA==';
        const result = await optimizeGoalCoverDataUrl(input);

        expect(result.usedOriginal).toBe(true);
        expect(result.dataUrl).toBe(input);
        expect(result.extension).toBe('png');
    });

    it('buildGoalCoverFileName rewrites extension to match actual content', () => {
        expect(buildGoalCoverFileName('id1', 'photo.png', 'webp')).toBe('id1-photo.webp');
        expect(buildGoalCoverFileName('id1', 'C:\\tmp\\a.jpg', 'webp')).toBe('id1-a.webp');
        expect(buildGoalCoverFileName('id1', '', 'webp')).toBe('id1.webp');
        expect(resolveGoalCoverExtension({ usedOriginal: false, extension: 'webp' }, 'data:image/png;base64,x')).toBe('webp');
        expect(resolveGoalCoverExtension({ usedOriginal: true }, 'data:image/jpeg;base64,x')).toBe('jpg');
    });

    it('importGoalProjectCover uploads optimized webp data url and webp filename contract', async () => {
        const { toBlob } = mockCanvasPipeline({ blobType: 'image/webp', blobContent: 'webp-bytes' });
        const storage = {
            uploadGoalImage: vi.fn(async (projectId, imageId, dataUrl) => ({
                path: `goal_images/${projectId}/${imageId}-cover.webp`,
                dataUrl
            }))
        };
        const originalDataUrl = 'data:image/png;base64,QUJDRA==';

        const path = await importGoalProjectCover(storage, 'proj1', originalDataUrl, 'cover.png');

        expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/webp', 0.85);
        expect(storage.uploadGoalImage).toHaveBeenCalledTimes(1);
        const [projectId, imageId, uploadedDataUrl] = storage.uploadGoalImage.mock.calls[0];
        expect(projectId).toBe('proj1');
        expect(String(imageId)).toBeTruthy();
        expect(String(uploadedDataUrl)).toMatch(/^data:image\/webp/);
        expect(String(uploadedDataUrl)).not.toBe(originalDataUrl);
        expect(String(path)).toContain('goal_images/proj1/');
        expect(String(path)).toMatch(/\.webp$/);
    });
});
