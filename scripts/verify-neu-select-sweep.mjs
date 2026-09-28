import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const APP = process.env.PC_URL || 'http://127.0.0.1:5173/?ui=pc';
const OUT = path.resolve('output/playwright/neu-select-sweep');
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', err => console.log('PAGEERROR', err.message));

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

function hasNeuShadow(shadow) {
    if (!shadow || shadow === 'none') return false;
    return shadow.includes('inset') || shadow.split(',').length >= 2;
}

await page.goto(APP, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
await dismissOverlays();

// 侧栏更多菜单
const moreBtn = page.locator('[data-more-menu]').first();
if (await moreBtn.count()) {
    await dismissOverlays();
    await page.evaluate(() => {
        document.querySelector('[data-more-menu]')?.click();
    });
    await page.waitForTimeout(350);
    await page.screenshot({ path: `${OUT}/01-sidebar-more-menu.png` });
    const moreMeta = await page.evaluate(() => {
        const menu = document.querySelector('.pc-sidebar-more-menu');
        const cs = menu ? getComputedStyle(menu) : null;
        return {
            visible: menu && !menu.hidden && menu.getBoundingClientRect().height > 20,
            shadow: cs?.boxShadow,
            border: cs?.border,
            bg: cs?.backgroundColor,
            itemCount: menu?.querySelectorAll('.pc-sidebar-more-menu-item').length || 0,
            aria: document.querySelector('[data-more-menu]')?.getAttribute('aria-expanded'),
        };
    });
    console.log('MORE_MENU', JSON.stringify(moreMeta, null, 2));
    await page.keyboard.press('Escape');
    await dismissOverlays();
}

// 提示词库每页数量
await page.evaluate(() => {
    document.querySelector('[data-nav="/library"]')?.click();
});
await page.waitForTimeout(1500);
await dismissOverlays();

const hasLibrary = await page.evaluate(() => !!document.querySelector('#pcLibraryContent'));
if (!hasLibrary) {
    await page.locator('[data-nav="/library"]').first().click({ force: true });
    await page.waitForTimeout(1500);
    await dismissOverlays();
}

const pageSizeRoot = page.locator('#pcLibraryPageSize');
try {
    await pageSizeRoot.waitFor({ state: 'visible', timeout: 8000 });
} catch {
    await page.screenshot({ path: `${OUT}/02-library-missing.png`, fullPage: true });
    console.log('LIBRARY_STATE', await page.evaluate(() => ({
        hasContent: !!document.querySelector('#pcLibraryContent'),
        hasWorkspace: !!document.querySelector('.pc-library-workspace'),
        hasPagination: !!document.querySelector('.pc-library-pagination'),
        text: document.querySelector('main, .pc-main, #pcApp')?.innerText?.slice(0, 180),
    })));
}
await page.locator('.pc-library-pagination').screenshot({ path: `${OUT}/02-page-size-closed.png` });

await pageSizeRoot.locator('.pc-neu-select-trigger').click();
await page.waitForTimeout(300);
await page.locator('.pc-library-pagination').screenshot({ path: `${OUT}/03-page-size-open.png` });
await pageSizeRoot.locator('.pc-neu-select-menu').screenshot({ path: `${OUT}/03-page-size-menu.png` });

const pageMeta = await page.evaluate(() => {
    const root = document.querySelector('#pcLibraryPageSize');
    const trigger = root?.querySelector('.pc-neu-select-trigger');
    const menu = root?.querySelector('.pc-neu-select-menu');
    const options = [...(root?.querySelectorAll('[role="option"]') || [])];
    const menuCs = menu ? getComputedStyle(menu) : null;
    const triggerCs = trigger ? getComputedStyle(trigger) : null;
    return {
        isNative: !!document.querySelector('select#pcLibraryPageSize'),
        menuOpen: root?.classList.contains('pc-neu-select-open'),
        menuVisible: menu ? menu.getBoundingClientRect().height > 40 : false,
        menuShadow: menuCs?.boxShadow,
        triggerShadow: triggerCs?.boxShadow,
        optionCount: options.length,
        labels: options.map(o => o.textContent.trim()),
        clipped: menu ? (menu.scrollHeight > menu.clientHeight + 2) : false,
    };
});
console.log('PAGE_SIZE', JSON.stringify(pageMeta, null, 2));

// 选择 50 条/页
await pageSizeRoot.locator('[data-value="50"]').click();
await page.waitForTimeout(400);
const after = await page.evaluate(() => ({
    value: document.querySelector('#pcLibraryPageSize')?.dataset.value,
    label: document.querySelector('#pcLibraryPageSize .pc-neu-select-value')?.textContent.trim(),
}));
console.log('PAGE_SIZE_AFTER', JSON.stringify(after));

// 分类合并下拉
const categoryNav = page.locator('[data-nav="/category"]').first();
await categoryNav.click({ force: true });
await page.waitForTimeout(1200);
await dismissOverlays();

const mergeBtn = page.locator('button').filter({ hasText: '合并分类' }).first();
if (await mergeBtn.count()) {
    await dismissOverlays();
    await page.evaluate(() => {
        const btn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('合并分类'));
        btn?.click();
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/04-merge-modal.png` });
    const mergeRoot = page.locator('#pcMergeSource');
    if (await mergeRoot.count()) {
        await page.evaluate(() => {
            document.querySelector('#pcMergeSource .pc-neu-select-trigger')?.click();
        });
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${OUT}/05-merge-open.png` });
        await page.locator('#pcMergeSource .pc-neu-select-menu').screenshot({ path: `${OUT}/05-merge-menu.png` }).catch(() => {});
        const mergeMeta = await page.evaluate(() => {
            const root = document.querySelector('#pcMergeSource');
            const menu = root?.querySelector('.pc-neu-select-menu');
            const modal = document.querySelector('.pc-modal');
            const cs = menu ? getComputedStyle(menu) : null;
            return {
                isNative: !!document.querySelector('select#pcMergeSource'),
                menuVisible: menu ? menu.getBoundingClientRect().height > 20 : false,
                menuHidden: menu?.hidden === true,
                optionCount: root?.querySelectorAll('[role="option"]').length || 0,
                menuShadow: cs?.boxShadow,
                modalVisible: modal ? getComputedStyle(modal).display !== 'none' : false,
            };
        });
        console.log('MERGE', JSON.stringify(mergeMeta, null, 2));
    }
} else {
    console.log('MERGE_BTN_MISSING');
}

const pass = pageMeta
    && pageMeta.isNative === false
    && pageMeta.menuOpen === true
    && pageMeta.menuVisible === true
    && hasNeuShadow(pageMeta.menuShadow)
    && hasNeuShadow(pageMeta.triggerShadow)
    && pageMeta.optionCount === 3
    && pageMeta.clipped === false
    && after.value === '50'
    && after.label?.includes('50');

console.log(pass ? 'VISUAL_PASS' : 'VISUAL_FAIL');
await browser.close();
process.exit(pass ? 0 : 1);
