import { getVersion } from './version-info.js';
import { showToast, showConfirmModal, escapeHtml } from './pc-utils.js';
import { openUpdateProgressModal } from './update-progress-modal.js';

const CHECK_URL = '/api/update/check';
const DOWNLOAD_URL = '/api/update/download';
const CANCEL_URL = '/api/update/download/cancel';
const PROGRESS_URL = '/api/update/progress';
const INSTALL_URL = '/api/update/install';
const LAST_SKIP_KEY = 'pc-update-skip-version';
const POLL_INTERVAL_MS = 250;

const TERMINAL_PHASES = new Set(['ready', 'failed', 'cancelled']);

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

export async function startDownloadUpdate(latest) {
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

export async function fetchUpdateProgress(jobId) {
    if (!jobId) {
        throw new Error('缺少下载任务 ID');
    }
    const response = await fetch(`${PROGRESS_URL}?jobId=${encodeURIComponent(jobId)}`, {
        method: 'GET',
    });
    return readJson(response);
}

export async function cancelUpdateDownload(jobId) {
    if (!jobId) {
        throw new Error('缺少下载任务 ID');
    }
    const response = await fetch(CANCEL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
    });
    return readJson(response);
}

export async function pollUpdateProgress(jobId, { onUpdate, intervalMs = POLL_INTERVAL_MS, signal } = {}) {
    // eslint-disable-next-line no-constant-condition
    while (true) {
        if (signal?.aborted) {
            const error = new Error('已停止轮询');
            error.name = 'AbortError';
            throw error;
        }
        const progress = await fetchUpdateProgress(jobId);
        onUpdate?.(progress);
        if (TERMINAL_PHASES.has(progress.phase)) {
            return progress;
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
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

    return runUpdateWithProgressModal(latest);
}

export async function runUpdateWithProgressModal(latest) {
    const session = {
        cancelled: false,
        controller: null,
        currentJobId: '',
    };

    const cancelActiveDownload = async () => {
        session.cancelled = true;
        if (session.currentJobId) {
            try {
                await cancelUpdateDownload(session.currentJobId);
            } catch {
                // ignore
            }
        }
        session.controller?.abort();
    };

    const modal = openUpdateProgressModal({
        onCancel: cancelActiveDownload,
        onRetry: () => {
            session.controller?.abort();
            session.cancelled = false;
            session.currentJobId = '';
            session.controller = null;
            runUpdateSession();
        },
    });

    async function runUpdateSession() {
        if (session.cancelled || !modal.isActive()) {
            return { updated: false, cancelled: true };
        }
        try {
            modal.setProgress({ phase: 'pending', percent: 0 });
            const started = await startDownloadUpdate(latest);
            session.currentJobId = started.jobId;
            session.controller = new AbortController();

            const progress = await pollUpdateProgress(session.currentJobId, {
                signal: session.controller.signal,
                onUpdate: (payload) => modal.setProgress(payload),
            });

            if (session.cancelled || progress.phase === 'cancelled') {
                modal.setProgress({ ...progress, phase: 'cancelled' });
                return { updated: false, cancelled: true };
            }

            if (progress.phase === 'failed') {
                modal.setProgress(progress);
                showToast(`更新失败：${progress.error || '未知错误'}`, 'error');
                return { updated: false, error: progress.error };
            }

            modal.setProgress({ ...progress, phase: 'installing' });
            await installDownloadedUpdate(progress.path);
            modal.setProgress({ ...progress, phase: 'ready' });
            showToast('安装程序已启动，应用即将退出');
            setTimeout(() => modal.close(), 1200);
            return { updated: true };
        } catch (error) {
            if (error?.name === 'AbortError' || session.cancelled) {
                modal.setProgress({ phase: 'cancelled', percent: 0 });
                return { updated: false, cancelled: true };
            }
            modal.setProgress({ phase: 'failed', error: error.message });
            showToast(`更新失败：${error.message}`, 'error');
            return { updated: false, error: error.message };
        }
    }

    return runUpdateSession();
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
