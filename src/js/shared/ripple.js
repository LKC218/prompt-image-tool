// src/js/ripple.js — TDesign 风格 Ripple 波纹点击反馈工具
// 事件委托模式：document 级 pointerdown 监听，通过选择器匹配目标元素
// 自动清理：animationend / animationcancel 移除波纹元素，兜底 1.2s 强制清理

const RIPPLE_SELECTOR = [
    '.pc-btn', '.pc-section-title-action', '.pc-prompt-copy-btn',
    '.pc-version-tab', '.pc-version-tab-add',
    '.pc-library-filter-btn',
    '.pc-library-icon-btn', '.pc-library-action-btn', '.pc-library-page-btn',
    '.pc-detail-breadcrumb-link', '.pc-detail-top-nav-btn',
    '.pc-detail-prompt-copy', '.pc-detail-version-view-all',
    '.pc-detail-cover-nav', '.pc-detail-action-btn',
    '.pc-editor-clear-all-btn',
    '.pc-editor-prompt-clear', '.pc-editor-add-tag-btn',
    '.pc-editor-ratio-btn', '.pc-add-tag-btn', '.pc-tag-custom-add-btn',
    '.pc-select-card', '.pc-settings-action-card',
    '.pc-theme-dot', '.pc-image-viewer-tool',
    '.pc-category-create-btn', '.pc-icon-btn',
    '.pc-quick-action-btn', '.pc-save-btn',
    '.pc-action-btn', '.pc-text-btn',
    '.pc-folder-dialog-btn', '.pc-quick-create-card',
    '.pc-home-page .pc-star-btn', '.pc-home-page .pc-more-btn',
    '.pc-nav-item', '.pc-sidebar-toggle'
].join(',');

const RIPPLE_HOST_CLASS = 'td-ripple-host';
const RIPPLE_ELEMENT_CLASS = 'td-ripple';

let reducedMotionMQ = null;
let listenerAttached = false;

function prefersReducedMotion() {
    if (!reducedMotionMQ) {
        reducedMotionMQ = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    }
    return reducedMotionMQ?.matches === true;
}

function createRipple(target, clientX, clientY) {
    const rect = target.getBoundingClientRect();
    const diameter = Math.max(rect.width, rect.height);
    const radius = diameter / 2;
    const x = clientX - rect.left - radius;
    const y = clientY - rect.top - radius;

    const ripple = document.createElement('span');
    ripple.className = RIPPLE_ELEMENT_CLASS;
    ripple.style.width = `${diameter}px`;
    ripple.style.height = `${diameter}px`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;

    target.classList.add(RIPPLE_HOST_CLASS);
    target.appendChild(ripple);

    let cleaned = false;
    const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        target.classList.remove(RIPPLE_HOST_CLASS);
        if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
    };
    ripple.addEventListener('animationend', cleanup, { once: true });
    ripple.addEventListener('animationcancel', cleanup, { once: true });
    setTimeout(cleanup, 1200);
}

function handlePointerDown(e) {
    if (prefersReducedMotion()) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const target = e.target.closest(RIPPLE_SELECTOR);
    if (!target) return;
    if (target.disabled || target.getAttribute('aria-disabled') === 'true') return;
    if (target.dataset.ripple === 'false') return;

    createRipple(target, e.clientX, e.clientY);
}

function initRipple(root = document) {
    if (listenerAttached) return;
    root.addEventListener('pointerdown', handlePointerDown);
    listenerAttached = true;
}

export { initRipple };
