import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const APP = 'http://127.0.0.1:5173/?ui=pc';
const API = 'http://127.0.0.1:8888/api';
const OUT = 'output/playwright/goal-mindmap';
const PROJECT_NAME = '视觉验证-思维导图';

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

async function seedProject() {
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
            id: 'vm-t1',
            projectId: project.id,
            parentId: '',
            title: '增加首次性能基准测试',
            completed: false,
            order: 0,
            priority: 'high',
            status: 'executing',
            images: [],
            children: [
                {
                    id: 'vm-t1a', projectId: project.id, parentId: 'vm-t1',
                    title: '设置画板增加关闭按钮', completed: false, order: 0,
                    priority: '', status: '', images: [], children: []
                },
                {
                    id: 'vm-t1b', projectId: project.id, parentId: 'vm-t1',
                    title: '接入基准测试界面UI', completed: true, order: 1,
                    priority: 'low', status: '', images: [], children: []
                }
            ]
        },
        {
            id: 'vm-t2',
            projectId: project.id,
            parentId: '',
            title: '增加气泡信息弹窗UI',
            completed: false,
            order: 1,
            priority: 'medium',
            status: '',
            images: [],
            children: [
                {
                    id: 'vm-t2a', projectId: project.id, parentId: 'vm-t2',
                    title: '文案输出动画效果', completed: true, order: 0,
                    priority: '', status: '', images: [],
                    children: [
                        {
                            id: 'vm-t2a1', projectId: project.id, parentId: 'vm-t2a',
                            title: '逐字出现动画', completed: true, order: 0,
                            priority: '', status: '', images: [], children: []
                        }
                    ]
                },
                {
                    id: 'vm-t2b', projectId: project.id, parentId: 'vm-t2',
                    title: '气泡UI关闭按钮', completed: false, order: 1,
                    priority: '', status: '', images: [], children: []
                }
            ]
        }
    ];
    await api(`/goals/projects/${project.id}/tasks`, {
        method: 'POST',
        body: JSON.stringify({ tasks })
    });
    return project;
}

function findProjectCard(page, name) {
    return page.locator('.pc-goal-project-card').filter({ hasText: name }).first();
}

await mkdir(OUT, { recursive: true });
const project = await seedProject();
console.log('SEEDED', project.id, project.name);

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', err => console.log('PAGEERROR', err.message));
page.on('console', msg => {
    if (msg.type() === 'error') console.log('CONSOLE', msg.text());
});

await page.goto(APP, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
await page.evaluate(() => {
    document.querySelectorAll('.pc-modal-overlay, #pcModalOverlay').forEach((el) => {
        el.classList.remove('pc-modal-active');
        el.hidden = true;
        el.style.pointerEvents = 'none';
    });
});
await page.screenshot({ path: `${OUT}/01-home.png`, fullPage: true });

// 侧栏进入目标计划
await page.locator('.pc-sidebar-nav').getByText('目标计划').first().click();
await page.waitForTimeout(1200);
await page.evaluate(() => {
    document.querySelectorAll('.pc-modal-overlay, #pcModalOverlay').forEach((el) => {
        el.classList.remove('pc-modal-active');
        el.hidden = true;
        el.style.pointerEvents = 'none';
    });
});
await page.screenshot({ path: `${OUT}/02-goals-list.png`, fullPage: true });

const card = findProjectCard(page, PROJECT_NAME);
if (!(await card.count())) {
    // wait a bit more for async load
    await page.waitForTimeout(1500);
}
const cardCount = await findProjectCard(page, PROJECT_NAME).count();
console.log('CARD_COUNT', cardCount);
if (!cardCount) {
    const bodyText = await page.locator('body').innerText();
    console.log('BODY_SNIP', bodyText.slice(0, 500));
    await browser.close();
    process.exit(1);
}

// 卡片菜单 → 查看思维导图
const more = findProjectCard(page, PROJECT_NAME).locator('.pc-goal-project-more');
await more.click({ force: true });
await page.waitForTimeout(500);
let menuItems = await page.locator('#pcContextMenu .pc-context-action').allTextContents();
if (!menuItems.length) {
    await more.click({ force: true });
    await page.waitForTimeout(500);
    menuItems = await page.locator('#pcContextMenu .pc-context-action').allTextContents();
}
const menuHtml = await page.evaluate(() => {
    const menu = document.getElementById('pcContextMenu');
    return {
        exists: !!menu,
        className: menu?.className || '',
        html: menu?.innerHTML?.slice(0, 200) || '',
        active: menu?.classList.contains('pc-context-active')
    };
});
console.log('MENU_DEBUG', JSON.stringify(menuHtml, null, 2));
console.log('MENU_ITEMS', JSON.stringify(menuItems));
await page.screenshot({ path: `${OUT}/03-project-menu.png`, fullPage: true });

const mindmapMenuItem = page.locator('#pcContextMenu .pc-context-action[data-action="openMindmap"]').first();
if (await mindmapMenuItem.count()) {
    await mindmapMenuItem.click({ force: true });
    await page.waitForTimeout(1600);
} else {
    console.log('MENU item missing, fallback to card click + view switch');
    await page.keyboard.press('Escape');
    await findProjectCard(page, PROJECT_NAME).click({ force: true });
    await page.waitForTimeout(1600);
    const tab = page.locator('#pcGoalViewMindmap');
    if (await tab.count()) {
        await tab.click();
        await page.waitForTimeout(700);
    }
}
await page.evaluate(() => {
    document.querySelectorAll('.pc-modal-overlay, #pcModalOverlay').forEach((el) => {
        el.classList.remove('pc-modal-active');
        el.hidden = true;
        el.style.pointerEvents = 'none';
    });
});
await page.screenshot({ path: `${OUT}/04-mindmap-from-menu.png`, fullPage: true });

const meta = await page.evaluate(() => {
    const root = document.querySelector('#pcGoalMindmap');
    const paths = [...(root?.querySelectorAll('.pc-goal-mindmap-edge.is-hierarchy') || [])];
    const strokes = new Set(paths.map(p => p.getAttribute('stroke')).filter(Boolean));
    const ortho = paths.filter(p => (p.getAttribute('d') || '').includes('Q')).length;
    const nodes = [...(root?.querySelectorAll('.pc-goal-mindmap-node') || [])];
    return {
        title: document.querySelector('#pcGoalDetailTitle')?.textContent || '',
        nodes: nodes.length,
        statusTodo: nodes.filter(n => n.dataset.status === 'todo' || n.querySelector('.pc-goal-mindmap-status.is-todo')).length,
        statusDone: nodes.filter(n => n.dataset.status === 'done' || n.querySelector('.pc-goal-mindmap-status.is-done')).length,
        statusDoing: nodes.filter(n => n.dataset.status === 'doing' || n.querySelector('.pc-goal-mindmap-status.is-doing')).length,
        progressBadges: root?.querySelectorAll('.pc-goal-mindmap-progress').length || 0,
        priorityBadges: root?.querySelectorAll('.pc-goal-mindmap-priority-badge').length || 0,
        hierarchyEdges: paths.length,
        orthoEdges: ortho,
        branchStrokeCount: strokes.size,
        relationEdges: root?.querySelectorAll('.pc-goal-mindmap-edge.is-relation').length || 0,
        viewActive: document.querySelector('#pcGoalViewMindmap')?.classList.contains('is-active'),
        mindHidden: document.querySelector('#pcGoalMindmap')?.hidden,
        listHidden: document.querySelector('#pcGoalTaskList')?.hidden,
        openViewKey: localStorage.getItem('pc-goal-detail-open-view')
    };
});
console.log('MINDMAP_META', JSON.stringify(meta, null, 2));

if (!meta.nodes) {
    console.log('FAIL: no mindmap nodes rendered');
    await browser.close();
    process.exit(1);
}

// 关联模式
await page.locator('#pcGoalMindmapLinkMode').click();
await page.waitForTimeout(200);
await page.locator('.pc-goal-mindmap-node[data-node-id="vm-t1a"]').click();
await page.waitForTimeout(200);
await page.locator('.pc-goal-mindmap-node[data-node-id="vm-t2b"]').click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/05-mindmap-with-relation.png`, fullPage: true });

const afterLink = await page.evaluate(() => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('pc-goal-mindmap-links:'));
    const values = {};
    for (const k of keys) values[k] = localStorage.getItem(k);
    return {
        relations: document.querySelectorAll('#pcGoalMindmap .pc-goal-mindmap-edge.is-relation').length,
        values
    };
});
console.log('AFTER_LINK', JSON.stringify(afterLink));

// 切回列表
await page.locator('#pcGoalViewList').click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/06-list-view.png`, fullPage: true });
const listMeta = await page.evaluate(() => ({
    listHidden: document.querySelector('#pcGoalTaskList')?.hidden,
    mindHidden: document.querySelector('#pcGoalMindmap')?.hidden,
    tasks: document.querySelectorAll('.pc-goal-task-item').length
}));
console.log('LIST_META', JSON.stringify(listMeta));

// 再进导图，验证最大化
await page.locator('#pcGoalViewMindmap').click();
await page.waitForTimeout(600);
const fitBtn = page.locator('#pcGoalMindmapFit');
if (await fitBtn.count()) await fitBtn.click();
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/09-status-semantics.png`, fullPage: true });

// 只看未完成
const onlyOpen = page.locator('#pcGoalMindmapOnlyOpen');
let filterMeta = { nodesBefore: meta.nodes, nodesAfter: null };
if (await onlyOpen.count()) {
    await onlyOpen.click();
    await page.waitForTimeout(500);
    filterMeta.nodesAfter = await page.locator('.pc-goal-mindmap-node').count();
    filterMeta.doneAfter = await page.locator('.pc-goal-mindmap-node[data-status="done"]').count();
    await page.screenshot({ path: `${OUT}/10-only-open.png`, fullPage: true });
    await onlyOpen.click();
    await page.waitForTimeout(300);
}
console.log('FILTER_META', JSON.stringify(filterMeta));

const zoomBefore = await page.locator('#pcGoalMindmapZoom').textContent().catch(() => '');
await page.locator('#pcGoalMindmapMaximize').click();
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/07-mindmap-maximized.png`, fullPage: true });
const maxMeta = await page.evaluate(() => {
    const pageEl = document.querySelector('.pc-goal-detail-page');
    const mind = document.querySelector('#pcGoalMindmap');
    const stage = document.querySelector('#pcGoalMindmapStage');
    return {
        maximizedClass: pageEl?.classList.contains('is-mindmap-maximized'),
        mindMax: mind?.classList.contains('is-maximized'),
        zoom: document.querySelector('#pcGoalMindmapZoom')?.textContent || '',
        stageH: stage?.getBoundingClientRect().height || stage?.clientHeight || 0,
        mindH: mind?.getBoundingClientRect().height || 0,
        bodyLocked: document.body.classList.contains('pc-goal-mindmap-max-open')
    };
});
console.log('MAX_META', JSON.stringify({ zoomBefore, ...maxMeta }));
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
const maxAfterEsc = await page.evaluate(() => ({
    maximizedClass: document.querySelector('.pc-goal-detail-page')?.classList.contains('is-mindmap-maximized'),
    mindMax: document.querySelector('#pcGoalMindmap')?.classList.contains('is-maximized'),
    bodyLocked: document.body.classList.contains('pc-goal-mindmap-max-open'),
    zoom: document.querySelector('#pcGoalMindmapZoom')?.textContent || ''
}));
console.log('MAX_AFTER_ESC', JSON.stringify(maxAfterEsc));
await page.screenshot({ path: `${OUT}/08-after-esc.png`, fullPage: true });

const pass = meta.nodes > 0
    && meta.hierarchyEdges >= 6
    && meta.orthoEdges >= 5
    && meta.orthoEdges <= meta.hierarchyEdges
    && meta.branchStrokeCount >= 2
    && meta.statusTodo >= 1
    && meta.statusDone >= 1
    && meta.progressBadges >= 2
    && meta.priorityBadges >= 1
    && meta.viewActive
    && meta.mindHidden === false
    && meta.listHidden === true
    && afterLink.relations >= 1
    && listMeta.listHidden === false
    && listMeta.tasks >= 6
    && (filterMeta.nodesAfter == null || filterMeta.nodesAfter < filterMeta.nodesBefore)
    && maxMeta.maximizedClass === true
    && maxMeta.mindMax === true
    && (maxMeta.stageH > 300 || maxMeta.mindH > 400)
    && maxAfterEsc.maximizedClass === false
    && maxAfterEsc.mindMax === false
    && maxAfterEsc.bodyLocked === false
    && Boolean(maxMeta.zoom);

console.log(pass ? 'VISUAL_PASS' : 'VISUAL_FAIL');
await browser.close();
process.exit(pass ? 0 : 1);
