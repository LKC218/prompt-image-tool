import { afterEach, describe, expect, it, vi } from 'vitest';
import { hideActionSheet, showActionSheet } from './mobile-app.js';

function mountActionSheet() {
    document.body.innerHTML = '<div id="mActionSheetOverlay"><div id="mActionSheet"></div></div>';
}

afterEach(() => {
    hideActionSheet();
    document.body.innerHTML = '';
});

describe('showActionSheet', () => {
    it('进入二级操作层后可返回父级', () => {
        mountActionSheet();
        showActionSheet([{
            action: 'move',
            label: '移动到分类',
            children: [{ action: 'folder-a', label: '分类 A' }]
        }]);

        document.querySelector('[data-action="move"]').click();
        expect(document.querySelector('[data-action="folder-a"]')).not.toBeNull();

        document.querySelector('[data-action="__back"]').click();
        expect(document.querySelector('[data-action="move"]')).not.toBeNull();
    });

    it('执行子级动作前关闭操作表', () => {
        mountActionSheet();
        const handler = vi.fn();
        showActionSheet([{
            action: 'format',
            label: '导出格式',
            children: [{ action: 'png', label: 'PNG', handler }]
        }]);

        document.querySelector('[data-action="format"]').click();
        document.querySelector('[data-action="png"]').click();

        expect(document.getElementById('mActionSheetOverlay').classList.contains('m-sheet-show')).toBe(false);
        expect(handler).toHaveBeenCalledTimes(1);
    });
});
