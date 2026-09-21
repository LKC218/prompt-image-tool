import { describe, expect, it } from 'vitest';
import {
    MINDMAP_ROOT_ID,
    MINDMAP_OPEN_VIEW_KEY,
    MINDMAP_SCALE_MIN,
    MINDMAP_SCALE_MAX,
    MINDMAP_BRANCH_COLORS,
    buildMindmapGraph,
    layoutMindmap,
    normalizeMindmapLinks,
    parseMindmapLinks,
    serializeMindmapLinks,
    toggleMindmapLink,
    hierarchyPathToRoot,
    mindmapLinksStorageKey,
    mindmapViewStorageKey,
    mindmapPriorityClass,
    requestOpenMindmapView,
    consumeMindmapOpenView,
    zoomMindmapAtPoint,
    fitMindmapTransform,
    focusMindmapTransform,
    formatMindmapZoomLabel,
    clampMindmapScale,
    mindmapMaximizeStorageKey,
    readMindmapMaximize,
    writeMindmapMaximize,
    assignMindmapBranchColors,
    orthogonalEdgePath,
    buildMindmapHierarchyEdgePaths,
    annotateMindmapProgress,
    filterIncompleteMindmap,
    easeMindmapCameraCubic,
    interpolateMindmapTransform,
    stepMindmapInertia,
    estimateMindmapPanVelocity
} from './goal-mindmap-core.js';

const project = { id: 'p1', name: '小鹏MONA M03' };

const tasks = [
    {
        id: 't1',
        title: '性能基准',
        completed: false,
        priority: 'high',
        children: [
            { id: 't1a', title: '关闭按钮', completed: false, children: [] },
            { id: 't1b', title: '接入基准UI', completed: true, children: [] }
        ]
    },
    {
        id: 't2',
        title: '气泡信息弹窗',
        completed: false,
        children: [
            {
                id: 't2a',
                title: '文案输出动画',
                completed: true,
                children: [
                    { id: 't2a1', title: '逐字出现', completed: true, children: [] }
                ]
            }
        ]
    }
];

describe('buildMindmapGraph', () => {
    it('生成根节点、全部任务节点与父子边', () => {
        const graph = buildMindmapGraph(project, tasks);
        expect(graph.rootId).toBe(MINDMAP_ROOT_ID);
        expect(graph.nodes[0]).toMatchObject({ id: MINDMAP_ROOT_ID, title: '小鹏MONA M03', depth: 0 });
        expect(graph.nodes).toHaveLength(7);
        expect(graph.hierarchyEdges).toHaveLength(6);
        expect(graph.hierarchyEdges).toContainEqual({ from: MINDMAP_ROOT_ID, to: 't1' });
        expect(graph.hierarchyEdges).toContainEqual({ from: 't2a', to: 't2a1' });
        const t1 = graph.nodes.find(n => n.id === 't1');
        expect(t1).toMatchObject({ parentId: MINDMAP_ROOT_ID, depth: 1, priority: 'high' });
        const t1b = graph.nodes.find(n => n.id === 't1b');
        expect(t1b.checkState).toBe('checked');
        const t1a = graph.nodes.find(n => n.id === 't1a');
        expect(t1a.checkState).toBe('unchecked');
    });

    it('空任务仍保留根节点', () => {
        const graph = buildMindmapGraph(project, []);
        expect(graph.nodes).toHaveLength(1);
        expect(graph.hierarchyEdges).toHaveLength(0);
    });
});

describe('layoutMindmap', () => {
    it('深度越大 x 越大，同级叶子 y 不重叠', () => {
        const graph = buildMindmapGraph(project, tasks);
        const { positions, width, height } = layoutMindmap(graph.nodes, graph.hierarchyEdges);
        expect(positions.size).toBe(graph.nodes.length);
        const root = positions.get(MINDMAP_ROOT_ID);
        const t1 = positions.get('t1');
        const t1a = positions.get('t1a');
        const t1b = positions.get('t1b');
        expect(t1.x).toBeGreaterThan(root.x);
        expect(t1a.x).toBeGreaterThan(t1.x);
        const overlap = !(t1a.y + t1a.h <= t1b.y || t1b.y + t1b.h <= t1a.y);
        expect(overlap).toBe(false);
        expect(width).toBeGreaterThan(0);
        expect(height).toBeGreaterThan(0);
    });

    it('空图返回最小画布', () => {
        const result = layoutMindmap([], []);
        expect(result.positions.size).toBe(0);
        expect(result.width).toBeGreaterThan(0);
        expect(result.height).toBeGreaterThan(0);
    });
});

describe('mindmap links', () => {
    it('parse 容错并标准化字段', () => {
        expect(parseMindmapLinks(null)).toEqual([]);
        expect(parseMindmapLinks('not-json')).toEqual([]);
        expect(parseMindmapLinks(JSON.stringify([{ from: 'a', to: 'b' }]))).toEqual([
            { fromId: 'a', toId: 'b' }
        ]);
    });

    it('normalize 去掉自环、根节点、失效端点与重复边', () => {
        const valid = new Set(['t1a', 't1b', 't2']);
        const cleaned = normalizeMindmapLinks([
            { fromId: 't1a', toId: 't1b' },
            { fromId: 't1b', toId: 't1a' },
            { fromId: 't1a', toId: 't1a' },
            { fromId: MINDMAP_ROOT_ID, toId: 't1a' },
            { fromId: 't1a', toId: 'ghost' }
        ], valid);
        expect(cleaned).toEqual([{ fromId: 't1a', toId: 't1b' }]);
    });

    it('toggle 创建与删除关联，且无向', () => {
        let links = toggleMindmapLink([], 't1a', 't1b');
        expect(links).toHaveLength(1);
        links = toggleMindmapLink(links, 't1b', 't1a');
        expect(links).toHaveLength(0);
    });

    it('serialize 幂等', () => {
        const raw = serializeMindmapLinkFallback();
        const parsed = parseMindmapLinks(raw);
        expect(serializeMindmapLinks(parsed)).toBe(raw);
    });

    it('storage key 按项目隔离', () => {
        expect(mindmapLinksStorageKey('p1')).toBe('pc-goal-mindmap-links:p1');
        expect(mindmapViewStorageKey('p1')).toBe('pc-goal-detail-view:p1');
    });
});

function serializeMindmapLinkFallback() {
    return serializeMindmapLinks([
        { fromId: 't1a', toId: 't2' },
        { fromId: 'ghost', toId: 't1a' }
    ]);
}

describe('hierarchyPathToRoot', () => {
    it('返回任务到根的路径', () => {
        const graph = buildMindmapGraph(project, tasks);
        expect(hierarchyPathToRoot(graph.nodes, 't2a1')).toEqual([MINDMAP_ROOT_ID, 't2', 't2a', 't2a1']);
    });
});

describe('open-view marker', () => {
    function memStorage() {
        const map = new Map();
        return {
            getItem: (k) => (map.has(k) ? map.get(k) : null),
            setItem: (k, v) => map.set(k, String(v)),
            removeItem: (k) => map.delete(k)
        };
    }

    it('仅目标项目消费一次性 mindmap 标记', () => {
        const storage = memStorage();
        requestOpenMindmapView(storage, 'p1');
        expect(storage.getItem(MINDMAP_OPEN_VIEW_KEY)).toContain('p1');
        expect(consumeMindmapOpenView(storage, 'p2')).toBeNull();
        requestOpenMindmapView(storage, 'p1');
        expect(consumeMindmapOpenView(storage, 'p1')).toBe('mindmap');
        expect(storage.getItem(MINDMAP_OPEN_VIEW_KEY)).toBeNull();
    });

    it('优先级 class 白名单', () => {
        expect(mindmapPriorityClass('high')).toBe('is-priority-high');
        expect(mindmapPriorityClass('evil')).toBe('');
        expect(mindmapPriorityClass('')).toBe('');
    });

    it('根节点完成态跟随根任务', () => {
        const allDone = [
            { id: 'a', title: 'A', completed: true, children: [] },
            { id: 'b', title: 'B', completed: true, children: [] }
        ];
        const graph = buildMindmapGraph(project, allDone);
        const root = graph.nodes.find(n => n.id === MINDMAP_ROOT_ID);
        expect(root.checkState).toBe('checked');
        expect(root.completed).toBe(true);
    });
});

describe('mindmap viewport helpers', () => {
    it('缩放以指针为锚点并夹紧范围', () => {
        const t = { x: 100, y: 50, scale: 1 };
        const zoomed = zoomMindmapAtPoint(t, -100, 200, 100);
        expect(zoomed.scale).toBeGreaterThan(1);
        expect(clampMindmapScale(zoomed.scale)).toBe(zoomed.scale);
        const tiny = zoomMindmapAtPoint({ x: 0, y: 0, scale: MINDMAP_SCALE_MIN }, 100, 10, 10);
        expect(tiny.scale).toBe(MINDMAP_SCALE_MIN);
        const huge = zoomMindmapAtPoint({ x: 0, y: 0, scale: MINDMAP_SCALE_MAX }, -100, 10, 10);
        expect(huge.scale).toBe(MINDMAP_SCALE_MAX);
        // 指针下的世界坐标保持近似不动
        const wx = (200 - t.x) / t.scale;
        const wx2 = (200 - zoomed.x) / zoomed.scale;
        expect(Math.abs(wx - wx2)).toBeLessThan(0.01);
    });

    it('fit 居中且不超过 maxScale', () => {
        const content = { width: 2000, height: 1000 };
        const viewport = { width: 800, height: 600 };
        const padding = 20;
        const fitted = fitMindmapTransform(content, viewport, { padding, maxScale: 1.15 });
        expect(fitted.scale).toBeLessThanOrEqual(1.15);
        expect(fitted.scale).toBeGreaterThanOrEqual(MINDMAP_SCALE_MIN);
        const viewW = viewport.width - padding * 2;
        const viewH = viewport.height - padding * 2;
        // 内容中心对齐视口中心
        expect(fitted.x + content.width * fitted.scale / 2).toBeCloseTo(viewport.width / 2);
        expect(fitted.y + content.height * fitted.scale / 2).toBeCloseTo(viewport.height / 2);
        expect(viewW).toBeGreaterThan(0);
        expect(viewH).toBeGreaterThan(0);
    });

    it('focus 居中选中节点，zoom 标签格式正确', () => {
        const positions = new Map([['n1', { x: 400, y: 200, w: 120, h: 40 }]]);
        const focused = focusMindmapTransform(positions, 'n1', { width: 800, height: 400 }, { scale: 1 });
        expect(focused.x).toBeCloseTo(800 / 2 - (400 + 60));
        expect(focused.y).toBeCloseTo(400 / 2 - (200 + 20));
        expect(focusMindmapTransform(positions, 'missing', { width: 10, height: 10 })).toBeNull();
        expect(formatMindmapZoomLabel(1.234)).toBe('123%');
    });

    it('最大化偏好按项目读写', () => {
        const map = new Map();
        const storage = {
            getItem: (k) => (map.has(k) ? map.get(k) : null),
            setItem: (k, v) => map.set(k, String(v)),
            removeItem: (k) => map.delete(k)
        };
        expect(mindmapMaximizeStorageKey('p1')).toBe('pc-goal-mindmap-maximize:p1');
        expect(readMindmapMaximize(storage, 'p1')).toBe(false);
        writeMindmapMaximize(storage, 'p1', true);
        expect(readMindmapMaximize(storage, 'p1')).toBe(true);
        writeMindmapMaximize(storage, 'p1', false);
        expect(readMindmapMaximize(storage, 'p1')).toBe(false);
    });
});

describe('orthogonal mindmap edges', () => {
    const fromPos = { x: 0, y: 100, w: 80, h: 40 };
    const toPosA = { x: 200, y: 40, w: 80, h: 40 };
    const toPosB = { x: 200, y: 160, w: 80, h: 40 };

    it('生成圆角正交路径，且同父竖脊 x 一致', () => {
        const dA = orthogonalEdgePath(fromPos, toPosA, { stub: 22, radius: 8 });
        const dB = orthogonalEdgePath(fromPos, toPosB, { stub: 22, radius: 8 });
        expect(dA).toContain('M 80 120');
        expect(dA).toContain('Q');
        expect(dB).toContain('Q');
        // 竖脊均从 parent.right + stub = 102 出发
        expect(dA).toMatch(/H 94 Q 102 /);
        expect(dB).toMatch(/H 94 Q 102 /);
        const flat = orthogonalEdgePath(
            { x: 0, y: 100, w: 80, h: 40 },
            { x: 200, y: 100, w: 80, h: 40 }
        );
        expect(flat).toBe('M 80 120 H 200');
    });

    it('分支配色：一级分支及其后代同色，根为中性色', () => {
        const graph = buildMindmapGraph(project, tasks);
        const colors = assignMindmapBranchColors(graph.nodes);
        expect(colors.get(MINDMAP_ROOT_ID)).toBeTruthy();
        expect(colors.get('t1')).toBe(MINDMAP_BRANCH_COLORS[0]);
        expect(colors.get('t2')).toBe(MINDMAP_BRANCH_COLORS[1]);
        expect(colors.get('t1a')).toBe(colors.get('t1'));
        expect(colors.get('t2a1')).toBe(colors.get('t2'));
        expect(colors.get('t1')).not.toBe(colors.get('t2'));
    });

    it('buildMindmapHierarchyEdgePaths 输出颜色与路径', () => {
        const graph = buildMindmapGraph(project, tasks);
        const { positions } = layoutMindmap(graph.nodes, graph.hierarchyEdges);
        const paths = buildMindmapHierarchyEdgePaths(graph.nodes, positions, graph.hierarchyEdges);
        expect(paths).toHaveLength(graph.hierarchyEdges.length);
        const toChild = paths.find(p => p.to === 't1a');
        expect(toChild.d).toContain('Q');
        expect(toChild.color).toBe(paths.find(p => p.to === 't1').color);
        expect(toChild.opacity).toBeGreaterThan(0);
    });
});

describe('mindmap completion semantics', () => {
    it('父节点与根节点汇总叶子完成进度', () => {
        const graph = buildMindmapGraph(project, tasks);
        const nodes = annotateMindmapProgress(graph.nodes);
        const byId = new Map(nodes.map(n => [n.id, n]));
        // fixture leaves: t1a todo, t1b done, t2a1 done → 2/3
        expect(byId.get('t1a')).toMatchObject({ statusKind: 'todo', progressText: '0/1' });
        expect(byId.get('t1b')).toMatchObject({ statusKind: 'done', progressText: '1/1' });
        expect(byId.get('t1')).toMatchObject({ statusKind: 'doing', progressText: '1/2', checkState: 'indeterminate' });
        expect(byId.get('t2a1')).toMatchObject({ statusKind: 'done' });
        expect(byId.get('t2a')).toMatchObject({ statusKind: 'done', progressText: '1/1' });
        expect(byId.get(MINDMAP_ROOT_ID).progressText).toBe('2/3');
        expect(byId.get(MINDMAP_ROOT_ID).statusKind).toBe('doing');
    });

    it('只看未完成：保留未完成叶子及其祖先，隐藏已完成叶子', () => {
        const graph = buildMindmapGraph(project, tasks);
        const nodes = annotateMindmapProgress(graph.nodes);
        const filtered = filterIncompleteMindmap(nodes, graph.hierarchyEdges);
        const ids = new Set(filtered.nodes.map(n => n.id));
        expect(ids.has('t1a')).toBe(true);
        expect(ids.has('t1b')).toBe(false); // completed leaf
        expect(ids.has('t1')).toBe(true);   // ancestor with incomplete child
        expect(ids.has('t2a1')).toBe(false); // completed-only branch
        expect(ids.has('t2')).toBe(false);
        expect(ids.has(MINDMAP_ROOT_ID)).toBe(true);
        expect(filtered.hierarchyEdges.every(e => ids.has(e.from) && ids.has(e.to))).toBe(true);
    });

    it('全部完成时筛选结果为空', () => {
        const allDone = [
            { id: 'a', title: 'A', completed: true, children: [] },
            { id: 'b', title: 'B', completed: true, children: [] }
        ];
        const graph = buildMindmapGraph(project, allDone);
        const filtered = filterIncompleteMindmap(graph.nodes, graph.hierarchyEdges);
        expect(filtered.nodes).toHaveLength(0);
    });
});

describe('mindmap camera / inertia', () => {
    it('相机缓动：首尾落点正确，中点非线性', () => {
        expect(easeMindmapCameraCubic(0)).toBe(0);
        expect(easeMindmapCameraCubic(1)).toBe(1);
        expect(easeMindmapCameraCubic(0.5)).toBeGreaterThan(0.5);
        const mid = interpolateMindmapTransform(
            { x: 0, y: 0, scale: 1 },
            { x: 100, y: 50, scale: 2 },
            0.5
        );
        expect(mid.x).toBeGreaterThan(50);
        expect(mid.scale).toBeGreaterThan(1.5);
        const end = interpolateMindmapTransform(
            { x: 0, y: 0, scale: 1 },
            { x: 100, y: 50, scale: 2 },
            1
        );
        expect(end).toMatchObject({ x: 100, y: 50 });
    });

    it('惯性衰减：摩擦后减速，低于阈值停止', () => {
        let v = { x: 4, y: -2 };
        const s1 = stepMindmapInertia(v);
        expect(s1.active).toBe(true);
        expect(Math.abs(s1.x)).toBeLessThan(Math.abs(v.x));
        let cur = { x: s1.x, y: s1.y };
        for (let i = 0; i < 80; i += 1) {
            cur = stepMindmapInertia(cur);
            if (!cur.active) break;
        }
        expect(cur.active).toBe(false);
        expect(stepMindmapInertia({ x: 0, y: 0 }).active).toBe(false);
    });

    it('拖拽速度估计：近期样本优先', () => {
        const samples = [
            { x: 0, y: 0, t: 0 },
            { x: 10, y: 0, t: 100 },
            { x: 30, y: 0, t: 120 }
        ];
        const v = estimateMindmapPanVelocity(samples, 80);
        expect(v.x).toBeGreaterThan(0);
    });
});
