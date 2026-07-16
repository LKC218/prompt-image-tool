import {
    DEFAULT_APPEARANCE_PREFERENCE,
    DEFAULT_WORKBENCH_THEME,
    migrateLegacyThemePreferences,
    normalizeAppearancePreference,
    normalizeWorkbenchTheme,
} from './theme-config.js';

let state = {
    appearancePreference: DEFAULT_APPEARANCE_PREFERENCE,
    workbenchTheme: DEFAULT_WORKBENCH_THEME,
};
let mediaQuery = null;
let mediaQueryListener = null;
let scheduleTimer = null;

function getStorage() {
    try {
        return window.localStorage;
    } catch (error) {
        return null;
    }
}

function getScheduledAppearance(now = new Date()) {
    const hour = now.getHours();
    return hour >= 19 || hour < 7 ? 'dark' : 'light';
}

function resolveAppearance(preference = state.appearancePreference) {
    if (preference === 'dark' || preference === 'light') return preference;
    if (preference === 'scheduled') return getScheduledAppearance();
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function updateThemeColorMeta() {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = state.appearance === 'dark' ? '#101822' : '#F7F9FC';
}

function scheduleAppearanceTransition() {
    window.clearTimeout(scheduleTimer);
    if (state.appearancePreference !== 'scheduled') return;
    const now = new Date();
    const next = new Date(now);
    const hour = now.getHours();
    next.setHours(hour >= 19 || hour < 7 ? 7 : 19, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    scheduleTimer = window.setTimeout(() => {
        applyThemeState();
        scheduleAppearanceTransition();
    }, next.getTime() - now.getTime());
}

function watchSystemAppearance() {
    if (!window.matchMedia) return;
    if (!mediaQuery) mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    if (mediaQueryListener) mediaQuery.removeEventListener?.('change', mediaQueryListener);
    mediaQueryListener = () => {
        if (state.appearancePreference === 'system') applyThemeState();
    };
    mediaQuery.addEventListener?.('change', mediaQueryListener);
}

export function applyThemeState(nextState = {}) {
    state = {
        appearancePreference: normalizeAppearancePreference(nextState.appearancePreference || state.appearancePreference),
        workbenchTheme: normalizeWorkbenchTheme(nextState.workbenchTheme || state.workbenchTheme),
    };
    state.appearance = resolveAppearance();
    const root = document.documentElement;
    root.dataset.appearance = state.appearance;
    root.dataset.workbenchTheme = state.workbenchTheme;
    updateThemeColorMeta();
    scheduleAppearanceTransition();
    return getThemeState();
}

export function initTheme() {
    const storage = getStorage();
    if (storage) {
        try {
            const migrated = migrateLegacyThemePreferences(storage);
            state = {
                appearancePreference: migrated.appearancePreference,
                workbenchTheme: migrated.theme,
            };
        } catch (error) {
            state = {
                appearancePreference: DEFAULT_APPEARANCE_PREFERENCE,
                workbenchTheme: DEFAULT_WORKBENCH_THEME,
            };
        }
    }
    watchSystemAppearance();
    return applyThemeState();
}

export function setAppearancePreference(value) {
    state.appearancePreference = normalizeAppearancePreference(value);
    getStorage()?.setItem('appearance-preference', state.appearancePreference);
    return applyThemeState();
}

export function setWorkbenchTheme(value) {
    state.workbenchTheme = normalizeWorkbenchTheme(value);
    getStorage()?.setItem('workbench-theme', state.workbenchTheme);
    return applyThemeState();
}

export function getThemeState() {
    return { ...state, appearance: state.appearance || resolveAppearance() };
}

export function destroyThemeService() {
    window.clearTimeout(scheduleTimer);
    if (mediaQuery && mediaQueryListener) mediaQuery.removeEventListener?.('change', mediaQueryListener);
    mediaQueryListener = null;
}
