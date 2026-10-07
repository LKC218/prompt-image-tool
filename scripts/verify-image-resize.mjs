/* 真实页面、混合批次、方向、参数、既有结果与视觉边界验收。 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { strict as assert } from 'node:assert';
const out = path.resolve('output/image-resize');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, reducedMotion: 'no-preference' });
const errors = [], requests = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (/\/api\/image-process\?/.test(request.url())) requests.push(request.url()); });
await page.addInitScript(() => {
    localStorage.setItem('tutorial_completed', 'true');
    localStorage.setItem('pc-release-notes-last-seen-version', '2.5.31');
    localStorage.setItem('png-settings-open', 'false');
    localStorage.setItem('appearance-preference', 'light');
});
const shot = name => page.screenshot({ path: path.join(out, name + '.png'), animations: 'disabled' });
async function download(name) {
    const waiting = page.waitForEvent('download');
    await page.locator('[data-action="export"]').click();
    await (await waiting).saveAs(path.join(out, name + '.zip'));
}
async function run() {
    await page.locator('#imageAck').check();
    await page.locator('[data-action="run"]').click();
    await page.waitForFunction(() => document.querySelector('#pngSummary').textContent.includes('所选成功 3'), null, { timeout: 120000 });
    await page.locator('[data-action="cancel"]').waitFor({ state: 'hidden' });
}
try {
    await page.goto(process.env.IMAGE_TEST_URL || 'http://127.0.0.1:5174/?ui=pc');
    await page.locator('#splashScreen').waitFor({ state: 'detached' });
    await page.locator('[data-nav="/compress"]').click();
    await page.locator('.pc-compress[data-engine-ready="true"]').waitFor();
    await page.locator('#pngFolder').setInputFiles(path.join(out, '输入'));
    await page.waitForFunction(() => document.querySelector('#pngCount').textContent === '3 张');
    await page.locator('[data-action="settings"]').click();
    assert.equal(await page.locator('#imageResize').isChecked(), false);
    assert.match(await page.locator('#pngRows').textContent(), /300×600/);
    await page.locator('#imageResize').focus();
    await page.keyboard.press('Space');
    assert.equal(await page.locator('#imageResize').isChecked(), true);
    assert.equal(await page.locator('#imageOnlyShrink').isChecked(), true);
    assert.equal(await page.locator('[data-action="ratio-lock"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('[data-action="run"]').isDisabled(), true);
    await page.locator('#imageWidth').fill('160');
    assert.equal(await page.locator('#imageWidth').evaluate(el => document.activeElement === el), true);
    assert.match(await page.locator('#pngRows').textContent(), /640×320 → 预计 160×80/);
    assert.match(await page.locator('#pngRows').textContent(), /240×480 → 预计 160×320/);
    await page.locator('#imageHeight').fill('160');
    assert.match(await page.locator('#pngRows').textContent(), /300×600 → 预计 80×160/);
    await page.locator('[data-action="ratio-lock"]').click();
    assert.match(await page.locator('#pngRows').textContent(), /240×480 → 预计 160×160/);
    assert.match(await page.locator('#imageResizeHint').textContent(), /可能拉伸/);
    await page.locator('#imageWidth').fill('0');
    assert.equal(await page.locator('[data-action="run"]').isDisabled(), true);
    await page.locator('#imageWidth').fill('160');
    await page.locator('[data-action="ratio-lock"]').click();
    await page.locator('[data-resize-mode="percent"]').click();
    await page.locator('[data-percent="25"]').click();
    assert.match(await page.locator('#pngRows').textContent(), /640×320 → 预计 160×80/);
    await page.locator('#imagePercent').fill('1001');
    assert.equal(await page.locator('[data-action="run"]').isDisabled(), true);
    await page.locator('[data-percent="50"]').click();
    await page.locator('[data-resize-mode="longest"]').click();
    await page.locator('#imageLongest').fill('160');
    assert.match(await page.locator('#pngRows').textContent(), /240×480 → 预计 80×160/);
    assert.equal(requests.length, 0, '调参不能提前编码');
    await run();
    assert.equal(requests.length, 3);
    assert.match(await page.locator('#pngRows').textContent(), /已生成 80×160/);
    await shot('最长边-混合批次结果');
    await download('原格式缩放');
    await page.locator('#imageLongest').fill('120');
    assert.match(await page.locator('#pngRows').textContent(), /预计 60×120 · 已生成 80×160（旧参数）/);
    assert.equal(requests.length, 3);
    await shot('预计与实际-旧结果');
    await page.locator('[data-action="reprocess"]').click();
    await run();
    await download('重新处理');
    for (const target of ['jpeg', 'webp', 'png']) {
        await page.locator('[data-operation="convert"]').click();
        await page.locator('[data-target="' + target + '"]').click();
        await page.locator('[data-action="reprocess"]').click();
        await run();
        await download('缩放转换-' + target);
    }
    const layouts = [];
    await page.locator('[data-resize-mode="dimensions"]').click();
    for (const appearance of ['light', 'dark']) {
        await page.evaluate(async appearance => (await import('/js/core/theme-service.js')).setAppearancePreference(appearance), appearance);
        for (const width of [800, 1440]) {
            await page.setViewportSize({ width, height: 1050 });
            await page.waitForFunction(() => !document.querySelector('#pngSettings').getAnimations().length && !document.querySelector('.png-workspace').getAnimations().length);
            await page.locator('.image-settings-scroll').evaluate(el => { el.scrollTop = document.querySelector('.image-resize-heading').offsetTop - el.offsetTop - 10; });
            const header = await page.locator('#pngSettings>header').boundingBox();
            await page.locator('.image-settings-scroll').evaluate(el => { el.scrollTop += 30; });
            assert.deepEqual(await page.locator('#pngSettings>header').boundingBox(), header, '标题固定');
            await page.locator('.image-settings-scroll').evaluate(el => { el.scrollTop -= 30; });
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            await page.locator('#imageNotice').waitFor({ state: 'hidden' });
            await shot(appearance + '-' + width);
            layouts.push({ appearance, width, fixedHeader: true, overflow: false });
        }
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('#imageResize').uncheck();
    assert.equal(await page.locator('#imageResizeFields').isVisible(), false);
    await page.locator('#imageResize').check();
    assert.equal(await page.locator('#imageResizeFields').evaluate(el => el.getAnimations().length), 0);
    assert.deepEqual(errors, []);
    await writeFile(path.join(out, '浏览器验收.json'), JSON.stringify({ requests: requests.length, batches: 5, layouts, errors, keyboard: true, noPrematureEncoding: true, staleResults: true, reducedMotion: true }, null, 2));
    console.log('尺寸控件、混合批次、重新处理、ZIP、布局及减少动态效果通过');
} finally { await browser.close(); }
