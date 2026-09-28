import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const APP = process.env.PC_URL || 'http://127.0.0.1:5173/?ui=pc';
const OUT = path.resolve('output/playwright/global-neu-sweep');
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', err => console.log('PAGEERROR', err.message));

function hasNeuShadow(shadow) {
    if (!shadow || shadow === 'none') return false;
    const hasInset = shadow.includes('inset');
    const segs = shadow.split(',').filter(s => s.trim() && s.trim() !== 'none');
    return hasInset || segs.length >= 2;
}

function isLegacySingleShadow(shadow) {
    if (!shadow || shadow === 'none') return false;
    const segs = shadow.split(',').filter(s => s.trim() && s.trim() !== 'none');
    return segs.length === 1 && !shadow.includes('inset');
}

function hasOuterGlow(shadow) {
    if (!shadow || shadow === 'none') return false;
    // 外白光：非 inset 且带负偏移的高光段（如 -8px -8px 18px rgba(255,255,255,...)）
    return /(?:^|,)\s*-+\d+px\s+-+\d+px/.test(shadow);
}

async function dismissOverlays() {
    await page.evaluate(() => {
        document.querySelectorAll('.pc-modal-overlay, #pcModalOverlay, .pc-picker-overlay, .pc-confirm-overlay, .pc-folder-dialog-overlay')
            .forEach((el) => {
                el.classList.remove('pc-modal-active', 'pc-picker-show', 'pc-confirm-show', 'pc-folder-dialog-show');
                el.hidden = true;
                el.style.pointerEvents = 'none';
                el.style.opacity = '0';
            });
    });
}

async function probe(selectors) {
    return page.evaluate((sels) => {
        const out = {};
        for (const [key, sel] of Object.entries(sels)) {
            const el = document.querySelector(sel);
            if (!el) {
                out[key] = { missing: true, sel };
                continue;
            }
            const cs = getComputedStyle(el);
            out[key] = {
                sel,
                shadow: cs.boxShadow,
                border: cs.border,
                bg: cs.backgroundColor,
                radius: cs.borderRadius,
            };
        }
        return out;
    }, selectors);
}

function judge(label, meta, { requireNeu = true, allowNone = false, forbidGlow = false } = {}) {
    if (!meta || meta.missing) {
        return { label, ok: false, reason: 'missing' };
    }
    if (meta.shadow === 'none' || meta.shadow === '') {
        return allowNone
            ? { label, ok: true, shadow: meta.shadow }
            : { label, ok: false, reason: 'no-shadow' };
    }
    if (forbidGlow && hasOuterGlow(meta.shadow)) {
        return { label, ok: false, reason: `outer-glow:${meta.shadow}` };
    }
    if (requireNeu && isLegacySingleShadow(meta.shadow)) {
        return { label, ok: false, reason: `legacy-single:${meta.shadow}` };
    }
    if (requireNeu && !hasNeuShadow(meta.shadow)) {
        return { label, ok: false, reason: `not-neu:${meta.shadow}` };
    }
    return { label, ok: true, shadow: meta.shadow };
}

const HOME_TARGETS = {
    statCard: '.pc-stat-card',
    recentItem: '.pc-recent-item',
    categoryCard: '.pc-home-category-card, .pc-category-card',
    quickCreate: '.pc-quick-create-card',
    starBtn: '.pc-star-btn',
    moreBtn: '.pc-more-btn',
    searchOuter: '.pc-home-search-bar__outer, .pc-home-search-bar',
};

const SETTINGS_TARGETS = {
    panel: '.pc-settings-panel',
    actionCard: '.pc-settings-action-card',
    storageTile: '.pc-settings-storage-tile',
    appearanceTrigger: '.pc-theme-appearance-trigger',
};

async function setAppearance(mode) {
    await page.evaluate((m) => {
        document.documentElement.setAttribute('data-appearance', m);
        try {
            localStorage.setItem('appearance-preference', m);
        } catch { /* ignore */ }
    }, mode);
    await page.waitForTimeout(300);
}

async function goHome() {
    await page.evaluate(() => {
        document.querySelector('[data-nav="/"]')?.click();
    });
    await page.waitForTimeout(1200);
    await dismissOverlays();
}

async function goSettings() {
    await page.evaluate(() => {
        document.querySelector('[data-nav="/settings"]')?.click();
    });
    await page.waitForTimeout(1500);
    await dismissOverlays();
}

async function goLibrary() {
    await page.evaluate(() => {
        document.querySelector('[data-nav="/library"]')?.click();
    });
    await page.waitForTimeout(1500);
    await dismissOverlays();
}

async function runPass(mode, tag) {
    await setAppearance(mode);
    await goHome();

    // 确认首页已就绪
    await page.waitForSelector('.pc-stat-card, .pc-recent-item', { timeout: 8000 }).catch(() => {});

    await page.screenshot({ path: `${OUT}/${tag}-01-home.png`, fullPage: true });
    const homeMeta = await probe(HOME_TARGETS);
    const homeResults = Object.entries(homeMeta).map(([k, m]) => {
        const allowNone = (k === 'starBtn' || k === 'moreBtn' || k === 'searchOuter');
        return judge(`${tag}.${k}`, m, { allowNone });
    });

    // Toast 注入到 .pc-app 内，才能吃到 --pc-neu-* / --pc-control-*
    await page.evaluate(() => {
        const host = document.querySelector('.pc-app') || document.body;
        let bar = host.querySelector('.pc-toast-container');
        if (!bar) {
            bar = document.createElement('div');
            bar.className = 'pc-toast-container';
            host.appendChild(bar);
        }
        const toast = document.createElement('div');
        toast.className = 'pc-toast pc-toast-success pc-toast-show';
        toast.dataset.neuSweep = '1';
        toast.textContent = '拟态扫尾视觉验证';
        bar.appendChild(toast);
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${OUT}/${tag}-02-toast.png` });
    const toastMeta = await probe({ toast: '[data-neu-sweep="1"]' });
    const toastResult = judge(`${tag}.toast`, toastMeta.toast, { forbidGlow: true });
    await page.evaluate(() => {
        document.querySelectorAll('[data-neu-sweep="1"]').forEach(el => el.remove());
    });

    await goSettings();
    await page.waitForSelector('.pc-settings-page, .pc-settings-panel', { timeout: 8000 }).catch(() => {});
    await page.screenshot({ path: `${OUT}/${tag}-03-settings.png`, fullPage: true });
    const settingsMeta = await probe(SETTINGS_TARGETS);
    const settingsResults = Object.entries(settingsMeta).map(([k, m]) => judge(`${tag}.settings.${k}`, m));

    await goLibrary();
    await page.waitForSelector('.pc-library-page, .pc-library-search', { timeout: 8000 }).catch(() => {});
    await page.screenshot({ path: `${OUT}/${tag}-04-library.png`, fullPage: true });
    const libMeta = await probe({
        searchShell: '.pc-library-search',
        searchOuter: '.pc-library-search__outer',
        filterBtn: '.pc-library-filter-btn',
    });
    const libResults = Object.entries(libMeta).map(([k, m]) => judge(`${tag}.library.${k}`, m, { allowNone: k === 'filterBtn' }));

    // 弹窗壳同样注入 .pc-app 内
    const modalMeta = await page.evaluate(() => {
        const host = document.querySelector('.pc-app') || document.body;
        let modal = host.querySelector('.pc-modal');
        if (!modal) {
            const overlay = document.createElement('div');
            overlay.className = 'pc-modal-overlay pc-modal-active';
            overlay.dataset.neuSweepOverlay = '1';
            modal = document.createElement('div');
            modal.className = 'pc-modal';
            modal.dataset.neuSweepModal = '1';
            modal.innerHTML = '<h3>拟态扫尾</h3><p class="pc-modal-desc">视觉验证弹窗壳</p>';
            overlay.appendChild(modal);
            host.appendChild(overlay);
        }
        const cs = getComputedStyle(modal);
        return { shadow: cs.boxShadow, bg: cs.backgroundColor, radius: cs.borderRadius };
    });
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${OUT}/${tag}-05-modal.png` });
    const modalResult = judge(`${tag}.modal`, modalMeta, { forbidGlow: true });
    await page.evaluate(() => {
        document.querySelectorAll('[data-neu-sweep-overlay="1"]').forEach(el => el.remove());
    });

    // 确认弹窗壳（用户截图问题点）
    const confirmMeta = await page.evaluate(() => {
        const host = document.querySelector('.pc-app') || document.body;
        let dialog = host.querySelector('.pc-confirm-dialog');
        if (!dialog) {
            const overlay = document.createElement('div');
            overlay.className = 'pc-confirm-overlay pc-confirm-show';
            overlay.dataset.neuSweepConfirm = '1';
            dialog = document.createElement('div');
            dialog.className = 'pc-confirm-dialog';
            dialog.innerHTML = '<div class="pc-confirm-text">进入「俄罗斯方块」？</div>';
            overlay.appendChild(dialog);
            host.appendChild(overlay);
        }
        const cs = getComputedStyle(dialog);
        return { shadow: cs.boxShadow, bg: cs.backgroundColor, radius: cs.borderRadius };
    });
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${OUT}/${tag}-06-confirm.png` });
    const confirmResult = judge(`${tag}.confirm`, confirmMeta, { forbidGlow: true });
    await page.evaluate(() => {
        document.querySelectorAll('[data-neu-sweep-confirm="1"]').forEach(el => el.remove());
    });

    return [...homeResults, toastResult, ...settingsResults, ...libResults, modalResult, confirmResult];
}

await page.goto(APP, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.pc-app, .pc-stat-card, .pc-recent-item', { timeout: 15000 });
await page.waitForTimeout(1500);
await dismissOverlays();

const lightResults = await runPass('light', 'light');
const darkResults = await runPass('dark', 'dark');
const all = [...lightResults, ...darkResults];
const failed = all.filter(r => !r.ok);

console.log('NEU_SWEEP_SUMMARY', JSON.stringify({
    total: all.length,
    pass: all.length - failed.length,
    fail: failed.length,
    failed,
}, null, 2));

const pass = failed.length === 0;
console.log(pass ? 'VISUAL_PASS' : 'VISUAL_FAIL');

await browser.close();
process.exit(pass ? 0 : 1);
