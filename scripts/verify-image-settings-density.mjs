/* 设置密度前后实测、显隐边界与键盘验证，使用合成图片和隔离后端。 */
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { strict as assert } from 'node:assert';
import path from 'node:path';
const out = path.resolve('output/image-settings-density');
const baseline = process.argv.includes('--baseline');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, reducedMotion: 'reduce' });
const errors = []; page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => {
    localStorage.setItem('tutorial_completed', 'true');
    localStorage.setItem('pc-release-notes-last-seen-version', '2.5.31');
    localStorage.setItem('png-settings-open', 'false');
    localStorage.setItem('appearance-preference', 'light');
});
const metrics = async () => page.locator('.image-settings-scroll').evaluate(el => {
    const children = [...el.children].filter(node => !node.hidden);
    const first = children[0].getBoundingClientRect(), last = children.at(-1).getBoundingClientRect();
    return { contentHeight: Math.round(last.bottom - first.top), controls: [...el.querySelectorAll('button,input,summary')].filter(node => node.checkVisibility()).length };
});
try {
    await page.goto('http://127.0.0.1:5174/?ui=pc');
    await page.locator('#splashScreen').waitFor({ state: 'detached' });
    await page.locator('[data-nav="/compress"]').click();
    await page.locator('.pc-compress[data-engine-ready="true"]').waitFor();
    await page.locator('#pngFolder').setInputFiles(path.resolve('output/image-resize/输入'));
    await page.waitForFunction(() => document.querySelector('#pngCount').textContent === '3 张');
    await page.locator('[data-action="settings"]').click();
    const states = { default: await metrics() };
    if (!baseline) await page.screenshot({ path: path.join(out, '默认设置.png') });
    await page.locator('#imageResize').check();
    await page.locator('#imageWidth').fill('160');
    states.resize = await metrics();
    await page.locator('[data-operation="convert"]').click();
    await page.locator('[data-target="png"]').click();
    states.png = await metrics();
    if (!baseline) await page.screenshot({ path: path.join(out, 'PNG转换尺寸.png') });
    if (baseline) {
        await writeFile(path.join(out, '调整前.json'), JSON.stringify(states, null, 2));
        console.log(JSON.stringify(states));
    } else {
        assert.equal(await page.locator('#imageEncodingChoices').isVisible(), false);
        assert.match(await page.locator('#imageEncodingState').textContent(), /PNG.*无损/);
        assert.equal(await page.locator('#imageQualityGroup').isVisible(), false);
        assert.equal(await page.locator('#pngLevel').isVisible(), false);
        assert.equal(await page.locator('#imageAdvanced').getAttribute('open'), null);
        assert.equal(await page.locator('[data-action="run"]').isDisabled(), true);
        await page.locator('#imageRiskDetails summary').focus(); await page.keyboard.press('Enter');
        assert.match(await page.locator('#imageRiskDetails').textContent(), /不能替代原文件/);
        assert.equal(await page.locator('#imageAck').isChecked(), false);
        await page.keyboard.press('Enter');
        await page.locator('[data-action="ratio-lock"]').focus(); await page.keyboard.press('Space');
        assert.match(await page.locator('#imageResizeHint').textContent(), /可能拉伸/);
        await page.keyboard.press('Space');
        await page.locator('#imageAdvanced>summary').focus(); await page.keyboard.press('Enter');
        await page.locator('#pngLevel').fill('3');
        await page.locator('#pngThreads').fill('1');
        await page.locator('[data-budget="15"]').click();
        await page.locator('[data-action="clean-cache"]').click();
        await page.locator('#imageAdvanced>summary').click();
        await page.locator('#imageAdvanced>summary').click();
        assert.equal(await page.locator('#pngLevel').inputValue(), '3');
        assert.equal(await page.locator('#pngThreads').inputValue(), '1');
        assert.equal(await page.locator('[data-budget="15"]').getAttribute('aria-pressed'), 'true');
        await page.locator('#imageAdvanced>summary').click();
        await page.locator('[data-target="jpeg"]').click();
        assert.match(await page.locator('#imageEncodingState').textContent(), /JPEG.*有损/);
        assert.equal(await page.locator('#imageQualityGroup').isVisible(), true);
        assert.equal(await page.locator('#imageOptimizationGroup').isVisible(), false);
        await page.locator('[data-target="webp"]').click();
        assert.equal(await page.locator('#imageEncodingChoices').isVisible(), true);
        await page.locator('[data-encoding="lossless"]').click();
        assert.equal(await page.locator('#imageQualityGroup').isVisible(), false);
        await page.locator('[data-operation="optimize"]').click();
        assert.equal(await page.locator('#imageQualityGroup').isVisible(), true, '混合缩放需 JPEG 质量');
        await page.locator('#pngAll').uncheck();
        await page.locator('#pngRows tr').filter({ hasText: '横图.png' }).locator('[data-select]').check();
        assert.equal(await page.locator('#imageQualityGroup').isVisible(), false, '仅选 PNG 不显示 JPEG 质量');
        await page.locator('#pngAll').check();
        assert.equal(await page.locator('#imageQualityGroup').isVisible(), true);
        await page.locator('#imageAck').check();
        const request = page.waitForRequest(request => /\/api\/image-process\?/.test(request.url()));
        await page.locator('[data-action="run"]').click();
        const sent = new URL((await request).url());
        for (const [key, value] of Object.entries({ level: '3', threads: '1', budget: '15', width: '160' })) assert.equal(sent.searchParams.get(key), value);
        await page.waitForFunction(() => document.querySelector('#pngSummary').textContent.includes('所选成功 3'));
        await page.locator('[data-action="cancel"]').waitFor({ state: 'hidden' });
        await page.locator('#imageNotice').waitFor({ state: 'hidden' });
        for (const appearance of ['light', 'dark']) {
            await page.evaluate(async value => (await import('/js/core/theme-service.js')).setAppearancePreference(value), appearance);
            for (const width of [800, 1440]) {
                await page.setViewportSize({ width, height: 1050 });
                await page.locator('.image-settings-scroll').evaluate(el => { el.scrollTop = 0; });
                await page.screenshot({ path: path.join(out, appearance + '-' + width + '.png') });
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            }
        }
        const saved = await readFile(path.join(out, '调整前.json'), 'utf8').catch(error => { if (error.code === 'ENOENT') return null; throw error; });
        const before = saved ? JSON.parse(saved) : null;
        if (before) for (const key of Object.keys(states)) assert.ok(states[key].contentHeight < before[key].contentHeight, key + '默认内容须缩短');
        assert.deepEqual(errors, []);
        await writeFile(path.join(out, '验收结果.json'), JSON.stringify({ before, after: states, errors, advancedValuesPreserved: true, keyboard: true, mixedBatch: true }, null, 2));
        console.log('设置精简、参数保留、键盘、混合批次与浅深色宽窄布局验收通过');
    }
} finally { await browser.close(); }
