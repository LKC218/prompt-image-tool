import { getStorage } from './storage.js';
import { showMobileToast, showActionSheet } from './mobile-utils.js';
import { LanScanner, LanSync } from './lan-sync.js';
import { buildExportSuccessMessage, exportBackup, getErrorMessage } from './backup-utils.js';
import corgiSettings from '../assets/mobile/mascots/corgi-settings.png';

let selectedThemeColor = 0;
let lanScanner = null;
let lanSync = null;

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

            <div class="m-section-gap">
                <div class="m-section-title">
                    <span class="m-section-title-text">局域网同步</span>
                </div>
                <div class="m-settings-card m-lan-sync-card">
                    <div class="m-lan-sync-status" id="mLanSyncStatus" role="status">从同一局域网内的 PC 端拉取完整数据，遇到同 ID 记录会以 PC 端为准覆盖本机。</div>
                    <div class="m-lan-sync-actions">
                        <button class="m-lan-sync-btn m-lan-sync-primary" id="mScanLanBtn">扫描 PC</button>
                        <button class="m-lan-sync-btn" id="mTestLanBtn">测试连接</button>
                    </div>
                    <div class="m-lan-sync-input-row">
                        <input class="m-lan-sync-input" id="mLanIpInput" type="text" inputmode="decimal" placeholder="输入 PC IP，如 192.168.1.100">
                        <button class="m-lan-sync-btn m-lan-sync-primary" id="mStartLanSyncBtn">同步</button>
                    </div>
                    <div class="m-lan-device-list" id="mLanDeviceList"></div>
                    <div class="m-lan-progress" id="mLanProgress" hidden>
                        <div class="m-lan-progress-bar">
                            <div class="m-lan-progress-fill" id="mLanProgressFill" style="width:0%"></div>
                        </div>
                        <div class="m-lan-progress-text" id="mLanProgressText">准备中...</div>
                    </div>
                    <div class="m-lan-report" id="mLanReport"></div>
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
    pageEl.querySelector('#mScanLanBtn')?.addEventListener('click', () => handleLanScan(pageEl));
    pageEl.querySelector('#mTestLanBtn')?.addEventListener('click', () => handleLanTest(pageEl));
    pageEl.querySelector('#mStartLanSyncBtn')?.addEventListener('click', () => handleLanSync(pageEl));
    pageEl.querySelector('#mLanDeviceList')?.addEventListener('click', (e) => {
        const item = e.target.closest('.m-lan-device-item');
        if (!item) return;
        const input = pageEl.querySelector('#mLanIpInput');
        if (input) input.value = item.dataset.ip || '';
        showMobileToast('已填入设备 IP');
    });

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
        const result = await exportBackup(getStorage());
        if (!result.canceled) {
            showMobileToast(buildExportSuccessMessage(result));
        }
    } catch (e) {
        console.error('export backup failed:', e);
        showMobileToast(`导出失败：${getErrorMessage(e)}`, 'error');
    }
}

function handleImport() {
    showActionSheet([
        {
            action: 'confirm',
            icon: '⚠️',
            label: '确认导入（同 ID 将覆盖本机数据）',
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
                        const result = await getStorage().importData(data);
                        showMobileToast(`导入成功：新增 ${result.added || 0}，覆盖 ${result.updated || 0}，图片 ${result.imagesRestored || 0}`);
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

function setLanStatus(pageEl, message, type = 'info') {
    const el = pageEl.querySelector('#mLanSyncStatus');
    if (!el) return;
    el.textContent = message;
    el.dataset.type = type;
}

function getLanIp(pageEl) {
    return pageEl.querySelector('#mLanIpInput')?.value.trim() || '';
}

function isValidIp(ip) {
    return /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) && ip.split('.').every(part => Number(part) >= 0 && Number(part) <= 255);
}

function renderDevices(pageEl, devices) {
    const list = pageEl.querySelector('#mLanDeviceList');
    if (!list) return;
    if (!devices.length) {
        list.innerHTML = '<div class="m-lan-empty">未发现 PC 端，请确认 PC 软件已打开且处于同一局域网。</div>';
        return;
    }
    list.innerHTML = devices.map(device => `
        <button class="m-lan-device-item" data-ip="${device.ip}">
            <span class="m-lan-device-name">${device.name || 'PC 端'}</span>
            <span class="m-lan-device-ip">${device.ip}:${device.port || 8888}</span>
        </button>
    `).join('');
}

async function handleLanScan(pageEl) {
    const scanBtn = pageEl.querySelector('#mScanLanBtn');
    if (scanBtn) scanBtn.disabled = true;
    setLanStatus(pageEl, '正在扫描同一局域网内的 PC 端...');
    try {
        lanScanner = lanScanner || new LanScanner();
        const devices = await lanScanner.scan();
        renderDevices(pageEl, devices);
        if (devices[0]) {
            const input = pageEl.querySelector('#mLanIpInput');
            if (input) input.value = devices[0].ip;
            setLanStatus(pageEl, `发现 ${devices.length} 台可用 PC，已填入第一台。`, 'success');
        } else {
            setLanStatus(pageEl, '未发现可用 PC，可手动输入 IP 后测试连接。', 'warning');
        }
    } catch (e) {
        setLanStatus(pageEl, '扫描失败，请改用手动输入 IP。', 'error');
    } finally {
        if (scanBtn) scanBtn.disabled = false;
    }
}

async function handleLanTest(pageEl) {
    const ip = getLanIp(pageEl);
    if (!isValidIp(ip)) {
        showMobileToast('请输入正确的 IP 地址', 'error');
        return;
    }
    setLanStatus(pageEl, '正在测试连接...');
    try {
        const res = await fetch(`http://${ip}:8888/api/health`);
        if (!res.ok) throw new Error('连接失败');
        const data = await res.json();
        setLanStatus(pageEl, `连接成功：${data.device_name || ip}`, 'success');
        saveRecentDevice(ip, data.device_name || 'PC 端');
    } catch (e) {
        setLanStatus(pageEl, '连接失败，请确认 PC 端已打开并允许局域网访问。', 'error');
    }
}

function updateLanProgress(pageEl, current, total, phase, startedAt) {
    const progress = pageEl.querySelector('#mLanProgress');
    const fill = pageEl.querySelector('#mLanProgressFill');
    const text = pageEl.querySelector('#mLanProgressText');
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    if (progress) progress.hidden = false;
    if (fill) fill.style.width = `${Math.min(100, percent)}%`;
    if (text) {
        const seconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
        text.textContent = `${phase || '同步中...'} · ${percent}% · 已用 ${seconds}s`;
    }
}

async function handleLanSync(pageEl) {
    const ip = getLanIp(pageEl);
    if (!isValidIp(ip)) {
        showMobileToast('请输入正确的 IP 地址', 'error');
        return;
    }

    const syncBtn = pageEl.querySelector('#mStartLanSyncBtn');
    const reportEl = pageEl.querySelector('#mLanReport');
    const startedAt = Date.now();
    if (syncBtn) syncBtn.disabled = true;
    if (reportEl) reportEl.innerHTML = '';
    setLanStatus(pageEl, '正在同步，PC 端同 ID 数据将覆盖本机...');

    try {
        lanSync = new LanSync(getStorage());
        lanSync.onProgress = (current, total, phase) => updateLanProgress(pageEl, current, total, phase, startedAt);
        const report = await lanSync.sync(ip);
        if (!report) return;
        saveRecentDevice(ip, 'PC 端');
        if (reportEl) {
            reportEl.innerHTML = `
                <div class="m-lan-report-title">${report.success ? '同步完成' : '同步部分完成'}</div>
                <div>新增 ${report.added || 0} 条，覆盖 ${report.updated || 0} 条，图片 ${report.imagesDownloaded || 0} 张</div>
                ${(report.imagesFailed || []).length ? `<div class="m-lan-report-error">图片失败：${report.imagesFailed.length} 张</div>` : ''}
            `;
        }
        setLanStatus(pageEl, '同步完成，已按 PC 端数据覆盖同 ID 记录。', report.success ? 'success' : 'warning');
        showMobileToast('同步完成');
        await loadStorageInfo(pageEl);
    } catch (e) {
        setLanStatus(pageEl, '同步失败，请检查网络和 PC 端服务状态。', 'error');
        showMobileToast('同步失败', 'error');
    } finally {
        if (syncBtn) syncBtn.disabled = false;
    }
}

function saveRecentDevice(ip, name) {
    const key = 'lan-sync-recent-devices';
    const now = new Date().toISOString();
    let devices = [];
    try {
        devices = JSON.parse(localStorage.getItem(key) || '[]');
    } catch (e) {}
    devices = devices.filter(device => device.ip !== ip);
    devices.unshift({ ip, name, lastSyncAt: now });
    localStorage.setItem(key, JSON.stringify(devices.slice(0, 5)));
}

function unmount(pageEl) {
    if (lanScanner?.scanning) lanScanner.abort();
    if (lanSync?.isSyncing()) lanSync.abort();
}

export { render, mount, unmount };
