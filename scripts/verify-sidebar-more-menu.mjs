/* 独立浏览器上下文验证侧栏菜单，不修改业务数据。 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { strict as assert } from 'node:assert';

const out = 'output/sidebar-more-menu';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    await page.addInitScript(() => {
        localStorage.setItem('tutorial_completed', 'true');
        localStorage.setItem('pc-release-notes-last-seen-version', '2.5.31');
        localStorage.setItem('pc-sidebar-collapsed', 'true');
    });
    await page.goto(process.env.SIDEBAR_TEST_URL || 'http://127.0.0.1:5174/?ui=pc');
    await page.locator('#splashScreen').waitFor({ state: 'detached' });
    const trigger = page.locator('[data-more-menu]');
    const menu = page.locator('#pcSidebarMoreMenu');
    async function checkMenu() {
        await menu.waitFor({ state: 'visible' });
        const result = await menu.evaluate(el => {
            const rect = el.getBoundingClientRect();
            const points = [...el.querySelectorAll('[role="menuitem"]')].map(item => {
                const r = item.getBoundingClientRect();
                return item.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
            });
            return { independent: !el.closest('.pc-sidebar'), inside: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight, points };
        });
        assert.equal(result.independent, true);
        assert.equal(result.inside, true);
        assert.ok(result.points.every(Boolean), '菜单项不能被裁剪或覆盖');
    }
    for (const theme of ['light', 'dark']) {
        await page.evaluate(value => document.documentElement.dataset.appearance = value, theme);
        for (const width of [1280, 800]) {
            await page.setViewportSize({ width, height: 680 });
            await trigger.click();
            await checkMenu();
            await page.screenshot({ path: `${out}/收起-${theme}-${width}.png` });
            await page.setViewportSize({ width: width - 80, height: 600 });
            await checkMenu();
            await page.keyboard.press('Escape');
            assert.equal(await menu.isVisible(), false);
            assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
        }
    }
    await trigger.click();
    await page.locator('.pc-main').click({ position: { x: 10, y: 100 } });
    assert.equal(await menu.isVisible(), false);
    await trigger.click();
    await page.locator('#pcSidebarToggle').click();
    assert.equal(await menu.isVisible(), false);
    await trigger.click();
    await checkMenu();
    await page.screenshot({ path: `${out}/展开.png` });
    await menu.locator('[data-release-notes]').click();
    assert.equal(await menu.isVisible(), false);
    await page.locator('.pc-release-notes').waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.locator('#pcSidebarToggle').click();
    await page.waitForFunction(() => document.querySelector('.pc-app.pc-sidebar-collapsed') && document.querySelector('#pcSidebarStage').className === 'pc-sidebar-stage');
    await trigger.click();
    await menu.evaluate(async el => { await Promise.all(el.getAnimations().map(animation => animation.finished)); });
    await checkMenu();
    await page.screenshot({ path: `${out}/常规动效收起.png` });
    console.log('通过：浅深色、双窗口尺寸、缩放定位、收展、命中检测、外部关闭、Esc 焦点及更新记录点击。');
} finally {
    await browser.close();
}
