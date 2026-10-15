/* 独立浏览器验收侧栏密度与收起落定，不写入业务数据。 */
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { strict as assert } from 'node:assert';

const out = 'output/sidebar-collapse';
const version = JSON.parse(await readFile('package.json', 'utf8')).version;
const url = process.env.SIDEBAR_TEST_URL || 'http://127.0.0.1:5173/?ui=pc';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = { url, time: new Date().toISOString(), checks: [], errors: [], samples: [] };
try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    page.on('pageerror', error => report.errors.push(error.message));
    await page.addInitScript(version => {
        localStorage.setItem('tutorial_completed', 'true');
        localStorage.setItem('pc-release-notes-last-seen-version', version);
    }, version);
    await page.goto(url);
    await page.locator('#splashScreen').waitFor({ state: 'detached' });
    const stage = page.locator('#pcSidebarStage');
    const check = (name, condition) => { assert.ok(condition, name); report.checks.push(name); };
    const settled = async collapsed => {
        await page.waitForFunction(collapsed => {
            const root = document.querySelector('.pc-app');
            return root.dataset.sidebar === (collapsed ? 'collapsed' : 'expanded')
                && Math.abs(document.querySelector('#pcSidebar').getBoundingClientRect().width - (collapsed ? 84 : 280)) < 1;
        }, collapsed);
        await stage.evaluate(async el => {
            await Promise.allSettled(el.getAnimations({ subtree: true })
                .filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished));
        });
    };
    const enter = async () => { await page.mouse.move(10, 80); await settled(false); };
    const leave = async () => { await page.mouse.move(650, 180); await settled(true); };
    const density = () => page.locator('#pcSidebarNav').evaluate(el => {
        const style = getComputedStyle(el);
        const rects = [...el.querySelectorAll('.pc-nav-item')].map(el => {
            const r = el.getBoundingClientRect();
            return { y: r.y, height: r.height, bottom: r.bottom };
        });
        return { gap: parseFloat(style.rowGap), padding: parseFloat(style.paddingTop),
            heights: rects.map(r => r.height), ys: rects.map(r => r.y),
            gaps: rects.slice(1).map((r, i) => r.y - rects[i].bottom) };
    });
    await settled(true);
    check('首屏无收起落定动画', !(await page.locator('.pc-app').evaluate(el => el.classList.contains('pc-sidebar-collapse-feedback'))));
    await enter();
    const expanded = await density();
    check('主导航间距14像素、上下留白20像素、按钮高48像素', expanded.gap === 14 && expanded.padding === 20
        && expanded.heights.every(v => v === 48) && expanded.gaps.every(v => v === 14));
    await page.screenshot({ path: out + '/浅色-展开.png' });
    const sampling = page.evaluate(() => new Promise(resolve => {
        const start = Date.now(), frames = [];
        let closingAt;
        function frame() {
            const root = document.querySelector('.pc-app');
            const stage = document.querySelector('#pcSidebar').getBoundingClientRect();
            const item = document.querySelector('#pcSidebarNav .pc-nav-item');
            const icon = item.querySelector('.pc-nav-icon');
            const ir = icon.getBoundingClientRect();
            const label = getComputedStyle(item.querySelector('.pc-nav-label'));
            if (root.dataset.sidebar === 'collapsed' && closingAt === undefined) closingAt = Date.now();
            frames.push({ t: Date.now() - start, closingT: closingAt === undefined ? null : Date.now() - closingAt,
                width: stage.width, stageX: stage.x, stageY: stage.y, edge: stage.right, mainX: document.querySelector('#pcMain').getBoundingClientRect().x,
                iconX: ir.x + ir.width / 2, y: item.getBoundingClientRect().y,
                opacity: Number(label.opacity), textX: new DOMMatrixReadOnly(label.transform).e,
                scale: parseFloat(getComputedStyle(icon).scale) || 1 });
            if (Date.now() - start < 650) requestAnimationFrame(frame); else resolve(frames);
        }
        requestAnimationFrame(frame);
    }));
    await page.mouse.move(650, 180);
    report.samples = await sampling;
    await settled(true);
    const closing = report.samples.filter(f => f.closingT !== null);
    check('文字先于按钮收窄完成退场', closing.some(f => f.opacity < 0.01 && f.width > 85 && f.closingT <= 140));
    check('文字收起终点左移4像素', Math.abs(closing.at(-1).textX + 4) < 0.02);
    check('收起存在真实宽度中间帧', closing.some(f => f.width > 90 && f.width < 275));
    check('图标后半程轻缩至0.98附近再复位', closing.some(f => f.scale < 0.99 && f.scale >= 0.979 && f.closingT >= 130)
        && closing.at(-1).scale === 1);
    check('正文零位移零重排且侧栏宽度不回弹', closing.every((f, i) => Math.abs(f.mainX - 84) < 1
        && (i === 0 || f.width <= closing[i - 1].width + 0.1)));
    check('图标中心在岛内锚点稳定且无左右漂移', report.samples.every(f => Math.abs((f.iconX - f.stageX) - (report.samples[0].iconX - report.samples[0].stageX)) < 1.5));
    const collapsed = await density();
    check('展开收起保持相同导航项间距与按钮高度', collapsed.gap === expanded.gap
        && collapsed.heights.every((v, i) => v === expanded.heights[i]));
    await page.screenshot({ path: out + '/浅色-收起.png' });
    // 正在缩窄时重新进入，反馈取消且无旧队列回写。
    await enter();
    await page.mouse.move(650, 180);
    await page.waitForFunction(() => {
        const w = document.querySelector('#pcSidebar').getBoundingClientRect().width;
        return w > 120 && w < 260;
    }, null, { polling: 'raf' });
    await page.mouse.move(10, 80);
    await settled(false);
    check('中途反向立即取消落定反馈', !(await page.locator('.pc-app').evaluate(el => el.classList.contains('pc-sidebar-collapse-feedback'))));
    for (const height of [1000, 700]) {
        await page.setViewportSize({ width: height === 700 ? 800 : 1280, height });
        await page.evaluate(() => { document.documentElement.dataset.appearance = 'dark'; });
        await enter();
        const d = await density();
        check(height + '窗口间距符合断点', d.gap === (height <= 740 ? 12 : 14));
        await page.screenshot({ path: out + '/深色-' + height + '-展开.png' });
        const last = page.locator('#pcSidebarNav [data-nav="/games"]');
        await last.scrollIntoViewIfNeeded();
        check(height + '窗口最后一项可滚动并命中', await last.evaluate(el => {
            const r = el.getBoundingClientRect();
            return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        }));
        await leave();
        check(height + '窗口收起保持间距', (await density()).gap === d.gap);
        await page.screenshot({ path: out + '/深色-' + height + '-收起.png' });
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await enter(); await leave();
    check('低动效无落定动画和宽度过渡', await stage.evaluate(el => {
        const icon = getComputedStyle(el.querySelector('.pc-nav-icon'));
        return icon.animationName === 'none' && icon.scale === '1'
            && getComputedStyle(el).transitionDuration === '0s';
    }));
    check('不恢复收展按钮', await page.locator('#pcSidebarToggle, [data-chrome-action="toggle-sidebar"]').count() === 0);
    check('无页面脚本异常', report.errors.length === 0);
    report.passed = true;
    console.log('侧栏密度与收起验收通过：' + report.checks.length + '项；证据：' + out);
} catch (error) {
    report.passed = false;
    report.error = error.stack;
    throw error;
} finally {
    await writeFile(out + '/验收报告.json', JSON.stringify(report, null, 2));
    await browser.close();
}
