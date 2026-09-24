import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const indexHtml = readFileSync(resolve(process.cwd(), 'src/index.html'), 'utf8');
const mainJs = readFileSync(resolve(process.cwd(), 'src/js/main.js'), 'utf8');

describe('开屏像素溶解聚成 Logo', () => {
    it('提供全屏像素画布与 Logo 节点，并暴露 __splashPlay', () => {
        expect(indexHtml).toContain('id="splashPixelCanvas"');
        expect(indexHtml).toContain('id="splashIcon"');
        expect(indexHtml).toContain('id="splashTitle"');
        expect(indexHtml).toContain('window.__splashPlay');
        expect(indexHtml).toContain('splash-icon-ready');
        expect(indexHtml).toContain('splash-title-ready');
        expect(indexHtml).toContain('.splash-pixel-canvas');
        expect(indexHtml).toContain('position: absolute');
        expect(indexHtml).toContain('inset: 0');
    });

    it('粒子从视口四周边缘向中心 Logo 聚合，完成后清晰图案回弹', () => {
        expect(indexHtml).toContain('edgeSpawn');
        expect(indexHtml).toContain('window.innerWidth');
        expect(indexHtml).toContain('window.innerHeight');
        expect(indexHtml).toContain('LOGO_CSS');
        expect(indexHtml).toContain('scale(0.94)');
        expect(indexHtml).toContain('cubic-bezier(0.34, 1.56, 0.64, 1)');
    });

    it('像素采样后飞散再聚合并使用绝对时间推进', () => {
        expect(indexHtml).toContain('getImageData');
        expect(indexHtml).toContain('requestAnimationFrame');
        expect(indexHtml).toContain('performance.now()');
        expect(indexHtml).toContain('prefers-reduced-motion');
        expect(indexHtml).toContain('img.onerror');
    });

    it('启动时序等待开屏动画完成后再隐藏', () => {
        expect(mainJs).toContain('__splashPlay');
        expect(mainJs).toContain('await splashPlay');
        expect(mainJs).toContain('splash-hide');
    });
});
