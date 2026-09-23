// 首页统计卡：静置液面 + 双层解析正弦波浪（无鼠标交互、数学有界）
const LIQ_VIEW_W = 200;
const LIQ_VIEW_H = 100;
const LIQ_POINTS = 32;

// 液面夹在卡片中位区间，避免“快满/见底”
const LIQ_FILL_MIN = 0.42;
const LIQ_FILL_MAX = 0.5;
const LIQ_FILL_DEFAULT = 0.45;

// 每层：竖直偏置 + 两组行波（振幅常数，对任意 phase 有界）
const LIQ_LAYERS = {
    body: {
        bias: 0,
        terms: [
            { k: 1.25, w: 1.6, p: 0, a: 1.8 },
            { k: 0.7, w: 1.1, p: 0.4, a: 1.0 },
        ],
    },
    waveA: {
        bias: 2.4,
        terms: [
            { k: 1.35, w: 2.0, p: 0.6, a: 2.2 },
            { k: 0.85, w: 1.35, p: 1.1, a: 1.2 },
        ],
    },
    waveB: {
        bias: 4.8,
        terms: [
            { k: 1.1, w: 1.45, p: 1.2, a: 2.0 },
            { k: 0.55, w: 0.9, p: 0.3, a: 1.4 },
        ],
    },
};

function prefersReducedMotion() {
    return !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
}

function clampStatFill(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return LIQ_FILL_DEFAULT;
    return Math.min(LIQ_FILL_MAX, Math.max(LIQ_FILL_MIN, num));
}

function surfaceOffset(xNorm, phase, layerName) {
    const layer = LIQ_LAYERS[layerName] || LIQ_LAYERS.body;
    let sum = 0;
    for (const term of layer.terms) {
        sum += Math.sin(xNorm * Math.PI * 2 * term.k + phase * term.w + term.p) * term.a;
    }
    return sum;
}

function sampleSurface(fill, phase, layerName) {
    const layer = LIQ_LAYERS[layerName] || LIQ_LAYERS.body;
    const baseY = LIQ_VIEW_H * (1 - clampStatFill(fill));
    const pts = new Array(LIQ_POINTS);
    for (let i = 0; i < LIQ_POINTS; i += 1) {
        const xNorm = i / (LIQ_POINTS - 1);
        const x = xNorm * LIQ_VIEW_W;
        pts[i] = {
            x,
            y: baseY + layer.bias + surfaceOffset(xNorm, phase, layerName),
        };
    }
    return pts;
}

function pointsToPath(pts, closeToBottom) {
    if (!pts.length) return '';
    let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
    for (let i = 0; i < pts.length - 1; i += 1) {
        const a = pts[i];
        const b = pts[i + 1];
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        d += ` Q ${a.x.toFixed(2)} ${a.y.toFixed(2)} ${mx.toFixed(2)} ${my.toFixed(2)}`;
    }
    const last = pts[pts.length - 1];
    d += ` L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`;
    if (closeToBottom) {
        d += ` L ${last.x.toFixed(2)} 120 L ${pts[0].x.toFixed(2)} 120 Z`;
    }
    return d;
}

function buildLiquidPaths(fill, phase) {
    return {
        body: pointsToPath(sampleSurface(fill, phase, 'body'), true),
        waveA: pointsToPath(sampleSurface(fill, phase, 'waveA'), true),
        waveB: pointsToPath(sampleSurface(fill, phase, 'waveB'), true),
    };
}

function createCardLiquid(card) {
    const body = card.querySelector('.pc-stat-liquid-body');
    const waveA = card.querySelector('.pc-stat-liquid-wave-a');
    const waveB = card.querySelector('.pc-stat-liquid-wave-b');
    if (!body || !waveA || !waveB) return null;

    const state = {
        fill: clampStatFill(card.dataset.statFill || LIQ_FILL_DEFAULT),
        phase: Math.random() * Math.PI * 2,
        body,
        waveA,
        waveB,
    };

    function paint() {
        const paths = buildLiquidPaths(state.fill, state.phase);
        body.setAttribute('d', paths.body);
        waveA.setAttribute('d', paths.waveA);
        waveB.setAttribute('d', paths.waveB);
    }

    function step(dt, reduced) {
        if (!reduced) state.phase += Math.min(0.05, Math.max(0, dt || 0));
        paint();
    }

    paint();
    return {
        state,
        step,
        setFill(fill) {
            state.fill = clampStatFill(fill);
            card.dataset.statFill = String(state.fill);
            paint();
        },
    };
}

function createStatLiquidController(pageEl) {
    if (!pageEl) return null;
    const cards = Array.from(pageEl.querySelectorAll('.pc-stat-card[data-stat-liquid]'));
    if (!cards.length) return null;

    const items = cards.map((card) => ({
        card,
        liquid: createCardLiquid(card),
    })).filter((item) => item.liquid);

    if (!items.length) return null;

    const reduced = prefersReducedMotion();
    let rafId = 0;
    let lastTs = 0;
    let alive = true;

    function frame(ts) {
        if (!alive) return;
        if (!lastTs) lastTs = ts;
        const dt = Math.min(0.05, (ts - lastTs) / 1000);
        lastTs = ts;
        items.forEach((item) => item.liquid.step(dt, reduced));
        if (!reduced && alive) rafId = requestAnimationFrame(frame);
    }

    if (reduced) {
        items.forEach((item) => item.liquid.step(0, true));
    } else {
        rafId = requestAnimationFrame(frame);
    }

    return {
        setFill(key, fill) {
            const target = items.find((item) => item.card.dataset.statLiquid === key);
            if (target) target.liquid.setFill(fill);
        },
        setFills(map) {
            if (!map) return;
            Object.keys(map).forEach((key) => {
                const target = items.find((item) => item.card.dataset.statLiquid === key);
                if (target) target.liquid.setFill(map[key]);
            });
        },
        destroy() {
            alive = false;
            if (rafId) cancelAnimationFrame(rafId);
            rafId = 0;
        },
    };
}

export {
    createStatLiquidController,
    clampStatFill,
    buildLiquidPaths,
    sampleSurface,
    pointsToPath,
    LIQ_POINTS,
    LIQ_FILL_MIN,
    LIQ_FILL_MAX,
    LIQ_FILL_DEFAULT,
};
