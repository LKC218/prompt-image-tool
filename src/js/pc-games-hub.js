import { navigate } from './pc-router.js';
import { showConfirmModal, escapeHtml } from './pc-utils.js';
import { renderPcWelcomeBanner } from './pc-welcome-banner.js';

const GAMES = [
    {
        id: 'tetris',
        title: '俄罗斯方块',
        route: '/tetris',
        summary: '经典七种方块，消行升级，键盘畅玩摸鱼首选。',
        meta: ['10×20 棋盘', '7-bag', '本地最高分'],
        accent: 'violet',
        mark: 'T',
    },
    {
        id: 'plane',
        title: '飞机大战',
        route: '/plane',
        summary: '驾驶小飞机击落敌机，波次加速，挑战高分。',
        meta: ['波次敌机', '自动射击', '本地最高分'],
        accent: 'sky',
        mark: '✈',
    },
];

const COVER_STYLES = {
    violet: 'linear-gradient(145deg, #c4b5fd 0%, #8b5cf6 55%, #6d28d9 100%)',
    sky: 'linear-gradient(145deg, #7dd3fc 0%, #38bdf8 50%, #0284c7 100%)',
};

function renderCard(game) {
    const cover = COVER_STYLES[game.accent] || COVER_STYLES.sky;
    const meta = game.meta.map((m) => `<span>${escapeHtml(m)}</span>`).join('<span>·</span>');
    return `
        <article class="pc-games-card" data-game-id="${escapeHtml(game.id)}">
            <div class="pc-games-card-cover" style="background:${cover}">
                <span class="pc-games-card-mark" aria-hidden="true">${game.mark}</span>
            </div>
            <div class="pc-games-card-body">
                <h3 class="pc-games-card-title">${escapeHtml(game.title)}</h3>
                <p class="pc-games-card-summary">${escapeHtml(game.summary)}</p>
                <div class="pc-games-card-meta">${meta}</div>
                <div class="pc-games-card-actions">
                    <button type="button" class="pc-tetris-btn pc-tetris-btn-primary" data-enter-game="${escapeHtml(game.id)}">进入游戏</button>
                </div>
            </div>
        </article>
    `;
}

function render() {
    return `
        ${renderPcWelcomeBanner({
            title: '摸鱼时间',
            subtitle: '选个小游戏，劳逸结合一下~',
            className: 'pc-welcome-banner-games',
        })}
        <div class="pc-games-page">
            <div class="pc-games-grid">
                ${GAMES.map(renderCard).join('')}
            </div>
        </div>
    `;
}

function handleEnter(gameId) {
    const game = GAMES.find((g) => g.id === gameId);
    if (!game) return;
    const message = `进入「${escapeHtml(game.title)}」？<br>${escapeHtml(game.summary)}`;
    showConfirmModal(message, () => {
        navigate(game.route);
    });
}

function mount(pageEl) {
    pageEl.querySelectorAll('[data-enter-game]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleEnter(btn.dataset.enterGame);
        });
    });
    pageEl.querySelectorAll('.pc-games-card').forEach((card) => {
        card.addEventListener('click', () => handleEnter(card.dataset.gameId));
    });
}

function unmount() {
    // page DOM destroyed by shell
}

export { render, mount, unmount, GAMES };
