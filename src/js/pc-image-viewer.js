import { gsap } from 'gsap';
import { pcIcon } from './pc-icon-assets.js';
import { getStorage } from './storage.js';
import { downloadImage } from './image-download-utils.js';
import { showToast, showContextMenu } from './pc-utils.js';

const IMAGE_VIEWER_MIN_SCALE = 1;
const IMAGE_VIEWER_MAX_SCALE = 5;
const IMAGE_VIEWER_WHEEL_STEP = 1.12;
const IMAGE_VIEWER_DOUBLE_CLICK_SCALE = 2;
const OPEN_DURATION = 0.32;
const CLOSE_DURATION = 0.28;
const SHELL_DURATION = 0.14;

const imageViewerState = {
    scale: 1,
    translateX: 0,
    translateY: 0,
    isDragging: false,
    pointerId: null,
    dragStartX: 0,
    dragStartY: 0,
    startTranslateX: 0,
    startTranslateY: 0,
    urls: [],
    index: 0,
    isAnimating: false,
    openedWithFlip: false
};

let imageViewerDownloadTarget = { url: '', filename: '', sourceFile: '' };
let flipSourceEl = null;
let hiddenSourceEl = null;
let activeTween = null;
let flipSession = 0;

function prefersReducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function getPcApp() {
    return document.getElementById('pcApp');
}

function resolveSourceImg(sourceEl) {
    if (!sourceEl) return null;
    if (sourceEl.tagName === 'IMG') return sourceEl;
    return sourceEl.querySelector?.('img') || null;
}

function normalizeImageViewerInput(input) {
    if (typeof input === 'string') {
        return {
            urls: [input],
            index: 0,
            url: input,
            filename: '',
            sourceFile: '',
            sourceEl: null,
            image: null
        };
    }
    const image = input?.image || input?.data || {};
    const singleUrl = input?.src || input?.url || '';
    if (Array.isArray(input?.urls) && input.urls.length > 0) {
        return {
            urls: input.urls,
            index: clamp(input?.index || 0, 0, input.urls.length - 1),
            url: input.urls[input?.index || 0] || input.urls[0],
            filename: input?.filename || image.name || image.file || '',
            sourceFile: input?.sourceFile || image.file || '',
            sourceEl: input?.sourceEl || null,
            image
        };
    }
    return {
        urls: singleUrl ? [singleUrl] : [],
        index: 0,
        url: singleUrl,
        filename: input?.filename || image.name || image.file || '',
        sourceFile: input?.sourceFile || image.file || '',
        sourceEl: input?.sourceEl || null,
        image
    };
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
    if (imageViewerState.isAnimating) return;
    e.preventDefault();
    const direction = e.deltaY < 0 ? 1 : -1;
    const factor = direction > 0 ? IMAGE_VIEWER_WHEEL_STEP : 1 / IMAGE_VIEWER_WHEEL_STEP;
    zoomImageViewerAt(e.clientX, e.clientY, imageViewerState.scale * factor);
}

function handleImageViewerPointerDown(e) {
    if (imageViewerState.isAnimating) return;
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
    if (imageViewerState.isAnimating) return;
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
    if (!imageViewerDownloadTarget.url || download?.disabled || imageViewerState.isAnimating) return;

    const action = await showContextMenu(e.clientX, e.clientY, [
        {
            action: 'format',
            icon: pcIcon('download'),
            label: '下载图片',
            children: [
                { action: 'original', icon: pcIcon('download'), label: '下载原格式' },
                { action: 'jpg', icon: pcIcon('download'), label: '导出 JPG' }
            ]
        }
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
            <div class="pc-image-viewer-nav" id="pcImageViewerNav">
                <button class="pc-image-viewer-nav-prev" type="button" aria-label="上一张">‹</button>
                <span class="pc-image-viewer-nav-index" id="pcImageViewerNavIndex">1 / 1</span>
                <button class="pc-image-viewer-nav-next" type="button" aria-label="下一张">›</button>
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
        const navPrev = viewer.querySelector('.pc-image-viewer-nav-prev');
        const navNext = viewer.querySelector('.pc-image-viewer-nav-next');

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
        img.addEventListener('load', () => {
            if (!imageViewerState.isAnimating) resetImageViewerTransform();
        });
        resetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (imageViewerState.isAnimating) return;
            resetImageViewerTransform();
        });
        downloadBtn.addEventListener('click', handleImageViewerDownload);
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeImageViewer();
        });
        navPrev.addEventListener('click', (e) => {
            e.stopPropagation();
            changeImageViewerIndex(-1);
        });
        navNext.addEventListener('click', (e) => {
            e.stopPropagation();
            changeImageViewerIndex(1);
        });
        viewer.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                changeImageViewerIndex(-1);
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                changeImageViewerIndex(1);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closeImageViewer();
            }
        });
    }

    return viewer;
}

function updateImageViewerNav() {
    const nav = document.getElementById('pcImageViewerNav');
    const indexEl = document.getElementById('pcImageViewerNavIndex');
    if (!nav || !indexEl) return;
    const total = imageViewerState.urls.length;
    if (total <= 1) {
        nav.classList.add('is-hidden');
    } else {
        nav.classList.remove('is-hidden');
        indexEl.textContent = `${imageViewerState.index + 1} / ${total}`;
    }
}

function changeImageViewerIndex(delta) {
    if (imageViewerState.isAnimating) return;
    const total = imageViewerState.urls.length;
    if (total <= 1) return;
    imageViewerState.index = (imageViewerState.index + delta + total) % total;
    showImageViewerAt(imageViewerState.index);
}

function showImageViewerAt(index) {
    const img = document.getElementById('pcImageViewerImg');
    const url = imageViewerState.urls[index];
    if (!img || !url) return;
    imageViewerState.index = index;
    imageViewerDownloadTarget.url = url;
    resetImageViewerTransform();
    img.src = url;
    updateImageViewerNav();
}

function killActiveTween() {
    if (activeTween) {
        activeTween.kill();
        activeTween = null;
    }
}

function restoreSourceElVisibility() {
    if (hiddenSourceEl) {
        hiddenSourceEl.style.visibility = '';
        hiddenSourceEl = null;
    }
}

function hideSourceEl(el) {
    if (!el) return;
    el.style.visibility = 'hidden';
    hiddenSourceEl = el;
}

function setShellVisible(viewer, visible) {
    const toolbar = viewer.querySelector('.pc-image-viewer-toolbar');
    const nav = viewer.querySelector('.pc-image-viewer-nav');
    const targets = [toolbar, nav].filter(Boolean);
    if (!targets.length) return;
    if (prefersReducedMotion()) {
        gsap.set(targets, { autoAlpha: visible ? 1 : 0 });
        return;
    }
    gsap.to(targets, {
        autoAlpha: visible ? 1 : 0,
        duration: SHELL_DURATION,
        overwrite: 'auto',
        ease: 'power2.out'
    });
}

function computeFlipInvert(sourceImg, targetImg) {
    const sourceRect = sourceImg.getBoundingClientRect();
    const targetRect = targetImg.getBoundingClientRect();
    if (!sourceRect.width || !sourceRect.height || !targetRect.width || !targetRect.height) {
        return null;
    }
    return {
        x: sourceRect.left - targetRect.left,
        y: sourceRect.top - targetRect.top,
        scaleX: sourceRect.width / targetRect.width,
        scaleY: sourceRect.height / targetRect.height,
        transformOrigin: '0 0'
    };
}

function settleViewerChrome({ viewer, img }) {
    imageViewerState.isAnimating = false;
    viewer.classList.remove('pc-image-viewer-flipping');
    imageViewerState.openedWithFlip = false;
    gsap.set(img, { autoAlpha: 1 });
    setShellVisible(viewer, true);
    restoreSourceElVisibility();
}

async function playOpenFlip({ viewer, img, sourceEl }) {
    const session = flipSession;
    const sourceImg = resolveSourceImg(sourceEl);
    flipSourceEl = null;

    // Spec: no source / reduced-motion / image not ready → fade only (never await load)
    const canFlip = Boolean(sourceImg)
        && sourceImg.isConnected
        && !prefersReducedMotion()
        && img.complete
        && img.naturalWidth > 0
        && sourceEl?.isConnected !== false;

    if (!canFlip) {
        imageViewerState.openedWithFlip = false;
        gsap.set(img, { autoAlpha: 1 });
        setShellVisible(viewer, true);
        return;
    }

    imageViewerState.isAnimating = true;
    viewer.classList.add('pc-image-viewer-flipping');
    hideSourceEl(sourceEl);
    gsap.set(img, { autoAlpha: 0 });
    setShellVisible(viewer, false);

    void img.offsetWidth;
    resetImageViewerTransform();
    const invert = computeFlipInvert(sourceImg, img);
    if (!invert || session !== flipSession) {
        settleViewerChrome({ viewer, img });
        return;
    }

    gsap.set(img, {
        autoAlpha: 1,
        transformOrigin: invert.transformOrigin,
        x: invert.x,
        y: invert.y,
        scaleX: invert.scaleX,
        scaleY: invert.scaleY
    });

    await new Promise((resolve) => {
        activeTween = gsap.to(img, {
            x: 0,
            y: 0,
            scaleX: 1,
            scaleY: 1,
            duration: OPEN_DURATION,
            ease: 'power3.out',
            overwrite: 'auto',
            onComplete: resolve,
            onInterrupt: resolve
        });
    });
    activeTween = null;

    if (session !== flipSession) return;

    gsap.set(img, { clearProps: 'transform,transformOrigin,opacity,visibility' });
    applyImageViewerTransform();
    setShellVisible(viewer, true);
    restoreSourceElVisibility();
    flipSourceEl = sourceEl;
    imageViewerState.isAnimating = false;
    imageViewerState.openedWithFlip = true;
    viewer.classList.remove('pc-image-viewer-flipping');
}

async function playCloseFlip({ viewer, img, sourceEl }) {
    const session = flipSession;
    const sourceImg = resolveSourceImg(sourceEl);
    if (!sourceImg || prefersReducedMotion() || !imageViewerState.openedWithFlip) {
        imageViewerState.openedWithFlip = false;
        return;
    }

    imageViewerState.isAnimating = true;
    viewer.classList.add('pc-image-viewer-flipping');
    hideSourceEl(sourceEl);
    setShellVisible(viewer, false);

    const sourceRect = sourceImg.getBoundingClientRect();
    const targetRect = img.getBoundingClientRect();
    if (!sourceRect.width || !targetRect.width) {
        restoreSourceElVisibility();
        imageViewerState.isAnimating = false;
        viewer.classList.remove('pc-image-viewer-flipping');
        return;
    }

    gsap.set(img, { transformOrigin: '0 0' });
    await new Promise((resolve) => {
        activeTween = gsap.to(img, {
            x: sourceRect.left - targetRect.left,
            y: sourceRect.top - targetRect.top,
            scaleX: sourceRect.width / targetRect.width,
            scaleY: sourceRect.height / targetRect.height,
            duration: CLOSE_DURATION,
            ease: 'power2.in',
            overwrite: 'auto',
            onComplete: resolve,
            onInterrupt: resolve
        });
    });
    activeTween = null;
    if (session !== flipSession) return;
    restoreSourceElVisibility();
    imageViewerState.isAnimating = false;
    viewer.classList.remove('pc-image-viewer-flipping');
    imageViewerState.openedWithFlip = false;
}

function isOpen() {
    return Boolean(document.getElementById('pcImageViewer')?.classList.contains('pc-image-viewer-active'));
}

function openImageViewer(input) {
    const target = normalizeImageViewerInput(input);
    if (!target.urls || target.urls.length === 0) return;

    flipSession += 1;
    killActiveTween();
    restoreSourceElVisibility();
    imageViewerState.isAnimating = false;
    imageViewerState.openedWithFlip = false;
    flipSourceEl = null;

    const viewer = ensureImageViewer();
    const img = viewer.querySelector('#pcImageViewerImg');
    imageViewerState.urls = target.urls;
    imageViewerState.index = target.index || 0;
    imageViewerDownloadTarget = {
        url: target.url,
        filename: target.filename,
        sourceFile: target.sourceFile
    };

    resetImageViewerTransform();
    showImageViewerAt(imageViewerState.index);
    viewer.classList.add('pc-image-viewer-active');
    viewer.focus({ preventScroll: true });

    void playOpenFlip({ viewer, img, sourceEl: target.sourceEl });
}

async function closeImageViewer({ immediate = false } = {}) {
    const viewer = document.getElementById('pcImageViewer');
    if (!viewer || !viewer.classList.contains('pc-image-viewer-active')) {
        flipSession += 1;
        killActiveTween();
        restoreSourceElVisibility();
        flipSourceEl = null;
        return;
    }

    const img = viewer.querySelector('#pcImageViewerImg');
    const reverseSource = flipSourceEl;
    const reverseImg = resolveSourceImg(reverseSource);
    const shouldReverse = !immediate
        && imageViewerState.openedWithFlip
        && reverseImg
        && reverseImg.isConnected;
    flipSession += 1;
    killActiveTween();

    if (shouldReverse) {
        await playCloseFlip({ viewer, img, sourceEl: reverseSource });
    } else {
        restoreSourceElVisibility();
    }

    flipSourceEl = null;
    viewer.classList.remove('pc-image-viewer-active');
    imageViewerDownloadTarget = { url: '', filename: '', sourceFile: '' };
    imageViewerState.urls = [];
    imageViewerState.index = 0;
    imageViewerState.openedWithFlip = false;
    imageViewerState.isAnimating = false;
    resetImageViewerTransform();
    if (img) {
        gsap.set(img, { clearProps: 'transform,transformOrigin,opacity,visibility' });
    }
    const toolbar = viewer.querySelector('.pc-image-viewer-toolbar');
    const nav = viewer.querySelector('.pc-image-viewer-nav');
    if (toolbar || nav) {
        gsap.set([toolbar, nav].filter(Boolean), { clearProps: 'opacity,visibility' });
    }
}

export {
    openImageViewer,
    openImageViewer as showImageViewer,
    closeImageViewer,
    isOpen
};
