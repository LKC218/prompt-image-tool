import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'http://localhost:5173';
const OUT = 'scripts/.verify-out';

async function main() {
    fs.mkdirSync(OUT, { recursive: true });

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

    const logs = [];
    page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
    page.on('pageerror', err => logs.push(`[pageerror] ${err.message}`));

    await page.goto(`${BASE}/?ui=pc`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    // 等 splash 消失 + app 挂载
    await page.waitForSelector('#pcApp', { state: 'visible', timeout: 15000 });
    await page.waitForTimeout(1000);

    // 通过侧栏进入目标计划
    const goalsNav = page.locator('[data-nav="/goals"]');
    if (await goalsNav.count()) {
        await goalsNav.click();
    } else {
        // 兜底：直接调用路由
        await page.evaluate(() => {
            const btn = document.querySelector('[data-nav="/goals"]');
            if (btn) btn.click();
        });
    }
    await page.waitForTimeout(1200);

    const hasSortBtn = await page.locator('#pcGoalProjectSort').count();
    const hasCreateBtn = await page.locator('#pcGoalCreateProject').count();
    const title = await page.locator('.pc-goal-projects-title').textContent().catch(() => null);
    let cardCount = await page.locator('.pc-goal-project-card').count();
    const emptyText = await page.locator('.pc-empty-text').textContent().catch(() => null);

    console.log('--- 结构检查 ---');
    console.log('排序按钮:', hasSortBtn ? '存在' : '缺失');
    console.log('新建按钮:', hasCreateBtn ? '存在' : '缺失');
    console.log('标题:', title);
    console.log('项目卡片数:', cardCount);
    console.log('空态文案:', emptyText);

    await page.screenshot({ path: `${OUT}/01-goals-page.png`, fullPage: false });

    if (!hasSortBtn) {
        console.log('页面片段:', await page.evaluate(() => document.querySelector('.pc-goal-projects-page, #pcMain')?.innerHTML?.slice(0, 400) || 'NO PAGE'));
        console.log('错误日志:', logs.filter(l => l.includes('error') || l.includes('Error')).slice(0, 8).join('\n'));
        await browser.close();
        process.exit(1);
    }

    // 若无项目，创建 3 个
    if (cardCount === 0) {
        console.log('--- 创建测试项目 ---');
        const names = ['测试项目乙', '测试项目甲', '测试项目丙'];
        for (const name of names) {
            await page.locator('#pcGoalCreateProject').click();
            await page.waitForTimeout(400);

            let filled = false;
            for (const sel of [
                '.pc-prompt-modal input[type="text"]',
                '.pc-prompt-modal input:not([type="hidden"])',
                'input[type="text"]',
                '.pc-modal input'
            ]) {
                const loc = page.locator(sel).first();
                if (await loc.count()) {
                    await loc.fill(name);
                    filled = true;
                    break;
                }
            }
            if (!filled) {
                console.log('未找到输入框, body 片段:', await page.evaluate(() => document.body.innerHTML.slice(-800)));
            }

            // 确认按钮
            for (const btn of ['button:has-text("确定")', 'button:has-text("确认")', 'button:has-text("创建")']) {
                const b = page.locator(btn).first();
                if (await b.count()) {
                    await b.click();
                    break;
                }
            }
            await page.waitForTimeout(600);
        }
        cardCount = await page.locator('.pc-goal-project-card').count();
        console.log('创建后卡片数:', cardCount);
        await page.screenshot({ path: `${OUT}/01b-created.png`, fullPage: false });
    }

    // 点击排序按钮
    await page.locator('#pcGoalProjectSort').click();
    await page.waitForTimeout(500);
    const menuVisible = await page.locator('#pcContextMenu.pc-context-active').count();
    const menuItems = await page.locator('#pcContextMenu .pc-context-action').allTextContents();
    console.log('--- 排序菜单 ---');
    console.log('菜单可见:', menuVisible ? '是' : '否');
    console.log('菜单项:', menuItems);
    await page.screenshot({ path: `${OUT}/02-sort-menu.png`, fullPage: false });

    // 选择「按名称」
    const nameItem = page.locator('#pcContextMenu .pc-context-action').filter({ hasText: '按名称' }).first();
    if (await nameItem.count()) {
        await nameItem.click();
        await page.waitForTimeout(500);
    }

    const namesAfter = await page.locator('.pc-goal-project-name').allTextContents();
    console.log('--- 按名称排序结果 ---');
    console.log(namesAfter);

    const sortTitle = await page.locator('#pcGoalProjectSort').getAttribute('title');
    console.log('排序按钮 title:', sortTitle);

    const saved = await page.evaluate(() => localStorage.getItem('pc-goal-project-sort'));
    console.log('localStorage:', saved);

    // 再次打开菜单确认对勾
    await page.locator('#pcGoalProjectSort').click();
    await page.waitForTimeout(500);
    const checkedLabel = await page.evaluate(() => {
        const btns = [...document.querySelectorAll('#pcContextMenu .pc-context-action')];
        const hit = btns.find(b => b.querySelector('.pc-context-icon img'));
        return hit ? hit.textContent.trim() : null;
    });
    console.log('选中项(有对勾):', checkedLabel);
    await page.screenshot({ path: `${OUT}/03-sort-checked.png`, fullPage: false });

    // 切回默认
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.locator('#pcGoalProjectSort').click();
    await page.waitForTimeout(400);
    const defaultItem = page.locator('#pcContextMenu .pc-context-action').filter({ hasText: '默认顺序' }).first();
    if (await defaultItem.count()) await defaultItem.click();
    await page.waitForTimeout(400);

    console.log('--- 错误日志 ---');
    console.log(logs.filter(l => l.toLowerCase().includes('error')).slice(0, 10).join('\n') || '(无错误)');

    await browser.close();
    console.log('DONE');
}

main().catch(err => {
    console.error('VERIFY FAIL:', err);
    process.exit(1);
});
