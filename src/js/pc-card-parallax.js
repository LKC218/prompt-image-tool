// 鼠标驱动的卡片 3D 倾斜 + 封面视差（目标计划 / 摸鱼时间等列表卡共用）
const CARD_PARALLAX_TILT_MAX = 8;
const CARD_PARALLAX_DEPTH_PX = 8;
const CARD_PARALLAX_VAR = {
    rx: '--pc-card-tilt-rx',
    ry: '--pc-card-tilt-ry',
    px: '--pc-card-tilt-px',
    py: '--pc-card-tilt-py',
    mx: '--pc-card-tilt-mx',
    my: '--pc-card-tilt-my',
};

function clearCardParallaxVars(card) {
    card.classList.remove('is-tilting');
    Object.values(CARD_PARALLAX_VAR).forEach((name) => card.style.removeProperty(name));
}

function setupCardParallaxTilt(container, options = {}) {
    const cardSelector = options.cardSelector || '.pc-goal-project-card';
    if (!container) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;
    if (!window.matchMedia?.('(hover: hover) and (pointer: fine)')?.matches) return;

    let rafId = 0;
    let pending = null;

    function applyCardTilt(card, clientX, clientY) {
        const rect = card.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) return;

        const x = (clientX - rect.left) / rect.width;
        const y = (clientY - rect.top) / rect.height;
        const rotY = (x - 0.5) * CARD_PARALLAX_TILT_MAX * 2;
        const rotX = (0.5 - y) * CARD_PARALLAX_TILT_MAX * 2;
        const px = (0.5 - x) * CARD_PARALLAX_DEPTH_PX * 2;
        const py = (0.5 - y) * CARD_PARALLAX_DEPTH_PX * 2;

        card.classList.add('is-tilting');
        card.style.setProperty(CARD_PARALLAX_VAR.rx, `${rotX.toFixed(2)}deg`);
        card.style.setProperty(CARD_PARALLAX_VAR.ry, `${rotY.toFixed(2)}deg`);
        card.style.setProperty(CARD_PARALLAX_VAR.px, `${px.toFixed(2)}px`);
        card.style.setProperty(CARD_PARALLAX_VAR.py, `${py.toFixed(2)}px`);
        card.style.setProperty(CARD_PARALLAX_VAR.mx, `${(x * 100).toFixed(1)}%`);
        card.style.setProperty(CARD_PARALLAX_VAR.my, `${(y * 100).toFixed(1)}%`);
    }

    function flushTilt() {
        rafId = 0;
        if (!pending) return;
        applyCardTilt(pending.card, pending.x, pending.y);
        pending = null;
    }

    container.querySelectorAll(cardSelector).forEach((card) => {
        card.addEventListener('pointermove', (e) => {
            if (e.pointerType && e.pointerType !== 'mouse') return;
            pending = { card, x: e.clientX, y: e.clientY };
            if (!rafId) rafId = requestAnimationFrame(flushTilt);
        });
        card.addEventListener('pointerleave', () => {
            if (pending?.card === card) pending = null;
            clearCardParallaxVars(card);
        });
    });
}

function clearCardParallaxIn(container, cardSelector) {
    if (!container) return;
    container.querySelectorAll(`${cardSelector}.is-tilting`).forEach(clearCardParallaxVars);
}

export {
    CARD_PARALLAX_TILT_MAX,
    CARD_PARALLAX_DEPTH_PX,
    CARD_PARALLAX_VAR,
    setupCardParallaxTilt,
    clearCardParallaxIn,
    clearCardParallaxVars,
};
