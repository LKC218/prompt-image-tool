import { describe, expect, it } from 'vitest';
import { getFolderColor, getFolderColorPayload } from './folder-color.js';

describe('分类颜色兼容解析', () => {
    it('优先使用有效的 colorKey', () => {
        expect(getFolderColor({ colorKey: 'pine', color: '#FF0000' }).key).toBe('pine');
    });

    it('将历史 PC 与移动端颜色映射到同一语义键', () => {
        expect(getFolderColor({ color: '#2D8CFF' }).key).toBe('sky');
        expect(getFolderColor({ color: '#2580D6' }).key).toBe('sky');
    });

    it('在深色模式输出颜色键对应的低亮度表面', () => {
        expect(getFolderColor({ colorKey: 'pine' }, 'dark').bg).toBe('#194A37');
        expect(getFolderColor({ color: '#2D8CFF' }, 'dark').bg).toBe('#173C63');
    });

    it('为未知颜色提供稳定回退和兼容镜像值', () => {
        expect(getFolderColor({ id: 'folder-1', color: '#112233' })).toEqual(getFolderColor({ id: 'folder-1', color: '#445566' }));
        expect(getFolderColorPayload('coral')).toEqual({ colorKey: 'coral', color: '#E85D75' });
    });
});
