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

async function shot(name, day) {
  if (day != null) {
    const ok = await page.evaluate((d) => {
      const btn = document.querySelector(`[data-plant-dev-day="${d}"]`);
      if (!btn) return false;
      btn.click();
      return true;
    }, String(day));
    if (!ok) console.log('MISSING_BTN', day);
    await page.waitForTimeout(400);
  }
  await page.locator('.pc-plant-anchor').screenshot({ path: `cycle-v1-${name}.png` });
  await page.screenshot({ path: `cycle-v1-page-${name}.png` });
  const meta = await page.evaluate(() => ({
    day: document.querySelector('.pc-plant-slot')?.dataset.day,
    stage: document.querySelector('.pc-plant-slot')?.dataset.stage,
    art: document.querySelector('.pc-plant-art')?.dataset.stageArt,
    fx: {
      dew: !!document.querySelector('.pc-plant-fx--dew'),
      bug: !!document.querySelector('.pc-plant-fx--bug'),
      fly: !!document.querySelector('.pc-plant-fx--fly'),
      fall: document.querySelectorAll('.pc-plant-fx--fall').length,
      flower: document.querySelectorAll('.pc-plant-fx--flower').length,
      shovel: !!document.querySelector('.pc-plant-shovel'),
    },
  }));
  console.log(name, JSON.stringify(meta));
}

await shot('d01', 1);
await shot('d05', 5);
await shot('d15', 15);
await shot('d24', 24);
await shot('d28', 28);
await shot('d30', 30);

await browser.close();
console.log('DONE');
