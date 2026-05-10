export const SyncState = {
    IDLE: 'idle',
    CONNECTING: 'connecting',
    SYNCING: 'syncing',
    VERIFYING: 'verifying',
    SUCCESS: 'success',
    PARTIAL: 'partial',
    ERROR: 'error',
};

export class LanScanner {
    constructor() {
        this._abortController = null;
        this._scanning = false;
        this.onDeviceFound = null;
        this.onProgress = null;
    }

    get scanning() { return this._scanning; }

    abort() {
        if (this._abortController) {
            this._abortController.abort();
        }
    }

    async getLocalIP() {
        try {
            const ip = await this._getLocalIPWebRTC();
            if (ip) return ip;
        } catch (e) {}
        return null;
    }

    async _getLocalIPWebRTC() {
        return new Promise((resolve) => {
            try {
                const pc = new RTCPeerConnection({ iceServers: [] });
                pc.createDataChannel('');
                pc.createOffer().then(offer => pc.setLocalDescription(offer));
                pc.onicecandidate = (e) => {
                    if (!e.candidate) return;
                    const match = e.candidate.candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
                    if (match) {
                        pc.close();
                        resolve(match[1]);
                    }
                };
                setTimeout(() => { pc.close(); resolve(null); }, 3000);
            } catch (e) {
                resolve(null);
            }
        });
    }

    _normalizeScanOptions(portOrOptions = 8888, timeout = 1500) {
        if (typeof portOrOptions === 'object' && portOrOptions !== null) {
            return {
                port: portOrOptions.port || 8888,
                timeout: portOrOptions.timeout || 1500,
                subnets: portOrOptions.subnets || null,
                recentHosts: portOrOptions.recentHosts || [],
                concurrency: portOrOptions.concurrency || 30,
                rangeStart: portOrOptions.rangeStart || 1,
                rangeEnd: portOrOptions.rangeEnd || 254,
                onProgress: portOrOptions.onProgress || null,
            };
        }
        return {
            port: portOrOptions || 8888,
            timeout,
            subnets: null,
            recentHosts: [],
            concurrency: 30,
            rangeStart: 1,
            rangeEnd: 254,
            onProgress: null,
        };
    }

    _emitProgress(detail, onProgress) {
        const payload = { ...detail };
        if (onProgress) onProgress(payload);
        if (this.onProgress) this.onProgress(payload);
    }

    _isValidIp(ip) {
        return /^(\d{1,3}\.){3}\d{1,3}$/.test(ip || '') &&
            ip.split('.').every(part => Number(part) >= 0 && Number(part) <= 255);
    }

    _normalizeHost(host) {
        if (typeof host === 'string') {
            return { ip: host, source: 'recent' };
        }
        if (host && typeof host === 'object') {
            return {
                ip: host.ip,
                name: host.name,
                source: host.source || 'recent',
                lastSyncAt: host.lastSyncAt,
            };
        }
        return null;
    }

    _uniqueHosts(hosts) {
        const seen = new Set();
        const result = [];
        for (const host of hosts) {
            const item = this._normalizeHost(host);
            if (!item || !this._isValidIp(item.ip) || seen.has(item.ip)) continue;
            seen.add(item.ip);
            result.push(item);
        }
        return result;
    }

    _uniqueSubnets(subnets) {
        const seen = new Set();
        const result = [];
        for (const subnet of subnets) {
            const value = String(subnet || '').trim();
            if (!/^(\d{1,3}\.){2}\d{1,3}$/.test(value) || seen.has(value)) continue;
            seen.add(value);
            result.push(value);
        }
        return result;
    }

    _getDefaultSubnets(localIP) {
        const fallback = [
            '192.168.1',
            '192.168.0',
            '192.168.31',
            '192.168.43',
            '192.168.50',
            '192.168.100',
            '10.0.0',
            '172.16.0',
        ];
        return this._uniqueSubnets(localIP
            ? [localIP.split('.').slice(0, 3).join('.'), ...fallback]
            : fallback);
    }

    _buildSubnetHosts(subnet, start, end) {
        const hosts = [];
        const from = Math.max(1, Number(start) || 1);
        const to = Math.min(254, Number(end) || 254);
        for (let i = from; i <= to; i++) {
            hosts.push({ ip: `${subnet}.${i}`, source: 'subnet' });
        }
        return hosts;
    }

    _pushDevice(devices, seen, device) {
        if (!device || seen.has(device.ip)) return;
        seen.add(device.ip);
        devices.push(device);
        if (this.onDeviceFound) this.onDeviceFound(device);
    }

    async scan(portOrOptions = 8888, timeout = 1500) {
        if (this._scanning) return [];
        this._scanning = true;
        this._abortController = new AbortController();
        const signal = this._abortController.signal;
        const options = this._normalizeScanOptions(portOrOptions, timeout);

        try {
            const devices = [];
            const foundIps = new Set();
            const recentHosts = this._uniqueHosts(options.recentHosts);

            if (recentHosts.length > 0) {
                this._emitProgress({
                    phase: 'recent',
                    message: '正在检查最近连接过的 PC',
                    current: 0,
                    total: recentHosts.length,
                }, options.onProgress);

                const recentResults = await Promise.allSettled(
                    recentHosts.map(host => this._checkHost(host.ip, options.port, options.timeout, signal, host))
                );
                for (let i = 0; i < recentResults.length; i++) {
                    if (signal.aborted) break;
                    const result = recentResults[i];
                    if (result.status === 'fulfilled' && result.value) {
                        this._pushDevice(devices, foundIps, result.value);
                    }
                    this._emitProgress({
                        phase: 'recent',
                        message: '正在检查最近连接过的 PC',
                        current: i + 1,
                        total: recentHosts.length,
                    }, options.onProgress);
                }
            }

            this._emitProgress({
                phase: 'detect',
                message: '正在识别当前局域网网段',
                current: 0,
                total: 0,
            }, options.onProgress);

            const localIP = await this.getLocalIP();
            const subnets = this._uniqueSubnets(options.subnets || this._getDefaultSubnets(localIP));
            const totalHosts = subnets.length * (Math.min(254, options.rangeEnd) - Math.max(1, options.rangeStart) + 1);
            let checkedHosts = 0;

            for (const subnet of subnets) {
                if (signal.aborted) break;

                const tasks = this._buildSubnetHosts(subnet, options.rangeStart, options.rangeEnd);
                this._emitProgress({
                    phase: 'subnet',
                    subnet,
                    message: `正在扫描 ${subnet}.x`,
                    current: checkedHosts,
                    total: totalHosts,
                    found: devices.length,
                }, options.onProgress);

                for (let i = 0; i < tasks.length; i += options.concurrency) {
                    if (signal.aborted) break;

                    const batch = tasks.slice(i, i + options.concurrency);
                    const results = await Promise.allSettled(
                        batch.map(host => this._checkHost(host.ip, options.port, options.timeout, signal, host))
                    );
                    checkedHosts += batch.length;

                    for (const result of results) {
                        if (result.status === 'fulfilled' && result.value) {
                            this._pushDevice(devices, foundIps, result.value);
                        }
                    }

                    this._emitProgress({
                        phase: 'subnet',
                        subnet,
                        message: `正在扫描 ${subnet}.x`,
                        current: checkedHosts,
                        total: totalHosts,
                        found: devices.length,
                    }, options.onProgress);
                }
            }

            this._emitProgress({
                phase: 'done',
                message: devices.length ? `发现 ${devices.length} 台可同步 PC` : '未发现可同步 PC',
                current: totalHosts,
                total: totalHosts,
                found: devices.length,
            }, options.onProgress);

            return devices;
        } finally {
            this._scanning = false;
            this._abortController = null;
        }
    }

    async _checkHost(ip, port, timeout, parentSignal, meta = {}) {
        if (parentSignal.aborted) return null;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        const onParentAbort = () => controller.abort();
        parentSignal.addEventListener('abort', onParentAbort, { once: true });

        try {
            const res = await fetch(`http://${ip}:${port}/api/health`, {
                signal: controller.signal,
            });
            clearTimeout(timer);

            if (!res.ok) return null;

            const data = await res.json();
            if (data.status !== 'ok') return null;

            return {
                ip,
                port,
                name: data.device_name || meta.name || ip,
                deviceId: data.device_id || meta.deviceId || '',
                syncVersion: data.sync_version || 1,
                capabilities: Array.isArray(data.capabilities) ? data.capabilities : ['pull'],
                pairingRequired: data.pairing_required !== false,
                status: 'online',
                source: meta.source || 'subnet',
                lastSyncAt: meta.lastSyncAt,
                token: meta.token,
            };
        } catch (e) {
            clearTimeout(timer);
            return null;
        } finally {
            parentSignal.removeEventListener('abort', onParentAbort);
        }
    }
}

export class LanSync {
    constructor(storage) {
        this.storage = storage;
        this.state = SyncState.IDLE;
        this.progress = { current: 0, total: 0, phase: '' };
        this.report = null;
        this._abortController = null;
    }

    getState() { return this.state; }

    getProgress() { return this.progress; }

    getReport() { return this.report; }

    isSyncing() {
        return this.state === SyncState.CONNECTING ||
               this.state === SyncState.SYNCING ||
               this.state === SyncState.VERIFYING;
    }

    _setState(state) {
        this.state = state;
        if (this.onStateChange) this.onStateChange(state);
    }

    _setProgress(current, total, phase) {
        this.progress = { current, total, phase };
        if (this.onProgress) this.onProgress(current, total, phase);
    }

    abort() {
        if (this._abortController) {
            this._abortController.abort();
        }
    }

    async sync(serverIp) {
        if (this.isSyncing()) return;

        this._abortController = new AbortController();
        const signal = this._abortController.signal;
        const baseUrl = `http://${serverIp}:8888`;

        try {
            this._setState(SyncState.CONNECTING);
            this._setProgress(0, 0, '连接中...');

            const healthRes = await fetch(`${baseUrl}/api/health`, { signal });
            if (!healthRes.ok) throw new Error('连接失败');

            this._setState(SyncState.SYNCING);
            this._setProgress(0, 3, '拉取数据...');

            const syncRes = await fetch(`${baseUrl}/api/sync`, { signal });
            if (!syncRes.ok) throw new Error('拉取数据失败');
            const syncData = await syncRes.json();

            this._setProgress(1, 3, '合并数据...');
            const mergeResult = await this._mergeData(syncData);

            this._setProgress(2, 3, '下载图片...');
            const downloadResult = await this._downloadImages(baseUrl, syncData.images, signal);

            this._setState(SyncState.VERIFYING);
            this._setProgress(3, 3, '校验数据...');
            const verifyResult = await this._verifyData(syncData.sync_meta, downloadResult);

            this.report = this._buildReport(mergeResult, downloadResult, verifyResult);

            if (verifyResult.pass && downloadResult.failed.length === 0) {
                this._setState(SyncState.SUCCESS);
            } else {
                this._setState(SyncState.PARTIAL);
            }

            return this.report;

        } catch (e) {
            if (e.name === 'AbortError') {
                this._setState(SyncState.IDLE);
                return null;
            }
            this._setState(SyncState.ERROR);
            this.report = { error: e.message, success: false };
            throw e;
        } finally {
            this._abortController = null;
        }
    }

    async _mergeData(syncData) {
        const { folders = [], prompt_sets: remoteSets, versions: remoteVersions, images: remoteImages } = syncData;
        const localSets = await this.storage.query('SELECT * FROM prompt_sets');
        const localMap = new Map(localSets.map(s => [s.id, s]));

        const result = { added: 0, updated: 0, conflicts: [], skipped: 0 };

        await this._mergeFolders(folders);

        const versionsBySet = new Map();
        for (const v of remoteVersions) {
            if (!versionsBySet.has(v.prompt_set_id)) versionsBySet.set(v.prompt_set_id, []);
            versionsBySet.get(v.prompt_set_id).push(v);
        }

        const imagesByVersion = new Map();
        for (const img of remoteImages) {
            if (!imagesByVersion.has(img.version_id)) imagesByVersion.set(img.version_id, []);
            imagesByVersion.get(img.version_id).push(img);
        }

        for (const remoteSet of remoteSets) {
            const localSet = localMap.get(remoteSet.id);

            if (localSet) {
                if (this.storage.deletePromptSet) {
                    await this.storage.deletePromptSet(remoteSet.id);
                } else {
                    await this.storage.run('DELETE FROM images WHERE version_id IN (SELECT id FROM versions WHERE prompt_set_id = ?)', [remoteSet.id]);
                    await this.storage.run('DELETE FROM versions WHERE prompt_set_id = ?', [remoteSet.id]);
                    await this.storage.run('DELETE FROM prompt_sets WHERE id = ?', [remoteSet.id]);
                }
                result.updated++;
            } else {
                result.added++;
            }

            await this._insertSetWithVersions(remoteSet, versionsBySet.get(remoteSet.id) || [], imagesByVersion);
        }

        return result;
    }

    async _mergeFolders(folders) {
        if (!Array.isArray(folders) || folders.length === 0) return;
        for (const folder of folders) {
            if (!folder.id) continue;
            const existing = await this.storage.query('SELECT id FROM folders WHERE id = ?', [folder.id]);
            const now = new Date().toISOString();
            if (existing.length > 0) {
                await this.storage.run(
                    'UPDATE folders SET name = ?, color = ?, sort_order = ?, updated_at = ? WHERE id = ?',
                    [folder.name || '未命名分类', folder.color || '', folder.sortOrder || folder.sort_order || 0, folder.updatedAt || folder.updated_at || now, folder.id]
                );
            } else {
                await this.storage.run(
                    'INSERT INTO folders (id, name, color, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
                    [folder.id, folder.name || '未命名分类', folder.color || '', folder.sortOrder || folder.sort_order || 0, folder.createdAt || folder.created_at || now, folder.updatedAt || folder.updated_at || now]
                );
            }
        }
    }

    async _insertSetWithVersions(set, versions, imagesByVersion) {
        const now = new Date().toISOString();
        await this.storage.run(
            'INSERT OR REPLACE INTO prompt_sets (id, name, folder_id, tags, is_favorite, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [set.id, set.name, set.folder_id || '', set.tags || '[]', set.is_favorite ? 1 : 0, set.created_at || now, set.updated_at || now]
        );
        for (const v of versions) {
            await this.storage.run(
                'INSERT OR IGNORE INTO versions (id, prompt_set_id, version, prompt, negative_prompt, note, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [v.id, set.id, v.version, v.prompt || '', v.negative_prompt || '', v.note || '', v.sort_order || 0, v.created_at || now]
            );
            await this.storage.run(
                'UPDATE versions SET aspect_ratio = ?, style_preset = ?, sampler = ?, steps = ?, cfg_scale = ?, hr_fix = ?, model = ? WHERE id = ?',
                [v.aspect_ratio || '1:1', v.style_preset || '', v.sampler || 'DPM++ 2M Karras', v.steps || 30, v.cfg_scale || 7.0, (v.hr_fix === false || v.hr_fix === 0) ? 0 : 1, v.model || '', v.id]
            );
            const imgs = imagesByVersion.get(v.id) || [];
            for (const img of imgs) {
                await this.storage.run(
                    'INSERT OR IGNORE INTO images (id, version_id, name, path, file, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [img.id, v.id, img.name || '', img.path || '', img.file || '', img.note || '', img.created_at || now]
                );
            }
        }
    }

    async _downloadImages(baseUrl, images, signal) {
        const result = { downloaded: 0, failed: [], skipped: 0 };
        const imagesWithFile = images.filter(img => img.file);

        if (imagesWithFile.length === 0) return result;

        const toDownload = imagesWithFile;
        const total = toDownload.length;

        for (let i = 0; i < toDownload.length; i++) {
            const img = toDownload[i];
            try {
                if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');

                this._setProgress(i + 1, total, `下载图片 ${i + 1}/${total}`);

                const res = await fetch(`${baseUrl}/api/sync/images/${encodeURIComponent(img.file)}`, { signal });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                const blob = await res.blob();
                const dataUrl = await this._blobToDataUrl(blob);

                const { Filesystem, Directory } = await import('@capacitor/filesystem');
                await Filesystem.writeFile({
                    path: `images/${img.file}`,
                    data: dataUrl,
                    directory: Directory.Data,
                    recursive: true,
                });

                result.downloaded++;
            } catch (e) {
                if (e.name === 'AbortError') throw e;
                result.failed.push(img.file);
            }
        }

        result.skipped = 0;
        return result;
    }

    _blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    async _verifyData(syncMeta, downloadResult) {
        const result = { pass: true, details: {} };

        const localSets = await this.storage.query('SELECT COUNT(*) as cnt FROM prompt_sets');
        const localVersions = await this.storage.query('SELECT COUNT(*) as cnt FROM versions');
        const localImages = await this.storage.query('SELECT COUNT(*) as cnt FROM images');

        const setsOk = localSets[0]?.cnt >= (syncMeta?.total_prompt_sets || 0);
        const versionsOk = localVersions[0]?.cnt >= (syncMeta?.total_versions || 0);
        const imagesOk = localImages[0]?.cnt >= (syncMeta?.total_images || 0);

        result.details = {
            prompt_sets: { expected: syncMeta?.total_prompt_sets || 0, actual: localSets[0]?.cnt || 0, ok: setsOk },
            versions: { expected: syncMeta?.total_versions || 0, actual: localVersions[0]?.cnt || 0, ok: versionsOk },
            images: { expected: syncMeta?.total_images || 0, actual: localImages[0]?.cnt || 0, ok: imagesOk },
        };

        result.pass = setsOk && versionsOk && imagesOk && downloadResult.failed.length === 0;
        return result;
    }

    _buildReport(mergeResult, downloadResult, verifyResult) {
        return {
            success: verifyResult.pass && downloadResult.failed.length === 0,
            added: mergeResult.added,
            updated: mergeResult.updated,
            conflicts: mergeResult.conflicts,
            skipped: mergeResult.skipped,
            imagesDownloaded: downloadResult.downloaded,
            imagesFailed: downloadResult.failed,
            imagesSkipped: downloadResult.skipped,
            verification: verifyResult.details,
        };
    }

    async getCapabilities(serverIp) {
        const res = await fetch(`http://${serverIp}:8888/api/sync/capabilities`);
        if (!res.ok) throw new Error('无法读取 PC 互通能力');
        return res.json();
    }

    async getPairing(serverIp) {
        const res = await fetch(`http://${serverIp}:8888/api/sync/pairing`);
        if (!res.ok) throw new Error('无法获取配对令牌');
        return res.json();
    }

    _getAndroidDeviceId() {
        const key = 'lan-sync-android-device-id';
        try {
            let value = localStorage.getItem(key);
            if (!value) {
                value = `android-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
                localStorage.setItem(key, value);
            }
            return value;
        } catch (e) {
            return `android-${Date.now().toString(36)}`;
        }
    }

    async push(serverIp, options = {}) {
        if (this.isSyncing()) return null;

        this._abortController = new AbortController();
        const signal = this._abortController.signal;
        const baseUrl = `http://${serverIp}:8888`;
        const mode = options.mode || 'keep_pc';

        try {
            this._setState(SyncState.CONNECTING);
            this._setProgress(0, 4, '读取 PC 互通能力...');

            const pairing = options.token
                ? { sync_token: options.token }
                : await this.getPairing(serverIp);
            const token = pairing.sync_token;
            if (!token) throw new Error('缺少同步令牌');

            this._setState(SyncState.SYNCING);
            this._setProgress(1, 4, '整理 Android 本机数据...');
            const payload = await this.storage.exportData();

            this._setProgress(2, 4, '回传到 PC...');
            const res = await fetch(`${baseUrl}/api/sync/import`, {
                method: 'POST',
                signal,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Sync-Token': token,
                    'X-Device-Id': this._getAndroidDeviceId(),
                    'X-Device-Name': options.deviceName || 'Android',
                },
                body: JSON.stringify({ mode, payload }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || '回传失败');
            }

            this._setState(SyncState.VERIFYING);
            this._setProgress(3, 4, '读取回传报告...');
            const report = await res.json();
            this.report = {
                success: !!report.success,
                mode,
                token,
                added: report.added || 0,
                updated: report.updated || 0,
                conflicts: report.conflicts || 0,
                skipped: report.skipped || 0,
                imagesRestored: report.imagesRestored || 0,
                conflictItems: report.conflictItems || [],
            };
            this._setProgress(4, 4, '回传完成');
            this._setState(this.report.success ? SyncState.SUCCESS : SyncState.PARTIAL);
            return this.report;
        } catch (e) {
            if (e.name === 'AbortError') {
                this._setState(SyncState.IDLE);
                return null;
            }
            this._setState(SyncState.ERROR);
            this.report = { error: e.message, success: false };
            throw e;
        } finally {
            this._abortController = null;
        }
    }

    async bidirectional(serverIp, options = {}) {
        const pushReport = await this.push(serverIp, { ...options, mode: 'keep_pc' });
        if (!pushReport) return null;
        const pullReport = await this.sync(serverIp);
        this.report = {
            success: !!pullReport?.success && !!pushReport.success,
            mode: 'bidirectional',
            pushReport,
            pullReport,
        };
        return this.report;
    }
}
