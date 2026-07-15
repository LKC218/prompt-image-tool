import { getStorage } from './storage.js';
import { showMobileToast, showActionSheet, goBack, iconImg } from './mobile-utils.js';
import { aggregateTags, getTagStyleClass, saveCustomTag, removeCustomTag } from './tag-utils.js';
import { mobileIcon } from './mobile-icon-assets.js';
import rabbitTip from '../assets/mobile/mascots/rabbit-tip.png';
import folderIcon from '../assets/mobile/folder.png';
import arrowUpDownIcon from '../assets/icons/arrow-up-down.svg';
import pencilLineIcon from '../assets/icons/pencil-line.svg';
import mergeIcon from '../assets/icons/merge.svg';
import trashIcon from '../assets/icons/trash-2.svg';
import emptyTagIcon from '../assets/mobile/tag.png';

let currentSegment = 'category';
let categoryData = null;

const CATEGORY_COLORS = [
    { bg: '#E8F4FF', text: '#2580D6' },
    { bg: '#FFE8A3', text: '#C4A030' },
    { bg: '#EFE5FF', text: '#8B6FCC' },
    { bg: '#FFF0F5', text: '#D4567F' },
    { bg: '#CFF7D7', text: '#3D9942' },
    { bg: '#FFE0CC', text: '#E07020' },
];

const FOLDER_COLORS = [
    { name: '蓝', value: '#2580D6', bg: '#E8F4FF' },
    { name: '黄', value: '#C4A030', bg: '#FFE8A3' },
    { name: '紫', value: '#8B6FCC', bg: '#EFE5FF' },
    { name: '粉', value: '#D4567F', bg: '#FFF0F5' },
    { name: '绿', value: '#3D9942', bg: '#CFF7D7' },
    { name: '橙', value: '#E07020', bg: '#FFE0CC' },
    { name: '红', value: '#D64545', bg: '#FFE8E8' },
    { name: '青', value: '#2BA5A5', bg: '#E0F5F5' },
    { name: '灰', value: '#888888', bg: '#F0F0F0' },
];

function getFolderColor(folder, idx) {
    if (folder.color) {
        const match = FOLDER_COLORS.find(c => c.value === folder.color);
        if (match) return match;
        return { bg: folder.color + '22', text: folder.color };
    }
    return CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
}

function render(params = {}) {
    return `
        <div class="m-top-nav">
            <button class="m-top-nav-back" id="mCategoryBack" aria-label="返回">${mobileIcon('chevron-left')}</button>
            <span class="m-top-nav-title">分类与标签</span>
        </div>
        <div class="m-page-inner m-category-page">
            <div class="m-segment-control" id="mSegmentControl">
                <button class="m-segment-btn m-segment-active" data-segment="category">分类管理</button>
                <button class="m-segment-btn" data-segment="tag">标签管理</button>
            </div>

            <div id="mCategoryView">
                <div class="m-section-title" style="margin-bottom: var(--m-space-md);">
                    <span class="m-section-title-text">分类管理</span>
                    <button class="m-save-btn" id="mCreateFolderBtn" style="font-size:13px; padding:6px 14px;">${mobileIcon('plus', { className: 'm-icon-sm' })} 新建分类</button>
                </div>
                <div class="m-list-gap" id="mCategoryList"></div>

                <div class="m-section-gap" style="margin-top: var(--m-space-xl);">
                    <div class="m-section-title" style="margin-bottom: var(--m-space-md);">
                        <span class="m-section-title-text">快速操作</span>
                    </div>
                    <div class="m-quick-actions">
                        <button class="m-quick-action-btn m-action-green" id="mSortBtn">
                            <span class="m-quick-action-icon">${iconImg(arrowUpDownIcon)}</span>
                            <span>排序</span>
                        </button>
                        <button class="m-quick-action-btn m-action-blue" id="mBatchEditBtn">
                            <span class="m-quick-action-icon">${iconImg(pencilLineIcon)}</span>
                            <span>批量编辑</span>
                        </button>
                        <button class="m-quick-action-btn m-action-purple" id="mMergeBtn">
                            <span class="m-quick-action-icon">${iconImg(mergeIcon)}</span>
                            <span>合并分类</span>
                        </button>
                        <button class="m-quick-action-btn m-action-pink" id="mDeleteBtn">
                            <span class="m-quick-action-icon">${iconImg(trashIcon)}</span>
                            <span>删除</span>
                        </button>
                    </div>
                </div>

                <div style="margin-top: var(--m-space-xl);">
                    <div class="m-tip-banner">
                        <img class="m-tip-banner-icon" src="${rabbitTip}" alt="兔子助手">
                        <span>长按并拖拽可调整顺序哦~</span>
                    </div>
                </div>
            </div>

            <div id="mTagView" style="display:none;">
                <div class="m-section-title" style="margin-bottom: var(--m-space-md);">
                    <span class="m-section-title-text">标签管理</span>
                    <div style="display:flex; gap:var(--m-space-sm);">
                        <button class="m-save-btn" id="mCreateTagBtn" style="font-size:13px; padding:6px 14px;">${mobileIcon('plus', { className: 'm-icon-sm' })} 新建标签</button>
                        <button class="m-text-btn m-text-btn-danger" id="mClearAllTagsBtn">清除全部</button>
                    </div>
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:var(--m-space-sm);" id="mTagList"></div>
                <div id="mTagEmpty" style="display:none;">
                    <div class="m-empty-state" style="padding: var(--m-space-lg);">
                        <span class="m-empty-icon"><img src="${emptyTagIcon}" alt="空状态" class="m-empty-icon-img"></span>
                        <span class="m-empty-text">还没有标签，在编辑提示词时添加标签后会自动显示</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="m-folder-dialog-overlay" id="mFolderDialogOverlay">
            <div class="m-folder-dialog" id="mFolderDialog"></div>
        </div>

        <div class="m-confirm-overlay" id="mCategoryConfirmOverlay">
            <div class="m-confirm-dialog" id="mCategoryConfirmDialog"></div>
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
        renderCategoryList(pageEl);
        renderTagList(pageEl);
    } catch (e) {
        console.error('loadCategoryData error:', e);
    }
}

function renderCategoryList(pageEl) {
    const container = pageEl.querySelector('#mCategoryList');
    if (!container || !categoryData) return;

    if (categoryData.folders.length === 0) {
        container.innerHTML = `
            <div class="m-empty-state">
                <span class="m-empty-icon"><img src="${folderIcon}" alt="文件夹" class="m-empty-icon-img m-empty-folder-img"></span>
                <span class="m-empty-text">还没有分类，点击上方新建吧~</span>
            </div>
        `;
        return;
    }

    container.innerHTML = categoryData.folders.map((folder, idx) => {
        const color = getFolderColor(folder, idx);
        const count = categoryData.promptSets.filter(p => p.folderId === folder.id).length;
        return `
            <div class="m-category-list-item m-fade-in" data-folder-id="${folder.id}" style="animation-delay: ${idx * 30}ms">
                <div class="m-category-icon" style="background: ${color.bg};">${iconImg(folderIcon)}</div>
                <div class="m-category-item-info">
                    <span class="m-category-item-name">${escapeHtml(folder.name)}</span>
                    <span class="m-category-item-count">${count} 个提示词</span>
                </div>
                <div class="m-category-item-actions">
                    <button class="m-more-btn" data-folder-id="${folder.id}" aria-label="更多操作">${mobileIcon('more')}</button>
                    <span class="m-drag-handle" aria-hidden="true">${mobileIcon('grip')}</span>
                </div>
            </div>
        `;
    }).join('');
}

function renderTagList(pageEl) {
    const tagListEl = pageEl.querySelector('#mTagList');
    const tagEmptyEl = pageEl.querySelector('#mTagEmpty');
    if (!tagListEl) return;

    const tags = aggregateTags(categoryData?.promptSets || []);

    if (tags.length === 0) {
        tagListEl.innerHTML = '';
        tagListEl.style.display = 'none';
        if (tagEmptyEl) tagEmptyEl.style.display = '';
        return;
    }

    tagListEl.style.display = '';
    if (tagEmptyEl) tagEmptyEl.style.display = 'none';

    tagListEl.innerHTML = tags.map(tag => `
        <div class="m-tag-pill ${tag.style} m-tag-manageable" data-tag-name="${escapeHtml(tag.name)}">
            ${escapeHtml(tag.name)} <span class="m-tag-manageable-count">${tag.count}</span>
        </div>
    `).join('');
}

function setupCategoryEvents(pageEl) {
    pageEl.querySelector('#mCategoryBack')?.addEventListener('click', () => {
        goBack();
    });

    pageEl.querySelector('#mSegmentControl')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.m-segment-btn');
        if (!btn) return;
        const segment = btn.dataset.segment;
        currentSegment = segment;
        pageEl.querySelectorAll('.m-segment-btn').forEach(b => b.classList.remove('m-segment-active'));
        btn.classList.add('m-segment-active');

        const categoryView = pageEl.querySelector('#mCategoryView');
        const tagView = pageEl.querySelector('#mTagView');
        if (segment === 'category') {
            if (categoryView) categoryView.style.display = '';
            if (tagView) tagView.style.display = 'none';
        } else {
            if (categoryView) categoryView.style.display = 'none';
            if (tagView) tagView.style.display = '';
        }
    });

    pageEl.querySelector('#mCreateFolderBtn')?.addEventListener('click', () => {
        showCreateFolderDialog(pageEl);
    });

    pageEl.querySelector('#mCategoryList')?.addEventListener('click', (e) => {
        const moreBtn = e.target.closest('.m-more-btn');
        if (moreBtn) {
            const folderId = moreBtn.dataset.folderId;
            showActionSheet([
                { action: 'rename', icon: iconImg(pencilLineIcon), label: '重命名', handler: () => showRenameDialog(pageEl, folderId) },
                { action: 'color', icon: iconImg(folderIcon), label: '更改颜色', handler: () => showChangeColorDialog(pageEl, folderId) },
                { action: 'delete', icon: iconImg(trashIcon), label: '删除分类', danger: true, handler: () => handleDeleteFolder(pageEl, folderId) },
            ]);
        }
    });

    pageEl.querySelector('#mTagList')?.addEventListener('click', (e) => {
        const tagEl = e.target.closest('.m-tag-manageable');
        if (!tagEl) return;
        const tagName = tagEl.dataset.tagName;
        if (tagName) showTagActionMenu(pageEl, tagName);
    });

    pageEl.querySelector('#mClearAllTagsBtn')?.addEventListener('click', () => {
        showClearAllTagsConfirm(pageEl);
    });

    pageEl.querySelector('#mCreateTagBtn')?.addEventListener('click', () => {
        showCreateTagDialog(pageEl);
    });

    pageEl.querySelector('#mSortBtn')?.addEventListener('click', () => {
        const handles = pageEl.querySelectorAll('.m-drag-handle');
        if (handles.length === 0) {
            showMobileToast('暂无分类可排序');
            return;
        }
        handles.forEach(h => {
            h.classList.add('m-drag-handle-highlight');
            setTimeout(() => h.classList.remove('m-drag-handle-highlight'), 2500);
        });
        showMobileToast('拖拽分类右侧手柄即可调整顺序');
    });

    pageEl.querySelector('#mBatchEditBtn')?.addEventListener('click', () => {
        const folders = categoryData?.folders || [];
        if (folders.length === 0) {
            showMobileToast('暂无分类可编辑');
            return;
        }
        showBatchEditDialog(pageEl);
    });

    pageEl.querySelector('#mMergeBtn')?.addEventListener('click', () => {
        const folders = categoryData?.folders || [];
        if (folders.length < 2) {
            showMobileToast('至少需要 2 个分类才能合并');
            return;
        }
        showMergeFolderDialog(pageEl);
    });

    pageEl.querySelector('#mDeleteBtn')?.addEventListener('click', () => {
        showCleanupEmptyFoldersConfirm(pageEl);
    });
}

function showCreateFolderDialog(pageEl) {
    const overlay = pageEl.querySelector('#mFolderDialogOverlay');
    const dialog = pageEl.querySelector('#mFolderDialog');
    if (!overlay || !dialog) return;

    let selectedColorIdx = 0;

    function renderDialog() {
        dialog.innerHTML = `
            <div class="m-folder-dialog-title">新建分类</div>
            <div class="m-folder-dialog-label">分类名称</div>
            <input type="text" class="m-folder-dialog-input" id="mFolderNameInput" placeholder="输入分类名称..." maxlength="20">
            <div class="m-folder-dialog-label">选择颜色</div>
            <div class="m-folder-dialog-colors">
                ${FOLDER_COLORS.map((c, i) => `
                    <button class="m-folder-color-dot ${i === selectedColorIdx ? 'm-folder-color-selected' : ''}" data-color-idx="${i}" style="background: ${c.value};" title="${c.name}"></button>
                `).join('')}
            </div>
            <div class="m-folder-dialog-actions">
                <button class="m-folder-dialog-btn m-folder-dialog-cancel" id="mFolderDialogCancel">取消</button>
                <button class="m-folder-dialog-btn m-folder-dialog-ok" id="mFolderDialogOk">创建</button>
            </div>
        `;

        const nameInput = dialog.querySelector('#mFolderNameInput');
        const okBtn = dialog.querySelector('#mFolderDialogOk');

        function updateOkBtn() {
            if (nameInput.value.trim()) {
                okBtn.classList.remove('m-folder-dialog-ok-disabled');
            } else {
                okBtn.classList.add('m-folder-dialog-ok-disabled');
            }
        }

        nameInput.addEventListener('input', updateOkBtn);
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && nameInput.value.trim()) {
                doCreate();
            }
        });

        dialog.querySelectorAll('.m-folder-color-dot').forEach(dot => {
            dot.addEventListener('click', () => {
                selectedColorIdx = parseInt(dot.dataset.colorIdx);
                dialog.querySelectorAll('.m-folder-color-dot').forEach(d => d.classList.remove('m-folder-color-selected'));
                dot.classList.add('m-folder-color-selected');
            });
        });

        dialog.querySelector('#mFolderDialogCancel')?.addEventListener('click', () => {
            closeFolderDialog(overlay);
        });

        okBtn.addEventListener('click', () => {
            if (!nameInput.value.trim()) return;
            doCreate();
        });

        updateOkBtn();

        setTimeout(() => nameInput.focus(), 100);
    }

    async function doCreate() {
        const nameInput = dialog.querySelector('#mFolderNameInput');
        const name = nameInput.value.trim();
        const color = FOLDER_COLORS[selectedColorIdx].value;
        try {
            await getStorage().createFolder(name, color);
            closeFolderDialog(overlay);
            await loadCategoryData(pageEl);
            showMobileToast('分类已创建');
        } catch (e) {
            showMobileToast('创建失败', 'error');
        }
    }

    renderDialog();
    overlay.classList.add('m-folder-dialog-show');
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeFolderDialog(overlay);
    }, { once: true });
}

function showChangeColorDialog(pageEl, folderId) {
    const folder = categoryData?.folders.find(f => f.id === folderId);
    if (!folder) return;

    const overlay = pageEl.querySelector('#mFolderDialogOverlay');
    const dialog = pageEl.querySelector('#mFolderDialog');
    if (!overlay || !dialog) return;

    let selectedColorIdx = FOLDER_COLORS.findIndex(c => c.value === folder.color);
    if (selectedColorIdx < 0) selectedColorIdx = 0;

    function renderDialog() {
        dialog.innerHTML = `
            <div class="m-folder-dialog-title">更改颜色</div>
            <div class="m-folder-dialog-label">「${escapeHtml(folder.name)}」的颜色</div>
            <div class="m-folder-dialog-colors">
                ${FOLDER_COLORS.map((c, i) => `
                    <button class="m-folder-color-dot ${i === selectedColorIdx ? 'm-folder-color-selected' : ''}" data-color-idx="${i}" style="background: ${c.value};" title="${c.name}"></button>
                `).join('')}
            </div>
            <div class="m-folder-dialog-actions">
                <button class="m-folder-dialog-btn m-folder-dialog-cancel" id="mFolderDialogCancel">取消</button>
                <button class="m-folder-dialog-btn m-folder-dialog-ok" id="mFolderDialogOk">确定</button>
            </div>
        `;

        dialog.querySelectorAll('.m-folder-color-dot').forEach(dot => {
            dot.addEventListener('click', () => {
                selectedColorIdx = parseInt(dot.dataset.colorIdx);
                dialog.querySelectorAll('.m-folder-color-dot').forEach(d => d.classList.remove('m-folder-color-selected'));
                dot.classList.add('m-folder-color-selected');
            });
        });

        dialog.querySelector('#mFolderDialogCancel')?.addEventListener('click', () => {
            closeFolderDialog(overlay);
        });

        dialog.querySelector('#mFolderDialogOk')?.addEventListener('click', async () => {
            const color = FOLDER_COLORS[selectedColorIdx].value;
            try {
                await getStorage().updateFolder(folderId, { color });
                closeFolderDialog(overlay);
                await loadCategoryData(pageEl);
                showMobileToast('颜色已更新');
            } catch (e) {
                showMobileToast('更新失败', 'error');
            }
        });
    }

    renderDialog();
    overlay.classList.add('m-folder-dialog-show');
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeFolderDialog(overlay);
    }, { once: true });
}

function closeFolderDialog(overlay) {
    overlay.classList.remove('m-folder-dialog-show');
}

async function showRenameDialog(pageEl, folderId) {
    const folder = categoryData?.folders.find(f => f.id === folderId);
    if (!folder) return;
    const name = prompt('请输入新名称：', folder.name);
    if (!name || !name.trim()) return;
    try {
        await getStorage().updateFolder(folderId, { name: name.trim() });
        await loadCategoryData(pageEl);
        showMobileToast('已重命名');
    } catch (e) {
        showMobileToast('重命名失败', 'error');
    }
}

async function handleDeleteFolder(pageEl, folderId) {
    const folder = categoryData?.folders.find(f => f.id === folderId);
    if (!folder) return;
    showCategoryConfirm(pageEl, `确定删除分类「${folder.name}」？\n分类下的提示词将变为未分类`, async () => {
        try {
            await getStorage().deleteFolder(folderId);
            await loadCategoryData(pageEl);
            showMobileToast('分类已删除');
        } catch (e) {
            showMobileToast('删除失败', 'error');
        }
    });
}

function showTagActionMenu(pageEl, tagName) {
    const tags = aggregateTags(categoryData?.promptSets || []);
    const tagInfo = tags.find(t => t.name === tagName);
    const count = tagInfo ? tagInfo.count : 0;
    showActionSheet([
        { action: 'info', icon: iconImg(folderIcon), label: `标签：${tagName}（${count} 个提示词）`, handler: () => {} },
        { action: 'rename', icon: iconImg(pencilLineIcon), label: '重命名', handler: () => showRenameTagDialog(pageEl, tagName, count) },
        { action: 'clear', icon: iconImg(trashIcon), label: '清除该标签', danger: true, handler: () => showClearTagConfirm(pageEl, tagName, count) },
    ]);
}

function showRenameTagDialog(pageEl, tagName, count) {
    const newName = prompt(`重命名标签「${tagName}」：`, tagName);
    if (!newName || !newName.trim() || newName.trim() === tagName) return;
    showCategoryConfirm(pageEl, `确定将标签「${tagName}」重命名为「${newName.trim()}」？\n将影响 ${count} 个提示词，此操作不可撤销。`, async () => {
        try {
            const affected = await renameTag(tagName, newName.trim());
            await loadCategoryData(pageEl);
            showMobileToast(`已重命名，影响 ${affected} 个提示词`);
        } catch (e) {
            showMobileToast('重命名失败', 'error');
        }
    });
}

async function renameTag(oldName, newName) {
    const storage = getStorage();
    const promptSets = await storage.getPromptSets();
    const updates = [];

    for (const set of promptSets) {
        let tags = [];
        try {
            tags = JSON.parse(set.tags || '[]');
        } catch (e) {
            tags = [];
        }
        if (!Array.isArray(tags)) tags = [];

        const newTags = tags.map(t => t === oldName ? newName : t);
        if (JSON.stringify(newTags) !== JSON.stringify(tags)) {
            updates.push(storage.updatePromptSet(set.id, { tags: JSON.stringify(newTags) }));
        }
    }

    await Promise.all(updates);
    return updates.length;
}

function showClearTagConfirm(pageEl, tagName, count) {
    showCategoryConfirm(pageEl, `确定清除标签「${tagName}」？\n将从 ${count} 个提示词中移除该标签，此操作不可撤销。`, async () => {
        try {
            const affected = await clearTagFromAll(tagName);
            await loadCategoryData(pageEl);
            showMobileToast(`已从 ${affected} 个提示词中移除标签`);
        } catch (e) {
            showMobileToast('清除失败', 'error');
        }
    });
}

function showCreateTagDialog(pageEl) {
    const overlay = pageEl.querySelector('#mFolderDialogOverlay');
    const dialog = pageEl.querySelector('#mFolderDialog');
    if (!overlay || !dialog) return;

    dialog.innerHTML = `
        <div class="m-folder-dialog-title">新建标签</div>
        <div class="m-folder-dialog-label">标签名称</div>
        <input type="text" class="m-folder-dialog-input" id="mTagNameInput" placeholder="输入标签名称..." maxlength="10">
        <div class="m-folder-dialog-actions">
            <button class="m-folder-dialog-btn m-folder-dialog-cancel" id="mTagDialogCancel">取消</button>
            <button class="m-folder-dialog-btn m-folder-dialog-ok m-folder-dialog-ok-disabled" id="mTagDialogOk">创建</button>
        </div>
    `;

    const nameInput = dialog.querySelector('#mTagNameInput');
    const okBtn = dialog.querySelector('#mTagDialogOk');

    function updateOkBtn() {
        if (nameInput.value.trim()) {
            okBtn.classList.remove('m-folder-dialog-ok-disabled');
        } else {
            okBtn.classList.add('m-folder-dialog-ok-disabled');
        }
    }

    nameInput.addEventListener('input', updateOkBtn);
    nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && nameInput.value.trim()) {
            doCreateTag();
        }
    });

    dialog.querySelector('#mTagDialogCancel')?.addEventListener('click', () => {
        overlay.classList.remove('m-folder-dialog-show');
    });

    okBtn.addEventListener('click', () => {
        if (!nameInput.value.trim()) return;
        doCreateTag();
    });

    async function doCreateTag() {
        const tagName = nameInput.value.trim();
        const existingTags = aggregateTags(categoryData?.promptSets || []);
        if (existingTags.find(t => t.name === tagName)) {
            showMobileToast('该标签已存在');
            return;
        }
        saveCustomTag(tagName);
        overlay.classList.remove('m-folder-dialog-show');
        await loadCategoryData(pageEl);
        showMobileToast(`标签「${tagName}」已创建`);
    }

    overlay.classList.add('m-folder-dialog-show');
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('m-folder-dialog-show');
    }, { once: true });
    setTimeout(() => nameInput.focus(), 100);
}

function showClearAllTagsConfirm(pageEl) {
    const tags = aggregateTags(categoryData?.promptSets || []);
    if (tags.length === 0) {
        showMobileToast('没有标签可清除');
        return;
    }
    showCategoryConfirm(pageEl, `确定清除所有标签？\n将从所有提示词中移除全部 ${tags.length} 个标签，此操作不可撤销！`, async () => {
        try {
            let totalAffected = 0;
            for (const tag of tags) {
                totalAffected += await clearTagFromAll(tag.name);
            }
            await loadCategoryData(pageEl);
            showMobileToast(`已清除所有标签，共影响 ${totalAffected} 处`);
        } catch (e) {
            showMobileToast('清除失败', 'error');
        }
    });
}

async function clearTagFromAll(tagName) {
    const storage = getStorage();
    const promptSets = await storage.getPromptSets();
    const updates = [];

    for (const set of promptSets) {
        let tags = [];
        try {
            tags = JSON.parse(set.tags || '[]');
        } catch (e) {
            tags = [];
        }
        if (!Array.isArray(tags)) tags = [];

        const newTags = tags.filter(t => t !== tagName);
        if (newTags.length !== tags.length) {
            updates.push(storage.updatePromptSet(set.id, { tags: JSON.stringify(newTags) }));
        }
    }

    await Promise.all(updates);
    return updates.length;
}

function showCategoryConfirm(pageEl, text, onOk) {
    const overlay = pageEl.querySelector('#mCategoryConfirmOverlay');
    const dialogEl = pageEl.querySelector('#mCategoryConfirmDialog');
    if (!overlay || !dialogEl) return;

    dialogEl.innerHTML = `
        <div class="m-confirm-text">${escapeHtml(text).replace(/\n/g, '<br>')}</div>
        <div class="m-confirm-actions">
            <button class="m-confirm-btn m-confirm-cancel" id="mCatConfirmCancel">取消</button>
            <button class="m-confirm-btn m-confirm-ok" id="mCatConfirmOk">确定</button>
        </div>
    `;

    overlay.classList.add('m-confirm-show');

    dialogEl.querySelector('#mCatConfirmCancel')?.addEventListener('click', () => {
        overlay.classList.remove('m-confirm-show');
    }, { once: true });

    dialogEl.querySelector('#mCatConfirmOk')?.addEventListener('click', async () => {
        overlay.classList.remove('m-confirm-show');
        await onOk();
    }, { once: true });
}

function showBatchEditDialog(pageEl) {
    const overlay = pageEl.querySelector('#mFolderDialogOverlay');
    const dialog = pageEl.querySelector('#mFolderDialog');
    if (!overlay || !dialog) return;

    const folders = [...(categoryData?.folders || [])].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const selectedIds = new Set();
    let step = 'select';
    let selectedColor = FOLDER_COLORS[0].value;

    function renderSelectStep() {
        dialog.innerHTML = `
            <div class="m-folder-dialog-title">批量编辑</div>
            <div class="m-folder-dialog-label">选择要编辑的分类（可多选）</div>
            <div class="m-batch-select-list">
                ${folders.map(f => `
                    <button class="m-batch-select-item" data-folder-id="${f.id}">
                        <span class="m-batch-check ${selectedIds.has(f.id) ? 'm-batch-checked' : ''}" data-folder-id="${f.id}"></span>
                        <span class="m-batch-item-name">${escapeHtml(f.name)}</span>
                    </button>
                `).join('')}
            </div>
            <div class="m-folder-dialog-actions">
                <button class="m-folder-dialog-btn m-folder-dialog-cancel" id="mBatchSelectCancel">取消</button>
                <button class="m-folder-dialog-btn m-folder-dialog-ok ${selectedIds.size === 0 ? 'm-folder-dialog-ok-disabled' : ''}" id="mBatchSelectNext">下一步</button>
            </div>
        `;

        dialog.querySelectorAll('.m-batch-select-item').forEach(item => {
            item.addEventListener('click', () => {
                const fid = item.dataset.folderId;
                if (selectedIds.has(fid)) {
                    selectedIds.delete(fid);
                } else {
                    selectedIds.add(fid);
                }
                item.querySelector('.m-batch-check').classList.toggle('m-batch-checked', selectedIds.has(fid));
                const nextBtn = dialog.querySelector('#mBatchSelectNext');
                if (nextBtn) nextBtn.classList.toggle('m-folder-dialog-ok-disabled', selectedIds.size === 0);
            });
        });

        dialog.querySelector('#mBatchSelectCancel')?.addEventListener('click', () => closeFolderDialog(overlay));
        dialog.querySelector('#mBatchSelectNext')?.addEventListener('click', () => {
            if (selectedIds.size === 0) return;
            step = 'color';
            renderColorStep();
        });
    }

    function renderColorStep() {
        const selectedNames = folders.filter(f => selectedIds.has(f.id)).map(f => f.name);
        dialog.innerHTML = `
            <div class="m-folder-dialog-title">选择新颜色</div>
            <div class="m-folder-dialog-label">已选 ${selectedIds.size} 个分类：${escapeHtml(selectedNames.join('、'))}</div>
            <div class="m-folder-dialog-colors">
                ${FOLDER_COLORS.map((c, i) => `
                    <button class="m-folder-color-dot ${i === 0 ? 'm-folder-color-selected' : ''}" data-color-idx="${i}" style="background: ${c.value};" title="${c.name}"></button>
                `).join('')}
            </div>
            <div class="m-folder-dialog-actions">
                <button class="m-folder-dialog-btn m-folder-dialog-cancel" id="mBatchColorBack">返回</button>
                <button class="m-folder-dialog-btn m-folder-dialog-ok" id="mBatchColorApply">应用</button>
            </div>
        `;

        dialog.querySelectorAll('.m-folder-color-dot').forEach(dot => {
            dot.addEventListener('click', () => {
                selectedColor = FOLDER_COLORS[parseInt(dot.dataset.colorIdx)].value;
                dialog.querySelectorAll('.m-folder-color-dot').forEach(d => d.classList.remove('m-folder-color-selected'));
                dot.classList.add('m-folder-color-selected');
            });
        });

        dialog.querySelector('#mBatchColorBack')?.addEventListener('click', () => {
            step = 'select';
            selectedIds.clear();
            renderSelectStep();
        });

        dialog.querySelector('#mBatchColorApply')?.addEventListener('click', async () => {
            try {
                const storage = getStorage();
                for (const fid of selectedIds) {
                    await storage.updateFolder(fid, { color: selectedColor });
                }
                closeFolderDialog(overlay);
                await loadCategoryData(pageEl);
                showMobileToast(`已更新 ${selectedIds.size} 个分类的颜色`);
            } catch (e) {
                showMobileToast('批量编辑失败', 'error');
            }
        });
    }

    renderSelectStep();
    overlay.classList.add('m-folder-dialog-show');
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeFolderDialog(overlay);
    }, { once: true });
}

function showMergeFolderDialog(pageEl) {
    const overlay = pageEl.querySelector('#mFolderDialogOverlay');
    const dialog = pageEl.querySelector('#mFolderDialog');
    if (!overlay || !dialog) return;

    const folders = [...(categoryData?.folders || [])].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    let sourceId = '';
    let targetId = '';

    function renderMerge() {
        dialog.innerHTML = `
            <div class="m-folder-dialog-title">合并分类</div>
            <div class="m-folder-dialog-label">源分类（提示词将被移出）</div>
            <div class="m-merge-select-list" id="mMergeSourceList">
                ${folders.map(f => `
                    <button class="m-merge-select-item ${sourceId === f.id ? 'm-merge-selected' : ''}" data-source-id="${f.id}">
                        <span class="m-merge-item-name">${escapeHtml(f.name)}</span>
                        <span class="m-merge-item-hint">${categoryData.promptSets.filter(p => p.folderId === f.id).length} 个提示词</span>
                    </button>
                `).join('')}
            </div>
            <div class="m-folder-dialog-label" style="margin-top: var(--m-space-md);">目标分类（提示词将移入）</div>
            <div class="m-merge-select-list" id="mMergeTargetList">
                ${folders.map(f => `
                    <button class="m-merge-select-item ${targetId === f.id ? 'm-merge-selected' : ''} ${sourceId === f.id ? 'm-merge-disabled' : ''}" data-target-id="${f.id}">
                        <span class="m-merge-item-name">${escapeHtml(f.name)}</span>
                        <span class="m-merge-item-hint">${categoryData.promptSets.filter(p => p.folderId === f.id).length} 个提示词</span>
                    </button>
                `).join('')}
            </div>
            <div class="m-folder-dialog-actions">
                <button class="m-folder-dialog-btn m-folder-dialog-cancel" id="mMergeCancel">取消</button>
                <button class="m-folder-dialog-btn m-folder-dialog-ok ${(!sourceId || !targetId) ? 'm-folder-dialog-ok-disabled' : ''}" id="mMergeOk">合并</button>
            </div>
        `;

        const sourceList = dialog.querySelector('#mMergeSourceList');
        const targetList = dialog.querySelector('#mMergeTargetList');

        sourceList?.addEventListener('click', (e) => {
            const item = e.target.closest('.m-merge-select-item');
            if (!item) return;
            sourceId = item.dataset.sourceId;
            renderMerge();
        });

        targetList?.addEventListener('click', (e) => {
            const item = e.target.closest('.m-merge-select-item');
            if (!item || item.classList.contains('m-merge-disabled')) return;
            targetId = item.dataset.targetId;
            renderMerge();
        });

        dialog.querySelector('#mMergeCancel')?.addEventListener('click', () => closeFolderDialog(overlay));
        dialog.querySelector('#mMergeOk')?.addEventListener('click', () => {
            if (!sourceId || !targetId) return;
            const sourceFolder = folders.find(f => f.id === sourceId);
            const targetFolder = folders.find(f => f.id === targetId);
            const affected = categoryData.promptSets.filter(p => p.folderId === sourceId);
            closeFolderDialog(overlay);
            showCategoryConfirm(pageEl,
                `将「${sourceFolder.name}」中的 ${affected.length} 个提示词移入「${targetFolder.name}」，\n源分类将被删除。确定？`,
                async () => {
                    try {
                        const storage = getStorage();
                        for (const ps of affected) {
                            await storage.updatePromptSet(ps.id, { folderId: targetId });
                        }
                        await storage.deleteFolder(sourceId);
                        await loadCategoryData(pageEl);
                        showMobileToast(`已合并 ${affected.length} 个提示词到「${targetFolder.name}」`);
                    } catch (e) {
                        showMobileToast('合并失败', 'error');
                    }
                }
            );
        });
    }

    renderMerge();
    overlay.classList.add('m-folder-dialog-show');
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeFolderDialog(overlay);
    }, { once: true });
}

function showCleanupEmptyFoldersConfirm(pageEl) {
    const emptyFolders = (categoryData?.folders || []).filter(f =>
        (categoryData?.promptSets || []).filter(p => p.folderId === f.id).length === 0
    );

    if (emptyFolders.length === 0) {
        showMobileToast('没有空分类需要清理');
        return;
    }

    showCategoryConfirm(pageEl,
        `发现 ${emptyFolders.length} 个空分类：${emptyFolders.map(f => f.name).join('、')}。\n确定删除？`,
        async () => {
            try {
                const storage = getStorage();
                for (const f of emptyFolders) {
                    await storage.deleteFolder(f.id);
                }
                await loadCategoryData(pageEl);
                showMobileToast(`已清理 ${emptyFolders.length} 个空分类`);
            } catch (e) {
                showMobileToast('清理失败', 'error');
            }
        }
    );
}

function unmount(pageEl) {
    currentSegment = 'category';
    categoryData = null;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

export { render, mount, unmount };
