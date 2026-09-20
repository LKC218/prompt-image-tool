import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const outDir = 'G:/项目/prompt-image-tool-main/.mimocode/temp';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto('http://127.0.0.1:5174/', { waitUntil: 'networkidle', timeout: 30000 });

async function dismissOverlays() {
  for (let i = 0; i < 5; i++) {
    const close = page.locator('[data-release-close]').first();
    if (await close.isVisible().catch(() => false)) {
      await close.click({ timeout: 2000 }).catch(() => {});
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const active = page.locator('#pcModalOverlay.pc-modal-active');
    if (!(await active.isVisible().catch(() => false))) return true;
    await page.evaluate(() => {
      const overlay = document.getElementById('pcModalOverlay');
      if (overlay) {
        overlay.classList.remove('pc-modal-active');
        overlay.setAttribute('hidden', '');
        overlay.innerHTML = '';
      }
    });
    await page.waitForTimeout(150);
  }
  return !(await page.locator('#pcModalOverlay.pc-modal-active').isVisible().catch(() => false));
}

await dismissOverlays();
await page.waitForSelector('.pc-sidebar-utility-nav', { timeout: 10000 });
await page.waitForTimeout(400);

const sidebar = page.locator('#pcSidebar, .pc-sidebar').first();
await sidebar.screenshot({ path: `${outDir}/sidebar-toolbar-light.png` });

await page.locator('[data-more-menu]').click({ force: true });
await page.waitForTimeout(350);
await page.screenshot({ path: `${outDir}/sidebar-full-more-open.png` });

// close menu
await page.locator('[data-more-menu]').click({ force: true });
await page.waitForTimeout(200);

await page.locator('.pc-theme-toggle').click({ force: true });
await page.waitForTimeout(1000);
await dismissOverlays();
await page.waitForTimeout(300);
await sidebar.screenshot({ path: `${outDir}/sidebar-toolbar-dark.png` });

console.log('ok', outDir);
await browser.close();
