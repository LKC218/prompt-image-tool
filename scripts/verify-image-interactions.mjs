/* 图片处理页微交互、节点连续性与可访问性验证。 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { strict as assert } from 'node:assert';
import path from 'node:path';
const out=path.resolve('output/image-interactions');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'no-preference'});
const errors=[]; page.on('pageerror',error=>errors.push(error.message));
await page.addInitScript(()=>{localStorage.setItem('tutorial_completed','true');localStorage.setItem('pc-release-notes-last-seen-version','2.5.31');localStorage.setItem('png-settings-open','false');});
const shot=name=>page.screenshot({path:path.join(out,name+'.png'),animations:'disabled'});
try {
    await page.goto('http://127.0.0.1:5174/?ui=pc');
    await page.locator('#splashScreen').waitFor({state:'detached'});
    await page.locator('[data-nav="/compress"]').click();
    await page.locator('.pc-compress[data-engine-ready="true"]').waitFor();
    await page.locator('#pngFolder').setInputFiles(path.resolve('output/image-validation/输入'));
    await page.waitForFunction(()=>document.querySelectorAll('#pngRows tr').length===3);
    await page.locator('[data-action="settings"]').click();
    assert.equal(await page.locator('#pngLevel').evaluate(el=>getComputedStyle(el).appearance),'none');
    assert.equal(await page.locator('#pngAll').evaluate(el=>getComputedStyle(el).appearance),'none');
    await page.locator('[data-operation="convert"]').click();
    const moving=await page.locator('[aria-label="处理模式"]').evaluate(el=>getComputedStyle(el,'::before').transitionDuration);
    assert.match(moving,/0.2s/);
    await page.locator('[data-target="jpeg"]').click();
    await page.locator('#imageAck').check();
    await page.locator('#imageBackground').fill('#bad');
    assert.equal(await page.locator('[data-action="run"]').isDisabled(),true);
    await page.locator('[data-background="#fff0cc"]').click();
    assert.equal(await page.locator('#imageBackground').inputValue(),'#fff0cc');
    assert.equal(await page.locator('[data-action="run"]').isDisabled(),false);
    await page.locator('#imageQuality').fill('92');
    await page.locator('#pngSettings').evaluate(el=>{el.scrollTop=0;});
    await shot('浅色-控件');
    // 改变其他设置后，同一复选框节点与焦点仍保留。
    await page.locator('[data-select]').first().focus();
    await page.evaluate(()=>{window.savedImageCheckbox=document.activeElement;document.querySelector('#imageBackground').value='#ccddff';document.querySelector('#imageBackground').dispatchEvent(new Event('input',{bubbles:true}));});
    assert.equal(await page.evaluate(()=>window.savedImageCheckbox===document.querySelector('[data-select]')&&document.activeElement===window.savedImageCheckbox),true);
    await page.locator('[data-action="run"]').click();
    await page.waitForFunction(()=>document.querySelector('#pngSummary').textContent.includes('所选成功 3'));
    assert.equal(await page.evaluate(()=>window.savedImageCheckbox===document.querySelector('[data-select]')),true);
    await page.locator('[data-action="reprocess"]').click();
    await page.locator('#imageConfirm').waitFor({state:'visible'});
    assert.equal(await page.locator('#imageConfirm button[value="cancel"]').evaluate(el=>el===document.activeElement),true);
    await shot('轻拟态-确认框');
    await page.keyboard.press('Escape');
    await page.locator('#imageConfirm').waitFor({state:'hidden'});
    assert.equal(await page.locator('#pngSettings').isVisible(),true,'取消弹窗不能连带关闭面板');
    assert.equal(await page.locator('.png-status.converted').count(),3);
    await page.locator('[data-action="reprocess"]').click();
    await page.locator('#imageConfirm button[value="confirm"]').click();
    await page.waitForFunction(()=>document.querySelectorAll('.png-status.waiting').length===3);
    // 快速关闭再打开不会被旧动画的完成回调隐藏。
    await page.evaluate(()=>{document.querySelector('[data-action="close-settings"]').click();document.querySelector('[data-action="settings"]').click();});
    await page.waitForFunction(()=>document.querySelector('#pngSettings').getAnimations().length===0);
    assert.equal(await page.locator('#pngSettings').isVisible(),true);
    await page.locator('[data-info]').first().click();
    await page.locator('[data-info]').last().click();
    assert.equal(await page.locator('#imageNotice').count(),1);
    for (const appearance of ['light','dark']) {
        await page.evaluate(async appearance=>{const theme=await import('/js/core/theme-service.js');theme.setAppearancePreference(appearance);},appearance);
        for(const width of [800,1440]) {
            await page.setViewportSize({width,height:1000});
            await page.locator('#pngSettings').evaluate(el=>{el.scrollTop=0;});
            await shot(appearance+'-'+width);
            assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
        }
    }
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.locator('[data-action="close-settings"]').click();
    assert.equal(await page.locator('#pngSettings').isVisible(),false);
    await page.locator('[data-action="settings"]').click();
    assert.equal(await page.locator('#pngSettings').evaluate(el=>el.getAnimations().length),0);
    assert.equal(await page.locator('[aria-label="处理模式"]').evaluate(el=>getComputedStyle(el,'::before').transitionDuration),'0s');
    await page.locator('[data-remove]').first().click();
    assert.equal(await page.locator('#pngRows tr').count(),2);
    await page.locator('[data-nav="/library"]').click();
    assert.equal(await page.locator('#imageNotice').count(),0);
    assert.deepEqual(errors,[]);
    await writeFile(path.join(out,'验收结果.json'),JSON.stringify({节点与焦点保留:true,确认与取消:true,快速切换:true,减少动态效果:true,浅深色与窄屏:true,errors},null,2));
    console.log('图片微交互与轻拟态验收通过');
} finally {await browser.close();}
