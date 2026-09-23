import {
    DEBUG_STATE_KEY,
    DEBUG_STORAGE_KEY,
    HEARTBEAT_MS,
    STORAGE_KEY,
    applyCare,
    applyCareAll,
    clearBug,
    createDebugState,
    createInitialState,
    decorationsForDay,
    dayPose,
    formatDayLabel,
    normalizeDebugState,
    normalizeState,
    refreshCycle,
    setCycleDayDirect,
    shovelCycle,
    stageKeyFromDay,
} from './plant-core.js';
import { loadPlantWithFallback, persistPlant, isOfflineHintVisible } from './plant-persist.js';

function safeParse(raw) {
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function stateKeyFor(debug, devEnabled) {
    if (devEnabled && debug && (debug.speed !== 1 || debug.forceDebugState || debug.dayOffset)) {
        return DEBUG_STATE_KEY;
    }
    return STORAGE_KEY;
}

export function loadPlantState(storage = window.localStorage, key = STORAGE_KEY) {
    try {
        return normalizeState(safeParse(storage.getItem(key)));
    } catch {
        return createInitialState();
    }
}

export function savePlantState(state, storage = window.localStorage, key = STORAGE_KEY) {
    try {
        storage.setItem(key, JSON.stringify(state));
    } catch {
        // ignore
    }
}

export function loadDebugConfig(storage = window.localStorage) {
    try {
        return normalizeDebugState(safeParse(storage.getItem(DEBUG_STORAGE_KEY)));
    } catch {
        return null;
    }
}

export function saveDebugConfig(debug, storage = window.localStorage) {
    try {
        if (!debug) storage.removeItem(DEBUG_STORAGE_KEY);
        else storage.setItem(DEBUG_STORAGE_KEY, JSON.stringify(debug));
    } catch {
        // ignore
    }
}

/**
 * 发布包：调试面板彻底关闭。
 * 仅内部可通过 window.__PC_PLANT_DEV__ = true 临时打开（不会出现在 UI 构建默认路径）。
 */
export function isPlantDevEnabled() {
    if (typeof window === 'undefined') return false;
    return Boolean(window.__PC_PLANT_DEV__);
}

function buildPayload(state, debug, devEnabled) {
    const day = state.cycleDay;
    return {
        state,
        debug,
        devEnabled,
        day,
        dayLabel: formatDayLabel(day),
        stageKey: state.stageKey || stageKeyFromDay(day),
        pose: dayPose(day),
        decorations: decorationsForDay(day),
        offline: isOfflineHintVisible(),
    };
}

/**
 * 植物生命周期：日历轮回 + 养护/除害/铲除 + debug
 * 正式档双写 localStorage + API（DATA_DIR/plant.json）
 */
export function createPlantTracker(options = {}) {
    const storage = options.storage || window.localStorage;
    const apiStorage = options.apiStorage || null;
    const onChange = typeof options.onChange === 'function' ? options.onChange : () => {};
    const devEnabled = options.devEnabled ?? isPlantDevEnabled();

    let debug = devEnabled ? (loadDebugConfig(storage) || createDebugState()) : null;
    let state = loadPlantState(storage, stateKeyFor(debug, devEnabled));
    let heartbeatTimer = null;
    let running = false;
    let saveTimer = null;
    let saveInFlight = false;
    let pendingApiSave = false;

    function persistState({ immediate = false } = {}) {
        const key = stateKeyFor(debug, devEnabled);
        savePlantState(state, storage, key);
        if (key !== STORAGE_KEY || !apiStorage) return;
        if (immediate) {
            flushApiSave();
            return;
        }
        scheduleApiSave();
    }

    function scheduleApiSave() {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = window.setTimeout(() => {
            saveTimer = null;
            flushApiSave();
        }, 500);
    }

    async function flushApiSave() {
        if (saveInFlight) {
            pendingApiSave = true;
            return;
        }
        if (stateKeyFor(debug, devEnabled) !== STORAGE_KEY) return;
        saveInFlight = true;
        try {
            await persistPlant(apiStorage, state, storage);
        } finally {
            saveInFlight = false;
            emit();
            if (pendingApiSave) {
                pendingApiSave = false;
                flushApiSave();
            }
        }
    }

    function emit() {
        onChange(buildPayload(state, debug, devEnabled));
    }

    function reloadFromActiveKey() {
        state = loadPlantState(storage, stateKeyFor(debug, devEnabled));
    }

    function heartbeat() {
        const prevDay = state.cycleDay;
        const prevStage = state.stageKey;
        state = refreshCycle(state, Date.now());
        if (state.cycleDay !== prevDay || state.stageKey !== prevStage) {
            persistState({ immediate: true });
        }
        emit();
    }

    async function start() {
        if (running) return;
        running = true;
        if (!devEnabled || stateKeyFor(debug, devEnabled) === STORAGE_KEY) {
            const loaded = await loadPlantWithFallback(apiStorage, storage);
            state = loaded.plant;
        } else {
            reloadFromActiveKey();
        }
        state = refreshCycle(state, Date.now());
        persistState({ immediate: true });
        heartbeatTimer = window.setInterval(heartbeat, HEARTBEAT_MS * 4);
        emit();
    }

    function stop() {
        if (!running) return;
        if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = null;
        }
        persistState({ immediate: true });
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
        }
        running = false;
        emit();
    }

    function care(type) {
        state = applyCare(state, type, Date.now());
        persistState({ immediate: true });
        emit();
        return state;
    }

    function careAll() {
        state = applyCareAll(state, Date.now());
        persistState({ immediate: true });
        emit();
        return state;
    }

    function debugClearBug() {
        state = clearBug(state, Date.now());
        persistState({ immediate: true });
        emit();
        return state;
    }

    function shovel() {
        state = shovelCycle(state, Date.now());
        persistState({ immediate: true });
        emit();
        return state;
    }

    function setDebugSpeed(speed) {
        if (!devEnabled) return null;
        const nextSpeed = [1, 10, 50].includes(Number(speed)) ? Number(speed) : 1;
        debug = {
            ...(debug || createDebugState()),
            speed: nextSpeed,
            forceDebugState: nextSpeed !== 1 || Boolean(debug?.forceDebugState),
            updatedAt: Date.now(),
        };
        if (nextSpeed === 1) debug.forceDebugState = false;
        saveDebugConfig(debug, storage);
        reloadFromActiveKey();
        emit();
        return debug;
    }

    function debugSetDay(day) {
        if (!devEnabled) return null;
        debug = {
            ...(debug || createDebugState()),
            forceDebugState: true,
            dayOffset: Number(day) || 1,
            updatedAt: Date.now(),
        };
        saveDebugConfig(debug, storage);
        state = setCycleDayDirect(loadPlantState(storage, DEBUG_STATE_KEY), day, Date.now());
        persistState();
        emit();
        return state;
    }

    function clearDebug() {
        try {
            storage.removeItem(DEBUG_STATE_KEY);
        } catch {
            // ignore
        }
        debug = createDebugState();
        saveDebugConfig(debug, storage);
        reloadFromActiveKey();
        emit();
    }

    return {
        start,
        stop,
        care,
        careAll,
        clearBug: debugClearBug,
        shovel,
        setDebugSpeed,
        debugSetDay,
        clearDebug,
        getState: () => state,
        getDebug: () => debug,
        isDev: () => devEnabled,
    };
}
