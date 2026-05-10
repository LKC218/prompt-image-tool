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

    async api(method, path, body = null) {
        const opts = { method, headers: { 'Content-Type': 'application/json' } };
        if (body !== null) opts.body = JSON.stringify(body);
        try {
            const res = await fetch(`${this.baseUrl}/api${path}`, opts);
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(`API error ${res.status}: ${text}`);
            }
            return await res.json();
        } catch (e) {
            console.error(`API ${method} ${path} failed:`, e);
            throw e;
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

    async exportFile(filename = '') {
        return this.api('POST', '/export-file', { filename });
    }

    async importData(data) {
        return this.api('POST', '/import', data);
    }

    async getNetworkInfo() {
        return this.api('GET', '/network-info');
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
