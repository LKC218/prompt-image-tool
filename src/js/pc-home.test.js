import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readPcCss } from './pc-css-test-utils.js';

const pcHomeJs = readFileSync(resolve(process.cwd(), 'src/js/pc-home.js'), 'utf8');
const pcCss = readPcCss();

describe('PC 首页新拟态结构', () => {
    it('将收藏分类渲染为可键盘触发的原生按钮', () => {
        expect(pcHomeJs).toContain('<button type="button" class="pc-category-card pc-home-category-card"');
        expect(pcHomeJs).toContain('data-folder-id="${folder.id}"');
        expect(pcHomeJs).toContain('getFolderColor(folder)');
        expect(pcHomeJs).toContain('--pc-home-category-color: ${color.color}');
        expect(pcHomeJs).toContain("navigate('/library', { folder: card.dataset.folderId })");
    });

    it('保留首页主次创建入口及既有路由行为', () => {
        expect(pcHomeJs).toContain('pc-home-quick-card-create pc-create-btn');
        expect(pcHomeJs).toContain('pc-home-quick-card-import');
        expect(pcHomeJs).toContain("navigate('/editor/')");
        expect(pcHomeJs).toContain('input.accept = \'.json\'');
    });

    it('为搜索和首页交互元素提供局部新拟态与键盘焦点状态', () => {
        expect(pcCss).toContain('.pc-home-search-bar:focus-within');
        expect(pcCss).toContain('.pc-home-category-card:active');
        expect(pcCss).toContain('.pc-home-category-card::before');
        expect(pcCss).toContain('.pc-home-category-card:hover::before');
        expect(pcCss).toContain('.pc-home-category-card:hover .pc-home-category-icon');
        expect(pcCss).toContain('.pc-home-category-card:focus-visible');
        expect(pcCss).toContain('.pc-home-page .pc-home-quick-card-import:active');
        expect(pcCss).toContain('.pc-home-page .pc-star-btn:active');
        expect(pcCss).toContain('min-height: 96px;');
    });

    it('为收藏按钮提供持久状态语义、请求锁定和一次性反馈动画', () => {
        expect(pcHomeJs).toContain('type="button" class="pc-star-btn');
        expect(pcHomeJs).toContain('aria-pressed="${isFavorite}"');
        expect(pcHomeJs).toContain("starBtn.dataset.favoritePending === 'true'");
        expect(pcHomeJs).toContain("starBtn.setAttribute('aria-busy', 'true')");
        expect(pcHomeJs).toContain('playFavoriteFeedback(starBtn, nextState);');
        expect(pcHomeJs).toContain('setFavoriteButtonState(starBtn, previousState);');
        expect(pcCss).toContain('@keyframes pc-home-star-favorite');
        expect(pcCss).toContain('@keyframes pc-home-star-favorite-icon');
        expect(pcCss).toContain('@keyframes pc-home-star-ring');
        expect(pcCss).toContain('@keyframes pc-home-star-particles');
        expect(pcCss).toContain('.pc-home-page .pc-star-btn--favorited');
        expect(pcCss).toContain('.pc-home-page .pc-star-btn--favorited::before');
        expect(pcCss).toContain('.pc-home-page .pc-star-btn--favorited::after');
        expect(pcCss).toContain('.pc-home-page .pc-star-btn--unfavorited svg');
        expect(pcCss).toContain('.pc-home-page .pc-star-btn:disabled');
    });
});
