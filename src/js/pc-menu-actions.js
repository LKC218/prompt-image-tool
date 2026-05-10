import { getStorage } from './storage.js';
import { navigate } from './pc-app.js';
import { showToast, showModal, closeModal, showConfirmModal, copyToClipboard, escapeHtml } from './pc-utils.js';
import folderIcon from '../assets/mobile/folder.png';

function iconImg(src, alt = '') {
    return `<img src="${src}" alt="${alt}" class="pc-icon-img">`;
}

function showRenameDialog(pageEl, id, currentName, onDone) {
    const modal = showModal(`
        <h3>重命名</h3>
        <div class="pc-form-group pc-rename-dialog-field">
            <input type="text" class="pc-input" id="pcRenameInput" value="${escapeAttr(currentName)}" maxlength="50">
        </div>
        <div class="pc-modal-actions">
            <button class="pc-btn pc-btn-secondary" id="pcRenameCancel">取消</button>
            <button class="pc-btn pc-btn-primary" id="pcRenameOk">确定</button>
        </div>
    `);

    const input = modal.querySelector('#pcRenameInput');
    const okBtn = modal.querySelector('#pcRenameOk');
    const cancelBtn = modal.querySelector('#pcRenameCancel');

    requestAnimationFrame(() => { input.focus(); input.select(); });

    async function doRename() {
        const newName = input.value.trim();
        if (!newName) { showToast('名称不能为空', 'error'); return; }
        if (newName === currentName) { closeModal(); return; }
        try {
            await getStorage().updatePromptSet(id, { name: newName });
            showToast('已重命名');
            closeModal();
            if (onDone) onDone(newName);
        } catch (e) {
            showToast('重命名失败', 'error');
        }
    }

    okBtn.addEventListener('click', doRename);
    cancelBtn.addEventListener('click', closeModal);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doRename();
        if (e.key === 'Escape') closeModal();
    });
}

async function showMoveDialog(pageEl, id, currentFolderId, onDone) {
    let folders = [];
    try {
        folders = await getStorage().getFolders();
    } catch (e) {
        showToast('加载分类失败', 'error');
        return;
    }

    const FOLDER_ICON = iconImg(folderIcon);

    const modal = showModal(`
        <h3>移动到分类</h3>
        <div class="pc-picker-list">
            <button class="pc-picker-list-item ${!currentFolderId ? 'pc-picker-list-active' : ''}" data-folder-id="">
                <span class="pc-picker-list-icon">${FOLDER_ICON}</span>
                <span>未分类</span>
                ${!currentFolderId ? '<span class="pc-picker-list-check">✓</span>' : ''}
            </button>
            ${folders.map(f => `
                <button class="pc-picker-list-item ${f.id === currentFolderId ? 'pc-picker-list-active' : ''}" data-folder-id="${f.id}">
                    <span class="pc-picker-list-icon">${FOLDER_ICON}</span>
                    <span>${escapeHtml(f.name)}</span>
                    ${f.id === currentFolderId ? '<span class="pc-picker-list-check">✓</span>' : ''}
                </button>
            `).join('')}
        </div>
    `);

    modal.querySelectorAll('.pc-picker-list-item').forEach(btn => {
        btn.addEventListener('click', async () => {
            const folderId = btn.dataset.folderId || null;
            try {
                await getStorage().updatePromptSet(id, { folderId });
                showToast(folderId ? '已移动' : '已移至未分类');
                closeModal();
                if (onDone) onDone();
            } catch (e) {
                showToast('移动失败', 'error');
            }
        });
    });
}

async function handleCopy(id, onDone) {
    try {
        const storage = getStorage();
        const set = await storage.getPromptSet(id);
        if (!set) { showToast('提示词不存在', 'error'); return; }

        let tags = set.tags || '[]';
        if (typeof tags !== 'string') tags = JSON.stringify(tags);

        const newName = set.name + '（副本）';
        const result = await storage.createPromptSet(newName, set.folderId || null, tags);

        if (set.versions && set.versions.length > 0) {
            const v = set.versions[0];
            await storage.updatePromptSet(result.id, {
                versions: [{
                    id: result.versions[0].id,
                    prompt: v.prompt || '',
                    negativePrompt: v.negativePrompt || v.negative_prompt || '',
                    note: v.note || '',
                    aspectRatio: v.aspectRatio || v.aspect_ratio || '1:1',
                    images: []
                }]
            });
        }

        showToast('已复制');
        if (onDone) onDone();
    } catch (e) {
        console.error('copy error:', e);
        showToast('复制失败', 'error');
    }
}

function showDeleteConfirm(pageEl, id, onDone) {
    showConfirmModal('确定要删除这个提示词吗？此操作不可撤销。', async () => {
        try {
            await getStorage().deletePromptSet(id);
            showToast('已删除');
            if (onDone) onDone();
        } catch (e) {
            showToast('删除失败', 'error');
        }
    });
}

function getPromptSetMenuItems(id, pageEl, options = {}) {
    const items = [];

    if (options.showEdit) {
        items.push({
            action: 'edit',
            icon: '✏️',
            label: '编辑',
            handler: () => navigate('/editor/' + id)
        });
    }

    items.push(
        {
            action: 'rename',
            icon: '📝',
            label: '重命名',
            handler: async () => {
                const set = await getStorage().getPromptSet(id);
                if (set) showRenameDialog(pageEl, id, set.name, options.onActionDone);
            }
        },
        {
            action: 'move',
            icon: '📁',
            label: '移动到分类',
            handler: async () => {
                const set = await getStorage().getPromptSet(id);
                if (set) showMoveDialog(pageEl, id, set.folderId, options.onActionDone);
            }
        },
        { divider: true },
        {
            action: 'copy',
            icon: '📋',
            label: '复制',
            handler: () => handleCopy(id, options.onActionDone)
        },
        { divider: true },
        {
            action: 'delete',
            icon: '🗑️',
            label: '删除',
            danger: true,
            handler: () => showDeleteConfirm(pageEl, id, options.onActionDone)
        }
    );

    return items;
}

function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export { showRenameDialog, showMoveDialog, handleCopy, showDeleteConfirm, getPromptSetMenuItems };
