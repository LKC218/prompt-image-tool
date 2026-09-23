import { describe, expect, it } from 'vitest';
import {
    LIQ_FILL_MAX,
    LIQ_FILL_MIN,
    LIQ_POINTS,
    buildLiquidPaths,
    clampStatFill,
    createStatLiquidController,
    pointsToPath,
    sampleSurface,
} from './pc-stat-liquid.js';

function yValuesFromPath(d) {
    const tokens = d.match(/-?\d+\.\d+|-?\d+/g) || [];
    const ys = [];
    for (let i = 1; i < tokens.length; i += 2) ys.push(Number(tokens[i]));
    return ys;
}

describe('pc-stat-liquid 解析液面', () => {
    it('夹取中位液面高度', () => {
        expect(clampStatFill(0.1)).toBe(LIQ_FILL_MIN);
        expect(clampStatFill(0.9)).toBe(LIQ_FILL_MAX);
        expect(clampStatFill(0.46)).toBe(0.46);
        expect(clampStatFill('nope')).toBe(0.45);
    });

    it('pointsToPath 生成可解析 SVG path', () => {
        const pts = sampleSurface(0.45, 0, 'body');
        const d = pointsToPath(pts, true);
        expect(d.startsWith('M ')).toBe(true);
        expect(d).toContain('Q ');
        expect(d.endsWith('Z') || d.trim().endsWith('Z')).toBe(true);
        expect(pts.length).toBe(LIQ_POINTS);
    });

    it('30 秒解析波表面偏移有界且 path 持续变化', () => {
        const fill = 0.45;
        const baseY = 100 * (1 - fill);
        const bound = 12;
        let prev = null;
        let changed = 0;
        for (let t = 0; t <= 30; t += 0.05) {
            const paths = buildLiquidPaths(fill, t);
            for (const d of [paths.body, paths.waveA, paths.waveB]) {
                const ys = yValuesFromPath(d).filter((y) => y < 110);
                expect(ys.length).toBeGreaterThan(5);
                for (const y of ys) {
                    // wave 层含 bias(2.4/4.8)，按相对 body 基线的整体偏移断言
                    expect(Math.abs(y - baseY)).toBeLessThanOrEqual(bound);
                }
            }
            if (prev && paths.body !== prev) changed += 1;
            prev = paths.body;
        }
        expect(changed).toBeGreaterThan(100);
    });

    it('双层波与 body 路径不同', () => {
        const paths = buildLiquidPaths(0.46, 1.23);
        expect(paths.body).not.toBe(paths.waveA);
        expect(paths.waveA).not.toBe(paths.waveB);
    });
});

describe('createStatLiquidController', () => {
    it('无卡片时返回 null', () => {
        const el = document.createElement('div');
        expect(createStatLiquidController(el)).toBeNull();
    });

    it('挂载后写出有界 path，destroy 后不再要求 rAF 句柄', () => {
        document.body.innerHTML = `
            <div class="pc-stat-card" data-stat-liquid="total" data-stat-fill="0.46">
                <div class="pc-stat-liquid">
                    <svg>
                        <path class="pc-stat-liquid-wave pc-stat-liquid-wave-b"></path>
                        <path class="pc-stat-liquid-body"></path>
                        <path class="pc-stat-liquid-wave pc-stat-liquid-wave-a"></path>
                    </svg>
                </div>
            </div>
        `;
        const pageEl = document.body;
        const controller = createStatLiquidController(pageEl);
        expect(controller).toBeTruthy();
        const body = document.querySelector('.pc-stat-liquid-body');
        expect(body.getAttribute('d').startsWith('M ')).toBe(true);
        controller.setFill('total', 0.48);
        expect(pageEl.querySelector('[data-stat-liquid="total"]').dataset.statFill).toBe('0.48');
        controller.destroy();
        document.body.innerHTML = '';
    });
});
