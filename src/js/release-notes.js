import { closeModal, showModal, showToast } from './pc-utils.js';
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
    } catch (e) {
        return false;
    }
    return true;
}

function syncReleaseNotesUnreadBadge(container = document) {
    const button = container.querySelector?.('[data-release-notes]');
    if (!button) return;
    const isUnread = hasUnreadReleaseNotes();
    button.classList.toggle('pc-release-notes-unread', isUnread);
    button.setAttribute('aria-label', isUnread ? '更新记录，有未读更新' : '更新记录');
    button.setAttribute('title', isUnread ? '更新记录（有未读更新）' : '更新记录');
}

function renderReleaseSections(note) {
    return note.sections.map(section => `
        <section class="pc-release-section">
            <h4 class="pc-release-section-title">
                <span class="pc-release-section-dot pc-release-section-dot-${section.tone}" aria-hidden="true"></span>
                ${section.title}
            </h4>
            <ul class="pc-release-list">
                ${section.items.map(item => `<li>${item}</li>`).join('')}
            </ul>
        </section>
    `).join('');
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
            <div class="pc-release-notes-scroll">
                ${RELEASE_NOTES.map((note, index) => `
                    <article class="pc-release-card ${note.version === currentVersion ? 'pc-release-card-current' : ''}">
                        <div class="pc-release-card-head">
                            <div class="pc-release-version-wrap">
                                <span class="pc-release-version">v${note.version}</span>
                                ${note.version === currentVersion ? '<span class="pc-release-current-label">当前版本</span>' : ''}
                            </div>
                            <time datetime="${note.date}">${note.date}</time>
                        </div>
                        ${renderReleaseSections(note)}
                    </article>
                `).join('')}
            </div>
            <footer class="pc-release-notes-actions">
                ${hasUnreadReleaseNotes() ? `
                    <button class="pc-btn pc-btn-secondary" type="button" data-release-later>稍后查看</button>
                    <button class="pc-btn pc-btn-primary" type="button" data-release-acknowledge>我知道了</button>
                ` : '<button class="pc-btn pc-btn-primary" type="button" data-release-close>关闭</button>'}
            </footer>
        </div>
    `;
}

function openReleaseNotes() {
    const modal = showModal(renderReleaseNotes());
    const closeButtons = modal.querySelectorAll('[data-release-close], [data-release-later]');
    closeButtons.forEach(button => button.addEventListener('click', closeModal));
    modal.querySelector('[data-release-acknowledge]')?.addEventListener('click', () => {
        markCurrentReleaseNotesSeen();
        syncReleaseNotesUnreadBadge();
        closeModal();
        showToast(`已阅读 v${getVersion()} 更新记录`);
    });
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
