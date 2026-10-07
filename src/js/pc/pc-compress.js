import { renderPcWelcomeBanner } from './pc-welcome-banner.js';
import { escapeHtml } from './pc-utils.js';
import folderOpenIcon from '../../assets/icons/folder-open.svg?raw';
import folderIcon from '../../assets/icons/folder.svg?raw';
import plusIcon from '../../assets/icons/plus.svg?raw';
import downloadIcon from '../../assets/icons/pc/download.svg?raw';
import xIcon from '../../assets/icons/pc/x.svg?raw';
import { connectCompressor, fileKey, outputPath, formatSize, PNG_LIMITS } from '../shared/png-compression.js';
import { resizeDefaults, normalizeResize, calculateResize } from '../shared/image-resize.js';

let page = null, queue = [], service = null, busy = false, importing = false, exporting = false;
const defaults = () => ({ ...resizeDefaults(), level: 2, threads: 2, budget: 60, operation: 'optimize', target: 'webp', encoding: 'lossless', quality: 85, background: '#ffffff', ack: false });
let settings = defaults();
let settingsOpen = false;
let controller = null, job = null, serial = 0, lifecycle = 0, started = 0;
let runSerial = 0, elapsed = 0;
let importController = null, importJob = null;
let noticeTimer = null;
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const motions = new Set();
function animate(element, frames, duration = 200) {
    if (!element || reduced() || !element.animate) return;
    const motion = element.animate(frames, { duration, easing: 'cubic-bezier(.2,.7,.2,1)' });
    motions.add(motion); motion.finished.catch(() => {}).finally(() => motions.delete(motion));
    return motion;
}
function showToast(message, type = 'success') {
    const notice = $('#imageNotice');
    if (!notice) return;
    clearTimeout(noticeTimer); notice.textContent = message; notice.hidden = false; notice.dataset.type = type;
    animate(notice, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }]);
    noticeTimer = setTimeout(() => { notice.hidden = true; }, 4500);
}
// 同一行复用 DOM，仅同步变化的属性与文本，保留输入焦点和预览节点。
function reconcile(current, next) {
    if (current.nodeType !== next.nodeType || current.nodeName !== next.nodeName) { current.replaceWith(next.cloneNode(true)); return; }
    if (current.nodeType === Node.TEXT_NODE) { if (current.data !== next.data) current.data = next.data; return; }
    for (const attr of [...current.attributes]) if (!next.hasAttribute(attr.name)) current.removeAttribute(attr.name);
    for (const attr of next.attributes) if (current.getAttribute(attr.name) !== attr.value) current.setAttribute(attr.name, attr.value);
    if (current instanceof HTMLInputElement) current.checked = next.checked;
    const before = [...current.childNodes], after = [...next.childNodes];
    after.forEach((node, index) => before[index] ? reconcile(before[index], node) : current.append(node.cloneNode(true)));
    before.slice(after.length).forEach(node => node.remove());
}
const labels = { converted: '已转换', waiting: '等待处理', running: '处理中', compressed: '完成', unchanged: '无需优化', preserved: '保留原图', error: '处理失败', cancelled: '已取消' };
const successful = item => ['compressed', 'unchanged', 'preserved', 'converted'].includes(item.status);
const $ = selector => page?.querySelector(selector);
const invalidColor = () => settings.operation === 'convert' && settings.target === 'jpeg' && $('#imageBackground')?.getAttribute('aria-invalid') === 'true';
const needsAck = () => settings.resize || settings.operation === 'convert' || settings.encoding === 'lossy';
const settingsKey = () => JSON.stringify(Object.fromEntries(Object.entries(settings).filter(([key]) => key !== 'ack')));
function resizeError() {
    try { normalizeResize(settings); return ''; } catch (error) { return error.message; }
}
function expectedSize(item) {
    try {
        if (settings.resize && item.depth > 8) throw new Error('高位深 PNG 不支持调整尺寸');
        if (settings.resize && !['RGB','RGBA','L','LA','P','1'].includes(item.mode)) throw new Error('特殊色彩模式不支持调整尺寸');
        return calculateResize(item.width, item.height, settings);
    } catch (error) { return { error: error.message }; }
}
function dimensionNote(item) {
    const expected = expectedSize(item), original = item.width + '×' + item.height;
    let text = original + (settings.resize ? ' → 预计 ' + (expected.error || expected.width + '×' + expected.height) : ' · 原始尺寸');
    if (item.result) {
        const actual = item.report?.output || item;
        text += ' · 已生成 ' + actual.width + '×' + actual.height;
        if (item.settingsKey !== settingsKey()) text += '（旧参数）';
    }
    return text;
}
// 只内联项目内的可信图标，描边随主题继承，不拼接用户 SVG。
const icons = { folderOpen: folderOpenIcon, folder: folderIcon, plus: plusIcon, download: downloadIcon, x: xIcon };
const pcIcon = name => (icons[name] || '').replace('<svg', '<svg class="png-glyph" aria-hidden="true"').replace(/stroke="#[^"]+"/g, 'stroke="currentColor"');

export function render() {
    return `${renderPcWelcomeBanner({ title: '图片处理', subtitle: '批量压缩与格式转换，图片轻松整理。', className: 'pc-welcome-banner-category' })}<section class="pc-compress">
        <header class="png-intro"><span class="png-sr-only">图片压缩工作台</span><details class="png-help"><summary>使用说明</summary><div>
            <p>本机处理 · 不覆盖原图。无损优化校验像素与元数据；转换不保证保留全部元数据。</p>
            <p>支持 PNG、JPEG、静态 WebP，不支持动画。最多 100 张，单张 20 MB，总计 100 MB，单张 1600 万像素。</p>
            <p>PNG 无损编码不等于无损缩放。调整尺寸改变像素，JPEG 实际缩放会按指定质量重新编码。高位深 PNG 不支持缩放。</p>
            <p>ZIP 保留相对目录，同名文件分别保留；仅原格式未缩放优化可回退原图。尺寸变化后的结果可能更大。</p>
            <p>刷新或离开此页会清空队列，请先导出结果。文件夹请使用导入按钮。</p>
        </div></details></header>
        <div class="png-workspace"><section class="png-panel" id="pngDrop" aria-label="图片队列与拖放区域">
            <div class="png-toolbar"><div class="png-actions">
                <button class="pc-btn pc-btn-secondary" data-action="files">${pcIcon('plus')} 添加图片</button>
                <button class="pc-btn pc-btn-secondary" data-action="folder">${pcIcon('folder')} 导入文件夹</button>
                <span id="pngCount" hidden>0 张</span></div>
                <div class="png-mode"><span id="pngSettingLabel">标准 · 等级 2</span><button class="pc-btn pc-btn-secondary" data-action="settings" aria-controls="pngSettings" aria-expanded="false">处理设置<span class="image-settings-arrow" aria-hidden="true">‹</span></button><button class="png-text-button" data-action="clear" hidden>清空</button></div>
            </div>
            <div class="png-empty" id="pngEmpty">${pcIcon('folderOpen')}<h2>拖入图片</h2><p>PNG、JPEG、WebP · 支持混合批量导入</p></div>
            <div class="png-table-wrap" hidden><table class="png-table"><thead><tr><th><input type="checkbox" id="pngAll" aria-label="全选图片"></th><th>图片</th><th>体积变化</th><th>状态</th><th><span class="png-sr-only">操作</span></th></tr></thead><tbody id="pngRows"></tbody></table></div>
        </section>
        <div class="image-settings-slot"><aside class="png-settings" id="pngSettings" aria-label="处理设置" aria-hidden="true" inert>
            <header><h3>处理设置</h3><button class="png-icon-button" data-action="close-settings" aria-label="关闭处理设置">${pcIcon('x')}</button></header>
            <div class="image-settings-scroll"><fieldset id="pngSettingsFields"><legend class="png-sr-only">处理参数</legend>
                <div class="png-presets" aria-label="处理模式"><button data-operation="optimize">压缩优化</button><button data-operation="convert">格式转换</button></div>
                <div id="imageTargetGroup" hidden><label class="png-setting-label">输出格式</label><div class="png-presets" aria-label="输出格式"><button data-target="png">PNG</button><button data-target="jpeg">JPEG</button><button data-target="webp">WebP</button></div></div>
                <div id="imageEncodingChoices"><label class="png-setting-label">编码方式</label><div class="png-presets" aria-label="编码方式"><button data-encoding="lossless">无损</button><button data-encoding="lossy">有损</button></div></div>
                <p id="imageEncodingState" class="image-encoding-state" hidden></p>
                <div id="imageQualityGroup" hidden><label class="png-setting-label" for="imageQuality"><span id="imageQualityLabel">质量</span><output id="imageQualityValue">85</output></label><input id="imageQuality" type="range" min="1" max="100" value="85"><p id="imageJpegResizeNote" class="png-setting-note" hidden>JPEG 缩放后将重新编码。</p></div>
                <div id="imageBackgroundGroup" hidden><label class="png-setting-label" for="imageBackground">透明区域填充</label><div class="image-color-field"><span id="imageColorPreview" aria-hidden="true"></span><input id="imageBackground" type="text" value="#ffffff" maxlength="7" pattern="#[0-9a-fA-F]{6}" aria-label="填充颜色，六位十六进制色值" spellcheck="false"></div><div class="image-color-presets" role="group" aria-label="常用填充颜色"><button data-background="#ffffff" style="--swatch:#ffffff" aria-label="白色"></button><button data-background="#000000" style="--swatch:#000000" aria-label="黑色"></button><button data-background="#fff0cc" style="--swatch:#fff0cc" aria-label="奶油色"></button><button data-background="#ccddff" style="--swatch:#ccddff" aria-label="浅蓝色"></button></div><p>JPEG 不支持透明；可输入 #RRGGBB，缩略图同步预览。</p></div>
                <div class="image-resize-heading"><label for="imageResize">调整尺寸</label><input id="imageResize" type="checkbox" role="switch" aria-controls="imageResizeFields"></div>
                <div id="imageResizeFields" hidden>
                    <div class="png-presets" role="group" aria-label="尺寸模式"><button data-resize-mode="dimensions">指定尺寸</button><button data-resize-mode="percent">百分比</button><button data-resize-mode="longest">最长边</button></div>
                    <div id="imageDimensionsGroup">
                        <div class="image-dimension-grid"><label for="imageWidth">宽度</label><div class="image-height-label"><label for="imageHeight">高度</label><button class="png-text-button image-ratio-lock" data-action="ratio-lock" aria-label="锁定宽高比例" aria-describedby="imageResizeHint" aria-pressed="true">锁定</button></div><span class="image-number-field"><input id="imageWidth" data-resize-value="width" type="number" min="1" max="16384" step="1" placeholder="自动" aria-describedby="imageResizeHint imageResizeError"><span>px</span></span><span class="image-number-field"><input id="imageHeight" data-resize-value="height" type="number" min="1" max="16384" step="1" placeholder="自动" aria-describedby="imageResizeHint imageResizeError"><span>px</span></span></div>
                    </div>
                    <div id="imagePercentGroup" hidden><label class="png-setting-label" for="imagePercent">缩放比例</label><div class="image-number-field"><input id="imagePercent" data-resize-value="percent" type="number" min="0.01" max="1000" step="0.01" aria-describedby="imageResizeError"><span>%</span></div><div class="image-percent-presets" role="group" aria-label="比例快捷项"><button class="png-text-button" data-percent="25">25%</button><button class="png-text-button" data-percent="50">50%</button><button class="png-text-button" data-percent="75">75%</button></div></div>
                    <div id="imageLongestGroup" hidden><label class="png-setting-label" for="imageLongest">限制最长边</label><div class="image-number-field"><input id="imageLongest" data-resize-value="longest" type="number" min="1" max="16384" step="1" aria-describedby="imageResizeError"><span>px</span></div></div>
                    <label class="image-ack"><input id="imageOnlyShrink" type="checkbox" checked>仅缩小</label>
                    <p id="imageResizeHint"></p><p id="imageResizeError" class="image-resize-error" role="status" hidden></p>
                </div>
                <div id="imageAckGroup" hidden><label class="image-ack"><input id="imageAck" type="checkbox">我了解像素及元数据可能变化</label><details id="imageRiskDetails" class="image-risk-details"><summary>查看处理说明</summary><p>缩放会改变像素，PNG 无损编码不等于无损缩放；JPEG 缩放按指定质量重新编码。</p><p>转换、缩放或有损编码可能丢失元数据。导出附原始元数据快照，不能替代原文件；快照可能包含定位或提示词，请确认分享范围。</p><p>仅未缩放的原格式优化可回退原图；转换与缩放结果可能增大。设置不改动已有结果，请使用“重新处理所选”更新。</p><p>边长 1–16384，百分比 0.01–1000；输出不超过 1600 万像素、32 MB。高位深和特殊颜色模式不支持缩放。</p></details></div>
                <div id="imageOptimizationGroup"><label class="png-setting-label">优化强度 <span id="imageCustomLevel" hidden></span></label>
                <div class="png-presets" role="group" aria-label="快捷预设">
                    <button data-level="1">快速</button><button data-level="2">标准</button><button data-level="4">深度</button><button data-level="6">极限</button>
                </div>
                <p class="png-setting-note">影响处理耗时，不代表画质。</p></div>
                <details class="png-advanced" id="imageAdvanced"><summary>高级设置</summary>
                    <div id="imageFineLevel"><label class="png-setting-label" for="pngLevel">精确等级 <output id="pngLevelValue">2</output></label><input id="pngLevel" type="range" min="0" max="6" step="1" value="2"><p class="png-setting-note">PNG／WebP：0 更快，6 尝试更多；JPEG 不使用。</p></div>
                    <div id="imagePngAdvanced">
                    <label class="png-setting-label" for="pngThreads">PNG 线程上限 <output id="pngThreadsValue">2</output></label>
                    <input id="pngThreads" type="range" min="1" max="4" step="1" value="2">
                    <label class="png-setting-label" for="pngBudget">PNG 优化预算</label>
                    <div class="png-presets" id="pngBudget" role="group" aria-label="单图优化预算"><button data-budget="15">15 秒</button><button data-budget="30">30 秒</button><button data-budget="60">60 秒</button></div>
                    <p>仅用于 PNG 原格式无损优化；预算限制后续尝试，进程最长 90 秒。</p></div>
                    <section class="image-cache-maintenance" aria-labelledby="imageCacheTitle"><h4 id="imageCacheTitle">缓存维护</h4><p id="imageCacheInfo">正在读取…</p><p>仅清理过期且不活跃的任务，不涉及原图或图库。</p><button class="png-text-button" data-action="clean-cache">清理过期缓存</button></section>
                    <button class="png-text-button" data-action="reset-settings">恢复默认</button>
                </details>
            </fieldset>
        </div></aside></div></div>
        <div class="png-feedback"><p id="pngEngine" role="status">正在连接本地服务…</p><button class="png-text-button" data-action="connect" hidden>重新连接</button>
            <details id="pngReport" hidden><summary id="pngReportSummary"></summary><p id="pngImportReport"></p></details></div>
        <footer class="png-footer"><div class="png-footer-info"><strong id="pngSummary" role="status" aria-live="polite">添加图片后开始</strong>
            <progress id="pngProgress" value="0" max="1" aria-label="批量压缩进度" hidden></progress>
            <small id="pngLeaveNote" hidden>尚有未导出结果，离开页面将清空。</small></div>
            <div class="png-actions"><button class="png-text-button" data-action="reprocess" hidden>重新处理所选</button><button class="png-text-button" data-action="retry" hidden>重试失败项</button>
                <button class="pc-btn pc-btn-primary" data-action="run" disabled>开始压缩</button>
                <button class="pc-btn pc-btn-secondary" data-action="cancel" hidden>取消处理</button>
                <button class="pc-btn pc-btn-primary" data-action="export" hidden>${pcIcon('download')} 导出 ZIP</button>
            </div></footer>
        <input id="pngFiles" type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" multiple hidden><input id="pngFolder" type="file" webkitdirectory multiple hidden>
        <div id="imageNotice" class="image-notice" role="status" aria-live="polite" hidden></div>
        <dialog id="imageConfirm" class="image-confirm" aria-labelledby="imageConfirmTitle" aria-describedby="imageConfirmBody">
            <h3 id="imageConfirmTitle">重新处理所选图片？</h3>
            <p id="imageConfirmBody">所选未导出的结果将被释放，原图保留。</p>
            <form method="dialog"><button class="pc-btn pc-btn-secondary" value="cancel" autofocus>暂不处理</button><button class="pc-btn pc-btn-primary" value="confirm">重新处理</button></form>
        </dialog>
    </section>`;
}

function rows() {
    if (!page) return;
    const locked = busy || importing || exporting;
    const body = $('#pngRows');
    const existing = new Map([...body.children].map(row => [row.dataset.row, row]));
    queue.forEach(item => {
        const duplicate = queue.some(other => other !== item && other.file.name === item.file.name);
        const detail = item.path + ' · ' + item.width + '×' + item.height;
        const formatNote = (item.format || 'png').toUpperCase() + (item.report ? ' → ' + item.report.format.toUpperCase() : '');
        const dimensions = dimensionNote(item);
        const html = `<tr data-row="${item.id}" data-status="${item.status}"><td><input type="checkbox" data-select="${item.id}" aria-label="选择 ${escapeHtml(item.file.name)}" ${item.selected ? 'checked' : ''} ${locked ? 'disabled' : ''}></td>
        <td><div class="png-file"><img style="background:${settings.operation === 'convert' && settings.target === 'jpeg' ? settings.background : 'transparent'}" src="${item.url}" alt="" loading="lazy"><div><button class="png-file-name" data-info="${item.id}" title="${escapeHtml(detail)}" aria-label="查看 ${escapeHtml(item.file.name)} 详情">${escapeHtml(item.file.name)}</button><small>${formatNote}</small><small class="image-dimensions" title="${escapeHtml(dimensions)}">${escapeHtml(dimensions)}</small>${duplicate ? '<small>' + escapeHtml(item.path.includes('/') ? item.path.slice(0, item.path.lastIndexOf('/')) : '根目录') + '</small>' : ''}</div></div></td>
        <td class="png-size">${formatSize(item.file.size)}${item.result ? ' <span aria-label="压缩后">→ ' + formatSize(item.result.size) + '</span>' : ''}${item.result && item.result.size < item.file.size ? '<small class="png-saving">−' + ((1 - item.result.size / item.file.size) * 100).toFixed(1) + '%</small>' : ''}</td>
        <td><span class="png-status ${item.status}" title="${escapeHtml(item.error || item.report?.notes?.join('；') || (item.status === 'preserved' ? '候选元数据变化，已保留原文件' : labels[item.status]))}">${labels[item.status]}</span>${item.error ? '<small class="png-error">' + escapeHtml(item.error) + '</small>' : ''}</td>
        <td><div class="png-actions"><button class="png-icon-button" data-download="${item.id}" aria-label="导出 ${escapeHtml(item.file.name)}" ${!successful(item) ? 'hidden' : ''} ${locked ? 'disabled' : ''}>${pcIcon('download')}</button><button class="png-icon-button" data-remove="${item.id}" aria-label="移除 ${escapeHtml(item.file.name)}" ${locked ? 'disabled' : ''}>${pcIcon('x')}</button></div></td></tr>`;
        const template = document.createElement('template'); template.innerHTML = '<table><tbody>' + html + '</tbody></table>';
        const next = template.content.querySelector('tr'), current = existing.get(String(item.id));
        if (current) {
            const changed = current.dataset.status !== item.status;
            reconcile(current, next); existing.delete(String(item.id));
            if (changed && successful(item)) animate(current.querySelector('.png-status'), [{ opacity: .35 }, { opacity: 1 }], 240);
        } else {
            body.append(next);
            if (queue.length <= 12) animate(next, [{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }]);
        }
    });
    existing.forEach(row => {
        if (row.dataset.removing) return;
        row.dataset.removing = 'true'; row.inert = true;
        const motion = existing.size <= 12 ? animate(row, [{ opacity: 1 }, { opacity: 0, transform: 'translateX(6px)' }], 140) : null;
        if (motion) motion.finished.catch(() => {}).finally(() => row.remove());
        else row.remove();
    });
    $('#pngEmpty').hidden = queue.length > 0;
    $('.png-table-wrap').hidden = !queue.length;
    $('#pngCount').hidden = !queue.length;
    $('#pngCount').textContent = queue.length + ' 张';
    $('[data-action="clear"]').hidden = !queue.length;
    const all = $('#pngAll');
    all.checked = !!queue.length && queue.every(x => x.selected);
    all.indeterminate = queue.some(x => x.selected) && !all.checked;
    summary();
}

function summary() {
    if (!page) return;
    syncRelevantSettings();
    const selected = queue.filter(x => x.selected), done = selected.filter(successful);
    const pending = selected.some(x => !successful(x));
    const retryable = selected.some(x => ['error','cancelled'].includes(x.status));
    const retryIsPrimary = retryable && !selected.some(x => ['waiting','running'].includes(x.status));
    const finished = selected.filter(x => successful(x) || x.status === 'error').length;
    const saved = done.reduce((sum,x) => sum + x.file.size - x.result.size, 0);
    $('#pngSummary').textContent = busy ? '正在处理 ' + finished + ' / ' + selected.length
        : importing ? '正在导入…' : exporting ? '正在打包…'
        : done.length ? '所选成功 ' + done.length + ' 张 · ' + (saved >= 0 ? '节省 ' : '增加 ') + formatSize(Math.abs(saved))
        : selected.length ? '已选 ' + selected.length + ' 张 · ' + formatSize(selected.reduce((sum,x) => sum + x.file.size, 0))
        : queue.length ? '请选择要处理的图片' : '添加图片后开始';
    $('#pngProgress').hidden = !busy;
    $('#pngProgress').max = selected.length || 1;
    $('#pngProgress').value = finished;
    $('#pngLeaveNote').hidden = !queue.some(x => successful(x) && !x.exported);
    const locked = busy || importing || exporting;
    page.querySelectorAll('[data-action="files"],[data-action="folder"],[data-action="clear"],[data-level]').forEach(button => button.disabled = locked);
    $('#pngSettingsFields').disabled = locked;
    $('#pngAll').disabled = locked || !queue.length;
    const runButton = $('[data-action="run"]'), exportButton = $('[data-action="export"]');
    runButton.hidden = busy || retryIsPrimary || (done.length > 0 && !pending);
    runButton.disabled = locked || !service || !pending || invalidColor() || !!resizeError() || (needsAck() && !settings.ack);
    $('[data-action="reprocess"]').hidden = !done.length;
    $('[data-action="reprocess"]').disabled = locked;
    $('[data-action="clean-cache"]').disabled = locked || !service;
    runButton.textContent = done.length ? '处理剩余项' : '开始处理';
    const retryButton = $('[data-action="retry"]');
    retryButton.hidden = busy || !retryable;
    retryButton.disabled = locked || !service || invalidColor() || !!resizeError() || (needsAck() && !settings.ack);
    retryButton.className = retryIsPrimary ? 'pc-btn pc-btn-primary' : 'png-text-button';
    $('[data-action="cancel"]').hidden = !busy;
    exportButton.hidden = busy || !done.length;
    exportButton.disabled = locked;
    exportButton.classList.toggle('pc-btn-primary', !pending);
    exportButton.classList.toggle('pc-btn-secondary', pending);
}

async function connect() {
    const session = lifecycle;
    $('[data-action="connect"]').hidden = true;
    try {
        const next = await connectCompressor();
        if (session !== lifecycle) return;
        service = next;
        cacheInfo(next.cache);
        $('#pngEngine').textContent = 'Oxipng ' + next.version + ' · 本机离线引擎已就绪';
        $('#pngEngine').hidden = true;
        $('.pc-compress').dataset.engineReady = 'true';
    } catch (error) {
        if (session !== lifecycle) return;
        service = null;
        $('#pngEngine').hidden = false;
        $('.pc-compress').dataset.engineReady = 'false';
        $('#pngEngine').textContent = error.message;
        $('[data-action="connect"]').hidden = false;
    }
    summary();
}

async function addFiles(files) {
    if (busy || importing || exporting) return;
    importing = true;
    rows();
    const session = lifecycle, failures = [];
    let added = 0, bytes = queue.reduce((sum,x) => sum + x.file.size, 0);
    try {
        for (const file of Array.from(files)) {
            if (session !== lifecycle) return;
            try {
                if (queue.some(x => x.key === fileKey(file))) throw new Error('重复文件');
                if (queue.length >= PNG_LIMITS.count || bytes + file.size > PNG_LIMITS.total) throw new Error('超出队列数量或总大小限制');
                if (!service) throw new Error('请先连接本地图片处理服务');
                importController = new AbortController(); importJob = crypto.randomUUID();
                const dimensions = await service.inspect(file, importJob, importController.signal);
                if (session !== lifecycle) return;
                queue.push({ id: ++serial, file, path: file.webkitRelativePath || file.name, key: fileKey(file),
                    url: URL.createObjectURL(file), ...dimensions, selected: true, status: 'waiting', result: null });
                bytes += file.size;
                added++;
            } catch (error) { failures.push(file.name + '：' + error.message); }
        }
        if (session !== lifecycle) return;
        $('#pngReport').hidden = !failures.length;
        $('#pngReportSummary').textContent = '已添加 ' + added + ' 张 · ' + failures.length + ' 项未导入，查看详情';
        $('#pngImportReport').textContent = '加入 ' + added + ' 张' + (failures.length ? '；跳过 ' + failures.length + ' 项。' + failures.slice(0,8).join('；') + (failures.length > 8 ? '；其余略' : '') : '。文件仅在本机处理。');
    } finally {
        if (session === lifecycle) {
            importing = false;
            importController = null; importJob = null;
            $('#pngFiles').value = ''; $('#pngFolder').value = '';
            rows();
        }
    }
}

async function run(retryOnly = false) {
    if (busy || importing || exporting || !service) return;
    if (invalidColor()) { showToast('请填写有效的六位颜色，例如 #ffffff', 'error'); return; }
    if (resizeError()) { showToast(resizeError(), 'error'); return; }
    if (needsAck() && !settings.ack) { showToast('请先确认设置中的元数据提示'); toggleSettings(true); return; }
    const targets = queue.filter(x => x.selected && !successful(x) && (!retryOnly || ['error','cancelled'].includes(x.status)));
    if (!targets.length) return;
    const session = lifecycle, client = service;
    const runId = ++runSerial;
    busy = true; started = Date.now(); rows();
    for (const item of targets) {
        if (!busy || session !== lifecycle || runId !== runSerial) break;
        item.status = 'running'; item.error = '';
        const abort = new AbortController();
        controller = abort; job = crypto.randomUUID();
        const activeJob = job;
        const timeout = setTimeout(() => { client.cancel(activeJob); abort.abort(); }, 120000);
        rows();
        try {
            const expected = expectedSize(item);
            if (expected.error) throw new Error(expected.error);
            const result = await client.compress(item.file, { ...settings }, activeJob, abort.signal);
            if (session !== lifecycle || !busy || runId !== runSerial) break;
            const held = queue.reduce((sum,x) => sum + (x.result?.size || 0) + (x.report ? JSON.stringify(x.report).length * 2 : 0), 0);
            if (held + result.blob.size + JSON.stringify(result.report).length * 2 > PNG_LIMITS.total) throw new Error('结果缓存达到 100 MB，请导出并移除已完成项后重试');
            item.result = result.blob; item.status = result.status; item.report = result.report; item.exported = false;
            item.settingsKey = settingsKey();
        } catch (error) {
            if (session !== lifecycle || runId !== runSerial) break;
            item.status = busy ? 'error' : 'cancelled';
            item.error = error.name === 'AbortError' ? (busy ? '请求超时，请重试' : '') : error.message;
        } finally {
            clearTimeout(timeout);
        }
        job = null; controller = null; rows();
    }
    if (session === lifecycle && runId === runSerial) { elapsed = Date.now() - started; busy = false; rows(); }
}

function cancel() {
    if (!busy) return;
    runSerial++;
    elapsed = Date.now() - started;
    busy = false;
    service?.cancel(job);
    controller?.abort();
    queue.forEach(x => { if (x.status === 'running') x.status = 'cancelled'; });
    rows();
}

function save(blob, name) {
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
}

async function exportZip(single = null) {
    if (busy || importing || exporting) return;
    const items = single ? [single] : queue.filter(x => x.selected && successful(x));
    if (!items.length) return;
    exporting = true; rows();
    const session = lifecycle;
    try {
        const { zip } = await import('fflate');
        const entries = Object.create(null), used = new Set();
        let bytes = 0;
        for (const item of items) {
            const name = outputPath(item.path, used, item.report?.format || item.format, item.status === 'converted');
            entries[name] = new Uint8Array(await item.result.arrayBuffer());
            bytes += entries[name].length;
            if (item.report?.resized || item.report?.metadata?.length || item.report?.status === 'converted' || item.report?.notes?.some(note => note.includes('有损编码'))) {
                entries[name + '.metadata.json'] = new TextEncoder().encode(JSON.stringify(item.report, null, 2));
                bytes += entries[name + '.metadata.json'].length;
            }
            if (bytes > PNG_LIMITS.total) throw new Error('单次导出超过 100 MB，请分批选择');
        }
        if (session !== lifecycle) return;
        const data = await new Promise((resolve,reject) => zip(entries, { level: 0 }, (error,data) => error ? reject(error) : resolve(data)));
        if (session !== lifecycle) return;
        save(new Blob([data], { type: 'application/zip' }), '图片处理-' + new Date().toISOString().slice(0,10) + '.zip');
        items.forEach(item => item.exported = true);
        showToast('已发起 ' + items.length + ' 张图片副本下载');
    } catch (error) { if (session === lifecycle) showToast('导出失败：' + error.message, 'error'); }
    finally { if (session === lifecycle) { exporting = false; rows(); } }
}

async function click(event) {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.dataset.resizeMode || button.dataset.percent || button.dataset.action === 'ratio-lock') {
        if (busy || importing || exporting) return;
        if (button.dataset.resizeMode) settings.resizeMode = button.dataset.resizeMode;
        if (button.dataset.percent) settings.percent = button.dataset.percent;
        if (button.dataset.action === 'ratio-lock') settings.lockRatio = !settings.lockRatio;
        syncSettings(); rows(); return;
    }
    if (button.dataset.background) {
        if (busy || importing || exporting) return;
        settings.background = button.dataset.background; syncSettings(); rows(); return;
    }
    if (button.dataset.info) {
        const item = queue.find(x => x.id === Number(button.dataset.info));
        showToast(item.path + ' · ' + item.width + '×' + item.height + ' · ' + (item.report?.notes?.join('；') || '') + (item.status === 'preserved' ? ' · 候选元数据变化，已保留原文件' : ''));
        return;
    }
    if (button.dataset.remove) {
        const item = queue.find(x => x.id === Number(button.dataset.remove));
        URL.revokeObjectURL(item.url); queue = queue.filter(x => x !== item); rows(); return;
    }
    if (button.dataset.download) {
        const item = queue.find(x => x.id === Number(button.dataset.download));
        if (item.report?.resized || item.report?.metadata?.length || item.report?.status === 'converted' || item.report?.notes?.some(note => note.includes('有损编码'))) { exportZip(item); return; }
        save(item.result, outputPath(item.file.name, new Set(), item.report?.format || item.format)); item.exported = true; summary(); return;
    }
    if (button.dataset.operation || button.dataset.target || button.dataset.encoding) {
        if (busy || importing || exporting) return;
        for (const key of ['operation','target','encoding']) if (button.dataset[key]) settings[key] = button.dataset[key];
        settings.ack = false;
        if (settings.operation === 'convert' && settings.target === 'jpeg') settings.encoding = 'lossy';
        if (settings.operation === 'convert' && settings.target === 'png') settings.encoding = 'lossless';
        syncSettings(); rows(); return;
    }
    if (button.dataset.level || button.dataset.budget) {
        if (busy || importing || exporting) return;
        if (button.dataset.level) settings.level = Number(button.dataset.level);
        if (button.dataset.budget) settings.budget = Number(button.dataset.budget);
        syncSettings(); rows(); return;
    }
    switch (button.dataset.action) {
        case 'settings': toggleSettings(!settingsOpen); break;
        case 'close-settings': toggleSettings(false); $('[data-action="settings"]').focus(); break;
        case 'reset-settings': settings = defaults(); syncSettings(); rows(); break;
        case 'files': $('#pngFiles').click(); break;
        case 'folder': $('#pngFolder').click(); break;
        case 'clear': queue.forEach(x => URL.revokeObjectURL(x.url)); queue = []; $('#pngImportReport').textContent = ''; $('#pngReport').hidden = true; rows(); break;
        case 'run': run(); break;
        case 'retry': run(true); break;
        case 'cancel': cancel(); break;
        case 'export': exportZip(); break;
        case 'connect': connect(); break;
        case 'clean-cache': service?.cleanCache().then(info => { if (page) { cacheInfo(info); showToast('已清理 ' + formatSize(info.removedBytes)); } }).catch(error => showToast(error.message, 'error')); break;
        case 'reprocess':
            if (queue.some(x => x.selected && successful(x) && !x.exported)) {
                const session = lifecycle, dialog = $('#imageConfirm');
                if (dialog.open) break;
                dialog.returnValue = ''; dialog.showModal();
                animate(dialog, [{ opacity: 0, transform: 'translateY(8px) scale(.98)' }, { opacity: 1, transform: 'none' }]);
                const accepted = await new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true }));
                if (!accepted || session !== lifecycle) break;
            }
            queue.filter(x => x.selected && successful(x)).forEach(x => { x.result = null; x.report = null; x.status = 'waiting'; x.exported = false; });
            rows(); $('[data-action="run"]').focus(); break;
    }
}

function toggleSettings(open) {
    settingsOpen = open;
    const panel = $('#pngSettings');
    panel.inert = !open;
    panel.setAttribute('aria-hidden', String(!open));
    // CSS 过渡从当前进度自然反向，无异步完成回调覆盖新状态。
    $('.png-workspace').classList.toggle('has-settings', open);
    $('[data-action="settings"]').setAttribute('aria-expanded', String(open));
    try { localStorage.setItem('png-settings-open', String(open)); } catch { /* 存储不可用时仅保留本次状态。 */ }
}

function cacheInfo(info) {
    if (!page || !info) return;
    $('#imageCacheInfo').textContent = '磁盘临时文件 ' + formatSize(info.bytes) + ' · 可清理 ' + formatSize(info.staleBytes);
}
// 只切换展示，不重建控件或改写参数；选择变化不会清空高级设置。
function syncRelevantSettings() {
    const convert = settings.operation === 'convert';
    const selected = queue.filter(item => item.selected);
    const formats = convert ? [settings.target] : selected.map(item => item.format);
    const unknown = !convert && !formats.length;
    const pngOnly = !unknown && formats.every(format => format === 'png');
    const jpegOnly = !unknown && formats.every(format => format === 'jpeg');
    const hasJpeg = unknown || formats.includes('jpeg');
    const fixed = pngOnly || (convert && jpegOnly);
    $('#imageEncodingChoices').hidden = fixed;
    $('#imageEncodingState').hidden = !fixed;
    $('#imageEncodingState').textContent = pngOnly ? 'PNG · 无损编码' : 'JPEG · 有损编码';
    $('#imageQualityGroup').hidden = !((settings.encoding === 'lossy' && !pngOnly) || (settings.resize && hasJpeg));
    $('#imageJpegResizeNote').hidden = !settings.resize || !hasJpeg;
    $('#imageOptimizationGroup').hidden = jpegOnly;
    $('#imageFineLevel').hidden = jpegOnly;
    $('#imagePngAdvanced').hidden = !unknown && !formats.includes('png');
}
function syncSettings() {
    const convert = settings.operation === 'convert';
    const visibleBefore = new Map(['imageTargetGroup','imageQualityGroup','imageBackgroundGroup','imageAckGroup','imageResizeFields'].map(id => [id, !$('#' + id).hidden]));
    $('#imageTargetGroup').hidden = !convert;
    $('#imageQualityGroup').hidden = settings.encoding !== 'lossy' && !(settings.resize && (!convert || settings.target === 'jpeg'));
    $('#imageQualityLabel').textContent = settings.resize && settings.encoding === 'lossless' ? 'JPEG 缩放质量' : '质量';
    $('#imageJpegResizeNote').hidden = !settings.resize;
    $('#imageQuality').value = settings.quality;
    $('#imageQualityValue').textContent = settings.quality;
    $('#imageBackgroundGroup').hidden = !(convert && settings.target === 'jpeg');
    $('#imageBackground').value = settings.background;
    $('#imageColorPreview').style.background = settings.background;
    $('#imageBackground').setAttribute('aria-invalid', 'false');
    page.querySelectorAll('[data-background]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.background === settings.background.toLowerCase())));
    $('#imageAckGroup').hidden = !needsAck();
    $('#imageAck').checked = settings.ack;
    page.querySelectorAll('[data-operation],[data-target],[data-encoding]').forEach(button => {
        const key = ['operation','target','encoding'].find(key => button.dataset[key]);
        const active = settings[key] === button.dataset[key];
        button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active));
        button.disabled = convert && key === 'encoding' && ((settings.target === 'jpeg' && button.dataset[key] === 'lossless') || (settings.target === 'png' && button.dataset[key] === 'lossy'));
    });

    $('#pngSettingLabel').textContent = (convert ? '转换为 ' + settings.target.toUpperCase() : '原格式处理') + ' · ' + (settings.resize ? '调整尺寸' : settings.encoding === 'lossless' ? '无损' : '有损');
    $('#imageResize').checked = settings.resize;
    $('#imageResize').setAttribute('aria-expanded', String(settings.resize));
    $('#imageResizeFields').hidden = !settings.resize;
    $('#imageDimensionsGroup').hidden = settings.resizeMode !== 'dimensions';
    $('#imagePercentGroup').hidden = settings.resizeMode !== 'percent';
    $('#imageLongestGroup').hidden = settings.resizeMode !== 'longest';
    $('#imageOnlyShrink').checked = settings.onlyShrink;
    const lock = $('[data-action="ratio-lock"]');
    lock.setAttribute('aria-pressed', String(settings.lockRatio));
    lock.textContent = settings.lockRatio ? '锁定' : '解锁';
    lock.title = settings.lockRatio ? '比例已锁定，点击解锁' : '比例已解锁，可能拉伸，点击锁定';
    page.querySelectorAll('[data-resize-mode]').forEach(button => {
        const active = button.dataset.resizeMode === settings.resizeMode;
        button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active));
    });
    page.querySelectorAll('[data-percent]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.percent === String(settings.percent))));
    page.querySelectorAll('[data-resize-value]').forEach(input => { if (document.activeElement !== input) input.value = settings[input.dataset.resizeValue]; });
    $('#imageResizeHint').textContent = settings.resizeMode === 'dimensions'
        ? settings.lockRatio ? '留空一边自动计算；两边填写时等比放入。' : '可能拉伸；仅缩小时，宽高分别不超过原图。'
        : settings.resizeMode === 'percent' ? '逐图缩放，取整后至少 1 像素。' : '逐图等比缩放，兼容横竖图片。';
    updateResizeValidation();
    $('#pngLevel').value = settings.level;
    $('#pngLevelValue').textContent = settings.level;
    $('#pngThreads').value = settings.threads;
    $('#pngThreadsValue').textContent = settings.threads;
    $('#imageCustomLevel').hidden = [1,2,4,6].includes(settings.level);
    $('#imageCustomLevel').textContent = '自定义 ' + settings.level;
    page.querySelectorAll('[data-level],[data-budget]').forEach(button => {
        const active = button.dataset.level ? Number(button.dataset.level) === settings.level : Number(button.dataset.budget) === settings.budget;
        button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active));
    });
    syncRelevantSettings();
    visibleBefore.forEach((wasVisible, id) => { const element = $('#' + id); if (!wasVisible && !element.hidden) animate(element, [{ opacity: 0, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'none' }]); });
    refreshControls();
}

function updateResizeValidation() {
    const error = resizeError();
    $('#imageResizeError').textContent = error;
    $('#imageResizeError').hidden = !error;
    page.querySelectorAll('[data-resize-value]').forEach(input => input.setAttribute('aria-invalid', String(!!error && !!input.closest('#imageResizeFields') && !input.closest('[hidden]'))));
}

function refreshControls() {
    page.querySelectorAll('input[type=range]').forEach(input => input.style.setProperty('--range-fill', ((Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100) + '%'));
    page.querySelectorAll('.png-presets').forEach(group => {
        const buttons = [...group.querySelectorAll('button')], index = buttons.findIndex(button => button.classList.contains('is-active'));
        group.style.setProperty('--segments', buttons.length);
        group.style.setProperty('--selected', Math.max(0, index));
        group.classList.toggle('has-selection', index >= 0);
    });
}
export function mount(element) {
    lifecycle++; page = element; queue = []; service = null; busy = false; importing = false; exporting = false; settings = defaults(); started = 0; elapsed = 0;
    page.addEventListener('click', click);
    page.onchange = event => {
        if (event.target.id === 'pngFiles' || event.target.id === 'pngFolder') addFiles(event.target.files);
        else if (event.target.id === 'imageResize' || event.target.id === 'imageOnlyShrink') {
            if (busy || importing || exporting) return;
            settings[event.target.id === 'imageResize' ? 'resize' : 'onlyShrink'] = event.target.checked;
            settings.ack = false; syncSettings(); rows();
        }
        else if (event.target.id === 'imageAck') { settings.ack = event.target.checked; summary(); }
        else if (event.target.id === 'pngAll') { queue.forEach(x => x.selected = event.target.checked); rows(); }
        else if (event.target.dataset.select) { queue.find(x => x.id === Number(event.target.dataset.select)).selected = event.target.checked; summary(); const all = $('#pngAll'); all.checked = queue.every(x=>x.selected); all.indeterminate = queue.some(x=>x.selected)&&!all.checked; }
    };
    $('#pngDrop').ondragover = event => { event.preventDefault(); $('#pngDrop')?.classList.add('is-over'); };
    $('#pngDrop').ondragleave = () => $('#pngDrop')?.classList.remove('is-over');
    $('#pngDrop').ondrop = event => { event.preventDefault(); $('#pngDrop')?.classList.remove('is-over'); addFiles(event.dataTransfer.files); };
    try { settingsOpen = localStorage.getItem('png-settings-open') === 'true'; } catch { settingsOpen = false; }
    toggleSettings(settingsOpen);
    syncSettings();
    page.oninput = event => {
        if (busy || importing || exporting) return;
        if (event.target.dataset.resizeValue) {
            settings[event.target.dataset.resizeValue] = event.target.validity.badInput ? 'invalid' : event.target.value;
            updateResizeValidation(); rows(); return;
        }
        if (event.target.id === 'pngLevel') settings.level = Number(event.target.value);
        else if (event.target.id === 'pngThreads') settings.threads = Number(event.target.value);
        else if (event.target.id === 'imageQuality') settings.quality = Number(event.target.value);
        else if (event.target.id === 'imageBackground') {
            if (!/^#[0-9a-f]{6}$/i.test(event.target.value)) { event.target.setAttribute('aria-invalid', 'true'); summary(); return; }
            settings.background = event.target.value; rows();
        }
        else return;
        syncSettings();
        rows();
    };
    page.onkeydown = event => {
        if (event.key === 'Escape' && settingsOpen && !$('#imageConfirm').open) { toggleSettings(false); $('[data-action="settings"]').focus(); }
    };
    rows(); connect();
    window.addEventListener('beforeunload', cancel);
}

export function unmount() {
    clearTimeout(noticeTimer); motions.forEach(motion => motion.cancel()); motions.clear();
    if ($('#imageConfirm')?.open) $('#imageConfirm').close('cancel');
    service?.cancel(importJob); importController?.abort(); importJob = null; importController = null;
    cancel(); lifecycle++;
    window.removeEventListener('beforeunload', cancel);
    page?.removeEventListener('click', click);
    if (page) { page.onchange = null; page.oninput = null; page.onkeydown = null; }
    queue.forEach(x => URL.revokeObjectURL(x.url));
    queue = []; page = null; service = null; controller = null; job = null;
}

