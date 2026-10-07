// 与 python/image_resize.py 保持同一规则，由共用样例验证。
export const RESIZE_LIMITS = { edge: 16384, pixels: 16_000_000, percent: 1000 };
export const resizeDefaults = () => ({ resize: false, resizeMode: 'dimensions', width: '', height: '', percent: '50', longest: '1920', lockRatio: true, onlyShrink: true });

export function normalizeResize(values = {}) {
    const flag = (key, fallback) => {
        const value = values[key] ?? fallback;
        if (![true, false, 'true', 'false'].includes(value)) throw new Error('尺寸开关参数无效');
        return value === true || value === 'true';
    };
    const resize = flag('resize', false);
    if (!resize) return { resize: false };
    const resizeMode = values.resizeMode ?? 'dimensions';
    if (!['dimensions', 'percent', 'longest'].includes(resizeMode)) throw new Error('尺寸模式无效');
    const result = { resize, resizeMode, lockRatio: flag('lockRatio', true), onlyShrink: flag('onlyShrink', true) };
    const number = (key, label, maximum, optional = false, decimal = false) => {
        const value = String(values[key] ?? '');
        if (optional && value === '') return null;
        if (!(decimal ? /^\d+(\.\d{1,2})?$/ : /^\d+$/).test(value) || Number(value) <= 0 || Number(value) > maximum) {
            throw new Error(label + (decimal ? '须为 0.01–1000，最多两位小数' : '须为 1–16384 的整数'));
        }
        return Number(value);
    };
    if (resizeMode === 'dimensions') {
        result.width = number('width', '宽度', RESIZE_LIMITS.edge, true);
        result.height = number('height', '高度', RESIZE_LIMITS.edge, true);
        if (!result.width && !result.height) throw new Error('请至少填写宽度或高度');
        if (!result.lockRatio && (!result.width || !result.height)) throw new Error('解锁比例时须同时填写宽度和高度');
    } else if (resizeMode === 'percent') result.percent = number('percent', '百分比', RESIZE_LIMITS.percent, false, true);
    else result.longest = number('longest', '最长边', RESIZE_LIMITS.edge);
    return result;
}

export function calculateResize(width, height, values = {}) {
    if (![width, height].every(x => Number.isInteger(x) && x > 0) || width * height > RESIZE_LIMITS.pixels) throw new Error('输入图片不得超过 1600 万像素');
    const config = normalizeResize(values);
    if (!config.resize) return { width, height, changed: false };
    let w, h;
    if (config.resizeMode === 'dimensions' && !config.lockRatio) {
        w = config.onlyShrink ? Math.min(width, config.width) : config.width;
        h = config.onlyShrink ? Math.min(height, config.height) : config.height;
    } else {
        let scale = config.resizeMode === 'percent' ? config.percent / 100
            : config.resizeMode === 'longest' ? config.longest / Math.max(width, height)
            : Math.min(config.width ? config.width / width : Infinity, config.height ? config.height / height : Infinity);
        if (config.onlyShrink) scale = Math.min(scale, 1);
        w = Math.max(1, Math.floor(width * scale + 0.5));
        h = Math.max(1, Math.floor(height * scale + 0.5));
    }
    if (w > RESIZE_LIMITS.edge || h > RESIZE_LIMITS.edge || w * h > RESIZE_LIMITS.pixels) throw new Error('输出不得超过 16384 像素边长或 1600 万像素');
    return { width: w, height: h, changed: w !== width || h !== height };
}
