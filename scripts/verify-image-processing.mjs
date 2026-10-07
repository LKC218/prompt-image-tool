/* 多格式正式页面验收，使用独立浏览器与隔离验收后端。 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { strict as assert } from 'node:assert';
const out=path.resolve('output/image-validation');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
await page.addInitScript(()=>{localStorage.setItem('tutorial_completed','true');localStorage.setItem('pc-release-notes-last-seen-version','2.5.31');localStorage.setItem('appearance-preference','light');localStorage.setItem('png-settings-open','false');});
async function shot(name){await page.waitForFunction(()=>!document.querySelector('.pc-toast'));await page.screenshot({path:path.join(out,name+'.png'),fullPage:true,animations:'disabled'});}
async function run(){await page.locator('[data-action="run"]').click();await page.waitForFunction(()=>document.querySelector('#pngSummary').textContent.includes('所选成功 3'),null,{timeout:120000});await page.locator('[data-action="cancel"]').waitFor({state:'hidden'});}
async function download(name){const promise=page.waitForEvent('download');await page.locator('[data-action="export"]').click();await (await promise).saveAs(path.join(out,name+'.zip'));}
try {
    await page.goto(process.env.IMAGE_TEST_URL||'http://127.0.0.1:5174/?ui=pc');
    await page.locator('#splashScreen').waitFor({state:'detached'});
    await page.locator('[data-nav="/compress"]').click();
    await page.locator('.pc-compress[data-engine-ready="true"]').waitFor();
    await shot('空状态');
    await page.locator('#pngFolder').setInputFiles(path.join(out,'输入'));
    await page.waitForFunction(()=>document.querySelector('#pngCount').textContent==='3 张');
    await run(); await download('原格式无损'); await shot('混合无损完成');
    await page.locator('[data-action="settings"]').click();
    await page.locator('[data-operation="convert"]').click();
    await page.locator('[data-target="jpeg"]').click();
    assert.equal(await page.locator('[data-encoding="lossless"]').isDisabled(),true);
    await page.locator('#imageQuality').fill('90');
    await page.locator('#imageBackground').fill('#fff0cc');
    await page.locator('[data-action="reprocess"]').click();
    assert.equal(await page.locator('[data-action="run"]').isDisabled(),true);
    await page.locator('#imageAck').check();
    await page.locator('#pngSettings').evaluate(el=>{el.scrollTop=0;});
    await shot('JPEG转换设置');
    await run(); await download('转换JPEG');
    await page.locator('[data-target="webp"]').click();
    await page.locator('[data-encoding="lossless"]').click();
    await page.locator('#imageAck').check();
    await page.locator('[data-action="reprocess"]').click();
    await run(); await download('转换WebP');
    await page.locator('[data-target="png"]').click();
    assert.equal(await page.locator('[data-encoding="lossy"]').isDisabled(),true);
    await page.locator('#imageAck').check();
    await page.locator('[data-action="reprocess"]').click();
    await run(); await download('转换PNG');
    await page.locator('#imageAdvanced>summary').click();
    await page.locator('[data-action="clean-cache"]').click();
    assert.match(await page.locator('#imageCacheInfo').textContent(),/0.0 KB/);
    const layouts=[];
    for(const width of [800,1024,1280,1440]) {
        await page.setViewportSize({width,height:900});
        await page.locator('#pngSettings').evaluate(el=>{el.scrollTop=0;});
        const bounds=await page.locator('.png-footer').boundingBox();
        assert.ok(bounds.y+bounds.height<=901,'底部操作须在视口内');
        const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
        assert.equal(overflow,false,'页面不能横向溢出');
        await shot('布局-'+width); layouts.push({width,footerVisible:true});
    }
    await page.setViewportSize({width:1440,height:1000});
    for(const appearance of ['light','dark']) {
        await page.evaluate(async appearance=>{const service=await import('/js/core/theme-service.js');service.setAppearancePreference(appearance);},appearance);
        await shot('主题-'+appearance);
    }
    assert.deepEqual(errors,[]);
    await writeFile(path.join(out,'验收结果.json'),JSON.stringify({formats:['png','jpeg','webp'],batches:4,layouts,errors},null,2));
    console.log('多格式批量压缩、转换、ZIP、缓存及视觉布局验收通过');
} finally {await browser.close();}
