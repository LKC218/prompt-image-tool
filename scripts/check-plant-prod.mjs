import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();

// 先开页再清档，避免导航打断 evaluate
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.evaluate(() => localStorage.clear());
await page.evaluate(async () => {
  try {
    await fetch('http://localhost:8888/api/plant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schemaVersion: 1, plant: null, updatedAt: new Date().toISOString() }),
    });
  } catch { /* ignore */ }
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

const info = await page.evaluate(() => ({
  day: document.querySelector('.pc-plant-slot')?.dataset.day,
  stage: document.querySelector('.pc-plant-slot')?.dataset.stage,
  hasDevToggle: !!document.querySelector('[data-plant-dev-toggle]'),
  hasDevPanel: !!document.querySelector('[data-plant-dev-panel]'),
  hasCey: Array.from(document.querySelectorAll('button')).some((b) => b.textContent.trim() === '测'),
  isDevFlag: Boolean(window.__PC_PLANT_DEV__),
}));
console.log(JSON.stringify(info, null, 2));
await page.locator('.pc-plant-anchor').screenshot({ path: 'plant-prod-preview.png' });
await browser.close();
