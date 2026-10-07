/* 独立预览回归：不启动应用后端，不处理真实用户数据。 */
import { chromium } from 'playwright';
import { strict as assert } from 'node:assert';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const shots = path.join(root, '验收截图');
await mkdir(shots, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const issues = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on('pageerror', error => issues.push(error.message));
const names = ['方案一-批量工作台', '方案二-视觉画廊', '方案三-步骤向导'];
const fixture = { name: '测试图片.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64') };
const folderFixture = path.join(shots, '测试输入');
await mkdir(path.join(folderFixture, '子目录'), { recursive: true });
await writeFile(path.join(folderFixture, '测试图片.png'), fixture.buffer);
await writeFile(path.join(folderFixture, '子目录', '测试图片.png'), fixture.buffer);
await writeFile(path.join(folderFixture, '跳过.txt'), '非图片');
try {
  for (const [index, name] of names.entries()) {
    await page.goto(pathToFileURL(path.join(root, name + '.html')).href);
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.thumb').first().waitFor();
    assert.equal(await page.locator('[data-select]').count(), 6);
    assert.equal(await page.evaluate(() => [...document.images].every(x => x.complete && x.naturalWidth > 0)), true, '示例素材应可加载');
    await page.screenshot({ path: path.join(shots, name + '-浅色.png'), fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: '切换浅深色' }).click();
    await page.screenshot({ path: path.join(shots, name + '-深色.png'), fullPage: true, animations: 'disabled' });
    for (const theme of ['sky', 'rose', 'caramel', 'forest', 'night', 'mint']) {
      await page.locator('#theme').selectOption(theme);
      assert.equal(await page.evaluate(() => document.documentElement.dataset.workbenchTheme), theme);
    }
    await page.locator('#theme').selectOption('sky');
    await page.getByRole('button', { name: '切换浅深色' }).click();
    await page.locator('[data-action="clear"]').click();
    assert.equal(await page.locator('[data-select]').count(), 0);
    await page.locator('#files').setInputFiles([fixture, { name: '不是图片.txt', mimeType: 'text/plain', buffer: Buffer.from('测试内容') }]);
    await page.waitForFunction(() => document.querySelectorAll('[data-select]').length === 1);
    assert.match(await page.locator('#toast').textContent(), /跳过 1/);
    await page.locator('[data-select]').uncheck();
    assert.match(await page.locator('#resultSummary').textContent(), /已选 0/);
    await page.locator('#selectAll').check();
    assert.match(await page.locator('#resultSummary').textContent(), /已选 1/);
    await page.locator('[data-remove]').click();
    assert.equal(await page.locator('[data-select]').count(), 0);
    await page.locator('#folder').setInputFiles(folderFixture);
    await page.waitForFunction(() => document.querySelectorAll('[data-select]').length === 2);
    await page.locator('#folder').setInputFiles(folderFixture);
    await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('跳过 3'));
    assert.equal(await page.locator('[data-select]').count(), 2, '文件夹重复导入应去重，同名不同目录应保留');
    const transfer = await page.evaluateHandle(() => {
      const data = new DataTransfer();
      const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII='), c => c.charCodeAt(0));
      data.items.add(new File([png], '长文件名用于验证批量导入后表格布局不会被超长中文名称撑坏的图片.png', { type: 'image/png' }));
      return data;
    });
    await page.locator('#drop').dispatchEvent('drop', { dataTransfer: transfer });
    await page.waitForFunction(() => document.querySelectorAll('[data-select]').length === 3);
    await transfer.dispose();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator('[data-action="samples"]').click();
    if (index === 2) await page.locator('[data-action="next"]').click();
    await page.locator('[data-action="run"]:visible').click();
    await page.locator('[data-action="cancel"]').click();
    assert.match(await page.locator('#toast').textContent(), /取消模拟/);
    await page.locator('[data-action="run"]:visible').click();
    await page.waitForFunction(() => document.querySelector('#resultSummary').textContent.includes('模拟完成 6'), { timeout: 10000 });
    if (index === 2) assert.equal(await page.locator('[data-step="3"]').getAttribute('aria-current'), 'step');
    const download = page.waitForEvent('download');
    await page.locator('[data-action="export"]:visible').first().click();
    assert.equal((await download).suggestedFilename(), '图片压缩-演示报告.json');
    await page.screenshot({ path: path.join(shots, name + '-完成.png'), fullPage: true, animations: 'disabled' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(shots, name + '-窄屏.png'), fullPage: true, animations: 'disabled' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, '整页不应横向溢出');
    await page.setViewportSize({ width: 1440, height: 1000 });
    console.log(name + '：素材、主题、多文件导入、文件夹去重、拖放、长文件名、选择、取消、模拟完成、报告导出、窄屏通过');
  }
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
  assert.equal(await page.locator('.choice a').count(), 3);
  await page.screenshot({ path: path.join(shots, '方案总览.png'), fullPage: true });
  assert.deepEqual(issues, [], '浏览器不能出现脚本错误');
  console.log('三版预览检查通过；截图位于同目录验收截图，未验证真实压缩能力。');
} finally {
  await browser.close();
}
