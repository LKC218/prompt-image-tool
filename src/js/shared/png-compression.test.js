import { describe, expect, it } from 'vitest';
import { fileKey, outputPath, formatSize, PNG_LIMITS, validatePng } from './png-compression.js';

describe('PNG 批量队列辅助函数', () => {
    it('同名不同目录与修改时间区分', () => {
        const base = { name: '图.png', size: 12, lastModified: 1 };
        expect(fileKey(base)).not.toBe(fileKey({ ...base, webkitRelativePath: '另一目录/图.png' }));
        expect(fileKey(base)).not.toBe(fileKey({ ...base, lastModified: 2 }));
    });
    it('导出路径清理穿越并防重名', () => {
        const used = new Set();
        expect(outputPath('../素材/图.png', used)).toBe('素材/图-压缩.png');
        expect(outputPath('素材/图.png', used)).toBe('素材/图-压缩-2.png');
        expect(outputPath('C:\\图.png', used)).toBe('C_/图-压缩.png');
        expect(outputPath('__proto__.png', used)).toBe('__proto__-压缩.png');
    });
    it('单位与上限', () => {
        expect(formatSize(1024)).toBe('1.0 KB');
        expect(PNG_LIMITS.total).toBe(100 * 1024 ** 2);
    });
    it('多格式转换按实际输出格式命名并防重名', () => {
        const used = new Set();
        expect(outputPath('照片.jpeg', used, 'webp', true)).toBe('照片-转换.webp');
        expect(outputPath('照片.png', used, 'webp', true)).toBe('照片-转换-2.webp');
        expect(outputPath('照片.webp', used, 'jpeg', true)).toBe('照片-转换.jpg');
    });
    it('拒绝非 PNG 和超限文件', async () => {
        await expect(validatePng({ name: '图.jpg', size: 1 })).rejects.toThrow('PNG');
        await expect(validatePng({ name: '图.png', size: PNG_LIMITS.file + 1 })).rejects.toThrow('20 MB');
    });
});

