/* 采样真实布局中间帧，验证联动而非只验证最终显示状态。 */
import { chromium } from 'playwright';
import { mkdir,writeFile } from 'node:fs/promises';
import { strict as assert } from 'node:assert';
import path from 'node:path';
const out=path.resolve('output/image-panel-motion'); await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000},reducedMotion:'no-preference'});
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{localStorage.setItem('tutorial_completed','true');localStorage.setItem('pc-release-notes-last-seen-version','2.5.31');localStorage.setItem('png-settings-open','false');});
async function sample(open){return page.evaluate(async open=>{
    const workspace=document.querySelector('.png-workspace'),panel=document.querySelector('.png-panel'),aside=document.querySelector('#pngSettings');
    const frames=[],start=performance.now();
    document.querySelector('[data-action=settings]').click();
    await new Promise(resolve=>{function frame(){const t=performance.now()-start;frames.push({t,width:panel.getBoundingClientRect().width,aside:aside.getBoundingClientRect().width,button:document.querySelector('[data-action=settings]').getBoundingClientRect().right});if(t<420)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});
    return {open,frames,columns:getComputedStyle(workspace).gridTemplateColumns};
},open);}
try {
    await page.goto('http://127.0.0.1:5174/?ui=pc');await page.locator('#splashScreen').waitFor({state:'detached'});await page.locator('[data-nav="/compress"]').click();await page.locator('.pc-compress[data-engine-ready=true]').waitFor();
    const opening=await sample(true),closing=await sample(false);
    for(const result of [opening,closing]){
        const values=result.frames.map(f=>f.width),min=Math.min(...values),max=Math.max(...values);
        assert.ok(max-min>250,'宽屏应实际让位');assert.ok(new Set(values.map(v=>Math.round(v))).size>4,'须有多个真实中间布局');
        assert.ok(result.frames.every(f=>Math.abs(f.aside-285)<1),'参数面板不可横向压缩');
        for(let i=1;i<values.length;i++) assert.ok(result.open?values[i]<=values[i-1]+1:values[i]>=values[i-1]-1,'尺寸应单向平滑变化');
    }
    await page.locator('[data-action=settings]').click();
    await page.waitForFunction(()=>document.querySelector('#pngSettings').getAnimations().length===0);
    const header=await page.locator('#pngSettings>header').boundingBox();
    await page.locator('.png-advanced summary').first().click();
    await page.locator('.image-settings-scroll').evaluate(el=>{el.scrollTop=200;});
    assert.equal((await page.locator('#pngSettings>header').boundingBox()).y,header.y);
    const scroll=await page.locator('.image-settings-scroll').evaluate(el=>el.scrollTop);assert.ok(scroll>0);
    await sample(false);await sample(true);
    assert.equal(await page.locator('.image-settings-scroll').evaluate(el=>el.scrollTop),scroll);
    await page.locator('.image-settings-scroll').evaluate(el=>{el.scrollTop=0;});
    await page.screenshot({path:path.join(out,'宽屏展开.png')});
    await page.evaluate(async()=>{const toggle=document.querySelector('[data-action=settings]');toggle.click();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));toggle.click();});
    await page.waitForFunction(()=>document.querySelector('#pngSettings').getAnimations().length===0);assert.equal(await page.locator('#pngSettings').isVisible(),true);
    await page.setViewportSize({width:800,height:900});
    const narrowClose=await sample(false),narrowOpen=await sample(true);
    for(const result of [narrowClose,narrowOpen]){const widths=result.frames.map(f=>f.width);assert.ok(Math.max(...widths)-Math.min(...widths)<1,'窄屏不挤压列表');}
    await page.screenshot({path:path.join(out,'窄屏覆盖.png')});
    await page.emulateMedia({reducedMotion:'reduce'});await page.locator('[data-action=close-settings]').click();assert.equal(await page.locator('#pngSettings').isVisible(),false);
    assert.deepEqual(errors,[]);
    await writeFile(path.join(out,'中间帧验收.json'),JSON.stringify({opening,closing,narrowClose,narrowOpen,scroll,errors},null,2));
    console.log('面板联动、中间帧、反向切换、固定标题与滚动保留验收通过');
} finally {await browser.close();}
