import { getStorage } from './storage.js';
import { showMobileToast, showActionSheet } from './mobile-utils.js';
import corgiSettings from '../assets/mobile/mascots/corgi-settings.png';

let selectedThemeColor = 0;

const THEME_COLORS = [
    { color: '#FF6F9F', label: '粉', accent: 'pink' },
    { color: '#72D879', label: '绿', accent: 'green' },
    { color: '#2D9CFF', label: '蓝', accent: 'blue' },
    { color: '#B99CFF', label: '紫', accent: 'purple' },
    { color: '#FFD15C', label: '橙', accent: 'yellow' },
];

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

async function calculateLocalDataSize() {
    try {
        const data = await getStorage().exportData();
        const jsonStr = JSON.stringify(data);
        const bytes = new Blob([jsonStr]).size;
        return formatBytes(bytes);
    } catch (e) {
        return '计算失败';
    }
}

async function getStorageInfo() {
    if (navigator.storage && navigator.storage.estimate) {
        try {
            const estimate = await navigator.storage.estimate();
            return {
                used: formatBytes(estimate.usage || 0),
                quota: formatBytes(estimate.quota || 0),
                usedPercent: estimate.quota ? Math.round((estimate.usage / estimate.quota) * 100) : 0,
            };
        } catch (e) {
            return { used: '未知', quota: '未知', usedPercent: 0 };
        }
    }
    return { used: '未知', quota: '未知', usedPercent: 0 };
}

function render(params = {}) {
    const storedAccent = localStorage.getItem('accent') || 'pink';
    selectedThemeColor = THEME_COLORS.findIndex(c => c.accent === storedAccent);
    if (selectedThemeColor < 0) selectedThemeColor = 0;

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
                            <span class="m-settings-row-icon">🎨</span>
                            <span>应用主题色</span>
                        </div>
                        <div class="m-theme-dots" id="mThemeDots">
                            ${THEME_COLORS.map((c, idx) => `
                                <button class="m-theme-dot ${idx === selectedThemeColor ? 'm-theme-active' : ''}" data-color-idx="${idx}" style="background: ${c.color};" title="${c.label}"></button>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>

            <div class="m-section-gap">
                <div class="m-section-title">
                    <span class="m-section-title-text">本地存储</span>
                </div>
                <div class="m-storage-grid">
                    <div class="m-storage-card m-storage-blue m-fade-in">
                        <span class="m-storage-value" id="mDataSize">计算中...</span>
                        <span class="m-storage-label">本地数据大小</span>
                    </div>
                    <div class="m-storage-card m-storage-white m-fade-in">
                        <div class="m-storage-ring" id="mStorageRing" style="--ring-percent: 0%">
                            <span class="m-storage-ring-value" id="mStoragePercent">0%</span>
                        </div>
                        <span class="m-storage-label" id="mStorageQuota">可用 / 未知</span>
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
                </div>
            </div>

            <div style="margin-top: var(--m-space-xl);">
                <div class="m-security-bar" id="mSecurityBar">
                    <span class="m-security-icon">🔒</span>
                    <span class="m-security-text">本应用完全本地运行，不联网，不收集任何数据。</span>
                    <span class="m-security-arrow">›</span>
                </div>
            </div>
        </div>
    `;
}

async function mount(pageEl, params = {}) {
    const storedAccent = localStorage.getItem('accent') || 'pink';
    selectedThemeColor = THEME_COLORS.findIndex(c => c.accent === storedAccent);
    if (selectedThemeColor < 0) selectedThemeColor = 0;
    document.querySelector('.mobile-app')?.setAttribute('data-accent', THEME_COLORS[selectedThemeColor].accent);

    setupSettingsEvents(pageEl);
    loadStorageInfo(pageEl);
}

function setupSettingsEvents(pageEl) {
    pageEl.querySelector('#mThemeDots')?.addEventListener('click', (e) => {
        const dot = e.target.closest('.m-theme-dot');
        if (!dot) return;
        selectedThemeColor = parseInt(dot.dataset.colorIdx);
        const accent = THEME_COLORS[selectedThemeColor].accent;
        localStorage.setItem('accent', accent);
        document.querySelector('.mobile-app')?.setAttribute('data-accent', accent);
        pageEl.querySelectorAll('.m-theme-dot').forEach(d => d.classList.remove('m-theme-active'));
        dot.classList.add('m-theme-active');
        showMobileToast(`已切换为${THEME_COLORS[selectedThemeColor].label}色主题`);
    });

    pageEl.querySelector('#mLocalBackup')?.addEventListener('click', handleExport);
    pageEl.querySelector('#mImportData')?.addEventListener('click', handleImport);

    pageEl.querySelector('#mSecurityBar')?.addEventListener('click', () => {
        showActionSheet([
            { action: 'info', icon: '🔒', label: '数据安全说明', handler: () => {} },
            { action: 'detail1', icon: '📱', label: '所有数据仅存储在您的设备本地', handler: () => {} },
            { action: 'detail2', icon: '🚫', label: '不会上传到任何服务器', handler: () => {} },
            { action: 'detail3', icon: '🔐', label: '不收集任何个人隐私数据', handler: () => {} },
        ]);
    });
}

async function loadStorageInfo(pageEl) {
    const [dataSize, storageInfo] = await Promise.all([
        calculateLocalDataSize(),
        getStorageInfo(),
    ]);

    const sizeEl = pageEl.querySelector('#mDataSize');
    if (sizeEl) sizeEl.textContent = dataSize;

    const ringEl = pageEl.querySelector('#mStorageRing');
    if (ringEl) ringEl.style.setProperty('--ring-percent', storageInfo.usedPercent + '%');

    const percentEl = pageEl.querySelector('#mStoragePercent');
    if (percentEl) percentEl.textContent = storageInfo.usedPercent + '%';

    const quotaEl = pageEl.querySelector('#mStorageQuota');
    if (quotaEl) quotaEl.textContent = `可用 ${storageInfo.quota}`;
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
        const size = formatBytes(blob.size);
        showMobileToast(`导出成功（${size}）`);
    } catch (e) {
        showMobileToast('导出失败，请重试', 'error');
    }
}

function handleImport() {
    showActionSheet([
        {
            action: 'confirm',
            icon: '⚠️',
            label: '确认导入（将与现有数据合并）',
            handler: () => {
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
        },
        {
            action: 'cancel',
            icon: '❌',
            label: '取消',
            handler: () => {}
        }
    ]);
}

function unmount(pageEl) {}

export { render, mount, unmount };
