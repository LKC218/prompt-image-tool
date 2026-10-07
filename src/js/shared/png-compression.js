import { resolveApiBase } from '../core/storage.js';

export const PNG_LIMITS = { count: 100, file: 20 * 1024 ** 2, total: 100 * 1024 ** 2, pixels: 16_000_000 };
export const fileKey = file => [file.webkitRelativePath || file.name, file.size, file.lastModified].join('|');
export const formatSize = bytes => bytes < 1024 ** 2 ? (bytes / 1024).toFixed(1) + ' KB' : (bytes / 1024 ** 2).toFixed(2) + ' MB';

export function outputPath(input, used = new Set(), format = 'png', converted = false) {
    const parts = String(input).replaceAll('\\', '/').split('/').filter(p => p && p !== '.' && p !== '..');
    const safe = parts.map(p => p.replace(/[<>:"|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/g, '') || '图片');
    const last = safe.pop() || '图片.png';
    const stem = last.replace(/\.(png|jpe?g|webp)$/i, '');
    const prefix = safe.length ? safe.join('/') + '/' : '';
    const suffix = converted ? '-转换' : '-压缩';
    const extension = format === 'jpeg' ? 'jpg' : format;
    let number = 1, result = prefix + stem + suffix + '.' + extension;
    while (used.has(result.toLowerCase())) result = prefix + stem + suffix + '-' + (++number) + '.' + extension;
    used.add(result.toLowerCase());
    return result;
}

export async function validatePng(file) {
    if (!/\.png$/i.test(file.name)) throw new Error('仅支持 PNG 图片');
    if (!file.size || file.size > PNG_LIMITS.file) throw new Error('单图必须在 20 MB 以内');
    const data = new Uint8Array(await file.arrayBuffer());
    if (![137,80,78,71,13,10,26,10].every((v,i) => data[i] === v)) throw new Error('PNG 文件签名无效');
    const view = new DataView(data.buffer);
    if (data.length < 33 || String.fromCharCode(...data.slice(12,16)) !== 'IHDR') throw new Error('PNG 头部损坏');
    const width = view.getUint32(16), height = view.getUint32(20);
    if (!width || !height || width * height > PNG_LIMITS.pixels) throw new Error('图片不得超过 1600 万像素');
    let offset = 8, ended = false;
    while (offset + 12 <= data.length) {
        const size = view.getUint32(offset);
        const type = String.fromCharCode(...data.slice(offset + 4, offset + 8));
        if (offset + size + 12 > data.length) throw new Error('PNG 数据块不完整');
        if (['acTL','fcTL','fdAT'].includes(type)) throw new Error('暂不支持 APNG 动画');
        offset += size + 12;
        if (type === 'IEND') { ended = true; break; }
    }
    if (!ended || offset !== data.length) throw new Error('PNG 数据不完整或存在尾随内容');
    return { width, height };
}

export async function connectCompressor() {
    const base = await resolveApiBase(), endpoint = base + '/api/image-process';
    const response = await fetch(endpoint + '/status');
    const info = await response.json().catch(() => ({}));
    if (!response.ok || !info.ready) throw new Error(info.error || '请启动新版图片处理后端');
    const headers = { 'Content-Type': 'application/octet-stream', 'X-Png-Token': info.token };
    async function request(path, body, signal) {
        const response = await fetch(endpoint + path, { method: 'POST', headers, body, signal });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || '本地图片处理失败');
        }
        return response;
    }
    return {
        version: info.version, cache: info.cache,
        async inspect(file, job, signal) {
            if (!file.size || file.size > PNG_LIMITS.file) throw new Error('单图须在 20 MB 以内');
            return (await request('/inspect?job=' + job, file, signal ? AbortSignal.any([signal, AbortSignal.timeout(120000)]) : AbortSignal.timeout(120000))).json();
        },
        async cleanCache() { return (await request('/cache-clean')).json(); },
        async compress(file, settings, job, signal) {
            const query = new URLSearchParams({ ...settings, job });
            const response = await request('?' + query, file, signal);
            const parts = await response.formData();
            const report = JSON.parse(parts.get('report')), blob = parts.get('image');
            if (!(blob instanceof Blob) || !['compressed','unchanged','preserved','converted'].includes(report.status)) throw new Error('图片处理响应无效');
            return { blob, status: report.status, report };
        },
        async cancel(job) {
            if (!job) return;
            await fetch(endpoint + '/cancel?job=' + job, { method: 'POST', headers, keepalive: true }).catch(() => {});
        },
    };
}


