import { getStorage } from './storage.js';
import { navigate, goBack, showMobileToast, showActionSheet, iconImg } from './mobile-utils.js';
import folderIcon from '../assets/mobile/folder.png';

function showRenameDialog(pageEl, id, currentName, onDone) {
    let overlay = pageEl.querySelector('.m-rename-overlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.className = 'm-rename-overlay';
    overlay.innerHTML = `
        <div class="m-rename-dialog">
            <div class="m-rename-title">重命名</div>
            <input type="text" class="m-rename-input" id="mRenameInput" value="${escapeAttr(currentName)}" maxlength="50">
            <div class="m-rename-actions">
                <button class="m-rename-btn m-rename-cancel" id="mRenameCancel">取消</button>
                <button class="m-rename-btn m-rename-ok" id="mRenameOk">确定</button>
            </div>
        </div>
    `;
    pageEl.appendChild(overlay);

    const input = overlay.querySelector('#mRenameInput');
    const okBtn = overlay.querySelector('#mRenameOk');
    const cancelBtn = overlay.querySelector('#mRenameCancel');

    requestAnimationFrame(() => {
        overlay.classList.add('m-rename-show');
        input.focus();
        input.select();
    });

    async function doRename() {
        const newName = input.value.trim();
        if (!newName) {
            showMobileToast('名称不能为空', 'error');
            return;
        }
        if (newName === currentName) {
            overlay.classList.remove('m-rename-show');
            setTimeout(() => overlay.remove(), 300);
            return;
        }
        try {
            await getStorage().updatePromptSet(id, { name: newName });
            showMobileToast('已重命名');
            overlay.classList.remove('m-rename-show');
            setTimeout(() => overlay.remove(), 300);
            if (onDone) onDone(newName);
        } catch (e) {
            showMobileToast('重命名失败', 'error');
        }
    }

    okBtn.addEventListener('click', doRename);
    cancelBtn.addEventListener('click', () => {
        overlay.classList.remove('m-rename-show');
        setTimeout(() => overlay.remove(), 300);
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doRename();
        if (e.key === 'Escape') {
            overlay.classList.remove('m-rename-show');
            setTimeout(() => overlay.remove(), 300);
        }
    });
}

async function showMoveDialog(pageEl, id, currentFolderId, onDone) {
    let folders = [];
    try {
        folders = await getStorage().getFolders();
    } catch (e) {
        showMobileToast('加载分类失败', 'error');
        return;
    }

    const FOLDER_ICON = iconImg(folderIcon);

    showActionSheet([
        {
            action: 'none',
            icon: FOLDER_ICON,
            label: '未分类',
            handler: async () => {
                await getStorage().updatePromptSet(id, { folderId: '' });
                showMobileToast('已移至未分类');
                if (onDone) onDone();
            }
        },
        ...folders.map(f => ({
            action: f.id,
            icon: FOLDER_ICON,
            label: f.name + (f.id === currentFolderId ? ' ✓' : ''),
            handler: async () => {
                await getStorage().updatePromptSet(id, { folderId: f.id });
                showMobileToast('已移动到 ' + f.name);
                if (onDone) onDone();
            }
        }))
    ]);
}

async function handleCopy(id, onDone) {
    try {
        const storage = getStorage();
        const set = await storage.getPromptSet(id);
        if (!set) {
            showMobileToast('提示词不存在', 'error');
            return;
        }

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

        showMobileToast('已复制');
        if (onDone) onDone();
    } catch (e) {
        console.error('copy error:', e);
        showMobileToast('复制失败', 'error');
    }
}

function showDeleteConfirm(pageEl, id, onDone) {
    let overlay = pageEl.querySelector('.m-delete-confirm-overlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.className = 'm-delete-confirm-overlay';
    overlay.innerHTML = `
        <div class="m-delete-confirm-dialog">
            <div class="m-delete-confirm-text">确定要删除这个提示词吗？此操作不可撤销。</div>
            <div class="m-delete-confirm-actions">
                <button class="m-delete-confirm-btn m-delete-confirm-cancel" id="mDeleteConfirmCancel">取消</button>
                <button class="m-delete-confirm-btn m-delete-confirm-ok" id="mDeleteConfirmOk">删除</button>
            </div>
        </div>
    `;
    pageEl.appendChild(overlay);

    requestAnimationFrame(() => overlay.classList.add('m-delete-confirm-show'));

    overlay.querySelector('#mDeleteConfirmOk').addEventListener('click', async () => {
        try {
            await getStorage().deletePromptSet(id);
            showMobileToast('已删除');
            overlay.classList.remove('m-delete-confirm-show');
            setTimeout(() => overlay.remove(), 300);
            if (onDone) onDone();
        } catch (e) {
            showMobileToast('删除失败', 'error');
        }
    });

    overlay.querySelector('#mDeleteConfirmCancel').addEventListener('click', () => {
        overlay.classList.remove('m-delete-confirm-show');
        setTimeout(() => overlay.remove(), 300);
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
        {
            action: 'copy',
            icon: '📋',
            label: '复制',
            handler: () => handleCopy(id, options.onActionDone)
        },
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
