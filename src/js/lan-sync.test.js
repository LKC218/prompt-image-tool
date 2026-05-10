import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatLanAddress, LanScanner, LanSync, parseLanTarget } from './lan-sync.js';

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
            ports: [8888],
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
            ports: [8888],
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
            ports: [8888],
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
            ports: [8888],
            timeout: 50,
            concurrency: 1,
            onProgress,
        });

        expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ phase: 'detect' }));
        expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ phase: 'subnet' }));
        expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ phase: 'done' }));
    });

    it('支持扫描同一 IP 的多个候选端口', async () => {
        global.fetch.mockImplementation((url) => {
            if (url === 'http://192.168.6.109:8890/api/health') {
                return Promise.resolve(createResponse({
                    status: 'ok',
                    device_name: '备用端口 PC',
                    port: 8890,
                }));
            }
            return Promise.resolve(createResponse({ status: 'offline' }));
        });

        const scanner = new LanScanner();
        scanner.getLocalIP = vi.fn().mockResolvedValue(null);

        const devices = await scanner.scan({
            subnets: ['192.168.6'],
            rangeStart: 109,
            rangeEnd: 109,
            ports: [8888, 8890],
            timeout: 50,
            concurrency: 2,
        });

        expect(devices).toHaveLength(1);
        expect(devices[0]).toMatchObject({
            ip: '192.168.6.109',
            port: 8890,
            address: '192.168.6.109:8890',
        });
    });

    it('最近设备没有端口时使用端口范围探测', async () => {
        global.fetch.mockImplementation((url) => {
            if (url === 'http://192.168.6.109:8890/api/health') {
                return Promise.resolve(createResponse({
                    status: 'ok',
                    device_name: '旧版记录 PC',
                    port: 8890,
                }));
            }
            return Promise.resolve(createResponse({ status: 'offline' }));
        });

        const scanner = new LanScanner();
        scanner.getLocalIP = vi.fn().mockResolvedValue(null);

        const devices = await scanner.scan({
            recentHosts: ['192.168.6.109'],
            subnets: [],
            ports: [8888, 8890],
            timeout: 50,
            concurrency: 2,
        });

        expect(global.fetch).toHaveBeenCalledWith(
            'http://192.168.6.109:8890/api/health',
            expect.any(Object)
        );
        expect(devices[0]).toMatchObject({
            ip: '192.168.6.109',
            port: 8890,
            address: '192.168.6.109:8890',
        });
    });
});

describe('局域网目标地址解析', () => {
    it('支持 IP、IP:端口 和 URL 输入', () => {
        expect(parseLanTarget('192.168.6.109')).toMatchObject({
            ip: '192.168.6.109',
            port: 8888,
            address: '192.168.6.109:8888',
        });
        expect(parseLanTarget('192.168.6.109:8890')).toMatchObject({
            ip: '192.168.6.109',
            port: 8890,
            baseUrl: 'http://192.168.6.109:8890',
        });
        expect(formatLanAddress('http://192.168.6.109:8891/api/health')).toBe('192.168.6.109:8891');
    });

    it('拒绝非法 IP 和端口', () => {
        expect(parseLanTarget('999.168.6.109')).toBeNull();
        expect(parseLanTarget('192.168.6.109:70000')).toBeNull();
        expect(parseLanTarget('not-an-ip')).toBeNull();
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

    it('回传时使用目标地址中的动态端口', async () => {
        const storage = {
            exportData: vi.fn().mockResolvedValue({ folders: [], prompt_sets: [] }),
        };
        global.fetch.mockResolvedValue(createResponse({
            success: true,
            added: 0,
            updated: 0,
            conflicts: 0,
            skipped: 0,
            imagesRestored: 0,
        }));

        const sync = new LanSync(storage);
        const report = await sync.push('192.168.6.109:8890', { token: 'token-123' });

        expect(global.fetch).toHaveBeenCalledWith(
            'http://192.168.6.109:8890/api/sync/import',
            expect.objectContaining({ method: 'POST' })
        );
        expect(report).toMatchObject({
            success: true,
            port: 8890,
            address: '192.168.6.109:8890',
        });
    });
});

describe('LanSync 拉取', () => {
    beforeEach(() => {
        global.fetch = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('拉取时使用目标地址中的动态端口', async () => {
        const storage = {
            query: vi.fn().mockResolvedValue([{ cnt: 0 }]),
            run: vi.fn().mockResolvedValue(undefined),
        };
        global.fetch.mockImplementation((url) => {
            if (url === 'http://192.168.6.109:8890/api/health') {
                return Promise.resolve(createResponse({ status: 'ok' }));
            }
            if (url === 'http://192.168.6.109:8890/api/sync') {
                return Promise.resolve(createResponse({
                    folders: [],
                    prompt_sets: [],
                    versions: [],
                    images: [],
                    sync_meta: {
                        total_prompt_sets: 0,
                        total_versions: 0,
                        total_images: 0,
                    },
                }));
            }
            return Promise.reject(new Error(`unexpected url: ${url}`));
        });

        const sync = new LanSync(storage);
        const report = await sync.sync('192.168.6.109:8890');

        expect(global.fetch).toHaveBeenCalledWith(
            'http://192.168.6.109:8890/api/health',
            expect.any(Object)
        );
        expect(global.fetch).toHaveBeenCalledWith(
            'http://192.168.6.109:8890/api/sync',
            expect.any(Object)
        );
        expect(report).toMatchObject({
            success: true,
            port: 8890,
            address: '192.168.6.109:8890',
        });
    });
});
