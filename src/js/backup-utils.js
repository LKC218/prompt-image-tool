const JSON_MIME = 'application/json;charset=utf-8';
const DEFAULT_PREFIX = 'prompt-backup';
const DOWNLOAD_CLEANUP_DELAY_MS = 30000;

function pad2(value) {
    return String(value).padStart(2, '0');
}

function buildBackupFilename(prefix = DEFAULT_PREFIX, date = new Date()) {
    const year = date.getFullYear();
    const month = pad2(date.getMonth() + 1);
    const day = pad2(date.getDate());
    const hour = pad2(date.getHours());
    const minute = pad2(date.getMinutes());
    const second = pad2(date.getSeconds());
    return `${prefix}-${year}-${month}-${day}-${hour}${minute}${second}.json`;
}

function formatBackupSize(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex++;
    }
    return `${parseFloat(value.toFixed(1))} ${units[unitIndex]}`;
}

function getPromptSets(data) {
    if (!data || typeof data !== 'object') return [];
    if (Array.isArray(data.prompt_sets)) return data.prompt_sets;
    if (Array.isArray(data.promptSets)) return data.promptSets;
    if (Array.isArray(data)) return data;
    return [];
}

function countImages(promptSets) {
    return promptSets.reduce((total, promptSet) => {
        const versions = Array.isArray(promptSet.versions) ? promptSet.versions : [];
        return total + versions.reduce((sum, version) => {
            return sum + (Array.isArray(version.images) ? version.images.length : 0);
        }, 0);
    }, 0);
}

function getBackupStats(data, jsonText = '') {
    const promptSets = getPromptSets(data);
    const versionCount = promptSets.reduce((total, promptSet) => {
        return total + (Array.isArray(promptSet.versions) ? promptSet.versions.length : 0);
    }, 0);
    const imageCount = Number.isFinite(data?.backup_meta?.imageCount)
        ? data.backup_meta.imageCount
        : countImages(promptSets);
    const size = jsonText
        ? new Blob([jsonText], { type: JSON_MIME }).size
        : new Blob([JSON.stringify(data || {})], { type: JSON_MIME }).size;

    return {
        promptSetCount: promptSets.length,
        versionCount,
        imageCount,
        size,
        sizeLabel: formatBackupSize(size),
    };
}

function serializeBackup(data) {
    const jsonText = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonText], { type: JSON_MIME });
    return { jsonText, blob, stats: getBackupStats(data, jsonText) };
}

function getCapacitorGlobal() {
    return globalThis.Capacitor || globalThis.window?.Capacitor || null;
}

function isNativeCapacitor() {
    const capacitor = getCapacitorGlobal();
    return !!capacitor?.isNativePlatform?.();
}

function isDesktopWebView() {
    const win = globalThis.window || {};
    return !!(win.__TAURI_INTERNALS__ || win.__TAURI__ || win.pywebview);
}

function isAbortError(error) {
    return error?.name === 'AbortError' || error?.code === 20;
}

function getErrorMessage(error) {
    if (!error) return '未知错误';
    if (typeof error === 'string') return error;
    return error.message || error.error || '未知错误';
}

async function saveWithFilePicker(blob, filename) {
    if (typeof globalThis.showSaveFilePicker !== 'function') return null;

    try {
        const handle = await globalThis.showSaveFilePicker({
            suggestedName: filename,
            types: [{
                description: 'JSON 备份文件',
                accept: { 'application/json': ['.json'] },
            }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return { success: true, method: 'file-picker', filename };
    } catch (error) {
        if (isAbortError(error)) {
            return { success: false, canceled: true, method: 'file-picker', filename };
        }
        throw error;
    }
}

function saveWithAnchor(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
        link.remove();
        URL.revokeObjectURL(url);
    }, DOWNLOAD_CLEANUP_DELAY_MS);
    return { success: true, method: 'download', filename };
}

async function saveWithCapacitor(jsonText, filename) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const targets = [
        { directory: Directory.Documents, label: 'Documents' },
        { directory: Directory.Data, label: 'Data' },
    ].filter(target => target.directory);
    let lastError = null;

    for (const target of targets) {
        try {
            const path = `backups/${filename}`;
            const result = await Filesystem.writeFile({
                path,
                data: jsonText,
                directory: target.directory,
                encoding: Encoding.UTF8,
                recursive: true,
            });
            return {
                success: true,
                method: 'capacitor',
                filename,
                path,
                directory: target.label,
                uri: result?.uri || '',
                locationLabel: target.label === 'Documents' ? '文档目录' : '应用数据目录',
            };
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('Android 文件写入失败');
}

async function saveJsonBackup(data, filename = buildBackupFilename(), options = {}) {
    const { jsonText, blob, stats } = serializeBackup(data);
    if (isNativeCapacitor()) {
        const result = await saveWithCapacitor(jsonText, filename);
        return { ...result, stats, size: blob.size };
    }

    const pickerResult = options.useFilePicker
        ? await saveWithFilePicker(blob, filename)
        : null;
    if (pickerResult) {
        return { ...pickerResult, stats, size: blob.size };
    }

    return { ...saveWithAnchor(blob, filename), stats, size: blob.size };
}

async function saveWithCustomPicker(data, filename) {
    const { blob, stats } = serializeBackup(data);
    const result = await saveWithFilePicker(blob, filename);
    if (!result) return null;
    return { ...result, saveMode: 'custom', stats, size: blob.size };
}

async function saveWithBackend(storage, filename, options = {}) {
    if (!storage || typeof storage.exportFile !== 'function') return null;
    const saveMode = options.saveMode || 'downloads';
    const result = await storage.exportFile(filename, {
        saveMode,
        directory: options.directory,
        targetPath: options.targetPath,
    });
    if (result?.canceled) {
        return {
            success: false,
            canceled: true,
            method: 'backend',
            saveMode,
            filename: result.filename || filename,
        };
    }
    return {
        success: true,
        method: 'backend',
        saveMode: result.saveMode || saveMode,
        filename: result.filename || filename,
        path: result.path || '',
        directory: result.directory || '',
        locationLabel: result.locationLabel || '',
        size: result.size || 0,
        stats: {
            promptSetCount: result.promptSetCount || 0,
            versionCount: result.versionCount || 0,
            imageCount: result.imageCount || 0,
            size: result.size || 0,
            sizeLabel: formatBackupSize(result.size || 0),
        },
    };
}

async function exportBackup(storage, options = {}) {
    const filename = options.filename || buildBackupFilename(options.prefix || DEFAULT_PREFIX);
    const saveMode = options.saveMode || 'downloads';
    const shouldPreferBackend = options.preferBackend ?? isDesktopWebView();

    if (saveMode === 'custom') {
        if (typeof globalThis.showSaveFilePicker === 'function') {
            try {
                const data = await storage.exportData();
                const pickerResult = await saveWithCustomPicker(data, filename);
                if (pickerResult) {
                    return pickerResult;
                }
            } catch (error) {
                console.warn('custom picker export failed, fallback to backend export:', error);
            }
        }

        try {
            const backendResult = await saveWithBackend(storage, filename, { ...options, saveMode });
            if (backendResult) return backendResult;
        } catch (error) {
            console.warn('backend custom export failed, fallback to browser export:', error);
        }

        const data = await storage.exportData();
        return saveJsonBackup(data, filename);
    }

    if (shouldPreferBackend) {
        try {
            const backendResult = await saveWithBackend(storage, filename, { ...options, saveMode });
            if (backendResult) return backendResult;
        } catch (error) {
            console.warn('backend export failed, fallback to browser export:', error);
        }
    }

    const data = await storage.exportData();
    try {
        const result = await saveJsonBackup(data, filename);
        if (result.canceled) return result;
        return result;
    } catch (error) {
        const backendResult = await saveWithBackend(storage, filename, { ...options, saveMode });
        if (backendResult) return backendResult;
        throw new Error(`保存备份失败：${getErrorMessage(error)}`);
    }
}

function buildExportSuccessMessage(result, prefix = '导出成功') {
    const stats = result?.stats || {};
    const imageCount = stats.imageCount ?? 0;
    const sizeLabel = stats.sizeLabel || formatBackupSize(result?.size || 0);
    if (result?.method === 'backend') {
        const location = result.saveMode === 'downloads'
            ? `下载目录 ${result.directory || ''}`.trim()
            : (result.path || result.directory || result.locationLabel || '自定义位置');
        return `${prefix}：${result.filename}，${sizeLabel}，已保存到 ${location}`;
    }
    if (result?.method === 'file-picker') {
        return `${prefix}：${result.filename}，${sizeLabel}，已保存到自定义位置`;
    }
    if (result?.method === 'capacitor') {
        return `${prefix}：${imageCount} 张图片，${sizeLabel}，已保存到${result.locationLabel || '应用数据目录'}`;
    }
    return `${prefix}：${imageCount} 张图片，${sizeLabel}`;
}

export {
    buildBackupFilename,
    buildExportSuccessMessage,
    exportBackup,
    formatBackupSize,
    getBackupStats,
    getErrorMessage,
    isDesktopWebView,
    isNativeCapacitor,
    saveJsonBackup,
};
