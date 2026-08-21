import { escapeHtml } from './pc-utils.js';

const ICON_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"></rect><circle cx="8.5" cy="9.5" r="1.5"></circle><path d="m21 15-4.5-4.5L8 19"></path></svg>`;

let activePreview = null;
let activeIcon = null;
let hoverTimer = null;
let leaveTimer = null;
let slideshowTimer = null;
const SLIDESHOW_INTERVAL = 2000;

function createPreviewElement(url, options = {}) {
    const el = document.createElement('div');
    el.className = 'goal-image-preview-float';
    el.innerHTML = `
        <div class="goal-image-preview-stage">
            <img src="${url}" alt="图片预览" loading="lazy">
        </div>
    `;
    const img = el.querySelector('img');
    if (options.onClickImage) {
        img.style.cursor = 'zoom-in';
        img.addEventListener('click', options.onClickImage);
    }
    if (options.onLoad) {
        if (img.complete) {
            options.onLoad();
        } else {
            img.addEventListener('load', options.onLoad);
        }
    }
    document.body.appendChild(el);
    return el;
}

function positionPreview(iconEl, previewEl) {
    const iconRect = iconEl.getBoundingClientRect();
    const previewRect = previewEl.getBoundingClientRect();
    const gap = 8;
    const padding = 12;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    const previewW = previewRect.width;
    const previewH = previewRect.height;

    // 水平：优先右侧，不足则左侧，再不足则居中
    let left;
    if (iconRect.right + gap + previewW <= viewportW - padding) {
        left = iconRect.right + gap;
    } else if (iconRect.left - gap - previewW >= padding) {
        left = iconRect.left - gap - previewW;
    } else {
        left = Math.max(padding, (viewportW - previewW) / 2);
    }

    // 垂直：优先与图标顶部对齐，超出底部则上移，顶部不足则下移
    let top = iconRect.top;
    if (top + previewH > viewportH - padding) {
        top = viewportH - previewH - padding;
    }
    if (top < padding) {
        top = padding;
    }

    previewEl.style.left = `${left}px`;
    previewEl.style.top = `${top}px`;
}

function stopSlideshow() {
    if (slideshowTimer) {
        clearInterval(slideshowTimer);
        slideshowTimer = null;
    }
}

export function renderGoalImageIcon(task, options = {}) {
    const hasImages = task.images && task.images.length > 0;
    if (!hasImages) return '';

    const count = task.images.length;
    const countBadge = count > 1 ? `<span class="goal-image-icon-count">${count}</span>` : '';
    return `
        <button class="goal-image-icon ${options.className || ''}" type="button" aria-label="查看图片" data-task-id="${escapeHtml(task.id)}" data-preview-src="${escapeHtml(options.src || '')}">
            ${ICON_SVG}
            ${countBadge}
        </button>
    `;
}

export function mountGoalImageIcons(container, options = {}) {
    const getImageUrl = options.getImageUrl || (() => '');
    const onClick = options.onClick;
    const onOpenViewer = options.onOpenViewer;
    const delay = options.delay ?? 150;
    const isMobile = options.isMobile || false;

    function clearLeaveTimer() {
        if (leaveTimer) {
            clearTimeout(leaveTimer);
            leaveTimer = null;
        }
    }

    function scheduleHidePreview() {
        clearLeaveTimer();
        leaveTimer = setTimeout(() => {
            hidePreview();
        }, 120);
    }

    function showPreview(iconEl, taskId) {
        clearLeaveTimer();
        if (hoverTimer) {
            clearTimeout(hoverTimer);
            hoverTimer = null;
        }
        if (activePreview && activeIcon === iconEl) return;
        hidePreview();

        const task = options.getTask ? options.getTask(taskId) : null;
        if (!task || !task.images || task.images.length === 0) return;

        activeIcon = iconEl;
        renderPreview(iconEl, task, 0);
    }

    function startSlideshow(iconEl, task, startIndex) {
        stopSlideshow();
        if (!task.images || task.images.length <= 1) return;
        let index = startIndex;
        slideshowTimer = setInterval(() => {
            index = (index + 1) % task.images.length;
            renderPreview(iconEl, task, index);
        }, SLIDESHOW_INTERVAL);
    }

    function renderPreview(iconEl, task, index) {
        hidePreview(true);
        const images = task.images;
        if (!images || images.length === 0) return;
        index = (index + images.length) % images.length;
        const url = getImageUrl(images[index]);
        if (!url) return;

        activePreview = createPreviewElement(url, {
            onClickImage: (e) => {
                e.stopPropagation();
                hidePreview();
                if (onOpenViewer) {
                    onOpenViewer(task, index);
                } else if (onClick) {
                    onClick(task, index);
                }
            },
            onLoad: () => {
                if (activePreview && activeIcon) {
                    positionPreview(activeIcon, activePreview);
                }
            }
        });
        activePreview.dataset.taskId = task.id;
        activePreview.dataset.index = String(index);

        activePreview.addEventListener('mouseenter', () => {
            clearLeaveTimer();
            stopSlideshow();
        });
        activePreview.addEventListener('mouseleave', () => {
            startSlideshow(iconEl, task, index);
            scheduleHidePreview();
        });
        activePreview.addEventListener('click', (e) => {
            if (e.target.closest('img')) return;
            hidePreview();
        });

        requestAnimationFrame(() => {
            if (activePreview) {
                activePreview.classList.add('is-visible');
                positionPreview(iconEl, activePreview);
                startSlideshow(iconEl, task, index);
            }
        });
    }

    function hidePreview(skipClearLeave = false) {
        if (hoverTimer) {
            clearTimeout(hoverTimer);
            hoverTimer = null;
        }
        if (!skipClearLeave) clearLeaveTimer();
        stopSlideshow();
        if (activePreview) {
            activePreview.remove();
            activePreview = null;
        }
        activeIcon = null;
    }

    function bindKeyboard() {
        function onKeydown(e) {
            if (!activePreview) return;
            if (e.key === 'Escape') {
                hidePreview();
            }
        }
        document.addEventListener('keydown', onKeydown);
        return () => document.removeEventListener('keydown', onKeydown);
    }
    const unbindKeyboard = bindKeyboard();

    container.querySelectorAll('.goal-image-icon').forEach(icon => {
        const taskId = icon.dataset.taskId;

        if (isMobile) {
            let longPressTimer = null;
            icon.addEventListener('touchstart', (e) => {
                longPressTimer = setTimeout(() => {
                    longPressTimer = null;
                    showPreview(icon, taskId);
                }, 400);
            }, { passive: true });
            icon.addEventListener('touchend', () => {
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
                setTimeout(() => scheduleHidePreview(), 1500);
            });
            icon.addEventListener('touchmove', () => {
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
            }, { passive: true });
        } else {
            icon.addEventListener('mouseenter', () => {
                clearLeaveTimer();
                hoverTimer = setTimeout(() => showPreview(icon, taskId), delay);
            });
            icon.addEventListener('mouseleave', () => {
                if (hoverTimer) {
                    clearTimeout(hoverTimer);
                    hoverTimer = null;
                }
                scheduleHidePreview();
            });
        }

        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            hidePreview();
            const task = options.getTask ? options.getTask(taskId) : null;
            if (!task) return;
            if (onClick) {
                onClick(task);
            } else {
                showPreview(icon, taskId);
            }
        });
    });

    return {
        hidePreview,
        destroy: () => {
            hidePreview();
            unbindKeyboard();
        }
    };
}

export function closeGoalImagePreview() {
    if (hoverTimer) {
        clearTimeout(hoverTimer);
        hoverTimer = null;
    }
    if (activePreview) {
        activePreview.remove();
        activePreview = null;
    }
    activeIcon = null;
    stopSlideshow();
}
