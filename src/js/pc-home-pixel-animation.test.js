import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { readPcCss } from './pc-css-test-utils.js';

const pcHomeJs = readFileSync(resolve(process.cwd(), 'src/js/pc-home.js'), 'utf8');
const pcLibraryJs = readFileSync(resolve(process.cwd(), 'src/js/pc-library.js'), 'utf8');
const pcCategoryJs = readFileSync(resolve(process.cwd(), 'src/js/pc-category.js'), 'utf8');
const pcSettingsJs = readFileSync(resolve(process.cwd(), 'src/js/pc-settings.js'), 'utf8');
const pcEditorJs = readFileSync(resolve(process.cwd(), 'src/js/pc-editor.js'), 'utf8');
const pcDetailJs = readFileSync(resolve(process.cwd(), 'src/js/pc-detail.js'), 'utf8');
const pcWelcomeBannerJs = readFileSync(resolve(process.cwd(), 'src/js/pc-welcome-banner.js'), 'utf8');
const pcCss = readPcCss();
const spritePath = resolve(process.cwd(), 'src/assets/pc/home-pixel-dog-sprite.png');

describe('PC 端共享顶部栏像素走路动画', () => {
    it('通过共享欢迎横幅装饰插槽复用序列帧动画', () => {
        expect(pcWelcomeBannerJs).toContain('decorationsHtml');
        expect(pcWelcomeBannerJs).toContain('pc-welcome-decorations');
        expect(pcWelcomeBannerJs).toContain('home-pixel-dog-sprite.png');
        expect(pcWelcomeBannerJs).toContain('renderPcWelcomeWalkAnimation');
        expect(pcWelcomeBannerJs).toContain('pc-welcome-pixel-stage-${variant}');
        expect(pcWelcomeBannerJs).toContain('--pc-pixel-dog-frame-count');
        expect(pcWelcomeBannerJs).toContain('--pc-pixel-dog-frame-duration');
        expect(pcHomeJs).toContain("renderPcWelcomeWalkAnimation({ variant: 'home' })");
    });

    it('接入目标共享横幅页面且不改动详情页顶部结构', () => {
        expect(pcLibraryJs).toContain("renderPcWelcomeWalkAnimation({ variant: 'library' })");
        expect(pcCategoryJs).toContain("renderPcWelcomeWalkAnimation({ variant: 'category' })");
        expect(pcSettingsJs).toContain("renderPcWelcomeWalkAnimation({ variant: 'settings' })");
        expect(pcEditorJs).toContain("renderPcWelcomeWalkAnimation({ variant: 'editor' })");
        expect(pcDetailJs).toContain("renderPcWelcomeWalkAnimation({ variant: 'detail' })");
        expect(pcDetailJs).toContain('pc-detail-walk-decoration');
    });

    it('包含各页面轨道、序列帧、响应式和低动效兜底样式', () => {
        expect(existsSync(spritePath)).toBe(true);
        ['home', 'library', 'category', 'settings', 'editor', 'detail'].forEach((variant) => {
            expect(pcCss).toContain(`.pc-welcome-pixel-stage-${variant}`);
        });
        expect(pcCss).toContain('.pc-detail-walk-decoration');
        expect(pcCss).toContain('@keyframes pc-pixel-dog-frames');
        expect(pcCss).toContain('@keyframes pc-pixel-dog-cross');
        expect(pcCss).toContain('--pc-pixel-dog-frame-count: 8;');
        expect(pcCss).toContain('--pc-pixel-dog-strip-w');
        expect(pcCss).toContain('steps(var(--pc-pixel-dog-frame-count), end)');
        expect(pcCss).toContain('@media (max-width: 1180px)');
        expect(pcCss).toContain('@media (max-width: 1280px)');
        expect(pcCss).toContain('prefers-reduced-motion: reduce');
        expect(pcCss).toContain('animation: none !important');
    });

    it('新精灵图保持透明背景且体积可控', () => {
        expect(statSync(spritePath).size).toBeLessThan(200000);
    });
});
