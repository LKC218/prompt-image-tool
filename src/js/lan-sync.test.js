import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LanScanner, LanSync } from './lan-sync.js';

function createResponse(body, ok = true) {
    return {
        ok,
        json: vi.fn().mockResolvedValue(body),
    };
}

describe('LanScanner', () => {
    beforeEach(() => {
        global.fetch = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('优先探测最近设备，并对后续网段结果去重', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('192.168.6.109')) {
                return Promise.resolve(createResponse({ status: 'ok', device_name: '工作台 PC' }));
            }
            if (url.includes('192.168.6.110')) {
                return Promise.resolve(createResponse({ status: 'ok', device_name: '备用 PC' }));
            }
            return Promise.resolve(createResponse({ status: 'offline' }));
        });

        const scanner = new LanScanner();
        scanner.getLocalIP = vi.fn().mockResolvedValue(null);

        const devices = await scanner.scan({
            recentHosts: [{ ip: '192.168.6.109', name: '最近 PC' }],
            subnets: ['192.168.6'],
            rangeStart: 109,
            rangeEnd: 110,
            timeout: 50,
            concurrency: 2,
        });

        expect(devices).toHaveLength(2);
        expect(devices[0]).toMatchObject({ ip: '192.168.6.109', source: 'recent' });
        expect(devices[1]).toMatchObject({ ip: '192.168.6.110', source: 'subnet' });
    });

    it('只把 status 为 ok 的健康检查结果视为可同步 PC', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('192.168.1.2')) {
                return Promise.resolve(createResponse({ status: 'busy', device_name: '异常服务' }));
            }
            if (url.includes('192.168.1.3')) {
                return Promise.resolve(createResponse({ status: 'ok', device_name: '正常 PC' }));
            }
            return Promise.resolve(createResponse({ status: 'ok' }, false));
        });

        const scanner = new LanScanner();
        scanner.getLocalIP = vi.fn().mockResolvedValue(null);

        const devices = await scanner.scan({
            subnets: ['192.168.1'],
            rangeStart: 1,
            rangeEnd: 3,
            timeout: 50,
            concurrency: 3,
        });

        expect(devices).toHaveLength(1);
        expect(devices[0]).toMatchObject({ ip: '192.168.1.3', name: '正常 PC' });
    });

    it('没有传入网段时，优先扫描当前 IP 所在网段', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('192.168.88.5')) {
                return Promise.resolve(createResponse({ status: 'ok', device_name: '当前网段 PC' }));
            }
            return Promise.resolve(createResponse({ status: 'offline' }));
        });

        const scanner = new LanScanner();
        scanner.getLocalIP = vi.fn().mockResolvedValue('192.168.88.23');

        const devices = await scanner.scan({
            rangeStart: 5,
            rangeEnd: 5,
            timeout: 50,
        });

        expect(devices).toHaveLength(1);
        expect(global.fetch).toHaveBeenCalledWith(
            'http://192.168.88.5:8888/api/health',
            expect.any(Object)
        );
    });

    it('搜索过程中持续发出进度回调', async () => {
        global.fetch.mockResolvedValue(createResponse({ status: 'offline' }));
        const onProgress = vi.fn();
        const scanner = new LanScanner();
        scanner.getLocalIP = vi.fn().mockResolvedValue(null);

        await scanner.scan({
            subnets: ['192.168.1'],
            rangeStart: 1,
            rangeEnd: 2,
            timeout: 50,
            concurrency: 1,
            onProgress,
        });

        expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ phase: 'detect' }));
        expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ phase: 'subnet' }));
        expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ phase: 'done' }));
    });
});

describe('LanSync 回传', () => {
    beforeEach(() => {
        global.fetch = vi.fn();
        localStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('回传 Android 数据时携带配对令牌和设备信息', async () => {
        const storage = {
            exportData: vi.fn().mockResolvedValue({ folders: [], prompt_sets: [] }),
        };
        global.fetch.mockImplementation((url, options = {}) => {
            if (url.includes('/api/sync/pairing')) {
                return Promise.resolve(createResponse({ success: true, sync_token: 'token-123' }));
            }
            if (url.includes('/api/sync/import')) {
                expect(options.method).toBe('POST');
                expect(options.headers['X-Sync-Token']).toBe('token-123');
                expect(options.headers['X-Device-Id']).toMatch(/^android-/);
                return Promise.resolve(createResponse({
                    success: true,
                    added: 1,
                    updated: 0,
                    conflicts: 0,
                    skipped: 0,
                    imagesRestored: 0,
                }));
            }
            return Promise.reject(new Error(`unexpected url: ${url}`));
        });

        const sync = new LanSync(storage);
        const report = await sync.push('192.168.6.109');

        expect(report).toMatchObject({ success: true, added: 1, token: 'token-123' });
        expect(storage.exportData).toHaveBeenCalled();
    });
});
