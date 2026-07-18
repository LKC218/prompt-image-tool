import { getStorage } from './storage.js';
import { formatDate } from './utils.js';
import { navigate, goBack, showMobileToast, showActionSheet, iconImg } from './mobile-utils.js';
import { getCurrentRoute } from './mobile-router.js';
import { getPromptSetMenuItems } from './mobile-menu-actions.js';
import { getTagStyleClass } from './tag-utils.js';
import { mobileIcon } from './mobile-icon-assets.js';
import { setFavoriteButtonState, toggleFavoriteWithFeedback } from './favorite-feedback.js';
import { downloadImage } from './image-download-utils.js';
import imagePlaceholder from '../assets/mobile/image-placeholder.png';

let currentSet = null;
let imageUrls = [];
let currentImageIndex = 0;
let activeImageViewerOverlay = null;

function render(params = {}) {
    return `
        <div class="m-top-nav">
            <button class="m-top-nav-back" id="mDetailBack" aria-label="返回">${mobileIcon('chevron-left')}</button>
            <span class="m-top-nav-title" id="mDetailTitle">提示词详情</span>
            <div class="m-top-nav-actions">
                <button class="m-top-nav-action m-star-btn" id="mDetailStar" aria-pressed="false" aria-label="收藏">${mobileIcon('star')}</button>
                <button class="m-top-nav-action" id="mDetailMore" aria-label="更多操作">${mobileIcon('more')}</button>
            </div>
        </div>
        <div class="m-page-inner" id="mDetailContent">
            <div class="m-empty-state">
                <span class="m-empty-icon">${mobileIcon('loader', { className: 'm-icon-lg m-icon-spin' })}</span>
                <span class="m-empty-text">加载中...</span>
            </div>
        </div>
        <div class="m-bottom-actions" id="mDetailActions">
            <button class="m-action-btn m-btn-yellow" id="mDetailEdit">${mobileIcon('edit', { className: 'm-icon-sm' })} 编辑</button>
            <button class="m-action-btn m-btn-blue" id="mDetailCopy">${mobileIcon('clipboard', { className: 'm-icon-sm' })} 复制</button>
            <button class="m-action-btn m-btn-gray" id="mDetailMoreActions">${mobileIcon('more', { className: 'm-icon-sm' })} 更多</button>
        </div>
    `;
}

async function mount(pageEl, params = {}) {
    const route = getCurrentRoute();
    const id = params.id || extractIdFromRoute(route);
    if (id) {
        await loadDetail(pageEl, id);
    }
    setupDetailEvents(pageEl, id);
}

function extractIdFromRoute(route) {
    if (!route) return null;
    const path = route.path || '';
    const match = path.match(/\/detail\/(.+)$/);
    return match ? match[1] : null;
}

async function loadDetail(pageEl, id) {
    try {
        const storage = getStorage();
        currentSet = await storage.getPromptSet(id);
        if (!currentSet) {
            showMobileToast('提示词不存在', 'error');
            closeActiveImageViewer(true);
            goBack();
            return;
        }
        renderDetail(pageEl, currentSet);
    } catch (e) {
        console.error('loadDetail error:', e);
        showMobileToast('加载失败', 'error');
    }
}

async function renderDetail(pageEl, set) {
    const content = pageEl.querySelector('#mDetailContent');
    if (!content) return;

    const titleEl = pageEl.querySelector('#mDetailTitle');
    if (titleEl) titleEl.textContent = set.name;

    setFavoriteButtonState(pageEl.querySelector('#mDetailStar'), set.isFavorite === true);

    const currentVersion = set.versions && set.versions.length > 0 ? set.versions[0] : null;
    const positivePrompt = currentVersion ? (currentVersion.prompt || '') : '';
    const negativePrompt = currentVersion ? (currentVersion.negativePrompt || currentVersion.negative_prompt || '') : '';
    const note = currentVersion ? (currentVersion.note || '') : '';

    const allImages = currentVersion && currentVersion.images ? currentVersion.images : [];
    imageUrls = [];
    for (const img of allImages) {
        try {
            const storage = getStorage();
            const url = await storage.getImageUrl(img);
            imageUrls.push({ url, name: img.name || '', note: img.note || '', data: img });
        } catch (error) {
            console.warn('mobile detail image URL resolve failed:', error);
            imageUrls.push({ url: '', name: img.name || '', note: img.note || '', data: img, loadError: true });
        }
    }
    currentImageIndex = 0;

    let coverHtml = '';
    if (imageUrls.length > 0) {
        coverHtml = `<div class="m-cover-image m-fade-in" id="mCoverImage" style="cursor:pointer;"><img src="${imageUrls[0].url}" alt="封面" onerror="this.style.display='none'; this.parentElement.innerHTML='<span class=m-cover-placeholder>图片加载失败</span>';"></div>`;
    } else {
        coverHtml = `<div class="m-cover-image m-fade-in"><span class="m-cover-placeholder">${iconImg(imagePlaceholder)}</span></div>`;
    }

    let imageThumbsHtml = '';
    if (imageUrls.length > 1) {
        const displayImages = imageUrls.slice(0, 10);
        const moreCount = imageUrls.length - 10;
        imageThumbsHtml = `
            <div class="m-image-thumbs-section m-section-gap">
                <div class="m-section-title">
                    <span class="m-section-title-text">图片预览</span>
                    <span class="m-section-title-action">${imageUrls.length} 张</span>
                </div>
                <div class="m-image-thumbs-scroll">
                    ${displayImages.map((img, idx) => `
                        <div class="m-image-thumb ${idx === 0 ? 'm-image-thumb-active' : ''}" data-thumb-idx="${idx}" style="animation-delay: ${idx * 30}ms">
                            <img src="${img.url}" alt="${escapeHtml(img.name)}" onerror="this.style.display='none'; this.parentElement.innerHTML='图片加载失败'">
                        </div>
                    `).join('')}
                    ${moreCount > 0 ? `<div class="m-image-thumb m-image-thumb-more">${mobileIcon('plus', { className: 'm-icon-sm' })}${moreCount}</div>` : ''}
                </div>
            </div>
        `;
    }

    let tags = [];
    try { tags = JSON.parse(set.tags || '[]'); } catch (e) { tags = []; }
    if (!Array.isArray(tags)) tags = [];
    const tagsHtml = tags.length > 0
        ? tags.map(t => `<span class="m-tag-pill ${getTagStyleClass(t)}">${escapeHtml(t)}</span>`).join('')
        : '<span class="m-tag-pill m-tag-default">提示词</span>';

    content.innerHTML = `
        ${coverHtml}
        ${imageThumbsHtml}

        <div style="margin-top:var(--m-space-lg); margin-bottom: var(--m-space-md);">
            <h2 style="font:var(--m-font-h2); color:var(--m-text); margin-bottom: var(--m-space-sm);">${escapeHtml(set.name)}</h2>
            <div style="display:flex; gap:var(--m-space-xs); flex-wrap:wrap;">
                ${tagsHtml}
            </div>
        </div>

        <div class="m-prompt-section m-positive m-section-gap m-fade-in">
            <div class="m-prompt-section-header">
                <div class="m-prompt-title-wrap">
                    <span class="m-prompt-section-title">正向提示词（Positive）</span>
                    ${positivePrompt ? `<span class="m-prompt-count">${positivePrompt.length} 字</span>` : ''}
                </div>
                <button class="m-prompt-copy-btn" id="mCopyPositive">${mobileIcon('copy', { className: 'm-icon-sm' })} 复制</button>
            </div>
            <div class="m-prompt-text" id="mPositiveText">${positivePrompt || '<span style="color:var(--m-text3)">暂无正向提示词</span>'}</div>
            ${positivePrompt && positivePrompt.length > 80 ? `<button class="m-prompt-toggle" id="mTogglePositive" data-expanded="false">展开查看 ${mobileIcon('chevron-down', { className: 'm-icon-sm' })}</button>` : ''}
            ${positivePrompt ? `<button class="m-prompt-toggle" id="mDetailPositive" style="color:var(--m-blue)">查看完整提示词 ${mobileIcon('clipboard', { className: 'm-icon-sm' })}</button>` : ''}
        </div>

        <div class="m-prompt-section m-negative m-section-gap m-fade-in">
            <div class="m-prompt-section-header">
                <div class="m-prompt-title-wrap">
                    <span class="m-prompt-section-title">负向提示词（Negative）</span>
                    ${negativePrompt ? `<span class="m-prompt-count">${negativePrompt.length} 字</span>` : ''}
                </div>
                <button class="m-prompt-copy-btn" id="mCopyNegative">${mobileIcon('copy', { className: 'm-icon-sm' })} 复制</button>
            </div>
            <div class="m-prompt-text" id="mNegativeText">${negativePrompt || '<span style="color:var(--m-text3)">暂无负向提示词</span>'}</div>
            ${negativePrompt && negativePrompt.length > 80 ? `<button class="m-prompt-toggle" id="mToggleNegative" data-expanded="false">展开查看 ${mobileIcon('chevron-down', { className: 'm-icon-sm' })}</button>` : ''}
            ${negativePrompt ? `<button class="m-prompt-toggle" id="mDetailNegative" style="color:var(--m-blue)">查看完整提示词 ${mobileIcon('clipboard', { className: 'm-icon-sm' })}</button>` : ''}
        </div>

        <div class="m-info-card m-section-gap m-fade-in">
            <div class="m-info-row">
                <span class="m-info-label">风格/模型</span>
                <span class="m-info-value">${currentVersion ? (currentVersion.version || '默认') : '-'}</span>
            </div>
            <div class="m-info-row">
                <span class="m-info-label">比例</span>
                <span class="m-info-value">1:1</span>
            </div>
            <div class="m-info-row">
                <span class="m-info-label">创建时间</span>
                <span class="m-info-value">${formatDate(set.createdAt)}</span>
            </div>
            <div class="m-info-row">
                <span class="m-info-label">标签</span>
                <span class="m-info-value">${tags.length > 0 ? tags.map(t => escapeHtml(t)).join('、') : '-'}</span>
            </div>
        </div>

        ${set.versions && set.versions.length > 0 ? `
            <div class="m-section-gap">
                <div class="m-section-title">
                    <span class="m-section-title-text">版本记录</span>
                </div>
                <div class="m-list-gap">
                    ${set.versions.map((v, idx) => `
                        <div class="m-version-item m-fade-in" data-version-idx="${idx}" style="animation-delay: ${idx * 30}ms">
                            <div class="m-version-info">
                                <span class="m-version-name">${v.version || 'v' + (idx + 1)}${idx === 0 ? ' (当前版本)' : ''}</span>
                                <span class="m-version-date">${formatDate(v.createdAt || v.created_at)}</span>
                            </div>
                            <span class="m-version-arrow">${mobileIcon('chevron-right', { className: 'm-icon-sm' })}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}
    `;

    setupContentEvents(pageEl, set, positivePrompt, negativePrompt);
}

function setupContentEvents(pageEl, set, positivePrompt, negativePrompt) {
    pageEl.querySelector('#mCopyPositive')?.addEventListener('click', () => {
        copyToClipboard(positivePrompt, pageEl.querySelector('#mCopyPositive'));
    });

    pageEl.querySelector('#mCopyNegative')?.addEventListener('click', () => {
        copyToClipboard(negativePrompt, pageEl.querySelector('#mCopyNegative'));
    });

    pageEl.querySelector('#mTogglePositive')?.addEventListener('click', (e) => {
        togglePromptExpand(pageEl, 'mPositiveText', e.target);
    });

    pageEl.querySelector('#mToggleNegative')?.addEventListener('click', (e) => {
        togglePromptExpand(pageEl, 'mNegativeText', e.target);
    });

    pageEl.querySelector('#mDetailPositive')?.addEventListener('click', () => {
        showPromptDetailPanel('正向提示词', positivePrompt);
    });

    pageEl.querySelector('#mDetailNegative')?.addEventListener('click', () => {
        showPromptDetailPanel('负向提示词', negativePrompt);
    });

    pageEl.querySelector('#mCoverImage')?.addEventListener('click', () => {
        if (imageUrls.length > 0) {
            showImageViewer(pageEl, currentImageIndex);
        }
    });

    pageEl.querySelector('.m-image-thumbs-scroll')?.addEventListener('click', (e) => {
        const thumb = e.target.closest('.m-image-thumb');
        if (!thumb || thumb.classList.contains('m-image-thumb-more')) return;
        const idx = parseInt(thumb.dataset.thumbIdx);
        if (isNaN(idx)) return;
        currentImageIndex = idx;
        const coverImg = pageEl.querySelector('#mCoverImage img');
        if (coverImg && imageUrls[idx]) {
            coverImg.src = imageUrls[idx].url;
        }
        pageEl.querySelectorAll('.m-image-thumb').forEach(t => t.classList.remove('m-image-thumb-active'));
        thumb.classList.add('m-image-thumb-active');
    });
}

function setupDetailEvents(pageEl, id) {
    pageEl.querySelector('#mDetailBack')?.addEventListener('click', () => {
        closeActiveImageViewer(true);
        goBack();
    });

    pageEl.querySelector('#mDetailStar')?.addEventListener('click', async () => {
        const btn = pageEl.querySelector('#mDetailStar');
        await toggleFavoriteWithFeedback({
            id,
            button: btn,
            isFavorite: currentSet?.isFavorite,
            onStateChange: (isFavorite) => {
                if (currentSet) currentSet.isFavorite = isFavorite;
            }
        });
    });

    pageEl.querySelector('#mDetailMore')?.addEventListener('click', () => {
        showActionSheet(
            getPromptSetMenuItems(id, pageEl, {
                showEdit: true,
                onActionDone: () => loadDetail(pageEl, id)
            })
        );
    });

    pageEl.querySelector('#mDetailEdit')?.addEventListener('click', () => {
        navigate('/editor/' + id);
    });

    pageEl.querySelector('#mDetailCopy')?.addEventListener('click', () => {
        if (!currentSet || !currentSet.versions || currentSet.versions.length === 0) return;
        const v = currentSet.versions[0];
        const full = (v.prompt || '') + (v.negativePrompt || v.negative_prompt ? '\n\nNegative: ' + (v.negativePrompt || v.negative_prompt) : '');
        copyToClipboard(full, pageEl.querySelector('#mDetailCopy'));
    });

    pageEl.querySelector('#mDetailMoreActions')?.addEventListener('click', () => {
        showActionSheet([
            { action: 'addVersion', icon: mobileIcon('plus'), label: '添加新版本', handler: () => showMobileToast('添加版本功能开发中') },
            { action: 'compare', icon: mobileIcon('refresh'), label: '版本对比', handler: () => showMobileToast('版本对比功能开发中') },
        ]);
    });
}

function togglePromptExpand(pageEl, textId, btnEl) {
    const textEl = pageEl.querySelector('#' + textId);
    if (!textEl) return;
    const isExpanded = textEl.classList.toggle('m-prompt-expanded');
    btnEl.innerHTML = isExpanded
        ? `收起 ${mobileIcon('chevron-up', { className: 'm-icon-sm' })}`
        : `展开查看 ${mobileIcon('chevron-down', { className: 'm-icon-sm' })}`;
    btnEl.dataset.expanded = isExpanded;
}

function showPromptDetailPanel(title, text) {
    const overlay = document.createElement('div');
    overlay.className = 'm-prompt-detail-overlay';
    overlay.innerHTML = `
        <div class="m-prompt-detail-panel">
            <div class="m-prompt-detail-header">
                <span class="m-prompt-detail-title">${title}</span>
                <button class="m-prompt-detail-close" id="mPromptDetailClose" aria-label="关闭">${mobileIcon('x', { className: 'm-icon-sm' })}</button>
            </div>
            <div class="m-prompt-detail-body">
                <div class="m-prompt-detail-text">${escapeHtml(text)}</div>
            </div>
            <div class="m-prompt-detail-footer">
                <button class="m-prompt-detail-copy" id="mPromptDetailCopy">复制提示词</button>
            </div>
        </div>
    `;

    getMobileContainer().appendChild(overlay);
    setTimeout(() => overlay.classList.add('m-prompt-detail-show'), 30);

    function closePanel() {
        overlay.classList.remove('m-prompt-detail-show');
        setTimeout(() => overlay.remove(), 300);
    }

    overlay.querySelector('#mPromptDetailClose')?.addEventListener('click', closePanel);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closePanel();
    });
    overlay.querySelector('#mPromptDetailCopy')?.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(text);
            showMobileToast('已复制到剪贴板');
        } catch (e) {
            showMobileToast('复制失败', 'error');
        }
    });
}

function getMobileContainer() {
    return document.getElementById('mobileApp') || document.body;
}

function showImageViewer(pageEl, startIndex) {
    if (imageUrls.length === 0) return;
    closeActiveImageViewer(true);
    let viewerIndex = startIndex;

    const overlay = document.createElement('div');
    overlay.className = 'm-image-viewer-overlay';
    overlay.innerHTML = `
        <div class="m-image-viewer-header">
            <button class="m-image-viewer-close" id="mViewerClose" aria-label="关闭">${mobileIcon('x')}</button>
            <span class="m-image-viewer-counter" id="mViewerCounter">${viewerIndex + 1} / ${imageUrls.length}</span>
            <button class="m-image-viewer-download" id="mViewerDownload" aria-label="下载当前图片">${mobileIcon('download')}</button>
        </div>
        <div class="m-image-viewer-body" id="mViewerBody">
            <img class="m-image-viewer-img" id="mViewerImg" src="${imageUrls[viewerIndex].url}" alt="" style="opacity:0;transition:opacity 0.2s" onload="this.style.opacity='1'" onerror="this.style.display='none'; this.parentElement.innerHTML='<span style=\\'color:white;font-size:16px\\'>图片加载失败</span>';">
        </div>
        <div class="m-image-viewer-footer" id="mViewerFooter">
            ${imageUrls[viewerIndex].note ? `<span class="m-image-viewer-note">${escapeHtml(imageUrls[viewerIndex].note)}</span>` : ''}
        </div>
        ${imageUrls.length > 1 ? `
            <button class="m-image-viewer-nav m-image-viewer-prev" id="mViewerPrev" aria-label="上一张">${mobileIcon('chevron-left')}</button>
            <button class="m-image-viewer-nav m-image-viewer-next" id="mViewerNext" aria-label="下一张">${mobileIcon('chevron-right')}</button>
        ` : ''}
    `;

    getMobileContainer().appendChild(overlay);
    activeImageViewerOverlay = overlay;
    setTimeout(() => overlay.classList.add('m-image-viewer-show'), 30);

    // 触摸交互状态：缩放 + 拖拽平移
    let currentScale = 1;
    let translateX = 0;
    let translateY = 0;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragStartTX = 0;
    let dragStartTY = 0;
    let isDragging = false;
    let pinchStartDist = 0;
    let initialScale = 1;
    let isPinching = false;

    const viewerImg = overlay.querySelector('#mViewerImg');

    function applyTransform() {
        if (viewerImg) {
            viewerImg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${currentScale})`;
        }
    }

    function resetTransform() {
        currentScale = 1;
        translateX = 0;
        translateY = 0;
        if (viewerImg) viewerImg.style.transform = '';
    }

    function updateViewer() {
        const img = overlay.querySelector('#mViewerImg');
        const counter = overlay.querySelector('#mViewerCounter');
        const footer = overlay.querySelector('#mViewerFooter');
        resetTransform();
        if (img) {
            img.style.display = '';
            img.style.opacity = '0';
            img.src = imageUrls[viewerIndex].url;
        }
        if (counter) counter.textContent = `${viewerIndex + 1} / ${imageUrls.length}`;
        if (footer) {
            footer.innerHTML = imageUrls[viewerIndex].note
                ? `<span class="m-image-viewer-note">${escapeHtml(imageUrls[viewerIndex].note)}</span>`
                : '';
        }
    }

    function closeViewer() {
        closeImageViewerOverlay(overlay);
    }

    async function performDownload(format = 'original') {
        const downloadBtn = overlay.querySelector('#mViewerDownload');
        const current = imageUrls[viewerIndex];
        if (!current?.url || downloadBtn?.disabled) return;

        if (downloadBtn) downloadBtn.disabled = true;
        try {
            const isJpgExport = format === 'jpg';
            const result = await downloadImage({
                url: current.url,
                filename: current.name || `${currentSet?.name || 'preview'}-${viewerIndex + 1}`,
                sourceFile: current.data?.file || '',
                format,
                historyContext: {
                    platform: 'mobile',
                    source: isJpgExport ? '图片查看器-JPG导出' : '图片查看器',
                    title: current.name || currentSet?.name || (isJpgExport ? `预览图片-${viewerIndex + 1}.jpg` : `预览图片-${viewerIndex + 1}`),
                },
            });
            if (result?.canceled) {
                showMobileToast('已取消下载');
            } else {
                showMobileToast(result?.locationLabel
                    ? `${isJpgExport ? 'JPG 已导出到' : '已保存到'}${result.locationLabel}`
                    : (isJpgExport ? 'JPG 导出已完成' : '图片下载已完成'));
            }
        } catch (error) {
            console.error('mobile image download failed:', error);
            const message = error?.message || (format === 'jpg' ? 'JPG 导出失败' : '图片下载失败');
            showMobileToast(message, 'error');
        } finally {
            if (downloadBtn) downloadBtn.disabled = false;
        }
    }

    function handleDownload(e) {
        e.preventDefault();
        e.stopPropagation();
        showActionSheet([
            {
                action: 'original',
                icon: mobileIcon('download'),
                label: '保存原格式',
                handler: () => performDownload('original'),
            },
            {
                action: 'jpg',
                icon: mobileIcon('download'),
                label: '导出 JPG',
                handler: () => performDownload('jpg'),
            },
        ]);
    }

    overlay.querySelector('#mViewerClose')?.addEventListener('click', closeViewer);
    overlay.querySelector('#mViewerDownload')?.addEventListener('click', handleDownload);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target.classList.contains('m-image-viewer-body')) {
            closeViewer();
        }
    });

    overlay.querySelector('#mViewerPrev')?.addEventListener('click', (e) => {
        e.stopPropagation();
        viewerIndex = (viewerIndex - 1 + imageUrls.length) % imageUrls.length;
        updateViewer();
    });

    overlay.querySelector('#mViewerNext')?.addEventListener('click', (e) => {
        e.stopPropagation();
        viewerIndex = (viewerIndex + 1) % imageUrls.length;
        updateViewer();
    });

    if (viewerImg) {
        viewerImg.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                isPinching = true;
                isDragging = false;
                e.preventDefault();
                pinchStartDist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                initialScale = currentScale;
            } else if (e.touches.length === 1 && !isPinching) {
                isDragging = true;
                dragStartX = e.touches[0].clientX;
                dragStartY = e.touches[0].clientY;
                dragStartTX = translateX;
                dragStartTY = translateY;
            }
        }, { passive: false });

        viewerImg.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2 && isPinching) {
                e.preventDefault();
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                currentScale = Math.min(Math.max(initialScale * (dist / pinchStartDist), 0.5), 5);
                applyTransform();
            } else if (e.touches.length === 1 && isDragging) {
                const dx = e.touches[0].clientX - dragStartX;
                const dy = e.touches[0].clientY - dragStartY;
                translateX = dragStartTX + dx;
                translateY = dragStartTY + dy;
                applyTransform();
            }
        }, { passive: false });

        viewerImg.addEventListener('touchend', (e) => {
            if (e.touches.length === 0) {
                isDragging = false;
                isPinching = false;
                if (currentScale < 1.1) {
                    resetTransform();
                }
            }
        }, { passive: true });
    }
}

function closeImageViewerOverlay(overlay, immediate = false) {
    if (!overlay) return;
    if (activeImageViewerOverlay === overlay) {
        activeImageViewerOverlay = null;
    }
    overlay.classList.remove('m-image-viewer-show');
    if (immediate) {
        overlay.remove();
        return;
    }
    setTimeout(() => overlay.remove(), 300);
}

function closeActiveImageViewer(immediate = false) {
    const overlays = activeImageViewerOverlay
        ? [activeImageViewerOverlay]
        : Array.from(document.querySelectorAll('.m-image-viewer-overlay'));
    overlays.forEach(overlay => closeImageViewerOverlay(overlay, immediate));
}

async function copyToClipboard(text, btnEl) {
    try {
        await navigator.clipboard.writeText(text);
        if (btnEl) {
            const original = btnEl.innerHTML;
            btnEl.textContent = '已复制';
            setTimeout(() => { btnEl.innerHTML = original; }, 1500);
        }
        showMobileToast('已复制到剪贴板');
    } catch (e) {
        showMobileToast('复制失败', 'error');
    }
}

function unmount(pageEl) {
    closeActiveImageViewer(true);
    currentSet = null;
    imageUrls = [];
    currentImageIndex = 0;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

export { render, mount, unmount };
