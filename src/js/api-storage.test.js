import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiStorage } from './api-storage.js';

function mockResponse(data, ok = true, status = 200) {
    return {
        ok,
        status,
        json: vi.fn().mockResolvedValue(data),
        text: vi.fn().mockResolvedValue(JSON.stringify(data)),
    };
}

describe('ApiStorage', () => {
    let storage;

    beforeEach(() => {
        storage = new ApiStorage();
        global.fetch = vi.fn().mockResolvedValue(mockResponse({ status: 'ok' }));
    });

    describe('init', () => {
        it('should resolve without error when backend is ready', async () => {
            global.fetch = vi.fn().mockResolvedValue(mockResponse({ status: 'ok' }));
            await storage.init();
            expect(storage._backendReady).toBe(true);
        });

        it('should retry when backend is not ready initially', async () => {
            let callCount = 0;
            global.fetch = vi.fn().mockImplementation(() => {
                callCount++;
                if (callCount <= 2) return Promise.reject(new Error('Network error'));
                return Promise.resolve(mockResponse({ status: 'ok' }));
            });
            await storage.init();
            expect(storage._backendReady).toBe(true);
        });
    });

    describe('getPlatform', () => {
        it('should return pc', () => {
            expect(storage.getPlatform()).toBe('pc');
        });
    });

    describe('getImageUrl', () => {
        it('should return file URL when img has file property', async () => {
            const img = { file: 'test.png' };
            expect(await storage.getImageUrl(img)).toBe('/images/test.png');
        });

        it('should return data URL when img has data property', async () => {
            const img = { data: 'data:image/png;base64,abc' };
            expect(await storage.getImageUrl(img)).toBe('data:image/png;base64,abc');
        });

        it('should prefer file over data', async () => {
            const img = { file: 'test.png', data: 'data:image/png;base64,abc' };
            expect(await storage.getImageUrl(img)).toBe('/images/test.png');
        });

        it('should return empty string when no file or data', async () => {
            const img = {};
            expect(await storage.getImageUrl(img)).toBe('');
        });
    });

    describe('api method', () => {
        it('should call fetch with correct parameters for GET', async () => {
            const mockFetch = vi.fn().mockResolvedValue(mockResponse({ data: 'test' }));
            global.fetch = mockFetch;

            await storage.api('GET', '/prompt-sets');

            expect(mockFetch).toHaveBeenCalledWith('/api/prompt-sets', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });
        });

        it('should call fetch with body for POST', async () => {
            const mockFetch = vi.fn().mockResolvedValue(mockResponse({ success: true }));
            global.fetch = mockFetch;

            await storage.api('POST', '/prompt-sets', { name: 'test' });

            expect(mockFetch).toHaveBeenCalledWith('/api/prompt-sets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'test' }),
            });
        });

        it('should not include body when body is null', async () => {
            const mockFetch = vi.fn().mockResolvedValue(mockResponse({}));
            global.fetch = mockFetch;

            await storage.api('GET', '/export', null);

            const callArgs = mockFetch.mock.calls[0][1];
            expect(callArgs.body).toBeUndefined();
        });

        it('should throw on non-ok response', async () => {
            const mockFetch = vi.fn().mockResolvedValue(mockResponse({ error: 'not found' }, false, 404));
            global.fetch = mockFetch;

            await expect(storage.api('GET', '/prompt-set/missing')).rejects.toThrow('API error 404');
        });
    });

    describe('CRUD methods', () => {
        let mockFetch;

        beforeEach(() => {
            mockFetch = vi.fn().mockResolvedValue(mockResponse({ success: true }));
            global.fetch = mockFetch;
        });

        it('getPromptSets should call GET /api/prompt-sets', async () => {
            await storage.getPromptSets();
            expect(mockFetch).toHaveBeenCalledWith('/api/prompt-sets', expect.objectContaining({
                method: 'GET',
            }));
        });

        it('getPromptSet should call GET /api/prompt-set/{id}', async () => {
            await storage.getPromptSet('abc123');
            expect(mockFetch).toHaveBeenCalledWith('/api/prompt-set/abc123', expect.objectContaining({
                method: 'GET',
            }));
        });

        it('createPromptSet should call POST /api/prompt-sets', async () => {
            await storage.createPromptSet('test set');
            expect(mockFetch).toHaveBeenCalledWith('/api/prompt-sets', expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ name: 'test set', folderId: null, tags: '[]' }),
            }));
        });

        it('updatePromptSet should call POST /api/prompt-set/{id}', async () => {
            await storage.updatePromptSet('abc123', { name: 'updated' });
            expect(mockFetch).toHaveBeenCalledWith('/api/prompt-set/abc123', expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ name: 'updated' }),
            }));
        });

        it('deletePromptSet should call DELETE /api/prompt-set/{id}', async () => {
            await storage.deletePromptSet('abc123');
            expect(mockFetch).toHaveBeenCalledWith('/api/prompt-set/abc123', expect.objectContaining({
                method: 'DELETE',
            }));
        });

        it('addVersion should call POST /api/prompt-set/{id}/version', async () => {
            await storage.addVersion('abc123', { prompt: 'test' });
            expect(mockFetch).toHaveBeenCalledWith('/api/prompt-set/abc123/version', expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ prompt: 'test' }),
            }));
        });

        it('deleteVersion should call POST with versionIndex', async () => {
            await storage.deleteVersion('abc123', 2);
            expect(mockFetch).toHaveBeenCalledWith('/api/prompt-set/abc123/delete-version', expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ versionIndex: 2 }),
            }));
        });

        it('renameVersion should call POST with versionIndex and version', async () => {
            await storage.renameVersion('abc123', 0, 'v2-new');
            expect(mockFetch).toHaveBeenCalledWith('/api/prompt-set/abc123/rename-version', expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ versionIndex: 0, version: 'v2-new' }),
            }));
        });

        it('duplicateVersion should call POST with versionIndex', async () => {
            await storage.duplicateVersion('abc123', 1);
            expect(mockFetch).toHaveBeenCalledWith('/api/prompt-set/abc123/duplicate-version', expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ versionIndex: 1 }),
            }));
        });

        it('uploadImage should call POST /api/image/{id}', async () => {
            await storage.uploadImage('img1', 'data:image/png;base64,abc', 'test.png');
            expect(mockFetch).toHaveBeenCalledWith('/api/image/img1', expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ data: 'data:image/png;base64,abc', name: 'test.png' }),
            }));
        });

        it('deleteImage should call DELETE /api/image/{filename}', async () => {
            await storage.deleteImage('test.png');
            expect(mockFetch).toHaveBeenCalledWith('/api/image/test.png', expect.objectContaining({
                method: 'DELETE',
            }));
        });

        it('exportData should call GET /api/export', async () => {
            await storage.exportData();
            expect(mockFetch).toHaveBeenCalledWith('/api/export', expect.objectContaining({
                method: 'GET',
            }));
        });

        it('importData should call POST /api/import', async () => {
            const data = [{ id: '1', versions: [] }];
            await storage.importData(data);
            expect(mockFetch).toHaveBeenCalledWith('/api/import', expect.objectContaining({
                method: 'POST',
                body: JSON.stringify(data),
            }));
        });
    });
});
