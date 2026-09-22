import { chromium } from 'playwright';

const URL = process.env.PC_URL || 'http://127.0.0.1:5173/?ui=pc';
const SAMPLE_MS = Number(process.env.SAMPLE_MS || 20000);
const INTERVAL_MS = 1000;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForSelector('.pc-stat-card[data-stat-liquid]', { timeout: 30000 });
await page.waitForTimeout(500);

function yStatsFromD(d) {
  if (!d) return { n: 0, minY: null, maxY: null, range: 0 };
  const ys = [];
  const re = /(-?\d+\.\d+|-?\d+)/g;
  // parse pairs roughly: commands are M x y / Q x y x y x y
  const tokens = d.match(re) || [];
  for (let i = 1; i < tokens.length; i += 2) ys.push(Number(tokens[i]));
  if (!ys.length) return { n: 0, minY: null, maxY: null, range: 0 };
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { n: ys.length, minY, maxY, range: maxY - minY };
}

const samples = [];
for (let t = 0; t <= SAMPLE_MS; t += INTERVAL_MS) {
  const snap = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.pc-stat-card[data-stat-liquid]')).map((card) => ({
      key: card.dataset.statLiquid,
      body: card.querySelector('.pc-stat-liquid-body')?.getAttribute('d') || '',
      waveA: card.querySelector('.pc-stat-liquid-wave-a')?.getAttribute('d') || '',
      waveB: card.querySelector('.pc-stat-liquid-wave-b')?.getAttribute('d') || '',
    }));
  });
  samples.push({
    t,
    cards: snap.map((c) => ({
      key: c.key,
      bodyRange: yStatsFromD(c.body).range,
      waveARange: yStatsFromD(c.waveA).range,
      waveBRange: yStatsFromD(c.waveB).range,
      bodyHash: c.body.slice(0, 120),
      waveAHash: c.waveA.slice(0, 120),
    })),
  });
  if (t < SAMPLE_MS) await page.waitForTimeout(INTERVAL_MS);
}

const keys = samples[0].cards.map((c) => c.key);
const byKey = keys.map((key) => {
  const series = samples.map((s) => s.cards.find((c) => c.key === key));
  const bodyRanges = series.map((s) => s.bodyRange);
  const waveARanges = series.map((s) => s.waveARange);
  const waveBRanges = series.map((s) => s.waveBRange);
  const bodyChanged = series.some((s, i) => i > 0 && s.bodyHash !== series[i - 1].bodyHash);
  const waveAChangedLate = series.slice(-5).some((s, i, arr) => i > 0 && s.waveAHash !== arr[i - 1].waveAHash);
  return {
    key,
    bodyRangeSeries: bodyRanges.map((n) => Number(n.toFixed(2))),
    waveARangeSeries: waveARanges.map((n) => Number(n.toFixed(2))),
    waveBRangeSeries: waveBRanges.map((n) => Number(n.toFixed(2))),
    bodyRangeLast: bodyRanges.at(-1),
    waveARangeLast: waveARanges.at(-1),
    waveBRangeLast: waveBRanges.at(-1),
    bodyStillMoving: bodyChanged,
    waveStillMovingLate: waveAChangedLate,
    firstBody: bodyRanges[0],
    firstWaveA: waveARanges[0],
  };
});

console.log(JSON.stringify({ sampleMs: SAMPLE_MS, intervalMs: INTERVAL_MS, byKey }, null, 2));
await browser.close();
