import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const APP = 'http://127.0.0.1:5173/?ui=pc';
const API = 'http://127.0.0.1:8888/api';
const OUT = 'output/playwright/goal-view-switch';
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
let project = (projects || []).find(p => p.name === PROJECT_NAME);
if (!project) {
    project = await api('/goals/projects', {
        method: 'POST',
        body: JSON.stringify({ name: PROJECT_NAME })
    });
}
const tasks = [
    {
        id: 'vs-t1', projectId: project.id, parentId: '',
        title: '根任务A', completed: false, order: 0,
        priority: 'high', status: 'executing', images: [],
        children: [
            {
                id: 'vs-t1a', projectId: project.id, parentId: 'vs-t1',
                title: '子任务A1', completed: false, order: 0,
                priority: '', status: '', images: [], children: []
            }
        ]
    },
    {
        id: 'vs-t2', projectId: project.id, parentId: '',
        title: '根任务B', completed: false, order: 1,
        priority: 'medium', status: '', images: [],
        children: []
    }
];
await api(`/goals/projects/${project.id}/tasks`, {
    method: 'POST',
    body: JSON.stringify({ tasks })
});
console.log('SEEDED', project.id);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', err => console.log('PAGEERROR', err.message));
const results = [];

function clearOverlays() {
    return page.evaluate(() => {
        document.querySelectorAll('.pc-modal-overlay, #pcModalOverlay').forEach((el) => {
            el.classList.remove('pc-modal-active');
            el.hidden = true;
            el.style.pointerEvents = 'none';
        });
    });
}

try {
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1600);
    await clearOverlays();

    // 深链：history params.view=mindmap
    await page.locator('.pc-sidebar-nav').getByText('目标计划').first().click();
    await page.waitForTimeout(1000);
    await clearOverlays();

    await page.evaluate((id) => {
        const state = {
            view: 'pc',
            path: '/goals/' + id,
            params: { id, view: 'mindmap' },
            stack: [{ path: '/goals', params: {}, routeKey: '/goals' }]
        };
        window.history.pushState(state, '');
        window.dispatchEvent(new PopStateEvent('popstate', { state }));
    }, project.id);
    await page.waitForTimeout(1400);

    const deepLink = await page.evaluate(() => {
        const mind = document.querySelector('#pcGoalMindmap');
        const list = document.querySelector('#pcGoalTaskList');
        return {
            viewMode: window.__pcGoalMindmapViewMode || null,
            mindHidden: mind ? mind.hidden : null,
            listHidden: list ? list.hidden : null,
            mindDisplay: mind ? getComputedStyle(mind).display : null,
            listDisplay: list ? getComputedStyle(list).display : null,
            mindTabActive: document.querySelector('#pcGoalViewMindmap')?.classList.contains('is-active') || false,
            nodeCount: document.querySelectorAll('.pc-goal-mindmap-node').length,
            routeView: window.history.state?.params?.view || null,
            routePath: window.history.state?.path || ''
        };
    });
    results.push({ step: 'deepLinkMindmap', deepLink });
    assert(deepLink.mindHidden === false, `mindmap visible, got hidden=${deepLink.mindHidden}`);
    assert(deepLink.listHidden === true, `list hidden, got hidden=${deepLink.listHidden}`);
    assert(deepLink.mindDisplay !== 'none', `mindmap display not none, got ${deepLink.mindDisplay}`);
    assert(deepLink.listDisplay === 'none', `list display none, got ${deepLink.listDisplay}`);
    assert(deepLink.mindTabActive, 'mindmap tab active');
    assert(deepLink.nodeCount >= 3, `mindmap nodes >= 3, got ${deepLink.nodeCount}`);
    assert(
        deepLink.routeView === 'mindmap' || deepLink.viewMode === 'mindmap',
        `route/view mindmap, routeView=${deepLink.routeView} viewMode=${deepLink.viewMode}`
    );

    await page.screenshot({ path: `${OUT}/01-deep-link-mindmap.png`, fullPage: true });

    await page.waitForTimeout(700);
    const camera = await page.evaluate(() => {
        const world = document.querySelector('#pcGoalMindmapWorld');
        const stage = document.querySelector('#pcGoalMindmapStage');
        return {
            transform: world?.style.transform || '',
            stageW: stage?.clientWidth || 0,
            stageH: stage?.clientHeight || 0
        };
    });
    results.push({ step: 'camera', camera });
    assert(camera.stageW > 100 && camera.stageH > 100, `stage size real: ${camera.stageW}x${camera.stageH}`);
    assert(/scale\(/.test(camera.transform), `world has scale, got ${camera.transform}`);

    // 2) 切回列表
    await page.locator('#pcGoalViewList').click();
    await page.waitForTimeout(500);
    const listView = await page.evaluate(() => {
        const mind = document.querySelector('#pcGoalMindmap');
        const list = document.querySelector('#pcGoalTaskList');
        return {
            mindHidden: mind?.hidden,
            listHidden: list?.hidden,
            mindDisplay: mind ? getComputedStyle(mind).display : null,
            listDisplay: list ? getComputedStyle(list).display : null,
            listTabActive: document.querySelector('#pcGoalViewList')?.classList.contains('is-active') || false,
            routeView: window.history.state?.params?.view || null,
            taskItems: document.querySelectorAll('.pc-goal-task-item').length
        };
    });
    results.push({ step: 'switchList', listView });
    assert(listView.listHidden === false, 'list visible');
    assert(listView.mindHidden === true, 'mindmap hidden');
    assert(listView.listDisplay !== 'none', `list display not none: ${listView.listDisplay}`);
    assert(listView.mindDisplay === 'none', `mindmap display none: ${listView.mindDisplay}`);
    assert(listView.listTabActive, 'list tab active');
    assert(listView.taskItems >= 2, `task items >= 2, got ${listView.taskItems}`);
    assert(listView.routeView === 'list', `route view list, got ${listView.routeView}`);

    await page.screenshot({ path: `${OUT}/02-switch-list.png`, fullPage: true });

    // 3) 选中任务 → 点思维导图 → focus 对应节点
    const firstTaskId = await page.evaluate(() => {
        return document.querySelector('.pc-goal-task-item[data-task-id="vs-t1"]')?.dataset.taskId
            || document.querySelector('.pc-goal-task-item[data-task-id]')?.dataset.taskId
            || '';
    });
    assert(firstTaskId, 'has task id');
    await page.locator(`.pc-goal-task-item[data-task-id="${firstTaskId}"] > .pc-goal-task-row .pc-goal-task-title`).click();
    await page.waitForTimeout(150);
    await page.locator('#pcGoalViewMindmap').click();
    await page.waitForTimeout(800);

    const focused = await page.evaluate((taskId) => {
        const mind = document.querySelector('#pcGoalMindmap');
        const list = document.querySelector('#pcGoalTaskList');
        const node = document.querySelector(`.pc-goal-mindmap-node[data-node-id="${taskId}"]`);
        return {
            mindHidden: mind?.hidden,
            listHidden: list?.hidden,
            mindDisplay: mind ? getComputedStyle(mind).display : null,
            focus: window.__pcGoalMindmapFocus || '',
            nodeExists: !!node,
            nodeSelected: node?.classList.contains('is-selected') || false,
            routeView: window.history.state?.params?.view || null,
            worldTransform: document.querySelector('#pcGoalMindmapWorld')?.style.transform || ''
        };
    }, firstTaskId);
    results.push({ step: 'focusFromList', focused, firstTaskId });
    assert(focused.mindHidden === false, 'mindmap visible');
    assert(focused.listHidden === true, 'list hidden');
    assert(focused.mindDisplay !== 'none', 'mindmap display not none');
    assert(focused.nodeExists, 'target node exists');
    assert(
        focused.focus === firstTaskId || focused.nodeSelected,
        `focus target ${firstTaskId}, focus=${focused.focus} selected=${focused.nodeSelected}`
    );
    assert(focused.routeView === 'mindmap', `route view mindmap, got ${focused.routeView}`);
    assert(/scale\(/.test(focused.worldTransform), `camera transform after focus: ${focused.worldTransform}`);

    await page.screenshot({ path: `${OUT}/03-focus-node.png`, fullPage: true });

    // 4) 列表菜单「在导图中定位」
    await page.locator('#pcGoalViewList').click();
    await page.waitForTimeout(400);
    await page.locator(`.pc-goal-task-item[data-task-id="${firstTaskId}"] > .pc-goal-task-row [data-action="more"]`).click();
    await page.waitForTimeout(400);
    const locateItem = page.locator('#pcContextMenu .pc-context-action[data-action="locate-mindmap"]');
    assert(await locateItem.count(), 'locate-mindmap menu exists');
    await locateItem.click();
    await page.waitForTimeout(800);

    const located = await page.evaluate((taskId) => {
        const mind = document.querySelector('#pcGoalMindmap');
        const node = document.querySelector(`.pc-goal-mindmap-node[data-node-id="${taskId}"]`);
        return {
            mindHidden: mind?.hidden,
            mindDisplay: mind ? getComputedStyle(mind).display : null,
            focus: window.__pcGoalMindmapFocus || '',
            locatedDebug: window.__pcGoalMindmapLocated || '',
            nodeSelected: node?.classList.contains('is-selected') || false,
            routeView: window.history.state?.params?.view || null
        };
    }, firstTaskId);
    results.push({ step: 'locateMindmapMenu', located, firstTaskId });
    assert(located.mindHidden === false, 'mindmap visible after locate');
    assert(located.mindDisplay !== 'none', 'mindmap display not none after locate');
    assert(
        located.locatedDebug === firstTaskId || located.focus === firstTaskId || located.nodeSelected,
        `locate target, debug=${located.locatedDebug} focus=${located.focus} selected=${located.nodeSelected}`
    );

    await page.screenshot({ path: `${OUT}/04-locate-from-list.png`, fullPage: true });

    // 5) 再点「思维导图」tab：强制 refit
    await page.locator('#pcGoalViewMindmap').click();
    await page.waitForTimeout(700);
    const refit = await page.evaluate(() => {
        const world = document.querySelector('#pcGoalMindmapWorld');
        return {
            transform: world?.style.transform || '',
            nodeCount: document.querySelectorAll('.pc-goal-mindmap-node').length,
            mindDisplay: getComputedStyle(document.querySelector('#pcGoalMindmap')).display,
            listDisplay: getComputedStyle(document.querySelector('#pcGoalTaskList')).display
        };
    });
    results.push({ step: 'reclickMindmapTab', refit });
    assert(refit.nodeCount >= 3, `nodes remain after reclick, got ${refit.nodeCount}`);
    assert(/scale\(/.test(refit.transform), `scale after reclick: ${refit.transform}`);
    assert(refit.mindDisplay !== 'none' && refit.listDisplay === 'none', 'mindmap still active after reclick');

    await page.screenshot({ path: `${OUT}/05-reclick-mindmap.png`, fullPage: true });

    console.log('VIEW_SWITCH_PASS');
    console.log(JSON.stringify(results, null, 2));
} catch (err) {
    console.error('VIEW_SWITCH_FAIL', err);
    console.error(JSON.stringify(results, null, 2));
    await page.screenshot({ path: `${OUT}/fail.png`, fullPage: true }).catch(() => {});
    process.exitCode = 1;
} finally {
    await browser.close();
}
