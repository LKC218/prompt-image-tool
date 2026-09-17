import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('PAGEERR', e.message));
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2200);

await page.evaluate(() => {
  document.querySelectorAll('.pc-modal-overlay, #pcModalOverlay').forEach((el) => {
    el.classList.remove('pc-modal-active');
    el.hidden = true;
    el.style.pointerEvents = 'none';
  });
});

async function hoverSkin(selector, label) {
  const loc = page.locator(selector).first();
  const count = await loc.count();
  if (!count) {
    console.log(label, 'MISSING', selector);
    return null;
  }
  const box = await loc.boundingBox();
  if (!box) {
    console.log(label, 'NO_BOX');
    return null;
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(350);
  const info = await page.evaluate(() => {
    const c = document.querySelector('.pc-custom-cursor');
    const el = document.elementFromPoint(window.__hx || 0, window.__hy || 0);
    return {
      skin: c?.dataset.plantSkin || null,
      classes: c?.className,
      bg: c ? getComputedStyle(c).backgroundImage.slice(0, 90) : null,
    };
  });
  // 记录悬停点供 elementFromPoint
  console.log(label, JSON.stringify(info));
  return info;
}

// 打开养护气泡
await page.evaluate(() => document.querySelector('.pc-plant-trigger')?.click());
await page.waitForTimeout(300);

const results = {};
results.plant = await hoverSkin('.pc-plant-trigger', 'plant');
results.water = await hoverSkin('.pc-plant-care-btn[data-plant-care="watered"]', 'water');
results.fert = await hoverSkin('.pc-plant-care-btn[data-plant-care="fertilized"]', 'fert');
results.deug = await hoverSkin('.pc-plant-care-btn[data-plant-care="deugged"]', 'deug');

// 跳到有虫的第 5 天
await page.evaluate(() => document.querySelector('[data-plant-dev-toggle]')?.click());
await page.waitForTimeout(200);
await page.evaluate(() => document.querySelector('[data-plant-dev-day="5"]')?.click());
await page.waitForTimeout(500);
// 关测试条
await page.evaluate(() => document.querySelector('[data-plant-dev-toggle]')?.click());
await page.waitForTimeout(200);
results.bug = await hoverSkin('.pc-plant-fx--bug', 'bug');

// 跳到 30 天
await page.evaluate(() => document.querySelector('[data-plant-dev-toggle]')?.click());
await page.waitForTimeout(200);
await page.evaluate(() => document.querySelector('[data-plant-dev-day="30"]')?.click());
await page.waitForTimeout(500);
await page.evaluate(() => document.querySelector('[data-plant-dev-toggle]')?.click());
await page.waitForTimeout(200);
results.shovel = await hoverSkin('.pc-plant-shovel', 'shovel');

// DOM 检查 data-cursor
const attrs = await page.evaluate(() => ({
  slot: document.querySelector('.pc-plant-slot')?.dataset.cursor,
  water: document.querySelector('[data-plant-care="watered"]')?.dataset.cursor,
  fert: document.querySelector('[data-plant-care="fertilized"]')?.dataset.cursor,
  deug: document.querySelector('[data-plant-care="deugged"]')?.dataset.cursor,
  shovel: document.querySelector('.pc-plant-shovel')?.dataset.cursor,
  bug: document.querySelector('.pc-plant-fx--bug')?.dataset.cursor,
  leafVar: getComputedStyle(document.documentElement).getPropertyValue('--pc-plant-cursor-leaf').slice(0, 60),
  waterVar: getComputedStyle(document.documentElement).getPropertyValue('--pc-plant-cursor-water').slice(0, 60),
}));
console.log('ATTRS', JSON.stringify(attrs, null, 2));

await page.screenshot({ path: 'plant-cursor-skins.png' });
await browser.close();
console.log('DONE');
