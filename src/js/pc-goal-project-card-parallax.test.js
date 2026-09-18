import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sharedJs = readFileSync(resolve(process.cwd(), 'src/js/pc-card-parallax.js'), 'utf8');
const goalProjectsJs = readFileSync(resolve(process.cwd(), 'src/js/pc-goal-projects.js'), 'utf8');
const gamesHubJs = readFileSync(resolve(process.cwd(), 'src/js/pc-games-hub.js'), 'utf8');
const goalPlanCss = readFileSync(resolve(process.cwd(), 'src/css/pc/08-goal-plan.css'), 'utf8');
const planeCss = readFileSync(resolve(process.cwd(), 'src/css/pc/10-plane.css'), 'utf8');

describe('共享卡片 3D 视差交互', () => {
    it('共享模块提供 tilt 变量与指针绑定', () => {
        expect(sharedJs).toContain('setupCardParallaxTilt');
        expect(sharedJs).toContain('CARD_PARALLAX_TILT_MAX');
        expect(sharedJs).toContain('--pc-card-tilt-rx');
        expect(sharedJs).toContain('--pc-card-tilt-ry');
        expect(sharedJs).toContain('--pc-card-tilt-px');
        expect(sharedJs).toContain('--pc-card-tilt-mx');
        expect(sharedJs).toContain("classList.add('is-tilting')");
        expect(sharedJs).toContain('requestAnimationFrame');
        expect(sharedJs).toContain('prefers-reduced-motion: reduce');
        expect(sharedJs).toContain('hover: hover');
        expect(sharedJs).toContain("e.pointerType !== 'mouse'");
    });

    it('目标计划与摸鱼时间都接入共享视差', () => {
        expect(goalProjectsJs).toContain("from './pc-card-parallax.js'");
        expect(goalProjectsJs).toContain('setupCardParallaxTilt(container');
        expect(goalProjectsJs).toContain("cardSelector: '.pc-goal-project-card'");
        expect(gamesHubJs).toContain("from './pc-card-parallax.js'");
        expect(gamesHubJs).toContain('setupCardParallaxTilt(pageEl');
        expect(gamesHubJs).toContain("GAMES_CARD_SELECTOR = '.pc-games-card'");
        expect(gamesHubJs).toContain('clearCardParallaxIn');
    });

    it('目标计划 CSS 使用共享 tilt 变量与高光层', () => {
        expect(goalPlanCss).toContain('--pc-card-tilt-rx');
        expect(goalPlanCss).toContain('--pc-card-tilt-ry');
        expect(goalPlanCss).toContain('--pc-card-lift');
        expect(goalPlanCss).toContain('preserve-3d');
        expect(goalPlanCss).toContain('.pc-goal-project-cover::after');
        expect(goalPlanCss).toContain('--pc-card-tilt-rx: 0deg !important');
        expect(goalPlanCss).toContain('perspective: 1000px');
    });

    it('摸鱼时间 CSS 提供同等 3D 视差与低动效兜底', () => {
        expect(planeCss).toContain('.pc-games-grid');
        expect(planeCss).toContain('perspective: 1000px');
        expect(planeCss).toContain('.pc-games-card.is-tilting');
        expect(planeCss).toContain('--pc-card-tilt-rx');
        expect(planeCss).toContain('--pc-card-tilt-ry');
        expect(planeCss).toContain('--pc-card-cover-scale');
        expect(planeCss).toContain('.pc-games-card-cover::after');
        expect(planeCss).toContain('translateZ(24px)');
        expect(planeCss).toContain('@media (prefers-reduced-motion: reduce)');
        expect(planeCss).toContain('--pc-card-tilt-rx: 0deg !important');
    });
});
