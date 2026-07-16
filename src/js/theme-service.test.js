import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getThemeState, initTheme, setAppearancePreference, setWorkbenchTheme } from './theme-service.js';

describe('主题服务', () => {
    beforeEach(() => {
        localStorage.clear();
        document.documentElement.removeAttribute('data-appearance');
        document.documentElement.removeAttribute('data-workbench-theme');
        window.matchMedia = vi.fn(() => ({
            matches: false,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }));
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('迁移旧端主题键并应用统一根节点属性', () => {
        localStorage.setItem('pc-accent', 'purple');

        initTheme();

        expect(localStorage.getItem('workbench-theme')).toBe('night');
        expect(document.documentElement.dataset.workbenchTheme).toBe('night');
        expect(document.documentElement.dataset.appearance).toBe('light');
    });

    it('将历史粉色偏好迁移为蔷薇主题', () => {
        localStorage.setItem('accent', 'pink');

        initTheme();

        expect(localStorage.getItem('workbench-theme')).toBe('rose');
        expect(document.documentElement.dataset.workbenchTheme).toBe('rose');
    });

    it('独立保存工作台主题与固定外观模式', () => {
        initTheme();
        setWorkbenchTheme('forest');
        setAppearancePreference('dark');

        expect(getThemeState()).toMatchObject({
            workbenchTheme: 'forest',
            appearancePreference: 'dark',
            appearance: 'dark',
        });
        expect(localStorage.getItem('workbench-theme')).toBe('forest');
        expect(localStorage.getItem('appearance-preference')).toBe('dark');
        expect(document.documentElement.dataset.appearance).toBe('dark');
    });
});
