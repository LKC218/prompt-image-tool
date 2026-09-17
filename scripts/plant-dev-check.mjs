import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));

await page.goto('http://localhost:5173/?plantDev=1', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(2000);

// 关闭可能挡住的 modal / 引导
await page.evaluate(() => {
  document.querySelectorAll('.pc-modal-overlay, .pc-modal-active, #pcModalOverlay').forEach((el) => {
    el.classList.remove('pc-modal-active');
    el.hidden = true;
    el.style.pointerEvents = 'none';
  });
  const closeBtn = document.querySelector('[data-modal-close], .pc-modal-close, .pc-modal-close-btn');
  if (closeBtn) closeBtn.click();
});
await page.waitForTimeout(300);

const layout = await page.evaluate(() => {
  const banner = document.querySelector('.pc-welcome-banner-home')?.getBoundingClientRect();
  const plant = document.querySelector('.pc-plant-anchor')?.getBoundingClientRect();
  const svg = document.querySelector('.pc-plant-svg')?.getBoundingClientRect();
  const mascot = document.querySelector('.pc-welcome-banner-home .pc-welcome-mascot')?.getBoundingClientRect();
  const dog = document.querySelector('.pc-welcome-pixel-stage-home')?.getBoundingClientRect();
  return {
    banner,
    plant,
    svg,
    mascot,
    dog,
    stage: document.querySelector('.pc-plant-slot')?.dataset.stage,
    plantInBanner: plant && banner
      ? plant.top >= banner.top - 2 && plant.bottom <= banner.bottom + 2
      : null,
  };
});
console.log('LAYOUT', JSON.stringify(layout, null, 2));
await page.screenshot({ path: 'plant-dev-home.png' });

// 强制打开气泡（绕过点击拦截）
await page.evaluate(() => {
  const bubble = document.querySelector('.pc-plant-care-bubble');
  if (bubble) bubble.hidden = false;
});
await page.waitForTimeout(200);
const bubble = await page.evaluate(() => {
  const b = document.querySelector('.pc-plant-care-bubble');
  const banner = document.querySelector('.pc-welcome-banner-home')?.getBoundingClientRect();
  const r = b?.getBoundingClientRect();
  return {
    hidden: b?.hidden,
    rect: r,
    bannerBottom: banner?.bottom,
    clipped: r && banner ? r.bottom > banner.bottom + 1 || r.top < banner.top - 1 : null,
  };
});
console.log('BUBBLE', JSON.stringify(bubble, null, 2));
await page.screenshot({ path: 'plant-dev-care.png' });

// 跳到 30 叶
await page.evaluate(() => {
  document.querySelector('[data-plant-dev-leaves="30"]')?.click();
});
await page.waitForTimeout(500);
const after = await page.evaluate(() => ({
  stage: document.querySelector('.pc-plant-slot')?.dataset.stage,
  leafCount: document.querySelectorAll('.pc-plant-leaf').length,
  storageDebug: localStorage.getItem('pc-plant-debug-state'),
  storageMain: localStorage.getItem('pc-plant-state'),
}));
console.log('AFTER_JUMP', JSON.stringify(after, null, 2));
await page.screenshot({ path: 'plant-dev-30leaves.png' });

// 满级
await page.evaluate(() => {
  document.querySelector('[data-plant-dev-leaves="60"]')?.click();
});
await page.waitForTimeout(400);
const full = await page.evaluate(() => ({
  stage: document.querySelector('.pc-plant-slot')?.dataset.stage,
  leafCount: document.querySelectorAll('.pc-plant-leaf').length,
  hasFlower: Boolean(document.querySelector('.pc-plant-flower')),
}));
console.log('AFTER_FULL', JSON.stringify(full));
await page.screenshot({ path: 'plant-dev-full.png' });

await browser.close();
console.log('DONE');
