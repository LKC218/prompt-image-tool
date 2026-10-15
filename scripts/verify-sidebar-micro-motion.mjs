/* 独立浏览器验证按钮微交互，不写业务数据。 */
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { strict as assert } from 'node:assert';

const out = 'output/sidebar-micro-motion';
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = { time: new Date().toISOString(), checks: [], samples: [], errors: [] };
try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', e => report.errors.push(e.message));
    await page.addInitScript(version => {
        localStorage.setItem('tutorial_completed', 'true');
        localStorage.setItem('pc-release-notes-last-seen-version', version);
    }, version);
    await page.goto(process.env.SIDEBAR_TEST_URL || 'http://127.0.0.1:5173/?ui=pc');
    await page.locator('#splashScreen').waitFor({ state: 'detached' });
    await page.mouse.move(10, 80);
    await page.waitForFunction(() => Math.abs(document.querySelector('#pcSidebar').getBoundingClientRect().width - 280) < 1);
    await page.locator('#pcSidebarStage').evaluate(async el => {
        await Promise.allSettled(el.getAnimations({ subtree: true }).filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished));
    });
    const item = page.locator('#pcSidebarNav [data-nav="/library"]');
    const check = (name, condition) => { assert.ok(condition, name); report.checks.push(name); };
    const metrics = () => item.evaluate(el => {
        const rect = el.getBoundingClientRect();
        const icon = new DOMMatrixReadOnly(getComputedStyle(el.querySelector('.pc-nav-icon')).transform);
        const label = new DOMMatrixReadOnly(getComputedStyle(el.querySelector('.pc-nav-label')).transform);
        return { x: rect.x, y: rect.y, w: rect.width, h: rect.height, scale: icon.a, rotation: icon.b, dy: icon.f, textX: label.e };
    });
    const idle = await metrics();
    await item.hover();
    await page.waitForFunction(() => {
        const icon = document.querySelector('#pcSidebarNav [data-nav="/library"] .pc-nav-icon');
        const label = document.querySelector('#pcSidebarNav [data-nav="/library"] .pc-nav-label');
        return Math.abs(new DOMMatrixReadOnly(getComputedStyle(icon).transform).a - 1.06) < 0.001
            && Math.abs(new DOMMatrixReadOnly(getComputedStyle(label).transform).e - 3) < 0.02;
    });
    const hover = await metrics();
    report.metrics = { idle, hover };
    check('悬停图标放大1.06并上移1像素', Math.abs(hover.scale - 1.06) < 0.002 && Math.abs(hover.dy + 1) < 0.05);
    check('文字右移3像素', Math.abs(hover.textX - 3) < 0.05);
    check('悬停不移动或缩放点击区域', ['x', 'y', 'w', 'h'].every(k => Math.abs(hover[k] - idle[k]) < 0.1));
    await page.screenshot({ path: out + '/浅色-悬停.png' });
    await page.mouse.down();
    await page.waitForFunction(() => Math.abs(new DOMMatrixReadOnly(getComputedStyle(document.querySelector('#pcSidebarNav [data-nav="/library"] .pc-nav-icon')).transform).a - 0.94) < 0.002);
    const press = await metrics();
    check('按下缩小至0.94且点击区域固定', Math.abs(press.scale - 0.94) < 0.002 && Math.abs(press.y - idle.y) < 0.1);
    check('不叠加通用波纹', await item.locator('.td-ripple').count() === 0);
    await page.screenshot({ path: out + '/浅色-按下.png' });
    const sampling = page.evaluate(() => new Promise(resolve => {
        const start = Date.now(), frames = [];
        function frame() {
            const el = document.querySelector('#pcSidebarNav [data-nav="/library"]');
            const m = new DOMMatrixReadOnly(getComputedStyle(el.querySelector('.pc-nav-icon')).transform);
            frames.push({ t: Date.now() - start, scale: m.a, rotation: m.b, dy: m.f, clicking: el.classList.contains('pc-nav-clicking'), selected: el.getAttribute('aria-current') });
            if (Date.now() - start < 550) requestAnimationFrame(frame); else resolve(frames);
        }
        requestAnimationFrame(frame);
    }));
    await page.mouse.up();
    await page.screenshot({ path: out + '/浅色-释放回弹.png' });
    report.samples = await sampling;
    check('单次回弹达到放大与上弹区间', report.samples.some(f => f.scale > 1.10 && f.dy < -2.6));
    check('回弹不含左右摇摆', report.samples.every(f => Math.abs(f.rotation) < 0.001));
    check('导航在回弹期间立即切换', report.samples.some(f => f.clicking && f.selected === 'page'));
    await page.waitForFunction(() => !document.querySelector('#pcSidebarNav [data-nav="/library"]').classList.contains('pc-nav-clicking'));
    const rest = await metrics();
    check('回弹结束回到悬停态而非跳回原尺寸', Math.abs(rest.scale - 1.06) < 0.002);
    for (let i = 0; i < 3; i++) await item.click({ delay: 35 });
    await page.waitForFunction(() => !document.querySelector('#pcSidebarNav [data-nav="/library"]').classList.contains('pc-nav-clicking'));
    check('连续点击不残留或排队', await item.getAttribute('aria-current') === 'page');
    await page.mouse.move(10, 80);
    await page.waitForFunction(() => Math.abs(new DOMMatrixReadOnly(getComputedStyle(document.querySelector('#pcSidebarNav [data-nav="/library"] .pc-nav-icon')).transform).a - 1) < 0.002);
    check('移出恢复且无再次弹跳', !(await item.evaluate(el => el.getAnimations({ subtree: true }).some(a => a.animationName === 'pc-nav-icon-bounce'))));
    await page.keyboard.press('Tab');
    await item.focus();
    await page.waitForFunction(() => document.querySelector('#pcSidebarNav [data-nav="/library"]').matches(':focus-visible'));
    check('键盘可见焦点保留', await item.evaluate(el => getComputedStyle(el).outlineStyle !== 'none'));
    await page.keyboard.press('Enter');
    check('键盘激活立即切页', await item.getAttribute('aria-current') === 'page');
    const more = page.locator('[data-more-menu]');
    await more.click();
    await page.locator('#pcSidebarMoreMenu').waitFor({ state: 'visible' });
    check('更多按钮反馈不阻塞菜单', true);
    await page.keyboard.press('Escape');
    await page.locator('[data-nav="/settings"]').click();
    check('设置按钮保留齿轮动效', await page.locator('[data-nav="/settings"] .pc-nav-icon').evaluate(el => getComputedStyle(el).animationName) === 'pc-sidebar-settings-gear-turn');
    await page.locator('#pcSidebarNav [data-nav="/"]').click();
    await page.evaluate(() => { document.documentElement.dataset.appearance = 'dark'; });
    await item.hover();
    await page.screenshot({ path: out + '/深色-悬停.png' });
    await page.setViewportSize({ width: 800, height: 800 });
    await item.hover();
    await page.screenshot({ path: out + '/窄屏-深色-悬停.png' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await item.click();
    check('低动效不添加回弹类', !(await item.evaluate(el => el.classList.contains('pc-nav-clicking'))));
    check('低动效图标不位移缩放', await item.locator('.pc-nav-icon').evaluate(el => getComputedStyle(el).transform) === 'none');
    await more.click();
    check('低动效更多图标也不位移缩放', await more.locator('.pc-more-nav-icon').evaluate(el => getComputedStyle(el).transform) === 'none');
    check('侧栏阻尼节奏符合Apple标准动效', await page.locator('.pc-app').evaluate(el => getComputedStyle(el).getPropertyValue('--pc-sidebar-motion').trim()) === '400ms cubic-bezier(0.25, 1, 0.5, 1)');
    check('无页面脚本异常', report.errors.length === 0);
    report.passed = true;
    console.log('按钮微交互验收通过：' + report.checks.length + '项；证据：' + out);
} catch (error) {
    report.passed = false;
    report.error = error.stack;
    throw error;
} finally {
    await writeFile(out + '/验收报告.json', JSON.stringify(report, null, 2));
    await browser.close();
}
