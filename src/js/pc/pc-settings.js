import { getStorage, isCapacitor, resolveApiBase } from '../core/storage.js';
import { navigate } from './pc-app.js';
import { showToast, showConfirmModal, escapeHtml, formatBytes, copyToClipboard } from './pc-utils.js';
import { resetPlant } from '../plant/plant-persist.js';
import { APPEARANCE_PREFERENCES, WORKBENCH_THEMES, getWorkbenchTheme } from '../core/theme-config.js';
import { getThemeState, setAppearancePreference, setWorkbenchTheme } from '../core/theme-service.js';
import { buildExportSuccessMessage, exportBackup, exportZipBackup, getErrorMessage } from '../shared/backup-utils.js';
import { clearDownloadHistory, formatDownloadHistoryTime, getDownloadHistory, getDownloadHistoryLocationLabel, getDownloadHistoryMethodLabel } from '../shared/download-history.js';
import { renderPcWelcomeWalkAnimation } from './pc-welcome-banner.js';
import { renderVersionInfo } from '../core/version-info.js';
import { runManualUpdateCheck, formatUpdateCheckHint } from '../release/auto-updater.js';
import {
    isPromptImageToolImportStorageError,
    normalizeChatGptVaultConversationImport,
    stageChatGptVaultConversationImport,
} from '../shared/prompt-tool-json-import.js';
import corgiHome from '../../assets/mobile/mascots/corgi-home.png';
import { pcIcon } from './pc-icon-assets.js';

let settingsData = null;

const STORAGE_TICK_COUNT = 16;

const APPEARANCE_LABELS = {
    light: '浅色',
    dark: '深色',
    system: '跟随系统',
    scheduled: '定时切换',
};

const APPEARANCE_SCREEN_CLASSES = {
    light: 'pc-settings-mini-screen-light',
    dark: 'pc-settings-mini-screen-dark',
    system: 'pc-settings-mini-screen-system',
    scheduled: 'pc-settings-mini-screen-scheduled',
};

function iconImg(icon, alt = '') {
    return `<img src="${icon}" alt="${alt}" aria-hidden="${alt ? 'false' : 'true'}">`;
}

function renderStorageTicks(litCount = 0) {
    return Array.from({ length: STORAGE_TICK_COUNT }, (_, index) => (
        `<i class="${index < litCount ? 'is-lit' : ''}" aria-hidden="true"></i>`
    )).join('');
}

function render(params = {}) {
    const themeState = getThemeState();
    const activeTheme = getWorkbenchTheme(themeState.workbenchTheme) || WORKBENCH_THEMES[0];
    const currentAppearance = themeState.appearancePreference;

    return `
        <section class="pc-settings-page">
            <div class="pc-settings-console">
                <header class="pc-settings-lcd-bar pc-settings-panel pc-settings-update-panel" aria-labelledby="pcUpdateTitle">
                    <div class="pc-settings-lcd-brand">
                        <div class="pc-settings-console-orb">
                            <img src="${corgiHome}" alt="柯基吉祥物">
                        </div>
                        <div class="pc-settings-lcd-copy">
                            <div class="pc-settings-lcd-title-row">
                                <h1 class="pc-settings-lcd-title">设置台</h1>
                                <span class="pc-settings-neu-badge is-ok">
                                    <span class="pc-settings-led-dot" aria-hidden="true"></span>
                                    本地离线安全
                                </span>
                            </div>
                            <p class="pc-settings-lcd-sub">
                                一切数据仅在本地硬盘运行
                                <span aria-hidden="true">·</span>
                                <span id="pcEnvValue">浏览器</span>
                                <span aria-hidden="true">·</span>
                                <span id="pcStorageType">本地存储</span>
                            </p>
                        </div>
                    </div>

                    <div class="pc-settings-lcd-walk" aria-hidden="true">
                        ${renderPcWelcomeWalkAnimation({ variant: 'settings' })}
                    </div>

                    <div class="pc-settings-lcd-update">
                        <h2 id="pcUpdateTitle" class="pc-settings-sr-only">软件更新</h2>
                        <div class="pc-settings-lcd-update-meta">
                            <div class="pc-settings-lcd-ver-line">
                                ${renderVersionInfo({ tag: 'span', className: 'pc-settings-neu-badge pc-settings-mono pc-settings-update-version-value', label: 'VER ' })}
                            </div>
                            <span class="pc-settings-update-hint" id="pcUpdateStatusHint">上次检查：启动后自动进行</span>
                        </div>
                        <button class="pc-btn pc-btn-primary pc-settings-neu-btn pc-settings-neu-btn-brand pc-settings-update-btn" type="button" id="pcCheckUpdateBtn">
                            检查更新
                        </button>
                    </div>
                </header>

                <div class="pc-settings-telemetry-grid">
                    <section class="pc-settings-panel pc-settings-storage-panel" aria-labelledby="pcStorageTitle">
                        <div class="pc-settings-card-head">
                            <h2 id="pcStorageTitle" class="pc-settings-kicker">01 / 存储遥测</h2>
                            <span class="pc-settings-neu-badge is-brand">提示词 <strong id="pcStoragePromptCount">-</strong> 条</span>
                        </div>

                        <div class="pc-settings-storage-readout">
                            <div class="pc-settings-big-metric pc-settings-mono"><span id="pcStorageSizeValue">-</span></div>
                            <div class="pc-settings-storage-subline">
                                可用 <span id="pcStorageAvailable">检测中</span> / 共 <span id="pcStorageTotal">-</span>
                                <span aria-hidden="true">·</span>
                                占用 <span class="pc-storage-ring pc-settings-inline-ring" id="pcStorageRing" style="--ring-percent:0%;"><span class="pc-storage-ring-value" id="pcStorageRingValue">0%</span></span>
                            </div>
                        </div>

                        <div class="pc-settings-ticks pc-settings-storage-tile" id="pcStorageTicks" title="16 格本地配额占用刻度表" aria-hidden="true">
                            ${renderStorageTicks(0)}
                        </div>

                        <div class="pc-settings-dir-stack">
                            <span class="pc-settings-data-dir pc-settings-mono" id="pcDataDirValue" title="">数据目录检测中</span>
                            <button class="pc-btn pc-settings-neu-btn pc-settings-neu-btn-sm pc-settings-full-btn" type="button" id="pcCopyDataDir">
                                复制本地数据目录
                            </button>
                        </div>
                    </section>

                    <section class="pc-settings-panel pc-settings-sync-panel" aria-labelledby="pcSyncTitle">
                        <div class="pc-settings-card-head">
                            <h2 id="pcSyncTitle" class="pc-settings-kicker">02 / 局域网节点</h2>
                            <span class="pc-settings-neu-badge is-ok" id="pcSyncCapabilityBadge">
                                <span class="pc-settings-led-dot" aria-hidden="true"></span>
                                <span class="pc-settings-sync-badge-text">检测中</span>
                            </span>
                        </div>

                        <div class="pc-settings-neu-well pc-settings-sync-lcd">
                            <div class="pc-sync-ip-display pc-settings-mono" id="pcSyncIpDisplay">同步服务：检测中...</div>
                            <div class="pc-sync-capability-line" id="pcSyncCapabilityLine">互通能力：检测中...</div>
                            <div class="pc-sync-hint" id="pcSyncHint">Android 可在设置页搜索此 PC，支持拉取、回传与双向同步。</div>
                            <div id="pcSyncStatus" aria-live="polite"></div>
                        </div>

                        <div class="pc-settings-dual-btns">
                            <button class="pc-btn pc-settings-neu-btn pc-settings-neu-btn-sm" type="button" id="pcCopySyncAddress">复制 IP</button>
                            <button class="pc-btn pc-settings-neu-btn pc-settings-neu-btn-sm" type="button" id="pcRefreshNetworkInfo">刷新节点</button>
                        </div>
                    </section>

                    <section class="pc-settings-panel pc-settings-download-history-panel" aria-labelledby="pcDownloadHistoryTitle">
                        <div class="pc-settings-card-head">
                            <h2 id="pcDownloadHistoryTitle" class="pc-settings-kicker">03 / 下载与维护</h2>
                            <span class="pc-settings-neu-badge"><span class="pc-settings-download-history-count" id="pcDownloadHistoryCount">0</span> 条留痕</span>
                        </div>

                        <div class="pc-settings-neu-well pc-settings-download-history-list" id="pcDownloadHistoryList"></div>

                        <div class="pc-settings-dual-btns">
                            <button class="pc-btn pc-settings-neu-btn pc-settings-neu-btn-sm pc-settings-neu-btn-danger" type="button" id="pcClearDownloadHistory">清空记录</button>
                            <button class="pc-btn pc-settings-neu-btn pc-settings-neu-btn-sm pc-settings-neu-btn-danger" type="button" data-settings-action="reset-plant">重置挂机植物</button>
                        </div>
                    </section>
                </div>

                <section class="pc-settings-panel pc-settings-appearance" aria-labelledby="pcAppearanceTitle">
                    <div class="pc-settings-card-head pc-settings-appearance-head">
                        <h2 id="pcAppearanceTitle" class="pc-settings-kicker">04 / 视觉外观与色板拨盘</h2>
                        <div class="pc-settings-appearance-head-right">
                            <span class="pc-settings-neu-badge is-brand" id="pcActiveThemeBadge">${escapeHtml(activeTheme.name)}</span>
                            <div class="pc-theme-appearance-select" id="pcAppearancePicker" data-value="${currentAppearance}">
                                <button type="button" class="pc-theme-appearance-trigger" aria-haspopup="listbox" aria-expanded="false" aria-label="外观模式">
                                    <span class="pc-theme-appearance-value">${APPEARANCE_LABELS[currentAppearance]}</span>
                                    <span class="pc-theme-appearance-arrow" aria-hidden="true"></span>
                                </button>
                                <ul class="pc-theme-appearance-menu" role="listbox" aria-label="外观模式" hidden>
                                    ${APPEARANCE_PREFERENCES.map(value => `
                                        <li class="pc-theme-appearance-option" role="option" data-value="${value}" aria-selected="${value === currentAppearance ? 'true' : 'false'}" tabindex="-1">
                                            <span class="pc-theme-appearance-option-label">${APPEARANCE_LABELS[value]}</span>
                                            <span class="pc-theme-appearance-option-check" aria-hidden="true"></span>
                                        </li>
                                    `).join('')}
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div class="pc-settings-mode-grid" role="radiogroup" aria-label="界面外观拨盘">
                        ${APPEARANCE_PREFERENCES.map(value => {
                            const selected = value === currentAppearance;
                            return `
                                <button
                                    type="button"
                                    class="pc-settings-mode-card ${selected ? 'is-active' : ''}"
                                    role="radio"
                                    aria-checked="${selected ? 'true' : 'false'}"
                                    data-appearance-card="${value}"
                                >
                                    <span class="pc-settings-mini-screen ${APPEARANCE_SCREEN_CLASSES[value]}" aria-hidden="true">
                                        <i></i>
                                        <i></i>
                                    </span>
                                    <span class="pc-settings-mode-foot">
                                        <span>${APPEARANCE_LABELS[value]}</span>
                                        <span class="pc-settings-radio-orb" aria-hidden="true"></span>
                                    </span>
                                </button>
                            `;
                        }).join('')}
                    </div>

                    <div class="pc-settings-palette-tray">
                        <div class="pc-theme-dots" id="pcThemePicker" role="radiogroup" aria-label="工作台主题">
                            ${WORKBENCH_THEMES.map(theme => {
                                const active = theme.key === themeState.workbenchTheme;
                                return `
                                    <button
                                        class="pc-theme-dot ${active ? 'pc-theme-active' : ''}"
                                        type="button"
                                        role="radio"
                                        aria-checked="${active ? 'true' : 'false'}"
                                        data-workbench-theme="${theme.key}"
                                        style="--dot-color:${theme.color};"
                                        title="${escapeHtml(theme.name)}"
                                        aria-label="${escapeHtml(theme.name)}"
                                    >
                                        <span class="pc-theme-bead" aria-hidden="true"></span>
                                        <span class="pc-theme-dot-name">${escapeHtml(theme.name)}</span>
                                    </button>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </section>

                <section class="pc-settings-panel pc-settings-backup-panel" aria-labelledby="pcBackupTitle">
                    <div class="pc-settings-card-head pc-settings-backup-head">
                        <h2 id="pcBackupTitle" class="pc-settings-kicker">05 / 数据保险箱（立体键帽）</h2>
                        <div class="pc-settings-backup-controls">
                            <div class="pc-settings-export-mode" role="radiogroup" aria-label="备份导出位置">
                                <label class="pc-settings-export-mode-option">
                                    <input type="radio" name="pcExportMode" value="downloads" checked>
                                    <span>下载目录</span>
                                </label>
                                <label class="pc-settings-export-mode-option">
                                    <input type="radio" name="pcExportMode" value="custom">
                                    <span>自定义位置</span>
                                </label>
                            </div>
                            <button class="pc-btn pc-settings-neu-btn pc-settings-neu-btn-sm" type="button" data-settings-action="export-json">导出兼容 JSON</button>
                        </div>
                    </div>

                    <div class="pc-settings-action-grid pc-settings-action-grid-three">
                        <button class="pc-settings-action-card pc-settings-action-blue" type="button" data-settings-action="import">
                            <span class="pc-settings-action-icon">${pcIcon('fileJsonImport', 'pc-settings-action-svg', '', { duotone: true })}</span>
                            <span class="pc-settings-action-copy">
                                <strong>导入 JSON</strong>
                                <small>完整备份恢复</small>
                            </span>
                        </button>
                        <button class="pc-settings-action-card pc-settings-action-orange" type="button" data-settings-action="import-chatgpt-vault">
                            <span class="pc-settings-action-icon">${pcIcon('chatImport', 'pc-settings-action-svg', '', { duotone: true })}</span>
                            <span class="pc-settings-action-copy">
                                <strong>导入 ChatGPT 对话</strong>
                                <small>从单条对话新建</small>
                            </span>
                        </button>
                        <button class="pc-settings-action-card pc-settings-action-purple" type="button" data-settings-action="export">
                            <span class="pc-settings-action-icon">${pcIcon('archiveZip', 'pc-settings-action-svg', '', { duotone: true })}</span>
                            <span class="pc-settings-action-copy">
                                <strong>导出完整备份</strong>
                                <small>ZIP · 包含原图</small>
                            </span>
                        </button>
                    </div>

                    <p class="pc-settings-backup-hint">完整备份使用 ZIP 保存原图；兼容 JSON 适用于旧版本和少量图片。选择自定义位置时会打开保存位置选择窗口。「重置挂机植物」仅清空首页植物进度，不影响提示词。</p>
                </section>
            </div>
        </section>
    `;
}

async function mount(pageEl, params = {}) {
    setupSettingsEvents(pageEl);
    await loadSettingsData(pageEl);
    loadDeviceInfo(pageEl);
}

async function loadSettingsData(pageEl) {
    try {
        const storage = getStorage();
        const promptSets = await storage.getPromptSets();
        let businessDataSize;

        const countEl = pageEl.querySelector('#pcStoragePromptCount');
        if (countEl) countEl.textContent = promptSets.length;

        try {
            if (storage.estimateStorageSize) {
                const size = await storage.estimateStorageSize();
                businessDataSize = size;
                const sizeEl = pageEl.querySelector('#pcStorageSizeValue');
                if (sizeEl) sizeEl.textContent = formatBytes(size);
            }
        } catch (e) {}

        await loadStorageEstimate(pageEl, businessDataSize);
        await loadDataDirectory(pageEl);
        await loadNetworkInfo(pageEl);
    } catch (e) {
        console.error('loadSettingsData error:', e);
    } finally {
        renderDownloadHistory(pageEl);
    }
}

function renderDownloadHistory(pageEl) {
    const history = getDownloadHistory();
    const countEl = pageEl.querySelector('#pcDownloadHistoryCount');
    const clearBtn = pageEl.querySelector('#pcClearDownloadHistory');
    const listEl = pageEl.querySelector('#pcDownloadHistoryList');
    if (countEl) countEl.textContent = String(history.length);
    if (clearBtn) clearBtn.disabled = !history.length;
    if (!listEl) return;

    if (!history.length) {
        listEl.innerHTML = `
            <div class="pc-settings-download-history-empty">
                <div class="pc-settings-download-history-empty-title">还没有图片下载记录</div>
                <div class="pc-settings-download-history-empty-text">下载过的图片会显示在这里，方便你快速回看和清理。</div>
            </div>
        `;
        return;
    }

    listEl.innerHTML = `<ul class="pc-settings-download-history-items" aria-label="图片下载记录">${history.map(item => {
        const platformLabel = item.platform === 'mobile' ? '移动端' : item.platform === 'pc' ? 'PC 端' : '本地';
        const filename = item.filename || item.title;
        const locationLabel = getDownloadHistoryLocationLabel(item);
        return `
        <li class="pc-settings-download-history-item">
            <span class="pc-settings-download-history-icon">${pcIcon('download', 'pc-settings-download-history-svg')}</span>
            <div class="pc-settings-download-history-main">
                <strong title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</strong>
                <span class="pc-settings-download-history-filename" title="${escapeHtml(filename)}">${escapeHtml(filename)}</span>
                <small title="${escapeHtml(locationLabel)}">${escapeHtml(item.source)} · ${escapeHtml(locationLabel)}</small>
            </div>
            <div class="pc-settings-download-history-meta">
                <span class="pc-settings-download-history-time">${escapeHtml(formatDownloadHistoryTime(item.createdAt))}</span>
                <div class="pc-settings-download-history-tags">
                    <span>${escapeHtml(platformLabel)}</span>
                    <span>${escapeHtml(getDownloadHistoryMethodLabel(item))}</span>
                </div>
            </div>
        </li>
    `;
    }).join('')}</ul>`;
}

async function loadDataDirectory(pageEl) {
    const dataDirEl = pageEl.querySelector('#pcDataDirValue');
    if (!dataDirEl) return;

    const storage = getStorage();
    if (!storage || typeof storage.getHealth !== 'function') {
        dataDirEl.textContent = '浏览器本地数据';
        dataDirEl.title = '';
        dataDirEl.dataset.rawDir = '';
        return;
    }

    try {
        const health = await storage.getHealth();
        if (health?.dataDir) {
            dataDirEl.textContent = `数据目录：${health.dataDir}`;
            dataDirEl.title = health.dataDir;
            dataDirEl.dataset.rawDir = health.dataDir;
        } else {
            dataDirEl.textContent = '数据目录已保护';
            dataDirEl.title = '';
            dataDirEl.dataset.rawDir = '';
        }
    } catch (e) {
        dataDirEl.textContent = '数据目录检测失败';
        dataDirEl.title = '';
        dataDirEl.dataset.rawDir = '';
    }
}

async function loadStorageEstimate(pageEl, businessDataSize) {
    const availableEl = pageEl.querySelector('#pcStorageAvailable');
    const totalEl = pageEl.querySelector('#pcStorageTotal');
    const ringEl = pageEl.querySelector('#pcStorageRing');
    const ringValueEl = pageEl.querySelector('#pcStorageRingValue');
    const ticksEl = pageEl.querySelector('#pcStorageTicks');

    try {
        if (!navigator.storage || !navigator.storage.estimate) {
            if (availableEl) availableEl.textContent = '浏览器未提供';
            if (totalEl) totalEl.textContent = '-';
            if (ticksEl) ticksEl.innerHTML = renderStorageTicks(0);
            return;
        }

        const estimate = await navigator.storage.estimate();
        const usage = estimate.usage || 0;
        const quota = estimate.quota || 0;
        const progressUsage = Number.isFinite(businessDataSize) ? businessDataSize : usage;
        const available = Math.max(quota - progressUsage, 0);
        const usagePercent = quota > 0 ? Math.min((progressUsage / quota) * 100, 100) : 0;
        const ringPercent = usagePercent > 0 ? Math.max(usagePercent, 1) : 0;
        const percentLabel = usagePercent > 0 && usagePercent < 1
            ? '<1%'
            : `${Math.round(usagePercent)}%`;
        const litTicks = usagePercent <= 0
            ? 0
            : Math.max(1, Math.min(STORAGE_TICK_COUNT, Math.round((usagePercent / 100) * STORAGE_TICK_COUNT)));

        if (availableEl) availableEl.textContent = formatBytes(available);
        if (totalEl) totalEl.textContent = quota ? formatBytes(quota) : '-';
        if (ringEl) ringEl.style.setProperty('--ring-percent', `${ringPercent}%`);
        if (ringValueEl) ringValueEl.textContent = percentLabel;
        if (ticksEl) ticksEl.innerHTML = renderStorageTicks(litTicks);
    } catch (e) {
        if (availableEl) availableEl.textContent = '检测失败';
        if (totalEl) totalEl.textContent = '-';
        if (ticksEl) ticksEl.innerHTML = renderStorageTicks(0);
    }
}

async function loadNetworkInfo(pageEl) {
    const ipEl = pageEl.querySelector('#pcSyncIpDisplay');
    const statusEl = pageEl.querySelector('#pcSyncStatus');
    const badgeEl = pageEl.querySelector('#pcSyncCapabilityBadge');
    const badgeTextEl = badgeEl?.querySelector('.pc-settings-sync-badge-text') || badgeEl;
    const capabilityEl = pageEl.querySelector('#pcSyncCapabilityLine');
    try {
        const storage = getStorage();
        const apiBase = await resolveApiBase();
        const info = storage.getNetworkInfo
            ? await storage.getNetworkInfo()
            : await fetch(`${apiBase}/api/network-info`).then(res => res.json());
        const capabilities = storage.getSyncCapabilities
            ? await storage.getSyncCapabilities()
            : await fetch(`${apiBase}/api/sync/capabilities`).then(res => res.ok ? res.json() : null).catch(() => null);
        const ip = info.ip || '无法获取';
        const port = info.port || 8888;
        const address = ip === '无法获取' ? '' : `http://${ip}:${port}`;
        if (ipEl) {
            ipEl.textContent = address ? address : '同步服务：无法获取本机 IP';
            ipEl.dataset.address = address;
        }
        if (badgeTextEl) {
            badgeTextEl.textContent = capabilities?.capabilities?.includes('bidirectional') ? '双向就绪' : 'PC 服务端';
        }
        if (capabilityEl) {
            const list = Array.isArray(capabilities?.capabilities) ? capabilities.capabilities : ['pull'];
            const labels = list.map(item => ({
                pull: 'Android 拉取',
                push: 'Android 回传',
                bidirectional: '双向同步',
                pairing: '配对令牌',
            }[item] || item));
            capabilityEl.textContent = `互通能力：${labels.join(' / ')}`;
        }
        if (statusEl) {
            statusEl.innerHTML = `<div class="pc-sync-status" role="status">服务端已就绪，同 ID 冲突自动保留 PC 数据并生成副本</div>`;
        }
    } catch (e) {
        if (ipEl) {
            ipEl.textContent = '同步服务：无法获取';
            ipEl.dataset.address = '';
        }
        if (statusEl) {
            statusEl.innerHTML = `<div class="pc-sync-status pc-sync-status-error" role="alert">无法读取网络信息：${escapeHtml(e.message || '未知错误')}</div>`;
        }
        if (badgeTextEl) badgeTextEl.textContent = '检测失败';
        if (capabilityEl) capabilityEl.textContent = '互通能力：无法获取';
    }
}

function loadDeviceInfo(pageEl) {
    const envEl = pageEl.querySelector('#pcEnvValue');
    if (envEl) {
        if (window.__TAURI__) {
            envEl.textContent = 'Tauri 桌面端';
        } else if (isCapacitor) {
            envEl.textContent = 'Capacitor 移动端';
        } else {
            envEl.textContent = '浏览器';
        }
    }

    const storageTypeEl = pageEl.querySelector('#pcStorageType');
    if (storageTypeEl) {
        const storage = getStorage();
        if (storage && storage.constructor) {
            const name = storage.constructor.name;
            if (name.includes('SQLite')) storageTypeEl.textContent = 'SQLite 数据库';
            else if (name.includes('Api')) storageTypeEl.textContent = 'API 存储';
            else storageTypeEl.textContent = '本地存储';
        }
    }
}

function setupAppearanceSelect(pageEl) {
    const root = pageEl.querySelector('#pcAppearancePicker');
    const modeCards = Array.from(pageEl.querySelectorAll('[data-appearance-card]'));
    if (!root && !modeCards.length) return;

    const trigger = root?.querySelector('.pc-theme-appearance-trigger');
    const menu = root?.querySelector('.pc-theme-appearance-menu');
    const valueEl = root?.querySelector('.pc-theme-appearance-value');
    const options = root ? Array.from(root.querySelectorAll('.pc-theme-appearance-option')) : [];

    let activeIndex = options.length
        ? Math.max(0, options.findIndex(option => option.dataset.value === root.dataset.value))
        : 0;

    const setOpen = (open) => {
        if (!root || !trigger || !menu) return;
        root.classList.toggle('pc-theme-appearance-open', open);
        trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
        menu.hidden = !open;
        if (open) {
            activeIndex = Math.max(0, options.findIndex(option => option.dataset.value === root.dataset.value));
            options.forEach((option, index) => option.classList.toggle('pc-theme-appearance-option-active', index === activeIndex));
        }
    };

    const syncAppearanceControls = (value) => {
        const label = APPEARANCE_LABELS[value] || value;
        if (root) root.dataset.value = value;
        if (valueEl) valueEl.textContent = label;
        options.forEach(option => {
            const selected = option.dataset.value === value;
            option.setAttribute('aria-selected', selected ? 'true' : 'false');
            option.classList.toggle('pc-theme-appearance-option-active', selected);
        });
        modeCards.forEach(card => {
            const selected = card.dataset.appearanceCard === value;
            card.classList.toggle('is-active', selected);
            card.setAttribute('aria-checked', selected ? 'true' : 'false');
        });
    };

    const commitValue = (value, { restoreTriggerFocus = false } = {}) => {
        syncAppearanceControls(value);
        setAppearancePreference(value);
        showToast('外观模式已更新');
        setOpen(false);
        if (restoreTriggerFocus && trigger) {
            trigger.focus();
        }
    };

    modeCards.forEach(card => {
        card.addEventListener('click', () => {
            commitValue(card.dataset.appearanceCard);
        });
    });

    if (!root || !trigger || !menu || !valueEl || !options.length) return;

    trigger.addEventListener('click', () => {
        setOpen(menu.hidden);
    });

    trigger.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(true);
            options[activeIndex]?.focus();
            return;
        }
        if (e.key === 'Escape') setOpen(false);
    });

    options.forEach((option, index) => {
        option.addEventListener('click', () => commitValue(option.dataset.value, { restoreTriggerFocus: true }));
        option.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const delta = e.key === 'ArrowDown' ? 1 : -1;
                activeIndex = (index + delta + options.length) % options.length;
                options.forEach((item, i) => item.classList.toggle('pc-theme-appearance-option-active', i === activeIndex));
                options[activeIndex].focus();
                return;
            }
            if (e.key === 'Home') {
                e.preventDefault();
                activeIndex = 0;
                options[0].focus();
                return;
            }
            if (e.key === 'End') {
                e.preventDefault();
                activeIndex = options.length - 1;
                options[activeIndex].focus();
                return;
            }
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                commitValue(option.dataset.value, { restoreTriggerFocus: true });
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setOpen(false);
                trigger.focus();
                return;
            }
            if (e.key === 'Tab') {
                setOpen(false);
            }
        });
    });

    const onDocPointerDown = (e) => {
        if (!root.isConnected) {
            document.removeEventListener('pointerdown', onDocPointerDown);
            return;
        }
        if (!root.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDocPointerDown);
}

function setupSettingsEvents(pageEl) {
    pageEl.querySelector('#pcThemePicker')?.addEventListener('click', async (e) => {
        const dot = e.target.closest('.pc-theme-dot');
        if (!dot) return;
        const theme = dot.dataset.workbenchTheme;
        const themeItem = WORKBENCH_THEMES.find(item => item.key === theme);
        setWorkbenchTheme(theme);
        pageEl.querySelectorAll('.pc-theme-dot').forEach(d => {
            d.classList.remove('pc-theme-active');
            d.setAttribute('aria-checked', 'false');
        });
        dot.classList.add('pc-theme-active');
        dot.setAttribute('aria-checked', 'true');
        const activeBadge = pageEl.querySelector('#pcActiveThemeBadge');
        if (activeBadge && themeItem) {
            activeBadge.textContent = themeItem.name;
        }
        showToast(`已切换为${themeItem?.name || '新'}主题`);
    });

    setupAppearanceSelect(pageEl);

    pageEl.querySelectorAll('[data-settings-action]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const action = btn.dataset.settingsAction;
            if (action === 'export') {
                await handleExport(pageEl);
                return;
            }
            if (action === 'export-json') {
                await handleJsonExport(pageEl);
                return;
            }
            if (action === 'import') {
                handleBackupImport(pageEl);
                return;
            }
            if (action === 'import-chatgpt-vault') {
                handleChatGptVaultImport(pageEl);
                return;
            }
            if (action === 'reset-plant') {
                showConfirmModal('确定重置挂机植物吗？将回到第 1 天，不影响提示词数据。', async () => {
                    try {
                        let apiStorage = null;
                        try { apiStorage = getStorage(); } catch { apiStorage = null; }
                        await resetPlant(apiStorage);
                        showToast('挂机植物已重置为第 1 天');
                    } catch (e) {
                        showToast(getErrorMessage(e) || '重置植物失败', 'error');
                    }
                });
            }
        });
    });

    pageEl.querySelector('#pcCopyDataDir')?.addEventListener('click', async () => {
        const rawDir = pageEl.querySelector('#pcDataDirValue')?.dataset.rawDir;
        if (!rawDir) {
            showToast('当前环境无独立本地目录路径');
            return;
        }
        await copyToClipboard(rawDir);
    });

    pageEl.querySelector('#pcCopySyncAddress')?.addEventListener('click', async () => {
        const address = pageEl.querySelector('#pcSyncIpDisplay')?.dataset.address;
        if (!address) {
            showToast('暂无可复制的同步地址', 'error');
            return;
        }
        await copyToClipboard(address);
    });

    pageEl.querySelector('#pcRefreshNetworkInfo')?.addEventListener('click', async () => {
        await loadNetworkInfo(pageEl);
        showToast('网络信息已刷新');
    });

    pageEl.querySelector('#pcClearDownloadHistory')?.addEventListener('click', () => {
        const history = getDownloadHistory();
        if (!history.length) {
            showToast('暂无图片下载记录');
            return;
        }
        showConfirmModal('确定要清空所有图片下载记录吗？', () => {
            clearDownloadHistory();
            renderDownloadHistory(pageEl);
            showToast('图片下载记录已清空');
        });
    });

    pageEl.querySelector('#pcCheckUpdateBtn')?.addEventListener('click', async () => {
        const btn = pageEl.querySelector('#pcCheckUpdateBtn');
        const hint = pageEl.querySelector('#pcUpdateStatusHint');
        if (btn) btn.disabled = true;
        if (hint) hint.textContent = '正在检查更新…';
        try {
            const result = await runManualUpdateCheck();
            if (hint) {
                hint.textContent = formatUpdateCheckHint(result);
            }
        } finally {
            if (btn) btn.disabled = false;
        }
    });
}

async function handleExport(pageEl) {
    try {
        const storage = getStorage();
        const saveMode = pageEl.querySelector('input[name="pcExportMode"]:checked')?.value || 'downloads';
        const result = await exportZipBackup(storage, { saveMode });
        if (!result.canceled) {
            showToast(buildExportSuccessMessage(result));
        }
    } catch (e) {
        console.error('export backup failed:', e);
        showToast(`导出失败：${getErrorMessage(e)}`, 'error');
    }
}

async function handleJsonExport(pageEl) {
    try {
        const storage = getStorage();
        const saveMode = pageEl.querySelector('input[name="pcExportMode"]:checked')?.value || 'downloads';
        const result = await exportBackup(storage, { saveMode });
        if (!result.canceled) {
            showToast(buildExportSuccessMessage(result, '兼容 JSON 导出成功'));
        }
    } catch (e) {
        console.error('export json backup failed:', e);
        showToast(`兼容 JSON 导出失败：${getErrorMessage(e)}`, 'error');
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

function handleBackupImport(pageEl) {
    openJsonImportPicker(async (file) => {
        try {
            const data = await readJsonFile(file);
            if (normalizeChatGptVaultConversationImport(data)) {
                showToast('这是对话归档 JSON，请使用“导入 ChatGPT 对话”', 'error');
                return;
            }
            const storage = getStorage();
            const result = await storage.importData(data);
            const updated = result.updated || 0;
            const added = result.added || 0;
            const images = result.imagesRestored || 0;
            showToast(`导入成功：新增 ${added} 条，覆盖 ${updated} 条，恢复 ${images} 张图片`);
            await loadSettingsData(pageEl);
        } catch (err) {
            showToast('导入失败，文件格式不正确', 'error');
        }
    });
}

function handleChatGptVaultImport(pageEl) {
    openJsonImportPicker(async (file) => {
        try {
            const data = await readJsonFile(file);
            const promptPayload = await stageChatGptVaultConversationImport(data);
            if (!promptPayload) {
                showToast('请选择 ChatGPT Vault 单条对话归档 JSON', 'error');
                return;
            }
            navigate('/editor/', { importId: promptPayload.id });
            showToast('已打开 ChatGPT 对话导入页');
        } catch (err) {
            showToast(getJsonImportErrorMessage(err), 'error');
        }
    });
}

function getJsonImportErrorMessage(err) {
    if (isPromptImageToolImportStorageError(err)) {
        return '导入文件过大，暂存失败，请减少图片数量或重新导出';
    }
    return '导入失败，文件格式不正确';
}

function unmount(pageEl) {
    settingsData = null;
}

export { render, mount, unmount };
