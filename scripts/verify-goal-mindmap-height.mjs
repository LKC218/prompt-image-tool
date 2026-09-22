import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const APP = 'http://127.0.0.1:5173/?ui=pc';
const API = 'http://127.0.0.1:8888/api';
const OUT = 'output/playwright/goal-mindmap-height';
const PROJECT_NAME = '视图切换验证-导图';

async function api(path, init = {}) {
    const res = await fetch(`${API}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...init,
        body: init.body
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) throw new Error(`${init.method || 'GET'} ${path} -> ${res.status} ${text}`);
    return data;
}

function assert(cond, msg) {
    if (!cond) throw new Error(`ASSERT: ${msg}`);
}

await mkdir(OUT, { recursive: true });
const projects = await api('/goals/projects');
const project = (projects || []).find(p => p.name === PROJECT_NAME);
assert(project, 'seed project exists: ' + PROJECT_NAME);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', e => console.log('PAGEERROR', e.message));
const results = [];

try {
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1600);
    await page.evaluate(() => {
        document.querySelectorAll('.pc-modal-overlay, #pcModalOverlay').forEach((el) => {
            el.classList.remove('pc-modal-active');
            el.hidden = true;
            el.style.pointerEvents = 'none';
        });
    });
    await page.locator('.pc-sidebar-nav').getByText('目标计划').first().click();
    await page.waitForTimeout(1000);

    const card = page.locator('.pc-goal-project-card[data-project-id="' + project.id + '"]');
    assert(await card.count(), 'project card present');
    await card.locator('.pc-goal-project-name').first().click({ force: true });
    await page.waitForTimeout(1200);
    await page.locator('#pcGoalViewMindmap').click();
    await page.waitForTimeout(1400);

    const embedded = await page.evaluate(() => {
        const main = document.querySelector('.pc-main');
        const pageEl = document.querySelector('.pc-page');
        const detail = document.querySelector('.pc-goal-detail-page');
        const mind = document.querySelector('#pcGoalMindmap');
        const stage = document.querySelector('#pcGoalMindmapStage');
        const world = document.querySelector('#pcGoalMindmapWorld');
        const cs = mind ? getComputedStyle(mind) : null;
        return {
            viewportH: window.innerHeight,
            mainH: main?.clientHeight || 0,
            pageH: pageEl?.clientHeight || 0,
            detailH: detail?.clientHeight || 0,
            mindH: mind?.clientHeight || 0,
            stageH: stage?.clientHeight || 0,
            stageW: stage?.clientWidth || 0,
            mindMinHeight: cs?.minHeight || '',
            mindFlex: cs?.flex || '',
            stageMinHeight: stage ? getComputedStyle(stage).minHeight : '',
            pageViewClass: pageEl?.classList.contains('is-view-mindmap') || false,
            detailViewClass: detail?.classList.contains('is-view-mindmap') || false,
            maximized: detail?.classList.contains('is-mindmap-maximized') || false,
            transform: world?.style.transform || '',
            scale: (world?.style.transform || '').match(/scale\(([\d.]+)\)/)?.[1] || ''
        };
    });
    results.push({ step: 'embedded', embedded });

    assert(embedded.pageViewClass && embedded.detailViewClass, 'is-view-mindmap applied');
    assert(!embedded.maximized, 'not maximized');
    assert(embedded.mindH >= 480, `mindmap height >= 480, got ${embedded.mindH}`);
    assert(embedded.stageH >= 400, `stage height >= 400, got ${embedded.stageH}`);
    assert(embedded.mindH <= embedded.mainH + 4, `mindmap fits main roughly: mind=${embedded.mindH} main=${embedded.mainH}`);
    assert(/scale\(/.test(embedded.transform), `camera fitted: ${embedded.transform}`);
    // 1080p-ish 900vh: expect ~58vh fill ≈ 522+ or clamp floor
    console.log('EMBEDDED', JSON.stringify(embedded, null, 2));
    assert(embedded.stageH > 360, `stage taller than old 360 floor when possible, got ${embedded.stageH}`);

    await page.screenshot({ path: `${OUT}/01-embedded-taller.png`, fullPage: false });

    // switch to list — height chain must release
    await page.locator('#pcGoalViewList').click();
    await page.waitForTimeout(500);
    const listView = await page.evaluate(() => {
        const main = document.querySelector('.pc-main');
        const pageEl = document.querySelector('.pc-page');
        const detail = document.querySelector('.pc-goal-detail-page');
        const mind = document.querySelector('#pcGoalMindmap');
        return {
            pageViewClass: pageEl?.classList.contains('is-view-mindmap') || false,
            detailViewClass: detail?.classList.contains('is-view-mindmap') || false,
            mindHidden: mind?.hidden,
            mainOverflow: main ? getComputedStyle(main).overflowY : '',
            taskItems: document.querySelectorAll('.pc-goal-task-item').length
        };
    });
    results.push({ step: 'listRelease', listView });
    assert(!listView.pageViewClass && !listView.detailViewClass, 'view class removed in list');
    assert(listView.mindHidden === true, 'mindmap hidden in list');
    assert(listView.taskItems >= 1, 'list rendered');

    await page.locator('#pcGoalViewMindmap').click();
    await page.waitForTimeout(900);
    const back = await page.evaluate(() => {
        const mind = document.querySelector('#pcGoalMindmap');
        const stage = document.querySelector('#pcGoalMindmapStage');
        return {
            mindH: mind?.clientHeight || 0,
            stageH: stage?.clientHeight || 0,
            transform: document.querySelector('#pcGoalMindmapWorld')?.style.transform || '',
            viewClass: document.querySelector('.pc-page')?.classList.contains('is-view-mindmap') || false
        };
    });
    results.push({ step: 'backToMindmap', back });
    assert(back.viewClass, 'view class restored');
    assert(back.mindH >= 480, `mindmap height again >= 480, got ${back.mindH}`);
    assert(/scale\(/.test(back.transform), `camera refit: ${back.transform}`);

    await page.screenshot({ path: `${OUT}/02-back-mindmap.png`, fullPage: false });

    // maximize still works and uses viewport height
    await page.locator('#pcGoalMindmapMaximize').click();
    await page.waitForTimeout(700);
    const maxed = await page.evaluate(() => {
        const detail = document.querySelector('.pc-goal-detail-page');
        const mind = document.querySelector('#pcGoalMindmap');
        const stage = document.querySelector('#pcGoalMindmapStage');
        return {
            maximized: detail?.classList.contains('is-mindmap-maximized') || false,
            mindH: mind?.clientHeight || 0,
            stageH: stage?.clientHeight || 0,
            vh: window.innerHeight
        };
    });
    results.push({ step: 'maximize', maxed });
    assert(maxed.maximized, 'maximized class on');
    assert(maxed.mindH >= maxed.vh * 0.85, `maximized mindmap ~viewport: mind=${maxed.mindH} vh=${maxed.vh}`);

    await page.screenshot({ path: `${OUT}/03-maximized.png`, fullPage: false });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const restored = await page.evaluate(() => ({
        maximized: document.querySelector('.pc-goal-detail-page')?.classList.contains('is-mindmap-maximized') || false,
        mindH: document.querySelector('#pcGoalMindmap')?.clientHeight || 0,
        viewClass: document.querySelector('.pc-page')?.classList.contains('is-view-mindmap') || false
    }));
    results.push({ step: 'escRestore', restored });
    assert(!restored.maximized, 'esc exits maximize');
    assert(restored.viewClass && restored.mindH >= 480, `embedded height restored: ${restored.mindH}`);

    console.log('HEIGHT_PASS');
    console.log(JSON.stringify(results, null, 2));
} catch (err) {
    console.error('HEIGHT_FAIL', err);
    console.error(JSON.stringify(results, null, 2));
    await page.screenshot({ path: `${OUT}/fail.png`, fullPage: true }).catch(() => {});
    process.exitCode = 1;
} finally {
    await browser.close();
}
