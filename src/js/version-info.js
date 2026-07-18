const DEFAULT_VERSION = '2.4.1';

/**
 * 从页面 meta 标签读取应用版本号。
 * @returns {string}
 */
function getVersion() {
    try {
        const meta = document.querySelector('meta[name="version"]');
        return meta?.content?.trim() || DEFAULT_VERSION;
    } catch (e) {
        return DEFAULT_VERSION;
    }
}

/**
 * 渲染版本号 HTML 片段。
 * @param {Object} [options={}]
 * @param {string} [options.tag='div'] 根元素标签名
 * @param {string} [options.className='app-version-info'] 根元素类名
 * @param {string} [options.label='版本'] 标签文本
 * @returns {string}
 */
function renderVersionInfo(options = {}) {
    const { tag = 'div', className = 'app-version-info', label = '版本' } = options;
    const labelHtml = label ? `<span class="${className}-label">${label}</span>` : '';
    return `
        <${tag} class="${className}" data-version-display>
            ${labelHtml}
            v${getVersion()}
        </${tag}>
    `;
}

/**
 * 挂载后刷新版本号文本。
 * @param {HTMLElement} containerEl 包含 [data-version-display] 的容器
 */
function mountVersionInfo(containerEl) {
    if (!containerEl) return;
    const el = containerEl.querySelector('[data-version-display]');
    if (el) {
        const label = el.querySelector(':scope > span');
        const labelText = label ? `${label.textContent} ` : '';
        el.textContent = `${labelText}v${getVersion()}`;
    }
}

export { getVersion, renderVersionInfo, mountVersionInfo };
