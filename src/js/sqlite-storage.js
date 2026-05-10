export class SqliteStorage {
    db = null;

    async init() {
        const { CapacitorSQLite } = await import('@capacitor-community/sqlite');
        const ret = await CapacitorSQLite.createConnection({ database: 'prompt_manager' });
        await CapacitorSQLite.open({ database: 'prompt_manager' });
        this.db = CapacitorSQLite;

        await this.db.execute({
            database: 'prompt_manager',
            statements: `
                CREATE TABLE IF NOT EXISTS folders (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    color TEXT DEFAULT '',
                    sort_order INTEGER DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS prompt_sets (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    folder_id TEXT DEFAULT '',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS versions (
                    id TEXT PRIMARY KEY,
                    prompt_set_id TEXT NOT NULL,
                    version TEXT NOT NULL,
                    prompt TEXT DEFAULT '',
                    negative_prompt TEXT DEFAULT '',
                    note TEXT DEFAULT '',
                    sort_order INTEGER DEFAULT 0,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (prompt_set_id) REFERENCES prompt_sets(id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS images (
                    id TEXT PRIMARY KEY,
                    version_id TEXT NOT NULL,
                    name TEXT DEFAULT '',
                    path TEXT DEFAULT '',
                    file TEXT DEFAULT '',
                    note TEXT DEFAULT '',
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (version_id) REFERENCES versions(id) ON DELETE CASCADE
                );
            `
        });

        try {
            await this.db.execute({
                database: 'prompt_manager',
                statements: `ALTER TABLE prompt_sets ADD COLUMN folder_id TEXT DEFAULT '';`
            });
        } catch (e) {}
        try {
            await this.db.execute({
                database: 'prompt_manager',
                statements: `ALTER TABLE prompt_sets ADD COLUMN tags TEXT DEFAULT '[]';`
            });
        } catch (e) {}
        try {
            await this.db.execute({
                database: 'prompt_manager',
                statements: `ALTER TABLE versions ADD COLUMN aspect_ratio TEXT DEFAULT '1:1';`
            });
        } catch (e) {}
        try {
            await this.db.execute({
                database: 'prompt_manager',
                statements: `ALTER TABLE versions ADD COLUMN style_preset TEXT DEFAULT '';`
            });
        } catch (e) {}
        try {
            await this.db.execute({
                database: 'prompt_manager',
                statements: `ALTER TABLE prompt_sets ADD COLUMN is_favorite INTEGER DEFAULT 0;`
            });
        } catch (e) {}
        try {
            await this.db.execute({
                database: 'prompt_manager',
                statements: `ALTER TABLE versions ADD COLUMN sampler TEXT DEFAULT 'DPM++ 2M Karras';`
            });
        } catch (e) {}
        try {
            await this.db.execute({
                database: 'prompt_manager',
                statements: `ALTER TABLE versions ADD COLUMN steps INTEGER DEFAULT 30;`
            });
        } catch (e) {}
        try {
            await this.db.execute({
                database: 'prompt_manager',
                statements: `ALTER TABLE versions ADD COLUMN cfg_scale REAL DEFAULT 7.0;`
            });
        } catch (e) {}
        try {
            await this.db.execute({
                database: 'prompt_manager',
                statements: `ALTER TABLE versions ADD COLUMN hr_fix INTEGER DEFAULT 1;`
            });
        } catch (e) {}
        try {
            await this.db.execute({
                database: 'prompt_manager',
                statements: `ALTER TABLE versions ADD COLUMN model TEXT DEFAULT '';`
            });
        } catch (e) {}
    }

    async query(sql, values = []) {
        const result = await this.db.query({
            database: 'prompt_manager',
            statement: sql,
            values
        });
        return result.values || [];
    }

    async run(sql, values = []) {
        return this.db.run({
            database: 'prompt_manager',
            statement: sql,
            values
        });
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    async getFolders() {
        const rows = await this.query('SELECT * FROM folders ORDER BY sort_order, created_at');
        return rows.map(r => ({
            id: r.id,
            name: r.name,
            color: r.color || '',
            sortOrder: r.sort_order || 0,
            createdAt: r.created_at,
            updatedAt: r.updated_at
        }));
    }

    async createFolder(name, color = '') {
        const id = this.generateId();
        const now = new Date().toISOString();
        const maxOrder = await this.query('SELECT MAX(sort_order) as max_order FROM folders');
        const sortOrder = (maxOrder[0]?.max_order || 0) + 1;
        await this.run('INSERT INTO folders (id, name, color, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [id, name, color, sortOrder, now, now]);
        return { id, name, color, sortOrder, createdAt: now, updatedAt: now };
    }

    async updateFolder(id, data) {
        const now = new Date().toISOString();
        if (data.name !== undefined) {
            await this.run('UPDATE folders SET name = ?, updated_at = ? WHERE id = ?', [data.name, now, id]);
        }
        if (data.color !== undefined) {
            await this.run('UPDATE folders SET color = ?, updated_at = ? WHERE id = ?', [data.color, now, id]);
        }
    }

    async deleteFolder(id) {
        await this.run("UPDATE prompt_sets SET folder_id = '' WHERE folder_id = ?", [id]);
        await this.run('DELETE FROM folders WHERE id = ?', [id]);
    }

    async movePromptToFolder(promptSetId, folderId) {
        const now = new Date().toISOString();
        await this.run('UPDATE prompt_sets SET folder_id = ?, updated_at = ? WHERE id = ?', [folderId || '', now, promptSetId]);
    }

    async getPromptSets() {
        const rows = await this.query('SELECT * FROM prompt_sets ORDER BY updated_at DESC');
        const result = [];
        for (const row of rows) {
            const vCount = (await this.query('SELECT COUNT(*) as cnt FROM versions WHERE prompt_set_id = ?', [row.id]))[0]?.cnt || 0;
            const iCount = (await this.query('SELECT COUNT(*) as cnt FROM images WHERE version_id IN (SELECT id FROM versions WHERE prompt_set_id = ?)', [row.id]))[0]?.cnt || 0;
            const firstImgRows = await this.query('SELECT i.* FROM images i JOIN versions v ON i.version_id = v.id WHERE v.prompt_set_id = ? ORDER BY v.sort_order, i.created_at LIMIT 1', [row.id]);
            const firstImage = firstImgRows.length > 0 ? { file: firstImgRows[0].file, data: firstImgRows[0].path, path: firstImgRows[0].path, name: firstImgRows[0].name } : null;
            result.push({
                id: row.id,
                name: row.name,
                folderId: row.folder_id || null,
                tags: row.tags || '[]',
                isFavorite: !!row.is_favorite,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
                versionCount: vCount,
                imageCount: iCount,
                firstImage
            });
        }
        return result;
    }

    async getPromptSet(id) {
        const sets = await this.query('SELECT * FROM prompt_sets WHERE id = ?', [id]);
        if (sets.length === 0) return null;
        const s = sets[0];
        const versions = await this.query('SELECT * FROM versions WHERE prompt_set_id = ? ORDER BY sort_order', [id]);
        for (const v of versions) {
            v.images = await this.query('SELECT * FROM images WHERE version_id = ? ORDER BY created_at', [v.id]);
            v.negativePrompt = v.negative_prompt;
            v.aspectRatio = v.aspect_ratio || '1:1';
            v.stylePreset = v.style_preset || '';
            v.sampler = v.sampler || 'DPM++ 2M Karras';
            v.steps = v.steps || 30;
            v.cfgScale = v.cfg_scale || 7.0;
            v.hrFix = v.hr_fix !== undefined ? !!v.hr_fix : true;
            v.model = v.model || '';
            v.createdAt = v.created_at;
        }
        return { ...s, folderId: s.folder_id || null, tags: s.tags || '[]', isFavorite: !!s.is_favorite, versions, createdAt: s.created_at, updatedAt: s.updated_at };
    }

    async createPromptSet(name, folderId = null, tags = '[]') {
        const id = this.generateId();
        const now = new Date().toISOString();
        const vId = this.generateId();
        await this.run('INSERT INTO prompt_sets (id, name, folder_id, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [id, name, folderId || '', tags, now, now]);
        await this.run('INSERT INTO versions (id, prompt_set_id, version, prompt, negative_prompt, note, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [vId, id, 'v1', '', '', '', 0, now]);
        return this.getPromptSet(id);
    }

    async updatePromptSet(id, data) {
        const now = new Date().toISOString();
        if (data.name !== undefined) {
            await this.run('UPDATE prompt_sets SET name = ?, updated_at = ? WHERE id = ?', [data.name, now, id]);
        }
        if (data.folderId !== undefined) {
            await this.run('UPDATE prompt_sets SET folder_id = ?, updated_at = ? WHERE id = ?', [data.folderId || '', now, id]);
        }
        if (data.tags !== undefined) {
            await this.run('UPDATE prompt_sets SET tags = ?, updated_at = ? WHERE id = ?', [data.tags, now, id]);
        }
        if (data.isFavorite !== undefined) {
            await this.run('UPDATE prompt_sets SET is_favorite = ?, updated_at = ? WHERE id = ?', [data.isFavorite ? 1 : 0, now, id]);
        }
        if (data.versions !== undefined) {
            for (const v of data.versions) {
                await this.run('UPDATE versions SET prompt = ?, negative_prompt = ?, note = ?, aspect_ratio = ?, style_preset = ?, sampler = ?, steps = ?, cfg_scale = ?, hr_fix = ?, model = ? WHERE id = ?',
                    [v.prompt || '', v.negativePrompt || '', v.note || '', v.aspectRatio || '1:1', v.stylePreset || '',
                     v.sampler || 'DPM++ 2M Karras', v.steps || 30, v.cfgScale || 7.0, v.hrFix !== false ? 1 : 0, v.model || '', v.id]);
                if (v.images) {
                    const existingImgs = await this.query('SELECT id, file FROM images WHERE version_id = ?', [v.id]);
                    const existingIds = new Set(existingImgs.map(r => r.id));
                    const providedIds = new Set(v.images.map(img => img.id));

                    for (const img of v.images) {
                        if (existingIds.has(img.id)) {
                            await this.run('UPDATE images SET note = ?, name = ?, path = ?, file = ? WHERE id = ?', [img.note || '', img.name || '', img.path || '', img.file || '', img.id]);
                        } else {
                            await this.run('INSERT INTO images (id, version_id, name, path, file, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                                [img.id, v.id, img.name || '', img.path || '', img.file || '', img.note || '', img.createdAt || now]);
                        }
                    }

                    for (const oldImg of existingImgs) {
                        if (!providedIds.has(oldImg.id)) {
                            if (oldImg.file) await this.deleteImageFile(oldImg.file);
                            await this.run('DELETE FROM images WHERE id = ?', [oldImg.id]);
                        }
                    }
                }
            }
            await this.run('UPDATE prompt_sets SET updated_at = ? WHERE id = ?', [now, id]);
        }
    }

    async toggleFavorite(id) {
        const now = new Date().toISOString();
        await this.run('UPDATE prompt_sets SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END, updated_at = ? WHERE id = ?', [now, id]);
        const rows = await this.query('SELECT is_favorite FROM prompt_sets WHERE id = ?', [id]);
        return { id, isFavorite: !!(rows[0]?.is_favorite) };
    }

    async deletePromptSet(id) {
        const versions = await this.query('SELECT id FROM versions WHERE prompt_set_id = ?', [id]);
        for (const v of versions) {
            const images = await this.query('SELECT file FROM images WHERE version_id = ?', [v.id]);
            for (const img of images) {
                if (img.file) await this.deleteImageFile(img.file);
            }
            await this.run('DELETE FROM images WHERE version_id = ?', [v.id]);
        }
        await this.run('DELETE FROM versions WHERE prompt_set_id = ?', [id]);
        await this.run('DELETE FROM prompt_sets WHERE id = ?', [id]);
    }

    async addVersion(id, data) {
        const versions = await this.query('SELECT * FROM versions WHERE prompt_set_id = ? ORDER BY sort_order', [id]);
        const vId = this.generateId();
        const now = new Date().toISOString();
        const vName = `v${versions.length + 1}`;
        const prompt = data.prompt !== undefined ? data.prompt : '';
        const negativePrompt = data.negativePrompt !== undefined ? data.negativePrompt : '';
        await this.run('INSERT INTO versions (id, prompt_set_id, version, prompt, negative_prompt, note, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [vId, id, vName, prompt, negativePrompt, data.note || '', versions.length, now]);
        await this.run('UPDATE prompt_sets SET updated_at = ? WHERE id = ?', [now, id]);
        return this.getPromptSet(id);
    }

    async deleteVersion(id, versionIndex) {
        const versions = await this.query('SELECT * FROM versions WHERE prompt_set_id = ? ORDER BY sort_order', [id]);
        if (versions.length <= 1) throw new Error('至少保留一个版本');
        const v = versions[versionIndex];
        const images = await this.query('SELECT file FROM images WHERE version_id = ?', [v.id]);
        for (const img of images) {
            if (img.file) await this.deleteImageFile(img.file);
        }
        await this.run('DELETE FROM images WHERE version_id = ?', [v.id]);
        await this.run('DELETE FROM versions WHERE id = ?', [v.id]);
        const now = new Date().toISOString();
        await this.run('UPDATE prompt_sets SET updated_at = ? WHERE id = ?', [now, id]);
    }

    async renameVersion(id, versionIndex, newName) {
        const versions = await this.query('SELECT * FROM versions WHERE prompt_set_id = ? ORDER BY sort_order', [id]);
        const v = versions[versionIndex];
        const now = new Date().toISOString();
        await this.run('UPDATE versions SET version = ? WHERE id = ?', [newName, v.id]);
        await this.run('UPDATE prompt_sets SET updated_at = ? WHERE id = ?', [now, id]);
    }

    async duplicateVersion(id, versionIndex) {
        const set = await this.getPromptSet(id);
        const source = set.versions[versionIndex];
        const vId = this.generateId();
        const now = new Date().toISOString();
        const vName = `v${set.versions.length + 1}`;
        await this.run('INSERT INTO versions (id, prompt_set_id, version, prompt, negative_prompt, note, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [vId, id, vName, source.prompt, source.negativePrompt, `复制自 ${source.version}`, set.versions.length, now]);
        for (const img of source.images) {
            const newImgId = this.generateId();
            let newFile = img.file;
            if (img.file) {
                const { Filesystem, Directory } = await import('@capacitor/filesystem');
                const ext = img.file.split('.').pop();
                newFile = `${newImgId}.${ext}`;
                try {
                    await Filesystem.copy({
                        from: `images/${img.file}`,
                        to: `images/${newFile}`,
                        directory: Directory.Data,
                    });
                } catch (e) { newFile = img.file; }
            }
            await this.run('INSERT INTO images (id, version_id, name, path, file, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [newImgId, vId, img.name, img.path, newFile, '', now]);
        }
        await this.run('UPDATE prompt_sets SET updated_at = ? WHERE id = ?', [now, id]);
        return this.getPromptSet(id);
    }

    async uploadImage(imageId, dataUrl, name) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const header = dataUrl.split(',')[0];
        const base64Data = dataUrl.split(',')[1] || '';
        const ext = header.includes('image/png') ? 'png' : header.includes('image/jpeg') ? 'jpg' : header.includes('image/webp') ? 'webp' : 'png';
        const filename = `${imageId}.${ext}`;
        await Filesystem.writeFile({
            path: `images/${filename}`,
            data: base64Data,
            directory: Directory.Data,
            recursive: true,
        });
        return { id: imageId, file: filename, name };
    }

    async deleteImageFile(filename) {
        try {
            const { Filesystem, Directory } = await import('@capacitor/filesystem');
            await Filesystem.deleteFile({ path: `images/${filename}`, directory: Directory.Data });
        } catch (e) {}
    }

    async deleteImage(filename) {
        await this.deleteImageFile(filename);
    }

    _getImageMime(filename = '') {
        const ext = filename.split('.').pop()?.toLowerCase();
        if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
        if (ext === 'webp') return 'image/webp';
        if (ext === 'gif') return 'image/gif';
        return 'image/png';
    }

    async _readImageDataUrl(filename) {
        if (!filename) return null;
        try {
            const { Filesystem, Directory } = await import('@capacitor/filesystem');
            const result = await Filesystem.readFile({
                path: `images/${filename}`,
                directory: Directory.Data,
            });
            const data = String(result.data || '');
            if (!data) return null;
            if (data.startsWith('data:')) return data;
            return `data:${this._getImageMime(filename)};base64,${data}`;
        } catch (e) {
            return null;
        }
    }

    _normalizeImportPayload(data) {
        if (Array.isArray(data)) return { folders: [], promptSets: data, meta: null };
        if (data && typeof data === 'object') {
            return {
                folders: Array.isArray(data.folders) ? data.folders : [],
                promptSets: Array.isArray(data.prompt_sets) ? data.prompt_sets : (Array.isArray(data.promptSets) ? data.promptSets : []),
                meta: data.backup_meta || data.backupMeta || null,
            };
        }
        return { folders: [], promptSets: [], meta: null };
    }

    async _restoreImportedImage(img) {
        const image = { ...img };
        const dataUrl = image.data || '';
        delete image.data;
        delete image.size;
        delete image.mimeType;

        if (!dataUrl) return { image, restored: false };

        try {
            const { Filesystem, Directory } = await import('@capacitor/filesystem');
            const header = dataUrl.split(',')[0] || '';
            const base64Data = dataUrl.split(',')[1] || '';
            let filename = image.file || image.name || image.id || this.generateId();
            if (!/\.[a-z0-9]+$/i.test(filename)) {
                const ext = header.includes('image/jpeg') ? 'jpg'
                    : header.includes('image/webp') ? 'webp'
                    : header.includes('image/gif') ? 'gif'
                    : 'png';
                filename = `${filename}.${ext}`;
            }
            filename = filename.split(/[\\/]/).pop();
            await Filesystem.writeFile({
                path: `images/${filename}`,
                data: base64Data,
                directory: Directory.Data,
                recursive: true,
            });
            image.file = filename;
            return { image, restored: true };
        } catch (e) {
            return { image, restored: false };
        }
    }

    async _insertImportedPromptSet(item) {
        const now = new Date().toISOString();
        await this.run(
            'INSERT INTO prompt_sets (id, name, folder_id, tags, is_favorite, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [item.id, item.name || '未命名提示词集合', item.folderId || item.folder_id || '', item.tags || '[]', item.isFavorite || item.is_favorite ? 1 : 0, item.createdAt || item.created_at || now, item.updatedAt || item.updated_at || now]
        );

        let restoredImages = 0;
        for (let i = 0; i < item.versions.length; i++) {
            const v = item.versions[i];
            const vId = v.id || this.generateId();
            await this.run(
                'INSERT INTO versions (id, prompt_set_id, version, prompt, negative_prompt, note, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [vId, item.id, v.version || `v${i + 1}`, v.prompt || '', v.negativePrompt || v.negative_prompt || '', v.note || '', i, v.createdAt || v.created_at || now]
            );
            await this.run(
                'UPDATE versions SET aspect_ratio = ?, style_preset = ?, sampler = ?, steps = ?, cfg_scale = ?, hr_fix = ?, model = ? WHERE id = ?',
                [v.aspectRatio || v.aspect_ratio || '1:1', v.stylePreset || v.style_preset || '', v.sampler || 'DPM++ 2M Karras', v.steps || 30, v.cfgScale || v.cfg_scale || 7.0, (v.hrFix === false || v.hr_fix === false || v.hr_fix === 0) ? 0 : 1, v.model || '', vId]
            );

            for (const rawImg of (v.images || [])) {
                const { image, restored } = await this._restoreImportedImage(rawImg);
                if (restored) restoredImages++;
                const imgId = image.id || this.generateId();
                await this.run(
                    'INSERT INTO images (id, version_id, name, path, file, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [imgId, vId, image.name || '', image.path || '', image.file || '', image.note || '', image.createdAt || image.created_at || now]
                );
            }
        }

        return restoredImages;
    }

    async exportData() {
        const sets = await this.query('SELECT * FROM prompt_sets');
        const result = [];
        let imageCount = 0;
        let imageBytes = 0;

        for (const s of sets) {
            const set = await this.getPromptSet(s.id);
            for (const version of (set.versions || [])) {
                for (const image of (version.images || [])) {
                    if (!image.file) continue;
                    const dataUrl = await this._readImageDataUrl(image.file);
                    if (dataUrl) {
                        image.data = dataUrl;
                        image.mimeType = this._getImageMime(image.file);
                        image.size = Math.floor((dataUrl.split(',')[1] || '').length * 3 / 4);
                        imageCount++;
                        imageBytes += image.size;
                    }
                }
            }
            result.push(set);
        }

        return {
            backup_meta: {
                app: 'prompt-image-tool',
                format: 'prompt-image-tool-backup',
                version: 1,
                createdAt: new Date().toISOString(),
                imageCount,
                imageBytes,
            },
            folders: await this.getFolders(),
            prompt_sets: result,
        };
    }

    async importData(data) {
        const payload = this._normalizeImportPayload(data);
        let count = 0;
        let added = 0;
        let updated = 0;
        let imagesRestored = 0;

        for (const folder of payload.folders) {
            if (!folder.id) continue;
            const existing = await this.query('SELECT id FROM folders WHERE id = ?', [folder.id]);
            const now = new Date().toISOString();
            if (existing.length > 0) {
                await this.run(
                    'UPDATE folders SET name = ?, color = ?, sort_order = ?, updated_at = ? WHERE id = ?',
                    [folder.name || '未命名分类', folder.color || '', folder.sortOrder || folder.sort_order || 0, folder.updatedAt || folder.updated_at || now, folder.id]
                );
            } else {
                await this.run(
                    'INSERT INTO folders (id, name, color, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
                    [folder.id, folder.name || '未命名分类', folder.color || '', folder.sortOrder || folder.sort_order || 0, folder.createdAt || folder.created_at || now, folder.updatedAt || folder.updated_at || now]
                );
            }
        }

        for (const item of payload.promptSets) {
            if (!item.id || !Array.isArray(item.versions)) continue;
            const existing = await this.query('SELECT id FROM prompt_sets WHERE id = ?', [item.id]);
            if (existing.length > 0) {
                await this.deletePromptSet(item.id);
                updated++;
            } else {
                added++;
            }
            imagesRestored += await this._insertImportedPromptSet(item);
            count++;
        }

        return { imported: count, added, updated, imagesRestored };
    }

    async getImageUrl(img) {
        if (img.file) {
            try {
                const { Filesystem, Directory } = await import('@capacitor/filesystem');
                const { Capacitor } = await import('@capacitor/core');
                const result = await Filesystem.getUri({ path: `images/${img.file}`, directory: Directory.Data });
                const url = Capacitor.convertFileSrc(result.uri);
                return url;
            } catch (e) {
                console.error('getImageUrl failed for file:', img.file, e);
                try {
                    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
                    const stat = await Filesystem.stat({ path: `images/${img.file}`, directory: Directory.Data });
                    if (stat && stat.uri) {
                        const { Capacitor } = await import('@capacitor/core');
                        return Capacitor.convertFileSrc(stat.uri);
                    }
                } catch (e2) {
                    console.error('getImageUrl stat fallback also failed:', e2);
                }
                return img.data || img.path || '';
            }
        }
        return img.data || img.path || '';
    }

    getPlatform() { return 'android'; }
}
