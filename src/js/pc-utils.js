let contextMenuTargetId = null;
let folderContextMenuTargetId = null;
let contextMenuJustOpened = false;
let activeContextMenuHandler = null;
let activeContextMenuObserver = null;

function getPcApp() {
    return document.getElementById('pcApp');
}

function ensureToastContainer() {
    let container = document.getElementById('pcToastContainer');
    if (!container) {
        container = document.createElement('div');
        container.className = 'pc-toast-container';
        container.id = 'pcToastContainer';
        const app = getPcApp();
        if (app) app.appendChild(container);
        else document.body.appendChild(container);
    }
    return container;
}

function showToast(message, type = 'success') {
    const container = ensureToastContainer();
    const toast = document.createElement('div');
    toast.className = `pc-toast pc-toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('pc-toast-show'));
    setTimeout(() => {
        toast.classList.remove('pc-toast-show');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

function showModal(content) {
    let overlay = document.getElementById('pcModalOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'pc-modal-overlay';
        overlay.id = 'pcModalOverlay';
        const modal = document.createElement('div');
        modal.className = 'pc-modal';
        modal.id = 'pcModalContent';
        overlay.appendChild(modal);
        const app = getPcApp();
        if (app) app.appendChild(overlay);
        else document.body.appendChild(overlay);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });
    }
    const modal = document.getElementById('pcModalContent');
    modal.innerHTML = content;
    overlay.classList.add('pc-modal-active');
    return modal;
}

function closeModal() {
    const overlay = document.getElementById('pcModalOverlay');
    if (overlay && overlay.classList.contains('pc-modal-active')) {
        overlay.classList.remove('pc-modal-active');
    }
}

function showConfirmModal(message, onConfirm) {
    const modal = showModal(`
        <h3>确认操作</h3>
        <p class="pc-modal-desc">${message}</p>
        <div class="pc-modal-actions">
            <button class="pc-btn pc-btn-secondary" id="pcModalCancel">取消</button>
            <button class="pc-btn pc-btn-danger" id="pcModalConfirm">确定</button>
        </div>
    `);
    modal.querySelector('#pcModalCancel').addEventListener('click', closeModal);
    modal.querySelector('#pcModalConfirm').addEventListener('click', () => {
        closeModal();
        onConfirm();
    });
}

function showContextMenu(x, y, items) {
    let menu = document.getElementById('pcContextMenu');
    if (!menu) {
        menu = document.createElement('div');
        menu.className = 'pc-context-menu';
        menu.id = 'pcContextMenu';
        const app = getPcApp();
        if (app) app.appendChild(menu);
        else document.body.appendChild(menu);
        document.addEventListener('click', (e) => {
            if (contextMenuJustOpened) {
                contextMenuJustOpened = false;
                return;
            }
            if (!e.target.closest('.pc-context-menu')) hideContextMenu();
        });
        document.addEventListener('scroll', () => hideContextMenu(), true);
    }

    if (activeContextMenuHandler) {
        menu.removeEventListener('click', activeContextMenuHandler);
        activeContextMenuHandler = null;
    }
    if (activeContextMenuObserver) {
        activeContextMenuObserver.disconnect();
        activeContextMenuObserver = null;
    }

    menu.innerHTML = items.map(item => {
        if (item.divider) return '<div class="pc-context-divider"></div>';
        return `<div class="pc-context-item ${item.danger ? 'pc-context-danger' : ''}" data-action="${item.action}">
            ${item.icon ? `<span class="pc-context-icon">${item.icon}</span>` : ''}
            <span>${item.label}</span>
        </div>`;
    }).join('');

    menu.style.visibility = 'hidden';
    menu.classList.add('pc-context-active');

    const rect = menu.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 8;
    const maxY = window.innerHeight - rect.height - 8;
    menu.style.left = Math.min(x, maxX) + 'px';
    menu.style.top = Math.min(y, maxY) + 'px';
    menu.style.visibility = '';

    contextMenuJustOpened = true;

    return new Promise((resolve) => {
        const clickHandler = (e) => {
            const item = e.target.closest('.pc-context-item');
            if (item) {
                e.stopPropagation();
                hideContextMenu();
                menu.removeEventListener('click', clickHandler);
                activeContextMenuHandler = null;
                resolve(item.dataset.action);
            }
        };
        menu.addEventListener('click', clickHandler);
        activeContextMenuHandler = clickHandler;

        const observer = new MutationObserver(() => {
            if (!menu.classList.contains('pc-context-active')) {
                menu.removeEventListener('click', clickHandler);
                activeContextMenuHandler = null;
                observer.disconnect();
                activeContextMenuObserver = null;
                resolve(null);
            }
        });
        observer.observe(menu, { attributes: true, attributeFilter: ['class'] });
        activeContextMenuObserver = observer;
    });
}

function hideContextMenu() {
    const menu = document.getElementById('pcContextMenu');
    if (menu) menu.classList.remove('pc-context-active');
}

function setContextMenuTargetId(id) {
    contextMenuTargetId = id;
}

function getContextMenuTargetId() {
    return contextMenuTargetId;
}

function setFolderContextMenuTargetId(id) {
    folderContextMenuTargetId = id;
}

function getFolderContextMenuTargetId() {
    return folderContextMenuTargetId;
}

function showImageViewer(src) {
    let viewer = document.getElementById('pcImageViewer');
    if (!viewer) {
        viewer = document.createElement('div');
        viewer.className = 'pc-image-viewer';
        viewer.id = 'pcImageViewer';
        viewer.innerHTML = '<img id="pcImageViewerImg" alt="">';
        const app = getPcApp();
        if (app) app.appendChild(viewer);
        else document.body.appendChild(viewer);
        viewer.addEventListener('click', closeImageViewer);
    }
    document.getElementById('pcImageViewerImg').src = src;
    viewer.classList.add('pc-image-viewer-active');
}

function closeImageViewer() {
    const viewer = document.getElementById('pcImageViewer');
    if (viewer) viewer.classList.remove('pc-image-viewer-active');
}

async function copyToClipboard(text) {
    if (!text) {
        showToast('内容为空，无法复制', 'error');
        return;
    }
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
        showToast('已复制到剪贴板');
    } catch (e) {
        showToast('复制失败', 'error');
    }
}

function escapeHtml(str) {
    if (!str) return '';
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

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}`;
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export {
    showToast,
    showModal,
    closeModal,
    showConfirmModal,
    showContextMenu,
    hideContextMenu,
    setContextMenuTargetId,
    getContextMenuTargetId,
    setFolderContextMenuTargetId,
    getFolderContextMenuTargetId,
    showImageViewer,
    closeImageViewer,
    copyToClipboard,
    escapeHtml,
    formatRelativeTime,
    formatDate,
    formatBytes,
    generateId
};
