import { isCapacitor } from './storage.js';
import { recordDownloadHistory } from './download-history.js';
import { saveImageToGallery } from './mobile-gallery.js';

const DOWNLOAD_CLEANUP_DELAY_MS = 1000;
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const MIME_TO_EXTENSION = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
};

function getExtensionFromName(value = '') {
    const clean = String(value).split(/[?#]/)[0];
    const match = clean.match(/\.([a-z0-9]+)$/i);
    if (!match) return '';
    const ext = `.${match[1].toLowerCase()}`;
    return IMAGE_EXTENSIONS.has(ext) ? ext : '';
}

function getExtensionFromMime(type = '') {
    return MIME_TO_EXTENSION[String(type).split(';')[0].trim().toLowerCase()] || '';
}

function sanitizeImageFilename(filename = '', fallback = 'image') {
    const base = String(filename || fallback)
        .split(/[\\/]/)
        .pop()
        .trim()
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
        .replace(/\s+/g, ' ')
        .replace(/^\.+/, '')
        .trim();
    return base || fallback;
}

function buildImageFilename(options = {}) {
    const preferred = sanitizeImageFilename(options.filename || options.sourceFile || '', options.fallbackName || 'image');
    const currentExt = getExtensionFromName(preferred);
    if (currentExt) return preferred;

    const ext = getExtensionFromMime(options.contentType)
        || getExtensionFromName(options.url)
        || getExtensionFromName(options.sourceFile)
        || '.png';
    return `${preferred}${ext}`;
}

function inferSourceFileFromUrl(url = '') {
    const value = String(url || '');
    const match = value.match(/\/(?:api\/)?images\/([^?#]+)/);
    return match ? decodeURIComponent(match[1]) : '';
}

function isAbortError(error) {
    return error?.name === 'AbortError' || error?.code === 20;
}

async function fetchImageBlob(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`图片下载失败：HTTP ${response.status}`);
    }
    const blob = await response.blob();
    return {
        blob,
        contentType: blob.type || response.headers?.get?.('Content-Type') || '',
    };
}

function buildPickerTypes(contentType = '', filename = '') {
    const ext = getExtensionFromMime(contentType) || getExtensionFromName(filename) || '.png';
    const type = contentType && contentType.startsWith('image/') ? contentType : 'image/*';
    return [{
        description: '图片文件',
        accept: { [type]: [ext] },
    }];
}

async function saveBlobWithFilePicker(blob, filename, contentType = '') {
    if (typeof globalThis.showSaveFilePicker !== 'function') return null;

    try {
        const handle = await globalThis.showSaveFilePicker({
            suggestedName: filename,
            types: buildPickerTypes(contentType || blob.type, filename),
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return { success: true, method: 'file-picker', filename, locationLabel: '自定义位置' };
    } catch (error) {
        if (isAbortError(error)) {
            return { success: false, canceled: true, method: 'file-picker', filename };
        }
        throw error;
    }
}

function saveBlobWithAnchor(blob, filename) {
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
    return { success: true, method: 'download', filename, locationLabel: '浏览器下载' };
}

function saveUrlWithAnchor(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => link.remove(), DOWNLOAD_CLEANUP_DELAY_MS);
    return { success: true, method: 'download', filename, locationLabel: '浏览器下载' };
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('图片转换失败'));
        reader.readAsDataURL(blob);
    });
}

async function saveBlobToNativeGallery(blob, filename, contentType = '') {
    if (!isCapacitor) return null;
    const dataUrl = await blobToDataUrl(blob);
    const result = await saveImageToGallery({
        dataUrl,
        filename,
        mimeType: contentType || blob.type || 'image/png',
        album: 'PromptImageManager',
    });
    return {
        success: result?.success !== false,
        method: 'native-gallery',
        filename: result?.filename || filename,
        path: result?.path || '',
        directory: result?.directory || '',
        locationLabel: result?.locationLabel || '手机相册',
    };
}

async function saveWithBackend(storage, options = {}) {
    if (!storage || typeof storage.downloadImageFile !== 'function' || !options.sourceFile) return null;
    const result = await storage.downloadImageFile(options.sourceFile, {
        filename: options.filename,
        saveMode: options.saveMode || 'custom',
        directory: options.directory,
        targetPath: options.targetPath,
    });
    const locationLabel = result?.locationLabel
        || (result?.saveMode === 'downloads' ? '下载目录' : '自定义位置');
    return {
        success: result?.success !== false,
        method: 'backend',
        canceled: Boolean(result?.canceled),
        filename: result?.filename || options.filename,
        path: result?.path || '',
        directory: result?.directory || '',
        size: result?.size || 0,
        saveMode: result?.saveMode || options.saveMode || 'custom',
        locationLabel,
    };
}

async function downloadImage(options = {}) {
    if (!options.url) {
        throw new Error('缺少图片地址');
    }

    const sourceFile = options.sourceFile || inferSourceFileFromUrl(options.url);
    const baseFilename = buildImageFilename({ ...options, sourceFile });
    const preferFilePicker = Boolean(options.preferFilePicker);
    const preferBackend = Boolean(options.preferBackend);
    const historyContext = options.historyContext || {};

    if (preferFilePicker && typeof globalThis.showSaveFilePicker === 'function') {
        const { blob, contentType } = await fetchImageBlob(options.url);
        const filename = buildImageFilename({ ...options, sourceFile, contentType, filename: baseFilename });
        const result = await saveBlobWithFilePicker(blob, filename, contentType);
        if (result?.success) {
            recordDownloadHistory({
                title: historyContext.title || filename,
                filename,
                source: historyContext.source || '图片查看器',
                platform: historyContext.platform || (isCapacitor ? 'mobile' : 'pc'),
                method: result.method,
                locationLabel: result.locationLabel,
                path: result.path || '',
                directory: result.directory || '',
                status: 'success',
            });
        }
        return result;
    }

    if (isCapacitor) {
        const { blob, contentType } = await fetchImageBlob(options.url);
        const filename = buildImageFilename({ ...options, sourceFile, contentType, filename: baseFilename });
        try {
            const result = await saveBlobToNativeGallery(blob, filename, contentType);
            if (result?.success) {
                recordDownloadHistory({
                    title: historyContext.title || filename,
                    filename,
                    source: historyContext.source || '图片查看器',
                    platform: historyContext.platform || 'mobile',
                    method: result.method,
                    locationLabel: result.locationLabel,
                    path: result.path || '',
                    directory: result.directory || '',
                    status: 'success',
                });
                return result;
            }
        } catch (error) {
            console.warn('native gallery save failed, fallback to browser download:', error);
        }
    }

    if (preferBackend) {
        const backendResult = await saveWithBackend(options.storage, {
            ...options,
            sourceFile,
            filename: baseFilename,
            saveMode: 'custom',
        });
        if (backendResult) {
            if (backendResult.success) {
                recordDownloadHistory({
                    title: historyContext.title || backendResult.filename || baseFilename,
                    filename: backendResult.filename || baseFilename,
                    source: historyContext.source || '图片查看器',
                    platform: historyContext.platform || 'pc',
                    method: backendResult.method,
                    locationLabel: backendResult.locationLabel,
                    path: backendResult.path || '',
                    directory: backendResult.directory || '',
                    status: 'success',
                });
            }
            return backendResult;
        }
    }

    try {
        const { blob, contentType } = await fetchImageBlob(options.url);
        const filename = buildImageFilename({ ...options, sourceFile, contentType, filename: baseFilename });
        const result = await saveBlobWithAnchor(blob, filename);
        if (result?.success) {
            recordDownloadHistory({
                title: historyContext.title || filename,
                filename,
                source: historyContext.source || '图片查看器',
                platform: historyContext.platform || (isCapacitor ? 'mobile' : 'pc'),
                method: result.method,
                locationLabel: result.locationLabel,
                status: 'success',
            });
        }
        return result;
    } catch (error) {
        if (options.allowUrlFallback === false) throw error;
        const result = saveUrlWithAnchor(options.url, baseFilename);
        if (result?.success) {
            recordDownloadHistory({
                title: historyContext.title || baseFilename,
                filename: baseFilename,
                source: historyContext.source || '图片查看器',
                platform: historyContext.platform || (isCapacitor ? 'mobile' : 'pc'),
                method: result.method,
                locationLabel: result.locationLabel,
                status: 'success',
            });
        }
        return result;
    }
}

export {
    buildImageFilename,
    downloadImage,
    inferSourceFileFromUrl,
    sanitizeImageFilename,
};
