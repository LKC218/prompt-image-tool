import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2200);
await page.evaluate(() => {
  document.querySelectorAll('.pc-modal-overlay, #pcModalOverlay').forEach((el) => {
    el.classList.remove('pc-modal-active');
    el.hidden = true;
    el.style.pointerEvents = 'none';
  });
});

async function probe(selector, label) {
  const loc = page.locator(selector).first();
  if (!(await loc.count())) {
    console.log(label, 'MISSING');
    return;
  }
  const box = await loc.boundingBox();
  if (!box) {
    console.log(label, 'NO_BOX');
    return;
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(320);
  const s = await page.evaluate(() => {
    const c = document.querySelector('.pc-custom-cursor');
    return {
      classes: c?.className || '',
      skin: c?.dataset.plantSkin || null,
      op: c ? getComputedStyle(c).opacity : null,
    };
  });
  console.log(label, JSON.stringify(s));
}

// 植物内
await probe('.pc-plant-trigger', 'in-plant');
// 离开到侧栏首页
await probe('[data-nav="/"]', 'nav-home');
// 搜索框
await probe('#pcHomeSearchInput', 'search');
// 快速创建
await probe('#pcQuickCreate', 'quick-create');
// 再回植物
await probe('.pc-plant-trigger', 'back-plant');

await page.screenshot({ path: 'plant-cursor-globals.png' });
await browser.close();
console.log('DONE');
