import { getVersion } from './version-info.js';
import { showToast, showConfirmModal, escapeHtml } from './pc-utils.js';

const CHECK_URL = '/api/update/check';
const DOWNLOAD_URL = '/api/update/download';
const INSTALL_URL = '/api/update/install';
const LAST_SKIP_KEY = 'pc-update-skip-version';

async function readJson(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
        throw new Error(data.error || `请求失败 (${response.status})`);
    }
    return data;
}

function confirmUpdate(version) {
    return new Promise((resolve) => {
        showConfirmModal(
            `当前版本 v${escapeHtml(getVersion())}，可更新到 v${escapeHtml(version)}。是否下载并安装？安装完成后应用会自动退出。`,
            () => resolve(true)
        );
        const cancel = document.getElementById('pcModalCancel');
        if (cancel) {
            cancel.addEventListener('click', () => resolve(false), { once: true });
        }
    });
}

export async function checkForUpdate({ silent = false, localVersion } = {}) {
    const local = localVersion || getVersion();
    const url = `${CHECK_URL}?localVersion=${encodeURIComponent(local)}`;
    try {
        const response = await fetch(url, { method: 'GET' });
        const data = await readJson(response);
        return data;
    } catch (error) {
        if (!silent) {
            showToast(`检查更新失败：${error.message}`, 'error');
        }
        return { success: false, hasUpdate: false, error: error.message };
    }
}

export async function downloadUpdateInstaller(latest) {
    if (!latest?.url || !latest?.sha256) {
        throw new Error('更新元数据不完整');
    }
    const response = await fetch(DOWNLOAD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: latest.url, sha256: latest.sha256 }),
    });
    return readJson(response);
}

export async function installDownloadedUpdate(installerPath) {
    if (!installerPath) {
        throw new Error('缺少安装包路径');
    }
    const response = await fetch(INSTALL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: installerPath }),
    });
    return readJson(response);
}

export function getSkippedUpdateVersion() {
    try {
        return localStorage.getItem(LAST_SKIP_KEY) || '';
    } catch {
        return '';
    }
}

export function skipUpdateVersion(version) {
    try {
        localStorage.setItem(LAST_SKIP_KEY, version || '');
    } catch {
        // ignore
    }
}

export function clearSkippedUpdateVersion() {
    try {
        localStorage.removeItem(LAST_SKIP_KEY);
    } catch {
        // ignore
    }
}

export async function promptAndInstallUpdate(latest) {
    const version = latest?.version || '';
    const confirmed = await confirmUpdate(version);
    if (!confirmed) {
        skipUpdateVersion(version);
        return { updated: false, skipped: true };
    }

    showToast('正在下载更新，请稍候…', 'info');
    try {
        const download = await downloadUpdateInstaller(latest);
        showToast('下载完成，正在启动安装…');
        await installDownloadedUpdate(download.path);
        showToast('安装程序已启动，应用即将退出');
        return { updated: true };
    } catch (error) {
        showToast(`更新失败：${error.message}`, 'error');
        return { updated: false, error: error.message };
    }
}

export async function runStartupUpdateCheck() {
    const result = await checkForUpdate({ silent: true });
    if (!result?.hasUpdate || !result.latest) {
        return result;
    }
    const skipped = getSkippedUpdateVersion();
    if (skipped && skipped === result.latest.version) {
        return { ...result, skipped: true };
    }
    await promptAndInstallUpdate(result.latest);
    return result;
}

export async function runManualUpdateCheck() {
    showToast('正在检查更新…', 'info');
    const result = await checkForUpdate({ silent: false });
    if (!result.success) {
        return result;
    }
    if (!result.hasUpdate) {
        showToast(`已是最新版本 v${result.localVersion}`);
        return result;
    }
    clearSkippedUpdateVersion();
    await promptAndInstallUpdate(result.latest);
    return result;
}
