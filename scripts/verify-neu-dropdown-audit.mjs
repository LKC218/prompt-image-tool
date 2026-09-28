import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const APP = process.env.PC_URL || 'http://127.0.0.1:5173/?ui=pc';
const OUT = path.resolve('output/playwright/neu-dropdown-audit');
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const pageErrors = [];
page.on('pageerror', err => {
    pageErrors.push(err.message);
    console.log('PAGEERROR', err.message);
});

function hasNeuShadow(shadow) {
    if (!shadow || shadow === 'none') return false;
    return shadow.includes('inset') || shadow.split(',').length >= 2;
}

async function killBlockingOverlays() {
    await page.evaluate(() => {
        document.querySelectorAll('.pc-modal-overlay, #pcModalOverlay, .pc-picker-overlay').forEach((el) => {
            el.classList.remove('pc-modal-active', 'pc-picker-show');
            el.hidden = true;
            el.style.pointerEvents = 'none';
            el.style.opacity = '0';
            el.style.display = 'none';
        });
    });
}

async function gotoPath(selector, waitSelector) {
    await killBlockingOverlays();
    // 优先真实按钮 click；失败再 MouseEvent 派发
    const navInfo = await page.evaluate((sel) => {
        const nodes = [...document.querySelectorAll(sel)];
        return nodes.map(n => ({
            tag: n.tagName,
            cls: n.className,
            visible: !!(n.offsetWidth || n.offsetHeight || n.getClientRects().length),
            parent: n.parentElement?.className || '',
        }));
    }, selector);
    console.log('NAV_CANDIDATES', selector, JSON.stringify(navInfo));

    await page.evaluate((sel) => {
        const nodes = [...document.querySelectorAll(sel)];
        const el = nodes.find(n => n.offsetWidth || n.offsetHeight || n.getClientRects().length) || nodes[0];
        el?.click();
        if (!document.querySelector(sel)) return;
        // 若 click 未切换路由，再派发一次
        setTimeout(() => {}, 0);
        el?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    }, selector);
    await page.waitForTimeout(1800);
    await killBlockingOverlays();
    if (waitSelector) {
        try {
            await page.locator(waitSelector).first().waitFor({ state: 'visible', timeout: 8000 });
        } catch (err) {
            const dbg = await page.evaluate(() => ({
                bodySnippet: document.body.innerText.slice(0, 250),
                hasApp: !!document.querySelector('.pc-app, #pcApp'),
                hasPicker: !!document.querySelector('#pcAppearancePicker'),
                hasSettings: !!document.querySelector('.pc-settings-page'),
                activeNav: document.querySelector('.pc-nav-active')?.getAttribute?.('data-nav') ?? 'NO_ACTIVE',
                history: history.state,
            }));
            console.log('GOTO_FAIL', selector, waitSelector, JSON.stringify(dbg, null, 2));
            await page.screenshot({ path: `${OUT}/fail-goto.png`, fullPage: true });
            throw err;
        }
    }
}

function neuMeta(sel) {
    return page.evaluate((rootSel) => {
        const root = document.querySelector(rootSel);
        if (!root) return { missing: true };
        const trigger = root.querySelector('.pc-neu-select-trigger, .pc-theme-appearance-trigger');
        const menu = root.querySelector('.pc-neu-select-menu, .pc-theme-appearance-menu');
        const options = [...root.querySelectorAll('[role="option"]')];
        const menuCs = menu ? getComputedStyle(menu) : null;
        const triggerCs = trigger ? getComputedStyle(trigger) : null;
        const menuRect = menu?.getBoundingClientRect();
        return {
            isNativeSelect: !!root.querySelector(':scope > select') || root.tagName === 'SELECT',
            open: root.classList.contains('pc-neu-select-open') || root.classList.contains('pc-theme-appearance-open'),
            menuHidden: menu?.hidden === true,
            menuVisible: menuRect ? menuRect.height > 40 : false,
            menuShadow: menuCs?.boxShadow,
            menuBg: menuCs?.backgroundColor,
            triggerShadow: triggerCs?.boxShadow,
            triggerRadius: triggerCs?.borderRadius,
            optionCount: options.length,
            labels: options.map(o => o.textContent.trim().replace(/\s+/g, ' ')),
            selected: root.querySelector('[aria-selected="true"]')?.textContent?.trim() || null,
            value: root.dataset.value || null,
            clipped: menu ? menu.scrollHeight > menu.clientHeight + 2 : false,
            menuTopGap: menu && trigger
                ? Math.round(menu.getBoundingClientRect().top - trigger.getBoundingClientRect().bottom)
                : null,
        };
    }, sel);
}

const results = {};

// ========== 0. 加载应用壳 ==========
await page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.locator('[data-nav="/settings"]').first().waitFor({ state: 'attached', timeout: 15000 });
await page.waitForTimeout(800);
await killBlockingOverlays();

// ========== 1. 设置 · 外观模式 ==========
await gotoPath('[data-nav="/settings"]', '#pcAppearancePicker');
await page.locator('.pc-settings-appearance').screenshot({ path: `${OUT}/01-settings-closed.png` });
results.appearanceClosed = await neuMeta('#pcAppearancePicker');

await page.evaluate(() => document.querySelector('#pcAppearancePicker .pc-theme-appearance-trigger')?.click());
await page.waitForTimeout(300);
await page.locator('#pcAppearancePicker .pc-theme-appearance-menu').screenshot({ path: `${OUT}/02-settings-menu.png` });
await page.screenshot({
    path: `${OUT}/02-settings-open-region.png`,
    clip: await page.locator('#pcAppearancePicker').boundingBox().then(b => ({
        x: Math.max(0, b.x - 20), y: Math.max(0, b.y - 12),
        width: Math.min(420, b.width + 40), height: 320,
    })),
});
results.appearanceOpen = await neuMeta('#pcAppearancePicker');

// 选择深色并复位
await page.evaluate(() => document.querySelector('#pcAppearancePicker [data-value="dark"]')?.click());
await page.waitForTimeout(400);
results.appearanceAfterDark = await page.evaluate(() => ({
    value: document.querySelector('#pcAppearancePicker')?.dataset.value,
    appearance: document.documentElement.dataset.appearance,
}));
await page.evaluate(() => document.querySelector('#pcAppearancePicker .pc-theme-appearance-trigger')?.click());
await page.waitForTimeout(250);
await page.evaluate(() => document.querySelector('#pcAppearancePicker [data-value="light"]')?.click());
await page.waitForTimeout(350);
await page.locator('.pc-settings-appearance').screenshot({ path: `${OUT}/03-settings-restored-light.png` });

// ========== 2. 提示词库 · 每页数量 ==========
await gotoPath('[data-nav="/library"]', '#pcLibraryPageSize');
await page.locator('.pc-library-pagination').screenshot({ path: `${OUT}/04-page-size-closed.png` });
results.pageSizeClosed = await neuMeta('#pcLibraryPageSize');

await page.evaluate(() => document.querySelector('#pcLibraryPageSize .pc-neu-select-trigger')?.click());
await page.waitForTimeout(300);
const pageBox = await page.locator('#pcLibraryPageSize').boundingBox();
await page.screenshot({
    path: `${OUT}/05-page-size-open.png`,
    clip: {
        x: Math.max(0, pageBox.x - 16),
        y: Math.max(0, pageBox.y - 10),
        width: Math.min(360, pageBox.width + 220),
        height: 260,
    },
});
results.pageSizeOpen = await neuMeta('#pcLibraryPageSize');

await page.evaluate(() => document.querySelector('#pcLibraryPageSize [data-value="50"]')?.click());
await page.waitForTimeout(350);
results.pageSizeAfter = await page.evaluate(() => ({
    value: document.querySelector('#pcLibraryPageSize')?.dataset.value,
    label: document.querySelector('#pcLibraryPageSize .pc-neu-select-value')?.textContent?.trim(),
}));
await page.locator('.pc-library-pagination').screenshot({ path: `${OUT}/06-page-size-after-50.png` });

// ========== 3. 侧栏更多菜单 ==========
await killBlockingOverlays();
await page.evaluate(() => document.querySelector('[data-more-menu]')?.click());
await page.waitForTimeout(300);
await page.screenshot({
    path: `${OUT}/07-sidebar-more.png`,
    clip: { x: 0, y: 520, width: 280, height: 220 },
});
results.moreMenu = await page.evaluate(() => {
    const menu = document.querySelector('.pc-sidebar-more-menu');
    const cs = menu ? getComputedStyle(menu) : null;
    return {
        visible: menu && !menu.hidden && menu.getBoundingClientRect().height > 20,
        shadow: cs?.boxShadow,
        border: cs?.borderTopWidth,
        bg: cs?.backgroundColor,
        itemCount: menu?.querySelectorAll('.pc-sidebar-more-menu-item').length || 0,
    };
});
await page.keyboard.press('Escape');

// ========== 4. 分类合并弹窗下拉 ==========
await gotoPath('[data-nav="/category"]');
await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim().includes('合并分类'));
    btn?.click();
});
await page.waitForTimeout(500);
// 业务弹窗需恢复遮罩显示（此前 killBlockingOverlays 会强制 display:none）
await page.evaluate(() => {
    const overlay = document.querySelector('#pcModalOverlay');
    if (overlay && overlay.querySelector('#pcMergeSource')) {
        overlay.hidden = false;
        overlay.style.display = '';
        overlay.style.pointerEvents = '';
        overlay.style.opacity = '';
        overlay.classList.add('pc-modal-active');
    }
});
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/08-merge-modal.png` });

await page.evaluate(() => document.querySelector('#pcMergeSource .pc-neu-select-trigger')?.click());
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/09-merge-source-open.png` });
results.mergeSource = await neuMeta('#pcMergeSource');
results.mergeTargetExists = await page.evaluate(() => !!document.querySelector('#pcMergeTarget .pc-neu-select-trigger'));

// ========== 5. 分类选择列表（编辑器 folder picker） ==========
await killBlockingOverlays();
await page.evaluate(() => document.querySelector('[data-nav="/editor/"]')?.click());
await page.waitForTimeout(1200);
await killBlockingOverlays();
const folderSelect = page.locator('#pcEditorFolderSelect');
if (await folderSelect.count()) {
    await page.evaluate(() => document.querySelector('#pcEditorFolderSelect')?.click());
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/10-folder-picker.png` });
    results.pickerList = await page.evaluate(() => {
        const list = document.querySelector('.pc-picker-list');
        const item = document.querySelector('.pc-picker-list-item');
        const active = document.querySelector('.pc-picker-list-item.pc-picker-list-active');
        const listCs = list ? getComputedStyle(list) : null;
        const itemCs = item ? getComputedStyle(item) : null;
        const activeCs = active ? getComputedStyle(active) : null;
        return {
            listExists: !!list,
            listShadow: listCs?.boxShadow,
            listBorder: listCs?.borderTopWidth,
            itemCount: list?.querySelectorAll('.pc-picker-list-item').length || 0,
            itemShadow: itemCs?.boxShadow,
            activeShadow: activeCs?.boxShadow,
            activeIsInset: (activeCs?.boxShadow || '').includes('inset'),
        };
    });
} else {
    results.pickerList = { missing: true };
}

// ========== 汇总 ==========
console.log('RESULTS', JSON.stringify(results, null, 2));
console.log('PAGE_ERRORS', JSON.stringify(pageErrors));

const checks = {
    appearanceClosedNeu: results.appearanceClosed && !results.appearanceClosed.isNativeSelect
        && hasNeuShadow(results.appearanceClosed.triggerShadow)
        && results.appearanceClosed.menuHidden === true
        && results.appearanceClosed.optionCount === 4,
    appearanceOpenNeu: results.appearanceOpen && results.appearanceOpen.open === true
        && results.appearanceOpen.menuVisible === true
        && hasNeuShadow(results.appearanceOpen.menuShadow)
        && results.appearanceOpen.clipped === false
        && results.appearanceOpen.selected?.includes('浅'),
    appearanceSwitch: results.appearanceAfterDark?.value === 'dark'
        && results.appearanceAfterDark?.appearance === 'dark',
    pageSizeNeu: results.pageSizeClosed && !results.pageSizeClosed.isNativeSelect
        && results.pageSizeOpen?.open === true
        && results.pageSizeOpen?.menuVisible === true
        && hasNeuShadow(results.pageSizeOpen.menuShadow)
        && results.pageSizeOpen?.optionCount === 3
        && results.pageSizeOpen?.clipped === false,
    pageSizeSelect: results.pageSizeAfter?.value === '50',
    moreMenuNeu: results.moreMenu?.visible === true
        && hasNeuShadow(results.moreMenu.shadow)
        && results.moreMenu.border === '0px',
    mergeNeu: results.mergeSource && !results.mergeSource.isNativeSelect
        && results.mergeSource.menuVisible === true
        && hasNeuShadow(results.mergeSource.menuShadow)
        && results.mergeTargetExists === true,
    pickerListNeu: results.pickerList?.listExists === true
        && hasNeuShadow(results.pickerList.listShadow)
        && results.pickerList.itemCount > 0
        && results.pickerList.activeIsInset === true,
    noPageErrors: pageErrors.length === 0,
};
console.log('CHECKS', JSON.stringify(checks, null, 2));
const pass = Object.values(checks).every(Boolean);
console.log(pass ? 'VISUAL_PASS' : 'VISUAL_FAIL');
await browser.close();
process.exit(pass ? 0 : 1);
