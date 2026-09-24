import { describe, expect, it } from 'vitest';
import { moveTaskInTree, flattenTasks, buildTaskTree } from './goal-utils.js';

const baseTree = () => ([
    {
        id: 't1',
        title: 'A',
        order: 0,
        children: [
            { id: 't1a', title: 'A1', order: 0, children: [] },
            { id: 't1b', title: 'A2', order: 1, children: [] }
        ]
    },
    { id: 't2', title: 'B', order: 1, children: [] }
]);

describe('moveTaskInTree', () => {
    it('拖到节点上成为子级', () => {
        const next = moveTaskInTree(baseTree(), 't2', { type: 'child', parentId: 't1' });
        expect(next).toHaveLength(1);
        expect(next[0].children.map(c => c.id)).toEqual(['t1a', 't1b', 't2']);
    });

    it('拖到空白成为顶层', () => {
        const next = moveTaskInTree(baseTree(), 't1a', { type: 'root' });
        expect(next.map(t => t.id)).toEqual(['t1', 't2', 't1a']);
        expect(next[0].children.map(c => c.id)).toEqual(['t1b']);
    });

    it('兄弟插入 before/after', () => {
        const before = moveTaskInTree(baseTree(), 't2', { type: 'sibling', parentId: '', beforeId: 't1' });
        expect(before.map(t => t.id)).toEqual(['t2', 't1']);

        const after = moveTaskInTree(baseTree(), 't2', { type: 'sibling', parentId: 't1', afterId: 't1a' });
        expect(after[0].children.map(c => c.id)).toEqual(['t1a', 't2', 't1b']);
    });

    it('禁止拖入自身子树，返回原树', () => {
        const tree = baseTree();
        const next = moveTaskInTree(tree, 't1', { type: 'child', parentId: 't1a' });
        expect(next).toBe(tree);
    });

    it('flatten/build 往返保持层级', () => {
        const tree = baseTree();
        expect(buildTaskTree(flattenTasks(tree), '')).toEqual(tree);
    });
});
