import { CARE_TYPES } from './plant-core.js';
import { showConfirmModal } from './pc-utils.js';

import s01 from '../assets/pc/plant/cycle/01-seed.png';
import s02 from '../assets/pc/plant/cycle/02-sprout.png';
import s03 from '../assets/pc/plant/cycle/03-young.png';
import s04 from '../assets/pc/plant/cycle/04-juvenile.png';
import s05 from '../assets/pc/plant/cycle/05-mid.png';
import s06 from '../assets/pc/plant/cycle/06-lush.png';
import s07 from '../assets/pc/plant/cycle/07-full.png';
import s08 from '../assets/pc/plant/cycle/08-peak.png';
import s09 from '../assets/pc/plant/cycle/09-bloom.png';
import s10 from '../assets/pc/plant/cycle/10-bloom-full.png';
import s11 from '../assets/pc/plant/cycle/11-wilt.png';
import s12 from '../assets/pc/plant/cycle/12-dead.png';

import dewSrc from '../assets/pc/plant/fx/dew.png';
import bugSrc from '../assets/pc/plant/fx/bug.png';
import butterflySrc from '../assets/pc/plant/fx/butterfly.png';
import leafFallSrc from '../assets/pc/plant/fx/leaf-fall.png';
import flowerSrc from '../assets/pc/plant/fx/flower.png';
import shovelSrc from '../assets/pc/plant/fx/shovel.png';
import waterDropSrc from '../assets/pc/plant/fx/water-drop.png';
import sparkleSrc from '../assets/pc/plant/fx/sparkle.png';
import dustSrc from '../assets/pc/plant/fx/dust.png';
import cursorLeafSrc from '../assets/pc/plant/fx/cursor-leaf.png';
import cursorWaterSrc from '../assets/pc/plant/fx/cursor-water.png';
import cursorFertilizeSrc from '../assets/pc/plant/fx/cursor-fertilize.png';
import cursorBugSrc from '../assets/pc/plant/fx/cursor-bug.png';
import cursorShovelSrc from '../assets/pc/plant/fx/cursor-shovel.png';

const CYCLE_SRC = {
    '01-seed': s01,
    '02-sprout': s02,
    '03-young': s03,
    '04-juvenile': s04,
    '05-mid': s05,
    '06-lush': s06,
    '07-full': s07,
    '08-peak': s08,
    '09-bloom': s09,
    '10-bloom-full': s10,
    '11-wilt': s11,
    '12-dead': s12,
};

// 装饰锚点（相对植物框百分比）
const DEW_POS = { 2: [72, 38], 4: [28, 42], 7: [60, 30], 11: [40, 28], 14: [68, 36], 17: [32, 34], 20: [55, 26], 24: [45, 24] };
const BUG_POS = { 5: [22, 48], 10: [75, 40], 15: [30, 35] };
const FLY_POS = { 8: [80, 28], 13: [18, 32], 18: [82, 30], 22: [16, 26], 25: [78, 22] };
const FLOWER_SPOTS = [
    [38, 22], [58, 18], [48, 28], [65, 30], [30, 32],
];

function careLabel(type) {
    if (type === 'watered') return '浇水';
    if (type === 'fertilized') return '施肥';
    return '除害';
}

function careIcon(type) {
    if (type === 'watered') {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3s6 7 6 11a6 6 0 1 1-12 0c0-4 6-11 6-11z"/></svg>';
    }
    if (type === 'fertilized') {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 5v2M12 17v2M5 12h2M17 12h2M7 7l1.5 1.5M15.5 15.5 17 17M17 7l-1.5 1.5M7 17l1.5-1.5"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="10" r="2"/><circle cx="16" cy="8" r="2"/><circle cx="14" cy="16" r="2"/><path d="M4 18c2-2 4-2 6 0M12 14c2-1 4-1 6 1"/></svg>';
}

function renderDecorations(state, payload) {
    const day = state.cycleDay;
    const dec = payload?.decorations || {};
    const bugCleared = Boolean(state.bugCleared);
    let html = '';

    if (dec.dew && DEW_POS[day]) {
        const [x, y] = DEW_POS[day];
        html += `<img class="pc-plant-fx pc-plant-fx--dew" src="${dewSrc}" alt="" style="left:${x}%;top:${y}%" draggable="false"/>`;
    }
    if (dec.bug && !bugCleared && BUG_POS[day]) {
        const [x, y] = BUG_POS[day];
        html += `<button type="button" class="pc-plant-fx-btn pc-plant-fx--bug" data-plant-bug data-cursor="plant-bug" title="除害" aria-label="除害" style="left:${x}%;top:${y}%"><img src="${bugSrc}" alt="" draggable="false"/></button>`;
    }
    if (dec.butterfly && FLY_POS[day]) {
        const [x, y] = FLY_POS[day];
        html += `<img class="pc-plant-fx pc-plant-fx--fly" src="${butterflySrc}" alt="" style="left:${x}%;top:${y}%" draggable="false"/>`;
    }
    const falls = Number(dec.leafFall) || 0;
    for (let i = 0; i < falls; i += 1) {
        html += `<img class="pc-plant-fx pc-plant-fx--fall pc-plant-fx--fall-${i}" src="${leafFallSrc}" alt="" draggable="false"/>`;
    }
    const flowers = Number(dec.flowerCount) || 0;
    for (let i = 0; i < flowers; i += 1) {
        const [x, y] = FLOWER_SPOTS[i % FLOWER_SPOTS.length];
        html += `<img class="pc-plant-fx pc-plant-fx--flower" src="${flowerSrc}" alt="" style="left:${x}%;top:${y}%" draggable="false"/>`;
    }
    return html;
}

function renderPlantCycle(payload, options = {}) {
    const state = payload.state;
    const day = state.cycleDay;
    const stageKey = payload.stageKey || state.stageKey || '01-seed';
    const src = CYCLE_SRC[stageKey] || s01;
    const pose = payload.pose || { tilt: 0, scale: 1, hue: 0 };
    const enter = options.enter ? ' is-entering' : '';
    const breathe = options.breathe ? ' is-breathe' : '';

    return `
        <div class="pc-plant-art pc-plant-art--${stageKey}${enter}${breathe}"
             data-stage-art="${stageKey}"
             data-cycle-day="${day}"
             style="--plant-scale:${pose.scale.toFixed(3)};--plant-tilt:${pose.tilt}deg;filter:hue-rotate(${(pose.hue || 0) * 4}deg)">
            <img class="pc-plant-stage-img" src="${src}" alt="" draggable="false"/>
            ${renderDecorations(state, payload)}
        </div>
    `;
}

function careCursorAttr(type) {
    if (type === 'watered') return 'plant-water';
    if (type === 'fertilized') return 'plant-fertilize';
    return 'plant-bug';
}

function renderCareBubble(state) {
    const care = state.care || {};
    const buttons = CARE_TYPES.map((type) => {
        const done = Boolean(care[type]);
        return `
            <button type="button"
                class="pc-plant-care-btn${done ? ' is-done' : ''}"
                data-plant-care="${type}"
                data-cursor="${careCursorAttr(type)}"
                ${done ? 'disabled' : ''}
                title="${careLabel(type)}"
                aria-label="${careLabel(type)}${done ? '（已完成）' : ''}">
                <span class="pc-plant-care-icon">${careIcon(type)}</span>
                <span class="pc-plant-care-text">${careLabel(type)}</span>
            </button>
        `;
    }).join('');
    return `<div class="pc-plant-care-bubble" hidden role="group" aria-label="植物养护">${buttons}</div>`;
}

function renderShovelBtn(state) {
    if (!state.canShovel) return '';
    return `
        <button type="button" class="pc-plant-shovel is-prominent" data-plant-shovel data-cursor="plant-shovel" title="铲除重开一轮" aria-label="铲除重开一轮">
            <img src="${shovelSrc}" alt="" draggable="false"/>
            <span>铲除 · 可重开</span>
        </button>
    `;
}

function renderDayBadge(state) {
    const day = Math.max(1, Math.min(30, state.cycleDay || 1));
    const active = Math.max(1, Number(state.activeDays) || 1);
    const cycles = Math.max(0, Number(state.totalCycles) || 0);
    const title = `本轮第 ${active} 天${cycles ? ` · 已完成 ${cycles} 轮` : ''}`;
    return `
        <div class="pc-plant-day-badge" title="${title}" aria-label="第 ${day} 天，共 30 天">
            <span class="pc-plant-day-badge-day">${day}</span><span class="pc-plant-day-badge-total">/30</span>
        </div>
    `;
}

function renderOfflineHint() {
    return `<div class="pc-plant-offline-hint" data-plant-offline hidden>保存暂存本地</div>`;
}

let trackerRef = null;
let rootEl = null;
let lastDay = null;
let lastStageKey = null;
let bubbleOpen = false;

function setBubbleOpen(open) {
    bubbleOpen = Boolean(open);
    const bubble = rootEl?.querySelector('.pc-plant-care-bubble');
    if (bubble) bubble.hidden = !bubbleOpen;
}

function syncView(payload) {
    if (!rootEl) return;
    const { state } = payload;
    const day = state.cycleDay;
    const stageKey = payload.stageKey || state.stageKey;
    const plantHost = rootEl.querySelector('[data-plant-host]');
    const dayChanged = lastDay != null && lastDay !== day;
    const stageChanged = lastStageKey && lastStageKey !== stageKey;

    if (plantHost) {
        const art = plantHost.querySelector('.pc-plant-art');
        if (!art || stageChanged || dayChanged || !art.dataset.stageArt) {
            plantHost.innerHTML = renderPlantCycle(payload, { enter: Boolean(stageChanged || dayChanged) });
            const el = plantHost.querySelector('.pc-plant-art');
            if (el && (stageChanged || dayChanged)) {
                el.addEventListener('animationend', () => el.classList.remove('is-entering'), { once: true });
            }
        }
    }
    lastDay = day;
    lastStageKey = stageKey;

    const bubble = rootEl.querySelector('.pc-plant-care-bubble');
    if (bubble) {
        CARE_TYPES.forEach((type) => {
            const btn = bubble.querySelector(`[data-plant-care="${type}"]`);
            if (!btn) return;
            const done = Boolean(state.care[type]);
            btn.classList.toggle('is-done', done);
            btn.disabled = done;
        });
    }

    const slot = rootEl.querySelector('.pc-plant-slot') || rootEl;
    slot.classList.toggle('is-ready-shovel', day >= 28);
    slot.classList.toggle('is-can-shovel', Boolean(state.canShovel));

    let shovel = rootEl.querySelector('.pc-plant-shovel');
    if (state.canShovel && !shovel) {
        slot.insertAdjacentHTML('beforeend', renderShovelBtn(state));
    } else if (!state.canShovel && shovel) {
        shovel.remove();
    }

    let badge = rootEl.querySelector('.pc-plant-day-badge');
    if (!badge) {
        slot.insertAdjacentHTML('beforeend', renderDayBadge(state));
    } else {
        const day = Math.max(1, Math.min(30, state.cycleDay || 1));
        const active = Math.max(1, Number(state.activeDays) || 1);
        const cycles = Math.max(0, Number(state.totalCycles) || 0);
        badge.innerHTML = `<span class="pc-plant-day-badge-day">${day}</span><span class="pc-plant-day-badge-total">/30</span>`;
        badge.title = `本轮第 ${active} 天${cycles ? ` · 已完成 ${cycles} 轮` : ''}`;
        badge.setAttribute('aria-label', `第 ${day} 天，共 30 天`);
    }

    const offlineEl = rootEl.querySelector('[data-plant-offline]');
    if (offlineEl) {
        const offline = payload.offline === true;
        offlineEl.hidden = !offline;
    }

    slot.dataset.stage = stageKey;
    slot.dataset.day = String(day);
    rootEl.dataset.stage = stageKey;
    rootEl.dataset.day = String(day);
}

/** 养护/交互一次性特效层（不改生长） */
function playCareFx(kind) {
    const art = rootEl?.querySelector('.pc-plant-art');
    if (!art) return;
    const layer = document.createElement('div');
    layer.className = 'pc-plant-fx-burst';
    layer.setAttribute('aria-hidden', 'true');

    if (kind === 'water') {
        for (let i = 0; i < 4; i += 1) {
            const img = document.createElement('img');
            img.src = waterDropSrc;
            img.className = `pc-plant-burst-drop pc-plant-burst-drop-${i}`;
            img.alt = '';
            img.draggable = false;
            layer.appendChild(img);
        }
        art.classList.add('is-wet');
    } else if (kind === 'fertilize') {
        for (let i = 0; i < 3; i += 1) {
            const img = document.createElement('img');
            img.src = sparkleSrc;
            img.className = `pc-plant-burst-spark pc-plant-burst-spark-${i}`;
            img.alt = '';
            img.draggable = false;
            layer.appendChild(img);
        }
        art.classList.add('is-fed');
    } else if (kind === 'bug') {
        const bug = art.querySelector('.pc-plant-fx--bug');
        if (bug) bug.classList.add('is-clearing');
    } else if (kind === 'shovel') {
        const dust = document.createElement('img');
        dust.src = dustSrc;
        dust.className = 'pc-plant-burst-dust';
        dust.alt = '';
        dust.draggable = false;
        layer.appendChild(dust);
        art.classList.add('is-digging');
    }

    art.appendChild(layer);
    window.setTimeout(() => {
        layer.remove();
        art.classList.remove('is-wet', 'is-fed', 'is-digging');
        art.querySelectorAll('.pc-plant-fx--bug.is-clearing').forEach((el) => el.classList.remove('is-clearing'));
    }, kind === 'shovel' ? 700 : 900);
}

function onCareClick(event) {
    if (event.target.closest('[data-plant-bug]')) {
        playCareFx('bug');
        trackerRef?.clearBug?.();
        return;
    }
    if (event.target.closest('[data-plant-shovel]')) {
        showConfirmModal('铲除后将从第 1 天重新开始，确定吗？', () => {
            playCareFx('shovel');
            window.setTimeout(() => trackerRef?.shovel?.(), 320);
        });
        return;
    }
    const btn = event.target.closest('[data-plant-care]');
    if (!btn || !trackerRef) return;
    const type = btn.dataset.plantCare;
    if (type === 'watered') playCareFx('water');
    if (type === 'fertilized') playCareFx('fertilize');
    if (type === 'deugged') playCareFx('bug');
    trackerRef.care(type);
}

function onPlantActivate(event) {
    if (event.target.closest('[data-plant-care]')
        || event.target.closest('[data-plant-bug]')
        || event.target.closest('[data-plant-shovel]')) return;
    setBubbleOpen(!bubbleOpen);
}

function onDocClick(event) {
    if (!rootEl) return;
    if (bubbleOpen && !event.target.closest('.pc-plant-slot')) {
        setBubbleOpen(false);
    }
}

export function mountPlantView(container, tracker) {
    rootEl = container;
    trackerRef = tracker;
    const styleEl = document.documentElement.style;
    styleEl.setProperty('--pc-plant-cursor-leaf', `url("${cursorLeafSrc}")`);
    styleEl.setProperty('--pc-plant-cursor-water', `url("${cursorWaterSrc}")`);
    styleEl.setProperty('--pc-plant-cursor-fertilize', `url("${cursorFertilizeSrc}")`);
    styleEl.setProperty('--pc-plant-cursor-bug', `url("${cursorBugSrc}")`);
    styleEl.setProperty('--pc-plant-cursor-shovel', `url("${cursorShovelSrc}")`);
    container.classList.add('pc-plant-anchor');
    container.innerHTML = `
        <div class="pc-plant-slot" data-cursor="plant-leaf">
            <button type="button" class="pc-plant-trigger" aria-label="我的植物" title="点击养护" data-cursor="plant-leaf">
                <span data-plant-host></span>
            </button>
            ${renderCareBubble(tracker.getState())}
            ${renderDayBadge(tracker.getState())}
            ${renderOfflineHint()}
            ${renderShovelBtn(tracker.getState())}
        </div>
    `;
    container.querySelector('.pc-plant-trigger')?.addEventListener('click', onPlantActivate);
    container.addEventListener('click', onCareClick);
    document.addEventListener('click', onDocClick, true);
    setBubbleOpen(false);
}

export function updatePlantView(payload) {
    syncView(payload);
}

export function destroyPlantView() {
    if (!rootEl) return;
    rootEl.removeEventListener('click', onCareClick);
    document.removeEventListener('click', onDocClick, true);
    rootEl.innerHTML = '';
    delete rootEl.dataset.stage;
    delete rootEl.dataset.day;
    rootEl = null;
    trackerRef = null;
    lastDay = null;
    lastStageKey = null;
    bubbleOpen = false;
}

