import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkForUpdate } from './auto-updater.js';

// 纯逻辑已在 Python 侧校验；此处覆盖前端请求封装失败路径。

describe('checkForUpdate', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('网络失败时返回 success false 且不抛出', async () => {
        fetch.mockRejectedValue(new Error('network down'));
        const result = await checkForUpdate({ silent: true, localVersion: '2.5.2' });
        expect(result.success).toBe(false);
        expect(result.hasUpdate).toBe(false);
        expect(result.error).toContain('network down');
    });

    it('成功响应时透传 hasUpdate', async () => {
        fetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                success: true,
                hasUpdate: true,
                localVersion: '2.5.2',
                latest: { version: '2.6.0', url: 'https://example.com/a.exe', sha256: 'abc' },
            }),
        });
        const result = await checkForUpdate({ silent: true, localVersion: '2.5.2' });
        expect(result.hasUpdate).toBe(true);
        expect(result.latest.version).toBe('2.6.0');
    });
});
