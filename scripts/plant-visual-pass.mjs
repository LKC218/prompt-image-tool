import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:5173/?plantDev=1', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);

await page.evaluate(() => {
  document.querySelectorAll('.pc-modal-overlay, #pcModalOverlay').forEach((el) => {
    el.classList.remove('pc-modal-active');
    el.hidden = true;
    el.style.pointerEvents = 'none';
  });
});

async function shot(name, leaves) {
  if (leaves != null) {
    const ok = await page.evaluate((n) => {
      const btn = document.querySelector(`[data-plant-dev-leaves="${n}"]`);
      if (!btn) return false;
      btn.click();
      return true;
    }, String(leaves));
    if (!ok) console.log('MISSING_BTN', leaves);
    await page.waitForTimeout(400);
  }
  await page.locator('.pc-plant-anchor').screenshot({ path: `plant-v2-${name}.png` });
  await page.screenshot({ path: `plant-v2-page-${name}.png` });
  const meta = await page.evaluate(() => ({
    stage: document.querySelector('.pc-plant-slot')?.dataset.stage,
    leafPaths: document.querySelectorAll('.pc-plant-leaf').length,
    groups: document.querySelectorAll('.pc-plant-leaf-g').length,
  }));
  console.log(name, JSON.stringify(meta));
}

await shot('seed', 0);
await shot('five', 5);
await shot('thirty', 30);
await shot('full', 60);

await browser.close();
console.log('DONE');
