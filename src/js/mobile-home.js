import { getStorage } from './storage.js';
import { formatDate } from './utils.js';
import { navigate, showMobileToast, showActionSheet, iconImg } from './mobile-utils.js';
import { getPromptSetMenuItems } from './mobile-menu-actions.js';
import { aggregateTags } from './tag-utils.js';
import { mobileIcon } from './mobile-icon-assets.js';
import { isPromptImageToolImportStorageError, stagePromptImageToolImport } from './prompt-tool-json-import.js';
import corgiHome from '../assets/mobile/mascots/corgi-home.png';
import searchIcon from '../assets/mobile/search.png';
import plusIcon from '../assets/icons/plus.svg';
import importIcon from '../assets/icons/import.svg';
import imagePlaceholder from '../assets/mobile/image-placeholder.png';
import greetingHand from '../assets/mobile/greeting-hand.png';
import homeWelcomeBg from '../assets/mobile/home-welcome-bg.png';
import emptyMailbox from '../assets/mobile/empty-mailbox.png';
import emptyFolder from '../assets/mobile/empty-folder.png';

let homeData = null;

const CATEGORY_COLORS = [
    { bg: '#E8F4FF', text: '#2580D6' },
    { bg: '#FFE8A3', text: '#C4A030' },
    { bg: '#EFE5FF', text: '#8B6FCC' },
    { bg: '#FFF0F5', text: '#D4567F' },
    { bg: '#CFF7D7', text: '#3D9942' },
    { bg: '#FFE0CC', text: '#E07020' },
];

const TAG_STYLES = ['m-tag-scene', 'm-tag-japanese', 'm-tag-scifi', 'm-tag-illustration', 'm-tag-chinese'];

function getTagStyle(index) {
    return TAG_STYLES[index % TAG_STYLES.length];
}

function render(params = {}) {
    return `
        <div class="m-page-inner">
            <div class="m-welcome-section m-fade-in" style="background-image: url('${homeWelcomeBg}');">
                <div class="m-welcome-text">
                    <h2>Hi，创作者<img src="${greetingHand}" alt="" class="m-greeting-hand"></h2>
                    <p>今天也要快乐创作呀~</p>
                </div>
                <div class="m-welcome-mascot"><img src="${corgiHome}" alt="柯基助手"></div>
            </div>

            <div class="m-search-bar m-section-gap" id="mHomeSearch">
                <span class="m-search-icon"><img src="${searchIcon}" alt="搜索" class="m-search-icon-img"></span>
                <input type="text" class="m-search-input" placeholder="搜索提示词、标签、分类..." id="mHomeSearchInput">
            </div>

            <div class="m-stat-grid m-section-gap" id="mStatGrid">
                <div class="m-stat-card m-stat-blue m-fade-in">
                    <span class="m-stat-number" id="mStatTotal">-</span>
                    <span class="m-stat-label">提示词总数</span>
                </div>
                <div class="m-stat-card m-stat-yellow m-fade-in">
                    <span class="m-stat-number" id="mStatCategories">-</span>
                    <span class="m-stat-label">分类</span>
                </div>
                <div class="m-stat-card m-stat-purple m-fade-in">
                    <span class="m-stat-number" id="mStatTags">-</span>
                    <span class="m-stat-label">标签</span>
                </div>
                <div class="m-stat-card m-stat-pink m-fade-in">
                    <span class="m-stat-number" id="mStatFavorites">-</span>
                    <span class="m-stat-label">收藏</span>
                </div>
            </div>

            <div class="m-section-gap">
                <div class="m-section-title">
                    <span class="m-section-title-text">最近使用</span>
                    <button class="m-section-title-action" id="mViewAllBtn">查看全部 ${mobileIcon('chevron-right', { className: 'm-icon-sm' })}</button>
                </div>
                <div class="m-list-gap" id="mRecentList"></div>
            </div>

            <div class="m-section-gap">
                <div class="m-section-title">
                    <span class="m-section-title-text">收藏分类</span>
                </div>
                <div class="m-category-grid" id="mCategoryGrid"></div>
            </div>

            <div class="m-section-gap">
                <div class="m-section-title">
                    <span class="m-section-title-text">快速创建</span>
                </div>
                <div class="m-quick-create-grid">
                    <button class="m-quick-create-card" id="mQuickCreate">
                        <span class="m-quick-create-icon">${iconImg(plusIcon)}</span>
                        <span class="m-quick-create-label">新建提示词</span>
                        <span class="m-quick-create-desc">从零开始写</span>
                    </button>
                    <button class="m-quick-create-card" id="mQuickImport">
                        <span class="m-quick-create-icon">${iconImg(importIcon)}</span>
                        <span class="m-quick-create-label">导入提示词</span>
                        <span class="m-quick-create-desc">从文件导入</span>
                    </button>
                </div>
            </div>
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

        const totalEl = pageEl.querySelector('#mStatTotal');
        const catEl = pageEl.querySelector('#mStatCategories');
        const tagsEl = pageEl.querySelector('#mStatTags');
        const favEl = pageEl.querySelector('#mStatFavorites');
        if (totalEl) totalEl.textContent = promptSets.length;
        if (catEl) catEl.textContent = folders.length;
        if (tagsEl) tagsEl.textContent = aggregateTags(promptSets).length;
        if (favEl) favEl.textContent = promptSets.filter(p => p.isFavorite === true).length;

        await renderRecentList(pageEl, promptSets);
        renderCategoryGrid(pageEl, folders, promptSets);
    } catch (e) {
        console.error('loadHomeData error:', e);
    }
}

async function renderRecentList(pageEl, promptSets) {
    const container = pageEl.querySelector('#mRecentList');
    if (!container) return;

    const recent = promptSets.slice(0, 3);

    if (recent.length === 0) {
        container.innerHTML = `
            <div class="m-empty-state">
                <span class="m-empty-icon"><img src="${emptyMailbox}" alt="空状态" class="m-empty-icon-img"></span>
                <span class="m-empty-text">还没有提示词，点击下方快速创建吧~</span>
            </div>
        `;
        return;
    }

    container.innerHTML = recent.map((item, idx) => `
        <div class="m-prompt-card m-fade-in" data-id="${item.id}" style="animation-delay: ${idx * 30}ms">
            <div class="m-prompt-thumb${item.firstImage ? '' : ' m-prompt-thumb-default'}">${item.firstImage ? `<img alt="" data-first-image='${JSON.stringify(item.firstImage).replace(/'/g, "&#39;")}'>` : `<img src="${imagePlaceholder}" alt="默认图片" class="m-prompt-thumb-placeholder">`}</div>
            <div class="m-prompt-info">
                <div class="m-prompt-name">${escapeHtml(item.name)}</div>
                <div class="m-prompt-tags">
                    ${item.folderId ? '<span class="m-tag-pill m-tag-default">已分类</span>' : '<span class="m-tag-pill m-tag-default">未分类</span>'}
                </div>
                <div class="m-prompt-time">${formatRelativeTime(item.updatedAt)}</div>
            </div>
            <div class="m-prompt-actions">
                <button class="m-star-btn ${item.isFavorite === true ? 'm-starred' : ''}" data-id="${item.id}" aria-label="${item.isFavorite === true ? '取消收藏' : '收藏'}">${mobileIcon(item.isFavorite === true ? 'star-filled' : 'star')}</button>
                <button class="m-more-btn" data-id="${item.id}" aria-label="更多操作">${mobileIcon('more')}</button>
            </div>
        </div>
    `).join('');

    loadHomeThumbImages(container);
}

async function loadHomeThumbImages(container) {
    const imgs = container.querySelectorAll('.m-prompt-thumb img[data-first-image]');
    if (imgs.length === 0) return;
    const storage = getStorage();
    imgs.forEach(async (img) => {
        const raw = img.dataset.firstImage;
        if (!raw) return;
        try {
            const imgData = JSON.parse(raw);
            const url = await storage.getImageUrl(imgData);
            if (url) img.src = url;
        } catch (e) {}
    });
}

function renderCategoryGrid(pageEl, folders, promptSets) {
    const container = pageEl.querySelector('#mCategoryGrid');
    if (!container) return;

    if (folders.length === 0) {
        container.innerHTML = `
            <div class="m-empty-state" style="grid-column: 1/-1">
                <span class="m-empty-icon"><img src="${emptyFolder}" alt="空状态" class="m-empty-icon-img"></span>
                <span class="m-empty-text">还没有分类</span>
            </div>
        `;
        return;
    }

    const displayFolders = folders.slice(0, 4);
    container.innerHTML = displayFolders.map((folder, idx) => {
        const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
        const count = promptSets.filter(p => p.folderId === folder.id).length;
        return `
            <div class="m-category-card m-fade-in" data-folder-id="${folder.id}" style="background: ${color.bg}; animation-delay: ${idx * 50}ms">
                <span class="m-category-name" style="color: ${color.text}">${escapeHtml(folder.name)}</span>
                <span class="m-category-count" style="color: ${color.text}">${count} 个提示词</span>
            </div>
        `;
    }).join('');
}

function setupHomeEvents(pageEl) {
    pageEl.querySelector('#mViewAllBtn')?.addEventListener('click', () => {
        navigate('/library');
    });

    pageEl.querySelector('#mQuickCreate')?.addEventListener('click', () => {
        navigate('/editor/');
    });

    pageEl.querySelector('#mQuickImport')?.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = handleImport;
        input.click();
    });

    pageEl.querySelector('#mRecentList')?.addEventListener('click', async (e) => {
        const card = e.target.closest('.m-prompt-card');
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
                    starBtn.innerHTML = mobileIcon('star-filled');
                    starBtn.setAttribute('aria-label', '取消收藏');
                } else {
                    starBtn.classList.remove('m-starred');
                    starBtn.innerHTML = mobileIcon('star');
                    starBtn.setAttribute('aria-label', '收藏');
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
                    onActionDone: () => loadHomeData(pageEl)
                })
            );
        }
    });

    pageEl.querySelector('#mCategoryGrid')?.addEventListener('click', (e) => {
        const card = e.target.closest('.m-category-card');
        if (card) {
            const folderId = card.dataset.folderId;
            showFolderPromptSheet(pageEl, folderId);
        }
    });

    const searchInput = pageEl.querySelector('#mHomeSearchInput');
    const searchBar = pageEl.querySelector('#mHomeSearch');
    if (searchInput && searchBar) {
        searchInput.addEventListener('focus', () => searchBar.classList.add('m-search-focused'));
        searchInput.addEventListener('blur', () => searchBar.classList.remove('m-search-focused'));
        searchInput.addEventListener('input', (e) => {
            if (e.target.value.trim()) {
                navigate('/library');
            }
        });
    }
}

function showFolderPromptSheet(pageEl, folderId) {
    if (!homeData) return;
    const folder = homeData.folders.find(f => f.id === folderId);
    const prompts = homeData.promptSets.filter(p => p.folderId === folderId);
    const folderName = folder ? folder.name : '未分类';

    const items = [];
    if (prompts.length > 0) {
        prompts.forEach(p => {
            items.push({
                action: 'prompt-' + p.id,
                icon: mobileIcon(p.isFavorite ? 'star-filled' : 'file'),
                label: p.name,
                handler: () => navigate('/detail/' + p.id)
            });
        });
    }
    items.push({
        action: 'view-all',
        icon: mobileIcon('clipboard'),
        label: `查看「${folderName}」全部提示词`,
        handler: () => navigate('/library?folder=' + folderId)
    });

    showActionSheet(items);
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
            showMobileToast('已识别为 prompt-image-tool 导入包');
            return;
        }
        const result = await getStorage().importData(data);
        showMobileToast(`导入成功：新增 ${result.added || 0}，覆盖 ${result.updated || 0}`);
    } catch (err) {
        showMobileToast(getJsonImportErrorMessage(err), 'error');
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
