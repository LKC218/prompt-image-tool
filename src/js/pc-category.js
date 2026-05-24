import { getStorage } from './storage.js';
import { navigate } from './pc-app.js';
import { showToast, showModal, closeModal, showConfirmModal, showContextMenu, escapeHtml } from './pc-utils.js';
import { aggregateTags, getCustomTags, removeCustomTag, saveCustomTag } from './tag-utils.js';
import { renderPcWelcomeBanner } from './pc-welcome-banner.js';
import categoryFolderIcon from '../../UI设计稿/图标/插画设计/文件夹.png';
import categoryTagIcon from '../assets/pc/tag-2.png';
import actionDeleteIcon from '../assets/pc/action-delete.png';
import actionRenameIcon from '../assets/pc/action-rename.png';
import plusIcon from '../assets/icons/plus.svg';
import moreHorizontalIcon from '../assets/icons/more-horizontal.svg';
import gripVerticalIcon from '../assets/icons/grip-vertical.svg';
import arrowUpDownIcon from '../assets/icons/arrow-up-down.svg';
import searchIcon from '../assets/icons/search.svg';
import eyeIcon from '../assets/icons/eye.svg';
import paletteIcon from '../assets/icons/palette-lucide.svg';
import trashIcon from '../assets/icons/trash-2.svg';
import editIcon from '../assets/icons/pencil-line.svg';
import mergeIcon from '../assets/icons/merge.svg';
import rabbitTip from '../assets/mobile/mascots/rabbit-tip.png';

let categoryData = null;
let activeSegment = 'categories';
let categorySearchKeyword = '';
let tagSearchKeyword = '';
let dragState = null;

const FOLDER_COLORS = [
    { name: '蓝色', value: '#2D8CFF', bg: '#EAF5FF' },
    { name: '粉色', value: '#FF6B9A', bg: '#FFE3EB' },
    { name: '绿色', value: '#29B37A', bg: '#EFFFF4' },
    { name: '黄色', value: '#FFC94A', bg: '#FFF8E0' },
    { name: '紫色', value: '#8A6BFF', bg: '#EFE5FF' },
    { name: '橙色', value: '#FF8C42', bg: '#FFE8D0' },
    { name: '红色', value: '#FF5A5A', bg: '#FFE8E8' },
    { name: '青色', value: '#00BCD4', bg: '#E0F7FA' },
];

const TAG_COLORS = ['pc-tag-blue', 'pc-tag-pink', 'pc-tag-green', 'pc-tag-yellow', 'pc-tag-purple', 'pc-tag-orange'];

function iconImg(icon, alt = '') {
    return `<img src="${icon}" alt="${escapeHtml(alt)}" aria-hidden="${alt ? 'false' : 'true'}">`;
}

function parseTags(promptSets) {
    return aggregateTags(promptSets);
}

function render(params = {}) {
    return `
        ${renderPcWelcomeBanner({
            title: '分类与标签',
            subtitle: '把提示词收纳好，灵感就不会走丢~',
            className: 'pc-welcome-banner-category'
        })}

        <div class="pc-category-page">
            <div class="pc-segment-control pc-category-segment" id="pcCategorySegment" role="tablist" aria-label="分类与标签切换">
                <button class="pc-segment-btn pc-segment-active" data-seg="categories" role="tab" aria-selected="true">
                    <span>分类管理</span>
                </button>
                <button class="pc-segment-btn" data-seg="tags" role="tab" aria-selected="false">
                    <span>标签管理</span>
                </button>
            </div>

            <div id="pcCategoryContent"></div>
        </div>
    `;
}

async function mount(pageEl, params = {}) {
    await loadCategoryData(pageEl);
    setupCategoryEvents(pageEl);
}

async function loadCategoryData(pageEl) {
    try {
        const storage = getStorage();
        const [folders, promptSets] = await Promise.all([
            storage.getFolders(),
            storage.getPromptSets()
        ]);
        categoryData = { folders, promptSets };
        renderCategoryContent(pageEl);
    } catch (e) {
        console.error('loadCategoryData error:', e);
    }
}

function renderCategoryContent(pageEl) {
    const container = pageEl.querySelector('#pcCategoryContent');
    if (!container || !categoryData) return;

    if (activeSegment === 'categories') {
        renderCategoriesList(container);
    } else {
        renderTagsList(container);
    }
}

function renderCategoriesList(container) {
    const { folders, promptSets } = categoryData;
    const sortedFolders = [...folders].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const filteredFolders = categorySearchKeyword
        ? sortedFolders.filter(f => f.name.toLowerCase().includes(categorySearchKeyword.toLowerCase()))
        : sortedFolders;

    container.innerHTML = `
        <section class="pc-category-card-panel">
            <div class="pc-category-table-head">
                <span>分类名称</span>
                <span>包含提示词</span>
                <div class="pc-category-head-actions">
                    <button class="pc-btn pc-btn-primary pc-btn-sm pc-category-create-btn" id="pcCreateFolder">
                        <span class="pc-btn-icon">${iconImg(plusIcon)}</span>
                        <span>新建分类</span>
                    </button>
                </div>
            </div>
            <div class="pc-category-panel-tools">
                <div class="pc-search-bar pc-search-bar-sm pc-category-search">
                    <span class="pc-search-icon pc-inline-icon">${iconImg(searchIcon)}</span>
                    <input type="text" class="pc-search-input" placeholder="搜索分类..." id="pcCategorySearch" value="${escapeHtml(categorySearchKeyword)}">
                </div>
                <span class="pc-category-total">共 ${folders.length} 个分类</span>
            </div>
            <div id="pcFolderList" class="pc-folder-list pc-category-table-list">
                ${folders.length === 0 ? `
                    <div class="pc-empty-state pc-category-empty">
                        <span class="pc-empty-icon">${iconImg(categoryFolderIcon, '分类')}</span>
                        <span class="pc-empty-text">还没有分类，点击右上角新建吧</span>
                    </div>
                ` : filteredFolders.length === 0 ? `
                    <div class="pc-empty-state pc-category-empty">
                        <span class="pc-empty-icon">${iconImg(searchIcon, '搜索')}</span>
                        <span class="pc-empty-text">没有匹配的分类</span>
                    </div>
                ` : filteredFolders.map(folder => {
                    const count = promptSets.filter(p => p.folderId === folder.id).length;
                    const color = FOLDER_COLORS.find(c => c.value === folder.color) || FOLDER_COLORS[0];
                    return `
                        <div class="pc-category-list-item" data-folder-id="${folder.id}" draggable="true">
                            <div class="pc-category-name-cell">
                                <div class="pc-category-icon" style="background:${color.bg};color:${color.value};">${iconImg(categoryFolderIcon)}</div>
                                <div class="pc-category-item-info">
                                    <div class="pc-category-item-name">${escapeHtml(folder.name)}</div>
                                </div>
                            </div>
                            <div class="pc-category-item-count">${count} 个提示词</div>
                            <div class="pc-category-item-actions">
                                <button class="pc-icon-btn pc-more-btn" type="button" aria-label="更多操作" title="更多操作" data-id="${folder.id}">
                                    ${iconImg(moreHorizontalIcon)}
                                </button>
                                <div class="pc-drag-handle" title="拖拽排序" aria-label="拖拽排序">${iconImg(gripVerticalIcon)}</div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </section>
        ${renderQuickActions()}
    `;
}

function renderQuickActions() {
    const actions = [
        { key: 'sort', icon: arrowUpDownIcon, label: '排序', desc: '调整分类顺序', tone: 'green' },
        { key: 'batch', icon: editIcon, label: '批量编辑', desc: '批量修改分类信息', tone: 'blue' },
        { key: 'merge', icon: mergeIcon, label: '合并分类', desc: '合并重复分类', tone: 'purple' },
        { key: 'cleanup', icon: actionDeleteIcon, label: '删除', desc: '删除空分类', tone: 'red' },
    ];

    return `
        <section class="pc-quick-actions-section">
            <h3 class="pc-section-subtitle">快速操作</h3>
            <div class="pc-quick-actions-layout">
                <div class="pc-quick-actions">
                    ${actions.map(action => `
                        <button class="pc-quick-action-btn pc-quick-action-${action.tone}" data-quick="${action.key}">
                            <span class="pc-quick-action-icon">${iconImg(action.icon)}</span>
                            <span class="pc-quick-action-copy">
                                <span class="pc-quick-action-label">${action.label}</span>
                                <span class="pc-quick-action-desc">${action.desc}</span>
                            </span>
                        </button>
                    `).join('')}
                </div>
                <div class="pc-quick-tip">
                    <img src="${rabbitTip}" alt="操作提示">
                    <div class="pc-quick-tip-bubble">长按并拖拽可调整顺序哦~</div>
                </div>
            </div>
        </section>
    `;
}

function renderTagsList(container) {
    const { promptSets } = categoryData;
    const allTags = parseTags(promptSets);
    const filteredTags = tagSearchKeyword
        ? allTags.filter(t => t.name.toLowerCase().includes(tagSearchKeyword.toLowerCase()))
        : allTags;

    container.innerHTML = `
        <section class="pc-category-card-panel">
            <div class="pc-category-table-head">
                <span>标签名称</span>
                <span>使用次数</span>
                <div class="pc-category-head-actions">
                    <button class="pc-btn pc-btn-primary pc-btn-sm pc-category-create-btn" id="pcCreateTag">
                        <span class="pc-btn-icon">${iconImg(plusIcon)}</span>
                        <span>新建标签</span>
                    </button>
                    ${allTags.length > 0 ? `
                        <button class="pc-btn pc-btn-danger-outline pc-btn-sm" id="pcClearAllTags">
                            <span class="pc-btn-icon">${iconImg(trashIcon)}</span>
                            <span>清除全部</span>
                        </button>
                    ` : ''}
                </div>
            </div>
            <div class="pc-category-panel-tools">
                <div class="pc-search-bar pc-search-bar-sm pc-category-search">
                    <span class="pc-search-icon pc-inline-icon">${iconImg(searchIcon)}</span>
                    <input type="text" class="pc-search-input" placeholder="搜索标签..." id="pcTagSearch" value="${escapeHtml(tagSearchKeyword)}">
                </div>
                <span class="pc-category-total">共 ${allTags.length} 个标签</span>
            </div>
            <div class="pc-tag-table-list">
                ${allTags.length === 0 ? `
                    <div class="pc-empty-state pc-category-empty">
                        <span class="pc-empty-icon">${iconImg(categoryTagIcon, '标签')}</span>
                        <span class="pc-empty-text">还没有标签，在编辑提示词时可以添加标签</span>
                    </div>
                ` : filteredTags.length === 0 ? `
                    <div class="pc-empty-state pc-category-empty">
                        <span class="pc-empty-icon">${iconImg(searchIcon, '搜索')}</span>
                        <span class="pc-empty-text">没有匹配的标签</span>
                    </div>
                ` : filteredTags.map((tag, i) => `
                    <button class="pc-tag-row pc-tag-clickable" data-tag-name="${escapeHtml(tag.name)}" data-tag-count="${tag.count}">
                        <span class="pc-tag-row-name">
                            <span class="pc-tag-row-icon ${TAG_COLORS[i % TAG_COLORS.length]}">${iconImg(categoryTagIcon)}</span>
                            <span>${escapeHtml(tag.name)}</span>
                        </span>
                        <span class="pc-tag-row-count">${tag.count} 个提示词</span>
                        <span class="pc-tag-row-actions">${iconImg(moreHorizontalIcon)}</span>
                    </button>
                `).join('')}
            </div>
        </section>
    `;
}

function setupCategoryEvents(pageEl) {
    pageEl.querySelector('#pcCategorySegment')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.pc-segment-btn');
        if (!btn) return;
        activeSegment = btn.dataset.seg;
        pageEl.querySelectorAll('.pc-segment-btn').forEach(b => b.classList.remove('pc-segment-active'));
        pageEl.querySelectorAll('.pc-segment-btn').forEach(b => b.setAttribute('aria-selected', 'false'));
        btn.classList.add('pc-segment-active');
        btn.setAttribute('aria-selected', 'true');
        renderCategoryContent(pageEl);
    });

    pageEl.querySelector('#pcCategoryContent')?.addEventListener('click', async (e) => {
        const searchInput = e.target.closest('#pcCategorySearch');
        if (searchInput) return;

        const tagSearchInput = e.target.closest('#pcTagSearch');
        if (tagSearchInput) return;

        const createBtn = e.target.closest('#pcCreateFolder');
        if (createBtn) {
            showCreateFolderDialog(pageEl);
            return;
        }

        const viewBtn = e.target.closest('[data-action="view"]');
        if (viewBtn) {
            navigate('/library', { folder: viewBtn.dataset.id });
            return;
        }

        const moreBtn = e.target.closest('.pc-more-btn');
        if (moreBtn) {
            const folderId = moreBtn.dataset.id;
            const items = [
                { action: 'view', icon: iconImg(eyeIcon), label: '查看提示词' },
                { action: 'rename', icon: iconImg(actionRenameIcon), tone: 'rename', label: '重命名' },
                { action: 'color', icon: iconImg(paletteIcon), label: '更改颜色' },
                { divider: true },
                { action: 'delete', icon: iconImg(actionDeleteIcon), tone: 'delete', label: '删除分类', danger: true }
            ];
            const rect = moreBtn.getBoundingClientRect();
            const action = await showContextMenu(rect.right, rect.bottom, items);
            if (action === 'view') navigate('/library', { folder: folderId });
            else if (action === 'rename') showRenameFolderDialog(pageEl, folderId);
            else if (action === 'color') showChangeColorDialog(pageEl, folderId);
            else if (action === 'delete') showDeleteFolderConfirm(pageEl, folderId);
            return;
        }

        const tagPill = e.target.closest('.pc-tag-clickable');
        if (tagPill) {
            const tagName = tagPill.dataset.tagName;
            const tagCount = parseInt(tagPill.dataset.tagCount, 10);
            const items = [
                { action: 'view-tag', icon: iconImg(searchIcon), label: '查看相关提示词' },
                { action: 'rename-tag', icon: iconImg(actionRenameIcon), tone: 'rename', label: '重命名标签' },
                { divider: true },
                { action: 'clear-tag', icon: iconImg(actionDeleteIcon), tone: 'delete', label: '清除该标签', danger: true }
            ];
            const rect = tagPill.getBoundingClientRect();
            const action = await showContextMenu(rect.left, rect.bottom + 4, items);
            if (action === 'view-tag') {
                navigate('/library', { tag: tagName });
            } else if (action === 'rename-tag') {
                showRenameTagDialog(pageEl, tagName);
            } else if (action === 'clear-tag') {
                showClearTagConfirm(pageEl, tagName, tagCount);
            }
            return;
        }

        const clearAllBtn = e.target.closest('#pcClearAllTags');
        if (clearAllBtn) {
            showClearAllTagsConfirm(pageEl);
            return;
        }

        const createTagBtn = e.target.closest('#pcCreateTag');
        if (createTagBtn) {
            showCreateTagDialog(pageEl);
            return;
        }

        const quickBtn = e.target.closest('[data-quick]');
        if (quickBtn) {
            handleQuickAction(pageEl, quickBtn.dataset.quick);
            return;
        }
    });

    pageEl.querySelector('#pcCategoryContent')?.addEventListener('input', (e) => {
        const categorySearch = e.target.closest('#pcCategorySearch');
        if (categorySearch) {
            categorySearchKeyword = categorySearch.value.trim();
            renderCategoryContent(pageEl);
            const newInput = pageEl.querySelector('#pcCategorySearch');
            if (newInput) {
                newInput.focus();
                newInput.setSelectionRange(newInput.value.length, newInput.value.length);
            }
            return;
        }

        const tagSearch = e.target.closest('#pcTagSearch');
        if (tagSearch) {
            tagSearchKeyword = tagSearch.value.trim();
            renderCategoryContent(pageEl);
            const newInput = pageEl.querySelector('#pcTagSearch');
            if (newInput) {
                newInput.focus();
                newInput.setSelectionRange(newInput.value.length, newInput.value.length);
            }
            return;
        }
    });

    pageEl.querySelector('#pcCategoryContent')?.addEventListener('contextmenu', async (e) => {
        const item = e.target.closest('.pc-category-list-item');
        if (!item) return;
        e.preventDefault();
        const folderId = item.dataset.folderId;
        const items = [
            { action: 'view', icon: iconImg(eyeIcon), label: '查看提示词' },
            { action: 'rename', icon: iconImg(actionRenameIcon), tone: 'rename', label: '重命名' },
            { action: 'color', icon: iconImg(paletteIcon), label: '更改颜色' },
            { divider: true },
            { action: 'delete', icon: iconImg(actionDeleteIcon), tone: 'delete', label: '删除分类', danger: true }
        ];
        const action = await showContextMenu(e.clientX, e.clientY, items);
        if (action === 'view') navigate('/library', { folder: folderId });
        else if (action === 'rename') showRenameFolderDialog(pageEl, folderId);
        else if (action === 'color') showChangeColorDialog(pageEl, folderId);
        else if (action === 'delete') showDeleteFolderConfirm(pageEl, folderId);
    });

    setupDragAndDrop(pageEl);
}

function setupDragAndDrop(pageEl) {
    const list = pageEl.querySelector('#pcFolderList');
    if (!list) return;

    list.addEventListener('dragstart', (e) => {
        const item = e.target.closest('.pc-category-list-item');
        if (!item) return;
        dragState = { draggedId: item.dataset.folderId };
        item.classList.add('pc-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', item.dataset.folderId);
    });

    list.addEventListener('dragend', (e) => {
        const item = e.target.closest('.pc-category-list-item');
        if (item) item.classList.remove('pc-dragging');
        list.querySelectorAll('.pc-drag-over').forEach(el => el.classList.remove('pc-drag-over'));
        dragState = null;
    });

    list.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const item = e.target.closest('.pc-category-list-item');
        if (!item || item.dataset.folderId === dragState?.draggedId) return;
        list.querySelectorAll('.pc-drag-over').forEach(el => el.classList.remove('pc-drag-over'));
        item.classList.add('pc-drag-over');
    });

    list.addEventListener('dragleave', (e) => {
        const item = e.target.closest('.pc-category-list-item');
        if (item) item.classList.remove('pc-drag-over');
    });

    list.addEventListener('drop', async (e) => {
        e.preventDefault();
        const targetItem = e.target.closest('.pc-category-list-item');
        if (!targetItem || !dragState) return;
        targetItem.classList.remove('pc-drag-over');

        const targetId = targetItem.dataset.folderId;
        if (targetId === dragState.draggedId) return;

        const folders = [...categoryData.folders].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        const draggedIdx = folders.findIndex(f => f.id === dragState.draggedId);
        const targetIdx = folders.findIndex(f => f.id === targetId);
        if (draggedIdx === -1 || targetIdx === -1) return;

        const [dragged] = folders.splice(draggedIdx, 1);
        folders.splice(targetIdx, 0, dragged);

        folders.forEach((f, i) => { f.sortOrder = i; });
        categoryData.folders = folders;

        try {
            const storage = getStorage();
            if (storage.reorderFolders) {
                await storage.reorderFolders(folders.map(f => f.id));
            } else {
                for (const f of folders) {
                    await storage.updateFolder(f.id, { sortOrder: f.sortOrder });
                }
            }
        } catch (err) {
            console.error('reorder error:', err);
        }

        renderCategoryContent(pageEl);
    });
}

async function handleQuickAction(pageEl, action) {
    if (action === 'sort') {
        showToast('拖拽分类左侧手柄即可调整顺序', 'warning');
        const firstHandle = pageEl.querySelector('.pc-drag-handle');
        if (firstHandle) {
            firstHandle.classList.add('pc-drag-handle-highlight');
            setTimeout(() => firstHandle.classList.remove('pc-drag-handle-highlight'), 2000);
        }
    } else if (action === 'merge') {
        showMergeFolderDialog(pageEl);
    } else if (action === 'batch') {
        showToast('批量编辑功能开发中', 'warning');
    } else if (action === 'cleanup') {
        showCleanupEmptyFoldersConfirm(pageEl);
    }
}

function showCreateFolderDialog(pageEl) {
    let selectedColor = FOLDER_COLORS[0].value;

    const modal = showModal(`
        <div class="pc-category-create-dialog">
            <div class="pc-category-create-header">
                <h3>新建分类</h3>
                <p>给提示词建立一个清晰的收纳入口</p>
            </div>
            <div class="pc-category-create-body">
                <div class="pc-form-group pc-category-create-field">
                    <label class="pc-form-label" for="pcFolderNameInput">分类名称</label>
                    <input type="text" class="pc-input pc-category-name-input" id="pcFolderNameInput" placeholder="输入分类名称..." maxlength="30">
                </div>
                <div class="pc-form-group pc-category-create-field">
                    <label class="pc-form-label">分类颜色</label>
                    <div class="pc-color-picker pc-category-color-picker" id="pcFolderColorPicker" role="radiogroup" aria-label="分类颜色">
                        ${FOLDER_COLORS.map(c => `
                            <button type="button" class="pc-color-picker-item ${c.value === selectedColor ? 'selected' : ''}" data-color="${c.value}" style="background:${c.value};" role="radio" aria-label="${escapeHtml(c.name)}" aria-checked="${c.value === selectedColor ? 'true' : 'false'}"></button>
                        `).join('')}
                    </div>
                </div>
            </div>
            <div class="pc-modal-actions pc-category-create-actions">
                <button class="pc-btn pc-btn-secondary" id="pcFolderCancel">取消</button>
                <button class="pc-btn pc-btn-primary" id="pcFolderOk" disabled>创建</button>
            </div>
        </div>
    `);

    const nameInput = modal.querySelector('#pcFolderNameInput');
    const okBtn = modal.querySelector('#pcFolderOk');
    requestAnimationFrame(() => nameInput.focus());

    const syncCreateState = () => {
        okBtn.disabled = nameInput.value.trim().length === 0;
    };

    modal.querySelector('#pcFolderColorPicker')?.addEventListener('click', (e) => {
        const dot = e.target.closest('.pc-color-picker-item');
        if (!dot) return;
        selectedColor = dot.dataset.color;
        modal.querySelectorAll('.pc-color-picker-item').forEach(d => {
            d.classList.remove('selected');
            d.setAttribute('aria-checked', 'false');
        });
        dot.classList.add('selected');
        dot.setAttribute('aria-checked', 'true');
    });

    const doCreate = async () => {
        const name = nameInput.value.trim();
        if (!name) { showToast('请输入分类名称', 'error'); return; }
        try {
            await getStorage().createFolder(name, selectedColor);
            showToast('分类已创建');
            closeModal();
            await loadCategoryData(pageEl);
        } catch (e) { showToast('创建失败', 'error'); }
    };

    nameInput.addEventListener('input', syncCreateState);
    okBtn.addEventListener('click', doCreate);
    modal.querySelector('#pcFolderCancel').addEventListener('click', closeModal);
    nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doCreate(); });
}

function showRenameFolderDialog(pageEl, folderId) {
    const folder = categoryData.folders.find(f => f.id === folderId);
    if (!folder) return;

    const modal = showModal(`
        <h3>重命名分类</h3>
        <div class="pc-form-group">
            <input type="text" class="pc-input" id="pcRenameFolderInput" value="${escapeHtml(folder.name)}" maxlength="30">
        </div>
        <div class="pc-modal-actions">
            <button class="pc-btn pc-btn-secondary" id="pcRenameFolderCancel">取消</button>
            <button class="pc-btn pc-btn-primary" id="pcRenameFolderOk">确定</button>
        </div>
    `);

    const input = modal.querySelector('#pcRenameFolderInput');
    requestAnimationFrame(() => { input.focus(); input.select(); });

    const doRename = async () => {
        const name = input.value.trim();
        if (!name) { showToast('名称不能为空', 'error'); return; }
        try {
            await getStorage().updateFolder(folderId, { name });
            showToast('已重命名');
            closeModal();
            await loadCategoryData(pageEl);
        } catch (e) { showToast('重命名失败', 'error'); }
    };

    modal.querySelector('#pcRenameFolderOk').addEventListener('click', doRename);
    modal.querySelector('#pcRenameFolderCancel').addEventListener('click', closeModal);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doRename(); });
}

function showChangeColorDialog(pageEl, folderId) {
    const folder = categoryData.folders.find(f => f.id === folderId);
    if (!folder) return;
    let selectedColor = folder.color || FOLDER_COLORS[0].value;

    const modal = showModal(`
        <h3>更改颜色</h3>
        <div class="pc-form-group">
            <label class="pc-form-label">选择颜色</label>
            <div class="pc-color-picker" id="pcChangeColorPicker">
                ${FOLDER_COLORS.map(c => `
                    <div class="pc-color-picker-item ${c.value === selectedColor ? 'selected' : ''}" data-color="${c.value}" style="background:${c.value};"></div>
                `).join('')}
            </div>
        </div>
        <div class="pc-modal-actions">
            <button class="pc-btn pc-btn-secondary" id="pcChangeColorCancel">取消</button>
            <button class="pc-btn pc-btn-primary" id="pcChangeColorOk">确定</button>
        </div>
    `);

    modal.querySelector('#pcChangeColorPicker')?.addEventListener('click', (e) => {
        const dot = e.target.closest('.pc-color-picker-item');
        if (!dot) return;
        selectedColor = dot.dataset.color;
        modal.querySelectorAll('.pc-color-picker-item').forEach(d => d.classList.remove('selected'));
        dot.classList.add('selected');
    });

    modal.querySelector('#pcChangeColorOk').addEventListener('click', async () => {
        try {
            await getStorage().updateFolder(folderId, { color: selectedColor });
            showToast('颜色已更改');
            closeModal();
            await loadCategoryData(pageEl);
        } catch (e) { showToast('更改失败', 'error'); }
    });

    modal.querySelector('#pcChangeColorCancel').addEventListener('click', closeModal);
}

function showDeleteFolderConfirm(pageEl, folderId) {
    const folder = categoryData.folders.find(f => f.id === folderId);
    if (!folder) return;
    const count = categoryData.promptSets.filter(p => p.folderId === folderId).length;

    showConfirmModal(
        `确定要删除分类「${folder.name}」吗？${count > 0 ? `该分类下有 ${count} 个提示词，将变为未分类。` : ''}此操作不可撤销。`,
        async () => {
            try {
                await getStorage().deleteFolder(folderId);
                showToast('分类已删除');
                await loadCategoryData(pageEl);
            } catch (e) { showToast('删除失败', 'error'); }
        }
    );
}

function showCreateTagDialog(pageEl) {
    const modal = showModal(`
        <div class="pc-category-create-dialog pc-tag-create-dialog">
            <div class="pc-category-create-header">
                <h3>新建标签</h3>
                <p>先创建常用标签，编辑提示词时就能快速复用</p>
            </div>
            <div class="pc-category-create-body">
                <div class="pc-form-group pc-category-create-field">
                    <label class="pc-form-label" for="pcTagNameInput">标签名称</label>
                    <input type="text" class="pc-input pc-category-name-input" id="pcTagNameInput" placeholder="输入标签名称..." maxlength="30">
                </div>
            </div>
            <div class="pc-modal-actions pc-category-create-actions">
                <button class="pc-btn pc-btn-secondary" id="pcTagCancel">取消</button>
                <button class="pc-btn pc-btn-primary" id="pcTagOk" disabled>创建</button>
            </div>
        </div>
    `);

    const input = modal.querySelector('#pcTagNameInput');
    const okBtn = modal.querySelector('#pcTagOk');
    requestAnimationFrame(() => input.focus());

    const syncCreateState = () => {
        okBtn.disabled = input.value.trim().length === 0;
    };

    const doCreate = async () => {
        const tagName = input.value.trim();
        if (!tagName) {
            showToast('请输入标签名称', 'error');
            return;
        }
        const existingTags = parseTags(categoryData?.promptSets || []);
        if (existingTags.some(tag => tag.name === tagName)) {
            showToast('该标签已存在', 'warning');
            return;
        }
        if (!saveCustomTag(tagName)) {
            showToast('标签保存失败', 'error');
            return;
        }
        tagSearchKeyword = '';
        showToast(`标签「${tagName}」已创建`);
        closeModal();
        await loadCategoryData(pageEl);
    };

    input.addEventListener('input', syncCreateState);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && input.value.trim()) doCreate();
    });
    okBtn.addEventListener('click', doCreate);
    modal.querySelector('#pcTagCancel').addEventListener('click', closeModal);
}

function showRenameTagDialog(pageEl, tagName) {
    const modal = showModal(`
        <h3>重命名标签</h3>
        <div class="pc-form-group">
            <label class="pc-form-label">当前标签名</label>
            <div style="font:var(--pc-font-body);color:var(--pc-text2);padding:var(--pc-space-sm) 0;">${escapeHtml(tagName)}</div>
        </div>
        <div class="pc-form-group">
            <label class="pc-form-label">新标签名</label>
            <input type="text" class="pc-input" id="pcRenameTagInput" value="${escapeHtml(tagName)}" maxlength="30">
        </div>
        <div class="pc-modal-actions">
            <button class="pc-btn pc-btn-secondary" id="pcRenameTagCancel">取消</button>
            <button class="pc-btn pc-btn-primary" id="pcRenameTagOk">确定</button>
        </div>
    `);

    const input = modal.querySelector('#pcRenameTagInput');
    requestAnimationFrame(() => { input.focus(); input.select(); });

    const doRename = async () => {
        const newName = input.value.trim();
        if (!newName) { showToast('标签名不能为空', 'error'); return; }
        if (newName === tagName) { closeModal(); return; }
        const existingTags = parseTags(categoryData?.promptSets || []);
        if (existingTags.some(tag => tag.name === newName)) {
            showToast('该标签已存在', 'warning');
            return;
        }
        try {
            const count = await renameTag(tagName, newName);
            showToast(count > 0 ? `已将 ${count} 个提示词中的标签重命名` : '标签已重命名');
            closeModal();
            await loadCategoryData(pageEl);
        } catch (e) { showToast('重命名失败', 'error'); }
    };

    modal.querySelector('#pcRenameTagOk').addEventListener('click', doRename);
    modal.querySelector('#pcRenameTagCancel').addEventListener('click', closeModal);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doRename(); });
}

function showClearTagConfirm(pageEl, tagName, count) {
    showConfirmModal(
        `确定要清除标签「${tagName}」吗？将从 ${count} 个提示词中移除该标签，此操作不可撤销。`,
        async () => {
            try {
                const affected = await clearTagFromAll(tagName);
                showToast(`已从 ${affected} 个提示词中移除标签「${tagName}」`);
                await loadCategoryData(pageEl);
            } catch (e) { showToast('清除失败', 'error'); }
        }
    );
}

function showClearAllTagsConfirm(pageEl) {
    showConfirmModal(
        '确定要清除所有标签吗？将从所有提示词中移除全部标签，此操作不可撤销！',
        async () => {
            try {
                const affected = await clearAllTags();
                showToast(`已从 ${affected} 个提示词中清除所有标签`);
                await loadCategoryData(pageEl);
            } catch (e) { showToast('清除失败', 'error'); }
        }
    );
}

function showMergeFolderDialog(pageEl) {
    const { folders } = categoryData;
    if (folders.length < 2) {
        showToast('至少需要 2 个分类才能合并', 'warning');
        return;
    }

    const sortedFolders = [...folders].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    let sourceId = '';
    let targetId = '';

    const modal = showModal(`
        <h3>合并分类</h3>
        <div class="pc-form-group">
            <label class="pc-form-label">源分类（将被清空）</label>
            <select class="pc-input" id="pcMergeSource">
                <option value="">选择源分类...</option>
                ${sortedFolders.map(f => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('')}
            </select>
        </div>
        <div class="pc-form-group">
            <label class="pc-form-label">目标分类（提示词将移入）</label>
            <select class="pc-input" id="pcMergeTarget">
                <option value="">选择目标分类...</option>
                ${sortedFolders.map(f => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('')}
            </select>
        </div>
        <div class="pc-modal-actions">
            <button class="pc-btn pc-btn-secondary" id="pcMergeCancel">取消</button>
            <button class="pc-btn pc-btn-primary" id="pcMergeOk">合并</button>
        </div>
    `);

    modal.querySelector('#pcMergeSource').addEventListener('change', (e) => { sourceId = e.target.value; });
    modal.querySelector('#pcMergeTarget').addEventListener('change', (e) => { targetId = e.target.value; });

    const doMerge = async () => {
        if (!sourceId || !targetId) { showToast('请选择源分类和目标分类', 'error'); return; }
        if (sourceId === targetId) { showToast('源分类和目标分类不能相同', 'error'); return; }

        const sourceFolder = categoryData.folders.find(f => f.id === sourceId);
        const targetFolder = categoryData.folders.find(f => f.id === targetId);
        const affected = categoryData.promptSets.filter(p => p.folderId === sourceId);

        showConfirmModal(
            `将「${sourceFolder.name}」中的 ${affected.length} 个提示词移入「${targetFolder.name}」，源分类将被删除。确定？`,
            async () => {
                try {
                    const storage = getStorage();
                    for (const ps of affected) {
                        await storage.updatePromptSet(ps.id, { folderId: targetId });
                    }
                    await storage.deleteFolder(sourceId);
                    showToast(`已合并 ${affected.length} 个提示词到「${targetFolder.name}」`);
                    closeModal();
                    await loadCategoryData(pageEl);
                } catch (e) { showToast('合并失败', 'error'); }
            }
        );
    };

    modal.querySelector('#pcMergeOk').addEventListener('click', doMerge);
    modal.querySelector('#pcMergeCancel').addEventListener('click', closeModal);
}

function showCleanupEmptyFoldersConfirm(pageEl) {
    const emptyFolders = categoryData.folders.filter(f =>
        categoryData.promptSets.filter(p => p.folderId === f.id).length === 0
    );

    if (emptyFolders.length === 0) {
        showToast('没有空分类需要清理', 'warning');
        return;
    }

    showConfirmModal(
        `发现 ${emptyFolders.length} 个空分类：${emptyFolders.map(f => f.name).join('、')}。确定删除？`,
        async () => {
            try {
                const storage = getStorage();
                for (const f of emptyFolders) {
                    await storage.deleteFolder(f.id);
                }
                showToast(`已清理 ${emptyFolders.length} 个空分类`);
                await loadCategoryData(pageEl);
            } catch (e) { showToast('清理失败', 'error'); }
        }
    );
}

async function clearTagFromAll(tagName) {
    const storage = getStorage();
    const promptSets = await storage.getPromptSets();
    const updates = [];

    for (const set of promptSets) {
        let tags = [];
        try { tags = JSON.parse(set.tags || '[]'); } catch (e) { tags = []; }
        if (!Array.isArray(tags)) tags = [];
        const newTags = tags.filter(t => t !== tagName);
        if (newTags.length !== tags.length) {
            updates.push(storage.updatePromptSet(set.id, { tags: JSON.stringify(newTags) }));
        }
    }

    await Promise.all(updates);
    removeCustomTag(tagName);
    return updates.length;
}

async function clearAllTags() {
    const storage = getStorage();
    const promptSets = await storage.getPromptSets();
    const updates = [];

    for (const set of promptSets) {
        let tags = [];
        try { tags = JSON.parse(set.tags || '[]'); } catch (e) { tags = []; }
        if (!Array.isArray(tags)) tags = [];
        if (tags.length > 0) {
            updates.push(storage.updatePromptSet(set.id, { tags: '[]' }));
        }
    }

    await Promise.all(updates);
    getCustomTags().forEach(name => removeCustomTag(name));
    return updates.length;
}

async function renameTag(oldName, newName) {
    const storage = getStorage();
    const promptSets = await storage.getPromptSets();
    const updates = [];

    for (const set of promptSets) {
        let tags = [];
        try { tags = JSON.parse(set.tags || '[]'); } catch (e) { tags = []; }
        if (!Array.isArray(tags)) tags = [];
        const newTags = tags.map(t => t === oldName ? newName : t);
        if (JSON.stringify(newTags) !== JSON.stringify(tags)) {
            updates.push(storage.updatePromptSet(set.id, { tags: JSON.stringify(newTags) }));
        }
    }

    await Promise.all(updates);
    if (getCustomTags().includes(oldName)) {
        removeCustomTag(oldName);
        saveCustomTag(newName);
    }
    return updates.length;
}

function unmount(pageEl) {
    categoryData = null;
    activeSegment = 'categories';
    categorySearchKeyword = '';
    tagSearchKeyword = '';
    dragState = null;
}

export { render, mount, unmount };
