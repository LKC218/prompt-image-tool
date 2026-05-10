import { escapeHtml } from './pc-utils.js';
import corgiHome from '../assets/mobile/mascots/corgi-home.png';
import homeBg from '../assets/pc/home-bg.png';

function renderPcWelcomeBanner(options = {}) {
    const {
        title = 'Hi，创作者 👋',
        subtitle = '今天也要快乐创作呀~',
        className = '',
        leadingHtml = '',
        actionsHtml = '',
        actionsPlacement = 'beforeMascot',
        mascotAlt = '柯基'
    } = options;
    const bannerClass = ['pc-welcome-banner', className].filter(Boolean).join(' ');
    const actions = actionsHtml ? `<div class="pc-welcome-actions">${actionsHtml}</div>` : '';

    return `
        <div class="${bannerClass}" style="background-image: url('${homeBg}');">
            <div class="pc-welcome-section">
                ${leadingHtml ? `<div class="pc-welcome-leading">${leadingHtml}</div>` : ''}
                <div class="pc-welcome-text">
                    <h2>${escapeHtml(title)}</h2>
                    <p>${escapeHtml(subtitle)}</p>
                </div>
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

export { renderPcWelcomeBanner };
