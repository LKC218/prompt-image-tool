import { getStorage, isCapacitor } from './storage.js';
import { navigate } from './pc-app.js';
import { showToast, showConfirmModal, escapeHtml, formatBytes, copyToClipboard } from './pc-utils.js';
import { APPEARANCE_PREFERENCES, WORKBENCH_THEMES } from './theme-config.js';
import { getThemeState, setAppearancePreference, setWorkbenchTheme } from './theme-service.js';
import { buildExportSuccessMessage, exportBackup, exportZipBackup, getErrorMessage } from './backup-utils.js';
import { clearDownloadHistory, formatDownloadHistoryTime, getDownloadHistory, getDownloadHistoryLocationLabel } from './download-history.js';
import { renderPcWelcomeBanner, renderPcWelcomeWalkAnimation } from './pc-welcome-banner.js';
import { renderVersionInfo } from './version-info.js';
import {
    isPromptImageToolImportStorageError,
    normalizeChatGptVaultConversationImport,
    stageChatGptVaultConversationImport,
} from './prompt-tool-json-import.js';
import themeColorIcon from '../assets/icons/settings/theme-color.png';
import exportJsonIcon from '../assets/icons/settings/export-json.svg';
import importDataIcon from '../assets/icons/settings/import-data.svg';
import importJsonIcon from '../assets/icons/settings/import-json.svg';
import syncServerIcon from '../assets/icons/settings/sync-server.svg';
import downloadHistoryIcon from '../assets/icons/pc/download.svg';

let settingsData = null;

function iconImg(icon, alt = '') {
    return `<img src="${icon}" alt="${alt}" aria-hidden="${alt ? 'false' : 'true'}">`;
}

function render(params = {}) {
    const themeState = getThemeState();
    return `
        ${renderPcWelcomeBanner({
            title: '设置',
            subtitle: '一切数据仅在本地，安全又放心~',
            className: 'pc-welcome-banner-settings',
            decorationsHtml: renderPcWelcomeWalkAnimation({ variant: 'settings' })
        })}

        <section class="pc-settings-page">
            <div class="pc-settings-overview">
                <section class="pc-settings-panel pc-settings-appearance" aria-labelledby="pcAppearanceTitle">
                    <h2 id="pcAppearanceTitle" class="pc-settings-panel-title">外观设置</h2>
                    <div class="pc-settings-list">
                        <div class="pc-settings-list-row">
                            <div class="pc-settings-list-left">
                                <span class="pc-settings-list-image-icon">${iconImg(themeColorIcon)}</span>
                                <span>工作台主题</span>
                            </div>
                            <div class="pc-theme-dots" id="pcThemePicker" role="radiogroup" aria-label="工作台主题">
                                ${WORKBENCH_THEMES.map(theme => `
                                    <button class="pc-theme-dot ${theme.key === themeState.workbenchTheme ? 'pc-theme-active' : ''}" type="button" role="radio" aria-checked="${theme.key === themeState.workbenchTheme ? 'true' : 'false'}" data-workbench-theme="${theme.key}" style="--dot-color:${theme.color};" title="${theme.name}" aria-label="${theme.name}"></button>
                                `).join('')}
                            </div>
                        </div>
                        <div class="pc-settings-list-row">
                            <div class="pc-settings-list-left"><span>外观模式</span></div>
                            <select class="pc-theme-appearance-select" id="pcAppearancePicker" aria-label="外观模式">
                                ${APPEARANCE_PREFERENCES.map(value => `<option value="${value}" ${value === themeState.appearancePreference ? 'selected' : ''}>${({ light: '浅色', dark: '深色', system: '跟随系统', scheduled: '定时切换' })[value]}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                </section>

                <section class="pc-settings-panel pc-settings-storage-panel" aria-labelledby="pcStorageTitle">
                    <h2 id="pcStorageTitle" class="pc-settings-panel-title">本地存储</h2>
                    <div class="pc-settings-storage-grid">
                        <div class="pc-settings-storage-tile pc-settings-storage-size">
                            <div class="pc-settings-storage-kicker">
                                <span class="pc-settings-storage-dot"></span>
                                本地数据大小
                            </div>
                            <div class="pc-settings-storage-number"><span id="pcStorageSizeValue">-</span></div>
                            <div class="pc-settings-storage-caption">已使用</div>
                        </div>
                        <div class="pc-settings-storage-tile pc-settings-space-tile">
                            <div>
                                <div class="pc-settings-storage-subtitle">存储空间</div>
                                <div class="pc-settings-space-line">可用 <span id="pcStorageAvailable">检测中</span></div>
                                <div class="pc-settings-space-line">共 <span id="pcStorageTotal">-</span></div>
                            </div>
                            <div class="pc-storage-ring pc-settings-storage-ring" id="pcStorageRing" style="--ring-percent:0%;">
                                <span class="pc-storage-ring-value" id="pcStorageRingValue">0%</span>
                            </div>
                        </div>
                    </div>
                    <div class="pc-settings-meta-row">
                        <span>提示词 <strong id="pcStoragePromptCount">-</strong> 条</span>
                        <span id="pcEnvValue">浏览器</span>
                        <span id="pcStorageType">本地存储</span>
                        <span class="pc-settings-data-dir" id="pcDataDirValue" title="">数据目录检测中</span>
                        ${renderVersionInfo({ tag: 'span', className: 'pc-version-info', label: '' })}
                    </div>
                </section>
            </div>

            <section class="pc-settings-panel pc-settings-backup-panel" aria-labelledby="pcBackupTitle">
                <div class="pc-settings-backup-head">
                    <h2 id="pcBackupTitle" class="pc-settings-panel-title">数据备份与恢复</h2>
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
                </div>
                <div class="pc-settings-action-grid pc-settings-action-grid-three">
                    <button class="pc-settings-action-card pc-settings-action-blue" type="button" data-settings-action="import">
                        <span class="pc-settings-action-icon">${iconImg(importJsonIcon)}</span>
                        <span class="pc-settings-action-copy">
                            <strong>导入 JSON</strong>
                            <small>完整备份恢复</small>
                        </span>
                    </button>
                    <button class="pc-settings-action-card pc-settings-action-orange" type="button" data-settings-action="import-chatgpt-vault">
                        <span class="pc-settings-action-icon">${iconImg(importDataIcon)}</span>
                        <span class="pc-settings-action-copy">
                            <strong>导入 ChatGPT 对话</strong>
                            <small>从单条对话新建</small>
                        </span>
                    </button>
                    <button class="pc-settings-action-card pc-settings-action-purple" type="button" data-settings-action="export">
                        <span class="pc-settings-action-icon">${iconImg(exportJsonIcon)}</span>
                        <span class="pc-settings-action-copy">
                            <strong>导出完整备份</strong>
                            <small>ZIP · 包含原图</small>
                        </span>
                    </button>
                </div>
                <button class="pc-btn pc-btn-secondary pc-btn-sm" type="button" data-settings-action="export-json">导出兼容 JSON</button>
                <p class="pc-settings-backup-hint">完整备份使用 ZIP 保存原图；兼容 JSON 适用于旧版本和少量图片。选择自定义位置时会打开保存位置选择窗口。</p>
            </section>

            <section class="pc-settings-panel pc-settings-download-history-panel" aria-labelledby="pcDownloadHistoryTitle">
                <div class="pc-settings-download-history-head">
                    <h2 id="pcDownloadHistoryTitle" class="pc-settings-panel-title">图片下载记录</h2>
                    <div class="pc-settings-download-history-actions">
                        <span class="pc-settings-download-history-count" id="pcDownloadHistoryCount">0</span>
                        <button class="pc-btn pc-btn-danger-outline pc-btn-sm" type="button" id="pcClearDownloadHistory">清空历史</button>
                    </div>
                </div>
                <div class="pc-settings-download-history-list" id="pcDownloadHistoryList"></div>
            </section>

            <section class="pc-settings-panel pc-settings-sync-panel" aria-labelledby="pcSyncTitle">
                <div class="pc-settings-sync-head">
                    <h2 id="pcSyncTitle" class="pc-settings-panel-title">局域网互通</h2>
                    <span class="pc-settings-sync-badge" id="pcSyncCapabilityBadge">检测中</span>
                </div>
                <div class="pc-settings-sync-body">
                    <span class="pc-settings-sync-icon">${iconImg(syncServerIcon)}</span>
                    <div class="pc-settings-sync-copy">
                        <div class="pc-sync-ip-display" id="pcSyncIpDisplay">同步服务：检测中...</div>
                        <div class="pc-sync-hint" id="pcSyncHint">Android 可在设置页搜索此 PC，支持拉取、回传与双向同步。</div>
                        <div class="pc-sync-capability-line" id="pcSyncCapabilityLine">互通能力：检测中...</div>
                        <div id="pcSyncStatus" aria-live="polite"></div>
                    </div>
                    <div class="pc-sync-ip-input-wrap">
                        <button class="pc-btn pc-btn-primary pc-btn-sm" id="pcCopySyncAddress">复制地址</button>
                        <button class="pc-btn pc-btn-secondary pc-btn-sm" id="pcRefreshNetworkInfo">刷新</button>
                    </div>
                </div>
            </section>

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

        const countEl = pageEl.querySelector('#pcStoragePromptCount');
        if (countEl) countEl.textContent = promptSets.length;

        try {
            if (storage.estimateStorageSize) {
                const size = await storage.estimateStorageSize();
                const sizeEl = pageEl.querySelector('#pcStorageSizeValue');
                if (sizeEl) sizeEl.textContent = formatBytes(size);
            }
        } catch (e) {}

        await loadStorageEstimate(pageEl);
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
    const listEl = pageEl.querySelector('#pcDownloadHistoryList');
    if (countEl) countEl.textContent = String(history.length);
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

    listEl.innerHTML = history.map(item => `
        <div class="pc-settings-download-history-item">
            <span class="pc-settings-download-history-icon">${iconImg(downloadHistoryIcon)}</span>
            <div class="pc-settings-download-history-main">
                <strong title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</strong>
                <small>${escapeHtml(item.source)} · ${escapeHtml(getDownloadHistoryLocationLabel(item))}</small>
            </div>
            <div class="pc-settings-download-history-meta">
                <span>${escapeHtml(formatDownloadHistoryTime(item.createdAt))}</span>
                <span>${escapeHtml(item.platform === 'mobile' ? '移动端' : item.platform === 'pc' ? 'PC 端' : '')}</span>
            </div>
        </div>
    `).join('');
}

async function loadDataDirectory(pageEl) {
    const dataDirEl = pageEl.querySelector('#pcDataDirValue');
    if (!dataDirEl) return;

    const storage = getStorage();
    if (!storage || typeof storage.getHealth !== 'function') {
        dataDirEl.textContent = '浏览器本地数据';
        dataDirEl.title = '';
        return;
    }

    try {
        const health = await storage.getHealth();
        if (health?.dataDir) {
            dataDirEl.textContent = `数据目录：${health.dataDir}`;
            dataDirEl.title = health.dataDir;
        } else {
            dataDirEl.textContent = '数据目录已保护';
            dataDirEl.title = '';
        }
    } catch (e) {
        dataDirEl.textContent = '数据目录检测失败';
        dataDirEl.title = '';
    }
}

async function loadStorageEstimate(pageEl) {
    const availableEl = pageEl.querySelector('#pcStorageAvailable');
    const totalEl = pageEl.querySelector('#pcStorageTotal');
    const ringEl = pageEl.querySelector('#pcStorageRing');
    const ringValueEl = pageEl.querySelector('#pcStorageRingValue');

    try {
        if (!navigator.storage || !navigator.storage.estimate) {
            if (availableEl) availableEl.textContent = '浏览器未提供';
            if (totalEl) totalEl.textContent = '-';
            return;
        }

        const estimate = await navigator.storage.estimate();
        const usage = estimate.usage || 0;
        const quota = estimate.quota || 0;
        const available = Math.max(quota - usage, 0);
        const percent = quota > 0 ? Math.min(Math.round((usage / quota) * 100), 100) : 0;

        if (availableEl) availableEl.textContent = formatBytes(available);
        if (totalEl) totalEl.textContent = quota ? formatBytes(quota) : '-';
        if (ringEl) ringEl.style.setProperty('--ring-percent', `${percent}%`);
        if (ringValueEl) ringValueEl.textContent = `${percent}%`;
    } catch (e) {
        if (availableEl) availableEl.textContent = '检测失败';
        if (totalEl) totalEl.textContent = '-';
    }
}

async function loadNetworkInfo(pageEl) {
    const ipEl = pageEl.querySelector('#pcSyncIpDisplay');
    const statusEl = pageEl.querySelector('#pcSyncStatus');
    const badgeEl = pageEl.querySelector('#pcSyncCapabilityBadge');
    const capabilityEl = pageEl.querySelector('#pcSyncCapabilityLine');
    try {
        const storage = getStorage();
        const info = storage.getNetworkInfo
            ? await storage.getNetworkInfo()
            : await fetch('/api/network-info').then(res => res.json());
        const capabilities = storage.getSyncCapabilities
            ? await storage.getSyncCapabilities()
            : await fetch('/api/sync/capabilities').then(res => res.ok ? res.json() : null).catch(() => null);
        const ip = info.ip || '无法获取';
        const port = info.port || 8888;
        const address = ip === '无法获取' ? '' : `http://${ip}:${port}`;
        if (ipEl) {
            ipEl.textContent = address ? `同步服务：${address}` : '同步服务：无法获取本机 IP';
            ipEl.dataset.address = address;
        }
        if (badgeEl) {
            badgeEl.textContent = capabilities?.capabilities?.includes('bidirectional') ? '支持双向' : 'PC 服务端';
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
            statusEl.innerHTML = `<div class="pc-sync-status" role="status">服务端已就绪，Android 回传遇到同 ID 冲突会保留 PC 数据并生成副本</div>`;
        }
    } catch (e) {
        if (ipEl) {
            ipEl.textContent = '同步服务：无法获取';
            ipEl.dataset.address = '';
        }
        if (statusEl) {
            statusEl.innerHTML = `<div class="pc-sync-status pc-sync-status-error" role="alert">无法读取网络信息：${escapeHtml(e.message || '未知错误')}</div>`;
        }
        if (badgeEl) badgeEl.textContent = '检测失败';
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

function setupSettingsEvents(pageEl) {
    pageEl.querySelector('#pcThemePicker')?.addEventListener('click', async (e) => {
        const dot = e.target.closest('.pc-theme-dot');
        if (!dot) return;
        const theme = dot.dataset.workbenchTheme;
        setWorkbenchTheme(theme);
        pageEl.querySelectorAll('.pc-theme-dot').forEach(d => {
            d.classList.remove('pc-theme-active');
            d.setAttribute('aria-checked', 'false');
        });
        dot.classList.add('pc-theme-active');
        dot.setAttribute('aria-checked', 'true');
        showToast(`已切换为${WORKBENCH_THEMES.find(item => item.key === theme)?.name || '新'}主题`);
    });

    pageEl.querySelector('#pcAppearancePicker')?.addEventListener('change', (e) => {
        setAppearancePreference(e.target.value);
        showToast('外观模式已更新');
    });

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
            }
        });
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
