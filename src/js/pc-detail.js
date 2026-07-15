import { getStorage } from './storage.js';
import { navigate } from './pc-app.js';
import { showToast, showConfirmModal, copyToClipboard, showImageViewer, showContextMenu, escapeHtml, formatDate } from './pc-utils.js';
import { formatPromptForDisplay } from './pc-prompt-ui-utils.js';
import { pcIcon } from './pc-icon-assets.js';
import { renderPcWelcomeWalkAnimation } from './pc-welcome-banner.js';
import safetyMascot from '../assets/mobile/mascots/corgi-settings.png';
import detailImagePlaceholder from '../assets/pc/detail-image-placeholder.png';
import deleteIcon from '../assets/pc/action-delete.png';

const TAG_COLORS = ['pc-tag-blue', 'pc-tag-pink', 'pc-tag-green', 'pc-tag-yellow', 'pc-tag-purple'];
const TAG_BG_COLORS = ['#EAF5FF', '#FFF0F5', '#EFFFF4', '#FFF8E0', '#EFE5FF'];
const TAG_TEXT_COLORS = ['#2D8CFF', '#FF6B9A', '#29B37A', '#FFC94A', '#8A6BFF'];

function iconImg(src, alt = '') {
    return `<img src="${src}" alt="${escapeHtml(alt)}" class="pc-icon-img">`;
}

let promptSet = null;
let activeVersionIndex = 0;
let imageUrls = [];
let currentImageIndex = 0;

function render(params = {}) {
    return `
        <div class="pc-detail-screen">
            <div class="pc-detail-sky" aria-hidden="true"></div>
            <div class="pc-detail-walk-decoration" aria-hidden="true">
                ${renderPcWelcomeWalkAnimation({ variant: 'detail' })}
            </div>
            <div class="pc-detail-hero">
                <div class="pc-detail-hero-copy">
                    <h1 class="pc-detail-page-title">提示词详情</h1>
                    <nav class="pc-detail-breadcrumb" aria-label="当前位置">
                        <button class="pc-detail-breadcrumb-link" id="pcDetailBack" type="button">首页</button>
                        <span class="pc-detail-breadcrumb-sep">${pcIcon('chevronRight', 'pc-detail-breadcrumb-icon')}</span>
                        <button class="pc-detail-breadcrumb-link" id="pcDetailLibraryCrumb" type="button">提示词库</button>
                        <span class="pc-detail-breadcrumb-sep">${pcIcon('chevronRight', 'pc-detail-breadcrumb-icon')}</span>
                        <span class="pc-detail-breadcrumb-current" id="pcDetailBreadcrumbName">加载中</span>
                    </nav>
                </div>
                <div class="pc-detail-top-nav-actions">
                    <button class="pc-detail-top-nav-btn" id="pcDetailStar" title="收藏" type="button">${pcIcon('star', 'pc-detail-button-icon')}<span>收藏</span></button>
                    <button class="pc-detail-top-nav-btn pc-detail-top-nav-btn-more" id="pcDetailMoreTop" title="更多" aria-label="更多" type="button">${pcIcon('moreHorizontal', 'pc-detail-button-icon')}</button>
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
        promptSet = await storage.getPromptSet(id);
        if (!promptSet) { showToast('提示词不存在', 'error'); navigate('/library'); return; }

        activeVersionIndex = 0;
        currentImageIndex = 0;
        await loadImages();
        renderDetailContent(pageEl);
        setupEvents(pageEl);
    } catch (e) {
        console.error('mount detail error:', e);
        showToast('加载失败', 'error');
    }
}

async function loadImages() {
    imageUrls = [];
    currentImageIndex = 0;
    if (!promptSet) return;
    const versions = promptSet.versions || [];
    const currentVersion = versions[activeVersionIndex];
    if (!currentVersion || !currentVersion.images) return;

    const storage = getStorage();
    for (const img of currentVersion.images) {
        try {
            const url = await storage.getImageUrl(img);
            imageUrls.push({ url, name: img.name || '', data: img });
        } catch (e) {
            imageUrls.push({ url: '', name: img.name || '', data: img });
        }
    }
}

function renderDetailContent(pageEl) {
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
                    ${renderCoverImage()}
                    ${renderImageThumbs()}
                    ${renderTitleRow(promptSet.name, tags)}
                    ${renderMetaStrip(tags, promptSet)}
                    ${renderPositivePromptCard(positivePrompt)}
                    ${renderNegativePromptCard(negativePrompt)}
                    ${renderBottomBar()}
                </section>
                <aside class="pc-detail-side-column" aria-label="提示词辅助信息">
                    ${renderInfoCard(currentVersion, tags, promptSet)}
                    ${renderVersionCard(versions)}
                    ${renderLocalSafetyCard()}
                </aside>
            </div>
        </div>
    `;

    loadCoverImage();
}

function updateBreadcrumbName(pageEl, name) {
    const current = pageEl.querySelector('#pcDetailBreadcrumbName');
    if (current) current.textContent = name || '未命名提示词';
}

function renderCoverImage() {
    const hasImages = imageUrls.length > 0;
    const hasMultiple = imageUrls.length > 1;

    return `
        <div class="pc-detail-cover pc-detail-fade-in" id="pcDetailCover">
            ${hasImages ? `
                <div class="pc-detail-cover-img-wrap" id="pcDetailCoverImgWrap"></div>
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

function renderImageThumbs() {
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

function switchImage(newIndex) {
    if (newIndex < 0 || newIndex >= imageUrls.length) return;
    currentImageIndex = newIndex;

    const imgWrap = document.getElementById('pcDetailCoverImgWrap');
    const counter = document.getElementById('pcDetailImgCounter');
    const dots = document.querySelectorAll('.pc-detail-cover-dot');
    const thumbs = document.querySelectorAll('.pc-detail-image-thumb');

    if (imgWrap) {
        const currentImg = imgWrap.querySelector('img');
        if (currentImg) {
            currentImg.style.opacity = '0';
            setTimeout(() => {
                if (imageUrls[currentImageIndex] && imageUrls[currentImageIndex].url) {
                    currentImg.src = imageUrls[currentImageIndex].url;
                    currentImg.alt = imageUrls[currentImageIndex].name || '封面';
                }
                currentImg.style.opacity = '1';
            }, 150);
        }
    }

    if (counter) {
        counter.textContent = `${currentImageIndex + 1} / ${imageUrls.length}`;
    }

    dots.forEach((dot, i) => {
        if (i === currentImageIndex) {
            dot.classList.add('pc-detail-cover-dot-active');
        } else {
            dot.classList.remove('pc-detail-cover-dot-active');
        }
    });

    thumbs.forEach((thumb, i) => {
        const isActive = i === currentImageIndex;
        thumb.classList.toggle('pc-detail-image-thumb-active', isActive);
        thumb.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        if (isActive && typeof thumb.scrollIntoView === 'function') {
            thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
    });
}

function renderTitleRow(name, tags) {
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
        ? tags.map((t, i) => {
            const colorIdx = i % TAG_COLORS.length;
            return `<span class="pc-tag-pill ${TAG_COLORS[colorIdx]}">${escapeHtml(t)}</span>`;
        }).join('')
        : '<span class="pc-tag-pill pc-tag-default">提示词</span>';
}

function renderMetaStrip(tags, set) {
    return `
        <div class="pc-detail-meta-strip pc-detail-fade-in">
            <div class="pc-detail-meta-item">
                <span class="pc-detail-meta-icon">${pcIcon('calendar', 'pc-detail-meta-icon-img')}</span>
                <span class="pc-detail-meta-label">创建时间</span>
                <span class="pc-detail-meta-value">${formatDate(set.createdAt) || '-'}</span>
            </div>
            <div class="pc-detail-meta-item">
                <span class="pc-detail-meta-icon">${pcIcon('tag', 'pc-detail-meta-icon-img')}</span>
                <span class="pc-detail-meta-label">标签</span>
                <span class="pc-detail-meta-tags">${renderTagPills(tags)}</span>
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
        ? tags.map((t, i) => {
            const colorIdx = i % TAG_BG_COLORS.length;
            return `<span class="pc-detail-info-tag" style="background:${TAG_BG_COLORS[colorIdx]};color:${TAG_TEXT_COLORS[colorIdx]}">${escapeHtml(t)}</span>`;
        }).join('')
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

function renderVersionCard(versions) {
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
                    <div class="pc-detail-version-item" data-version-index="${versionIdx}">
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
            <button class="pc-detail-action-btn pc-detail-action-more" id="pcDetailMore">
                <span class="pc-detail-action-icon">${pcIcon('moreVertical', 'pc-detail-action-icon-img')}</span>
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
}

async function loadCoverImage() {
    const imgWrap = document.getElementById('pcDetailCoverImgWrap');
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
    pageEl.querySelector('#pcDetailBack')?.addEventListener('click', () => navigate('/'));
    pageEl.querySelector('#pcDetailLibraryCrumb')?.addEventListener('click', () => navigate('/library'));

    pageEl.querySelector('#pcDetailStar')?.addEventListener('click', async () => {
        if (!promptSet) return;
        try {
            const storage = getStorage();
            const result = await storage.toggleFavorite(promptSet.id);
            promptSet.isFavorite = result.isFavorite;
            updateStarButton(pageEl, result.isFavorite);
            const favCount = pageEl.querySelector('.pc-detail-fav-count');
            if (favCount) favCount.textContent = result.isFavorite ? '1' : '0';
            showToast(result.isFavorite ? '已收藏' : '已取消收藏');
        } catch (e) {
            showToast('操作失败', 'error');
        }
    });

    pageEl.querySelector('#pcDetailMoreTop')?.addEventListener('click', (e) => {
        showMoreMenu(e, pageEl);
    });

    pageEl.querySelector('#pcDetailCoverImgWrap')?.addEventListener('click', () => {
        if (imageUrls.length > 0 && imageUrls[currentImageIndex] && imageUrls[currentImageIndex].url) {
            const image = imageUrls[currentImageIndex];
            showImageViewer({
                src: image.url,
                filename: image.name || promptSet.name || 'preview',
                image: image.data,
            });
        }
    });

    pageEl.querySelector('#pcDetailImgPrev')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const newIndex = currentImageIndex > 0 ? currentImageIndex - 1 : imageUrls.length - 1;
        switchImage(newIndex);
    });

    pageEl.querySelector('#pcDetailImgNext')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const newIndex = currentImageIndex < imageUrls.length - 1 ? currentImageIndex + 1 : 0;
        switchImage(newIndex);
    });

    pageEl.querySelectorAll('.pc-detail-cover-dot').forEach(dot => {
        dot.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(dot.dataset.dotIndex);
            if (!isNaN(idx)) switchImage(idx);
        });
    });

    pageEl.querySelectorAll('.pc-detail-image-thumb').forEach(thumb => {
        thumb.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(thumb.dataset.thumbIndex);
            if (!isNaN(idx)) switchImage(idx);
        });
    });

    pageEl.querySelectorAll('.pc-detail-prompt-copy').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.copy;
            const versions = promptSet.versions || [];
            const v = versions[activeVersionIndex];
            if (!v) return;
            const text = type === 'positive'
                ? (v.prompt || '')
                : (v.negativePrompt || v.negative_prompt || '');
            copyToClipboard(text);
            btn.classList.add('td-copy-success');
            setTimeout(() => btn.classList.remove('td-copy-success'), 500);
        });
    });

    pageEl.querySelectorAll('.pc-detail-version-item').forEach(item => {
        item.addEventListener('click', async () => {
            const idx = parseInt(item.dataset.versionIndex);
            if (isNaN(idx)) return;
            activeVersionIndex = idx;
            await loadImages();
            renderDetailContent(pageEl);
            setupEvents(pageEl);
        });
    });

    pageEl.querySelector('#pcDetailViewAllVersions')?.addEventListener('click', () => {
        showToast('版本管理功能开发中');
    });

    pageEl.querySelector('#pcDetailEdit')?.addEventListener('click', () => {
        if (promptSet) navigate('/editor/' + promptSet.id);
    });

    pageEl.querySelector('#pcDetailCopyAll')?.addEventListener('click', () => {
        if (!promptSet || !promptSet.versions || promptSet.versions.length === 0) return;
        const v = promptSet.versions[activeVersionIndex];
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

async function showMoreMenu(e, pageEl) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left;
    const y = rect.bottom + 4;

    const action = await showContextMenu(x, y, [
        { action: 'addVersion', icon: pcIcon('plus'), label: '新建版本' },
        { action: 'compare', icon: pcIcon('balance'), label: '版本对比' },
        { divider: true },
        { action: 'delete', icon: iconImg(deleteIcon), tone: 'delete', label: '删除提示词', danger: true }
    ]);

    if (!action) return;

    if (action === 'addVersion') {
        await addNewVersion(pageEl);
    } else if (action === 'compare') {
        showToast('版本对比功能开发中');
    } else if (action === 'delete') {
        showConfirmModal('确定要删除这个提示词吗？此操作不可撤销。', async () => {
            try {
                await getStorage().deletePromptSet(promptSet.id);
                showToast('已删除');
                navigate('/library');
            } catch (e) {
                showToast('删除失败', 'error');
            }
        });
    }
}

async function addNewVersion(pageEl) {
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
            activeVersionIndex = 0;
            await loadImages();
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
    promptSet = null;
    activeVersionIndex = 0;
    imageUrls = [];
    currentImageIndex = 0;
}

export { render, mount, unmount };
