import { describe, it, expect, beforeEach } from 'vitest';
import {
    clearDownloadHistory,
    formatDownloadHistoryTime,
    getDownloadHistory,
    getDownloadHistoryLocationLabel,
    recordDownloadHistory,
} from './download-history.js';

describe('download-history', () => {
    beforeEach(() => {
        clearDownloadHistory();
    });

    it('记录、排序并清空下载历史', () => {
        recordDownloadHistory({
            title: '第一张图',
            filename: 'a.png',
            platform: 'pc',
            source: '图片查看器',
            createdAt: '2026-05-24T10:00:00.000Z',
            locationLabel: '浏览器下载',
        });
        recordDownloadHistory({
            title: '第二张图',
            filename: 'b.png',
            platform: 'mobile',
            source: '图片查看器',
            createdAt: '2026-05-24T11:00:00.000Z',
            locationLabel: '手机相册',
        });

        const history = getDownloadHistory();
        expect(history).toHaveLength(2);
        expect(history[0].title).toBe('第二张图');
        expect(getDownloadHistoryLocationLabel(history[0])).toBe('手机相册');

        clearDownloadHistory();
        expect(getDownloadHistory()).toHaveLength(0);
    });

    it('格式化下载时间', () => {
        expect(formatDownloadHistoryTime('2026-05-24T09:08:00.000Z')).toContain('2026-05-24');
    });
});
