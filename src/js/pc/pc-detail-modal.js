import { gsap } from 'gsap';
import { render, mount, unmount } from './pc-detail.js';

const sessions = new Map();
let activeId = null;
let scrollLocked = false;
let minimizedTrayOpen = false;

function getFocusableElements(container) {
    return [...container.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter(element => !element.hidden && element.getClientRects().length > 0);
}

function restoreTriggerFocus(triggerElement) {
    if (!triggerElement?.isConnected || typeof triggerElement.focus !== 'function') return;
    if (triggerElement.tabIndex < 0 && !triggerElement.hasAttribute('tabindex')) triggerElement.setAttribute('tabindex', '-1');
    triggerElement.focus({ preventScroll: true });
}

function getReturnTarget(panel, triggerElement) {
    if (!triggerElement?.isConnected) return null;
    const panelRect = panel.getBoundingClientRect();
    const triggerRect = triggerElement.getBoundingClientRect();
    const isVisible = triggerRect.width > 0
        && triggerRect.height > 0
        && triggerRect.bottom > 0
        && triggerRect.right > 0
        && triggerRect.top < window.innerHeight
        && triggerRect.left < window.innerWidth;
    if (!isVisible) return null;
    return {
        x: triggerRect.left + triggerRect.width / 2 - (panelRect.left + panelRect.width / 2),
        y: triggerRect.top + triggerRect.height / 2 - (panelRect.top + panelRect.height / 2)
    };
}

function updateScrollLock() {
    const hasExpanded = [...sessions.values()].some(session => !session.minimized);
    const main = document.getElementById('pcMain');
    if (!main) return;
    if (hasExpanded && !scrollLocked) {
        main.dataset.pcDetailModalOverflow = main.style.overflow;
        main.style.overflow = 'hidden';
        scrollLocked = true;
    } else if (!hasExpanded && scrollLocked) {
        main.style.overflow = main.dataset.pcDetailModalOverflow || '';
        delete main.dataset.pcDetailModalOverflow;
        scrollLocked = false;
    }
}

function getHost() {
    let host = document.querySelector('.pc-prompt-detail-modal-host');
    if (host) return host;
    host = document.createElement('div');
    host.className = 'pc-prompt-detail-modal-host';
    host.innerHTML = '<div class="pc-prompt-detail-modal-backdrop" aria-hidden="true"></div><div class="pc-prompt-detail-modal-deck"></div><div class="pc-prompt-detail-minimized-tray" aria-label="已最小化的提示词详情"></div>';
    (document.getElementById('pcApp') || document.body).appendChild(host);
    return host;
}

function createPanel(id) {
    const panel = document.createElement('section');
    panel.className = 'pc-prompt-detail-modal';
    panel.dataset.promptId = id;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-labelledby', `pcPromptDetailModalTitle-${id}`);
    panel.tabIndex = -1;
    panel.innerHTML = `
        <div class="pc-prompt-detail-modal-actions">
            <button class="pc-prompt-detail-modal-minimize" type="button" aria-label="最小化提示词详情">−</button>
            <button class="pc-prompt-detail-modal-close" type="button" aria-label="关闭提示词详情">×</button>
        </div>
        <div class="pc-prompt-detail-modal-content"></div>
    `;
    return panel;
}

function activatePromptDetail(id, focus = false) {
    const session = sessions.get(id);
    if (!session || session.minimized) return;
    activeId = id;
    sessions.forEach(item => {
        const isActive = item.id === id;
        item.panel.classList.toggle('pc-prompt-detail-modal-active', isActive);
        item.panel.setAttribute('aria-modal', String(isActive));
    });
    if (focus) session.panel.focus({ preventScroll: true });
}

function syncDeck() {
    const expanded = [...sessions.values()].filter(session => !session.minimized);
    const host = document.querySelector('.pc-prompt-detail-modal-host');
    if (!host) return;
    host.classList.toggle('pc-prompt-detail-modal-host-dual', expanded.length === 2);
    host.classList.toggle('pc-prompt-detail-modal-host-active', expanded.length > 0);
    updateScrollLock();
}

function prefersReducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
}

function getMinimizedSessions() {
    return [...sessions.values()]
        .filter(session => session.minimized)
        .sort((first, second) => (second.minimizedAt || 0) - (first.minimizedAt || 0));
}

function closeMinimizedTray({ focus = false } = {}) {
    const tray = document.querySelector('.pc-prompt-detail-minimized-tray');
    const list = tray?.querySelector('.pc-prompt-detail-minimized-list');
    const button = tray?.querySelector('.pc-prompt-detail-minimized-button');
    if (!minimizedTrayOpen || !list) return;
    minimizedTrayOpen = false;
    button?.setAttribute('aria-expanded', 'false');
    if (prefersReducedMotion()) {
        list.remove();
    } else {
        gsap.to(list, {
            autoAlpha: 0,
            y: 6,
            duration: 0.14,
            ease: 'power2.in',
            overwrite: 'auto',
            onComplete: () => list.remove()
        });
    }
    if (focus) button?.focus({ preventScroll: true });
}

function renderMinimizedTrayList(tray, minimized) {
    const list = document.createElement('div');
    list.className = 'pc-prompt-detail-minimized-list';
    list.setAttribute('role', 'menu');
    list.setAttribute('aria-label', '已最小化的提示词详情');
    minimized.forEach(session => {
        const item = document.createElement('button');
        item.className = 'pc-prompt-detail-minimized-item';
        item.type = 'button';
        item.setAttribute('role', 'menuitem');
        item.dataset.promptId = session.id;
        item.title = `恢复：${session.title || '提示词详情'}`;
        item.setAttribute('aria-label', `恢复：${session.title || '提示词详情'}`);
        const label = document.createElement('span');
        label.className = 'pc-prompt-detail-minimized-item-label';
        label.textContent = session.title || '提示词详情';
        const icon = document.createElement('span');
        icon.className = 'pc-prompt-detail-minimized-item-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = '↗';
        item.append(label, icon);
        item.addEventListener('click', () => {
            closeMinimizedTray();
            restorePromptDetail(session.id);
        });
        list.appendChild(item);
    });
    tray.prepend(list);
    if (!prefersReducedMotion()) {
        gsap.fromTo(list, { autoAlpha: 0, y: 6 }, {
            autoAlpha: 1,
            y: 0,
            duration: 0.18,
            ease: 'power2.out',
            overwrite: 'auto',
            clearProps: 'transform,opacity,visibility'
        });
    }
    return list;
}

function toggleMinimizedTray() {
    const tray = document.querySelector('.pc-prompt-detail-minimized-tray');
    if (!tray) return;
    if (minimizedTrayOpen) {
        closeMinimizedTray();
        return;
    }
    const minimized = getMinimizedSessions();
    if (!minimized.length) return;
    minimizedTrayOpen = true;
    tray.querySelector('.pc-prompt-detail-minimized-button')?.setAttribute('aria-expanded', 'true');
    renderMinimizedTrayList(tray, minimized);
}

function syncMinimizedTray() {
    const tray = document.querySelector('.pc-prompt-detail-minimized-tray');
    if (!tray) return null;
    const minimized = getMinimizedSessions();
    if (!minimized.length) {
        minimizedTrayOpen = false;
        tray.replaceChildren();
        sessions.forEach(session => { session.minimizedButton = null; });
        return null;
    }
    sessions.forEach(session => { session.minimizedButton = null; });
    let button = tray.querySelector('.pc-prompt-detail-minimized-button');
    if (!button) {
        button = document.createElement('button');
        button.className = 'pc-prompt-detail-minimized-button';
        button.type = 'button';
        button.addEventListener('click', toggleMinimizedTray);
        tray.appendChild(button);
    }
    const latest = minimized[0];
    const count = minimized.length;
    button.replaceChildren();
    const icon = document.createElement('span');
    icon.className = 'pc-prompt-detail-minimized-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '▤';
    const label = document.createElement('span');
    label.className = 'pc-prompt-detail-minimized-label';
    label.textContent = latest.title || '提示词详情';
    const countBadge = document.createElement('span');
    countBadge.className = 'pc-prompt-detail-minimized-count';
    countBadge.textContent = String(count);
    countBadge.setAttribute('aria-hidden', 'true');
    button.append(icon, label, countBadge);
    button.title = `查看已最小化的提示词详情，共 ${count} 项`;
    button.setAttribute('aria-label', `查看已最小化的提示词详情，共 ${count} 项，最近一项为 ${latest.title || '提示词详情'}`);
    button.setAttribute('aria-expanded', String(minimizedTrayOpen));
    if (minimizedTrayOpen) {
        tray.querySelector('.pc-prompt-detail-minimized-list')?.remove();
        renderMinimizedTrayList(tray, minimized);
    }
    minimized.forEach(session => { session.minimizedButton = button; });
    return button;
}

async function minimizePromptDetail(id) {
    const session = sessions.get(id);
    if (!session || session.minimized || session.transitioning) return;
    session.transitioning = true;
    session.timeline?.kill();
    const finalize = () => {
        session.minimized = true;
        session.minimizedAt = Date.now();
        session.panel.classList.add('pc-prompt-detail-modal-minimized');
        gsap.set(session.panel, { clearProps: 'transform,opacity,visibility' });
        gsap.set(session.content, { clearProps: 'transform,opacity,visibility' });
        const button = syncMinimizedTray();
        const next = [...sessions.values()].find(item => !item.minimized && item.id !== id);
        activatePromptDetail(next?.id || null, Boolean(next));
        syncDeck();
        session.transitioning = false;
        if (!prefersReducedMotion() && button) {
            gsap.fromTo(button, { autoAlpha: 0, y: 8, scale: 0.96 }, {
                autoAlpha: 1,
                y: 0,
                scale: 1.05,
                duration: 0.18,
                ease: 'back.out(1.25)',
                overwrite: 'auto',
                clearProps: 'transform,opacity,visibility'
            });
        }
    };
    if (prefersReducedMotion()) {
        finalize();
        return;
    }
    gsap.set(session.panel, { transformOrigin: '100% 100%' });
    await new Promise(resolve => {
        session.timeline = gsap.timeline({ onComplete: resolve });
        session.timeline
            .to(session.content, { autoAlpha: 0, y: -6, duration: 0.12, ease: 'power2.out', overwrite: 'auto' })
            .to(session.panel, {
                autoAlpha: 0,
                x: 120,
                y: 100,
                scale: 0.82,
                duration: 0.30,
                ease: 'power3.inOut',
                overwrite: 'auto'
            });
    });
    finalize();
}

async function restorePromptDetail(id) {
    const session = sessions.get(id);
    if (!session || !session.minimized || session.transitioning) return;
    session.transitioning = true;
    const expanded = [...sessions.values()].filter(item => !item.minimized);
    if (expanded.length >= 2) await minimizePromptDetail(expanded[0].id);
    session.minimized = false;
    session.minimizedAt = null;
    session.panel.classList.remove('pc-prompt-detail-modal-minimized');
    syncMinimizedTray();
    syncDeck();
    if (prefersReducedMotion()) {
        activatePromptDetail(id, true);
        session.transitioning = false;
        return;
    }
    gsap.set(session.panel, { transformOrigin: '100% 100%', autoAlpha: 0, x: 120, y: 100, scale: 0.82 });
    gsap.set(session.content, { autoAlpha: 0, y: -6 });
    await new Promise(resolve => {
        session.timeline = gsap.timeline({ onComplete: resolve });
        session.timeline
            .to(session.panel, {
                autoAlpha: 1,
                x: 0,
                y: 0,
                scale: 1,
                duration: 0.30,
                ease: 'power3.out',
                overwrite: 'auto'
            })
            .to(session.content, {
                autoAlpha: 1,
                y: 0,
                duration: 0.12,
                ease: 'power2.out',
                overwrite: 'auto',
                clearProps: 'transform,opacity,visibility'
            }, 0.18)
            .set(session.panel, { clearProps: 'transform,opacity,visibility' });
    });
    activatePromptDetail(id, true);
    session.transitioning = false;
}

async function closePromptDetail(target = activeId, options = {}) {
    if (typeof target === 'object') options = target;
    const id = typeof target === 'object' ? activeId : target;
    const session = sessions.get(id);
    if (!session || session.closing || session.transitioning) return;
    session.closing = true;
    session.timeline?.kill();
    if (!prefersReducedMotion() && !session.minimized) {
        const returnTarget = getReturnTarget(session.panel, session.triggerElement);
        const content = session.content;
        const isLastExpanded = [...sessions.values()].filter(item => !item.minimized).length === 1;
        const backdrop = isLastExpanded ? document.querySelector('.pc-prompt-detail-modal-backdrop') : null;
        gsap.set(session.panel, { transformOrigin: '50% 50%' });
        await new Promise(resolve => {
            const timeline = gsap.timeline({ onComplete: resolve });
            timeline.to(content, { autoAlpha: 0, duration: 0.14, ease: 'power2.out' }, 0)
                .to(session.panel, {
                    autoAlpha: 0,
                    x: returnTarget?.x || 0,
                    y: returnTarget?.y || 0,
                    scale: returnTarget ? 0.18 : 0.96,
                    duration: returnTarget ? 0.28 : 0.18,
                    ease: returnTarget ? 'power3.inOut' : 'power2.in'
                }, 0.08);
            if (backdrop) timeline.to(backdrop, { autoAlpha: 0, duration: 0.24, ease: 'power2.out' }, 0.08);
        });
    }
    unmount(session.content);
    session.panel.remove();
    sessions.delete(id);
    syncMinimizedTray();
    const next = [...sessions.values()].find(item => !item.minimized);
    activatePromptDetail(next?.id || null, Boolean(next));
    syncDeck();
    if (options.restoreFocus !== false) restoreTriggerFocus(session.triggerElement);
    session.onChanged?.();
    if (sessions.size === 0) document.querySelector('.pc-prompt-detail-modal-host')?.remove();
}

function minimizeAllPromptDetails() {
    [...sessions.values()]
        .filter(session => !session.minimized)
        .forEach(session => minimizePromptDetail(session.id));
}

async function openPromptDetail(id, options = {}) {
    if (!id) return;
    const existing = sessions.get(id);
    if (existing) {
        if (existing.minimized) restorePromptDetail(id);
        else activatePromptDetail(id, true);
        return;
    }
    const expanded = [...sessions.values()].filter(session => !session.minimized);
    if (expanded.length >= 2) await minimizePromptDetail(expanded[0].id);
    const host = getHost();
    const panel = createPanel(id);
    const content = panel.querySelector('.pc-prompt-detail-modal-content');
    const session = { id, panel, content, triggerElement: options.triggerElement || document.activeElement, onChanged: options.onChanged, title: '', minimized: false, minimizedAt: null, minimizedButton: null, timeline: null, closing: false, transitioning: false };
    sessions.set(id, session);
    host.querySelector('.pc-prompt-detail-modal-deck').appendChild(panel);
    content.innerHTML = render({ id });
    content.querySelector('.pc-detail-page-title')?.setAttribute('id', `pcPromptDetailModalTitle-${id}`);
    await mount(content, { id, onEdit: minimizeAllPromptDetails });
    content.querySelector('.pc-detail-breadcrumb')?.remove();
    session.title = content.querySelector('.pc-detail-page-name')?.textContent?.trim() || '提示词详情';
    panel.querySelector('.pc-prompt-detail-modal-close').addEventListener('click', () => closePromptDetail(id));
    panel.querySelector('.pc-prompt-detail-modal-minimize').addEventListener('click', () => minimizePromptDetail(id));
    panel.addEventListener('pointerdown', () => activatePromptDetail(id));
    activatePromptDetail(id);
    syncDeck();
    if (!prefersReducedMotion()) session.timeline = gsap.fromTo(panel, { autoAlpha: 0, scale: 0.97 }, { autoAlpha: 1, scale: 1, duration: 0.28, ease: 'power3.out' });
    requestAnimationFrame(() => panel.querySelector('.pc-prompt-detail-modal-minimize')?.focus());
}

document.addEventListener('keydown', event => {
    if (minimizedTrayOpen) {
        const tray = document.querySelector('.pc-prompt-detail-minimized-tray');
        const button = tray?.querySelector('.pc-prompt-detail-minimized-button');
        const items = [...(tray?.querySelectorAll('.pc-prompt-detail-minimized-item') || [])];
        if (event.key === 'Escape') {
            event.preventDefault();
            closeMinimizedTray({ focus: true });
            return;
        }
        if (event.key === 'ArrowDown' && document.activeElement === button && items.length) {
            event.preventDefault();
            items[0].focus();
            return;
        }
    }
    const session = sessions.get(activeId);
    if (!session) return;
    if (event.key === 'Escape') {
        event.preventDefault();
        closePromptDetail(activeId);
        return;
    }
    if (event.key !== 'Tab') return;
    const focusable = getFocusableElements(session.panel);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}, true);

document.addEventListener('pointerdown', event => {
    const tray = document.querySelector('.pc-prompt-detail-minimized-tray');
    if (minimizedTrayOpen && tray && !tray.contains(event.target)) closeMinimizedTray();
}, true);

export { openPromptDetail, closePromptDetail };
