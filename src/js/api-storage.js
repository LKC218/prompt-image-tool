export class ApiStorage {
    constructor(baseUrl = '') {
        this.baseUrl = baseUrl;
        this._backendReady = false;
    }

    async init() {
        for (let i = 0; i < 10; i++) {
            try {
                const res = await fetch(`${this.baseUrl}/api/health`);
                if (res.ok) {
                    this._backendReady = true;
                    return;
                }
            } catch (e) {
                await new Promise(r => setTimeout(r, 1000));
            }
        }
        console.warn('Backend not ready after 10 retries');
    }

    async getHealth() {
        return this.api('GET', '/health');
    }

    async api(method, path, body = null) {
        const opts = { method, headers: { 'Content-Type': 'application/json' } };
        if (body !== null) opts.body = JSON.stringify(body);
        try {
            const res = await fetch(`${this.baseUrl}/api${path}`, opts);
            const data = await this._readJsonResponse(res, path);
            if (!res.ok) {
                throw new Error(`API error ${res.status}: ${JSON.stringify(data)}`);
            }
            return data;
        } catch (e) {
            console.error(`API ${method} ${path} failed:`, e);
            throw e;
        }
    }

    async _readJsonResponse(res, path) {
        const contentType = res.headers?.get?.('content-type') || '';
        const text = await res.text().catch(() => '');
        if (!text) return null;

        try {
            return JSON.parse(text);
        } catch (e) {
            const looksLikeHtml = text.trim().startsWith('<!DOCTYPE') || contentType.includes('text/html');
            if (looksLikeHtml) {
                throw new Error(`API ${path} 返回了页面内容，请确认 PC 后端接口已启动且安装包后端为最新版本`);
            }
            throw new Error(`API ${path} 返回了非 JSON 内容`);
        }
    }

    async getFolders() {
        return this.api('GET', '/folders');
    }

    async createFolder(name, color = '') {
        return this.api('POST', '/folders', { name, color });
    }

    async updateFolder(id, data) {
        return this.api('POST', `/folder/${id}`, data);
    }

    async deleteFolder(id) {
        return this.api('DELETE', `/folder/${id}`);
    }

    async reorderFolders(folderIds) {
        return this.api('POST', '/folders/reorder', { order: folderIds });
    }

    async movePromptToFolder(promptSetId, folderId) {
        return this.api('POST', `/prompt-set/${promptSetId}/move`, { folderId });
    }

    async getPromptSets() {
        return this.api('GET', '/prompt-sets');
    }

    async getPromptSet(id) {
        return this.api('GET', `/prompt-set/${id}`);
    }

    async createPromptSet(name, folderId = null, tags = '[]') {
        return this.api('POST', '/prompt-sets', { name, folderId, tags });
    }

    async updatePromptSet(id, data) {
        return this.api('POST', `/prompt-set/${id}`, data);
    }

    async deletePromptSet(id) {
        return this.api('DELETE', `/prompt-set/${id}`);
    }

    async addVersion(id, data) {
        return this.api('POST', `/prompt-set/${id}/version`, data);
    }

    async deleteVersion(id, versionIndex) {
        return this.api('POST', `/prompt-set/${id}/delete-version`, { versionIndex });
    }

    async renameVersion(id, versionIndex, version) {
        return this.api('POST', `/prompt-set/${id}/rename-version`, { versionIndex, version });
    }

    async duplicateVersion(id, versionIndex) {
        return this.api('POST', `/prompt-set/${id}/duplicate-version`, { versionIndex });
    }

    async uploadImage(imageId, dataUrl, name) {
        return this.api('POST', `/image/${imageId}`, { data: dataUrl, name });
    }

    async deleteImage(filename) {
        return this.api('DELETE', `/image/${filename}`);
    }

    async toggleFavorite(id) {
        return this.api('POST', `/prompt-set/${id}/toggle-favorite`);
    }

    async exportData() {
        return this.api('GET', '/export');
    }

    async exportFile(filename = '', options = {}) {
        const payload = typeof filename === 'object'
            ? filename
            : { filename, ...options };
        return this.api('POST', '/export-file', payload);
    }

    async downloadImageFile(sourceFile = '', options = {}) {
        const payload = typeof sourceFile === 'object'
            ? sourceFile
            : { sourceFile, ...options };
        return this.api('POST', '/image-download-file', payload);
    }

    async importData(data) {
        return this.api('POST', '/import', data);
    }

    async getNetworkInfo() {
        return this.api('GET', '/network-info');
    }

    async getSyncCapabilities() {
        return this.api('GET', '/sync/capabilities');
    }

    async estimateStorageSize() {
        const data = await this.exportData();
        return new Blob([JSON.stringify(data)]).size;
    }

    async getImageUrl(img) {
        if (img.file) return `${this.baseUrl}/images/${img.file}`;
        return img.data || '';
    }

    getPlatform() { return 'pc'; }
}
