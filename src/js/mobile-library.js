import { getStorage } from './storage.js';
import { formatDate } from './utils.js';
import { navigate, showMobileToast, showActionSheet } from './mobile-utils.js';
import { getPromptSetMenuItems } from './mobile-menu-actions.js';
import { aggregateTags, getTagStyleClass } from './tag-utils.js';
import { getCurrentRoute } from './mobile-router.js';

let libraryData = null;
let currentFilter = 'all';
let searchKeyword = '';
let folderFilters = [];
let tagFilters = [];

const FIXED_FILTERS = [
    { key: 'all', label: '全部' },
    { key: 'favorite', label: '收藏' },
    { key: 'recent', label: '最近使用' },
];

function render(params = {}) {
    return `
        <div class="m-top-nav">
            <span class="m-top-nav-title">提示词库</span>
            <div class="m-top-nav-actions">
                <button class="m-top-nav-action" id="mLibSearchBtn">🔍</button>
                <button class="m-top-nav-action" id="mLibMoreBtn">⋯</button>
            </div>
        </div>
        <div class="m-page-inner">
            <div class="m-filter-scroll m-section-gap" id="mFilterBar">
                ${[...FIXED_FILTERS, ...folderFilters, ...tagFilters].map(f => `
                    <button class="m-filter-tag ${f.key === currentFilter ? 'm-filter-active' : ''}" data-filter="${f.key}">${f.label}</button>
                `).join('')}
            </div>
            <div class="m-list-gap" id="mLibList"></div>
        </div>
    `;
}

async function mount(pageEl, params = {}) {
    await loadLibraryData(pageEl);
    setupLibraryEvents(pageEl);
}

async function loadLibraryData(pageEl) {
    try {
        const storage = getStorage();
        const [promptSets, folders] = await Promise.all([
            storage.getPromptSets(),
            storage.getFolders()
        ]);
        libraryData = { promptSets, folders };

        folderFilters = folders.map(f => ({
            key: 'folder:' + f.id,
            label: '📁 ' + f.name
        }));

        const tags = aggregateTags(promptSets);
        tagFilters = tags.slice(0, 10).map(tag => ({
            key: 'tag:' + tag.name,
            label: tag.name
        }));

        const route = getCurrentRoute();
        const urlParams = new URLSearchParams(route?.search || '');
        const folderParam = urlParams.get('folder');
        if (folderParam) {
            currentFilter = 'folder:' + folderParam;
        }

        renderFilterBar(pageEl);
        renderList(pageEl);
    } catch (e) {
        console.error('loadLibraryData error:', e);
    }
}

function renderFilterBar(pageEl) {
    const bar = pageEl.querySelector('#mFilterBar');
    if (!bar) return;
    bar.innerHTML = [...FIXED_FILTERS, ...folderFilters, ...tagFilters].map(f => `
        <button class="m-filter-tag ${f.key === currentFilter ? 'm-filter-active' : ''}" data-filter="${f.key}">${f.label}</button>
    `).join('');
}

function getFilteredList() {
    if (!libraryData) return [];
    let list = [...libraryData.promptSets];

    if (searchKeyword) {
        const kw = searchKeyword.toLowerCase();
        list = list.filter(p => p.name.toLowerCase().includes(kw));
    }

    if (currentFilter === 'all') {
        list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    } else if (currentFilter === 'favorite') {
        list = list.filter(p => p.isFavorite === true);
    } else if (currentFilter === 'recent') {
        list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    } else if (currentFilter.startsWith('folder:')) {
        const folderId = currentFilter.slice(7);
        list = list.filter(p => p.folderId === folderId);
    } else if (currentFilter.startsWith('tag:')) {
        const tagName = currentFilter.slice(4);
        list = list.filter(p => {
            let tags = [];
            try { tags = JSON.parse(p.tags || '[]'); } catch (e) { tags = []; }
            return tags.includes(tagName);
        });
    }

    return list;
}

function renderList(pageEl) {
    const container = pageEl.querySelector('#mLibList');
    if (!container) return;

    const list = getFilteredList();

    if (list.length === 0) {
        container.innerHTML = `
            <div class="m-empty-state">
                <span class="m-empty-icon">📚</span>
                <span class="m-empty-text">${searchKeyword ? '未找到匹配的提示词' : '还没有提示词，点击下方加号创建吧~'}</span>
            </div>
        `;
        return;
    }

    container.innerHTML = list.map((item, idx) => `
        <div class="m-prompt-list-card m-fade-in" data-id="${item.id}" style="animation-delay: ${idx * 30}ms">
            <div class="m-prompt-list-thumb">🖼</div>
            <div class="m-prompt-list-content">
                <div class="m-prompt-list-title">${escapeHtml(item.name)}</div>
                <div class="m-prompt-list-desc">${item.versionCount ? item.versionCount + ' 个版本' : ''}${item.imageCount ? ' · ' + item.imageCount + ' 张图片' : ''}</div>
                <div class="m-prompt-list-meta">
                    <span class="m-prompt-list-time">${formatRelativeTime(item.updatedAt)}</span>
                    <div class="m-prompt-list-actions">
                        <button class="m-star-btn ${item.isFavorite === true ? 'm-starred' : ''}" data-id="${item.id}">${item.isFavorite === true ? '⭐' : '☆'}</button>
                        <button class="m-more-btn" data-id="${item.id}">⋯</button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function setupLibraryEvents(pageEl) {
    pageEl.querySelector('#mFilterBar')?.addEventListener('click', (e) => {
        const tag = e.target.closest('.m-filter-tag');
        if (!tag) return;
        currentFilter = tag.dataset.filter;
        pageEl.querySelectorAll('.m-filter-tag').forEach(t => t.classList.remove('m-filter-active'));
        tag.classList.add('m-filter-active');
        renderList(pageEl);
    });

    pageEl.querySelector('#mLibList')?.addEventListener('click', async (e) => {
        const card = e.target.closest('.m-prompt-list-card');
        if (card && !e.target.closest('.m-star-btn') && !e.target.closest('.m-more-btn')) {
            navigate('/detail/' + card.dataset.id);
        }

        const starBtn = e.target.closest('.m-star-btn');
        if (starBtn) {
            const promptId = starBtn.dataset.id;
            try {
                const storage = getStorage();
                const result = await storage.toggleFavorite(promptId);
                const isStarred = result.isFavorite;
                if (isStarred) {
                    starBtn.classList.add('m-starred');
                    starBtn.textContent = '⭐';
                } else {
                    starBtn.classList.remove('m-starred');
                    starBtn.textContent = '☆';
                }
                showMobileToast(isStarred ? '已收藏' : '已取消收藏');
            } catch (e) {
                showMobileToast('操作失败', 'error');
            }
        }

        const moreBtn = e.target.closest('.m-more-btn');
        if (moreBtn) {
            const id = moreBtn.dataset.id;
            showActionSheet(
                getPromptSetMenuItems(id, pageEl, {
                    showEdit: true,
                    onActionDone: () => loadLibraryData(pageEl)
                })
            );
        }
    });

    pageEl.querySelector('#mLibSearchBtn')?.addEventListener('click', () => {
        const searchBar = document.createElement('div');
        searchBar.className = 'm-search-bar m-section-gap';
        searchBar.id = 'mLibSearchBar';
        searchBar.innerHTML = `
            <span class="m-search-icon">🔍</span>
            <input type="text" class="m-search-input" placeholder="搜索提示词..." id="mLibSearchInput" value="${searchKeyword}">
            <button style="color:var(--m-text2);font-size:14px" id="mLibSearchClose">取消</button>
        `;
        const topNav = pageEl.querySelector('.m-top-nav');
        const pageInner = pageEl.querySelector('.m-page-inner');
        if (pageInner && !pageEl.querySelector('#mLibSearchBar')) {
            pageInner.insertBefore(searchBar, pageInner.firstChild);
            const input = searchBar.querySelector('#mLibSearchInput');
            input.focus();
            input.addEventListener('input', (e) => {
                searchKeyword = e.target.value;
                renderList(pageEl);
            });
            searchBar.querySelector('#mLibSearchClose').addEventListener('click', () => {
                searchKeyword = '';
                searchBar.remove();
                renderList(pageEl);
            });
        }
    });

    pageEl.querySelector('#mLibMoreBtn')?.addEventListener('click', () => {
        showActionSheet([
            { action: 'sort', icon: '📊', label: '排序方式', handler: () => showMobileToast('排序功能开发中') },
            { action: 'export', icon: '📤', label: '导出数据', handler: () => handleExport() },
        ]);
    });
}

async function handleExport() {
    try {
        const data = await getStorage().exportData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `prompt-sets-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showMobileToast('导出成功');
    } catch (e) {
        showMobileToast('导出失败', 'error');
    }
}

function unmount(pageEl) {
    searchKeyword = '';
    currentFilter = 'all';
}

function escapeHtml(str) {
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

export { render, mount, unmount };
