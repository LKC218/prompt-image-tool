import { isCapacitor } from '../core/storage.js';
import { optimizeImageDataUrl } from '../shared/image-utils.js';

export const TASK_PRIORITIES = [
    { key: 'high', label: '高', color: '#EF4444' },
    { key: 'medium', label: '中', color: '#F59E0B' },
    { key: 'low', label: '低', color: '#3B82F6' }
];

export function getTaskPriorityColor(priority) {
    return TASK_PRIORITIES.find(p => p.key === priority)?.color || '';
}

export function getTaskPriorityLabel(priority) {
    return TASK_PRIORITIES.find(p => p.key === priority)?.label || '';
}

export const TASK_STATUS_EXECUTING = 'executing';

export function isTaskExecuting(task) {
    return task?.status === TASK_STATUS_EXECUTING;
}

export function calcTaskTreeStats(tasks) {
    const flat = flattenTasks(tasks);
    const total = flat.length;
    const completed = flat.filter(t => t.completed).length;
    return {
        total,
        completed,
        progress: total > 0 ? Math.round((completed / total) * 100) : 0
    };
}

export function getParentCheckState(children) {
    if (!children || children.length === 0) return 'unchecked';
    const completedCount = children.filter(c => c.completed).length;
    if (completedCount === 0) return 'unchecked';
    if (completedCount === children.length) return 'checked';
    return 'indeterminate';
}

export function isParentChecked(children) {
    return getParentCheckState(children) === 'checked';
}

export function setTaskTreeCompletion(task, completed) {
    if (!task) return;
    task.completed = !!completed;
    for (const child of task.children || []) {
        setTaskTreeCompletion(child, completed);
    }
}

export function flattenTasks(tree, parentId = '') {
    const result = [];
    for (const task of tree || []) {
        const { children, ...rest } = task;
        result.push({ ...rest, parentId });
        if (children && children.length > 0) {
            result.push(...flattenTasks(children, task.id));
        }
    }
    return result;
}

export function buildTaskTree(flat, parentId = '') {
    return flat
        .filter(t => (t.parentId || '') === parentId)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(t => {
            const { parentId: _p, ...rest } = t;
            return {
                ...rest,
                children: buildTaskTree(flat, t.id)
            };
        });
}

/**
 * 按完成状态对任务列表排序：未完成的任务在前，已完成的任务在后。
 * 同组内保持原有 order 相对顺序；递归处理子任务并更新 order 字段。
 */
export function sortTasksByCompletion(list) {
    if (!Array.isArray(list)) return list;
    const sorted = [...list].sort((a, b) => {
        const aCompleted = a.completed ? 1 : 0;
        const bCompleted = b.completed ? 1 : 0;
        if (aCompleted !== bCompleted) return aCompleted - bCompleted;
        return (a.order || 0) - (b.order || 0);
    });
    sorted.forEach((task, index) => {
        task.order = index;
        if (task.children && task.children.length > 0) {
            task.children = sortTasksByCompletion(task.children);
        }
    });
    return sorted;
}

export function generateGoalId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export function formatBytes(bytes) {
    const n = typeof bytes === 'number' ? bytes : 0;
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
    return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export async function compressToWebp(dataUrl, options = {}) {
    const { quality = 0.85, maxWidth = 1920, maxHeight = 1920 } = options;
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            let { width, height } = img;
            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }
            if (height > maxHeight) {
                width = Math.round((width * maxHeight) / height);
                height = maxHeight;
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            try {
                const webpUrl = canvas.toDataURL('image/webp', quality);
                resolve(webpUrl);
            } catch (_) {
                resolve(dataUrl);
            }
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
    });
}

// 缩略图缓存：url -> Promise<blobUrl>
const goalThumbCache = new Map();
const GOAL_THUMB_WIDTH = 320;

function createGoalThumb(sourceUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                let { width, height } = img;
                if (width > GOAL_THUMB_WIDTH) {
                    height = Math.round((height * GOAL_THUMB_WIDTH) / width);
                    width = GOAL_THUMB_WIDTH;
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    resolve(blob ? URL.createObjectURL(blob) : sourceUrl);
                }, 'image/webp', 0.75);
            } catch (_) {
                resolve(sourceUrl);
            }
        };
        img.onerror = () => resolve(sourceUrl);
        img.src = sourceUrl;
    });
}

export async function getGoalThumbUrl(sourceUrl) {
    if (!sourceUrl) return sourceUrl;
    if (!goalThumbCache.has(sourceUrl)) {
        goalThumbCache.set(sourceUrl, createGoalThumb(sourceUrl));
    }
    return goalThumbCache.get(sourceUrl);
}

// 释放全部缩略图 Blob URL（页面卸载时调用）
export function releaseGoalThumbUrls() {
    for (const promise of goalThumbCache.values()) {
        promise.then((url) => {
            if (url.startsWith('blob:')) URL.revokeObjectURL(url);
        });
    }
    goalThumbCache.clear();
}

export function getImageMimeType(dataUrl = '') {
    const header = dataUrl.split(',')[0] || '';
    if (header.includes('image/jpeg') || header.includes('image/jpg')) return 'image/jpeg';
    if (header.includes('image/webp')) return 'image/webp';
    if (header.includes('image/gif')) return 'image/gif';
    return 'image/png';
}

export function getImageExtension(dataUrl = '') {
    const mime = getImageMimeType(dataUrl);
    if (mime === 'image/jpeg') return 'jpg';
    if (mime === 'image/webp') return 'webp';
    if (mime === 'image/gif') return 'gif';
    return 'png';
}

export async function importGoalImage(storage, projectId, taskId, dataUrl, name = '') {
    const imageId = generateGoalId();
    const ext = getImageExtension(dataUrl);
    const fileName = name ? `${imageId}-${name.split(/[\\/]/).pop()}` : `${imageId}.${ext}`;

    if (isCapacitor) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const header = dataUrl.split(',')[0];
        const base64Data = dataUrl.split(',')[1] || '';
        const relPath = `goal_images/${projectId}/${fileName}`;
        await Filesystem.writeFile({
            path: relPath,
            data: base64Data,
            directory: Directory.Data,
            recursive: true
        });
        return storage.addGoalTaskImage(taskId, relPath, name || fileName);
    }

    return storage.uploadGoalImage(projectId, imageId, dataUrl);
}

export function getGoalImageUrl(storage, path) {
    if (!path) return '';
    if (storage.getGoalImageUrl) {
        return storage.getGoalImageUrl(path);
    }
    if (isCapacitor) {
        return path;
    }
    return path;
}

export function getProjectInitials(name = '') {
    const trimmed = name.trim();
    if (!trimmed) return '?';
    const first = trimmed[0];
    if (/[a-zA-Z]/.test(first)) {
        const rest = trimmed.slice(1).trim();
        const second = rest[0] || '';
        return (first.toUpperCase() + second.toUpperCase()).slice(0, 2);
    }
    return trimmed.slice(0, 2);
}

export function generateProjectCoverGradient(name = '') {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue1 = Math.abs(hash % 360);
    const hue2 = (hue1 + 40) % 360;
    return `linear-gradient(135deg, hsl(${hue1} 72% 82%), hsl(${hue2} 72% 72%))`;
}

export const GOAL_COVER_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const GOAL_COVER_MAX_SOURCE_BYTES = 15 * 1024 * 1024;
export const GOAL_COVER_OPTIMIZE_OPTIONS = {
    quality: 0.85,
    maxSide: 1600,
    maxInputPixels: 24 * 1000 * 1000,
    outputType: 'image/webp',
    background: '#FFFFFF'
};

function buildOriginalCoverOptimizeResult(dataUrl = '') {
    const mimeType = getImageMimeType(dataUrl);
    return {
        dataUrl,
        mimeType,
        extension: getImageExtension(dataUrl),
        size: 0,
        originalSize: 0,
        width: 0,
        height: 0,
        originalWidth: 0,
        originalHeight: 0,
        usedOriginal: true,
        resized: false
    };
}

export async function optimizeGoalCoverDataUrl(dataUrl, options = GOAL_COVER_OPTIMIZE_OPTIONS) {
    try {
        return await optimizeImageDataUrl(dataUrl, options);
    } catch (_) {
        return buildOriginalCoverOptimizeResult(dataUrl);
    }
}

export function resolveGoalCoverExtension(optimized, dataUrl = '') {
    if (optimized && optimized.usedOriginal === false && optimized.extension) {
        return optimized.extension;
    }
    return getImageExtension(dataUrl);
}

export function buildGoalCoverFileName(imageId, name = '', ext = 'png') {
    const original = name ? String(name).split(/[\\/]/).pop() : '';
    const base = original.replace(/\.[^.]+$/, '').trim();
    if (!base) return `${imageId}.${ext}`;
    return `${imageId}-${base}.${ext}`;
}

export async function importGoalProjectCover(storage, projectId, dataUrl, name = '') {
    const imageId = generateGoalId();
    const optimized = await optimizeGoalCoverDataUrl(dataUrl);
    const finalDataUrl = optimized?.dataUrl || dataUrl;
    const ext = resolveGoalCoverExtension(optimized, finalDataUrl);
    const fileName = buildGoalCoverFileName(imageId, name, ext);

    if (isCapacitor) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const base64Data = finalDataUrl.split(',')[1] || '';
        const relPath = `goal_images/${projectId}/cover/${fileName}`;
        await Filesystem.writeFile({
            path: relPath,
            data: base64Data,
            directory: Directory.Data,
            recursive: true
        });
        return relPath;
    }

    const result = await storage.uploadGoalImage(projectId, imageId, finalDataUrl);
    return result?.path || result || '';
}

export async function readGoalImageDataUrl(path) {
    if (!path) return null;
    try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const result = await Filesystem.readFile({
            path,
            directory: Directory.Data
        });
        const data = String(result.data || '');
        if (!data) return null;
        if (data.startsWith('data:')) return data;
        const ext = path.split('.').pop()?.toLowerCase();
        let mime = 'image/png';
        if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
        else if (ext === 'webp') mime = 'image/webp';
        else if (ext === 'gif') mime = 'image/gif';
        return `data:${mime};base64,${data}`;
    } catch (e) {
        return null;
    }
}

export function collectGoalImagePaths(tasks) {
    const paths = [];
    for (const task of tasks || []) {
        for (const img of task.images || []) {
            if (img.path) paths.push(img.path);
        }
        paths.push(...collectGoalImagePaths(task.children));
    }
    return paths;
}
