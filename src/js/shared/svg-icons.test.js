import { describe, expect, it } from 'vitest';
import {
    CANONICAL_SVG_MAP,
    renderSvgIcon,
    resolveSvgIconName,
    svgToDataUri,
} from './svg-icons.js';
import { pcIcon, PC_ICON_MAP } from '../pc/pc-icon-assets.js';
import { mobileIcon, MOBILE_ICONS } from '../mobile/mobile-icon-assets.js';

describe('svg-icons 统一图标引擎', () => {
    it('所有注册 SVG 资产均不含硬编码色值（仅使用 currentColor 或 none）', () => {
        for (const [name, raw] of Object.entries(CANONICAL_SVG_MAP)) {
            expect(raw, `${name} 应以 <svg 开头`).toMatch(/^<svg\b/);
            expect(raw.toLowerCase(), `${name} 不应包含 hex 色值`).not.toContain('#');
            expect(raw.toLowerCase(), `${name} 不应包含 black 硬编码`).not.toContain('black');
        }
    });

    it('支持 camelCase、kebab-case 与业务语义别名解析', () => {
        expect(resolveSvgIconName('chevronRight')).toBe('chevron-right');
        expect(resolveSvgIconName('arrowRight')).toBe('chevron-right');
        expect(resolveSvgIconName('starFilled')).toBe('star-filled');
        expect(resolveSvgIconName('rename')).toBe('pencil-line');
        expect(resolveSvgIconName('sort')).toBe('arrow-up-down');
        expect(resolveSvgIconName('delete')).toBe('trash');
        expect(resolveSvgIconName('fileJsonImport')).toBe('file-json-import');
        expect(resolveSvgIconName('chatImport')).toBe('chat-import');
        expect(resolveSvgIconName('archiveZip')).toBe('archive-zip');
        expect(resolveSvgIconName('non-existent-icon')).toBe('');
    });

    it('输出安全的内联 <svg> 并支持 tone、duotone 与无障碍属性转义', () => {
        const decorative = renderSvgIcon('sparkles', {
            className: 'custom-cls',
            tone: 'brand',
            duotone: true,
        });
        expect(decorative).toContain('<svg ');
        expect(decorative).toContain('ui-svg-icon');
        expect(decorative).toContain('ui-svg-icon--brand');
        expect(decorative).toContain('ui-svg-icon--duotone');
        expect(decorative).toContain('custom-cls');
        expect(decorative).toContain('aria-hidden="true"');
        expect(decorative).toContain('svg-duotone');

        const labeled = renderSvgIcon('archive-zip', {
            label: '导出 "ZIP" <备份>',
            size: 22,
        });
        expect(labeled).toContain('role="img"');
        expect(labeled).toContain('aria-label="导出 &quot;ZIP&quot; &lt;备份&gt;"');
        expect(labeled).toContain('width="22" height="22"');
    });

    it('pcIcon 与 mobileIcon 桥接输出内联 <svg> 且保留兼容映射字典', () => {
        const pcMarkup = pcIcon('starFilled', 'pc-detail-button-icon');
        expect(pcMarkup).toContain('<svg ');
        expect(pcMarkup).toContain('pc-detail-button-icon');
        expect(pcMarkup).toContain('data-icon="starFilled"');
        expect(PC_ICON_MAP.check).toMatch(/^data:image\/svg\+xml,/);

        const mobileMarkup = mobileIcon('plus', { className: 'm-icon-sm' });
        expect(mobileMarkup).toContain('<svg ');
        expect(mobileMarkup).toContain('m-svg-icon m-svg-icon-plus m-icon-sm');
        expect(MOBILE_ICONS.check).toMatch(/^data:image\/svg\+xml,/);
        expect(MOBILE_ICONS.check).not.toMatch(/[\s'"()]/);
        expect(svgToDataUri('<svg viewBox="0 0 24 24"></svg>')).toBe(
            'data:image/svg+xml,%3Csvg%20viewBox%3D%220%200%2024%2024%22%3E%3C%2Fsvg%3E'
        );
    });
});
