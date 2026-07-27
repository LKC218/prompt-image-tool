import { getStorage } from './storage.js';
import { navigate } from './pc-app.js';
import { showToast, showConfirmModal, copyToClipboard, showImageViewer, showContextMenu, hideContextMenu, escapeHtml, formatDate } from './pc-utils.js';
import { formatPromptForDisplay } from './pc-prompt-ui-utils.js';
import { pcIcon } from './pc-icon-assets.js';
import { playPcFavoriteFeedback } from './pc-favorite-feedback.js';
import { renderPcWelcomeWalkAnimation } from './pc-welcome-banner.js';
import { getPcTagStyleClass } from './tag-utils.js';
import safetyMascot from '../assets/mobile/mascots/corgi-settings.png';
import detailImagePlaceholder from '../assets/pc/detail-image-placeholder.png';
import deleteIcon from '../assets/pc/action-delete.png';

function iconImg(src, alt = '') {
    return `<img src="${src}" alt="${escapeHtml(alt)}" class="pc-icon-img">`;
}

function getDetailState(pageEl) {
    return pageEl._pcDetailState;
}

function render(params = {}) {
    return `
        <div class="pc-detail-screen">
            <div class="pc-detail-sky" aria-hidden="true"></div>
            <div class="pc-detail-walk-decoration" aria-hidden="true">
                ${renderPcWelcomeWalkAnimation({ variant: 'detail' })}
            </div>
            <div class="pc-detail-hero">
                <div class="pc-detail-hero-copy">
                    <h1 class="pc-detail-page-title"><span class="pc-detail-page-kicker">提示词详情</span><span class="pc-detail-page-name" id="pcDetailPageName">加载中</span></h1>
                    <nav class="pc-detail-breadcrumb" aria-label="当前位置">
                        <button class="pc-detail-breadcrumb-link" id="pcDetailBack" type="button">首页</button>
                        <span class="pc-detail-breadcrumb-sep">${pcIcon('chevronRight', 'pc-detail-breadcrumb-icon')}</span>
                        <button class="pc-detail-breadcrumb-link" id="pcDetailLibraryCrumb" type="button">提示词库</button>
                        <span class="pc-detail-breadcrumb-sep">${pcIcon('chevronRight', 'pc-detail-breadcrumb-icon')}</span>
                        <span class="pc-detail-breadcrumb-current" id="pcDetailBreadcrumbName">加载中</span>
                    </nav>
                </div>
                <div class="pc-detail-top-nav-actions">
                    <button class="pc-detail-top-nav-btn" id="pcDetailStar" title="收藏" aria-pressed="false" aria-label="收藏" type="button">${pcIcon('star', 'pc-detail-button-icon')}<span>收藏</span></button>
                    <button class="pc-detail-top-nav-btn pc-detail-top-nav-btn-more" id="pcDetailMoreTop" title="更多" aria-label="更多" aria-haspopup="menu" aria-expanded="false" type="button"><span class="pc-more-dots" aria-hidden="true"><span></span><span></span><span></span></span></button>
                </div>
            </div>
            <div class="pc-detail-page" id="pcDetailContent">
                <div class="pc-empty-state" style="padding:80px 0;">
                    <span class="pc-empty-icon">${pcIcon('clock', 'pc-empty-icon-img')}</span>
                    <span class="pc-empty-text">加载中...</span>
                </div>
            </div>
        </div>
    `;
}

async function mount(pageEl, params = {}) {
    const id = params.id;
    if (!id) { navigate('/library'); return; }

    try {
        const storage = getStorage();
        const promptSet = await storage.getPromptSet(id);
        if (!promptSet) { showToast('提示词不存在', 'error'); navigate('/library'); return; }
        pageEl._pcDetailState = { promptSet, activeVersionIndex: 0, imageUrls: [], currentImageIndex: 0, onEdit: params.onEdit };
        await loadImages(pageEl);
        renderDetailContent(pageEl);
        setupEvents(pageEl);
    } catch (e) {
        console.error('mount detail error:', e);
        showToast('加载失败', 'error');
    }
}

async function loadImages(pageEl) {
    const state = getDetailState(pageEl);
    state.imageUrls = [];
    state.currentImageIndex = 0;
    const { promptSet, activeVersionIndex } = state;
    if (!promptSet) return;
    const versions = promptSet.versions || [];
    const currentVersion = versions[activeVersionIndex];
    if (!currentVersion || !currentVersion.images) return;

    const storage = getStorage();
    for (const img of currentVersion.images) {
        try {
            const url = await storage.getImageUrl(img);
            state.imageUrls.push({ url, name: img.name || '', data: img });
        } catch (e) {
            state.imageUrls.push({ url: '', name: img.name || '', data: img });
        }
    }
}

function renderDetailContent(pageEl) {
    const { promptSet, activeVersionIndex } = getDetailState(pageEl);
    const container = pageEl.querySelector('#pcDetailContent');
    if (!container || !promptSet) return;

    const versions = promptSet.versions || [];
    const currentVersion = versions[activeVersionIndex] || null;
    const positivePrompt = currentVersion ? (currentVersion.prompt || '') : '';
    const negativePrompt = currentVersion ? (currentVersion.negativePrompt || currentVersion.negative_prompt || '') : '';

    let tags = [];
    try { tags = JSON.parse(promptSet.tags || '[]'); } catch (e) { tags = []; }
    if (!Array.isArray(tags)) tags = [];

    const isFavorite = promptSet.isFavorite === true;

    updateStarButton(pageEl, isFavorite);
    updateBreadcrumbName(pageEl, promptSet.name);

    container.innerHTML = `
        <div class="pc-detail-shell">
            <div class="pc-detail-layout">
                <section class="pc-detail-main-column" aria-label="提示词主内容">
                    ${renderCoverImage(pageEl)}
                    ${renderImageThumbs(pageEl)}
                    ${renderTitleRow(promptSet.name, tags, pageEl)}
                    ${renderMetaStrip(promptSet)}
                    ${renderPositivePromptCard(positivePrompt)}
                    ${renderNegativePromptCard(negativePrompt)}
                    ${renderBottomBar()}
                </section>
                <aside class="pc-detail-side-column" aria-label="提示词辅助信息">
                    ${renderInfoCard(currentVersion, tags, promptSet)}
                    ${renderVersionCard(versions, pageEl)}
                    ${renderLocalSafetyCard()}
                </aside>
            </div>
        </div>
    `;

    loadCoverImage(pageEl);
}

function updateBreadcrumbName(pageEl, name) {
    const current = pageEl.querySelector('#pcDetailBreadcrumbName');
    if (current) current.textContent = name || '未命名提示词';
    const pageName = pageEl.querySelector('#pcDetailPageName');
    if (pageName) {
        const displayName = name || '未命名提示词';
        pageName.textContent = displayName;
        pageName.title = displayName;
    }
}

function renderCoverImage(pageEl) {
    const { imageUrls, currentImageIndex } = getDetailState(pageEl);
    const hasImages = imageUrls.length > 0;
    const hasMultiple = imageUrls.length > 1;

    return `
        <div class="pc-detail-cover pc-detail-fade-in" id="pcDetailCover">
            ${hasImages ? `
                <div class="pc-detail-cover-img-wrap" id="pcDetailCoverImgWrap" data-cursor="native"></div>
                ${hasMultiple ? `
                    <button class="pc-detail-cover-nav pc-detail-cover-prev" id="pcDetailImgPrev" type="button" aria-label="上一张">${pcIcon('chevronLeft', 'pc-detail-cover-nav-icon')}</button>
                    <button class="pc-detail-cover-nav pc-detail-cover-next" id="pcDetailImgNext" type="button" aria-label="下一张">${pcIcon('chevronRight', 'pc-detail-cover-nav-icon')}</button>
                    <span class="pc-detail-cover-counter" id="pcDetailImgCounter">${currentImageIndex + 1} / ${imageUrls.length}</span>
                    <div class="pc-detail-cover-dots" id="pcDetailImgDots">
                        ${imageUrls.map((_, i) => `
                            <button class="pc-detail-cover-dot ${i === currentImageIndex ? 'pc-detail-cover-dot-active' : ''}" data-dot-index="${i}"></button>
                        `).join('')}
                    </div>
                ` : ''}
            ` : `
                <div class="pc-detail-cover-placeholder">
                    <img class="pc-detail-cover-placeholder-icon" src="${detailImagePlaceholder}" alt="暂无封面图片" loading="lazy">
                    <span>暂无封面图片</span>
                </div>
            `}
        </div>
    `;
}

function renderImageThumbs(pageEl) {
    const { imageUrls, currentImageIndex } = getDetailState(pageEl);
    if (imageUrls.length <= 1) return '';

    return `
        <section class="pc-detail-image-thumbs pc-detail-fade-in" aria-label="图片预览">
            <div class="pc-detail-image-thumbs-header">
                <span class="pc-detail-image-thumbs-title">图片预览</span>
                <span class="pc-detail-image-thumbs-count">${imageUrls.length} 张</span>
            </div>
            <div class="pc-detail-image-thumbs-scroll" id="pcDetailImageThumbs">
                ${imageUrls.map((image, index) => `
                    <button
                        class="pc-detail-image-thumb ${index === currentImageIndex ? 'pc-detail-image-thumb-active' : ''}"
                        type="button"
                        data-thumb-index="${index}"
                        aria-label="查看第 ${index + 1} 张图片"
                        aria-pressed="${index === currentImageIndex ? 'true' : 'false'}">
                        ${image.url
                            ? `<img src="${image.url}" alt="${escapeHtml(image.name || `第 ${index + 1} 张图片`)}" loading="lazy">`
                            : '<span class="pc-detail-image-thumb-fallback">加载失败</span>'}
                    </button>
                `).join('')}
            </div>
        </section>
    `;
}

function switchImage(pageEl, newIndex) {
    const state = getDetailState(pageEl);
    const { imageUrls } = state;
    if (newIndex < 0 || newIndex >= imageUrls.length) return;
    state.currentImageIndex = newIndex;

    const imgWrap = pageEl.querySelector('#pcDetailCoverImgWrap');
    const counter = pageEl.querySelector('#pcDetailImgCounter');
    const dots = pageEl.querySelectorAll('.pc-detail-cover-dot');
    const thumbs = pageEl.querySelectorAll('.pc-detail-image-thumb');

    if (imgWrap) {
        const currentImg = imgWrap.querySelector('img');
        if (currentImg) {
            currentImg.style.opacity = '0';
            setTimeout(() => {
                if (imageUrls[state.currentImageIndex] && imageUrls[state.currentImageIndex].url) {
                    currentImg.src = imageUrls[state.currentImageIndex].url;
                    currentImg.alt = imageUrls[state.currentImageIndex].name || '封面';
                }
                currentImg.style.opacity = '1';
            }, 150);
        }
    }

    if (counter) {
        counter.textContent = `${state.currentImageIndex + 1} / ${imageUrls.length}`;
    }

    dots.forEach((dot, i) => {
        if (i === state.currentImageIndex) {
            dot.classList.add('pc-detail-cover-dot-active');
        } else {
            dot.classList.remove('pc-detail-cover-dot-active');
        }
    });

    thumbs.forEach((thumb, i) => {
        const isActive = i === state.currentImageIndex;
        thumb.classList.toggle('pc-detail-image-thumb-active', isActive);
        thumb.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        if (isActive && typeof thumb.scrollIntoView === 'function') {
            thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
    });
}

function renderTitleRow(name, tags, pageEl) {
    const { promptSet } = getDetailState(pageEl);
    const tagsHtml = renderTagPills(tags);

    return `
        <div class="pc-detail-title-row pc-detail-fade-in">
            <div class="pc-detail-title-left">
                <h1 class="pc-detail-title">${escapeHtml(name)}</h1>
                <div class="pc-detail-tags">
                    ${tagsHtml}
                </div>
            </div>
            <div class="pc-detail-fav">
                <span class="pc-detail-fav-icon">${pcIcon('heart', 'pc-detail-fav-icon-img')}</span>
                <span class="pc-detail-fav-count">${promptSet.isFavorite ? '1' : '0'}</span>
            </div>
        </div>
    `;
}

function renderTagPills(tags) {
    return tags.length > 0
        ? tags.map(t => {
            return `<span class="pc-tag-pill ${getPcTagStyleClass(t)}">${escapeHtml(t)}</span>`;
        }).join('')
        : '<span class="pc-tag-pill pc-tag-default">提示词</span>';
}

function renderMetaStrip(set) {
    return `
        <div class="pc-detail-meta-strip pc-detail-fade-in">
            <div class="pc-detail-meta-item">
                <span class="pc-detail-meta-icon">${pcIcon('calendar', 'pc-detail-meta-icon-img')}</span>
                <span class="pc-detail-meta-label">创建时间</span>
                <span class="pc-detail-meta-value">${formatDate(set.createdAt) || '-'}</span>
            </div>
            <div class="pc-detail-meta-item">
                <span class="pc-detail-meta-icon">${pcIcon('user', 'pc-detail-meta-icon-img')}</span>
                <span class="pc-detail-meta-label">创建者</span>
                <span class="pc-detail-meta-value">提示词管家</span>
            </div>
        </div>
    `;
}

function renderPositivePromptCard(text) {
    const displayText = formatPromptForDisplay(text);

    return `
        <div class="pc-detail-prompt-card pc-detail-fade-in">
            <div class="pc-detail-prompt-header">
                <div class="pc-detail-prompt-header-left">
                    <span class="pc-detail-prompt-icon pc-detail-prompt-icon-positive">${pcIcon('sparkles', 'pc-detail-prompt-icon-img')}</span>
                    <span class="pc-detail-prompt-title">正向提示词 (Positive)</span>
                </div>
                <button class="pc-detail-prompt-copy pc-detail-prompt-copy-positive" data-copy="positive">复制</button>
            </div>
            <div class="pc-detail-prompt-content pc-detail-prompt-content-positive">${displayText ? escapeHtml(displayText) : '<span class="pc-detail-prompt-empty">暂无正向提示词</span>'}</div>
        </div>
    `;
}

function renderNegativePromptCard(text) {
    const displayText = formatPromptForDisplay(text);

    return `
        <div class="pc-detail-prompt-card pc-detail-fade-in">
            <div class="pc-detail-prompt-header">
                <div class="pc-detail-prompt-header-left">
                    <span class="pc-detail-prompt-icon pc-detail-prompt-icon-negative">${pcIcon('ban', 'pc-detail-prompt-icon-img')}</span>
                    <span class="pc-detail-prompt-title">负向提示词 (Negative)</span>
                </div>
                <button class="pc-detail-prompt-copy pc-detail-prompt-copy-negative" data-copy="negative">复制</button>
            </div>
            <div class="pc-detail-prompt-content pc-detail-prompt-content-negative">${displayText ? escapeHtml(displayText) : '<span class="pc-detail-prompt-empty">暂无负向提示词</span>'}</div>
        </div>
    `;
}

function renderInfoCard(currentVersion, tags, set) {
    const aspectRatio = currentVersion ? (currentVersion.aspectRatio || '1:1') : '-';
    const createdAt = formatDate(set.createdAt);

    const tagsHtml = tags.length > 0
        ? tags.map(t => `<span class="pc-detail-info-tag ${getPcTagStyleClass(t)}">${escapeHtml(t)}</span>`).join('')
        : '<span style="color:var(--pc-text3)">-</span>';

    return `
        <div class="pc-detail-info-card pc-detail-fade-in">
            <h2 class="pc-detail-side-title">信息概览</h2>
            <div class="pc-detail-info-grid">
                <div class="pc-detail-info-item">
                    <span class="pc-detail-info-label">标签</span>
                    <div class="pc-detail-info-tags">
                        ${tagsHtml}
                    </div>
                </div>
                <div class="pc-detail-info-item">
                    <span class="pc-detail-info-label">比例</span>
                    <span class="pc-detail-info-value">${escapeHtml(aspectRatio)}</span>
                </div>
                <div class="pc-detail-info-item">
                    <span class="pc-detail-info-label">创建时间</span>
                    <span class="pc-detail-info-value">${createdAt || '-'}</span>
                </div>
            </div>
        </div>
    `;
}

function renderVersionCard(versions, pageEl) {
    const { activeVersionIndex, promptSet } = getDetailState(pageEl);
    if (!versions || versions.length === 0) return '';

    const displayVersions = versions.slice(0, 3);
    const hasMore = versions.length > 3;

    return `
        <div class="pc-detail-version-card pc-detail-fade-in">
            <div class="pc-detail-version-header">
                <h2 class="pc-detail-side-title">版本记录</h2>
                ${hasMore ? `<button class="pc-detail-version-view-all" id="pcDetailViewAllVersions">查看全部 ${pcIcon('chevronRight', 'pc-detail-version-link-icon')}</button>` : ''}
            </div>
            ${displayVersions.map((v, i) => {
                const versionIdx = i;
                const isActive = versionIdx === activeVersionIndex;
                const versionName = v.name || ('V' + (versionIdx + 1));
                const versionDate = formatDate(v.createdAt || promptSet.updatedAt);
                return `
                    <div class="pc-detail-version-item" data-version-index="${versionIdx}" data-cursor="action">
                        <span class="pc-detail-version-badge">${versionName}</span>
                        ${isActive ? '<span class="pc-detail-version-current">当前版本</span>' : ''}
                        <span class="pc-detail-version-time">${versionDate}</span>
                        <span class="pc-detail-version-arrow">${pcIcon('chevronRight', 'pc-detail-version-arrow-icon')}</span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderLocalSafetyCard() {
    return `
        <div class="pc-detail-safety-card pc-detail-fade-in">
            <div class="pc-detail-safety-copy">
                <span class="pc-detail-safety-icon">${pcIcon('shield', 'pc-detail-safety-icon-img')}</span>
                <div>
                    <strong>开始编写提示词</strong>
                </div>
            </div>
            <img class="pc-detail-safety-mascot" src="${safetyMascot}" alt="" loading="lazy">
        </div>
    `;
}

function renderBottomBar() {
    return `
        <div class="pc-detail-bottom-bar pc-detail-fade-in">
            <button class="pc-detail-action-btn pc-detail-action-edit" id="pcDetailEdit">
                <span class="pc-detail-action-icon">${pcIcon('edit', 'pc-detail-action-icon-img')}</span>
                编辑
            </button>
            <button class="pc-detail-action-btn pc-detail-action-copy" id="pcDetailCopyAll">
                <span class="pc-detail-action-icon">${pcIcon('clipboard', 'pc-detail-action-icon-img')}</span>
                复制
            </button>
            <button class="pc-detail-action-btn pc-detail-action-more" id="pcDetailMore" aria-haspopup="menu" aria-expanded="false">
                <span class="pc-detail-action-icon"><span class="pc-more-dots" aria-hidden="true"><span></span><span></span><span></span></span></span>
                更多
            </button>
        </div>
    `;
}

function updateStarButton(pageEl, isFavorite) {
    const btn = pageEl.querySelector('#pcDetailStar');
    if (!btn) return;
    if (isFavorite) {
        btn.innerHTML = `${pcIcon('starFilled', 'pc-detail-button-icon')}<span>收藏</span>`;
        btn.classList.add('pc-detail-top-nav-btn-starred');
    } else {
        btn.innerHTML = `${pcIcon('star', 'pc-detail-button-icon')}<span>收藏</span>`;
        btn.classList.remove('pc-detail-top-nav-btn-starred');
    }
    btn.setAttribute('aria-pressed', String(isFavorite));
    btn.setAttribute('aria-label', isFavorite ? '取消收藏' : '收藏');
    btn.title = isFavorite ? '取消收藏' : '收藏';
}

async function loadCoverImage(pageEl) {
    const { imageUrls, currentImageIndex } = getDetailState(pageEl);
    const imgWrap = pageEl.querySelector('#pcDetailCoverImgWrap');
    if (!imgWrap) return;

    if (imageUrls.length > 0 && imageUrls[currentImageIndex] && imageUrls[currentImageIndex].url) {
        const img = document.createElement('img');
        img.src = imageUrls[currentImageIndex].url;
        img.alt = '封面';
        img.onerror = function () { this.style.display = 'none'; };
        imgWrap.appendChild(img);
    }
}

function setupEvents(pageEl) {
    const state = getDetailState(pageEl);
    const { promptSet } = state;
    pageEl.querySelector('#pcDetailBack')?.addEventListener('click', () => navigate('/'));
    pageEl.querySelector('#pcDetailLibraryCrumb')?.addEventListener('click', () => navigate('/library'));

    pageEl.querySelector('#pcDetailStar')?.addEventListener('click', async (event) => {
        if (!promptSet) return;
        const button = event.currentTarget;
        if (button.dataset.favoritePending === 'true') return;
        const previousState = promptSet.isFavorite === true;
        button.dataset.favoritePending = 'true';
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        try {
            const storage = getStorage();
            const result = await storage.toggleFavorite(promptSet.id);
            promptSet.isFavorite = result.isFavorite;
            updateStarButton(pageEl, result.isFavorite);
            playPcFavoriteFeedback(button, result.isFavorite === true);
            const favCount = pageEl.querySelector('.pc-detail-fav-count');
            if (favCount) favCount.textContent = result.isFavorite ? '1' : '0';
            showToast(result.isFavorite ? '已收藏' : '已取消收藏');
        } catch (e) {
            promptSet.isFavorite = previousState;
            updateStarButton(pageEl, previousState);
            showToast('操作失败', 'error');
        } finally {
            delete button.dataset.favoritePending;
            button.disabled = false;
            button.removeAttribute('aria-busy');
        }
    });

    pageEl.querySelector('#pcDetailMoreTop')?.addEventListener('click', (e) => {
        showMoreMenu(e, pageEl);
    });

    pageEl.querySelector('#pcDetailCoverImgWrap')?.addEventListener('click', () => {
        if (state.imageUrls.length > 0 && state.imageUrls[state.currentImageIndex] && state.imageUrls[state.currentImageIndex].url) {
            const image = state.imageUrls[state.currentImageIndex];
            showImageViewer({
                src: image.url,
                filename: image.name || promptSet.name || 'preview',
                image: image.data,
            });
        }
    });

    pageEl.querySelector('#pcDetailImgPrev')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const newIndex = state.currentImageIndex > 0 ? state.currentImageIndex - 1 : state.imageUrls.length - 1;
        switchImage(pageEl, newIndex);
    });

    pageEl.querySelector('#pcDetailImgNext')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const newIndex = state.currentImageIndex < state.imageUrls.length - 1 ? state.currentImageIndex + 1 : 0;
        switchImage(pageEl, newIndex);
    });

    pageEl.querySelectorAll('.pc-detail-cover-dot').forEach(dot => {
        dot.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(dot.dataset.dotIndex);
            if (!isNaN(idx)) switchImage(pageEl, idx);
        });
    });

    pageEl.querySelectorAll('.pc-detail-image-thumb').forEach(thumb => {
        thumb.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(thumb.dataset.thumbIndex);
            if (!isNaN(idx)) switchImage(pageEl, idx);
        });
    });

    pageEl.querySelectorAll('.pc-detail-prompt-copy').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.copy;
            const versions = state.promptSet.versions || [];
            const v = versions[state.activeVersionIndex];
            if (!v) return;
            const text = type === 'positive'
                ? (v.prompt || '')
                : (v.negativePrompt || v.negative_prompt || '');
            copyToClipboard(text);
            btn.classList.add('td-copy-success');
            setTimeout(() => btn.classList.remove('td-copy-success'), 500);
        });
    });

    setupPromptTextSelectionMenu(pageEl);

    pageEl.querySelectorAll('.pc-detail-version-item').forEach(item => {
        item.addEventListener('click', async () => {
            const idx = parseInt(item.dataset.versionIndex);
            if (isNaN(idx)) return;
            state.activeVersionIndex = idx;
            await loadImages(pageEl);
            renderDetailContent(pageEl);
            setupEvents(pageEl);
        });
    });

    pageEl.querySelector('#pcDetailViewAllVersions')?.addEventListener('click', () => {
        showToast('版本管理功能开发中');
    });

    pageEl.querySelector('#pcDetailEdit')?.addEventListener('click', async () => {
        if (!state.promptSet) return;
        if (state.onEdit) await state.onEdit(state.promptSet.id);
        navigate('/editor/' + state.promptSet.id);
    });

    pageEl.querySelector('#pcDetailCopyAll')?.addEventListener('click', () => {
        if (!state.promptSet || !state.promptSet.versions || state.promptSet.versions.length === 0) return;
        const v = state.promptSet.versions[state.activeVersionIndex];
        const positive = v.prompt || '';
        const negative = v.negativePrompt || v.negative_prompt || '';
        const full = positive + (negative ? '\n\nNegative:\n' + negative : '');
        copyToClipboard(full);
        const copyAllBtn = pageEl.querySelector('#pcDetailCopyAll');
        if (copyAllBtn) {
            copyAllBtn.classList.add('td-copy-success');
            setTimeout(() => copyAllBtn.classList.remove('td-copy-success'), 500);
        }
    });

    pageEl.querySelector('#pcDetailMore')?.addEventListener('click', (e) => {
        showMoreMenu(e, pageEl);
    });
}

function clearPromptTextSelectionMenu(pageEl) {
    if (pageEl._promptTextSelectionTimer) {
        clearTimeout(pageEl._promptTextSelectionTimer);
        pageEl._promptTextSelectionTimer = null;
    }
    pageEl._promptTextSelectionSignature = '';
    if (pageEl._promptTextSelectionHandler) {
        document.removeEventListener('selectionchange', pageEl._promptTextSelectionHandler);
        pageEl._promptTextSelectionHandler = null;
    }
    hideContextMenu();
}

function getPromptTextSelection(contentEls) {
    const selection = window.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed) return null;

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();
    const isWithinPromptContent = (node) => {
        const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
        return contentEls.some(contentEl => contentEl.contains(element));
    };

    if (!selectedText || !isWithinPromptContent(range.startContainer) || !isWithinPromptContent(range.endContainer)) return null;

    const rect = range.getBoundingClientRect();
    if (!rect.width && !rect.height) return null;

    return {
        text: selectedText,
        rect,
        signature: `${selectedText}:${rect.left}:${rect.top}:${rect.width}:${rect.height}`,
    };
}

function setupPromptTextSelectionMenu(pageEl) {
    clearPromptTextSelectionMenu(pageEl);
    const contentEls = [...pageEl.querySelectorAll('.pc-detail-prompt-content')];
    if (!contentEls.length) return;

    const queueMenu = () => {
        const selection = getPromptTextSelection(contentEls);
        if (!selection) {
            clearPromptTextSelectionMenuTimer(pageEl);
            pageEl._promptTextSelectionSignature = '';
            hideContextMenu();
            return;
        }
        if (selection.signature === pageEl._promptTextSelectionSignature) return;

        clearPromptTextSelectionMenuTimer(pageEl);
        pageEl._promptTextSelectionTimer = setTimeout(async () => {
            pageEl._promptTextSelectionTimer = null;
            const currentSelection = getPromptTextSelection(contentEls);
            if (!currentSelection) return;
            pageEl._promptTextSelectionSignature = currentSelection.signature;
            const action = await showContextMenu(0, 0, [
                { action: 'copy', icon: pcIcon('clipboard'), tone: 'copy', label: '复制' },
            ], {
                focusMenu: false,
                restoreFocusElement: contentEls.find(contentEl => contentEl.contains(window.getSelection()?.anchorNode)),
                referenceRect: currentSelection.rect,
                placement: { preferredSide: 'top', fallbackSide: 'bottom', gap: 16, safeMargin: 24 },
                variant: 'text-selection',
            });
            if (action === 'copy') copyToClipboard(currentSelection.text);
        }, 180);
    };

    pageEl._promptTextSelectionHandler = queueMenu;
    document.addEventListener('selectionchange', queueMenu);
    contentEls.forEach(contentEl => {
        contentEl.addEventListener('pointerup', queueMenu);
        contentEl.addEventListener('keyup', queueMenu);
    });
}

function clearPromptTextSelectionMenuTimer(pageEl) {
    if (!pageEl._promptTextSelectionTimer) return;
    clearTimeout(pageEl._promptTextSelectionTimer);
    pageEl._promptTextSelectionTimer = null;
}

async function showMoreMenu(e, pageEl) {
    const state = getDetailState(pageEl);
    const anchor = e.currentTarget;
    const rect = anchor.getBoundingClientRect();
    const x = rect.right + 8;
    const y = rect.bottom + 8;

    const action = await showContextMenu(x, y, [
        { action: 'addVersion', icon: pcIcon('plus'), label: '新建版本' },
        { action: 'compare', icon: pcIcon('balance'), label: '版本对比' },
        { divider: true },
        { action: 'delete', icon: iconImg(deleteIcon), tone: 'delete', label: '删除提示词', danger: true }
    ], { anchor, source: 'more' });

    if (!action) return;

    if (action === 'addVersion') {
        await addNewVersion(pageEl);
    } else if (action === 'compare') {
        showToast('版本对比功能开发中');
    } else if (action === 'delete') {
        showConfirmModal('确定要删除这个提示词吗？此操作不可撤销。', async () => {
            try {
                await getStorage().deletePromptSet(state.promptSet.id);
                showToast('已删除');
                navigate('/library');
            } catch (e) {
                showToast('删除失败', 'error');
            }
        });
    }
}

async function addNewVersion(pageEl) {
    const state = getDetailState(pageEl);
    const { promptSet } = state;
    const { showModal, closeModal } = await import('./pc-utils.js');
    const modal = showModal(`
        <h3>新建版本</h3>
        <div class="pc-form-group">
            <label class="pc-form-label">版本名称</label>
            <input type="text" class="pc-input" id="pcNewVersionName" placeholder="例如：v2" value="v${(promptSet.versions || []).length + 1}">
        </div>
        <div class="pc-modal-actions">
            <button class="pc-btn pc-btn-secondary" id="pcNewVersionCancel">取消</button>
            <button class="pc-btn pc-btn-primary" id="pcNewVersionOk">创建</button>
        </div>
    `);

    const nameInput = modal.querySelector('#pcNewVersionName');
    requestAnimationFrame(() => { nameInput.focus(); nameInput.select(); });

    const doCreate = async () => {
        const name = nameInput.value.trim() || ('v' + ((promptSet.versions || []).length + 1));
        const newVersion = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            name,
            prompt: '',
            negativePrompt: '',
            note: '',
            aspectRatio: '1:1',
            images: [],
            createdAt: new Date().toISOString()
        };

        const versions = [...(promptSet.versions || [])];
        versions.unshift(newVersion);

        try {
            await getStorage().updatePromptSet(promptSet.id, { versions });
            promptSet.versions = versions;
            state.activeVersionIndex = 0;
            await loadImages(pageEl);
            closeModal();
            renderDetailContent(pageEl);
            setupEvents(pageEl);
            showToast('已创建新版本');
        } catch (e) { showToast('创建失败', 'error'); }
    };

    modal.querySelector('#pcNewVersionOk').addEventListener('click', doCreate);
    modal.querySelector('#pcNewVersionCancel').addEventListener('click', closeModal);
    nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doCreate(); });
}

function unmount(pageEl) {
    clearPromptTextSelectionMenu(pageEl);
    delete pageEl._pcDetailState;
}

export { render, mount, unmount };
