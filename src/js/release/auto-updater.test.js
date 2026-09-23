import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    checkForUpdate,
    fetchUpdateProgress,
    pollUpdateProgress,
    startDownloadUpdate,
    cancelUpdateDownload,
} from './auto-updater.js';
import { formatUpdateProgressLine, openUpdateProgressModal } from './update-progress-modal.js';

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

describe('download job client', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('startDownloadUpdate 返回 jobId', async () => {
        fetch.mockResolvedValue({
            ok: true,
            json: async () => ({ success: true, jobId: 'abc123' }),
        });
        const result = await startDownloadUpdate({
            url: 'https://example.com/a.exe',
            sha256: 'deadbeef',
        });
        expect(result.jobId).toBe('abc123');
        expect(fetch).toHaveBeenCalledWith('/api/update/download', expect.any(Object));
    });

    it('pollUpdateProgress 轮询到 ready 终止', async () => {
        const responses = [
            { phase: 'downloading', percent: 10, downloaded: 1, total: 10, speed: 1 },
            { phase: 'downloading', percent: 80, downloaded: 8, total: 10, speed: 2 },
            { phase: 'ready', percent: 100, downloaded: 10, total: 10, path: 'C:/tmp/a.exe' },
        ];
        let i = 0;
        fetch.mockImplementation(async () => ({
            ok: true,
            json: async () => ({ success: true, jobId: 'j1', ...responses[i++] }),
        }));
        const updates = [];
        const result = await pollUpdateProgress('j1', {
            intervalMs: 1,
            onUpdate: (p) => updates.push(p.phase),
        });
        expect(result.phase).toBe('ready');
        expect(updates).toEqual(['downloading', 'downloading', 'ready']);
    });

    it('cancelUpdateDownload 调用取消接口', async () => {
        fetch.mockResolvedValue({
            ok: true,
            json: async () => ({ success: true, jobId: 'j1', phase: 'downloading' }),
        });
        await cancelUpdateDownload('j1');
        expect(fetch).toHaveBeenCalledWith(
            '/api/update/download/cancel',
            expect.objectContaining({ method: 'POST' })
        );
    });

    it('fetchUpdateProgress 缺少 jobId 时报错', async () => {
        await expect(fetchUpdateProgress('')).rejects.toThrow('缺少下载任务 ID');
    });

    it('重试后取消会请求当前 job（session 状态共享）', async () => {
        // 模拟：第一次 job 失败，重试拿到 job-b，取消应 POST job-b
        const cancelBodies = [];
        let call = 0;
        fetch.mockImplementation(async (url, options) => {
            const body = options?.body ? JSON.parse(options.body) : null;
            if (url === '/api/update/download') {
                call += 1;
                return {
                    ok: true,
                    json: async () => ({ success: true, jobId: call === 1 ? 'job-a' : 'job-b' }),
                };
            }
            if (String(url).startsWith('/api/update/progress')) {
                const jobId = new URLSearchParams(String(url).split('?')[1] || '').get('jobId');
                if (jobId === 'job-a') {
                    return {
                        ok: true,
                        json: async () => ({
                            success: true,
                            jobId,
                            phase: 'failed',
                            percent: 10,
                            error: '网络中断',
                        }),
                    };
                }
                // job-b 持续 downloading，便于触发取消
                return {
                    ok: true,
                    json: async () => ({
                        success: true,
                        jobId,
                        phase: 'downloading',
                        percent: 20,
                        downloaded: 1,
                        total: 10,
                        speed: 1,
                    }),
                };
            }
            if (url === '/api/update/download/cancel') {
                cancelBodies.push(body?.jobId);
                return {
                    ok: true,
                    json: async () => ({ success: true, jobId: body?.jobId, phase: 'downloading' }),
                };
            }
            return { ok: false, status: 404, json: async () => ({ success: false, error: 'no' }) };
        });

        const { runUpdateWithProgressModal } = await import('./auto-updater.js');
        const latest = { version: '2.6.0', url: 'https://example.com/a.exe', sha256: 'abc' };

        // 首次失败
        const first = await runUpdateWithProgressModal(latest);
        expect(first.updated).toBe(false);
        expect(first.error).toContain('网络中断');

        // 点击重试按钮
        document.getElementById('pcUpdateProgressRetryBtn')?.click();

        // 等待第二次下载进入轮询，然后点取消
        await new Promise((r) => setTimeout(r, 50));
        document.getElementById('pcUpdateProgressCancelBtn')?.click();
        await new Promise((r) => setTimeout(r, 350));

        expect(cancelBodies).toContain('job-b');
        document.getElementById('pcUpdateProgressCloseBtn')?.click();
    });
});

describe('update progress modal', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('formatUpdateProgressLine 含总量与速度', () => {
        const line = formatUpdateProgressLine({
            downloaded: 12 * 1024 * 1024,
            total: 48 * 1024 * 1024,
            speed: 2 * 1024 * 1024,
        });
        expect(line).toContain('12.0 MB');
        expect(line).toContain('48.0 MB');
        expect(line).toContain('2.0 MB/s');
    });

    it('打开弹窗并渲染下载进度与阶段', () => {
        const modal = openUpdateProgressModal({});
        const root = document.getElementById('pcUpdateProgressOverlay');
        expect(root).toBeTruthy();
        modal.setProgress({
            phase: 'downloading',
            percent: 42,
            downloaded: 1000,
            total: 2000,
            speed: 100,
        });
        expect(root.querySelector('#pcUpdateProgressPercent').textContent).toBe('42%');
        expect(root.querySelector('#pcUpdateProgressFill').style.width).toBe('42%');
        const activeStage = root.querySelector('.pc-update-stage-list li.active');
        expect(activeStage?.dataset.stage).toBe('downloading');
        expect(root.querySelector('#pcUpdateProgressCancelBtn')).toBeTruthy();
        modal.close();
    });

    it('失败阶段展示错误与重试', () => {
        const onRetry = vi.fn();
        const modal = openUpdateProgressModal({ onRetry });
        modal.setProgress({ phase: 'failed', error: '校验失败', percent: 100 });
        const root = document.getElementById('pcUpdateProgressOverlay');
        expect(root.querySelector('#pcUpdateProgressError').hidden).toBe(false);
        expect(root.querySelector('#pcUpdateProgressError').textContent).toContain('校验失败');
        root.querySelector('#pcUpdateProgressRetryBtn')?.click();
        expect(onRetry).toHaveBeenCalled();
        modal.close();
    });
});
