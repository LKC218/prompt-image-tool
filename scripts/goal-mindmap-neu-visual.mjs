import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const APP = 'http://127.0.0.1:5173/?ui=pc';
const API = 'http://127.0.0.1:8888/api';
const OUT = 'output/playwright/goal-mindmap-neu';
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
            id: 'vm-t1', projectId: project.id, parentId: '',
            title: '增加首次性能基准测试', completed: false, order: 0,
            priority: 'high', status: 'executing', images: [],
            children: [
                { id: 'vm-t1a', projectId: project.id, parentId: 'vm-t1', title: '设置画板增加关闭按钮', completed: false, order: 0, priority: '', status: '', images: [], children: [] },
                { id: 'vm-t1b', projectId: project.id, parentId: 'vm-t1', title: '接入基准测试界面UI', completed: true, order: 1, priority: 'low', status: '', images: [], children: [] }
            ]
        },
        {
            id: 'vm-t2', projectId: project.id, parentId: '',
            title: '增加气泡信息弹窗UI', completed: false, order: 1,
            priority: 'medium', status: '', images: [],
            children: [
                {
                    id: 'vm-t2a', projectId: project.id, parentId: 'vm-t2',
                    title: '文案输出动画效果', completed: true, order: 0,
                    priority: '', status: '', images: [],
                    children: [
                        { id: 'vm-t2a1', projectId: project.id, parentId: 'vm-t2a', title: '逐字出现动画', completed: true, order: 0, priority: '', status: '', images: [], children: [] }
                    ]
                },
                { id: 'vm-t2b', projectId: project.id, parentId: 'vm-t2', title: '气泡UI关闭按钮', completed: false, order: 1, priority: '', status: '', images: [], children: [] }
            ]
        }
    ];
    await api(`/goals/projects/${project.id}/tasks`, {
        method: 'POST',
        body: JSON.stringify({ tasks })
    });
    return project;
}

await mkdir(OUT, { recursive: true });
const project = await seedProject();
console.log('SEEDED', project.id);

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', err => console.log('PAGEERROR', err.message));

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
await page.evaluate(() => {
    document.querySelectorAll('.pc-modal-overlay, #pcModalOverlay').forEach((el) => {
        el.classList.remove('pc-modal-active');
        el.hidden = true;
        el.style.pointerEvents = 'none';
    });
});

const card = page.locator('.pc-goal-project-card').filter({ hasText: PROJECT_NAME }).first();
await card.locator('.pc-goal-project-more').click({ force: true });
await page.waitForTimeout(500);
const menu = page.locator('#pcContextMenu .pc-context-action[data-action="openMindmap"]').first();
if (await menu.count()) await menu.click({ force: true });
else {
    await card.click({ force: true });
    await page.waitForTimeout(800);
    await page.locator('#pcGoalViewMindmap').click();
}
await page.waitForTimeout(1200);

const fit = page.locator('#pcGoalMindmapFit');
if (await fit.count()) await fit.click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/01-neu-mindmap.png`, fullPage: true });

const textureMeta = await page.evaluate(() => {
    const stage = document.querySelector('#pcGoalMindmapStage');
    const cs = getComputedStyle(stage);
    return {
        hasDots: (cs.backgroundImage || '').includes('radial-gradient'),
        bgImage: (cs.backgroundImage || '').slice(0, 120)
    };
});
console.log('TEXTURE_META', JSON.stringify(textureMeta));

const firstNode = page.locator('.pc-goal-mindmap-node:not(.is-root)').first();
const titleBeforeMenu = await firstNode.locator('.pc-goal-mindmap-node-title').textContent().catch(() => '');
await firstNode.click();
await page.waitForTimeout(700);
const menuMeta = await page.evaluate(() => {
    const menu = document.getElementById('pcContextMenu');
    const labels = [...(menu?.querySelectorAll('.pc-context-action') || [])]
        .map(el => el.textContent.replace(/\s+/g, ' ').trim())
        .filter(Boolean);
    return {
        active: menu?.classList.contains('pc-context-active') || false,
        hasToggleComplete: labels.some(t => t.includes('已完成') || t.includes('未完成')),
        hasLocate: labels.some(t => t.includes('在列表中定位')),
        hasPriority: labels.some(t => t.includes('优先级')),
        labelCount: labels.length,
        labels: labels.slice(0, 10)
    };
});
console.log('MENU_META', JSON.stringify(menuMeta, null, 2));
await page.screenshot({ path: `${OUT}/03-node-menu.png`, fullPage: true });

// Bug1: 取消菜单后标题必须恢复，不能被 more-dots 污染
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
const afterCancel = await page.evaluate(() => {
    const node = document.querySelector('.pc-goal-mindmap-node:not(.is-root)');
    return {
        title: node?.querySelector('.pc-goal-mindmap-node-title')?.textContent || '',
        hasMoreDots: !!node?.querySelector('.pc-more-dots'),
        nodeText: node?.textContent?.replace(/\s+/g, ' ').trim() || ''
    };
});
console.log('MENU_CANCEL_META', JSON.stringify({ titleBeforeMenu, ...afterCancel }));
await page.screenshot({ path: `${OUT}/05-menu-cancel-restore.png`, fullPage: true });

// Bug2: 在列表中定位 → 回导图 → 再最大化
const nodeForLocate = page.locator('.pc-goal-mindmap-node:not(.is-root)').first();
await nodeForLocate.click();
await page.locator('#pcContextMenu.pc-context-active').waitFor({ state: 'attached', timeout: 3000 }).catch(() => {});
await page.waitForTimeout(400);
const locateLoc = page.locator('#pcContextMenu .pc-context-action[data-action="locate-list"]');
const locateVisible = await locateLoc.isVisible().catch(() => false);
if (locateVisible) {
    await locateLoc.click({ force: true });
} else {
    await page.evaluate(() => {
        const btn = document.querySelector('#pcContextMenu .pc-context-action[data-action="locate-list"]');
        if (btn) btn.click();
    });
}
await page.waitForTimeout(1200);
const afterLocate = await page.evaluate(() => ({
    menuAction: window.__pcGoalMindmapMenuAction || null,
    viewModeDebug: window.__pcGoalMindmapViewMode || null,
    locatedTask: window.__pcGoalMindmapLocated || null,
    listVisible: !document.querySelector('#pcGoalTaskList')?.hidden,
    mindHidden: document.querySelector('#pcGoalMindmap')?.hidden,
    bodyMax: document.body.classList.contains('pc-goal-mindmap-max-open'),
    pageMax: document.querySelector('.pc-goal-detail-page')?.classList.contains('is-mindmap-maximized'),
    viewListActive: document.querySelector('#pcGoalViewList')?.classList.contains('is-active')
}));
afterLocate.locateVisible = locateVisible;
console.log('AFTER_LOCATE', JSON.stringify(afterLocate));
await page.locator('#pcGoalViewMindmap').click();
await page.waitForTimeout(800);
await page.locator('#pcGoalMindmapMaximize').click();
await page.waitForTimeout(700);
const remaxMeta = await page.evaluate(() => {
    const pageEl = document.querySelector('.pc-goal-detail-page');
    const cs = pageEl ? getComputedStyle(pageEl) : null;
    return {
        pageMaxClass: pageEl?.classList.contains('is-mindmap-maximized') || false,
        bodyMax: document.body.classList.contains('pc-goal-mindmap-max-open'),
        position: cs?.position || '',
        zIndex: cs?.zIndex || '',
        btnText: document.querySelector('#pcGoalMindmapMaximize')?.textContent?.trim() || '',
        width: pageEl?.getBoundingClientRect().width || 0,
        height: pageEl?.getBoundingClientRect().height || 0,
        viewportW: window.innerWidth,
        viewportH: window.innerHeight
    };
});
console.log('REMAX_META', JSON.stringify(remaxMeta, null, 2));
await page.screenshot({ path: `${OUT}/06-remaximize-after-locate.png`, fullPage: true });
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

const nodesBeforeFilter = await page.locator('.pc-goal-mindmap-node').count();
const onlyOpen = page.locator('#pcGoalMindmapOnlyOpen');
await onlyOpen.click();
await page.waitForTimeout(60);
const flipMeta = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('.pc-goal-mindmap-node')];
    const entering = nodes.filter(n => n.classList.contains('is-entering')).length;
    const withTransition = nodes.filter(n => (n.style.transition || '').includes('transform')).length;
    return {
        entering,
        withTransition,
        nodes: nodes.length,
        sampleTransition: nodes.map(n => n.style.transition).find(Boolean) || ''
    };
});
await page.waitForTimeout(400);
const nodesAfterFilter = await page.locator('.pc-goal-mindmap-node').count();
console.log('FLIP_META', JSON.stringify({ nodesBeforeFilter, nodesAfterFilter, ...flipMeta }));
await page.screenshot({ path: `${OUT}/04-filter-flip.png`, fullPage: true });
await onlyOpen.click();
await page.waitForTimeout(350);

const styleMeta = await page.evaluate(() => {
    const stage = document.querySelector('#pcGoalMindmapStage');
    const node = document.querySelector('.pc-goal-mindmap-node');
    const statusTodo = document.querySelector('.pc-goal-mindmap-status.is-todo') || document.querySelector('.pc-goal-mindmap-status');
    const progress = document.querySelector('.pc-goal-mindmap-progress');
    const legend = document.querySelector('.pc-goal-mindmap-legend');
    const zoom = document.querySelector('#pcGoalMindmapZoom');
    const world = document.querySelector('#pcGoalMindmapWorld');
    const cs = (el) => el ? getComputedStyle(el) : null;
    const stageCs = cs(stage);
    const nodeCs = cs(node);
    const todoCs = cs(statusTodo);
    const progressCs = cs(progress);
    const legendCs = cs(legend);
    const afterCs = stage ? getComputedStyle(stage, '::after') : null;
    const afterBg = afterCs?.backgroundImage || afterCs?.background || '';
    return {
        nodes: document.querySelectorAll('.pc-goal-mindmap-node').length,
        stageInset: (stageCs?.boxShadow || '').includes('inset'),
        nodeRaised: (nodeCs?.boxShadow || '').includes('rgb'),
        todoInset: (todoCs?.boxShadow || '').includes('inset'),
        progressInset: (progressCs?.boxShadow || '').includes('inset'),
        legendExists: !!legend,
        legendRaised: (legendCs?.boxShadow || '').includes('rgb') && !(legendCs?.boxShadow || '').includes('inset'),
        legendZ: legendCs?.zIndex || '',
        legendWrap: (legendCs?.flexWrap || '') === 'wrap',
        legendOverflowX: legendCs?.overflowX || '',
        legendSpans: legend?.querySelectorAll(':scope > span').length || 0,
        zoomInset: (cs(zoom)?.boxShadow || '').includes('inset'),
        hardWhiteBorder: nodeCs && nodeCs.borderTopWidth !== '0px' && nodeCs.borderTopStyle !== 'none',
        featherAfterContent: afterCs?.content || '',
        featherGradients: (afterBg.match(/linear-gradient/g) || []).length,
        featherPointerNone: (afterCs?.pointerEvents || '') === 'none',
        featherZ: afterCs?.zIndex || '',
        worldTransform: world?.style.transform || ''
    };
});
console.log('NEU_META', JSON.stringify(styleMeta, null, 2));

// 相机动画：先平移相机，再点「适应画布」，观察过渡中的 transform 变化
await page.evaluate(() => {
    const world = document.querySelector('#pcGoalMindmapWorld');
    if (world) world.style.transform = 'translate(20px, 20px) scale(0.5)';
});
const camBefore = await page.evaluate(() => document.querySelector('#pcGoalMindmapWorld')?.style.transform || '');
await page.locator('#pcGoalMindmapReset').click();
await page.waitForTimeout(60);
const camMid = await page.evaluate(() => document.querySelector('#pcGoalMindmapWorld')?.style.transform || '');
await page.waitForTimeout(450);
const camEnd = await page.evaluate(() => document.querySelector('#pcGoalMindmapWorld')?.style.transform || '');
const camMeta = {
    camBefore,
    camMid,
    camEnd,
    midDiffers: camMid !== camBefore,
    endDiffers: camEnd !== camBefore,
    animated: camMid !== camEnd && camEnd !== camBefore
};
console.log('CAM_META', JSON.stringify(camMeta));
await page.screenshot({ path: `${OUT}/07-camera-fit.png`, fullPage: true });

// 图例布局
const legendMeta = await page.evaluate(() => {
    const legend = document.querySelector('.pc-goal-mindmap-legend');
    if (!legend) return null;
    const spans = [...legend.querySelectorAll(':scope > span')];
    const rects = spans.map(s => s.getBoundingClientRect());
    let overlaps = 0;
    for (let i = 0; i < rects.length; i += 1) {
        for (let j = i + 1; j < rects.length; j += 1) {
            const a = rects[i];
            const b = rects[j];
            const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            if (overlapX > 2 && overlapY > 2) overlaps += 1;
        }
    }
    return {
        spanCount: spans.length,
        overlaps,
        legendHeight: legend.getBoundingClientRect().height,
        zIndex: getComputedStyle(legend).zIndex
    };
});
console.log('LEGEND_META', JSON.stringify(legendMeta));

await page.locator('#pcGoalMindmapMaximize').click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/02-neu-maximized.png`, fullPage: true });
const maxOn = await page.evaluate(() => document.querySelector('.pc-goal-detail-page')?.classList.contains('is-mindmap-maximized'));
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

const pass = styleMeta.nodes > 0
    && styleMeta.stageInset
    && styleMeta.nodeRaised
    && styleMeta.todoInset
    && styleMeta.progressInset
    && styleMeta.legendExists
    && styleMeta.legendRaised
    && styleMeta.zoomInset
    && styleMeta.hardWhiteBorder === false
    && styleMeta.featherGradients >= 4
    && styleMeta.featherPointerNone === true
    && legendMeta
    && legendMeta.overlaps === 0
    && legendMeta.spanCount >= 5
    && Number(legendMeta.zIndex) >= 2
    && camMeta.endDiffers === true
    && (camMeta.animated === true || camMeta.midDiffers === true)
    && textureMeta.hasDots
    && menuMeta.active === true
    && menuMeta.hasToggleComplete
    && menuMeta.hasLocate
    && menuMeta.hasPriority
    && afterCancel.hasMoreDots === false
    && (afterCancel.title || '').length > 0
    && afterCancel.title !== '...'
    && afterLocate.viewModeDebug === 'list'
    && afterLocate.listVisible === true
    && afterLocate.viewListActive === true
    && remaxMeta.pageMaxClass === true
    && remaxMeta.bodyMax === true
    && remaxMeta.position === 'fixed'
    && remaxMeta.btnText.includes('退出')
    && remaxMeta.width >= remaxMeta.viewportW * 0.9
    && remaxMeta.height >= remaxMeta.viewportH * 0.9
    && nodesAfterFilter < nodesBeforeFilter
    && (flipMeta.entering > 0 || flipMeta.withTransition > 0)
    && maxOn === true;

console.log(pass ? 'VISUAL_PASS' : 'VISUAL_FAIL');
await browser.close();
process.exit(pass ? 0 : 1);
