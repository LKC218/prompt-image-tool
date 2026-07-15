import { pcIcon } from './pc-icon-assets.js';
import { getStorage } from './storage.js';
import { downloadImage } from './image-download-utils.js';

let contextMenuTargetId = null;
let folderContextMenuTargetId = null;
let contextMenuSession = null;
let contextMenuOpenTimer = null;
let contextMenuEventsBound = false;
const IMAGE_VIEWER_MIN_SCALE = 1;
const IMAGE_VIEWER_MAX_SCALE = 5;
const IMAGE_VIEWER_WHEEL_STEP = 1.12;
const IMAGE_VIEWER_DOUBLE_CLICK_SCALE = 2;
const imageViewerState = {
    scale: 1,
    translateX: 0,
    translateY: 0,
    isDragging: false,
    pointerId: null,
    dragStartX: 0,
    dragStartY: 0,
    startTranslateX: 0,
    startTranslateY: 0
};
let imageViewerDownloadTarget = { url: '', filename: '', sourceFile: '' };

function getPcApp() {
    return document.getElementById('pcApp');
}

function ensureToastContainer() {
    let container = document.getElementById('pcToastContainer');
    if (!container) {
        container = document.createElement('div');
        container.className = 'pc-toast-container';
        container.id = 'pcToastContainer';
        const app = getPcApp();
        if (app) app.appendChild(container);
        else document.body.appendChild(container);
    }
    return container;
}

function showToast(message, type = 'success') {
    const container = ensureToastContainer();
    const toast = document.createElement('div');
    toast.className = `pc-toast pc-toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('pc-toast-show'));
    setTimeout(() => {
        toast.classList.remove('pc-toast-show');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

function showModal(content) {
    let overlay = document.getElementById('pcModalOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'pc-modal-overlay';
        overlay.id = 'pcModalOverlay';
        const modal = document.createElement('div');
        modal.className = 'pc-modal';
        modal.id = 'pcModalContent';
        overlay.appendChild(modal);
        const app = getPcApp();
        if (app) app.appendChild(overlay);
        else document.body.appendChild(overlay);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });
    }
    const modal = document.getElementById('pcModalContent');
    modal.innerHTML = content;
    overlay.classList.add('pc-modal-active');
    return modal;
}

function closeModal() {
    const overlay = document.getElementById('pcModalOverlay');
    if (overlay && overlay.classList.contains('pc-modal-active')) {
        overlay.classList.remove('pc-modal-active');
    }
}

function showConfirmModal(message, onConfirm) {
    const modal = showModal(`
        <h3>确认操作</h3>
        <p class="pc-modal-desc">${message}</p>
        <div class="pc-modal-actions">
            <button class="pc-btn pc-btn-secondary" id="pcModalCancel">取消</button>
            <button class="pc-btn pc-btn-danger" id="pcModalConfirm">确定</button>
        </div>
    `);
    modal.querySelector('#pcModalCancel').addEventListener('click', closeModal);
    modal.querySelector('#pcModalConfirm').addEventListener('click', () => {
        closeModal();
        onConfirm();
    });
}

function prepareMoreButton(button) {
    if (!button || button.querySelector('.pc-more-dots')) return;
    button.innerHTML = '<span class="pc-more-dots" aria-hidden="true"><span></span><span></span><span></span></span>';
}

function getContextMenuPlacement(menu, x, y, anchor, options = {}) {
    const referenceRect = options.referenceRect;
    const placementOptions = options.placement || {};
    const margin = placementOptions.safeMargin ?? 8;
    const gap = placementOptions.gap ?? 8;
    const rect = menu.getBoundingClientRect();
    const anchorRect = anchor?.getBoundingClientRect();
    if (referenceRect) {
        const centerX = referenceRect.left + referenceRect.width / 2;
        const preferredSide = placementOptions.preferredSide ?? 'top';
        const fallbackSide = placementOptions.fallbackSide ?? 'bottom';
        const availableAbove = referenceRect.top - gap - margin;
        const availableBelow = window.innerHeight - margin - referenceRect.bottom - gap;
        const openAbove = preferredSide === 'top'
            ? (availableAbove >= rect.height || (availableBelow < rect.height && availableAbove >= availableBelow))
            : !(availableBelow >= rect.height || (availableAbove < rect.height && availableBelow >= availableAbove));
        const preferredX = centerX - rect.width / 2;
        const preferredY = openAbove
            ? referenceRect.top - gap - rect.height
            : referenceRect.bottom + gap;

        menu.classList.remove('pc-context-extend-left', 'pc-context-extend-right');
        menu.classList.toggle('pc-context-open-above', openAbove);
        menu.classList.toggle('pc-context-open-below', !openAbove);
        menu.dataset.contextPlacement = openAbove ? preferredSide : fallbackSide;

        return {
            left: Math.max(margin, Math.min(preferredX, window.innerWidth - rect.width - margin)),
            top: Math.max(margin, Math.min(preferredY, window.innerHeight - rect.height - margin))
        };
    }
    const extendLeft = anchorRect
        ? anchorRect.left + anchorRect.width / 2 >= window.innerWidth / 2
        : x >= window.innerWidth / 2;
    const openAbove = anchorRect
        ? anchorRect.bottom + gap + rect.height > window.innerHeight - margin && anchorRect.top - gap - rect.height >= margin
        : y + rect.height > window.innerHeight - margin && y - rect.height >= margin;
    const preferredX = anchorRect
        ? (extendLeft ? anchorRect.right - rect.width : anchorRect.left)
        : (extendLeft ? x - rect.width : x);
    const preferredY = anchorRect
        ? (openAbove ? anchorRect.top - gap - rect.height : anchorRect.bottom + gap)
        : (openAbove ? y - rect.height : y);

    menu.classList.toggle('pc-context-extend-left', extendLeft);
    menu.classList.toggle('pc-context-extend-right', !extendLeft);
    menu.classList.toggle('pc-context-open-above', openAbove);
    menu.classList.toggle('pc-context-open-below', !openAbove);
    delete menu.dataset.contextPlacement;

    return {
        left: Math.max(margin, Math.min(preferredX, window.innerWidth - rect.width - margin)),
        top: Math.max(margin, Math.min(preferredY, window.innerHeight - rect.height - margin))
    };
}

function clearContextMenuSession(result = null, restoreFocus = true) {
    if (contextMenuOpenTimer) {
        clearTimeout(contextMenuOpenTimer);
        contextMenuOpenTimer = null;
    }

    const session = contextMenuSession;
    contextMenuSession = null;
    if (!session) return;

    session.anchor?.classList.remove('pc-more-btn-opening', 'pc-more-btn-active');
    session.anchor?.setAttribute('aria-expanded', 'false');
    if (restoreFocus && session.restoreFocusElement?.isConnected) session.restoreFocusElement.focus({ preventScroll: true });
    session.resolve(result);
}

function bindContextMenuEvents() {
    if (contextMenuEventsBound) return;
    contextMenuEventsBound = true;

    document.addEventListener('pointerdown', (e) => {
        const menu = document.getElementById('pcContextMenu');
        if (!menu?.classList.contains('pc-context-active')) return;
        if (menu.contains(e.target) || contextMenuSession?.anchor?.contains(e.target)) return;
        hideContextMenu();
    });
    document.addEventListener('scroll', () => hideContextMenu(), true);
    document.addEventListener('keydown', (e) => {
        const menu = document.getElementById('pcContextMenu');
        if (!menu?.classList.contains('pc-context-active')) return;
        const buttons = [...menu.querySelectorAll('.pc-context-action')];
        const currentIndex = buttons.indexOf(document.activeElement);
        if (e.key === 'Escape') {
            e.preventDefault();
            hideContextMenu();
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const direction = e.key === 'ArrowDown' ? 1 : -1;
            buttons[(currentIndex + direction + buttons.length) % buttons.length]?.focus();
        } else if ((e.key === 'Enter' || e.key === ' ') && currentIndex >= 0) {
            e.preventDefault();
            buttons[currentIndex].click();
        }
    });
}

function showContextMenu(x, y, items, options = {}) {
    let menu = document.getElementById('pcContextMenu');
    if (!menu) {
        menu = document.createElement('div');
        menu.className = 'pc-context-menu';
        menu.id = 'pcContextMenu';
        menu.setAttribute('role', 'menu');
        const app = getPcApp();
        if (app) app.appendChild(menu);
        else document.body.appendChild(menu);
    }
    bindContextMenuEvents();

    const anchor = options.anchor instanceof Element ? options.anchor : null;
    const restoreFocusElement = options.restoreFocusElement instanceof Element ? options.restoreFocusElement : anchor;
    const preserveFocus = options.focusMenu === false;
    if (contextMenuSession?.anchor === anchor) {
        hideContextMenu();
        return Promise.resolve(null);
    }
    hideContextMenu(null, false);

    return new Promise((resolve) => {
        contextMenuSession = { anchor, restoreFocusElement, preserveFocus, resolve };
        const open = () => {
            if (!contextMenuSession || contextMenuSession.resolve !== resolve) return;
            menu.innerHTML = items.filter(item => !item.divider).map((item, index) => {
                const tone = item.tone ? ` pc-context-tone-${item.tone}` : '';
                return `<button type="button" class="pc-context-action${tone} ${item.danger ? 'pc-context-danger' : ''}" role="menuitem" data-action="${item.action}" style="--pc-context-index:${index}">
                    <span class="pc-context-label">${item.label}</span>
                    <span class="pc-context-icon${tone}">${item.icon || ''}</span>
                </button>`;
            }).join('');
            menu.style.visibility = 'hidden';
            menu.classList.add('pc-context-active');

            const placement = getContextMenuPlacement(menu, x, y, anchor, options);
            menu.style.left = `${placement.left}px`;
            menu.style.top = `${placement.top}px`;
            menu.style.visibility = '';
            menu.classList.toggle('pc-context-preserve-focus', preserveFocus);
            anchor?.classList.remove('pc-more-btn-opening');
            anchor?.classList.add('pc-more-btn-active');
            anchor?.setAttribute('aria-expanded', 'true');
            if (!preserveFocus) menu.querySelector('.pc-context-action')?.focus({ preventScroll: true });

            menu.onpointerdown = (e) => {
                if (contextMenuSession?.preserveFocus && e.target.closest('.pc-context-action')) {
                    e.preventDefault();
                }
            };

            menu.onclick = (e) => {
                const action = e.target.closest('.pc-context-action')?.dataset.action;
                if (!action) return;
                hideContextMenu(action, false);
            }
        };
        if (options.source === 'more' && anchor) {
            prepareMoreButton(anchor);
            anchor.classList.remove('pc-more-btn-opening');
            void anchor.offsetWidth;
            anchor.classList.add('pc-more-btn-opening');
            anchor.setAttribute('aria-controls', 'pcContextMenu');
            anchor.setAttribute('aria-expanded', 'false');
            if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
                open();
            } else {
                contextMenuOpenTimer = setTimeout(() => {
                    contextMenuOpenTimer = null;
                    open();
                }, 220);
            }
        } else {
            open();
        }
    });
}

function hideContextMenu(result = null, restoreFocus = true) {
    const menu = document.getElementById('pcContextMenu');
    if (menu) {
        menu.classList.remove('pc-context-active', 'pc-context-preserve-focus');
        menu.onpointerdown = null;
    }
    clearContextMenuSession(result, restoreFocus);
}

function setContextMenuTargetId(id) {
    contextMenuTargetId = id;
}

function getContextMenuTargetId() {
    return contextMenuTargetId;
}

function setFolderContextMenuTargetId(id) {
    folderContextMenuTargetId = id;
}

function getFolderContextMenuTargetId() {
    return folderContextMenuTargetId;
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function getImageViewerParts() {
    return {
        viewer: document.getElementById('pcImageViewer'),
        stage: document.getElementById('pcImageViewerStage'),
        img: document.getElementById('pcImageViewerImg'),
        zoom: document.getElementById('pcImageViewerZoom'),
        reset: document.getElementById('pcImageViewerReset'),
        download: document.getElementById('pcImageViewerDownload')
    };
}

function normalizeImageViewerInput(input) {
    if (typeof input === 'string') {
        return { url: input, filename: '', sourceFile: '' };
    }
    const image = input?.image || input?.data || {};
    return {
        url: input?.src || input?.url || '',
        filename: input?.filename || image.name || image.file || '',
        sourceFile: input?.sourceFile || image.file || ''
    };
}

function getImageViewerStorage() {
    try {
        return getStorage();
    } catch (e) {
        return null;
    }
}

function getImageViewerTranslateLimit() {
    const { stage, img } = getImageViewerParts();
    if (!stage || !img) return { x: 0, y: 0 };

    const stageRect = stage.getBoundingClientRect();
    const scaledWidth = img.offsetWidth * imageViewerState.scale;
    const scaledHeight = img.offsetHeight * imageViewerState.scale;

    return {
        x: scaledWidth > stageRect.width ? (scaledWidth - stageRect.width) / 2 + 32 : 0,
        y: scaledHeight > stageRect.height ? (scaledHeight - stageRect.height) / 2 + 32 : 0
    };
}

function clampImageViewerTranslate() {
    if (imageViewerState.scale <= IMAGE_VIEWER_MIN_SCALE) {
        imageViewerState.translateX = 0;
        imageViewerState.translateY = 0;
        return;
    }

    const limit = getImageViewerTranslateLimit();
    imageViewerState.translateX = clamp(imageViewerState.translateX, -limit.x, limit.x);
    imageViewerState.translateY = clamp(imageViewerState.translateY, -limit.y, limit.y);
}

function applyImageViewerTransform() {
    const { viewer, img, zoom, reset } = getImageViewerParts();
    if (!viewer || !img) return;

    clampImageViewerTranslate();
    img.style.transform = `translate(${imageViewerState.translateX}px, ${imageViewerState.translateY}px) scale(${imageViewerState.scale})`;
    img.classList.toggle('pc-image-viewer-img-dragging', imageViewerState.isDragging);
    viewer.classList.toggle('pc-image-viewer-zoomed', imageViewerState.scale > IMAGE_VIEWER_MIN_SCALE);

    if (zoom) zoom.textContent = `${Math.round(imageViewerState.scale * 100)}%`;
    if (reset) reset.disabled = imageViewerState.scale <= IMAGE_VIEWER_MIN_SCALE;
}

function resetImageViewerTransform() {
    imageViewerState.scale = IMAGE_VIEWER_MIN_SCALE;
    imageViewerState.translateX = 0;
    imageViewerState.translateY = 0;
    imageViewerState.isDragging = false;
    imageViewerState.pointerId = null;
    applyImageViewerTransform();
}

function zoomImageViewerAt(clientX, clientY, nextScale) {
    const { stage } = getImageViewerParts();
    if (!stage) return;

    const previousScale = imageViewerState.scale;
    const scale = clamp(nextScale, IMAGE_VIEWER_MIN_SCALE, IMAGE_VIEWER_MAX_SCALE);
    if (Math.abs(scale - previousScale) < 0.001) return;

    if (scale <= IMAGE_VIEWER_MIN_SCALE) {
        resetImageViewerTransform();
        return;
    }

    const stageRect = stage.getBoundingClientRect();
    const pointerX = clientX - stageRect.left - stageRect.width / 2;
    const pointerY = clientY - stageRect.top - stageRect.height / 2;
    const ratio = scale / previousScale;

    imageViewerState.scale = scale;
    imageViewerState.translateX = pointerX - (pointerX - imageViewerState.translateX) * ratio;
    imageViewerState.translateY = pointerY - (pointerY - imageViewerState.translateY) * ratio;
    applyImageViewerTransform();
}

function handleImageViewerWheel(e) {
    e.preventDefault();
    const direction = e.deltaY < 0 ? 1 : -1;
    const factor = direction > 0 ? IMAGE_VIEWER_WHEEL_STEP : 1 / IMAGE_VIEWER_WHEEL_STEP;
    zoomImageViewerAt(e.clientX, e.clientY, imageViewerState.scale * factor);
}

function handleImageViewerPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (imageViewerState.scale <= IMAGE_VIEWER_MIN_SCALE) return;

    e.preventDefault();
    e.stopPropagation();

    imageViewerState.isDragging = true;
    imageViewerState.pointerId = e.pointerId;
    imageViewerState.dragStartX = e.clientX;
    imageViewerState.dragStartY = e.clientY;
    imageViewerState.startTranslateX = imageViewerState.translateX;
    imageViewerState.startTranslateY = imageViewerState.translateY;

    e.currentTarget.setPointerCapture(e.pointerId);
    applyImageViewerTransform();
}

function handleImageViewerPointerMove(e) {
    if (!imageViewerState.isDragging || imageViewerState.pointerId !== e.pointerId) return;

    const deltaX = e.clientX - imageViewerState.dragStartX;
    const deltaY = e.clientY - imageViewerState.dragStartY;
    imageViewerState.translateX = imageViewerState.startTranslateX + deltaX;
    imageViewerState.translateY = imageViewerState.startTranslateY + deltaY;
    applyImageViewerTransform();
}

function stopImageViewerDrag(e) {
    if (!imageViewerState.isDragging) return;
    if (e && imageViewerState.pointerId === e.pointerId && e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
    }

    imageViewerState.isDragging = false;
    imageViewerState.pointerId = null;
    applyImageViewerTransform();
}

function handleImageViewerDblClick(e) {
    e.preventDefault();
    e.stopPropagation();

    if (imageViewerState.scale > IMAGE_VIEWER_MIN_SCALE) {
        resetImageViewerTransform();
        return;
    }

    zoomImageViewerAt(e.clientX, e.clientY, IMAGE_VIEWER_DOUBLE_CLICK_SCALE);
}

async function performImageViewerDownload(format = 'original') {
    const { download } = getImageViewerParts();
    if (!imageViewerDownloadTarget.url || download?.disabled) return;

    if (download) download.disabled = true;
    try {
        const isJpgExport = format === 'jpg';
        const result = await downloadImage({
            url: imageViewerDownloadTarget.url,
            filename: imageViewerDownloadTarget.filename || 'preview.png',
            sourceFile: imageViewerDownloadTarget.sourceFile,
            storage: getImageViewerStorage(),
            preferFilePicker: true,
            preferBackend: true,
            format,
            historyContext: {
                platform: 'pc',
                source: isJpgExport ? '图片查看器-JPG导出' : '图片查看器',
                title: imageViewerDownloadTarget.filename || (isJpgExport ? '预览图片.jpg' : '预览图片'),
            },
        });
        if (result?.canceled) {
            showToast('已取消下载', 'warning');
        } else if (result?.success) {
            const location = result.locationLabel || result.path || result.directory || '所选位置';
            showToast(isJpgExport ? `JPG 已导出到${location}` : `图片已保存到${location}`, 'success');
        }
    } catch (error) {
        console.error('download image failed:', error);
        showToast(format === 'jpg' ? 'JPG 导出失败' : '图片下载失败', 'error');
    } finally {
        if (download) download.disabled = false;
    }
}

async function handleImageViewerDownload(e) {
    e.preventDefault();
    e.stopPropagation();

    const { download } = getImageViewerParts();
    if (!imageViewerDownloadTarget.url || download?.disabled) return;

    const action = await showContextMenu(e.clientX, e.clientY, [
        { action: 'original', icon: pcIcon('download'), label: '下载原格式' },
        { action: 'jpg', icon: pcIcon('download'), label: '导出 JPG' },
    ]);
    if (!action) return;
    await performImageViewerDownload(action);
}

function ensureImageViewer() {
    let viewer = document.getElementById('pcImageViewer');
    if (!viewer) {
        viewer = document.createElement('div');
        viewer.className = 'pc-image-viewer';
        viewer.id = 'pcImageViewer';
        viewer.setAttribute('role', 'dialog');
        viewer.setAttribute('aria-modal', 'true');
        viewer.setAttribute('aria-label', '图片查看器');
        viewer.tabIndex = -1;
        viewer.innerHTML = `
            <div class="pc-image-viewer-toolbar" aria-label="图片查看工具">
                <span class="pc-image-viewer-zoom" id="pcImageViewerZoom">100%</span>
                <button class="pc-image-viewer-tool" id="pcImageViewerReset" type="button" title="复位" aria-label="复位图片">${pcIcon('rotateCcw', 'pc-image-viewer-tool-icon')}</button>
                <button class="pc-image-viewer-tool" id="pcImageViewerDownload" type="button" title="下载图片" aria-label="下载当前图片">${pcIcon('download', 'pc-image-viewer-tool-icon')}</button>
                <button class="pc-image-viewer-tool" id="pcImageViewerClose" type="button" title="关闭" aria-label="关闭图片查看器">${pcIcon('x', 'pc-image-viewer-tool-icon')}</button>
            </div>
            <div class="pc-image-viewer-stage" id="pcImageViewerStage">
                <img class="pc-image-viewer-img" id="pcImageViewerImg" alt="图片预览">
            </div>
        `;
        const app = getPcApp();
        if (app) app.appendChild(viewer);
        else document.body.appendChild(viewer);

        const stage = viewer.querySelector('#pcImageViewerStage');
        const img = viewer.querySelector('#pcImageViewerImg');
        const resetBtn = viewer.querySelector('#pcImageViewerReset');
        const downloadBtn = viewer.querySelector('#pcImageViewerDownload');
        const closeBtn = viewer.querySelector('#pcImageViewerClose');

        viewer.addEventListener('click', (e) => {
            if (e.target === viewer || e.target === stage) closeImageViewer();
        });
        stage.addEventListener('wheel', handleImageViewerWheel, { passive: false });
        img.addEventListener('click', (e) => e.stopPropagation());
        img.addEventListener('dblclick', handleImageViewerDblClick);
        img.addEventListener('pointerdown', handleImageViewerPointerDown);
        img.addEventListener('pointermove', handleImageViewerPointerMove);
        img.addEventListener('pointerup', stopImageViewerDrag);
        img.addEventListener('pointercancel', stopImageViewerDrag);
        img.addEventListener('load', resetImageViewerTransform);
        resetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            resetImageViewerTransform();
        });
        downloadBtn.addEventListener('click', handleImageViewerDownload);
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeImageViewer();
        });
    }

    return viewer;
}

function showImageViewer(input) {
    const target = normalizeImageViewerInput(input);
    if (!target.url) return;
    const viewer = ensureImageViewer();
    const img = document.getElementById('pcImageViewerImg');
    imageViewerDownloadTarget = target;
    if (img) {
        resetImageViewerTransform();
        img.src = target.url;
    }
    viewer.classList.add('pc-image-viewer-active');
    viewer.focus({ preventScroll: true });
}

function closeImageViewer() {
    const viewer = document.getElementById('pcImageViewer');
    if (!viewer) return;
    viewer.classList.remove('pc-image-viewer-active');
    imageViewerDownloadTarget = { url: '', filename: '', sourceFile: '' };
    resetImageViewerTransform();
}

async function copyToClipboard(text) {
    if (!text) {
        showToast('内容为空，无法复制', 'error');
        return;
    }
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
        showToast('已复制到剪贴板');
    } catch (e) {
        showToast('复制失败', 'error');
    }
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatRelativeTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const now = new Date();
    const diff = now - d;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return formatDate(dateStr);
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}`;
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export {
    showToast,
    showModal,
    closeModal,
    showConfirmModal,
    showContextMenu,
    hideContextMenu,
    setContextMenuTargetId,
    getContextMenuTargetId,
    setFolderContextMenuTargetId,
    getFolderContextMenuTargetId,
    showImageViewer,
    closeImageViewer,
    copyToClipboard,
    escapeHtml,
    formatRelativeTime,
    formatDate,
    formatBytes,
    generateId
};
