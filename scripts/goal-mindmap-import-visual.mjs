import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';

const APP = 'http://127.0.0.1:5173/?ui=pc';
const API = 'http://127.0.0.1:8888/api';
const OUT = 'output/playwright/goal-mindmap-import';
const PROJECT_NAME = '视觉验证-导图导入图片';

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

function makeTinyPng() {
    const png = new PNG({ width: 8, height: 8 });
    for (let i = 0; i < png.data.length; i += 4) {
        png.data[i] = 30;
        png.data[i + 1] = 144;
        png.data[i + 2] = 255;
        png.data[i + 3] = 255;
    }
    return PNG.sync.write(png);
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
            id: 'vi-t1',
            projectId: project.id,
            parentId: '',
            title: '导入图片验证节点',
            completed: false,
            order: 0,
            priority: 'high',
            status: '',
            images: [],
            children: [
                {
                    id: 'vi-t1a',
                    projectId: project.id,
                    parentId: 'vi-t1',
                    title: '子任务可导入',
                    completed: false,
                    order: 0,
                    priority: '',
                    status: '',
                    images: [],
                    children: []
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
console.log('SEEDED', project.id);

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

await page.locator('.pc-sidebar-nav').getByText('目标计划').first().click();
await page.waitForTimeout(1500);
await page.evaluate(() => {
    document.querySelectorAll('.pc-modal-overlay, #pcModalOverlay').forEach((el) => {
        el.classList.remove('pc-modal-active');
        el.hidden = true;
        el.style.pointerEvents = 'none';
    });
});

const more = findProjectCard(page, PROJECT_NAME).locator('.pc-goal-project-more');
await more.click({ force: true });
await page.waitForTimeout(500);
const mindmapMenuItem = page.locator('#pcContextMenu .pc-context-action[data-action="openMindmap"]').first();
if (await mindmapMenuItem.count()) {
    await mindmapMenuItem.click({ force: true });
} else {
    await page.keyboard.press('Escape');
    await findProjectCard(page, PROJECT_NAME).click({ force: true });
    await page.waitForTimeout(1200);
    await page.locator('#pcGoalViewMindmap').click();
}
await page.waitForTimeout(1600);

const toolbarImport = page.locator('#pcGoalMindmapImportImage');
const nodeAddCount = await page.locator('.pc-goal-mindmap-image-add').count();
const toolbarImportCount = await toolbarImport.count();
console.log('BUTTONS', JSON.stringify({ toolbarImportCount, nodeAddCount }));
await page.screenshot({ path: `${OUT}/01-import-buttons.png`, fullPage: true });

// 工具栏未选中节点 → toast
await toolbarImport.click();
await page.waitForTimeout(400);
const toastNoSelect = await page.locator('.pc-toast, .pc-toast-message, #pcToast').allTextContents().catch(() => []);
console.log('TOAST_NO_SELECT', JSON.stringify(toastNoSelect));

// 节点 + 按钮 → file chooser → 导入
const nodeAdd = page.locator('.pc-goal-mindmap-image-add').first();
const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    nodeAdd.click()
]);
await chooser.setFiles({
    name: 'mindmap-import-test.png',
    mimeType: 'image/png',
    buffer: makeTinyPng()
});
await page.waitForTimeout(1800);

const afterImport = await page.evaluate(() => ({
    imageButtons: document.querySelectorAll('.pc-goal-mindmap-image').length,
    imageAddButtons: document.querySelectorAll('.pc-goal-mindmap-image-add').length,
    hasThumb: !!document.querySelector('.pc-goal-mindmap-image img[src]')
}));
console.log('AFTER_IMPORT', JSON.stringify(afterImport));
await page.screenshot({ path: `${OUT}/02-after-import.png`, fullPage: true });

// 右键菜单含导入图片
const firstNode = page.locator('.pc-goal-mindmap-node').filter({ hasNot: page.locator('.is-root') }).first();
// 点击非根节点打开菜单
const leaf = page.locator('.pc-goal-mindmap-node:not(.is-root)').first();
await leaf.click({ position: { x: 12, y: 12 } });
await page.waitForTimeout(400);
const menuItems = await page.locator('#pcContextMenu .pc-context-action').allTextContents();
const hasImport = menuItems.some(t => t.includes('导入图片'));
const hasManager = menuItems.some(t => t.includes('图片管理'));
console.log('MENU', JSON.stringify({ menuItems, hasImport, hasManager }));
await page.screenshot({ path: `${OUT}/03-node-menu.png`, fullPage: true });

const pass = toolbarImportCount >= 1
    && nodeAddCount >= 2
    && afterImport.imageButtons >= 1
    && afterImport.hasThumb
    && hasImport
    && hasManager;

await writeFile(`${OUT}/result.json`, JSON.stringify({
    toolbarImportCount,
    nodeAddCount,
    toastNoSelect,
    afterImport,
    menuItems,
    hasImport,
    hasManager,
    pass
}, null, 2));

console.log(pass ? 'IMPORT_VISUAL_PASS' : 'IMPORT_VISUAL_FAIL');
await browser.close();
process.exit(pass ? 0 : 1);
