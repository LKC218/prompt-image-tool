import { getParentCheckState } from './goal-utils.js';

export const MINDMAP_ROOT_ID = '__root__';

export const MINDMAP_LINKS_PREFIX = 'pc-goal-mindmap-links:';
export const MINDMAP_VIEW_PREFIX = 'pc-goal-detail-view:';
export const MINDMAP_OPEN_VIEW_KEY = 'pc-goal-detail-open-view';
export const MINDMAP_MAXIMIZE_PREFIX = 'pc-goal-mindmap-maximize:';
export const MINDMAP_SCALE_MIN = 0.45;
export const MINDMAP_SCALE_MAX = 2.2;
export const MINDMAP_DEFAULT_TRANSFORM = { x: 24, y: 24, scale: 1 };
export const MINDMAP_CAMERA_DURATION = 320;
export const MINDMAP_INERTIA_FRICTION = 0.92;
export const MINDMAP_INERTIA_MIN_SPEED = 0.08;
export const MINDMAP_PAN_VELOCITY_WINDOW_MS = 80;

export const MINDMAP_BRANCH_COLORS = [
    '#3B82F6',
    '#14B8A6',
    '#F59E0B',
    '#8B5CF6',
    '#EF4444',
    '#10B981',
    '#F97316',
    '#6366F1'
];

export const MINDMAP_ROOT_COLOR = '#64748B';
export const MINDMAP_ORTHO_OPTIONS = { stub: 22, radius: 8 };

const PRIORITY_CLASS_SET = new Set(['high', 'medium', 'low']);

const DEFAULT_LAYOUT_OPTIONS = {
    nodeMinWidth: 120,
    nodeMinHeight: 40,
    nodeMaxWidth: 360,
    hGap: 48,
    vGap: 16,
    padding: 32,
    titleCharWidth: 12,
    titleChrome: 56,
    titlePadY: 14,
    lineHeight: 18
};

function isWideTitleChar(ch) {
    const code = ch.codePointAt(0) || 0;
    return (
        (code >= 0x1100 && code <= 0x115f) ||
        (code >= 0x2e80 && code <= 0xa4cf) ||
        (code >= 0xac00 && code <= 0xd7a3) ||
        (code >= 0xf900 && code <= 0xfaff) ||
        (code >= 0xfe30 && code <= 0xfe4f) ||
        (code >= 0xff00 && code <= 0xff60) ||
        (code >= 0xffe0 && code <= 0xffe6) ||
        (code >= 0x4e00 && code <= 0x9fff)
    );
}

/** 按中西文宽度估算标题折行数；高度随行数增长，保证全文可显示不截断。 */
export function estimateMindmapTitleLines(title, maxTitleWidth, titleCharWidth = 12) {
    const s = String(title || '');
    if (!s) return 1;
    const unitsPerLine = Math.max(4, (Number(maxTitleWidth) || 200) / (Number(titleCharWidth) || 12));
    let units = 0;
    for (const ch of s) units += isWideTitleChar(ch) ? 1 : 0.55;
    return Math.max(1, Math.ceil(units / unitsPerLine));
}

export function estimateNodeSize(title = '', options = {}) {
    const opts = { ...DEFAULT_LAYOUT_OPTIONS, ...options };
    const s = String(title || '');
    let units = 0;
    for (const ch of s) units += isWideTitleChar(ch) ? 1 : 0.55;
    const textW = Math.max(24, units * opts.titleCharWidth);
    const maxTitleW = Math.max(48, opts.nodeMaxWidth - opts.titleChrome);
    const lines = estimateMindmapTitleLines(s, maxTitleW, opts.titleCharWidth);
    const w = Math.max(opts.nodeMinWidth, Math.min(opts.nodeMaxWidth, textW + opts.titleChrome));
    const h = Math.max(opts.nodeMinHeight, opts.titlePadY + lines * opts.lineHeight);
    return { w, h };
}

function isMindmapNodeDescendant(childrenMap, rootId, candidateId) {
    if (rootId === candidateId) return true;
    const stack = [rootId];
    const seen = new Set();
    while (stack.length) {
        const id = stack.pop();
        if (seen.has(id)) continue;
        seen.add(id);
        if (id === candidateId) return true;
        for (const childId of childrenMap.get(id) || []) stack.push(childId);
    }
    return false;
}

/**
 * 解析导图拖拽落点。
 * 点在节点上：上 30% 插入前兄弟 / 下 30% 插入后兄弟 / 中部成为子级。
 * 点在空白或根节点：成为顶层任务。
 * 禁止拖入自身子树，返回 null。
 */
export function resolveMindmapDropTarget(dragId, point, nodes, positions) {
    const list = nodes || [];
    const posMap = positions?.get ? positions : new Map();
    const px = Number(point?.x);
    const py = Number(point?.y);
    if (!Number.isFinite(px) || !Number.isFinite(py)) return null;

    const childrenMap = new Map();
    for (const node of list) {
        const parent = node.parentId == null ? '' : node.parentId;
        if (!childrenMap.has(parent)) childrenMap.set(parent, []);
        childrenMap.get(parent).push(node.id);
    }

    let hitId = null;
    for (let i = list.length - 1; i >= 0; i -= 1) {
        const node = list[i];
        const pos = posMap.get(node.id);
        if (!pos) continue;
        if (px >= pos.x && px <= pos.x + pos.w && py >= pos.y && py <= pos.y + pos.h) {
            hitId = node.id;
            break;
        }
    }

    if (!hitId || hitId === MINDMAP_ROOT_ID) {
        return { type: 'root', parentId: null };
    }
    if (isMindmapNodeDescendant(childrenMap, dragId, hitId)) return null;

    const hit = list.find(n => n.id === hitId);
    const pos = posMap.get(hitId);
    const relY = (py - pos.y) / Math.max(1, pos.h);
    const parentOfHit = hit?.parentId == null || hit.parentId === MINDMAP_ROOT_ID ? null : hit.parentId;

    if (relY < 0.3) {
        return { type: 'sibling', parentId: parentOfHit, beforeId: hitId };
    }
    if (relY > 0.7) {
        return { type: 'sibling', parentId: parentOfHit, afterId: hitId };
    }
    return { type: 'child', parentId: hitId };
}

function buildNodesFromTasks(tasks, parentId, depth, nodes) {
    for (const task of tasks || []) {
        const children = task.children || [];
        const checkState = children.length > 0
            ? getParentCheckState(children)
            : (task.completed ? 'checked' : 'unchecked');
        nodes.push({
            id: task.id,
            title: task.title || '未命名任务',
            depth,
            parentId,
            order: task.order ?? 0,
            completed: !!task.completed,
            priority: task.priority || '',
            status: task.status || '',
            checkState,
            hasChildren: children.length > 0,
            imageCount: Array.isArray(task.images) ? task.images.length : 0,
            images: Array.isArray(task.images) ? task.images.map(img => ({
                id: img?.id || '',
                path: img?.path || '',
                name: img?.name || '',
                data: img?.data || ''
            })) : []
        });
        if (children.length > 0) {
            buildNodesFromTasks(children, task.id, depth + 1, nodes);
        }
    }
}

export function mindmapPriorityClass(priority) {
    return PRIORITY_CLASS_SET.has(priority) ? `is-priority-${priority}` : '';
}

export function annotateMindmapProgress(nodes) {
    const list = nodes || [];
    const childrenMap = new Map();
    const byId = new Map(list.map(n => [n.id, n]));
    for (const node of list) {
        const parent = node.parentId == null ? '' : node.parentId;
        if (!childrenMap.has(parent)) childrenMap.set(parent, []);
        childrenMap.get(parent).push(node.id);
    }
    const progress = new Map();
    const visiting = new Set();

    const visit = (id) => {
        if (progress.has(id)) return progress.get(id);
        if (visiting.has(id)) return { done: 0, total: 0 };
        visiting.add(id);
        const node = byId.get(id);
        const kids = childrenMap.get(id) || [];
        let result;
        if (!node) {
            result = { done: 0, total: 0 };
        } else if (kids.length === 0) {
            result = { done: node.completed ? 1 : 0, total: 1 };
        } else {
            let done = 0;
            let total = 0;
            for (const kid of kids) {
                const sub = visit(kid);
                done += sub.done;
                total += sub.total;
            }
            result = { done, total };
        }
        visiting.delete(id);
        progress.set(id, result);
        return result;
    };

    for (const node of list) {
        if (node.parentId == null || node.id === MINDMAP_ROOT_ID || !byId.has(node.parentId)) {
            visit(node.id);
        }
    }
    for (const node of list) visit(node.id);

    return list.map(node => {
        const p = progress.get(node.id) || { done: node.completed ? 1 : 0, total: 1 };
        const hasChildren = !!(node.hasChildren || (childrenMap.get(node.id) || []).length);
        let statusKind;
        let checkState;
        if (hasChildren) {
            checkState = p.total > 0 && p.done >= p.total
                ? 'checked'
                : (p.done > 0 ? 'indeterminate' : 'unchecked');
            statusKind = checkState === 'checked' ? 'done' : (checkState === 'indeterminate' ? 'doing' : 'todo');
        } else {
            checkState = node.completed ? 'checked' : 'unchecked';
            statusKind = node.completed ? 'done' : 'todo';
        }
        return {
            ...node,
            hasChildren,
            progress: p,
            progressText: `${p.done}/${p.total}`,
            progressRatio: p.total > 0 ? p.done / p.total : 0,
            statusKind,
            checkState
        };
    });
}

export function filterIncompleteMindmap(nodes, edges) {
    const list = nodes || [];
    const childrenMap = new Map();
    const byId = new Map(list.map(n => [n.id, n]));
    for (const node of list) {
        const parent = node.parentId == null ? '' : node.parentId;
        if (!childrenMap.has(parent)) childrenMap.set(parent, []);
        childrenMap.get(parent).push(node.id);
    }
    const incomplete = new Map();
    const visiting = new Set();
    const visit = (id) => {
        if (incomplete.has(id)) return incomplete.get(id);
        if (visiting.has(id)) return false;
        visiting.add(id);
        const node = byId.get(id);
        const kids = childrenMap.get(id) || [];
        let result;
        if (!node) result = false;
        else if (kids.length === 0) result = !node.completed;
        else result = kids.some(kid => visit(kid));
        visiting.delete(id);
        incomplete.set(id, result);
        return result;
    };
    for (const node of list) {
        if (node.parentId == null || node.id === MINDMAP_ROOT_ID || !byId.has(node.parentId)) {
            visit(node.id);
        }
    }
    for (const node of list) visit(node.id);

    const keptNodes = list.filter(n => incomplete.get(n.id));
    const keptIds = new Set(keptNodes.map(n => n.id));
    const keptEdges = (edges || []).filter(e => keptIds.has(e.from) && keptIds.has(e.to));
    return { nodes: keptNodes, hierarchyEdges: keptEdges };
}

export function buildMindmapGraph(project, tasks) {
    const rootTitle = project?.name || '目标计划';
    const rootTasks = tasks || [];
    const nodes = [{
        id: MINDMAP_ROOT_ID,
        title: rootTitle,
        depth: 0,
        parentId: null,
        completed: rootTasks.length > 0 && rootTasks.every(t => t.completed),
        priority: '',
        status: '',
        checkState: rootTasks.length > 0 ? getParentCheckState(rootTasks) : 'unchecked',
        hasChildren: rootTasks.length > 0,
        isRoot: true,
        imageCount: 0,
        images: []
    }];
    const hierarchyEdges = [];
    buildNodesFromTasks(rootTasks, MINDMAP_ROOT_ID, 1, nodes);
    for (const node of nodes) {
        if (!node.parentId) continue;
        hierarchyEdges.push({ from: node.parentId, to: node.id });
    }
    const annotated = annotateMindmapProgress(nodes);
    return { rootId: MINDMAP_ROOT_ID, nodes: annotated, hierarchyEdges };
}

export function layoutMindmap(nodes, hierarchyEdges, options = {}) {
    const opts = { ...DEFAULT_LAYOUT_OPTIONS, ...options };
    const list = nodes || [];
    const positions = new Map();
    if (list.length === 0) {
        return { positions, width: opts.padding * 2, height: opts.padding * 2 };
    }

    const childrenMap = new Map();
    const nodeMap = new Map();
    for (const node of list) {
        nodeMap.set(node.id, node);
        if (!childrenMap.has(node.parentId)) childrenMap.set(node.parentId, []);
        childrenMap.get(node.parentId).push(node.id);
    }

    for (const ids of childrenMap.values()) {
        ids.sort((a, b) => {
            const na = nodeMap.get(a);
            const nb = nodeMap.get(b);
            const orderA = na?.order ?? 0;
            const orderB = nb?.order ?? 0;
            if (orderA !== orderB) return orderA - orderB;
            return String(na?.title || '').localeCompare(String(nb?.title || ''), 'zh');
        });
    }

    const depthWidth = new Map();
    const sizeCache = new Map();
    const sizeOf = (node) => {
        if (!sizeCache.has(node.id)) sizeCache.set(node.id, estimateNodeSize(node.title || '', opts));
        return sizeCache.get(node.id);
    };
    for (const node of list) {
        const { w } = sizeOf(node);
        depthWidth.set(node.depth || 0, Math.max(depthWidth.get(node.depth || 0) || 0, w));
    }
    const depthX = new Map();
    let xCursor = opts.padding;
    const maxDepth = Math.max(0, ...list.map(n => n.depth || 0));
    for (let d = 0; d <= maxDepth; d += 1) {
        depthX.set(d, xCursor);
        xCursor += (depthWidth.get(d) || opts.nodeMinWidth) + opts.hGap;
    }

    const rootId = list.find(n => n.parentId == null)?.id
        ?? (nodeMap.has(MINDMAP_ROOT_ID) ? MINDMAP_ROOT_ID : list[0].id);

    let cursorY = opts.padding;

    const placeSubtree = (id) => {
        const node = nodeMap.get(id);
        const childIds = childrenMap.get(id) || [];
        const { w: width, h: height } = node
            ? sizeOf(node)
            : { w: opts.nodeMinWidth, h: opts.nodeMinHeight };
        const x = depthX.get(node?.depth || 0) ?? opts.padding;

        if (childIds.length === 0) {
            const y = cursorY;
            cursorY += height + opts.vGap;
            positions.set(id, { x, y, w: width, h: height });
            return { top: y, bottom: y + height, width };
        }

        const childBoxes = [];
        for (const childId of childIds) {
            childBoxes.push(placeSubtree(childId));
        }
        const first = childBoxes[0];
        const last = childBoxes[childBoxes.length - 1];
        const y = (first.top + last.bottom) / 2 - height / 2;
        positions.set(id, { x, y, w: width, h: height });
        return {
            top: Math.min(y, first.top),
            bottom: Math.max(y + height, last.bottom),
            width
        };
    };

    placeSubtree(rootId);

    for (const node of list) {
        if (positions.has(node.id)) continue;
        const x = depthX.get(node.depth || 0) ?? opts.padding;
        const { w: width, h: height } = sizeOf(node);
        const y = cursorY;
        cursorY += height + opts.vGap;
        positions.set(node.id, { x, y, w: width, h: height });
    }

    let maxX = 0;
    let maxY = 0;
    for (const pos of positions.values()) {
        maxX = Math.max(maxX, pos.x + pos.w);
        maxY = Math.max(maxY, pos.y + pos.h);
    }

    return {
        positions,
        width: Math.max(maxX + opts.padding, opts.padding * 2),
        height: Math.max(maxY + opts.padding, opts.padding * 2)
    };
}

export function mindmapLinksStorageKey(projectId) {
    return `${MINDMAP_LINKS_PREFIX}${projectId || ''}`;
}

export function mindmapViewStorageKey(projectId) {
    return `${MINDMAP_VIEW_PREFIX}${projectId || ''}`;
}

export function parseMindmapLinks(raw) {
    if (!raw) return [];
    try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map(item => {
                if (!item || typeof item !== 'object') return null;
                const fromId = item.fromId || item.from || '';
                const toId = item.toId || item.to || '';
                if (!fromId || !toId) return null;
                return { fromId, toId };
            })
            .filter(Boolean);
    } catch {
        return [];
    }
}

export function serializeMindmapLinks(links) {
    return JSON.stringify(normalizeMindmapLinks(links, null));
}

function linkKey(a, b) {
    return a < b ? `${a}::${b}` : `${b}::${a}`;
}

export function normalizeMindmapLinks(links, validIds) {
    const seen = new Set();
    const result = [];
    for (const link of links || []) {
        if (!link) continue;
        const fromId = link.fromId || link.from;
        const toId = link.toId || link.to;
        if (!fromId || !toId || fromId === toId) continue;
        if (fromId === MINDMAP_ROOT_ID || toId === MINDMAP_ROOT_ID) continue;
        if (validIds && (!validIds.has(fromId) || !validIds.has(toId))) continue;
        const key = linkKey(fromId, toId);
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({ fromId, toId });
    }
    return result;
}

export function toggleMindmapLink(links, fromId, toId) {
    if (!fromId || !toId || fromId === toId) return [...(links || [])];
    if (fromId === MINDMAP_ROOT_ID || toId === MINDMAP_ROOT_ID) return [...(links || [])];
    const key = linkKey(fromId, toId);
    const next = [];
    let removed = false;
    for (const link of links || []) {
        const a = link.fromId || link.from;
        const b = link.toId || link.to;
        if (a && b && linkKey(a, b) === key) {
            removed = true;
            continue;
        }
        next.push({ fromId: a, toId: b });
    }
    if (!removed) next.push({ fromId, toId });
    return normalizeMindmapLinks(next, null);
}

export function readMindmapLinks(storage, projectId) {
    if (!storage?.getItem) return [];
    try {
        return parseMindmapLinks(storage.getItem(mindmapLinksStorageKey(projectId)));
    } catch {
        return [];
    }
}

export function writeMindmapLinks(storage, projectId, links) {
    if (!storage?.setItem) return;
    try {
        storage.setItem(mindmapLinksStorageKey(projectId), serializeMindmapLinks(links));
    } catch {
        // ignore quota / private mode
    }
}

export function normalizeMindmapViewMode(value) {
    return value === 'mindmap' || value === 'list' ? value : null;
}

/** 初始视图优先级：路由 params.view > 一次性 open-view > 项目偏好 > fallback。 */
export function resolveInitialMindmapView(options = {}) {
    const fromRoute = normalizeMindmapViewMode(options.routeView);
    if (fromRoute) return fromRoute;
    const fromOpen = normalizeMindmapViewMode(options.openView);
    if (fromOpen) return fromOpen;
    return normalizeMindmapViewMode(options.storedView) || options.fallback || 'list';
}

export function readMindmapView(storage, projectId, fallback = 'list') {
    if (!storage?.getItem) return fallback;
    try {
        const value = storage.getItem(mindmapViewStorageKey(projectId));
        return value === 'mindmap' || value === 'list' ? value : fallback;
    } catch {
        return fallback;
    }
}

export function writeMindmapView(storage, projectId, view) {
    if (!storage?.setItem) return;
    const value = view === 'mindmap' ? 'mindmap' : 'list';
    try {
        storage.setItem(mindmapViewStorageKey(projectId), value);
    } catch {
        // ignore
    }
}

export function requestOpenMindmapView(storage, projectId) {
    if (!storage?.setItem) return;
    try {
        storage.setItem(MINDMAP_OPEN_VIEW_KEY, JSON.stringify({
            view: 'mindmap',
            projectId: projectId || ''
        }));
    } catch {
        // ignore
    }
}

export function consumeMindmapOpenView(storage, projectId) {
    if (!storage?.getItem || !storage?.removeItem) return null;
    try {
        const pending = storage.getItem(MINDMAP_OPEN_VIEW_KEY);
        if (!pending) return null;
        storage.removeItem(MINDMAP_OPEN_VIEW_KEY);
        if (pending === 'mindmap') return projectId ? null : 'mindmap';
        const parsed = JSON.parse(pending);
        if (parsed?.view !== 'mindmap') return null;
        if (!projectId || !parsed.projectId || parsed.projectId === projectId) return 'mindmap';
        return null;
    } catch {
        return null;
    }
}

export function hierarchyPathToRoot(nodes, taskId) {
    const map = new Map((nodes || []).map(n => [n.id, n]));
    const path = [];
    let current = map.get(taskId);
    while (current) {
        path.unshift(current.id);
        if (!current.parentId) break;
        current = map.get(current.parentId);
    }
    return path;
}

export function clampMindmapScale(scale) {
    const n = Number(scale);
    if (!Number.isFinite(n)) return 1;
    return Math.min(MINDMAP_SCALE_MAX, Math.max(MINDMAP_SCALE_MIN, n));
}

export function zoomMindmapAtPoint(transform, deltaY, pointX, pointY) {
    const base = {
        x: Number(transform?.x) || 0,
        y: Number(transform?.y) || 0,
        scale: clampMindmapScale(transform?.scale)
    };
    const factor = deltaY > 0 ? 0.9 : 1.1;
    const nextScale = clampMindmapScale(base.scale * factor);
    if (nextScale === base.scale) return base;
    const ratio = nextScale / base.scale;
    return {
        x: pointX - (pointX - base.x) * ratio,
        y: pointY - (pointY - base.y) * ratio,
        scale: nextScale
    };
}

export function fitMindmapTransform(contentSize, viewportSize, options = {}) {
    const padding = Number.isFinite(options.padding) ? options.padding : 24;
    const maxScale = Number.isFinite(options.maxScale) ? options.maxScale : 1.2;
    const contentW = Math.max(1, Number(contentSize?.width) || 0);
    const contentH = Math.max(1, Number(contentSize?.height) || 0);
    const viewW = Math.max(1, (Number(viewportSize?.width) || 0) - padding * 2);
    const viewH = Math.max(1, (Number(viewportSize?.height) || 0) - padding * 2);
    const raw = Math.min(viewW / contentW, viewH / contentH);
    const scale = Math.min(maxScale, Math.max(MINDMAP_SCALE_MIN, raw));
    return {
        x: padding + (viewW - contentW * scale) / 2,
        y: padding + (viewH - contentH * scale) / 2,
        scale
    };
}

export function focusMindmapTransform(positions, nodeId, viewportSize, options = {}) {
    const pos = positions?.get?.(nodeId);
    if (!pos) return null;
    const scale = clampMindmapScale(options.scale ?? 1.1);
    const width = Number(viewportSize?.width) || 0;
    const height = Number(viewportSize?.height) || 0;
    return {
        x: width / 2 - (pos.x + pos.w / 2) * scale,
        y: height / 2 - (pos.y + pos.h / 2) * scale,
        scale
    };
}

export function formatMindmapZoomLabel(scale) {
    return `${Math.round(clampMindmapScale(scale) * 100)}%`;
}

export function mindmapMaximizeStorageKey(projectId) {
    return `${MINDMAP_MAXIMIZE_PREFIX}${projectId || ''}`;
}

export function readMindmapMaximize(storage, projectId, fallback = false) {
    if (!storage?.getItem) return fallback;
    try {
        return storage.getItem(mindmapMaximizeStorageKey(projectId)) === '1';
    } catch {
        return fallback;
    }
}

export function writeMindmapMaximize(storage, projectId, enabled) {
    if (!storage?.setItem) return;
    try {
        if (enabled) storage.setItem(mindmapMaximizeStorageKey(projectId), '1');
        else storage.removeItem(mindmapMaximizeStorageKey(projectId));
    } catch {
        // ignore
    }
}

export function easeMindmapCameraCubic(t) {
    const n = Math.min(1, Math.max(0, Number(t) || 0));
    // ease-out cubic：起手快、收尾稳，接近 Figma/Miro 相机手感
    return 1 - Math.pow(1 - n, 3);
}

export function interpolateMindmapTransform(from, to, t) {
    const p = easeMindmapCameraCubic(t);
    const fromScale = clampMindmapScale(from?.scale);
    const toScale = clampMindmapScale(to?.scale);
    return {
        x: (Number(from?.x) || 0) + ((Number(to?.x) || 0) - (Number(from?.x) || 0)) * p,
        y: (Number(from?.y) || 0) + ((Number(to?.y) || 0) - (Number(from?.y) || 0)) * p,
        scale: fromScale + (toScale - fromScale) * p
    };
}

export function stepMindmapInertia(velocity, options = {}) {
    const friction = Number.isFinite(options.friction) ? options.friction : MINDMAP_INERTIA_FRICTION;
    const minSpeed = Number.isFinite(options.minSpeed) ? options.minSpeed : MINDMAP_INERTIA_MIN_SPEED;
    const vx = (Number(velocity?.x) || 0) * friction;
    const vy = (Number(velocity?.y) || 0) * friction;
    const speed = Math.hypot(vx, vy);
    if (speed < minSpeed) {
        return { x: 0, y: 0, active: false };
    }
    return { x: vx, y: vy, active: true };
}

export function estimateMindmapPanVelocity(samples, windowMs = MINDMAP_PAN_VELOCITY_WINDOW_MS) {
    const list = Array.isArray(samples) ? samples.filter(Boolean) : [];
    if (list.length < 2) return { x: 0, y: 0 };
    const last = list[list.length - 1];
    let ref = list[0];
    for (let i = list.length - 1; i >= 0; i -= 1) {
        if (last.t - list[i].t <= windowMs) ref = list[i];
        else break;
    }
    const dt = Math.max(1, last.t - ref.t);
    return {
        x: (last.x - ref.x) / dt,
        y: (last.y - ref.y) / dt
    };
}

export function assignMindmapBranchColors(nodes) {
    const list = nodes || [];
    const result = new Map();
    const childrenMap = new Map();
    for (const node of list) {
        const parent = node.parentId == null ? '' : node.parentId;
        if (!childrenMap.has(parent)) childrenMap.set(parent, []);
        childrenMap.get(parent).push(node.id);
    }
    const roots = childrenMap.get(MINDMAP_ROOT_ID) || childrenMap.get('') || list.filter(n => n.parentId == null).map(n => n.id);
    roots.forEach((rootId, index) => {
        const color = MINDMAP_BRANCH_COLORS[index % MINDMAP_BRANCH_COLORS.length];
        const stack = [rootId];
        while (stack.length) {
            const id = stack.pop();
            if (!id || result.has(id)) continue;
            result.set(id, color);
            for (const childId of childrenMap.get(id) || []) stack.push(childId);
        }
    });
    result.set(MINDMAP_ROOT_ID, MINDMAP_ROOT_COLOR);
    return result;
}

export function orthogonalEdgePath(fromPos, toPos, options = {}) {
    if (!fromPos || !toPos) return '';
    const stub = Number.isFinite(options.stub) ? options.stub : MINDMAP_ORTHO_OPTIONS.stub;
    const radius = Number.isFinite(options.radius) ? options.radius : MINDMAP_ORTHO_OPTIONS.radius;
    const x1 = fromPos.x + fromPos.w;
    const y1 = fromPos.y + fromPos.h / 2;
    const x2 = toPos.x;
    const y2 = toPos.y + toPos.h / 2;
    if (Math.abs(y2 - y1) < 0.5) {
        return `M ${x1} ${y1} H ${Math.max(x1, x2)}`;
    }
    // 同一父节点的子节点共享同一竖脊，避免扫把状长弧
    const midX = x1 + stub;
    const dir = y2 > y1 ? 1 : -1;
    const maxR = Math.min(
        radius,
        Math.abs(y2 - y1) / 2,
        Math.max(1, Math.abs(midX - x1)),
        Math.max(1, Math.abs(x2 - midX) || stub)
    );
    const r = Math.max(0, maxR);
    if (x2 <= midX + 0.5) {
        return `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`;
    }
    return [
        `M ${x1} ${y1}`,
        `H ${midX - r}`,
        `Q ${midX} ${y1} ${midX} ${y1 + dir * r}`,
        `V ${y2 - dir * r}`,
        `Q ${midX} ${y2} ${midX + r} ${y2}`,
        `H ${x2}`
    ].join(' ');
}

export function buildMindmapHierarchyEdgePaths(nodes, positions, hierarchyEdges, options = {}) {
    const colorMap = assignMindmapBranchColors(nodes);
    return (hierarchyEdges || []).map(edge => {
        const fromPos = positions.get(edge.from);
        const toPos = positions.get(edge.to);
        if (!fromPos || !toPos) return null;
        const toNode = (nodes || []).find(n => n.id === edge.to);
        const depth = toNode?.depth || 1;
        const color = colorMap.get(edge.to) || colorMap.get(edge.from) || MINDMAP_ROOT_COLOR;
        return {
            from: edge.from,
            to: edge.to,
            d: orthogonalEdgePath(fromPos, toPos, options),
            color,
            depth,
            opacity: Math.max(0.45, 1 - Math.max(0, depth - 1) * 0.12)
        };
    }).filter(Boolean);
}
