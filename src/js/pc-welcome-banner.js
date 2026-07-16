import { escapeHtml } from './pc-utils.js';
import corgiHome from '../assets/mobile/mascots/corgi-home.png';
import homeBg from '../assets/pc/home-bg.png';
import greetingHand from '../assets/mobile/greeting-hand.png';
import pixelDogSprite from '../assets/pc/home-pixel-dog-sprite.png';

const WALK_ANIMATION_VARIANTS = new Set(['home', 'library', 'category', 'settings', 'editor', 'detail']);

function renderPcWelcomeWalkAnimation(options = {}) {
    const variant = WALK_ANIMATION_VARIANTS.has(options.variant) ? options.variant : 'home';
    const frameCount = Number.isInteger(options.frameCount) && options.frameCount > 0 ? options.frameCount : 8;
    const frameDuration = typeof options.frameDuration === 'string' && options.frameDuration.trim() ? options.frameDuration : '0.84s';
    const crossDuration = typeof options.crossDuration === 'string' && options.crossDuration.trim() ? options.crossDuration : '6.8s';

    return `
        <div class="pc-welcome-pixel-stage pc-welcome-pixel-stage-${variant}" style="--pc-pixel-dog-frame-count: ${frameCount}; --pc-pixel-dog-frame-duration: ${frameDuration}; --pc-pixel-dog-cross-duration: ${crossDuration};">
            <span class="pc-welcome-pixel-runner">
                <span class="pc-welcome-pixel-sprite" style="--pc-pixel-dog-sprite: url('${pixelDogSprite}')"></span>
            </span>
        </div>
    `;
}

function renderPcWelcomeBanner(options = {}) {
    const {
        title = 'Hi，创作者',
        subtitle = '今天也要快乐创作呀~',
        className = '',
        leadingHtml = '',
        decorationsHtml = '',
        actionsHtml = '',
        actionsPlacement = 'beforeMascot',
        mascotAlt = '柯基'
    } = options;
    const bannerClass = ['pc-welcome-banner', className].filter(Boolean).join(' ');
    const actions = actionsHtml ? `<div class="pc-welcome-actions">${actionsHtml}</div>` : '';

    return `
        <div class="${bannerClass}" style="--pc-welcome-bg-image: url('${homeBg}');">
            <div class="pc-welcome-section">
                ${leadingHtml ? `<div class="pc-welcome-leading">${leadingHtml}</div>` : ''}
                <div class="pc-welcome-text">
                    <h2>${escapeHtml(title)}<img src="${greetingHand}" alt="" class="pc-greeting-hand"></h2>
                    <p>${escapeHtml(subtitle)}</p>
                </div>
                ${decorationsHtml ? `<div class="pc-welcome-decorations" aria-hidden="true">${decorationsHtml}</div>` : ''}
                <div class="pc-welcome-right">
                    ${actionsPlacement === 'beforeMascot' ? actions : ''}
                    <div class="pc-welcome-mascot">
                        <img src="${corgiHome}" alt="${escapeHtml(mascotAlt)}">
                    </div>
                    ${actionsPlacement === 'afterMascot' ? actions : ''}
                </div>
            </div>
        </div>
    `;
}

export { renderPcWelcomeBanner, renderPcWelcomeWalkAnimation };
