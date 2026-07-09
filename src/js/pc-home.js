import { getStorage } from './storage.js';
import { navigate } from './pc-app.js';
import { showToast, showContextMenu, setContextMenuTargetId, escapeHtml, formatRelativeTime } from './pc-utils.js';
import { aggregateTags } from './tag-utils.js';
import { getPromptSetMenuItems } from './pc-menu-actions.js';
import { renderPcWelcomeBanner, renderPcWelcomeWalkAnimation } from './pc-welcome-banner.js';
import { isPromptImageToolImportStorageError, stagePromptImageToolImport } from './prompt-tool-json-import.js';
import homeFolderIcon from '../assets/pc/home-folder.png';
import tagIcon from '../assets/pc/tag-2.png';

let homeData = null;
let homeSearchKeyword = '';

const CATEGORY_COLORS = [
    { bg: '#E8F4FF', text: '#2580D6' },
    { bg: '#FFE8A3', text: '#C4A030' },
    { bg: '#EFE5FF', text: '#8B6FCC' },
    { bg: '#FFF0F5', text: '#D4567F' },
    { bg: '#CFF7D7', text: '#3D9942' },
    { bg: '#FFE0CC', text: '#E07020' },
];

const TAG_COLORS = ['pc-tag-blue', 'pc-tag-pink', 'pc-tag-green', 'pc-tag-yellow', 'pc-tag-purple'];

function assetIcon(src, className = 'pc-home-asset-icon') {
    return `<img src="${src}" alt="" class="${className}" aria-hidden="true">`;
}

const ICONS = {
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m16.5 16.5 4 4"></path></svg>',
    focus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V6a2 2 0 0 1 2-2h2"></path><path d="M16 4h2a2 2 0 0 1 2 2v2"></path><path d="M20 16v2a2 2 0 0 1-2 2h-2"></path><path d="M8 20H6a2 2 0 0 1-2-2v-2"></path><circle cx="12" cy="12" r="3"></circle></svg>',
    prompt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"></path><path d="M8 10h8"></path><path d="M8 14h5"></path></svg>',
    folder: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"></path></svg>',
    tag: assetIcon(tagIcon),
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"></path></svg>',
    more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5"></circle><circle cx="12" cy="12" r="1.5"></circle><circle cx="19" cy="12" r="1.5"></circle></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>',
    import: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h16"></path><path d="M12 4v12"></path><path d="m7 11 5 5 5-5"></path></svg>',
    image: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"></rect><circle cx="8.5" cy="9.5" r="1.5"></circle><path d="m21 15-4.5-4.5L8 19"></path></svg>',
    arrowRight: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>'
};

function render(params = {}) {
    return `
        <section class="pc-home-page">
            ${renderPcWelcomeBanner({
                className: 'pc-welcome-banner-home',
                decorationsHtml: renderPcWelcomeWalkAnimation({ variant: 'home' })
            })}

            <div class="pc-home-search-bar" id="pcHomeSearch">
                <div class="pc-home-search-bar__outer">
                    <div class="pc-home-search-bar__inner">
                        <span class="pc-search-icon pc-home-inline-icon">${ICONS.search}</span>
                        <input type="text" class="pc-search-input" placeholder="搜索提示词、标签、分类..." id="pcHomeSearchInput">
                    </div>
                </div>
            </div>

            <div class="pc-stat-grid pc-home-stat-grid">
                ${renderStatCard('pc-stat-card-blue', ICONS.prompt, '提示词总数', 'pcStatTotal')}
                ${renderStatCard('pc-stat-card-yellow', ICONS.folder, '分类', 'pcStatCategories')}
                ${renderStatCard('pc-stat-card-purple', ICONS.tag, '标签', 'pcStatTags')}
                ${renderStatCard('pc-stat-card-pink', ICONS.star, '收藏', 'pcStatFavorites')}
            </div>

            <section class="pc-home-panel pc-home-recent-panel">
                <div class="pc-section-title pc-home-panel-head">
                    <span class="pc-section-title-text">最近使用</span>
                    <button class="pc-section-title-action pc-home-title-action" id="pcHomeViewAll">
                        <span>查看全部</span>
                        ${ICONS.arrowRight}
                    </button>
                </div>
                <div class="pc-recent-list pc-home-recent-grid" id="pcRecentList"></div>
            </section>

            <div class="pc-home-bottom-grid">
                <section class="pc-home-panel pc-home-category-panel">
                    <div class="pc-section-title pc-home-panel-head">
                        <span class="pc-section-title-text">收藏分类</span>
                        <button class="pc-section-title-action pc-home-title-action" id="pcHomeCategoryAll">
                            <span>查看全部</span>
                            ${ICONS.arrowRight}
                        </button>
                    </div>
                    <div class="pc-category-grid pc-home-category-grid" id="pcHomeCategoryGrid"></div>
                </section>

                <section class="pc-home-panel pc-home-quick-panel">
                    <div class="pc-section-title pc-home-panel-head">
                        <span class="pc-section-title-text">快速创建</span>
                    </div>
                    <div class="pc-quick-create-grid pc-home-quick-grid">
                        <button class="pc-quick-create-card pc-home-quick-card-pink" id="pcQuickCreate">
                            <span class="pc-quick-create-icon pc-home-inline-icon">${ICONS.plus}</span>
                            <span class="pc-quick-create-copy">
                                <span class="pc-quick-create-label">新建提示词</span>
                                <span class="pc-quick-create-desc">从零开始写</span>
                            </span>
                        </button>
                        <button class="pc-quick-create-card pc-home-quick-card-blue" id="pcQuickImport">
                            <span class="pc-quick-create-icon pc-home-inline-icon">${ICONS.import}</span>
                            <span class="pc-quick-create-copy">
                                <span class="pc-quick-create-label">导入提示词</span>
                                <span class="pc-quick-create-desc">从文件导入</span>
                            </span>
                        </button>
                    </div>
                </section>
            </div>
        </section>
    `;
}

function renderStatCard(className, icon, label, valueId) {
    return `
        <div class="pc-stat-card ${className}">
            <span class="pc-stat-icon pc-home-inline-icon">${icon}</span>
            <span class="pc-stat-copy">
                <span class="pc-stat-label">${label}</span>
                <span class="pc-stat-number" id="${valueId}">-</span>
            </span>
        </div>
    `;
}

async function mount(pageEl, params = {}) {
    await loadHomeData(pageEl);
    setupHomeEvents(pageEl);
}

async function loadHomeData(pageEl) {
    try {
        const storage = getStorage();
        const [promptSets, folders] = await Promise.all([
            storage.getPromptSets(),
            storage.getFolders()
        ]);

        homeData = { promptSets, folders };

        const totalEl = pageEl.querySelector('#pcStatTotal');
        const catEl = pageEl.querySelector('#pcStatCategories');
        const tagsEl = pageEl.querySelector('#pcStatTags');
        const favEl = pageEl.querySelector('#pcStatFavorites');
        if (totalEl) totalEl.textContent = promptSets.length;
        if (catEl) catEl.textContent = folders.length;
        if (tagsEl) tagsEl.textContent = aggregateTags(promptSets).length;
        if (favEl) favEl.textContent = promptSets.filter(p => p.isFavorite === true).length;

        renderRecentList(pageEl, promptSets);
        renderCategoryGrid(pageEl, folders, promptSets);
    } catch (e) {
        console.error('loadHomeData error:', e);
    }
}

function matchKeyword(item, kw) {
    if (!kw) return true;
    const lower = kw.toLowerCase();
    if (item.name && item.name.toLowerCase().includes(lower)) return true;
    const folderName = getFolderName(item).toLowerCase();
    if (folderName.includes(lower)) return true;
    let tags = [];
    try { tags = typeof item.tags === 'string' ? JSON.parse(item.tags || '[]') : (Array.isArray(item.tags) ? item.tags : []); } catch (e) { tags = []; }
    return tags.some(t => t.toLowerCase().includes(lower));
}

function getTags(item) {
    try {
        const tags = typeof item.tags === 'string' ? JSON.parse(item.tags || '[]') : item.tags;
        return Array.isArray(tags) ? tags : [];
    } catch (e) {
        return [];
    }
}

function getFolderName(item) {
    const folder = homeData?.folders?.find(f => f.id === item.folderId);
    return folder?.name || (item.folderId ? '已分类' : '未分类');
}

function renderRecentList(pageEl, promptSets) {
    const container = pageEl.querySelector('#pcRecentList');
    if (!container) return;

    let items = [...promptSets].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    if (homeSearchKeyword) {
        items = items.filter(p => matchKeyword(p, homeSearchKeyword));
    }
    const recent = items.slice(0, 6);

    if (recent.length === 0) {
        container.innerHTML = `
            <div class="pc-empty-state pc-home-recent-empty">
                <span class="pc-empty-icon pc-home-inline-icon">${homeSearchKeyword ? ICONS.search : ICONS.prompt}</span>
                <span class="pc-empty-text">${homeSearchKeyword ? '没有找到匹配的提示词' : '还没有提示词，点击下方快速创建吧~'}</span>
            </div>
        `;
        return;
    }

    container.innerHTML = recent.map(item => {
        const tags = getTags(item).slice(0, 3);
        return `
            <div class="pc-recent-item" data-id="${item.id}">
                ${renderRecentThumb(item)}
                <div class="pc-recent-info">
                    <div class="pc-recent-name">${escapeHtml(item.name)}</div>
                    <div class="pc-recent-tags">
                        <span class="pc-tag-pill pc-tag-default">${escapeHtml(getFolderName(item))}</span>
                        ${tags.map((t, i) => `<span class="pc-tag-pill ${TAG_COLORS[i % TAG_COLORS.length]}">${escapeHtml(t)}</span>`).join('')}
                    </div>
                    <div class="pc-recent-time">${formatRelativeTime(item.updatedAt)}</div>
                </div>
                <div class="pc-recent-actions">
                    <button class="pc-star-btn ${item.isFavorite === true ? 'pc-starred' : ''}" data-id="${item.id}" aria-label="收藏" title="收藏">${ICONS.star}</button>
                    <button class="pc-more-btn" data-id="${item.id}" aria-label="更多操作" title="更多操作">${ICONS.more}</button>
                </div>
            </div>
        `;
    }).join('');
    loadHomeImages(container);
}

function renderRecentThumb(item) {
    if (!item.firstImage) {
        return `<div class="pc-recent-thumb pc-recent-thumb-default pc-home-inline-icon">${ICONS.image}</div>`;
    }
    const imageData = JSON.stringify(item.firstImage).replace(/'/g, '&#39;');
    return `
        <div class="pc-recent-thumb">
            <img alt="${escapeHtml(item.name || '提示词图片')}" data-first-image='${imageData}'>
        </div>
    `;
}

async function loadHomeImages(container) {
    const imgs = container.querySelectorAll('img[data-first-image]');
    if (imgs.length === 0) return;
    const storage = getStorage();
    imgs.forEach(async (img) => {
        if (img.src) return;
        try {
            const imgData = JSON.parse(img.dataset.firstImage || '{}');
            const url = await storage.getImageUrl(imgData);
            if (url) img.src = url;
        } catch (e) {
            img.closest('.pc-recent-thumb')?.classList.add('pc-recent-thumb-default');
        }
    });
}

function renderCategoryGrid(pageEl, folders, promptSets) {
    const container = pageEl.querySelector('#pcHomeCategoryGrid');
    if (!container) return;

    let displayFolders = folders;
    if (homeSearchKeyword) {
        const lower = homeSearchKeyword.toLowerCase();
        displayFolders = folders.filter(f => f.name.toLowerCase().includes(lower));
    }

    if (displayFolders.length === 0) {
        container.innerHTML = `
            <div class="pc-empty-state" style="grid-column: 1/-1">
                <span class="pc-empty-icon pc-home-inline-icon">${homeSearchKeyword ? ICONS.search : ICONS.folder}</span>
                <span class="pc-empty-text">${homeSearchKeyword ? '没有找到匹配的分类' : '还没有分类，前往分类管理创建吧'}</span>
            </div>
        `;
        return;
    }

    displayFolders = displayFolders.slice(0, 4);
    container.innerHTML = displayFolders.map((folder, idx) => {
        const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
        const count = promptSets.filter(p => p.folderId === folder.id).length;
        return `
            <div class="pc-category-card pc-home-category-card" data-folder-id="${folder.id}" style="background: ${color.bg}; color: ${color.text}">
                <span class="pc-home-category-icon">
                    <img src="${homeFolderIcon}" alt="" aria-hidden="true">
                </span>
                <span class="pc-home-category-copy">
                    <span class="pc-category-name">${escapeHtml(folder.name)}</span>
                    <span class="pc-category-count">${count}</span>
                </span>
            </div>
        `;
    }).join('');
}

function setupHomeEvents(pageEl) {
    const searchInput = pageEl.querySelector('#pcHomeSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            homeSearchKeyword = e.target.value.trim();
            if (homeData) {
                renderRecentList(pageEl, homeData.promptSets);
                renderCategoryGrid(pageEl, homeData.folders, homeData.promptSets);
            }
        });
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && homeSearchKeyword) {
                const bar = pageEl.querySelector('#pcHomeSearch');
                if (bar) bar.classList.add('is-searching');
                setTimeout(() => navigate('/library', { search: homeSearchKeyword }), 320);
            }
        });
    }

    pageEl.querySelector('#pcHomeViewAll')?.addEventListener('click', () => {
        navigate('/library');
    });

    pageEl.querySelector('#pcHomeCategoryAll')?.addEventListener('click', () => {
        navigate('/category');
    });

    pageEl.querySelector('#pcQuickCreate')?.addEventListener('click', () => {
        navigate('/editor/');
    });

    pageEl.querySelector('#pcQuickImport')?.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = handleImport;
        input.click();
    });

    pageEl.querySelector('#pcRecentList')?.addEventListener('click', async (e) => {
        const item = e.target.closest('.pc-recent-item');
        if (item && !e.target.closest('.pc-star-btn') && !e.target.closest('.pc-more-btn')) {
            navigate('/detail/' + item.dataset.id);
        }

        const starBtn = e.target.closest('.pc-star-btn');
        if (starBtn) {
            const promptId = starBtn.dataset.id;
            try {
                const storage = getStorage();
                const result = await storage.toggleFavorite(promptId);
                const isStarred = result.isFavorite;
                const target = homeData?.promptSets?.find(p => p.id === promptId);
                if (target) target.isFavorite = isStarred;
                const favEl = pageEl.querySelector('#pcStatFavorites');
                if (favEl && homeData) {
                    favEl.textContent = homeData.promptSets.filter(p => p.isFavorite === true).length;
                }
                if (isStarred) {
                    starBtn.classList.add('pc-starred');
                } else {
                    starBtn.classList.remove('pc-starred');
                }
                showToast(isStarred ? '已收藏' : '已取消收藏');
            } catch (e) {
                showToast('操作失败', 'error');
            }
        }

        const moreBtn = e.target.closest('.pc-more-btn');
        if (moreBtn) {
            const id = moreBtn.dataset.id;
            setContextMenuTargetId(id);
            const items = getPromptSetMenuItems(id, pageEl, {
                onActionDone: () => loadHomeData(pageEl)
            });
            const rect = moreBtn.getBoundingClientRect();
            const action = await showContextMenu(rect.right, rect.bottom, items);
            if (action) {
                const menuItem = items.find(i => i.action === action);
                if (menuItem && menuItem.handler) menuItem.handler();
            }
        }
    });

    pageEl.querySelector('#pcHomeCategoryGrid')?.addEventListener('click', (e) => {
        const card = e.target.closest('.pc-category-card');
        if (card) {
            navigate('/library', { folder: card.dataset.folderId });
        }
    });
}

async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        const promptPayload = await stagePromptImageToolImport(data);
        if (promptPayload) {
            navigate('/editor/', { importId: promptPayload.id });
            showToast('已识别为 prompt-image-tool 导入包');
            return;
        }
        const result = await getStorage().importData(data);
        showToast(`导入成功：新增 ${result.added || 0} 条，覆盖 ${result.updated || 0} 条`);
    } catch (err) {
        showToast(getJsonImportErrorMessage(err), 'error');
    }
}

function getJsonImportErrorMessage(err) {
    if (isPromptImageToolImportStorageError(err)) {
        return '导入文件过大，暂存失败，请减少图片数量或重新导出';
    }
    return '导入失败，文件格式不正确';
}

function unmount(pageEl) {
    homeData = null;
    homeSearchKeyword = '';
}

export { render, mount, unmount };
