import { getStorage } from './storage.js';
import { showMobileToast, showActionSheet, iconImg, navigate } from './mobile-utils.js';
import { DEFAULT_SCAN_PORTS, DEFAULT_SYNC_PORT, formatLanAddress, LanScanner, LanSync, parseLanTarget } from './lan-sync.js';
import { buildExportSuccessMessage, exportBackup, getErrorMessage } from './backup-utils.js';
import { clearDownloadHistory, formatDownloadHistoryTime, getDownloadHistory, getDownloadHistoryLocationLabel } from './download-history.js';
import { MOBILE_ICONS, mobileIcon } from './mobile-icon-assets.js';
import {
    isPromptImageToolImportStorageError,
    normalizeChatGptVaultConversationImport,
    stageChatGptVaultConversationImport,
} from './prompt-tool-json-import.js';
import { renderVersionInfo } from './version-info.js';
import corgiSettings from '../assets/mobile/mascots/corgi-settings.png';
import dataIcon from '../assets/mobile/data.png';
import saveIcon from '../assets/mobile/save.png';
import fileTextIcon from '../assets/icons/mobile/file-text.svg';

let selectedThemeColor = 0;
let lanScanner = null;
let lanSync = null;
let selectedLanMode = localStorage.getItem('lan-sync-mode') || 'pull';
const RECENT_DEVICES_KEY = 'lan-sync-recent-devices';

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
                            <span class="m-settings-row-icon">${mobileIcon('palette')}</span>
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
                ${renderVersionInfo({ className: 'm-version-info' })}
            </div>

            <div class="m-section-gap">
                <div class="m-section-title">
                    <span class="m-section-title-text">数据备份与恢复</span>
                </div>
                <div class="m-backup-grid">
                    <button class="m-backup-card m-backup-green" id="mLocalBackup">
                        <span class="m-backup-icon">${iconImg(dataIcon)}</span>
                        <span class="m-backup-label">本地备份</span>
                        <span class="m-backup-desc">导出所有数据</span>
                    </button>
                    <button class="m-backup-card m-backup-blue" id="mImportData">
                        <span class="m-backup-icon">${iconImg(saveIcon)}</span>
                        <span class="m-backup-label">导入备份</span>
                        <span class="m-backup-desc">恢复整套数据</span>
                    </button>
                    <button class="m-backup-card m-backup-purple" id="mImportChatGptVault">
                        <span class="m-backup-icon">${iconImg(fileTextIcon)}</span>
                        <span class="m-backup-label">导入对话</span>
                        <span class="m-backup-desc">从单条对话新建</span>
                    </button>
                </div>
            </div>

            <div class="m-section-gap">
                <div class="m-section-title">
                    <span class="m-section-title-text">图片下载记录</span>
                    <div class="m-download-history-title-actions">
                        <span class="m-section-title-action" id="mDownloadHistoryCount">0</span>
                        <button class="m-download-history-clear" id="mClearDownloadHistory" type="button">清空历史</button>
                    </div>
                </div>
                <div class="m-settings-card m-download-history-card">
                    <div class="m-download-history-list" id="mDownloadHistoryList"></div>
                </div>
            </div>

            <div class="m-section-gap">
                <div class="m-section-title">
                    <span class="m-section-title-text">局域网同步</span>
                </div>
                <div class="m-settings-card m-lan-sync-card">
                    <div class="m-lan-sync-status" id="mLanSyncStatus" role="status">搜索同一局域网内已打开的 PC 端，选择设备后即可测试连接并同步数据。</div>
                    <div class="m-lan-mode-group" id="mLanModeGroup" role="radiogroup" aria-label="同步方向">
                        <button class="m-lan-mode-btn ${selectedLanMode === 'pull' ? 'is-active' : ''}" type="button" role="radio" aria-checked="${selectedLanMode === 'pull' ? 'true' : 'false'}" data-lan-mode="pull">从 PC 拉取</button>
                        <button class="m-lan-mode-btn ${selectedLanMode === 'push' ? 'is-active' : ''}" type="button" role="radio" aria-checked="${selectedLanMode === 'push' ? 'true' : 'false'}" data-lan-mode="push">回传到 PC</button>
                        <button class="m-lan-mode-btn ${selectedLanMode === 'bidirectional' ? 'is-active' : ''}" type="button" role="radio" aria-checked="${selectedLanMode === 'bidirectional' ? 'true' : 'false'}" data-lan-mode="bidirectional">双向同步</button>
                    </div>
                    <div class="m-lan-sync-actions">
                        <button class="m-lan-sync-btn m-lan-sync-primary" id="mScanLanBtn">搜索 PC</button>
                        <button class="m-lan-sync-btn" id="mTestLanBtn">测试连接</button>
                    </div>
                    <div class="m-lan-sync-input-row">
                        <input class="m-lan-sync-input" id="mLanIpInput" type="text" inputmode="decimal" placeholder="输入 PC 地址，如 192.168.1.100:8888">
                        <button class="m-lan-sync-btn m-lan-sync-primary" id="mStartLanSyncBtn">${getLanModeActionLabel()}</button>
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

        </div>
    `;
}

async function mount(pageEl, params = {}) {
    const storedAccent = localStorage.getItem('accent') || 'pink';
    selectedThemeColor = THEME_COLORS.findIndex(c => c.accent === storedAccent);
    if (selectedThemeColor < 0) selectedThemeColor = 0;
    const app = document.querySelector('.mobile-app');
    app?.setAttribute('data-accent', THEME_COLORS[selectedThemeColor].accent);
    app?.style.setProperty('--m-theme-check-icon', `url(${MOBILE_ICONS.check})`);

    setupSettingsEvents(pageEl);
    loadStorageInfo(pageEl);
    renderDownloadHistory(pageEl);
    const recentDevices = getRecentDevices();
    if (recentDevices.length) {
        renderDevices(pageEl, recentDevices.map(device => ({ ...device, source: 'recent' })));
    }
}

function renderDownloadHistory(pageEl) {
    const history = getDownloadHistory();
    const countEl = pageEl.querySelector('#mDownloadHistoryCount');
    const clearBtn = pageEl.querySelector('#mClearDownloadHistory');
    const listEl = pageEl.querySelector('#mDownloadHistoryList');
    if (countEl) countEl.textContent = `${history.length} 条`;
    if (clearBtn) clearBtn.disabled = !history.length;
    if (!listEl) return;

    if (!history.length) {
        listEl.innerHTML = `
            <div class="m-download-history-empty">
                <div class="m-download-history-empty-title">还没有图片下载记录</div>
                <div class="m-download-history-empty-text">最近下载的图片会出现在这里，方便你随时查看和清理。</div>
            </div>
        `;
        return;
    }

    listEl.innerHTML = history.map(item => {
        const platformLabel = item.platform === 'mobile' ? '移动端' : item.platform === 'pc' ? 'PC 端' : '本地';
        const locationLabel = getDownloadHistoryLocationLabel(item);
        return `
        <div class="m-download-history-item">
            <span class="m-download-history-icon">${mobileIcon('download', { className: 'm-icon-sm' })}</span>
            <div class="m-download-history-body">
                <div class="m-download-history-main">
                    <strong title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</strong>
                    <small>${escapeHtml(item.source)} · ${escapeHtml(locationLabel)}</small>
                </div>
                <div class="m-download-history-meta">
                    <span class="m-download-history-time">${escapeHtml(formatDownloadHistoryTime(item.createdAt))}</span>
                    <span class="m-download-history-platform">${escapeHtml(platformLabel)}</span>
                </div>
            </div>
        </div>
    `;
    }).join('');
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
    pageEl.querySelector('#mImportData')?.addEventListener('click', () => handleBackupImport(pageEl));
    pageEl.querySelector('#mImportChatGptVault')?.addEventListener('click', handleChatGptVaultImport);
    pageEl.querySelector('#mLanModeGroup')?.addEventListener('click', (e) => handleLanModeChange(pageEl, e));
    pageEl.querySelector('#mScanLanBtn')?.addEventListener('click', () => handleLanScan(pageEl));
    pageEl.querySelector('#mTestLanBtn')?.addEventListener('click', () => handleLanTest(pageEl));
    pageEl.querySelector('#mStartLanSyncBtn')?.addEventListener('click', () => handleLanSync(pageEl));
    pageEl.querySelector('#mLanDeviceList')?.addEventListener('click', async (e) => {
        const item = e.target.closest('.m-lan-device-item');
        if (!item) return;
        const input = pageEl.querySelector('#mLanIpInput');
        if (input) input.value = item.dataset.address || item.dataset.ip || '';
        item.dataset.status = 'testing';
        setLanStatus(pageEl, `正在验证 ${item.dataset.address || item.dataset.ip} 是否可同步...`);
        const device = await testLanConnection(pageEl, item.dataset.address || item.dataset.ip, { save: true, silent: true });
        item.dataset.status = device ? 'ready' : 'error';
        if (device) {
            item.querySelector('.m-lan-device-state')?.replaceChildren(document.createTextNode('可同步'));
            showMobileToast('已连接到 PC 端');
        } else {
            item.querySelector('.m-lan-device-state')?.replaceChildren(document.createTextNode('连接失败'));
        }
    });

    pageEl.querySelector('#mClearDownloadHistory')?.addEventListener('click', () => {
        const history = getDownloadHistory();
        if (!history.length) {
            showMobileToast('暂无图片下载记录');
            return;
        }
        showActionSheet([
            {
                action: 'confirm',
                icon: mobileIcon('warning'),
                label: '确认清空图片下载记录',
                handler: () => {
                    clearDownloadHistory();
                    renderDownloadHistory(pageEl);
                    showMobileToast('图片下载记录已清空');
                }
            },
            {
                action: 'cancel',
                icon: mobileIcon('x'),
                label: '取消',
                handler: () => {}
            }
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

function openJsonImportPicker(onPick) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (file) await onPick(file);
    };
    input.click();
}

async function readJsonFile(file) {
    const text = await file.text();
    return JSON.parse(text);
}

function confirmJsonImport(label, onConfirm) {
    showActionSheet([
        {
            action: 'confirm',
            icon: mobileIcon('warning'),
            label,
            handler: onConfirm
        },
        {
            action: 'cancel',
            icon: mobileIcon('x'),
            label: '取消',
            handler: () => {}
        }
    ]);
}

function handleBackupImport(pageEl) {
    confirmJsonImport('确认导入备份（同 ID 将覆盖本机数据）', () => {
        openJsonImportPicker(async (file) => {
            try {
                const data = await readJsonFile(file);
                if (normalizeChatGptVaultConversationImport(data)) {
                    showMobileToast('这是对话归档 JSON，请使用“导入对话”', 'error');
                    return;
                }
                const result = await getStorage().importData(data);
                showMobileToast(`导入成功：新增 ${result.added || 0}，覆盖 ${result.updated || 0}，图片 ${result.imagesRestored || 0}`);
                await loadStorageInfo(pageEl);
            } catch (err) {
                showMobileToast('导入失败，文件格式不正确', 'error');
            }
        });
    });
}

function handleChatGptVaultImport() {
    confirmJsonImport('确认导入对话（将新建提示词）', () => {
        openJsonImportPicker(async (file) => {
            try {
                const data = await readJsonFile(file);
                const promptPayload = await stageChatGptVaultConversationImport(data);
                if (!promptPayload) {
                    showMobileToast('请选择 ChatGPT Vault 单条对话归档 JSON', 'error');
                    return;
                }
                navigate('/editor/', { importId: promptPayload.id });
                showMobileToast('已打开 ChatGPT 对话导入页');
            } catch (err) {
                showMobileToast(getJsonImportErrorMessage(err), 'error');
            }
        });
    });
}

function getJsonImportErrorMessage(err) {
    if (isPromptImageToolImportStorageError(err)) {
        return '导入文件过大，暂存失败，请减少图片数量或重新导出';
    }
    return '导入失败，文件格式不正确';
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

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getRecentDevices() {
    try {
        const devices = JSON.parse(localStorage.getItem(RECENT_DEVICES_KEY) || '[]');
        if (!Array.isArray(devices)) return [];
        return devices
            .map(device => {
                const target = parseLanTarget(device);
                return target ? { ...device, ...target } : null;
            })
            .filter(Boolean)
            .slice(0, 5);
    } catch (e) {
        return [];
    }
}

function getDeviceSourceLabel(source) {
    if (source === 'recent') return '最近设备';
    if (source === 'subnet') return '局域网';
    return '候选设备';
}

function getLanModeActionLabel() {
    if (selectedLanMode === 'push') return '回传';
    if (selectedLanMode === 'bidirectional') return '双向';
    return '同步';
}

function getCapabilityLabel(device) {
    const caps = Array.isArray(device.capabilities) ? device.capabilities : [];
    if (caps.includes('bidirectional')) return '支持双向';
    if (caps.includes('push')) return '支持回传';
    return '仅可拉取';
}

function handleLanModeChange(pageEl, e) {
    const btn = e.target.closest('.m-lan-mode-btn');
    if (!btn) return;
    selectedLanMode = btn.dataset.lanMode || 'pull';
    localStorage.setItem('lan-sync-mode', selectedLanMode);
    pageEl.querySelectorAll('.m-lan-mode-btn').forEach(item => {
        const active = item === btn;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-checked', active ? 'true' : 'false');
    });
    const startBtn = pageEl.querySelector('#mStartLanSyncBtn');
    if (startBtn) startBtn.textContent = getLanModeActionLabel();
    const modeText = selectedLanMode === 'push' ? '将 Android 本机数据回传到 PC，冲突会在 PC 端生成副本。'
        : selectedLanMode === 'bidirectional' ? '先回传 Android 数据，再拉取 PC 最新结果。'
        : '从 PC 拉取数据到 Android，本机同 ID 数据按 PC 端覆盖。';
    setLanStatus(pageEl, modeText);
}

function renderDevices(pageEl, devices) {
    const list = pageEl.querySelector('#mLanDeviceList');
    if (!list) return;
    if (!devices.length) {
        list.innerHTML = `
            <div class="m-lan-empty">
                未发现 PC 端。请确认 PC 软件已打开、手机与 PC 处于同一 Wi-Fi，且防火墙允许 PC 设置页显示的同步端口；也可以手动输入完整地址。
            </div>
        `;
        return;
    }
    list.innerHTML = devices.map(device => {
        const target = parseLanTarget(device);
        const address = target ? target.address : `${device.ip}:${device.port || DEFAULT_SYNC_PORT}`;
        return `
        <button class="m-lan-device-item" data-ip="${escapeHtml(device.ip)}" data-port="${escapeHtml(device.port || DEFAULT_SYNC_PORT)}" data-address="${escapeHtml(address)}" data-status="online">
            <span class="m-lan-device-main">
                <span class="m-lan-device-name">${escapeHtml(device.name || 'PC 端')}</span>
                <span class="m-lan-device-ip">${escapeHtml(address)}</span>
            </span>
            <span class="m-lan-device-meta">
                <span class="m-lan-device-source">${getDeviceSourceLabel(device.source)}</span>
                <span class="m-lan-device-state">${getCapabilityLabel(device)}</span>
            </span>
        </button>
    `;
    }).join('');
}

function updateLanSearchProgress(pageEl, detail) {
    const progress = pageEl.querySelector('#mLanProgress');
    const fill = pageEl.querySelector('#mLanProgressFill');
    const text = pageEl.querySelector('#mLanProgressText');
    const total = detail.total || 0;
    const percent = total > 0 ? Math.round((detail.current / total) * 100) : 0;
    if (progress) progress.hidden = false;
    if (fill) fill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    if (text) {
        const found = detail.found ? ` · 已发现 ${detail.found} 台` : '';
        text.textContent = `${detail.message || '正在搜索 PC'}${total > 0 ? ` · ${percent}%` : ''}${found}`;
    }
    if (detail.message) {
        setLanStatus(pageEl, detail.message, detail.phase === 'done' && detail.found ? 'success' : 'info');
    }
}

async function handleLanScan(pageEl) {
    const scanBtn = pageEl.querySelector('#mScanLanBtn');
    if (lanScanner?.scanning) {
        lanScanner.abort();
        setLanStatus(pageEl, '已停止搜索 PC。', 'warning');
        if (scanBtn) scanBtn.textContent = '搜索 PC';
        return;
    }

    const reportEl = pageEl.querySelector('#mLanReport');
    if (reportEl) reportEl.innerHTML = '';
    if (scanBtn) scanBtn.textContent = '停止搜索';
    setLanStatus(pageEl, '正在搜索同一局域网内的 PC 端...');

    try {
        lanScanner = lanScanner || new LanScanner();
        const devices = await lanScanner.scan({
            recentHosts: getRecentDevices(),
            ports: DEFAULT_SCAN_PORTS,
            timeout: 1200,
            onProgress: detail => updateLanSearchProgress(pageEl, detail),
        });
        renderDevices(pageEl, devices);
        if (devices[0]) {
            const input = pageEl.querySelector('#mLanIpInput');
            if (input) input.value = formatLanAddress(devices[0]);
            setLanStatus(pageEl, `发现 ${devices.length} 台可用 PC，已填入第一台，点击结果可再次验证。`, 'success');
        } else {
            setLanStatus(pageEl, '未发现可用 PC，可手动输入完整地址后测试连接。', 'warning');
        }
    } catch (e) {
        setLanStatus(pageEl, '搜索失败，请改用手动输入完整地址。', 'error');
    } finally {
        if (scanBtn) scanBtn.textContent = '搜索 PC';
    }
}

async function testLanConnection(pageEl, targetValue, options = {}) {
    const target = parseLanTarget(targetValue);
    if (!target) {
        if (!options.silent) showMobileToast('请输入正确的 PC 地址', 'error');
        return null;
    }
    setLanStatus(pageEl, '正在测试连接...');
    try {
        const res = await fetch(`${target.baseUrl}/api/health`);
        if (!res.ok) throw new Error('连接失败');
        const data = await res.json();
        if (data.status !== 'ok') throw new Error('服务状态异常');
        const port = Number(data.port) || target.port;
        const device = {
            ip: target.ip,
            port,
            address: `${target.ip}:${port}`,
            name: data.device_name || 'PC 端',
            source: 'recent',
            deviceId: data.device_id || '',
            syncVersion: data.sync_version || 1,
            capabilities: Array.isArray(data.capabilities) ? data.capabilities : ['pull'],
            pairingRequired: data.pairing_required !== false,
        };
        if (device.capabilities.includes('push') || device.capabilities.includes('bidirectional')) {
            try {
                const sync = new LanSync(getStorage());
                const pairing = await sync.getPairing(device);
                device.token = pairing.sync_token || '';
            } catch (e) {}
        }
        setLanStatus(pageEl, `连接成功：${device.name}（${device.address}，${getCapabilityLabel(device)}）`, 'success');
        if (options.save !== false) saveRecentDevice(device, device.name, device);
        return device;
    } catch (e) {
        setLanStatus(pageEl, '连接失败，请确认 PC 端已打开，并放行设置页显示的同步端口。', 'error');
        return null;
    }
}

async function handleLanTest(pageEl) {
    const device = await testLanConnection(pageEl, getLanIp(pageEl), { save: true });
    if (device) showMobileToast('连接成功');
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

function renderLanReport(report) {
    if (report.mode === 'bidirectional') {
        const push = report.pushReport || {};
        const pull = report.pullReport || {};
        const preview = report.preview ? renderLanPreviewSummary(report.preview) : '';
        return `
            <div class="m-lan-report-title">${report.success ? '双向同步完成' : '双向同步部分完成'}</div>
            ${preview}
            <div>回传到 PC：新增 ${push.added || 0} 条，冲突副本 ${push.conflicts || 0} 条，图片 ${push.imagesRestored || 0} 张</div>
            <div>拉取到 Android：新增 ${pull.added || 0} 条，覆盖 ${pull.updated || 0} 条，图片 ${pull.imagesDownloaded || 0} 张</div>
            ${push.backupPath ? `<div>同步前备份：${escapeHtml(push.backupPath)}</div>` : ''}
            ${(pull.imagesFailed || []).length ? `<div class="m-lan-report-error">图片失败：${pull.imagesFailed.length} 张</div>` : ''}
        `;
    }
    if (report.mode === 'keep_pc' || report.imagesRestored !== undefined) {
        const preview = report.preview ? renderLanPreviewSummary(report.preview) : '';
        return `
            <div class="m-lan-report-title">${report.success ? '回传完成' : '回传部分完成'}</div>
            ${preview}
            <div>PC 新增 ${report.added || 0} 条，冲突副本 ${report.conflicts || 0} 条，跳过 ${report.skipped || 0} 条</div>
            <div>接收图片 ${report.imagesRestored || 0} 张</div>
            ${report.backupPath ? `<div>同步前备份：${escapeHtml(report.backupPath)}</div>` : ''}
        `;
    }
    return `
        <div class="m-lan-report-title">${report.success ? '同步完成' : '同步部分完成'}</div>
        <div>新增 ${report.added || 0} 条，覆盖 ${report.updated || 0} 条，图片 ${report.imagesDownloaded || 0} 张</div>
        ${(report.imagesFailed || []).length ? `<div class="m-lan-report-error">图片失败：${report.imagesFailed.length} 张</div>` : ''}
    `;
}

function renderLanPreviewSummary(preview) {
    const summary = preview?.summary || {};
    return `
        <div class="m-lan-preview-summary">
            预览：新增 ${summary.added || 0}，冲突 ${summary.conflicts || 0}，跳过 ${summary.skipped || 0}，PC 独有 ${summary.onlyPc || 0}
        </div>
    `;
}

function renderLanPreview(preview) {
    const summary = preview?.summary || {};
    const conflicts = (preview?.items || []).filter(item => item.type === 'conflict').slice(0, 3);
    return `
        <div class="m-lan-report-title">同步前预览</div>
        <div>将新增 ${summary.added || 0} 条，跳过 ${summary.skipped || 0} 条，发现冲突 ${summary.conflicts || 0} 条。</div>
        <div>PC 独有 ${summary.onlyPc || 0} 条，同内容 ${summary.same || 0} 条。</div>
        ${conflicts.length ? `
            <div class="m-lan-report-error">
                ${conflicts.map(item => `${escapeHtml(item.name || item.id)}：${(item.fieldDiffs || []).map(diff => diff.label).join('、') || '内容不同'}`).join('<br>')}
            </div>
        ` : ''}
    `;
}

function getPreviewMode() {
    if (selectedLanMode === 'pull') return 'pull';
    if (selectedLanMode === 'bidirectional') return 'bidirectional';
    return 'keep_pc';
}

function confirmLanPreview(preview, mode) {
    const conflicts = preview?.summary?.conflicts || 0;
    if (!conflicts) return Promise.resolve('keep_pc');

    return new Promise(resolve => {
        const actions = [];
        actions.push({
            action: 'confirm',
            icon: mobileIcon('check'),
            label: mode === 'pull' ? '继续拉取（PC 覆盖同 ID）' : '安全同步（冲突生成副本）',
            handler: () => resolve('keep_pc'),
        });
        if (mode !== 'pull') {
            actions.push({
                action: 'skip',
                icon: mobileIcon('warning'),
                label: '只同步无冲突项',
                handler: () => resolve('add_only'),
            });
        }
        actions.push({
            action: 'cancel',
            icon: mobileIcon('x'),
            label: '取消同步',
            handler: () => resolve(null),
        });
        showActionSheet(actions);
    });
}

function getLanSuccessMessage(report) {
    if (report.mode === 'bidirectional') return '双向同步完成，冲突已在 PC 端保留副本。';
    if (report.mode === 'keep_pc' || report.imagesRestored !== undefined) return '回传完成，PC 端同 ID 冲突已生成副本。';
    return '同步完成，已按 PC 端数据覆盖同 ID 记录。';
}

async function handleLanSync(pageEl) {
    const target = parseLanTarget(getLanIp(pageEl));
    if (!target) {
        showMobileToast('请输入正确的 PC 地址', 'error');
        return;
    }

    const syncBtn = pageEl.querySelector('#mStartLanSyncBtn');
    const reportEl = pageEl.querySelector('#mLanReport');
    const startedAt = Date.now();
    if (syncBtn) syncBtn.disabled = true;
    if (reportEl) reportEl.innerHTML = '';
    setLanStatus(pageEl, '正在生成同步前冲突预览...');

    try {
        lanSync = new LanSync(getStorage());
        lanSync.onProgress = (current, total, phase) => updateLanProgress(pageEl, current, total, phase, startedAt);
        const recent = findRecentDevice(target);
        const preview = await lanSync.preview(target, {
            token: recent?.token,
            mode: getPreviewMode(),
        });
        if (reportEl) reportEl.innerHTML = renderLanPreview(preview);
        const confirmedMode = await confirmLanPreview(preview, selectedLanMode);
        if (!confirmedMode) {
            setLanStatus(pageEl, '已取消同步，未写入任何数据。', 'warning');
            return;
        }
        setLanStatus(pageEl, '正在同步，请保持两端网络连接...');
        let report = null;
        if (selectedLanMode === 'push') {
            report = await lanSync.push(target, { token: preview.token || recent?.token, mode: confirmedMode });
        } else if (selectedLanMode === 'bidirectional') {
            report = await lanSync.bidirectional(target, { token: preview.token || recent?.token, mode: confirmedMode });
        } else {
            report = await lanSync.sync(target);
            report.preview = preview;
        }
        if (!report) return;
        saveRecentDevice(target, recent?.name || 'PC 端', {
            ...recent,
            token: report.token || preview.token || recent?.token,
        });
        if (reportEl) {
            reportEl.innerHTML = renderLanReport(report);
        }
        setLanStatus(pageEl, getLanSuccessMessage(report), report.success ? 'success' : 'warning');
        showMobileToast('同步完成');
        await loadStorageInfo(pageEl);
    } catch (e) {
        setLanStatus(pageEl, '同步失败，请检查网络和 PC 端服务状态。', 'error');
        showMobileToast('同步失败', 'error');
    } finally {
        if (syncBtn) syncBtn.disabled = false;
    }
}

function findRecentDevice(ip) {
    const target = parseLanTarget(ip);
    if (!target) return null;
    return getRecentDevices().find(device => device.address === target.address) || null;
}

function saveRecentDevice(ip, name, extra = {}) {
    const target = parseLanTarget(ip);
    if (!target) return;
    const now = new Date().toISOString();
    let devices = [];
    try {
        devices = JSON.parse(localStorage.getItem(RECENT_DEVICES_KEY) || '[]');
    } catch (e) {}
    devices = devices.filter(device => parseLanTarget(device)?.address !== target.address);
    devices.unshift({
        ...extra,
        ip: target.ip,
        port: target.port,
        address: target.address,
        name,
        lastSyncAt: now,
        capabilities: Array.isArray(extra.capabilities) ? extra.capabilities : extra.capabilities || ['pull'],
    });
    localStorage.setItem(RECENT_DEVICES_KEY, JSON.stringify(devices.slice(0, 5)));
}

function unmount(pageEl) {
    if (lanScanner?.scanning) lanScanner.abort();
    if (lanSync?.isSyncing()) lanSync.abort();
}

export { render, mount, unmount };
