/* 顶栏视觉衔接与布局前后对比，独立浏览器上下文，不修改业务资料。 */
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { strict as assert } from 'node:assert';

const out = 'output/window-header';
const baseline = process.argv.includes('--baseline');
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = {};
try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    await page.addInitScript(version => {
        localStorage.setItem('tutorial_completed', 'true');
        localStorage.setItem('pc-release-notes-last-seen-version', version);
        localStorage.setItem('pc-sidebar-collapsed', 'false');
    }, version);
    await page.goto(process.env.HEADER_TEST_URL || 'http://127.0.0.1:5173/?ui=pc');
    await page.locator('#splashScreen').waitFor({ state: 'detached' });
    for (const theme of ['light', 'dark']) {
        await page.evaluate(value => document.documentElement.dataset.appearance = value, theme);
        for (const width of [1280, 800]) {
            await page.setViewportSize({ width, height: 800 });
            for (const collapsed of [false, true]) {
                await page.mouse.move(collapsed ? 650 : 40, 180);
                await page.waitForFunction(collapsed => document.querySelector('.pc-app').dataset.sidebar === (collapsed ? 'collapsed' : 'expanded'), collapsed);
                await page.locator('.pc-sidebar').evaluate(async el => {
                    await Promise.all(el.getAnimations().map(animation => animation.finished));
                });
                const key = `${theme}-${width}-${collapsed}`;
                results[key] = await page.evaluate(() => {
                    const rect = selector => {
                        const r = document.querySelector(selector).getBoundingClientRect();
                        return { top: r.top, bottom: r.bottom, height: r.height };
                    };
                    const chrome = document.querySelector('.pc-window-chrome');
                    const left = document.querySelector('.pc-window-chrome-left');
                    return {
                        chrome: rect('.pc-window-chrome'), banner: rect('.pc-welcome-banner'),
                        content: rect('.pc-welcome-section'), logo: rect('.pc-sidebar-logo'),
                        background: getComputedStyle(chrome).backgroundColor,
                        leftBackground: getComputedStyle(left).backgroundColor,
                        leftBorder: getComputedStyle(left).borderRightWidth,
                        hits: [...chrome.querySelectorAll('[data-window-action]')].map(el => {
                            const r = el.getBoundingClientRect();
                            return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
                        }),
                        drag: chrome.querySelector('.pc-window-chrome-drag').hasAttribute('data-tauri-drag-region'),
                    };
                });
                if (!baseline) {
                    const r = results[key];
                    assert.equal(r.chrome.height, 36);
                    assert.equal(r.banner.top, r.chrome.bottom);
                    assert.equal(r.leftBorder, '0px');
                    assert.equal(r.leftBackground, 'rgba(0, 0, 0, 0)');
                    assert.notEqual(r.background, 'rgba(0, 0, 0, 0)');
                    assert.ok(r.hits.every(Boolean) && r.drag);
                }
                await page.screenshot({ path: `${out}/${baseline ? '调整前' : '调整后'}-${key}.png` });
            }
        }
    }
    await writeFile(`${out}/${baseline ? '调整前' : '调整后'}.json`, JSON.stringify(results, null, 2));
    if (!baseline) {
        const previous = JSON.parse(await readFile(`${out}/调整前.json`, 'utf8'));
        for (const [key, value] of Object.entries(results)) {
            // 悬停侧栏已重构品牌区；顶栏验收继续约束正文，不比较旧品牌区尺寸。
            for (const part of ['content']) {
                assert.ok(Math.abs(value[part].top - previous[key][part].top) < 1, `${key} ${part} 不能整体下移`);
            }
            assert.ok(Math.abs(value.banner.bottom - previous[key].banner.bottom) < 1);
        }
        for (const [route, selector] of Object.entries({ '/library': '.pc-welcome-banner-library', '/editor/': '.pc-welcome-banner-editor', '/settings': '.pc-welcome-banner-settings', '/compress': '.pc-compress', '/category': '.pc-welcome-banner-category' })) {
            await page.locator(`[data-nav="${route}"]`).click();
            await page.locator(selector).waitFor({ state: 'visible' });
            await page.waitForFunction(() => Math.abs(document.querySelector('.pc-welcome-banner').getBoundingClientRect().top - 36) < 1);
        }
    }
    await writeFile(`${out}/${baseline ? '调整前' : '调整后'}.json`, JSON.stringify(results, null, 2));
    console.log(baseline ? '已记录调整前截图及坐标。' : '通过：8 组主题／宽度／收展组合、坐标不下移、窗口控件命中及五个页面衔接。');
} finally {
    await browser.close();
}
