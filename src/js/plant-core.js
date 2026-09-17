export const STORAGE_KEY = 'pc-plant-state';
export const DEBUG_STORAGE_KEY = 'pc-plant-debug';
export const DEBUG_STATE_KEY = 'pc-plant-debug-state';

export const CYCLE_DAYS = 30;
export const DAY_MS = 86_400_000;
export const HEARTBEAT_MS = 15_000;

export const CARE_TYPES = ['watered', 'fertilized', 'deugged'];

/** day(1-30) → 阶段整图档名 */
export const STAGE_BY_DAY = {
    1: '01-seed', 2: '01-seed',
    3: '02-sprout', 4: '02-sprout', 5: '02-sprout',
    6: '03-young', 7: '03-young', 8: '03-young',
    9: '04-juvenile', 10: '04-juvenile', 11: '04-juvenile',
    12: '05-mid', 13: '05-mid', 14: '05-mid',
    15: '06-lush', 16: '06-lush', 17: '06-lush',
    18: '07-full', 19: '07-full',
    20: '08-peak', 21: '08-peak',
    22: '09-bloom', 23: '09-bloom',
    24: '10-bloom-full', 25: '10-bloom-full', 26: '10-bloom-full',
    27: '11-wilt', 28: '11-wilt',
    29: '12-dead', 30: '12-dead',
};

export const DEW_DAYS = new Set([2, 4, 7, 11, 14, 17, 20, 24]);
export const BUG_DAYS = new Set([5, 10, 15]);
export const FLY_DAYS = new Set([8, 13, 18, 22, 25]);
export const FALL_DAYS = new Set([27, 28, 29, 30]);
export const FLOWER_COUNT = {
    20: 1, 21: 2, 22: 2, 23: 3, 24: 3, 25: 3, 26: 2, 28: 1,
};

export function dayKeyFromTimestamp(ts) {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function cycleDayFromStart(cycleStartAt, now = Date.now()) {
    const start = Number(cycleStartAt);
    if (!Number.isFinite(start) || start <= 0) return 1;
    const elapsed = Math.max(0, now - start);
    return Math.min(CYCLE_DAYS, Math.floor(elapsed / DAY_MS) + 1);
}

export function stageKeyFromDay(day) {
    const d = Math.max(1, Math.min(CYCLE_DAYS, Math.floor(day) || 1));
    return STAGE_BY_DAY[d] || '01-seed';
}

export function dayPose(day) {
    const d = Math.max(1, Math.min(CYCLE_DAYS, Math.floor(day) || 1));
    return {
        tilt: ((d * 17) % 7) - 3,
        scale: 0.97 + ((d * 13) % 7) * 0.01,
        hue: ((d * 5) % 3) - 1,
    };
}

export function decorationsForDay(day) {
    const d = Math.max(1, Math.min(CYCLE_DAYS, Math.floor(day) || 1));
    return {
        dew: DEW_DAYS.has(d),
        bug: BUG_DAYS.has(d),
        butterfly: FLY_DAYS.has(d),
        leafFall: FALL_DAYS.has(d) ? (d >= 29 ? 2 : 1) : 0,
        flowerCount: FLOWER_COUNT[d] || 0,
    };
}

export function createInitialState(now = Date.now()) {
    return {
        cycleStartAt: now,
        cycleDay: 1,
        todayKey: dayKeyFromTimestamp(now),
        care: {
            watered: false,
            fertilized: false,
            deugged: false,
        },
        // 本轮累计打开天数（展示用，不影响生长）
        activeDays: 1,
        lastSeenKey: dayKeyFromTimestamp(now),
        // 害虫是否已被处理（仅 BUG_DAYS）
        bugCleared: false,
        stageKey: '01-seed',
        canShovel: false,
        // 历史铲除次数（跨轮回累计）
        totalCycles: 0,
    };
}

export function isCareComplete(care) {
    return Boolean(care && care.watered && care.fertilized && care.deugged);
}

/** 按当前时间刷新 day/stage/跨日 care */
export function refreshCycle(state, now = Date.now()) {
    if (!state || typeof state !== 'object') return createInitialState(now);
    const cycleStartAt = Number(state.cycleStartAt) || now;
    const cycleDay = cycleDayFromStart(cycleStartAt, now);
    const todayKey = dayKeyFromTimestamp(now);
    let care = state.care && typeof state.care === 'object' ? { ...state.care } : createInitialState(now).care;
    let bugCleared = Boolean(state.bugCleared);
    let activeDays = Math.max(1, Number(state.activeDays) || 1);
    const lastSeenKey = typeof state.lastSeenKey === 'string' ? state.lastSeenKey : todayKey;

    if (todayKey !== state.todayKey) {
        care = { watered: false, fertilized: false, deugged: false };
        bugCleared = false;
        if (todayKey !== lastSeenKey) {
            activeDays += 1;
        }
    }

    const stageKey = stageKeyFromDay(cycleDay);
    return {
        cycleStartAt,
        cycleDay,
        todayKey,
        care,
        activeDays,
        lastSeenKey: todayKey,
        bugCleared,
        stageKey,
        canShovel: cycleDay >= CYCLE_DAYS,
        totalCycles: Math.max(0, Number(state.totalCycles) || 0),
    };
}

export function normalizeState(raw, now = Date.now()) {
    if (!raw || typeof raw !== 'object') return createInitialState(now);
    const base = {
        cycleStartAt: Number(raw.cycleStartAt) || now,
        todayKey: typeof raw.todayKey === 'string' ? raw.todayKey : dayKeyFromTimestamp(now),
        care: raw.care && typeof raw.care === 'object' ? raw.care : {},
        activeDays: Number(raw.activeDays) || 1,
        lastSeenKey: typeof raw.lastSeenKey === 'string' ? raw.lastSeenKey : undefined,
        bugCleared: Boolean(raw.bugCleared),
        totalCycles: Math.max(0, Number(raw.totalCycles) || 0),
    };
    return refreshCycle(base, now);
}

export function applyCare(state, type, now = Date.now()) {
    if (!CARE_TYPES.includes(type)) return state;
    const next = refreshCycle(state, now);
    if (next.care[type]) return next;
    return refreshCycle({
        ...next,
        care: { ...next.care, [type]: true },
    }, now);
}

export function applyCareAll(state, now = Date.now()) {
    let next = refreshCycle(state, now);
    for (const type of CARE_TYPES) {
        next = applyCare(next, type, now);
    }
    return next;
}

/** 除害：清除当日瓢虫（不加速生长） */
export function clearBug(state, now = Date.now()) {
    const next = refreshCycle(state, now);
    return refreshCycle({ ...next, bugCleared: true }, now);
}

/** 铲除：仅 day>=30 可重开轮回 */
export function shovelCycle(state, now = Date.now()) {
    const next = refreshCycle(state, now);
    if (!next.canShovel) return next;
    const fresh = createInitialState(now);
    return refreshCycle({
        ...fresh,
        activeDays: 1,
        cycleStartAt: now,
        totalCycles: (Number(next.totalCycles) || 0) + 1,
    }, now);
}

/** 强制重开（设置页用，不要求 day>=30） */
export function forceResetCycle(state, now = Date.now()) {
    const prev = refreshCycle(state, now);
    const fresh = createInitialState(now);
    return refreshCycle({
        ...fresh,
        activeDays: 1,
        cycleStartAt: now,
        totalCycles: Math.max(0, Number(prev.totalCycles) || 0),
    }, now);
}

/** debug：把轮回拨到指定天（写 debug 档） */
export function setCycleDayDirect(state, day, now = Date.now()) {
    const d = Math.max(1, Math.min(CYCLE_DAYS, Math.floor(Number(day) || 1)));
    const cycleStartAt = now - (d - 1) * DAY_MS;
    return refreshCycle({
        ...(state || createInitialState(now)),
        cycleStartAt,
        todayKey: dayKeyFromTimestamp(now),
        lastSeenKey: dayKeyFromTimestamp(now),
    }, now);
}

export function createDebugState(now = Date.now()) {
    return {
        enabled: true,
        speed: 1,
        dayOffset: 0,
        updatedAt: now,
    };
}

export function normalizeDebugState(raw, now = Date.now()) {
    if (!raw || typeof raw !== 'object') return null;
    const speed = Number(raw.speed);
    return {
        enabled: true,
        speed: [1, 10, 50].includes(speed) ? speed : 1,
        dayOffset: Number(raw.dayOffset) || 0,
        updatedAt: Number(raw.updatedAt) || now,
    };
}

export function formatActiveMs(ms) {
    const totalSec = Math.floor(Math.max(0, ms) / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
    if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
    return `${s}s`;
}

export function formatDayLabel(cycleDay) {
    return `第 ${Math.max(1, Math.min(CYCLE_DAYS, cycleDay))} 天 / ${CYCLE_DAYS}`;
}
