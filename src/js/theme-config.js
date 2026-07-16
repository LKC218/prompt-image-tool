export const APPEARANCE_PREFERENCES = ['light', 'dark', 'system', 'scheduled'];

export const WORKBENCH_THEMES = [
    { key: 'sky', name: '晴空巡逻', color: '#2477D4', legacyAccents: ['blue'] },
    { key: 'caramel', name: '焦糖午后', color: '#C96A2C', legacyAccents: ['pink', 'yellow'] },
    { key: 'forest', name: '松林远足', color: '#2E8B69', legacyAccents: ['green'] },
    { key: 'night', name: '星夜侦察', color: '#5C62C9', legacyAccents: ['purple'] },
    { key: 'mint', name: '海盐薄荷', color: '#168A9A', legacyAccents: [] },
];

export const DEFAULT_APPEARANCE_PREFERENCE = 'system';
export const DEFAULT_WORKBENCH_THEME = 'sky';

const legacyThemeMap = new Map(
    WORKBENCH_THEMES.flatMap(theme => theme.legacyAccents.map(accent => [accent, theme.key]))
);

export function normalizeAppearancePreference(value) {
    return APPEARANCE_PREFERENCES.includes(value) ? value : DEFAULT_APPEARANCE_PREFERENCE;
}

export function normalizeWorkbenchTheme(value) {
    if (WORKBENCH_THEMES.some(theme => theme.key === value)) return value;
    return legacyThemeMap.get(value) || DEFAULT_WORKBENCH_THEME;
}

export function getWorkbenchTheme(value) {
    const key = normalizeWorkbenchTheme(value);
    return WORKBENCH_THEMES.find(theme => theme.key === key);
}

export function migrateLegacyThemePreferences(storage = window.localStorage) {
    const theme = normalizeWorkbenchTheme(
        storage.getItem('workbench-theme') || storage.getItem('pc-accent') || storage.getItem('accent')
    );
    const appearancePreference = normalizeAppearancePreference(storage.getItem('appearance-preference'));
    storage.setItem('workbench-theme', theme);
    storage.setItem('appearance-preference', appearancePreference);
    return { theme, appearancePreference };
}
