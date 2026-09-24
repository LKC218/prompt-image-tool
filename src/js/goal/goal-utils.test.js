import { describe, it, expect } from 'vitest';
import { buildTaskContextMenuItems } from './goal-utils.js';

function actionKeys(items) {
    return items.filter(item => !item.divider).map(item => item.action);
}

describe('buildTaskContextMenuItems', () => {
    it('按状态/结构/资源/危险分组，并在组间插入分隔线', () => {
        const items = buildTaskContextMenuItems(
            { completed: false, priority: 'high', images: [{ id: '1' }] },
            { source: 'more' }
        );

        expect(items.filter(item => item.divider)).toHaveLength(3);
        expect(actionKeys(items)).toEqual([
            'toggle-complete',
            'toggle-executing',
            'add-child',
            'rename',
            'copy',
            'set-priority',
            'import-image',
            'image-manager',
            'view-images',
            'locate-mindmap',
            'delete'
        ]);
        expect(items.at(-1)).toMatchObject({ action: 'delete', danger: true });
        expect(items.findIndex(item => item.action === 'toggle-executing')).toBeLessThan(
            items.findIndex(item => item.action === 'add-child')
        );
    });

    it('无图片时省略查看图片，导图来源改为在列表中定位', () => {
        const items = buildTaskContextMenuItems(
            { completed: true, status: 'executing', images: [] },
            { source: 'mindmap' }
        );
        const keys = actionKeys(items);

        expect(keys).not.toContain('view-images');
        expect(keys).toContain('locate-list');
        expect(keys).not.toContain('locate-mindmap');
        expect(items.find(item => item.action === 'toggle-complete')?.label).toBe('标记为未完成');
        expect(items.find(item => item.action === 'toggle-executing')?.label).toBe('取消执行中');
    });

    it('优先级子菜单标记当前选中项', () => {
        const items = buildTaskContextMenuItems({ priority: 'medium' }, { source: 'more' });
        const priority = items.find(item => item.action === 'set-priority');
        const selected = priority.children.filter(child => child.selected);

        expect(selected).toEqual([
            { action: 'priority-medium', label: '中', selected: true }
        ]);
    });
});
