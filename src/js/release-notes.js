import { closeModal, showModal } from './pc-utils.js';
import { getVersion } from './version-info.js';
import { RELEASE_NOTES } from './release-notes-data.js';

const LAST_SEEN_VERSION_KEY = 'pc-release-notes-last-seen-version';

function getCurrentReleaseNote() {
    const version = getVersion();
    return RELEASE_NOTES.find(note => note.version === version) || null;
}

function getLastSeenVersion() {
    try {
        return localStorage.getItem(LAST_SEEN_VERSION_KEY) || '';
    } catch (e) {
        return '';
    }
}

function hasUnreadReleaseNotes() {
    return Boolean(getCurrentReleaseNote()) && getLastSeenVersion() !== getVersion();
}

function markCurrentReleaseNotesSeen() {
    try {
        localStorage.setItem(LAST_SEEN_VERSION_KEY, getVersion());
        return true;
    } catch (e) {
        return false;
    }
}

function syncReleaseNotesUnreadBadge(container = document) {
    const button = container.querySelector?.('[data-release-notes]');
    if (!button) return;
    const isUnread = hasUnreadReleaseNotes();
    button.classList.toggle('pc-release-notes-unread', isUnread);
    button.setAttribute('aria-label', isUnread ? '更新记录，有未读更新' : '更新记录');
    button.setAttribute('title', isUnread ? '更新记录（有未读更新）' : '更新记录');
}

function prefersReducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
}

function versionStepId(version) {
    return `pc-release-step-${version}`;
}

function renderReleaseSteps(note) {
    return note.sections.map(section => `
        <div class="pc-release-step" data-step-tone="${section.tone}">
            <div class="pc-release-step-head">
                <span class="pc-release-section-dot pc-release-section-dot-${section.tone}" aria-hidden="true"></span>
                <h4 class="pc-release-section-title">${section.title}</h4>
            </div>
            <ul class="pc-release-list">
                ${section.items.map(item => `<li>${item}</li>`).join('')}
            </ul>
        </div>
    `).join('');
}

function renderReleasePhase(note, currentVersion) {
    const isCurrent = note.version === currentVersion;
    return `
        <article
            class="pc-release-phase${isCurrent ? ' pc-release-phase-current' : ''}"
            id="pc-release-phase-${note.version}"
            data-phase-version="${note.version}"
            data-step-id="${versionStepId(note.version)}"
            data-step-title="v${note.version}${isCurrent ? ' · 当前版本' : ''}"
        >
            <header class="pc-release-phase-head">
                <div class="pc-release-phase-title">
                    <span class="pc-release-version">v${note.version}</span>
                    ${isCurrent ? '<span class="pc-release-current-label">当前版本</span>' : ''}
                </div>
                <time datetime="${note.date}">${note.date}</time>
            </header>
            <div class="pc-release-phase-body">
                ${renderReleaseSteps(note)}
            </div>
        </article>
    `;
}

function renderPhaseRail(currentVersion) {
    return RELEASE_NOTES.map(note => {
        const isCurrent = note.version === currentVersion;
        const label = `v${note.version}${isCurrent ? ' · 当前版本' : ''}`;
        return `
            <button
                type="button"
                class="pc-release-phase-tick${isCurrent ? ' is-current' : ''}"
                data-step-id="${versionStepId(note.version)}"
                data-phase-target="${note.version}"
                data-step-label="${label}"
                data-step-sub="${note.date}"
                aria-label="跳转到 ${label}"
                ${isCurrent ? 'aria-current="true"' : ''}
            >
                <span class="pc-release-phase-tick-mark" aria-hidden="true"></span>
            </button>
        `;
    }).join('');
}

function renderReleaseNotes() {
    const currentVersion = getVersion();
    return `
        <div class="pc-release-notes" role="dialog" aria-modal="true" aria-labelledby="pcReleaseNotesTitle">
            <header class="pc-release-notes-head">
                <div>
                    <span class="pc-release-notes-eyebrow">提示词管家</span>
                    <h3 id="pcReleaseNotesTitle">更新记录</h3>
                </div>
                <button class="pc-release-close" type="button" data-release-close aria-label="关闭更新记录" title="关闭">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"></path></svg>
                </button>
            </header>
            <div class="pc-release-notes-body">
                <nav class="pc-release-phase-rail" aria-label="版本导航">
                    ${renderPhaseRail(currentVersion)}
                </nav>
                <div class="pc-release-notes-scroll" tabindex="0">
                    ${RELEASE_NOTES.map(note => renderReleasePhase(note, currentVersion)).join('')}
                </div>
                <div class="pc-release-phase-tooltip" role="tooltip" hidden>
                    <div class="pc-release-phase-tooltip-title"></div>
                    <div class="pc-release-phase-tooltip-sub"></div>
                    <div class="pc-release-phase-tooltip-meta"></div>
                </div>
            </div>
            <footer class="pc-release-notes-actions">
                <button class="pc-btn pc-btn-primary" type="button" data-release-close>关闭</button>
            </footer>
        </div>
    `;
}

function bindPhaseRail(modal) {
    const scroll = modal.querySelector('.pc-release-notes-scroll');
    const rail = modal.querySelector('.pc-release-phase-rail');
    const body = modal.querySelector('.pc-release-notes-body');
    const tooltip = modal.querySelector('.pc-release-phase-tooltip');
    if (!scroll || !rail || !body) return;

    const ticks = Array.from(rail.querySelectorAll('.pc-release-phase-tick'));
    const phases = Array.from(modal.querySelectorAll('.pc-release-phase'));
    let hideTimer = 0;

    ticks.forEach(tick => {
        if (tick.classList.contains('is-current')) {
            tick.dataset.phaseIsCurrent = 'true';
        }
    });

    function setActiveVersion(stepId) {
        if (!stepId) return;
        ticks.forEach(tick => {
            const active = tick.dataset.stepId === stepId;
            const isAppCurrent = tick.dataset.phaseIsCurrent === 'true';
            tick.classList.toggle('is-active', active);
            tick.classList.toggle('is-current', isAppCurrent);
            if (isAppCurrent) tick.setAttribute('aria-current', 'true');
            else if (active) tick.setAttribute('aria-current', 'location');
            else tick.removeAttribute('aria-current');
        });
        phases.forEach(phase => {
            phase.classList.toggle('is-active', phase.dataset.stepId === stepId);
        });
    }

    function showTooltip(tick) {
        if (!tooltip) return;
        window.clearTimeout(hideTimer);
        tooltip.hidden = false;
        tooltip.querySelector('.pc-release-phase-tooltip-title').textContent = tick.dataset.stepLabel || '';
        tooltip.querySelector('.pc-release-phase-tooltip-sub').textContent = tick.dataset.stepSub || '';
        tooltip.querySelector('.pc-release-phase-tooltip-meta').textContent = '更新版本';

        const bodyRect = body.getBoundingClientRect();
        const tickRect = tick.getBoundingClientRect();
        const railWidth = rail.getBoundingClientRect().width;
        const tipWidth = tooltip.offsetWidth || 160;
        const tipHeight = tooltip.offsetHeight || 56;
        const top = tickRect.top - bodyRect.top + tickRect.height / 2 - tipHeight / 2;
        tooltip.style.top = `${Math.max(8, Math.min(top, Math.max(8, bodyRect.height - tipHeight - 8)))}px`;
        tooltip.style.left = `${Math.min(railWidth + 8, Math.max(8, bodyRect.width - tipWidth - 8))}px`;
        tooltip.classList.add('is-visible');
    }

    function hideTooltip() {
        if (!tooltip) return;
        hideTimer = window.setTimeout(() => {
            tooltip.classList.remove('is-visible');
            tooltip.hidden = true;
        }, 80);
    }

    ticks.forEach(tick => {
        tick.addEventListener('click', () => {
            const stepId = tick.dataset.stepId;
            const phase = phases.find(item => item.dataset.stepId === stepId);
            if (!phase) return;
            phase.scrollIntoView({
                behavior: prefersReducedMotion() ? 'auto' : 'smooth',
                block: 'start'
            });
            setActiveVersion(stepId);
        });
        tick.addEventListener('pointerenter', () => {
            tick.classList.add('is-hot');
            const phase = phases.find(item => item.dataset.stepId === tick.dataset.stepId);
            phase?.classList.add('is-hot');
            showTooltip(tick);
        });
        tick.addEventListener('pointerleave', () => {
            tick.classList.remove('is-hot');
            phases.forEach(phase => phase.classList.remove('is-hot'));
            hideTooltip();
        });
        tick.addEventListener('focus', () => {
            tick.classList.add('is-hot');
            showTooltip(tick);
        });
        tick.addEventListener('blur', () => {
            tick.classList.remove('is-hot');
            hideTooltip();
        });
    });

    phases.forEach(phase => {
        phase.addEventListener('pointerenter', () => {
            const stepId = phase.dataset.stepId;
            phase.classList.add('is-hot');
            ticks.forEach(tick => {
                tick.classList.toggle('is-hot', tick.dataset.stepId === stepId);
            });
        });
        phase.addEventListener('pointerleave', () => {
            phase.classList.remove('is-hot');
            ticks.forEach(tick => tick.classList.remove('is-hot'));
        });
    });

    if (!('IntersectionObserver' in window)) {
        setActiveVersion(phases[0]?.dataset.stepId);
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        const visible = entries
            .filter(entry => entry.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (!visible) return;
        setActiveVersion(visible.target.dataset.stepId);
    }, {
        root: scroll,
        threshold: [0.25, 0.5, 0.7],
        rootMargin: '0px 0px -25% 0px'
    });

    phases.forEach(phase => observer.observe(phase));
    setActiveVersion(phases[0]?.dataset.stepId);
}

function openReleaseNotes() {
    markCurrentReleaseNotesSeen();
    syncReleaseNotesUnreadBadge();
    const modal = showModal(renderReleaseNotes());
    const closeButtons = modal.querySelectorAll('[data-release-close]');
    closeButtons.forEach(button => button.addEventListener('click', closeModal));
    bindPhaseRail(modal);
    modal.querySelector('[data-release-close]')?.focus();
    return modal;
}

function showUnreadReleaseNotes() {
    syncReleaseNotesUnreadBadge();
    if (hasUnreadReleaseNotes()) openReleaseNotes();
}

export {
    LAST_SEEN_VERSION_KEY,
    getCurrentReleaseNote,
    hasUnreadReleaseNotes,
    markCurrentReleaseNotesSeen,
    openReleaseNotes,
    showUnreadReleaseNotes,
    syncReleaseNotesUnreadBadge
};
