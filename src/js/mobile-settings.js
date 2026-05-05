import { getStorage } from './storage.js';
import { showMobileToast, showActionSheet } from './mobile-utils.js';
import corgiSettings from '../assets/mobile/mascots/corgi-settings.png';

let isDarkMode = false;
let isFollowSystem = true;
let selectedThemeColor = 0;

const THEME_COLORS = [
    { color: '#FF6F9F', label: '粉' },
    { color: '#72D879', label: '绿' },
    { color: '#2D9CFF', label: '蓝' },
    { color: '#B99CFF', label: '紫' },
    { color: '#FFD15C', label: '橙' },
];

function render(params = {}) {
    return `
        <div class="m-top-nav">
            <span class="m-top-nav-title">设置</span>
        </div>
        <div class="m-page-inner">
            <div class="m-mascot-banner m-section-gap m-fade-in">
                <img class="m-mascot-img" src="${corgiSettings}" alt="柯基助手">
                <div class="m-mascot-bubble">
                    <div style="font-weight:600; margin-bottom:4px;">一切数据仅在本地</div>
                    <div style="font-size:14px; color:var(--m-text2);">安全又放心~</div>
                </div>
            </div>

            <div class="m-section-gap">
                <div class="m-section-title">
                    <span class="m-section-title-text">外观设置</span>
                </div>
                <div class="m-settings-card">
                    <div class="m-settings-row">
                        <div class="m-settings-row-left">
                            <span class="m-settings-row-icon">🌙</span>
                            <span>深色模式</span>
                        </div>
                        <button class="m-toggle ${isDarkMode ? 'm-toggle-on' : ''}" id="mDarkModeToggle">
                            <div class="m-toggle-knob"></div>
                        </button>
                    </div>
                    <div class="m-settings-row">
                        <div class="m-settings-row-left">
                            <span class="m-settings-row-icon">🎨</span>
                            <span>应用主题色</span>
                        </div>
                        <div class="m-theme-dots" id="mThemeDots">
                            ${THEME_COLORS.map((c, idx) => `
                                <button class="m-theme-dot ${idx === selectedThemeColor ? 'm-theme-active' : ''}" data-color-idx="${idx}" style="background: ${c.color};" title="${c.label}"></button>
                            `).join('')}
                        </div>
                    </div>
                    <div class="m-settings-row">
                        <div class="m-settings-row-left">
                            <span class="m-settings-row-icon">🖥</span>
                            <span>跟随系统</span>
                        </div>
                        <button class="m-toggle ${isFollowSystem ? 'm-toggle-on' : ''}" id="mFollowSystemToggle">
                            <div class="m-toggle-knob"></div>
                        </button>
                    </div>
                </div>
            </div>

            <div class="m-section-gap">
                <div class="m-section-title">
                    <span class="m-section-title-text">本地存储</span>
                </div>
                <div class="m-storage-grid">
                    <div class="m-storage-card m-storage-blue m-fade-in">
                        <span class="m-storage-value">128 MB</span>
                        <span class="m-storage-label">本地数据大小</span>
                    </div>
                    <div class="m-storage-card m-storage-white m-fade-in">
                        <span class="m-storage-value">45.6 GB</span>
                        <span class="m-storage-label">可用 / 64 GB</span>
                    </div>
                </div>
            </div>

            <div class="m-section-gap">
                <div class="m-section-title">
                    <span class="m-section-title-text">数据备份与恢复</span>
                </div>
                <div class="m-backup-grid">
                    <button class="m-backup-card m-backup-green" id="mLocalBackup">
                        <span class="m-backup-icon">💾</span>
                        <span class="m-backup-label">本地备份</span>
                        <span class="m-backup-desc">导出所有数据</span>
                    </button>
                    <button class="m-backup-card m-backup-blue" id="mImportData">
                        <span class="m-backup-icon">📥</span>
                        <span class="m-backup-label">导入数据</span>
                        <span class="m-backup-desc">从备份文件恢复</span>
                    </button>
                    <button class="m-backup-card m-backup-purple" id="mExportJson">
                        <span class="m-backup-icon">📤</span>
                        <span class="m-backup-label">导出JSON</span>
                        <span class="m-backup-desc">导出为.json</span>
                    </button>
                    <button class="m-backup-card m-backup-orange" id="mImportJson">
                        <span class="m-backup-icon">📂</span>
                        <span class="m-backup-label">从JSON导入</span>
                        <span class="m-backup-desc">从.json文件导入</span>
                    </button>
                </div>
            </div>

            <div style="margin-top: var(--m-space-xl);">
                <div class="m-security-bar" id="mSecurityBar">
                    <span class="m-security-icon">🔒</span>
                    <span>本应用完全本地运行，不联网，不收集任何数据。</span>
                </div>
            </div>
        </div>
    `;
}

async function mount(pageEl, params = {}) {
    isDarkMode = document.documentElement.getAttribute('data-theme') !== 'light';
    isFollowSystem = !localStorage.getItem('theme');
    setupSettingsEvents(pageEl);
}

function setupSettingsEvents(pageEl) {
    pageEl.querySelector('#mDarkModeToggle')?.addEventListener('click', () => {
        isDarkMode = !isDarkMode;
        const toggle = pageEl.querySelector('#mDarkModeToggle');
        if (toggle) toggle.classList.toggle('m-toggle-on', isDarkMode);

        if (isDarkMode) {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
        }
    });

    pageEl.querySelector('#mFollowSystemToggle')?.addEventListener('click', () => {
        isFollowSystem = !isFollowSystem;
        const toggle = pageEl.querySelector('#mFollowSystemToggle');
        if (toggle) toggle.classList.toggle('m-toggle-on', isFollowSystem);

        if (isFollowSystem) {
            localStorage.removeItem('theme');
            if (window.matchMedia('(prefers-color-scheme: light)').matches) {
                document.documentElement.setAttribute('data-theme', 'light');
            } else {
                document.documentElement.removeAttribute('data-theme');
            }
        }
    });

    pageEl.querySelector('#mThemeDots')?.addEventListener('click', (e) => {
        const dot = e.target.closest('.m-theme-dot');
        if (!dot) return;
        selectedThemeColor = parseInt(dot.dataset.colorIdx);
        pageEl.querySelectorAll('.m-theme-dot').forEach(d => d.classList.remove('m-theme-active'));
        dot.classList.add('m-theme-active');
        showMobileToast('主题色功能开发中');
    });

    pageEl.querySelector('#mLocalBackup')?.addEventListener('click', handleExport);
    pageEl.querySelector('#mExportJson')?.addEventListener('click', handleExport);

    pageEl.querySelector('#mImportData')?.addEventListener('click', handleImport);
    pageEl.querySelector('#mImportJson')?.addEventListener('click', handleImport);

    pageEl.querySelector('#mSecurityBar')?.addEventListener('click', () => {
        showActionSheet([
            { action: 'info', icon: '🔒', label: '数据安全说明', handler: () => showMobileToast('所有数据仅存储在您的设备本地，不会上传到任何服务器') },
        ]);
    });
}

async function handleExport() {
    try {
        const data = await getStorage().exportData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `prompt-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showMobileToast('导出成功');
    } catch (e) {
        showMobileToast('导出失败，请重试', 'error');
    }
}

function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            const result = await getStorage().importData(Array.isArray(data) ? data : [data]);
            showMobileToast(`导入成功，共 ${result.imported} 条`);
        } catch (err) {
            showMobileToast('导入失败，文件格式不正确', 'error');
        }
    };
    input.click();
}

function unmount(pageEl) {}

export { render, mount, unmount };
