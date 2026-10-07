/* 正式页面端到端验收：真实本地接口、真实压缩与 ZIP 下载。 */
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { strict as assert } from 'node:assert';
import path from 'node:path';
const OUT=path.resolve('output/png-validation');
await mkdir(OUT,{recursive:true});
const APP=process.env.PNG_TEST_URL||'http://127.0.0.1:5174/?ui=pc';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{localStorage.setItem('tutorial_completed','true');localStorage.setItem('pc-release-notes-last-seen-version','2.5.31');localStorage.setItem('appearance-preference','light');});
const screenshot=async name=>{
    await page.evaluate(()=>document.querySelectorAll('*').forEach(el=>{if(el.scrollTop)el.scrollTop=0;}));
    return page.screenshot({path:path.join(OUT,name+'.png'),fullPage:true,animations:'disabled'});
};
try{
    await page.goto(APP);
    await page.locator('#splashScreen').waitFor({state:'detached'});
    await page.locator('[data-nav="/compress"]').click();
    await page.locator('.pc-compress[data-engine-ready="true"]').waitFor();
    assert.equal(await page.locator('.png-table-wrap').isVisible(),false);
    assert.equal(await page.locator('[data-action="retry"]').isVisible(),false);
    assert.equal(await page.locator('[data-action="export"]').isVisible(),false);
    assert.equal(await page.locator('#pngEngine').isVisible(),false);
    await page.locator('.png-help summary').click();
    assert.equal(await page.locator('.png-help p').first().isVisible(),true);
    await page.locator('.png-help summary').click();
    await screenshot('正式页面-空状态');
    await page.locator('#pngFolder').setInputFiles(path.join(OUT,'输入'));
    await page.waitForFunction(()=>document.querySelector('#pngCount').textContent==='7 张');
    await page.locator('#pngFolder').setInputFiles(path.join(OUT,'输入'));
    await page.waitForFunction(()=>document.querySelector('#pngImportReport').textContent.includes('跳过 7'));
    assert.equal(await page.locator('#pngRows tr').count(),7);
    await page.locator('[data-action="settings"]').click();
    await page.locator('[data-level="4"]').click();
    assert.equal(await page.locator('#pngLevel').inputValue(),'4');
    await page.locator('#imageAdvanced>summary').click();
    await page.locator('#pngLevel').fill('3');
    assert.equal(await page.locator('#pngLevel').inputValue(),'3');
    await page.locator('#pngThreads').fill('1');
    await page.locator('[data-budget="15"]').click();
    await screenshot('设置面板-高级参数');
    await page.locator('[data-action="reset-settings"]').click();
    assert.equal(await page.locator('#pngThreads').inputValue(),'2');
    assert.equal(await page.locator('#pngLevel').inputValue(),'2');
    await page.locator('[data-level="4"]').click();
    await page.locator('#pngThreads').fill('1');
    await page.locator('[data-budget="30"]').click();
    await screenshot('设置面板-待处理');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#pngSettings').isVisible(),false);
    assert.equal(await page.locator('#pngEmpty').isVisible(),false);
    assert.equal(await page.locator('.pc-welcome-banner .pc-welcome-mascot img').count(),1);
    assert.equal(await page.locator('.png-table th').count(),5);
    assert.equal(await page.locator('[data-action="export"]').isVisible(),false);
    await screenshot('正式页面-待处理');
    const sent=page.waitForRequest(request=>request.url().includes('/api/image-process?'));
    await page.locator('[data-action="run"]').click();
    const sentUrl=new URL((await sent).url());
    assert.equal(sentUrl.searchParams.get('level'),'4');
    assert.equal(sentUrl.searchParams.get('threads'),'1');
    assert.equal(sentUrl.searchParams.get('budget'),'30');
    await page.waitForFunction(()=>document.querySelector('#pngSummary').textContent.includes('所选成功 7'),{timeout:120000});
    await page.locator('[data-action="cancel"]').waitFor({state:'hidden'});
    assert.equal(await page.locator('[data-action="run"]').isVisible(),false);
    assert.equal(await page.locator('#pngLeaveNote').isVisible(),true);
    assert.equal(await page.locator('[data-action="export"]').isVisible(),true);
    await screenshot('正式页面-压缩完成');
    await page.locator('.png-footer').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(OUT,'正式页面-完成底部.png'),animations:'disabled'});
    const downloading=page.waitForEvent('download');
    await page.locator('[data-action="export"]').click();
    await (await downloading).saveAs(path.join(OUT,'批量结果.zip'));
    assert.equal(await page.locator('#pngLeaveNote').isVisible(),false);
    const single=page.waitForEvent('download');
    await page.locator('[data-download]').first().click();
    assert.match((await single).suggestedFilename(),/-压缩.png$/);
    const themeChecks=[];
    for(const appearance of ['light','dark']){
        for(const theme of ['sky','rose','caramel','forest','night','mint']){
            await page.evaluate(async({appearance,theme})=>{
                const service=await import('/js/core/theme-service.js');
                service.setAppearancePreference(appearance);service.setWorkbenchTheme(theme);
            },{appearance,theme});
            assert.equal(await page.locator('html').getAttribute('data-appearance'),appearance);
            const colors=await page.locator('.png-panel').first().evaluate(el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color}));
            themeChecks.push({appearance,theme,...colors});
            assert.ok(await page.locator('svg.png-glyph path').count()>0,'图标应为真实矢量路径');
            assert.equal(await page.locator('svg.png-glyph').first().evaluate(el=>getComputedStyle(el).stroke===getComputedStyle(el).color),true,'图标描边必须跟随主题颜色');
            await screenshot('主题-'+appearance+'-'+theme);
        }
    }
    await page.locator('[data-action="settings"]').click();
    await screenshot('设置面板-深色');
    for(const width of [1280,1024,800]){
        await page.setViewportSize({width,height:900});
        await screenshot('视口-'+width);
        const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
        assert.ok(overflow.scroll<=overflow.width,'页面不能水平溢出');
        const footer=await page.locator('.png-footer').boundingBox();
        assert.ok(footer.y+footer.height<=901,'底栏必须在首屏内可见');
    }
    await page.locator('[data-action="close-settings"]').click();
    await page.setViewportSize({width:1440,height:1000});
    await page.locator('[data-action="clear"]').click();
    await page.locator('#pngFiles').setInputFiles([path.join(OUT,'异常输入/动画.png'),path.join(OUT,'异常输入/非图片.txt'),path.join(OUT,'异常输入/损坏图片.png')]);
    await page.waitForFunction(()=>document.querySelector('#pngImportReport').textContent.includes('跳过 3'));
    assert.match(await page.locator('#pngImportReport').textContent(),/动画/);
    assert.match(await page.locator('#pngImportReport').textContent(),/校验/);
    assert.equal(await page.locator('#pngRows tr').count(),0);
    await screenshot('正式页面-错误反馈');
    // 从真实文件构建拖放事件，不伪造引擎结果。
    const bytes=await readFile(path.join(OUT,'输入/透明插画.png'));
    const transfer=await page.evaluateHandle(data=>{
        const transfer=new DataTransfer();
        transfer.items.add(new File([new Uint8Array(data)],'拖放图片.png',{type:'image/png'}));
        return transfer;
    },[...bytes]);
    await page.locator('#pngDrop').dispatchEvent('drop',{dataTransfer:transfer});
    await page.waitForFunction(()=>document.querySelector('#pngCount').textContent==='1 张');
    await transfer.dispose();
    await page.locator('#pngAll').uncheck();
    assert.equal(await page.locator('[data-action="run"]').isDisabled(),true);
    await page.locator('#pngAll').check();
    // 队列取消的 UI 分支使用延迟真实请求；不伪造压缩内容。
    let release;
    const gate=new Promise(resolve=>release=resolve);
    await page.route('**/api/image-process?*',async route=>{await gate;await route.continue().catch(()=>{});});
    await page.locator('[data-action="run"]').click();
    await page.locator('[data-action="settings"]').click();
    assert.equal(await page.locator('#pngLevel').isDisabled(),true);
    assert.equal(await page.locator('#pngThreads').isDisabled(),true);
    await page.locator('[data-action="cancel"]').click();
    assert.equal(await page.locator('.png-status.cancelled').count(),1);
    release();
    await page.unroute('**/api/image-process?*');
    await page.keyboard.press('Tab');
    await page.locator('[data-action="files"]').focus();
    assert.equal(await page.locator('[data-action="files"]').evaluate(el=>getComputedStyle(el).outlineStyle),'solid');
    await page.locator('[data-nav="/library"]').click();
    await page.locator('[data-nav="/compress"]').click();
    await page.locator('.pc-compress[data-engine-ready="true"]').waitFor();
    assert.equal(await page.locator('#pngRows tr').count(),0,'离开页面必须释放队列');
    assert.equal(await page.locator('#pngSettings').isVisible(),true,'记住面板展开状态');
    await page.keyboard.press('Escape');
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.locator('#pngFolder').setInputFiles(path.join(OUT,'输入'));
    await page.waitForFunction(()=>document.querySelector('#pngCount').textContent==='7 张');
    await screenshot('正式页面-普通动效');
    // 新增样式严格局限于当前页，回归所有 PC 主导航入口。
    for(const route of ['/','/library','/editor/','/goals','/category','/games','/settings']){
        await page.locator('[data-nav="'+route+'"]').click();
        await screenshot('页面回归-'+(route.replaceAll('/','')||'home'));
    }
    const forbidden=await page.request.get('http://127.0.0.1:8898/api/png-compress/status',{headers:{Origin:'https://evil.example'}});
    assert.equal(forbidden.status(),403);
    const noToken=await page.request.post('http://127.0.0.1:8898/api/image-process?job=00000000-0000-0000-0000-000000000000',{data:bytes,headers:{'Content-Type':'application/octet-stream'}});
    assert.equal(noToken.status(),403);
    assert.deepEqual(errors,[]);
    await writeFile(path.join(OUT,'浏览器验收.json'),JSON.stringify({浏览器:browser.version(),主题:themeChecks,脚本错误:errors,结果:'真实批量压缩、文件夹去重、ZIP下载、单图下载、错误与重试、拖放、取消、卸载、键盘、主题和页面回归通过'},null,2));
    console.log('浏览器验收通过；请执行 Python ZIP 回读验证。');
}finally{await browser.close();}

