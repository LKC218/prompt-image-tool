import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pcCss = readFileSync(resolve(process.cwd(), 'src/css/pc.css'), 'utf8');
const mobileCss = readFileSync(resolve(process.cwd(), 'src/css/mobile.css'), 'utf8');

describe('双端全局按钮微交互样式约束', () => {
    it('PC 端覆盖全局按钮、卡片入口、焦点态和低动效兜底', () => {
        expect(pcCss).toContain('PC 全局按钮与可点击入口微交互基线');
        expect(pcCss).toContain('.pc-settings-action-card');
        expect(pcCss).toContain('.pc-library-icon-btn');
        expect(pcCss).toContain('.pc-detail-action-btn');
        expect(pcCss).toContain('.pc-home-page .pc-quick-create-card');
        expect(pcCss).toContain('focus-visible');
        expect(pcCss).toContain('@media (prefers-reduced-motion: reduce)');
        expect(pcCss).toContain('transform: none !important');
    });

    it('移动端覆盖触控入口、鼠标增强、焦点态和低动效兜底', () => {
        expect(mobileCss).toContain('移动端全局按钮与可触控入口微交互基线');
        expect(mobileCss).toContain('.m-action-btn');
        expect(mobileCss).toContain('.m-nav-center-btn');
        expect(mobileCss).toContain('.m-backup-card');
        expect(mobileCss).toContain('.m-image-viewer-download');
        expect(mobileCss).toContain('@media (hover: hover) and (pointer: fine)');
        expect(mobileCss).toContain('@media (prefers-reduced-motion: reduce)');
        expect(mobileCss).toContain('transform: none !important');
    });
});
