import { getStorage } from './storage.js';
import { navigate } from './pc-app.js';
import { showToast, showContextMenu, setContextMenuTargetId, copyToClipboard, showImageViewer, escapeHtml, formatRelativeTime, formatDate } from './pc-utils.js';
import { getPromptSetMenuItems } from './pc-menu-actions.js';
import { renderPcWelcomeBanner, renderPcWelcomeWalkAnimation } from './pc-welcome-banner.js';
import { countPromptSetsByFolder, getPromptFolderId } from './pc-prompt-ui-utils.js';
import { pcIcon } from './pc-icon-assets.js';

let libraryData = null;
let currentFilter = 'all';
let searchKeyword = '';
let selectedPromptId = '';
let currentPage = 1;
let pageSize = 20;
let libraryScrollState = null;

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const TAG_COLORS = ['pc-tag-green', 'pc-tag-orange', 'pc-tag-blue', 'pc-tag-purple', 'pc-tag-pink'];
const promptDetailCache = new Map();

function getLibraryScrollContainer(pageEl) {
    return pageEl?.querySelector('.pc-library-table-scroll') || null;
}

function captureLibraryScrollState(pageEl) {
    const mainScroll = document.getElementById('pcMain');
    const tableScroll = getLibraryScrollContainer(pageEl);
    return {
        pageScrollTop: mainScroll?.scrollTop || 0,
        tableScrollTop: tableScroll?.scrollTop || 0,
        tableScrollLeft: tableScroll?.scrollLeft || 0,
    };
}

function restoreLibraryScrollState(pageEl) {
    if (!libraryScrollState) return;

    const state = libraryScrollState;
    libraryScrollState = null;

    const runRestore = () => {
        const mainScroll = document.getElementById('pcMain');
        const tableScroll = getLibraryScrollContainer(pageEl);

        if (mainScroll) {
            mainScroll.scrollTop = state.pageScrollTop || 0;
        }
        if (tableScroll) {
            tableScroll.scrollTop = state.tableScrollTop || 0;
            tableScroll.scrollLeft = state.tableScrollLeft || 0;
        }
    };

    if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(runRestore);
    } else {
        setTimeout(runRestore, 0);
    }
}

const ICONS = {
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m16.5 16.5 4 4"></path></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>',
    chevronDown: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"></path></svg>',
    more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5"></circle><circle cx="12" cy="12" r="1.5"></circle><circle cx="19" cy="12" r="1.5"></circle></svg>',
    image: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"></rect><circle cx="8.5" cy="9.5" r="1.5"></circle><path d="m21 15-4.5-4.5L8 19"></path></svg>',
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z"></path></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"></rect><rect x="4" y="4" width="11" height="11" rx="2"></rect></svg>',
    folder: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9Z"></path></svg>'
};

function render(params = {}) {
    return `
        ${renderPcWelcomeBanner({
            title: '提示词库',
            subtitle: '整理灵感，快速找到下一条好提示词~',
            className: 'pc-welcome-banner-library',
            decorationsHtml: renderPcWelcomeWalkAnimation({ variant: 'library' })
        })}

        <section class="pc-library-page">
            <div class="pc-library-search-row">
                <div class="pc-library-search-wrap">
                    <label class="pc-library-search" for="pcLibrarySearch">
                        <span class="pc-library-search-icon">${ICONS.search}</span>
                        <input type="text" class="pc-library-search-input" placeholder="搜索提示词、标签、分类..." id="pcLibrarySearch">
                    </label>
                </div>
                <button class="pc-library-primary-btn" id="pcLibraryCreateBtn">
                    <span class="pc-library-btn-icon">${ICONS.plus}</span>
                    <span>新建提示词</span>
                    <span class="pc-library-btn-divider"></span>
                    <span class="pc-library-btn-icon">${ICONS.chevronDown}</span>
                </button>
            </div>

            <div class="pc-library-toolbar" id="pcLibraryFilter"></div>

            <div id="pcLibraryContent"></div>
        </section>
    `;
}

async function mount(pageEl, params = {}) {
    const hasExplicitQuery = Boolean(params.folder || params.tag || params.search);
    if (params.folder) currentFilter = 'folder:' + params.folder;
    if (params.tag) currentFilter = 'tag:' + params.tag;
    if (params.search) searchKeyword = params.search;
    if (hasExplicitQuery) {
        currentPage = 1;
        selectedPromptId = '';
        libraryScrollState = null;
    }

    await loadLibraryData(pageEl);
    setupLibraryEvents(pageEl);

    const searchInput = pageEl.querySelector('#pcLibrarySearch');
    if (searchInput && searchKeyword) searchInput.value = searchKeyword;
    restoreLibraryScrollState(pageEl);
}

async function loadLibraryData(pageEl) {
    try {
        const storage = getStorage();
        const [promptSets, folders] = await Promise.all([
            storage.getPromptSets(),
            storage.getFolders()
        ]);
        libraryData = { promptSets, folders };
        renderFilterBar(pageEl);
        renderLibraryContent(pageEl);
    } catch (e) {
        console.error('loadLibraryData error:', e);
        showToast('提示词库加载失败', 'error');
    }
}

function renderFilterBar(pageEl) {
    const container = pageEl.querySelector('#pcLibraryFilter');
    if (!container || !libraryData) return;

    const total = libraryData.promptSets.length;
    const favoriteCount = libraryData.promptSets.filter(p => p.isFavorite === true).length;
    const folderCounts = countPromptSetsByFolder(libraryData.promptSets);
    const uncategorizedCount = libraryData.promptSets.filter(p => !getPromptFolderId(p)).length;
    const folderFilters = (libraryData.folders || []).map(folder => ({
        key: 'folder:' + folder.id,
        label: folder.name || '未命名分类',
        count: folderCounts.get(folder.id) || 0,
        icon: ICONS.folder
    }));
    const filters = [
        { key: 'all', label: '全部', count: total },
        { key: 'favorites', label: '收藏', count: favoriteCount },
        { key: 'recent', label: '最近使用' },
        { key: 'uncategorized', label: '未分类', count: uncategorizedCount, icon: ICONS.folder },
        ...folderFilters
    ];

    container.innerHTML = `
        <div class="pc-library-filter-group">
            ${filters.map(filter => renderToolbarButton(filter)).join('')}
        </div>
    `;
}

function renderToolbarButton(filter) {
    const isActive = currentFilter === filter.key;
    return `
        <button class="pc-library-filter-btn ${isActive ? 'pc-library-filter-active' : ''}" data-filter="${filter.key}">
            ${filter.icon ? `<span class="pc-library-filter-icon">${filter.icon}</span>` : ''}
            <span>${escapeHtml(filter.label)}</span>
            ${filter.count !== undefined ? `<span class="pc-library-filter-count">${filter.count}</span>` : ''}
            ${filter.dropdown ? `<span class="pc-library-filter-chevron">${ICONS.chevronDown}</span>` : ''}
        </button>
    `;
}

function getFilteredItems() {
    if (!libraryData) return [];
    let items = [...libraryData.promptSets];

    if (currentFilter === 'favorites') {
        items = items.filter(p => p.isFavorite === true);
    } else if (currentFilter === 'uncategorized') {
        items = items.filter(p => !getPromptFolderId(p));
    } else if (currentFilter.startsWith('folder:')) {
        const folderId = currentFilter.slice(7);
        items = items.filter(p => getPromptFolderId(p) === folderId);
    } else if (currentFilter.startsWith('tag:')) {
        const tagName = currentFilter.slice(4);
        items = items.filter(p => getTags(p).includes(tagName));
    }

    if (searchKeyword) {
        const kw = searchKeyword.toLowerCase();
        items = items.filter(item => {
            const folderName = getFolderName(item).toLowerCase();
            const tags = getTags(item).join(' ').toLowerCase();
            return (item.name || '').toLowerCase().includes(kw) || folderName.includes(kw) || tags.includes(kw);
        });
    }

    items.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return items;
}

function renderLibraryContent(pageEl) {
    const container = pageEl.querySelector('#pcLibraryContent');
    if (!container || !libraryData) return;

    const items = getFilteredItems();
    const pageCount = getPageCount(items.length);
    if (currentPage < 1) currentPage = 1;
    if (currentPage > pageCount) currentPage = pageCount;

    if (items.length === 0) {
        selectedPromptId = '';
        container.innerHTML = renderEmptyState();
        return;
    }

    if (!items.some(item => item.id === selectedPromptId)) {
        selectedPromptId = items[0].id;
    }

    const start = (currentPage - 1) * pageSize;
    const pageItems = items.slice(start, start + pageSize);
    if (!pageItems.some(item => item.id === selectedPromptId)) {
        selectedPromptId = pageItems[0].id;
    }
    const selectedItem = items.find(item => item.id === selectedPromptId) || pageItems[0];

    container.innerHTML = `
        <div class="pc-library-workspace">
            <div class="pc-library-table-card">
                <div class="pc-library-table-scroll">
                    <table class="pc-library-table">
                        <thead>
                            <tr>
                                <th class="pc-library-col-prompt">提示词</th>
                                <th>标签</th>
                                <th>创建时间</th>
                                <th>最近使用</th>
                                <th>收藏</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody id="pcLibraryTableBody">
                            ${pageItems.map(item => renderTableRow(item)).join('')}
                        </tbody>
                    </table>
                </div>
                ${renderPagination(items.length, pageCount)}
            </div>
            <aside class="pc-library-preview" id="pcLibraryPreview">
                ${renderPreviewPanel(selectedItem)}
            </aside>
        </div>
    `;

    loadLibraryImages(container);
    ensureSelectedDetail(pageEl, selectedItem.id);
}

function renderEmptyState() {
    return `
        <div class="pc-library-empty">
            <span class="pc-library-empty-icon">${ICONS.image}</span>
            <span class="pc-library-empty-title">${searchKeyword ? '没有找到匹配的提示词' : '还没有提示词'}</span>
            <span class="pc-library-empty-desc">可以调整筛选条件，或新建一条提示词。</span>
        </div>
    `;
}

function renderTableRow(item) {
    const tags = getTags(item);
    const displayTags = tags.slice(0, 3);
    const activeClass = item.id === selectedPromptId ? 'pc-library-row-active' : '';

    return `
        <tr class="${activeClass}" data-id="${item.id}">
            <td class="pc-library-prompt-cell">
                ${renderThumb(item, 'pc-library-thumb')}
                <div class="pc-library-prompt-copy">
                    <strong>${escapeHtml(item.name || '未命名提示词')}</strong>
                    <span>${escapeHtml(buildSummaryText(item))}</span>
                </div>
            </td>
            <td>
                <div class="pc-library-tags">
                    ${displayTags.map((tag, i) => `<span class="pc-tag-pill ${TAG_COLORS[i % TAG_COLORS.length]}">${escapeHtml(tag)}</span>`).join('')}
                    ${tags.length > 3 ? `<span class="pc-tag-pill pc-tag-default">+${tags.length - 3}</span>` : ''}
                </div>
            </td>
            <td><span class="pc-library-time">${formatShortDate(item.createdAt)}</span></td>
            <td><span class="pc-library-time">${formatRelativeTime(item.updatedAt)}</span></td>
            <td>
                <button class="pc-library-icon-btn pc-library-star-btn ${item.isFavorite === true ? 'pc-library-starred' : ''}" data-id="${item.id}" title="收藏" aria-label="收藏">
                    ${ICONS.star}
                </button>
            </td>
            <td>
                <button class="pc-library-icon-btn pc-library-more-btn" data-id="${item.id}" title="更多" aria-label="更多">
                    ${ICONS.more}
                </button>
            </td>
        </tr>
    `;
}

function renderThumb(item, className) {
    return `
        <div class="${className}${item.firstImage ? '' : ' pc-library-thumb-empty'}">
            ${item.firstImage
                ? `<img alt="${escapeHtml(item.name || '提示词图片')}" data-first-image='${JSON.stringify(item.firstImage).replace(/'/g, '&#39;')}'>`
                : ICONS.image}
        </div>
    `;
}

function renderPagination(total, pageCount) {
    const pages = buildPageList(pageCount, currentPage);
    return `
        <div class="pc-library-pagination">
            <div class="pc-library-page-left">
                <span>共 ${total} 条</span>
                <label class="pc-library-page-size-label">
                    <select class="pc-library-page-size" id="pcLibraryPageSize" aria-label="每页数量">
                        ${PAGE_SIZE_OPTIONS.map(size => `<option value="${size}" ${size === pageSize ? 'selected' : ''}>${size}条/页</option>`).join('')}
                    </select>
                    <span class="pc-library-page-size-icon">${ICONS.chevronDown}</span>
                </label>
            </div>
            <div class="pc-library-page-center">
                <button class="pc-library-page-btn" data-page="${Math.max(1, currentPage - 1)}" ${currentPage === 1 ? 'disabled' : ''} aria-label="上一页">${pcIcon('chevronLeft', 'pc-library-page-icon')}</button>
                ${pages.map(page => page === '...'
                    ? '<span class="pc-library-page-ellipsis">...</span>'
                    : `<button class="pc-library-page-btn ${page === currentPage ? 'pc-library-page-active' : ''}" data-page="${page}">${page}</button>`
                ).join('')}
                <button class="pc-library-page-btn" data-page="${Math.min(pageCount, currentPage + 1)}" ${currentPage === pageCount ? 'disabled' : ''} aria-label="下一页">${pcIcon('chevronRight', 'pc-library-page-icon')}</button>
            </div>
            <div class="pc-library-page-right">
                <span>前往</span>
                <input class="pc-library-page-input" id="pcLibraryPageInput" value="${currentPage}" inputmode="numeric">
                <span>页</span>
            </div>
        </div>
    `;
}

function buildPageList(pageCount, activePage) {
    if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
    const pages = [1];
    const start = Math.max(2, activePage - 1);
    const end = Math.min(pageCount - 1, activePage + 1);
    if (start > 2) pages.push('...');
    for (let page = start; page <= end; page++) pages.push(page);
    if (end < pageCount - 1) pages.push('...');
    pages.push(pageCount);
    return pages;
}

function renderPreviewPanel(item) {
    if (!item) return '';

    const detail = promptDetailCache.get(item.id);
    const tags = getTags(detail || item);
    const currentVersion = detail?.versions?.[0] || null;
    const description = getPreviewDescription(item, detail);
    const versionText = currentVersion ? (currentVersion.version || 'V1.0') : `${item.versionCount || 1} 个版本`;

    return `
        ${renderThumb(item, 'pc-library-preview-cover')}
        <div class="pc-library-preview-title-row">
            <h3>${escapeHtml(item.name || '未命名提示词')}</h3>
            <button class="pc-library-icon-btn pc-library-star-btn ${item.isFavorite === true ? 'pc-library-starred' : ''}" data-id="${item.id}" title="收藏" aria-label="收藏">
                ${ICONS.star}
            </button>
        </div>
        <div class="pc-library-preview-tags">
            ${tags.slice(0, 5).map((tag, i) => `<span class="pc-tag-pill ${TAG_COLORS[i % TAG_COLORS.length]}">${escapeHtml(tag)}</span>`).join('') || '<span class="pc-tag-pill pc-tag-default">未设置标签</span>'}
        </div>
        <div class="pc-library-preview-section">
            <h4>描述</h4>
            <p>${escapeHtml(description)}</p>
        </div>
        <div class="pc-library-preview-meta">
            <div>
                <h4>创建时间</h4>
                <span>${formatDate(item.createdAt)}</span>
            </div>
            <div>
                <h4>最近使用</h4>
                <span>${formatRelativeTime(item.updatedAt)}</span>
            </div>
        </div>
        <div class="pc-library-version-box">
            <h4>版本记录</h4>
            <div class="pc-library-version-item">
                <strong>${escapeHtml(versionText)}</strong>
                <span>${formatDate(currentVersion?.createdAt || item.createdAt)}</span>
            </div>
        </div>
        <div class="pc-library-preview-actions">
            <button class="pc-library-action-btn pc-library-action-edit" data-preview-action="edit" data-id="${item.id}">
                <span>${ICONS.edit}</span>
                <span>编辑</span>
            </button>
            <button class="pc-library-action-btn pc-library-action-copy" data-preview-action="copy" data-id="${item.id}">
                <span>${ICONS.copy}</span>
                <span>复制</span>
            </button>
            <button class="pc-library-action-btn pc-library-action-more" data-preview-action="more" data-id="${item.id}">
                <span>${ICONS.more}</span>
                <span>更多</span>
            </button>
        </div>
    `;
}

function getPreviewDescription(item, detail) {
    const version = detail?.versions?.[0] || null;
    const note = version?.note || '';
    const prompt = version?.prompt || '';
    if (note) return note;
    if (prompt) return prompt.length > 120 ? prompt.slice(0, 120) + '...' : prompt;
    return buildSummaryText(item);
}

async function ensureSelectedDetail(pageEl, id) {
    if (!id || promptDetailCache.has(id)) return;
    try {
        const detail = await getStorage().getPromptSet(id);
        promptDetailCache.set(id, detail);
        if (selectedPromptId === id) renderPreviewOnly(pageEl);
    } catch (e) {
        console.error('load preview detail error:', e);
    }
}

function renderPreviewOnly(pageEl) {
    const preview = pageEl.querySelector('#pcLibraryPreview');
    if (!preview || !libraryData) return;
    const item = libraryData.promptSets.find(p => p.id === selectedPromptId);
    if (!item) return;
    preview.innerHTML = renderPreviewPanel(item);
    loadLibraryImages(preview);
}

async function loadLibraryImages(container) {
    const imgs = container.querySelectorAll('img[data-first-image]');
    if (imgs.length === 0) return;
    const storage = getStorage();
    imgs.forEach(async (img) => {
        if (img.src) return;
        try {
            const imgData = JSON.parse(img.dataset.firstImage || '{}');
            const url = await storage.getImageUrl(imgData);
            if (url) img.src = url;
        } catch (e) {}
    });
}

function setupLibraryEvents(pageEl) {
    pageEl.querySelector('#pcLibraryCreateBtn')?.addEventListener('click', () => {
        navigate('/editor/');
    });

    pageEl.querySelector('#pcLibrarySearch')?.addEventListener('input', (e) => {
        searchKeyword = e.target.value.trim();
        currentPage = 1;
        renderLibraryContent(pageEl);
    });

    pageEl.querySelector('#pcLibraryFilter')?.addEventListener('click', async (e) => {
        const filterBtn = e.target.closest('[data-filter]');
        if (!filterBtn) return;
        currentFilter = filterBtn.dataset.filter;
        currentPage = 1;
        renderFilterBar(pageEl);
        renderLibraryContent(pageEl);
    });

    pageEl.querySelector('#pcLibraryContent')?.addEventListener('click', async (e) => {
        const previewImg = e.target.closest('.pc-library-preview-cover img');
        if (previewImg && previewImg.src) {
            let imageData = {};
            try {
                imageData = JSON.parse(previewImg.dataset.firstImage || '{}');
            } catch (error) {}
            showImageViewer({
                src: previewImg.src,
                filename: imageData.name || previewImg.alt || 'preview',
                image: imageData,
            });
            return;
        }

        const starBtn = e.target.closest('.pc-library-star-btn');
        if (starBtn) {
            await toggleFavorite(pageEl, starBtn.dataset.id);
            return;
        }

        const moreBtn = e.target.closest('.pc-library-more-btn');
        if (moreBtn) {
            await openPromptMenu(pageEl, moreBtn.dataset.id, moreBtn);
            return;
        }

        const actionBtn = e.target.closest('[data-preview-action]');
        if (actionBtn) {
            await handlePreviewAction(pageEl, actionBtn);
            return;
        }

        const pageBtn = e.target.closest('[data-page]');
        if (pageBtn && !pageBtn.disabled) {
            currentPage = Number(pageBtn.dataset.page);
            renderLibraryContent(pageEl);
            return;
        }

        const row = e.target.closest('tr[data-id]');
        if (row) {
            selectedPromptId = row.dataset.id;
            pageEl.querySelectorAll('.pc-library-table tbody tr').forEach(item => item.classList.remove('pc-library-row-active'));
            row.classList.add('pc-library-row-active');
            renderPreviewOnly(pageEl);
            ensureSelectedDetail(pageEl, selectedPromptId);
        }
    });

    pageEl.querySelector('#pcLibraryContent')?.addEventListener('dblclick', (e) => {
        const row = e.target.closest('tr[data-id]');
        if (row && !e.target.closest('button')) navigate('/detail/' + row.dataset.id);
    });

    pageEl.querySelector('#pcLibraryContent')?.addEventListener('change', (e) => {
        const pageInput = e.target.closest('#pcLibraryPageInput');
        if (pageInput) {
            const pageCount = getPageCount(getFilteredItems().length);
            currentPage = Math.min(pageCount, Math.max(1, Number(pageInput.value) || 1));
            renderLibraryContent(pageEl);
            return;
        }

        const pageSizeSelect = e.target.closest('#pcLibraryPageSize');
        if (pageSizeSelect) {
            pageSize = PAGE_SIZE_OPTIONS.includes(Number(pageSizeSelect.value)) ? Number(pageSizeSelect.value) : 20;
            currentPage = Math.min(currentPage, getPageCount(getFilteredItems().length));
            renderLibraryContent(pageEl);
        }
    });

    pageEl.querySelector('#pcLibraryContent')?.addEventListener('contextmenu', async (e) => {
        const row = e.target.closest('tr[data-id]');
        if (!row) return;
        e.preventDefault();
        selectedPromptId = row.dataset.id;
        renderPreviewOnly(pageEl);
        await openPromptMenu(pageEl, row.dataset.id, { getBoundingClientRect: () => ({ right: e.clientX, bottom: e.clientY }) });
    });
}

async function toggleFavorite(pageEl, id) {
    try {
        const result = await getStorage().toggleFavorite(id);
        const item = libraryData?.promptSets.find(p => p.id === id);
        if (item) item.isFavorite = result.isFavorite;
        const cached = promptDetailCache.get(id);
        if (cached) cached.isFavorite = result.isFavorite;
        showToast(result.isFavorite ? '已收藏' : '已取消收藏');
        renderFilterBar(pageEl);
        renderLibraryContent(pageEl);
    } catch (e) {
        showToast('操作失败', 'error');
    }
}

async function handlePreviewAction(pageEl, button) {
    const id = button.dataset.id;
    const action = button.dataset.previewAction;
    if (action === 'edit') {
        navigate('/editor/' + id);
        return;
    }
    if (action === 'copy') {
        let detail = promptDetailCache.get(id);
        if (!detail) {
            detail = await getStorage().getPromptSet(id);
            promptDetailCache.set(id, detail);
        }
        const version = detail.versions?.[0] || {};
        await copyToClipboard(version.prompt || detail.name || '');
        return;
    }
    if (action === 'more') {
        await openPromptMenu(pageEl, id, button);
    }
}

async function openPromptMenu(pageEl, id, anchor) {
    setContextMenuTargetId(id);
    const items = getPromptSetMenuItems(id, pageEl, {
        onActionDone: () => loadLibraryData(pageEl)
    });
    const rect = anchor.getBoundingClientRect();
    const action = await showContextMenu(rect.right, rect.bottom, items);
    if (action) {
        const menuItem = items.find(i => i.action === action);
        if (menuItem && menuItem.handler) menuItem.handler();
    }
}

function getTags(item) {
    if (!item) return [];
    let tags = [];
    try {
        tags = typeof item.tags === 'string' ? JSON.parse(item.tags || '[]') : (Array.isArray(item.tags) ? item.tags : []);
    } catch (e) {
        tags = [];
    }
    return Array.isArray(tags) ? tags : [];
}

function getFolderName(item) {
    if (!item || !libraryData) return '';
    return libraryData.folders.find(folder => folder.id === getPromptFolderId(item))?.name || '未分类';
}

function buildSummaryText(item) {
    const parts = [];
    if (item.versionCount) parts.push(`${item.versionCount} 个版本`);
    if (item.imageCount) parts.push(`${item.imageCount} 张图片`);
    parts.push(getFolderName(item));
    return parts.join('，');
}

function formatShortDate(dateStr) {
    const full = formatDate(dateStr);
    if (!full) return '';
    return full.replace(' ', '\n');
}

function getPageCount(total) {
    return Math.max(1, Math.ceil(total / pageSize));
}

function unmount(pageEl) {
    libraryScrollState = captureLibraryScrollState(pageEl);
    libraryData = null;
    promptDetailCache.clear();
}

export { render, mount, unmount };
