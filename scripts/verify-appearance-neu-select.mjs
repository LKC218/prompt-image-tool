import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const APP = process.env.PC_URL || 'http://127.0.0.1:5173/?ui=pc';
const OUT = path.resolve('output/playwright/appearance-neu-select');

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', err => console.log('PAGEERROR', err.message));

function hasNeuShadow(shadow) {
    if (!shadow || shadow === 'none') return false;
    // 轻拟态：至少双向阴影（正/负偏移）或 inset
    const hasInset = shadow.includes('inset');
    const pos = /(?:^|,)\s*-?\d/.test(shadow) || /\d+px\s+\d+px/.test(shadow);
    const neg = shadow.includes('-') && /\d+px/.test(shadow);
    return hasInset || (pos && (neg || shadow.split(',').length >= 2));
}

async function dismissOverlays() {
    await page.evaluate(() => {
        document.querySelectorAll('.pc-modal-overlay, #pcModalOverlay, .pc-picker-overlay').forEach((el) => {
            el.classList.remove('pc-modal-active', 'pc-picker-show');
            el.hidden = true;
            el.style.pointerEvents = 'none';
            el.style.opacity = '0';
        });
    });
}

await page.goto(APP, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
await dismissOverlays();

// 进入设置页
const settingsNav = page.locator('.pc-sidebar-settings-item, [data-nav="/settings"]').first();
await settingsNav.waitFor({ state: 'visible', timeout: 8000 });
await dismissOverlays();
await settingsNav.click({ force: true });
await page.waitForTimeout(1200);
await dismissOverlays();

// 若路由未切换，用 DOM click 兜底
const landed = await page.evaluate(() => !!document.querySelector('#pcAppearancePicker'));
if (!landed) {
    await page.evaluate(() => {
        document.querySelector('.pc-sidebar-settings-item, [data-nav="/settings"]')?.click();
    });
    await page.waitForTimeout(1500);
    await dismissOverlays();
}

const root = page.locator('#pcAppearancePicker');
await root.waitFor({ state: 'visible', timeout: 8000 });

// 1) 闭合态
await page.locator('.pc-settings-appearance').screenshot({ path: `${OUT}/01-closed-light.png` });
await page.screenshot({ path: `${OUT}/01-page-light-closed.png`, fullPage: true });

const closedMeta = await page.evaluate(() => {
    const root = document.querySelector('#pcAppearancePicker');
    const trigger = root?.querySelector('.pc-theme-appearance-trigger');
    const menu = root?.querySelector('.pc-theme-appearance-menu');
    if (!root || !trigger) return null;
    const cs = getComputedStyle(trigger);
    const rootCs = getComputedStyle(root);
    return {
        isNativeSelect: !!document.querySelector('select.pc-theme-appearance-select'),
        hasTrigger: !!trigger,
        hasMenu: !!menu,
        menuHidden: menu?.hidden === true,
        ariaHaspopup: trigger.getAttribute('aria-haspopup'),
        triggerBg: cs.backgroundColor,
        triggerShadow: cs.boxShadow,
        triggerBorder: cs.border,
        triggerRadius: cs.borderRadius,
        optionCount: root.querySelectorAll('[role="option"]').length,
        selectedValue: root.dataset.value,
        openClass: root.classList.contains('pc-theme-appearance-open'),
        zIndex: rootCs.zIndex,
    };
});
console.log('CLOSED_META', JSON.stringify(closedMeta, null, 2));

// 2) 展开态
await page.locator('.pc-theme-appearance-trigger').click();
await page.waitForTimeout(350);
await page.locator('.pc-settings-appearance').screenshot({ path: `${OUT}/02-open-light.png` });
await page.locator('.pc-theme-appearance-menu').screenshot({ path: `${OUT}/02-menu-light.png` });
await page.screenshot({ path: `${OUT}/02-page-light-open.png`, fullPage: true });
const triggerBox = await page.locator('.pc-theme-appearance-trigger').boundingBox();
if (triggerBox) {
    await page.screenshot({
        path: `${OUT}/02-region-light-open.png`,
        clip: {
            x: Math.max(0, triggerBox.x - 24),
            y: Math.max(0, triggerBox.y - 16),
            width: Math.min(520, triggerBox.width + 280),
            height: 340,
        },
    });
}

const openMeta = await page.evaluate(() => {
    const root = document.querySelector('#pcAppearancePicker');
    const menu = root?.querySelector('.pc-theme-appearance-menu');
    const options = [...(root?.querySelectorAll('[role="option"]') || [])];
    const selected = root?.querySelector('[aria-selected="true"]');
    const first = options[0];
    const menuCs = menu ? getComputedStyle(menu) : null;
    const optCs = first ? getComputedStyle(first) : null;
    const menuRect = menu?.getBoundingClientRect();
    const list = document.querySelector('.pc-settings-list');
    const listRect = list?.getBoundingClientRect();
    // 裁切检测：菜单底边若被列表底边硬切，说明 overflow 仍在裁切
    const clippedByList = !!(menuRect && listRect && menuRect.bottom > listRect.bottom + 4
        && menu.scrollHeight > menu.clientHeight + 2);
    const optionsFullyVisible = options.every((o) => {
        const r = o.getBoundingClientRect();
        return r.height > 8 && r.top >= 0 && r.bottom <= window.innerHeight + 1;
    });
    return {
        openClass: root?.classList.contains('pc-theme-appearance-open'),
        menuHidden: menu?.hidden === true,
        menuShadow: menuCs?.boxShadow,
        menuBg: menuCs?.backgroundColor,
        menuRadius: menuCs?.borderRadius,
        menuVisible: menu ? menu.getBoundingClientRect().height > 40 : false,
        menuTopGap: menu && root ? (menu.getBoundingClientRect().top - root.getBoundingClientRect().bottom) : null,
        menuHeight: menuRect?.height,
        menuScrollH: menu?.scrollHeight,
        menuClientH: menu?.clientHeight,
        clippedByList,
        listOverflow: list ? getComputedStyle(list).overflow : null,
        optionsFullyVisible,
        optionCount: options.length,
        optionLabels: options.map(o => o.textContent.trim()),
        selectedText: selected?.textContent.trim(),
        selectedHasCheck: !!selected?.querySelector('.pc-theme-appearance-option-check'),
        optionMinHeight: optCs?.minHeight,
        triggerAriaExpanded: root?.querySelector('.pc-theme-appearance-trigger')?.getAttribute('aria-expanded'),
    };
});
console.log('OPEN_META', JSON.stringify(openMeta, null, 2));

// 3) 悬停选项
const darkOption = page.locator('[data-value="dark"]');
await darkOption.hover();
await page.waitForTimeout(200);
await page.locator('.pc-theme-appearance-menu').screenshot({ path: `${OUT}/03-hover-dark-option.png` });

const hoverMeta = await page.evaluate(() => {
    const opt = document.querySelector('[data-value="dark"]');
    const cs = getComputedStyle(opt);
    return {
        bg: cs.backgroundColor,
        shadow: cs.boxShadow,
        color: cs.color,
        transform: cs.transform,
    };
});
console.log('HOVER_META', JSON.stringify(hoverMeta, null, 2));

// 4) 选择深色
await darkOption.click();
await page.waitForTimeout(500);
await page.locator('.pc-settings-appearance').screenshot({ path: `${OUT}/04-after-select-dark.png` });

const afterSelect = await page.evaluate(() => {
    const root = document.querySelector('#pcAppearancePicker');
    return {
        value: root?.dataset.value,
        label: root?.querySelector('.pc-theme-appearance-value')?.textContent.trim(),
        menuHidden: root?.querySelector('.pc-theme-appearance-menu')?.hidden,
        appearance: document.documentElement.dataset.appearance,
        pref: localStorage.getItem('appearance-preference'),
        selectedDark: root?.querySelector('[data-value="dark"]')?.getAttribute('aria-selected'),
    };
});
console.log('AFTER_SELECT', JSON.stringify(afterSelect, null, 2));

// 5) 深色模式展开态
await page.locator('.pc-theme-appearance-trigger').click();
await page.waitForTimeout(350);
await page.locator('.pc-settings-appearance').screenshot({ path: `${OUT}/05-open-dark.png` });
await page.screenshot({ path: `${OUT}/05-page-dark-open.png`, fullPage: true });

const darkOpenMeta = await page.evaluate(() => {
    const root = document.querySelector('#pcAppearancePicker');
    const menu = root?.querySelector('.pc-theme-appearance-menu');
    const trigger = root?.querySelector('.pc-theme-appearance-trigger');
    const selected = root?.querySelector('[aria-selected="true"]');
    const menuCs = menu ? getComputedStyle(menu) : null;
    const triggerCs = trigger ? getComputedStyle(trigger) : null;
    const selectedCs = selected ? getComputedStyle(selected) : null;
    return {
        appearance: document.documentElement.dataset.appearance,
        menuShadow: menuCs?.boxShadow,
        menuBg: menuCs?.backgroundColor,
        triggerShadow: triggerCs?.boxShadow,
        triggerBg: triggerCs?.backgroundColor,
        selectedBg: selectedCs?.backgroundColor,
        selectedShadow: selectedCs?.boxShadow,
        menuVisible: menu ? menu.getBoundingClientRect().height > 40 : false,
    };
});
console.log('DARK_OPEN_META', JSON.stringify(darkOpenMeta, null, 2));

// 6) 键盘导航
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
await page.locator('.pc-theme-appearance-trigger').focus();
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(200);
const keyMeta = await page.evaluate(() => {
    const root = document.querySelector('#pcAppearancePicker');
    return {
        openAfterArrow: root?.classList.contains('pc-theme-appearance-open'),
        focused: document.activeElement?.getAttribute('data-value') || document.activeElement?.className,
    };
});
console.log('KEY_META', JSON.stringify(keyMeta, null, 2));
await page.keyboard.press('Escape');
await page.waitForTimeout(150);

// 7) 窄容器
await page.setViewportSize({ width: 900, height: 800 });
await page.waitForTimeout(300);
await page.locator('.pc-theme-appearance-trigger').click();
await page.waitForTimeout(300);
await page.locator('.pc-settings-appearance').screenshot({ path: `${OUT}/06-narrow-open.png` });
const narrowMeta = await page.evaluate(() => {
    const root = document.querySelector('#pcAppearancePicker');
    const menu = root?.querySelector('.pc-theme-appearance-menu');
    return {
        rootWidth: root?.getBoundingClientRect().width,
        menuWidth: menu?.getBoundingClientRect().width,
        menuOverflowRight: menu ? (menu.getBoundingClientRect().right > window.innerWidth + 2) : false,
        menuOverflowLeft: menu ? (menu.getBoundingClientRect().left < -2) : false,
    };
});
console.log('NARROW_META', JSON.stringify(narrowMeta, null, 2));

const neuOkClosed = closedMeta && !closedMeta.isNativeSelect && hasNeuShadow(closedMeta.triggerShadow) && closedMeta.menuHidden && closedMeta.optionCount === 4;
const neuOkOpen = openMeta && openMeta.openClass && openMeta.menuVisible && openMeta.menuHidden === false
    && hasNeuShadow(openMeta.menuShadow) && openMeta.triggerAriaExpanded === 'true'
    && openMeta.selectedHasCheck && openMeta.optionLabels.join(',').includes('浅色')
    && openMeta.clippedByList === false && openMeta.optionsFullyVisible === true
    && openMeta.listOverflow !== 'hidden' && openMeta.optionCount === 4;
const selectOk = afterSelect && afterSelect.value === 'dark' && afterSelect.label === '深色'
    && afterSelect.menuHidden === true && afterSelect.appearance === 'dark' && afterSelect.pref === 'dark';
const darkOk = darkOpenMeta && darkOpenMeta.menuVisible && hasNeuShadow(darkOpenMeta.menuShadow);
const keyOk = keyMeta && keyMeta.openAfterArrow === true;
const narrowOk = narrowMeta && narrowMeta.menuOverflowRight === false && narrowMeta.menuOverflowLeft === false
    && narrowMeta.menuWidth > 100 && Math.abs(narrowMeta.menuWidth - narrowMeta.rootWidth) < 8;

const checks = {
    neuOkClosed,
    neuOkOpen,
    selectOk,
    darkOk,
    keyOk,
    narrowOk,
    hoverNeu: hoverMeta && (hoverMeta.bg !== 'rgba(0, 0, 0, 0)' || hasNeuShadow(hoverMeta.shadow)),
};
console.log('CHECKS', JSON.stringify(checks, null, 2));

const pass = Object.values(checks).every(Boolean);
console.log(pass ? 'VISUAL_PASS' : 'VISUAL_FAIL');
await browser.close();
process.exit(pass ? 0 : 1);
