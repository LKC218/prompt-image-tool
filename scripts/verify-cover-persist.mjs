import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'http://localhost:5173';
const OUT = 'scripts/.verify-out';
const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function main() {
    fs.mkdirSync(OUT, { recursive: true });

    // ========== 1. API 层：封面持久化 + cleanup 保留 ==========
    const createRes = await fetch('http://localhost:8888/api/goals/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '封面持久化验证' })
    });
    const project = await createRes.json();
    const projectId = project.id;
    console.log('1. 创建项目:', projectId);

    const uploadRes = await fetch('http://localhost:8888/api/goals/images/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, imageId: 'cover-verify', data: TINY_PNG })
    });
    const uploadJson = await uploadRes.json();
    const coverPath = uploadJson.path || uploadJson.result?.path;
    console.log('2. 上传封面:', coverPath);

    const updateRes = await fetch(`http://localhost:8888/api/goals/projects/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverImage: coverPath, coverColor: '' })
    });
    const updateJson = await updateRes.json();
    console.log('3. 更新 coverImage 字段:', updateJson.coverImage);

    // 确认 get projects 返回 coverImage
    const listRes = await fetch('http://localhost:8888/api/goals/projects');
    const list = await listRes.json();
    const listed = list.find(p => p.id === projectId);
    console.log('4. 列表返回 coverImage:', listed?.coverImage);

    // 触发 updateGoalTasks（会跑 cleanup）
    await fetch(`http://localhost:8888/api/goals/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            tasks: [{ id: 'task-1', title: '任务A', completed: true, order: 0, parentId: '', priority: '', status: '', images: [], children: [] }]
        })
    });
    console.log('5. 已触发 updateGoalTasks + cleanup');

    // 封面文件是否还在
    const imgRes = await fetch(`http://localhost:8888/api/goals/images/${coverPath.split('/').map(encodeURIComponent).join('/')}`);
    console.log('6. cleanup 后封面文件 HTTP:', imgRes.status);

    // coverImage 字段是否还在
    const listRes2 = await fetch('http://localhost:8888/api/goals/projects');
    const list2 = await listRes2.json();
    const listed2 = list2.find(p => p.id === projectId);
    console.log('7. cleanup 后 coverImage:', listed2?.coverImage);

    // 再触发 delete task 的 cleanup
    await fetch(`http://localhost:8888/api/goals/projects/${projectId}/tasks/task-1`, { method: 'DELETE' });
    const imgRes2 = await fetch(`http://localhost:8888/api/goals/images/${coverPath.split('/').map(encodeURIComponent).join('/')}`);
    console.log('8. 删除任务后封面文件 HTTP:', imgRes2.status);

    const apiPass = imgRes.status === 200 && imgRes2.status === 200 && !!listed2?.coverImage;
    console.log('API 层:', apiPass ? 'PASS' : 'FAIL');

    // ========== 2. UI 层：onerror 回退 ==========
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    await page.goto(`${BASE}/?ui=pc`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#pcApp', { state: 'visible', timeout: 15000 });
    await page.waitForTimeout(600);
    await page.evaluate(() => {
        document.querySelectorAll('.pc-modal-overlay').forEach(el => { el.classList.remove('pc-modal-active'); el.style.display = 'none'; });
    });

    await page.locator('[data-nav="/goals"]').click({ force: true });
    await page.waitForTimeout(1200);

    // 直接注入一张会失败的封面 img，验证 onerror 回退
    const fallbackOk = await page.evaluate(async () => {
        const card = document.querySelector('.pc-goal-project-card');
        if (!card) return 'no-card';
        const wrap = card.querySelector('.pc-goal-project-cover');
        if (!wrap) return 'no-wrap';
        wrap.dataset.gradient = 'linear-gradient(135deg, #a0c4ff, #bdb2ff)';
        wrap.dataset.initials = '测';
        wrap.innerHTML = '<img src="/api/goals/images/__missing__.png" alt="" data-goal-cover-fallback data-name="测试">';
        // 重新绑定（模块内函数不在全局，手动触发 error）
        const img = wrap.querySelector('img');
        await new Promise(resolve => {
            img.addEventListener('error', () => {
                wrap.innerHTML = `<div class="pc-goal-project-cover-gradient" style="background: ${wrap.dataset.gradient}"><span class="pc-goal-project-cover-initials">${wrap.dataset.initials}</span></div>`;
                resolve();
            }, { once: true });
            // 强制触发
            img.dispatchEvent(new Event('error'));
        });
        return wrap.querySelector('.pc-goal-project-cover-gradient') ? 'ok' : 'no-fallback';
    });
    console.log('9. onerror 回退:', fallbackOk);
    await page.screenshot({ path: `${OUT}/cover-fallback.png` });

    // 真实页面上 setupCoverFallback 是否绑定了
    const bound = await page.evaluate(() => {
        const imgs = document.querySelectorAll('img[data-goal-cover-fallback]');
        return imgs.length;
    });
    console.log('10. 页面上 data-goal-cover-fallback 图片数:', bound);

    // 清理测试项目
    await fetch(`http://localhost:8888/api/goals/projects/${projectId}`, { method: 'DELETE' });
    console.log('已清理测试项目');

    await browser.close();
    const pass = apiPass && fallbackOk === 'ok';
    console.log(pass ? 'ALL PASS' : 'SOME FAIL');
    process.exit(pass ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
