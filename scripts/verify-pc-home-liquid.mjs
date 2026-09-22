import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR = path.resolve('output/playwright');
const URL = process.env.PC_URL || 'http://127.0.0.1:5173/?ui=pc';
const SAMPLE_MS = Number(process.env.SAMPLE_MS || 20000);
const INTERVAL_MS = 1000;
const Y_BOUND = Number(process.env.Y_BOUND || 25);

await mkdir(OUT_DIR, { recursive: true });

function yStatsFromPath(d) {
  if (!d) return { surfaceRange: 0, minY: null, maxY: null, hasPath: false };
  const tokens = d.match(/-?\d+\.\d+|-?\d+/g) || [];
  const ys = [];
  for (let i = 1; i < tokens.length; i += 2) ys.push(Number(tokens[i]));
  const surface = ys.filter((y) => Number.isFinite(y) && y < 110);
  if (!surface.length) return { surfaceRange: 0, minY: null, maxY: null, hasPath: d.startsWith('M ') };
  const minY = Math.min(...surface);
  const maxY = Math.max(...surface);
  return { surfaceRange: maxY - minY, minY, maxY, hasPath: d.startsWith('M ') };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on('pageerror', (err) => consoleErrors.push(String(err)));
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForSelector('.pc-stat-card[data-stat-liquid]', { timeout: 30000 });
await page.waitForTimeout(400);

const samples = [];
for (let t = 0; t <= SAMPLE_MS; t += INTERVAL_MS) {
  const snap = await page.evaluate(() => Array.from(document.querySelectorAll('.pc-stat-card[data-stat-liquid]')).map((card) => ({
    key: card.dataset.statLiquid,
    fill: card.dataset.statFill,
    body: card.querySelector('.pc-stat-liquid-body')?.getAttribute('d') || '',
    waveA: card.querySelector('.pc-stat-liquid-wave-a')?.getAttribute('d') || '',
  })));
  samples.push({ t, cards: snap });
  if (t < SAMPLE_MS) await page.waitForTimeout(INTERVAL_MS);
}

const keys = samples[0].cards.map((c) => c.key);
const motion = keys.map((key) => {
  const series = samples.map((s) => s.cards.find((c) => c.key === key));
  const bodyRanges = series.map((s) => yStatsFromPath(s.body).surfaceRange);
  const maxBodyRange = Math.max(...bodyRanges);
  const late = series.slice(-6);
  const lateMoving = late.some((s, i) => i > 0 && s.body !== late[i - 1].body && s.waveA !== late[i - 1].waveA);
  const fills = series.map((s) => Number(s.fill));
  return {
    key,
    fill: series[0].fill,
    fillsInRange: fills.every((f) => f >= 0.42 && f <= 0.5),
    maxBodyRange: Number(maxBodyRange.toFixed(2)),
    bounded: maxBodyRange <= Y_BOUND + 20,
    lateMoving,
    bodyPathsOk: series.every((s) => yStatsFromPath(s.body).hasPath),
  };
});

const grid = page.locator('.pc-stat-grid.pc-home-stat-grid');
await grid.screenshot({ path: path.join(OUT_DIR, 'pc-home-stat-liquid-stable.png') });

const checks = {
  allFourCards: motion.length === 4,
  allMidFill: motion.every((m) => m.fillsInRange),
  allBounded: motion.every((m) => m.bounded),
  allLateMoving: motion.every((m) => m.lateMoving),
  allPathsOk: motion.every((m) => m.bodyPathsOk),
  noConsoleErrors: consoleErrors.length === 0,
};

const report = {
  url: URL,
  sampleMs: SAMPLE_MS,
  yBound: Y_BOUND,
  consoleErrors,
  motion,
  checks,
  pass: Object.values(checks).every(Boolean),
  screenshot: path.join(OUT_DIR, 'pc-home-stat-liquid-stable.png'),
};

console.log(JSON.stringify(report, null, 2));
await browser.close();
if (!report.pass) process.exitCode = 1;
