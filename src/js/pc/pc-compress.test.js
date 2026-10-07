import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
const client = vi.hoisted(() => ({
    version: '测试引擎', cache: { bytes: 0, staleBytes: 0 },
    compress: vi.fn(), cancel: vi.fn(), cleanCache: vi.fn(async () => ({ bytes: 0, staleBytes: 0, removedBytes: 0 })),
}));
vi.mock('./pc-welcome-banner.js', () => ({ renderPcWelcomeBanner: () => '' }));
vi.mock('../shared/png-compression.js', async importOriginal => ({ ...await importOriginal(), connectCompressor: async () => client }));
import { render, mount, unmount } from './pc-compress.js';
const $ = selector => document.querySelector(selector);
const click = selector => $(selector).click();
const input = (selector, value) => { $(selector).value = value; $(selector).dispatchEvent(new Event('input', { bubbles: true })); };
beforeEach(async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    localStorage.clear(); vi.clearAllMocks();
    document.body.innerHTML = '<main>' + render() + '</main>';
    mount($('main'));
    await vi.waitFor(() => expect($('.pc-compress').dataset.engineReady).toBe('true'));
});
afterEach(() => { unmount(); vi.unstubAllGlobals(); document.body.innerHTML = ''; });

describe('处理设置精简', () => {
    it('默认高级设置折叠，精确等级与缓存同组，预设仍可用', () => {
        expect($('#imageAdvanced').open).toBe(false);
        expect($('#pngLevel').closest('details')).toBe($('#imageAdvanced'));
        expect($('[data-action="clean-cache"]').closest('details')).toBe($('#imageAdvanced'));
        click('[data-level="6"]');
        expect($('#pngLevel').value).toBe('6');
        expect($('#imageAdvanced').open).toBe(false);
    });
    it('转换 PNG 只显示无损状态，不显示无效质量选项', () => {
        click('[data-operation="convert"]'); click('[data-target="png"]');
        expect($('#imageEncodingChoices').hidden).toBe(true);
        expect($('#imageEncodingState').textContent).toBe('PNG · 无损编码');
        expect($('#imageQualityGroup').hidden).toBe(true);
        expect($('[data-encoding="lossy"]').disabled).toBe(true);
    });
    it('转换 JPEG 只显示有损状态及质量，不显示优化强度', () => {
        click('[data-operation="convert"]'); click('[data-target="jpeg"]');
        expect($('#imageEncodingChoices').hidden).toBe(true);
        expect($('#imageQualityGroup').hidden).toBe(false);
        expect($('#imageOptimizationGroup').hidden).toBe(true);
        expect($('#imageFineLevel').hidden).toBe(true);
    });
    it('WebP 仍可切换编码方式', () => {
        click('[data-operation="convert"]'); click('[data-target="webp"]');
        expect($('#imageEncodingChoices').hidden).toBe(false);
        click('[data-encoding="lossy"]'); expect($('#imageQualityGroup').hidden).toBe(false);
        click('[data-encoding="lossless"]'); expect($('#imageQualityGroup').hidden).toBe(true);
    });
    it('详情展开不代替确认，风险信息仍完整', () => {
        click('#imageResize');
        expect($('#imageAckGroup').hidden).toBe(false);
        $('#imageRiskDetails').open = true;
        expect($('#imageAck').checked).toBe(false);
        expect($('#imageRiskDetails').textContent).toContain('不能替代原文件');
        expect($('#imageRiskDetails').textContent).toContain('PNG 无损编码不等于无损缩放');
    });
    it('比例锁位于标签行，拉伸提示持续可见', () => {
        click('#imageResize'); click('[data-action="ratio-lock"]');
        expect($('[data-action="ratio-lock"]').closest('.image-height-label')).not.toBe(null);
        expect($('[data-action="ratio-lock"]').getAttribute('aria-pressed')).toBe('false');
        expect($('#imageResizeHint').textContent).toContain('可能拉伸');
    });
    it('高级参数折叠保值，自定义等级有摘要且不编码', () => {
        $('#imageAdvanced').open = true;
        input('#pngLevel', '3'); input('#pngThreads', '1'); click('[data-budget="15"]');
        $('#imageAdvanced').open = false;
        expect($('#imageCustomLevel').hidden).toBe(false);
        expect($('#imageCustomLevel').textContent).toBe('自定义 3');
        $('#imageAdvanced').open = true;
        expect($('#pngLevel').value).toBe('3'); expect($('#pngThreads').value).toBe('1');
        expect($('[data-budget="15"]').getAttribute('aria-pressed')).toBe('true');
        expect(client.compress).not.toHaveBeenCalled();
    });
    it('恢复默认仍重置全部参数，不自动展开尺寸', () => {
        click('#imageResize'); input('#imageWidth', '160'); input('#pngThreads', '1');
        click('[data-action="reset-settings"]');
        expect($('#imageResize').checked).toBe(false);
        expect($('#imageWidth').value).toBe(''); expect($('#pngThreads').value).toBe('2');
        expect($('#imageAck').checked).toBe(false);
    });
});
