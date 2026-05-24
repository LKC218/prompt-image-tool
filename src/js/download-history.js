const DOWNLOAD_HISTORY_KEY = 'prompt-image-download-history-v1';
const DOWNLOAD_HISTORY_LIMIT = 20;

function generateHistoryId() {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function safeReadHistory() {
    try {
        const raw = localStorage.getItem(DOWNLOAD_HISTORY_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

function normalizeHistoryItem(item = {}) {
    const createdAt = item.createdAt || new Date().toISOString();
    return {
        id: item.id || generateHistoryId(),
        title: String(item.title || item.filename || '未命名图片'),
        filename: String(item.filename || ''),
        source: String(item.source || '图片查看器'),
        platform: String(item.platform || ''),
        method: String(item.method || ''),
        locationLabel: String(item.locationLabel || ''),
        path: String(item.path || ''),
        directory: String(item.directory || ''),
        status: String(item.status || 'success'),
        createdAt
    };
}

function getDownloadHistory() {
    return safeReadHistory()
        .map(normalizeHistoryItem)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function recordDownloadHistory(item = {}) {
    const historyItem = normalizeHistoryItem(item);
    const history = getDownloadHistory().filter(entry => entry.id !== historyItem.id);
    history.unshift(historyItem);
    try {
        localStorage.setItem(DOWNLOAD_HISTORY_KEY, JSON.stringify(history.slice(0, DOWNLOAD_HISTORY_LIMIT)));
    } catch (e) {}
    return historyItem;
}

function clearDownloadHistory() {
    try {
        localStorage.removeItem(DOWNLOAD_HISTORY_KEY);
    } catch (e) {}
}

function formatDownloadHistoryTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
}

function getDownloadHistoryLocationLabel(entry = {}) {
    if (entry.locationLabel) return entry.locationLabel;
    if (entry.platform === 'mobile') return '手机相册';
    if (entry.platform === 'pc') return '浏览器下载';
    return '本地下载';
}

export {
    DOWNLOAD_HISTORY_KEY,
    DOWNLOAD_HISTORY_LIMIT,
    clearDownloadHistory,
    formatDownloadHistoryTime,
    getDownloadHistory,
    getDownloadHistoryLocationLabel,
    recordDownloadHistory
};
