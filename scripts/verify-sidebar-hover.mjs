/* 独立浏览器上下文验收悬停侧栏；只操作导航，不改业务数据。 */
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { strict as assert } from 'node:assert';

const out = 'output/sidebar-hover';
const url = process.env.SIDEBAR_TEST_URL || 'http://127.0.0.1:5173/?ui=pc';
const version = JSON.parse(await readFile('package.json', 'utf8')).version;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = { url, startedAt: new Date().toISOString(), checks: [], samples: [], pageErrors: [] };
try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', error => report.pageErrors.push(error.message));
    await page.addInitScript(version => {
        localStorage.setItem('tutorial_completed', 'true');
        localStorage.setItem('pc-release-notes-last-seen-version', version);
        // 旧展开偏好不应影响新交互。
        localStorage.setItem('pc-sidebar-collapsed', 'false');
    }, version);
    await page.goto(url);
    await page.locator('#splashScreen').waitFor({ state: 'detached' });
    const stage = page.locator('#pcSidebarStage');
    const menu = page.locator('#pcSidebarMoreMenu');
    const trigger = page.locator('[data-more-menu]');
    const check = (name, condition) => { assert.ok(condition, name); report.checks.push(name); };
    const settled = async collapsed => {
        await page.waitForFunction(collapsed => {
            const sidebar = document.querySelector('#pcSidebar');
            return document.querySelector('.pc-app').dataset.sidebar === (collapsed ? 'collapsed' : 'expanded')
                && Math.abs(sidebar.getBoundingClientRect().width - (collapsed ? 84 : 280)) < 1;
        }, collapsed);
        await stage.evaluate(async el => {
            await Promise.allSettled(el.getAnimations({ subtree: true }).filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished));
        });
    };
    const enter = async () => { await page.mouse.move(40, 180); await settled(false); };
    const leave = async () => { await page.mouse.move(650, 180); await settled(true); };
    const rects = () => page.evaluate(() => {
        const rect = selector => {
            const r = document.querySelector(selector).getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, right: r.right };
        };
        return { stage: rect('#pcSidebarStage'), sidebar: rect('#pcSidebar'), main: rect('#pcMain'), icon: rect('#pcSidebarNav .pc-nav-icon') };
    });
    await leave();
    check('不渲染收展按钮和分层衬板', await page.locator('#pcSidebarToggle, .pc-sidebar-underlay, [data-chrome-action="toggle-sidebar"]').count() === 0);
    const collapsed = await rects();
    // 真实逐帧采样，时间取系统时钟差值，不累加休眠时间。
    const sampling = page.evaluate(() => new Promise(resolve => {
        const start = Date.now(), frames = [];
        function frame() {
            const s = document.querySelector('#pcSidebar').getBoundingClientRect();
            const m = document.querySelector('#pcMain').getBoundingClientRect();
            frames.push({ t: Date.now() - start, width: s.width, mainX: m.x, mainWidth: m.width, edge: s.right });
            if (Date.now() - start < 500) requestAnimationFrame(frame); else resolve(frames);
        }
        requestAnimationFrame(frame);
    }));
    await page.mouse.move(40, 180);
    report.samples = await sampling;
    await settled(false);
    const expanded = await rects();
    check('展开至280像素且主内容区零位移零重排', Math.abs(expanded.sidebar.width - 280) < 1 && Math.abs(expanded.main.x - collapsed.main.x) < 1 && Math.abs(collapsed.main.width - expanded.main.width) < 1);
    check('浮岛向内分离缩进8像素且主导航图标在岛内横向锚点稳定', Math.abs(expanded.sidebar.x - collapsed.sidebar.x - 8) < 1 && Math.abs((expanded.icon.x - expanded.sidebar.x) - (collapsed.icon.x - collapsed.sidebar.x)) < 1.5);
    check('动画存在中间帧', report.samples.some(f => f.width > 90 && f.width < 275));
    check('景深遮罩层在展开时呈现', await page.locator('#pcDepthDimmer').evaluate(el => parseFloat(getComputedStyle(el).opacity) > 0.5));
    // 按移入、移出、移入顺序发出快速操作，检查最终状态不受旧动画锁影响。
    for (let i = 0; i < 4; i++) {
        await page.mouse.move(650, 180);
        await page.mouse.move(40, 180);
    }
    await settled(false);
    check('快速往返后仍能展开', true);
    await page.mouse.move(650, 180);
    await page.waitForFunction(() => {
        const width = document.querySelector('#pcSidebar').getBoundingClientRect().width;
        return width > 100 && width < 265;
    }, null, { polling: 'raf' });
    await page.mouse.move(40, 180);
    await settled(false);
    check('收起中途可反向展开', true);
    await page.locator('#pcSidebarNav [data-nav="/games"]').scrollIntoViewIfNeeded();
    await page.locator('#pcSidebarNav [data-nav="/games"]').click();
    await page.locator('.pc-nav-active[data-nav="/games"]').waitFor();
    check('底部主导航项可滚动到并点击', true);
    await page.locator('#pcSidebarNav [data-nav="/"]').scrollIntoViewIfNeeded();
    await page.locator('#pcSidebarNav [data-nav="/library"]').click();
    await page.locator('.pc-nav-active[data-nav="/library"]').waitFor();
    await leave();
    check('鼠标点击导航后的残留焦点不阻止收起', true);
    await enter();
    await page.screenshot({ path: out + '/图库-展开.png' });
    await page.locator('#pcSidebarNav [data-nav="/"]').click();
    await leave();

    for (const theme of ['light', 'dark']) {
        await page.evaluate(value => { document.documentElement.dataset.appearance = value; }, theme);
        for (const width of [1280, 800]) {
            await page.setViewportSize({ width, height: 800 });
            await leave();
            await page.screenshot({ path: out + '/' + theme + '-' + width + '-收起.png' });
            await enter();
            await page.screenshot({ path: out + '/' + theme + '-' + width + '-展开.png' });
            await trigger.click();
            await menu.waitFor({ state: 'visible' });
            await menu.hover();
            check(theme + width + '移入外置菜单保持展开', await page.locator('.pc-app').getAttribute('data-sidebar') === 'expanded');
            const hits = await menu.evaluate(el => [...el.querySelectorAll('[role="menuitem"]')].every(item => {
                const r = item.getBoundingClientRect();
                return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight
                    && item.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
            }));
            check(theme + width + '更多菜单可见且命中', hits);
            await page.screenshot({ path: out + '/' + theme + '-' + width + '-菜单.png' });
            await page.keyboard.press('Escape');
            check('Esc关闭菜单并归还焦点', !(await menu.isVisible()) && await trigger.evaluate(el => el === document.activeElement));
            // 通过鼠标点击正文解除键盘保持，不修改正文。
            await page.locator('#pcMain').click({ position: { x: 260, y: 180 } });
            await leave();
        }
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.keyboard.press('Tab');
    await page.locator('#pcSidebarNav [data-nav="/"]').focus();
    await settled(false);
    await page.mouse.move(650, 180);
    await settled(false);
    check('键盘焦点保持展开', true);
    await page.locator('#pcHomeSearchInput').focus();
    await leave();
    check('键盘焦点离开后可收起', true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await enter();
    check('低动效模式禁用宽度过渡', await page.locator('#pcSidebar').evaluate(el => getComputedStyle(el).transitionDuration) === '0s');
    await leave();
    check('悬停不写回旧持久化键', await page.evaluate(() => localStorage.getItem('pc-sidebar-collapsed')) === 'false');
    const touch = await browser.newPage({ viewport: { width: 1000, height: 800 }, hasTouch: true, reducedMotion: 'reduce' });
    await touch.addInitScript(version => {
        localStorage.setItem('tutorial_completed', 'true');
        localStorage.setItem('pc-release-notes-last-seen-version', version);
    }, version);
    await touch.goto(url);
    await touch.locator('#splashScreen').waitFor({ state: 'detached' });
    check('无悬停设备常展开且无按钮', await touch.locator('.pc-app').getAttribute('data-sidebar') === 'expanded');
    await touch.screenshot({ path: out + '/触屏-常展开.png' });
    await touch.close();
    check('无页面脚本异常', report.pageErrors.length === 0);
    report.passed = true;
    console.log('侧栏视觉验收通过：' + report.checks.length + '项，证据目录：' + out);
} catch (error) {
    report.passed = false;
    report.error = error.stack;
    throw error;
} finally {
    await writeFile(out + '/验收报告.json', JSON.stringify(report, null, 2));
    await browser.close();
}
