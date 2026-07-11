import { pcIcon } from './pc-icon-assets.js';
import { getStorage } from './storage.js';
import { downloadImage } from './image-download-utils.js';

let contextMenuTargetId = null;
let folderContextMenuTargetId = null;
let contextMenuJustOpened = false;
let activeContextMenuHandler = null;
let activeContextMenuObserver = null;
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

function showContextMenu(x, y, items) {
    let menu = document.getElementById('pcContextMenu');
    if (!menu) {
        menu = document.createElement('div');
        menu.className = 'pc-context-menu';
        menu.id = 'pcContextMenu';
        const app = getPcApp();
        if (app) app.appendChild(menu);
        else document.body.appendChild(menu);
        document.addEventListener('click', (e) => {
            if (contextMenuJustOpened) {
                contextMenuJustOpened = false;
                return;
            }
            if (!e.target.closest('.pc-context-menu')) hideContextMenu();
        });
        document.addEventListener('scroll', () => hideContextMenu(), true);
    }

    if (activeContextMenuHandler) {
        menu.removeEventListener('click', activeContextMenuHandler);
        activeContextMenuHandler = null;
    }
    if (activeContextMenuObserver) {
        activeContextMenuObserver.disconnect();
        activeContextMenuObserver = null;
    }

    menu.innerHTML = items.map(item => {
        if (item.divider) return '<div class="pc-context-divider"></div>';
        const tone = item.tone ? ` pc-context-tone-${item.tone}` : '';
        return `<div class="pc-context-item${tone} ${item.danger ? 'pc-context-danger' : ''}" data-action="${item.action}">
            ${item.icon ? `<span class="pc-context-icon${tone}">${item.icon}</span>` : ''}
            <span>${item.label}</span>
        </div>`;
    }).join('');

    menu.style.visibility = 'hidden';
    menu.classList.add('pc-context-active');

    const rect = menu.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 8;
    const maxY = window.innerHeight - rect.height - 8;
    menu.style.left = Math.min(x, maxX) + 'px';
    menu.style.top = Math.min(y, maxY) + 'px';
    menu.style.visibility = '';

    contextMenuJustOpened = true;

    return new Promise((resolve) => {
        const clickHandler = (e) => {
            const item = e.target.closest('.pc-context-item');
            if (item) {
                e.stopPropagation();
                hideContextMenu();
                menu.removeEventListener('click', clickHandler);
                activeContextMenuHandler = null;
                resolve(item.dataset.action);
            }
        };
        menu.addEventListener('click', clickHandler);
        activeContextMenuHandler = clickHandler;

        const observer = new MutationObserver(() => {
            if (!menu.classList.contains('pc-context-active')) {
                menu.removeEventListener('click', clickHandler);
                activeContextMenuHandler = null;
                observer.disconnect();
                activeContextMenuObserver = null;
                resolve(null);
            }
        });
        observer.observe(menu, { attributes: true, attributeFilter: ['class'] });
        activeContextMenuObserver = observer;
    });
}

function hideContextMenu() {
    const menu = document.getElementById('pcContextMenu');
    if (menu) menu.classList.remove('pc-context-active');
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
