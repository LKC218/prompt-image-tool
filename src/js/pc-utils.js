export { openImageViewer as showImageViewer, closeImageViewer, isOpen as isImageViewerOpen } from './pc-image-viewer.js';

let contextMenuTargetId = null;
let folderContextMenuTargetId = null;
let contextMenuSession = null;
let contextMenuOpenTimer = null;
let contextMenuEventsBound = false;
let modalKeyboardEventsBound = false;

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
    if (!modalKeyboardEventsBound) {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
        });
        modalKeyboardEventsBound = true;
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

function showPromptModal(title, defaultValue, onConfirm) {
    const modal = showModal(`
        <h3>${escapeHtml(title)}</h3>
        <div class="pc-modal-input-wrap" style="margin-bottom: var(--pc-space-xl);">
            <input type="text" class="pc-input" id="pcModalInput" value="${escapeHtml(defaultValue)}" autocomplete="off">
        </div>
        <div class="pc-modal-actions">
            <button class="pc-btn pc-btn-secondary" id="pcModalCancel">取消</button>
            <button class="pc-btn pc-btn-primary" id="pcModalConfirm">确定</button>
        </div>
    `);
    const input = modal.querySelector('#pcModalInput');
    input.focus();
    input.select();

    function confirm() {
        const value = input.value.trim();
        closeModal();
        if (value) onConfirm(value);
    }

    modal.querySelector('#pcModalCancel').addEventListener('click', closeModal);
    modal.querySelector('#pcModalConfirm').addEventListener('click', confirm);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') confirm();
    });
}

function prepareMoreButton(button) {
    if (!button || button.querySelector('.pc-more-dots')) return;
    button.innerHTML = '<span class="pc-more-dots" aria-hidden="true"><span></span><span></span><span></span></span>';
}

function getContextMenuPlacement(menu, x, y, anchor, options = {}) {
    const referenceRect = options.referenceRect;
    const placementOptions = options.placement || {};
    const margin = placementOptions.safeMargin ?? 8;
    const gap = placementOptions.gap ?? 8;
    const rect = menu.getBoundingClientRect();
    const anchorRect = anchor?.getBoundingClientRect();
    if (referenceRect) {
        const centerX = referenceRect.left + referenceRect.width / 2;
        const preferredSide = placementOptions.preferredSide ?? 'top';
        const fallbackSide = placementOptions.fallbackSide ?? 'bottom';
        const availableAbove = referenceRect.top - gap - margin;
        const availableBelow = window.innerHeight - margin - referenceRect.bottom - gap;
        const openAbove = preferredSide === 'top'
            ? (availableAbove >= rect.height || (availableBelow < rect.height && availableAbove >= availableBelow))
            : !(availableBelow >= rect.height || (availableAbove < rect.height && availableBelow >= availableAbove));
        const preferredX = centerX - rect.width / 2;
        const preferredY = openAbove
            ? referenceRect.top - gap - rect.height
            : referenceRect.bottom + gap;

        menu.classList.remove('pc-context-extend-left', 'pc-context-extend-right');
        menu.classList.toggle('pc-context-open-above', openAbove);
        menu.classList.toggle('pc-context-open-below', !openAbove);
        menu.dataset.contextPlacement = openAbove ? preferredSide : fallbackSide;

        return {
            left: Math.max(margin, Math.min(preferredX, window.innerWidth - rect.width - margin)),
            top: Math.max(margin, Math.min(preferredY, window.innerHeight - rect.height - margin))
        };
    }
    const extendLeft = anchorRect
        ? anchorRect.left + anchorRect.width / 2 >= window.innerWidth / 2
        : x >= window.innerWidth / 2;
    const openAbove = anchorRect
        ? anchorRect.bottom + gap + rect.height > window.innerHeight - margin && anchorRect.top - gap - rect.height >= margin
        : y + rect.height > window.innerHeight - margin && y - rect.height >= margin;
    const preferredX = anchorRect
        ? (extendLeft ? anchorRect.right - rect.width : anchorRect.left)
        : (extendLeft ? x - rect.width : x);
    const preferredY = anchorRect
        ? (openAbove ? anchorRect.top - gap - rect.height : anchorRect.bottom + gap)
        : (openAbove ? y - rect.height : y);

    menu.classList.toggle('pc-context-extend-left', extendLeft);
    menu.classList.toggle('pc-context-extend-right', !extendLeft);
    menu.classList.toggle('pc-context-open-above', openAbove);
    menu.classList.toggle('pc-context-open-below', !openAbove);
    delete menu.dataset.contextPlacement;

    return {
        left: Math.max(margin, Math.min(preferredX, window.innerWidth - rect.width - margin)),
        top: Math.max(margin, Math.min(preferredY, window.innerHeight - rect.height - margin))
    };
}

function clearContextMenuSession(result = null, restoreFocus = true) {
    if (contextMenuOpenTimer) {
        clearTimeout(contextMenuOpenTimer);
        contextMenuOpenTimer = null;
    }

    const session = contextMenuSession;
    contextMenuSession = null;
    if (!session) return;

    session.anchor?.classList.remove('pc-more-btn-opening', 'pc-more-btn-active');
    session.anchor?.setAttribute('aria-expanded', 'false');
    if (restoreFocus && session.restoreFocusElement?.isConnected) session.restoreFocusElement.focus({ preventScroll: true });
    session.resolve(result);
}

function bindContextMenuEvents() {
    if (contextMenuEventsBound) return;
    contextMenuEventsBound = true;

    document.addEventListener('pointerdown', (e) => {
        const menu = document.getElementById('pcContextMenu');
        if (!menu?.classList.contains('pc-context-active')) return;
        if (menu.contains(e.target) || contextMenuSession?.anchor?.contains(e.target)) return;
        hideContextMenu();
    });
    document.addEventListener('scroll', () => hideContextMenu(), true);
    document.addEventListener('keydown', (e) => {
        const menu = document.getElementById('pcContextMenu');
        if (!menu?.classList.contains('pc-context-active')) return;
        const panel = document.activeElement.closest?.('.pc-context-panel') || menu.querySelector('.pc-context-panel');
        const buttons = [...(panel?.querySelectorAll(':scope > .pc-context-action:not([disabled])') || [])];
        const currentIndex = buttons.indexOf(document.activeElement);
        if (e.key === 'Escape') {
            e.preventDefault();
            const parentAction = panel?.dataset.parentAction;
            if (parentAction) {
                closeContextSubmenu(menu, parentAction);
                menu.querySelector(`[data-submenu="${parentAction}"]`)?.focus({ preventScroll: true });
            } else {
                hideContextMenu();
            }
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const direction = e.key === 'ArrowDown' ? 1 : -1;
            buttons[(currentIndex + direction + buttons.length) % buttons.length]?.focus();
        } else if (e.key === 'ArrowRight' && currentIndex >= 0 && buttons[currentIndex].dataset.submenu) {
            e.preventDefault();
            openContextSubmenu(menu, buttons[currentIndex].dataset.submenu, true);
        } else if (e.key === 'ArrowLeft' && panel?.dataset.parentAction) {
            e.preventDefault();
            const parentAction = panel.dataset.parentAction;
            closeContextSubmenu(menu, parentAction);
            menu.querySelector(`[data-submenu="${parentAction}"]`)?.focus({ preventScroll: true });
        } else if ((e.key === 'Enter' || e.key === ' ') && currentIndex >= 0) {
            e.preventDefault();
            buttons[currentIndex].click();
        }
    });
}

function renderContextMenuItems(items, parentAction = '') {
    return items.map((item, index) => {
        if (item.divider) return '<div class="pc-context-divider" role="separator"></div>';
        const tone = item.tone ? ` pc-context-tone-${item.tone}` : '';
        const submenu = Array.isArray(item.children) && item.children.length > 0;
        const submenuAttrs = submenu ? ` data-submenu="${item.action}" aria-haspopup="menu" aria-expanded="false"` : '';
        return `<button type="button" class="pc-context-action${tone} ${item.danger ? 'pc-context-danger' : ''}" role="menuitem" data-action="${item.action || ''}"${submenuAttrs}${item.disabled ? ' disabled' : ''} data-ripple="false" style="--pc-context-index:${index}">
            <span class="pc-context-label">${item.label}</span>
            <span class="pc-context-icon${tone}">${item.icon || ''}</span>
            ${submenu ? '<span class="pc-context-submenu-arrow" aria-hidden="true">›</span>' : ''}
        </button>`;
    }).join('');
}

function renderContextSubmenus(items) {
    return items.filter(item => Array.isArray(item.children) && item.children.length > 0).map(item => `
        <div class="pc-context-panel pc-context-submenu" role="menu" data-parent-action="${item.action}" aria-label="${item.label}">
            ${renderContextMenuItems(item.children, item.action)}
        </div>
    `).join('');
}

function openContextSubmenu(menu, action, focusFirst = false) {
    const panel = menu.querySelector(`.pc-context-submenu[data-parent-action="${action}"]`);
    const trigger = menu.querySelector(`[data-submenu="${action}"]`);
    if (!panel || !trigger) return;
    menu.querySelectorAll('.pc-context-submenu-active').forEach(item => item.classList.remove('pc-context-submenu-active'));
    menu.querySelectorAll('[data-submenu][aria-expanded="true"]').forEach(item => item.setAttribute('aria-expanded', 'false'));
    panel.classList.add('pc-context-submenu-active');
    trigger.setAttribute('aria-expanded', 'true');
    if (focusFirst) panel.querySelector('.pc-context-action:not([disabled])')?.focus({ preventScroll: true });
}

function closeContextSubmenu(menu, action) {
    const panel = menu.querySelector(`.pc-context-submenu[data-parent-action="${action}"]`);
    const trigger = menu.querySelector(`[data-submenu="${action}"]`);
    panel?.classList.remove('pc-context-submenu-active');
    trigger?.setAttribute('aria-expanded', 'false');
}

function showContextMenu(x, y, items, options = {}) {
    let menu = document.getElementById('pcContextMenu');
    if (!menu) {
        menu = document.createElement('div');
        menu.className = 'pc-context-menu';
        menu.id = 'pcContextMenu';
        menu.setAttribute('role', 'menu');
        const app = getPcApp();
        if (app) app.appendChild(menu);
        else document.body.appendChild(menu);
    }
    bindContextMenuEvents();

    const anchor = options.anchor instanceof Element ? options.anchor : null;
    const restoreFocusElement = options.restoreFocusElement instanceof Element ? options.restoreFocusElement : anchor;
    const preserveFocus = options.focusMenu === false;
    if (contextMenuSession?.anchor === anchor) {
        hideContextMenu();
        return Promise.resolve(null);
    }
    hideContextMenu(null, false);

    return new Promise((resolve) => {
        contextMenuSession = { anchor, restoreFocusElement, preserveFocus, resolve };
        const open = () => {
            if (!contextMenuSession || contextMenuSession.resolve !== resolve) return;
            menu.innerHTML = `<div class="pc-context-panel" role="menu">${renderContextMenuItems(items)}</div>${renderContextSubmenus(items)}`;
            menu.style.visibility = 'hidden';
            menu.classList.toggle('pc-context-menu-text-selection', options.variant === 'text-selection');
            menu.classList.add('pc-context-active');

            const placement = getContextMenuPlacement(menu, x, y, anchor, options);
            menu.style.left = `${placement.left}px`;
            menu.style.top = `${placement.top}px`;
            menu.style.visibility = '';
            menu.classList.toggle('pc-context-preserve-focus', preserveFocus);
            anchor?.classList.remove('pc-more-btn-opening');
            anchor?.classList.add('pc-more-btn-active');
            anchor?.setAttribute('aria-expanded', 'true');
            if (!preserveFocus) menu.querySelector('.pc-context-action')?.focus({ preventScroll: true });

            menu.onpointerdown = (e) => {
                if (contextMenuSession?.preserveFocus && e.target.closest('.pc-context-action')) {
                    e.preventDefault();
                }
            };

            menu.onclick = (e) => {
                const button = e.target.closest('.pc-context-action');
                if (button?.dataset.submenu) {
                    openContextSubmenu(menu, button.dataset.submenu);
                    return;
                }
                const action = button?.dataset.action;
                if (!action) return;
                hideContextMenu(action, false);
            }
            menu.onpointerover = (e) => {
                const button = e.target.closest('.pc-context-action[data-submenu]');
                if (button) openContextSubmenu(menu, button.dataset.submenu);
            };
        };
        if (options.source === 'more' && anchor) {
            prepareMoreButton(anchor);
            anchor.classList.remove('pc-more-btn-opening');
            void anchor.offsetWidth;
            anchor.classList.add('pc-more-btn-opening');
            anchor.setAttribute('aria-controls', 'pcContextMenu');
            anchor.setAttribute('aria-expanded', 'false');
            if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
                open();
            } else {
                contextMenuOpenTimer = setTimeout(() => {
                    contextMenuOpenTimer = null;
                    open();
                }, 220);
            }
        } else {
            open();
        }
    });
}

function hideContextMenu(result = null, restoreFocus = true) {
    const menu = document.getElementById('pcContextMenu');
    if (menu) {
        menu.classList.remove('pc-context-active', 'pc-context-preserve-focus');
        menu.onpointerdown = null;
        menu.onpointerover = null;
    }
    clearContextMenuSession(result, restoreFocus);
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
    showPromptModal,
    showContextMenu,
    hideContextMenu,
    setContextMenuTargetId,
    getContextMenuTargetId,
    setFolderContextMenuTargetId,
    getFolderContextMenuTargetId,
    copyToClipboard,
    escapeHtml,
    formatRelativeTime,
    formatDate,
    formatBytes,
    generateId
};
