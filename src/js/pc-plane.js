import {
    FIELD_H,
    FIELD_W,
    createGameState,
    movePlayer,
    readHighScore,
    setPlayerPosition,
    tick,
    togglePause,
    tryFire,
} from './plane-war-core.js';
import { renderPcWelcomeBanner } from './pc-welcome-banner.js';
import playerSprite from '../assets/pc/games/plane/player.png';
import enemyBasicSprite from '../assets/pc/games/plane/enemy-basic.png';
import enemyFastSprite from '../assets/pc/games/plane/enemy-fast.png';
import enemyHeavySprite from '../assets/pc/games/plane/enemy-heavy.png';
import bulletPlayerSprite from '../assets/pc/games/plane/bullet-player.png';
import bulletEnemySprite from '../assets/pc/games/plane/bullet-enemy.png';
import explosionSprite from '../assets/pc/games/plane/fx-explosion.png';
import thrusterSprite from '../assets/pc/games/plane/fx-thruster.png';

const KEYS = {
    left: false,
    right: false,
    up: false,
    down: false,
    fire: false,
};

const SPRITE_SRC = {
    player: playerSprite,
    basic: enemyBasicSprite,
    fast: enemyFastSprite,
    heavy: enemyHeavySprite,
    bulletPlayer: bulletPlayerSprite,
    bulletEnemy: bulletEnemySprite,
    explosion: explosionSprite,
    thruster: thrusterSprite,
};

const spriteImages = {};

function loadSprites() {
    Object.entries(SPRITE_SRC).forEach(([key, src]) => {
        if (spriteImages[key]?.complete && spriteImages[key].naturalWidth) return;
        const img = new Image();
        img.src = src;
        spriteImages[key] = img;
    });
}

function drawSprite(c, img, x, y, w, h, flipY = false) {
    if (!img || !img.complete || !img.naturalWidth) return false;
    c.save();
    c.translate(x, y);
    if (flipY) c.rotate(Math.PI);
    c.drawImage(img, -w / 2, -h / 2, w, h);
    c.restore();
    return true;
}

let state = null;
let pageEl = null;
let canvas = null;
let ctx = null;
let rafId = 0;
let lastTs = 0;
let onKeyDown = null;
let onKeyUp = null;
let onPointerMove = null;
let onPointerDown = null;
let onPointerUp = null;
let onPointerLeave = null;
let pointerActive = false;

function render() {
    return `
        ${renderPcWelcomeBanner({
            title: '飞机大战',
            subtitle: '起飞！把烦心事都打下来~',
            className: 'pc-welcome-banner-plane',
        })}
        <div class="pc-plane-page">
            <div class="pc-plane-layout">
                <div class="pc-plane-board-wrap">
                    <canvas class="pc-plane-board" id="pcPlaneBoard" width="${FIELD_W}" height="${FIELD_H}" aria-label="飞机大战战场"></canvas>
                    <div class="pc-plane-overlay" id="pcPlaneOverlay" hidden>
                        <div class="pc-plane-overlay-card">
                            <div class="pc-plane-overlay-title" id="pcPlaneOverlayTitle">暂停</div>
                            <div class="pc-plane-overlay-desc" id="pcPlaneOverlayDesc">按 P / Esc 继续</div>
                            <div class="pc-plane-overlay-actions">
                                <button type="button" class="pc-tetris-btn pc-tetris-btn-primary" data-plane-action="resume">继续</button>
                                <button type="button" class="pc-tetris-btn" data-plane-action="restart" data-plane-overlay-restart hidden>重开</button>
                            </div>
                        </div>
                    </div>
                </div>
                <aside class="pc-plane-side">
                    <div class="pc-tetris-panel pc-tetris-stats">
                        <div class="pc-tetris-stat"><span>分数</span><strong id="pcPlaneScore">0</strong></div>
                        <div class="pc-tetris-stat"><span>波次</span><strong id="pcPlaneWave">1</strong></div>
                        <div class="pc-tetris-stat"><span>生命</span><strong id="pcPlaneLives">3</strong></div>
                        <div class="pc-tetris-stat"><span>最高分</span><strong id="pcPlaneHigh">0</strong></div>
                    </div>
                    <div class="pc-plane-actions">
                        <button type="button" class="pc-tetris-btn" data-plane-action="left">←</button>
                        <button type="button" class="pc-tetris-btn" data-plane-action="right">→</button>
                        <button type="button" class="pc-tetris-btn pc-tetris-btn-primary" data-plane-action="fire">射击</button>
                        <button type="button" class="pc-tetris-btn" data-plane-action="pause">暂停</button>
                        <button type="button" class="pc-tetris-btn" data-plane-action="restart">重开</button>
                    </div>
                    <p class="pc-tetris-hint">鼠标/触控：在战场滑动移动 · 按住或点击射击<br>键盘：← → / ↑ ↓ 移动 · Space 射击 · P/Esc 暂停 · R 重开</p>
                </aside>
            </div>
        </div>
    `;
}

function updateHud() {
    if (!pageEl || !state) return;
    const map = {
        '#pcPlaneScore': state.score,
        '#pcPlaneWave': state.wave,
        '#pcPlaneLives': Math.max(0, state.player.lives),
        '#pcPlaneHigh': state.highScore || readHighScore(),
    };
    Object.entries(map).forEach(([sel, val]) => {
        const el = pageEl.querySelector(sel);
        if (el) el.textContent = String(val);
    });
}

function syncOverlay() {
    const overlay = pageEl?.querySelector('#pcPlaneOverlay');
    const title = pageEl?.querySelector('#pcPlaneOverlayTitle');
    const desc = pageEl?.querySelector('#pcPlaneOverlayDesc');
    const resumeBtn = overlay?.querySelector('[data-plane-action="resume"]');
    const restartBtn = overlay?.querySelector('[data-plane-overlay-restart]');
    if (!overlay || !state) return;
    if (state.status === 'paused') {
        overlay.hidden = false;
        if (title) title.textContent = '暂停中';
        if (desc) desc.textContent = '按 P / Esc 或点击继续';
        if (resumeBtn) resumeBtn.hidden = false;
        if (restartBtn) restartBtn.hidden = true;
    } else if (state.status === 'over') {
        overlay.hidden = false;
        if (title) title.textContent = '游戏结束';
        if (desc) desc.textContent = `本局 ${state.score} 分 · 最高 ${state.highScore}`;
        if (resumeBtn) resumeBtn.hidden = true;
        if (restartBtn) restartBtn.hidden = false;
    } else {
        overlay.hidden = true;
    }
}

function drawShip(c, p) {
    c.save();
    if (p.invincible > 0 && Math.floor(p.invincible * 10) % 2 === 0) {
        c.globalAlpha = 0.35;
    }
    const w = p.w * 1.7;
    const h = p.h * 1.7;
    if (!drawSprite(c, spriteImages.player, p.x, p.y, w, h, false)) {
        c.translate(p.x, p.y);
        c.fillStyle = '#38bdf8';
        c.beginPath();
        c.moveTo(0, -p.h / 2);
        c.lineTo(p.w / 2, p.h / 2);
        c.lineTo(0, p.h / 4);
        c.lineTo(-p.w / 2, p.h / 2);
        c.closePath();
        c.fill();
        c.fillStyle = '#e0f2fe';
        c.fillRect(-3, -2, 6, 10);
    }
    c.restore();
}

function drawEnemy(c, e) {
    const w = e.w * 1.6;
    const h = e.h * 1.6;
    // 新素材机头已朝下，不再旋转
    if (drawSprite(c, spriteImages[e.type] || spriteImages.basic, e.x, e.y, w, h, false)) {
        if (e.maxHp > 1) {
            c.fillStyle = 'rgba(255,255,255,0.45)';
            c.fillRect(e.x - e.w / 2, e.y - e.h / 2 - 5, e.w, 3);
            c.fillStyle = '#86efac';
            c.fillRect(e.x - e.w / 2, e.y - e.h / 2 - 5, e.w * (e.hp / e.maxHp), 3);
        }
        return;
    }
    const colors = { basic: '#fb7185', fast: '#fbbf24', heavy: '#a78bfa' };
    c.fillStyle = colors[e.type] || '#fb7185';
    c.beginPath();
    c.moveTo(e.x, e.y + e.h / 2);
    c.lineTo(e.x + e.w / 2, e.y - e.h / 2);
    c.lineTo(e.x - e.w / 2, e.y - e.h / 2);
    c.closePath();
    c.fill();
    if (e.maxHp > 1) {
        c.fillStyle = 'rgba(255,255,255,0.45)';
        c.fillRect(e.x - e.w / 2, e.y - e.h / 2 - 5, e.w, 3);
        c.fillStyle = '#86efac';
        c.fillRect(e.x - e.w / 2, e.y - e.h / 2 - 5, e.w * (e.hp / e.maxHp), 3);
    }
}

function draw() {
    if (!ctx || !state) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // starfield-ish bg
    ctx.fillStyle = 'rgba(15, 23, 42, 0.06)';
    for (let i = 0; i < 24; i++) {
        const x = (i * 53) % FIELD_W;
        const y = (i * 97 + (state.score || 0)) % FIELD_H;
        ctx.fillRect(x, y, 2, 2);
    }
    state.bullets.forEach((b) => {
        const bw = Math.max(10, b.w * 2.2);
        const bh = Math.max(16, b.h * 1.4);
        if (!drawSprite(ctx, spriteImages.bulletPlayer, b.x, b.y, bw, bh, false)) {
            ctx.fillStyle = '#fef08a';
            ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
        }
    });
    state.enemies.forEach((e) => drawEnemy(ctx, e));
    state.particles.forEach((p) => {
        ctx.globalAlpha = Math.max(0, p.life / 0.35);
        const size = 18 + (1 - p.life / 0.35) * 22;
        if (!drawSprite(ctx, spriteImages.explosion, p.x, p.y, size, size, false)) {
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, 3, 3);
        }
        ctx.globalAlpha = 1;
    });
    drawShip(ctx, state.player);
}

function handleAction(action) {
    if (!state) return;
    if (action === 'pause') {
        state = togglePause(state);
        syncOverlay();
        return;
    }
    if (action === 'resume') {
        if (state.status === 'paused') {
            state = { ...state, status: 'playing' };
            syncOverlay();
        }
        return;
    }
    if (action === 'restart') {
        state = createGameState();
        state.highScore = Math.max(state.highScore || 0, readHighScore());
        lastTs = performance.now();
        updateHud();
        syncOverlay();
        draw();
        return;
    }
    if (action === 'left') state = movePlayer(state, -1, 0, 1 / 30);
    if (action === 'right') state = movePlayer(state, 1, 0, 1 / 30);
    if (action === 'fire') state = tryFire(state, 0.2, false);
    updateHud();
}

function eventToField(e) {
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const x = ((e.clientX - rect.left) / rect.width) * FIELD_W;
    const y = ((e.clientY - rect.top) / rect.height) * FIELD_H;
    return { x, y };
}

function bindInput() {
    onKeyDown = (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const tag = e.target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
        const key = e.key;
        if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' ', 'Spacebar', 'Escape'].includes(key)) {
            e.preventDefault();
        }
        if (key === 'ArrowLeft') KEYS.left = true;
        else if (key === 'ArrowRight') KEYS.right = true;
        else if (key === 'ArrowUp') KEYS.up = true;
        else if (key === 'ArrowDown') KEYS.down = true;
        else if (key === ' ' || key === 'Spacebar') KEYS.fire = true;
        if (key === 'p' || key === 'P' || key === 'Escape') {
            if (!e.repeat) handleAction('pause');
        } else if (key === 'r' || key === 'R') {
            if (!e.repeat) handleAction('restart');
        }
        // 键盘接管后退出指针跟随，避免抢控制
        if (key.startsWith('Arrow')) pointerActive = false;
    };
    onKeyUp = (e) => {
        const key = e.key;
        if (key === 'ArrowLeft') KEYS.left = false;
        else if (key === 'ArrowRight') KEYS.right = false;
        else if (key === 'ArrowUp') KEYS.up = false;
        else if (key === 'ArrowDown') KEYS.down = false;
        else if (key === ' ' || key === 'Spacebar') KEYS.fire = false;
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    if (canvas) {
        onPointerMove = (e) => {
            if (!state || state.status !== 'playing') return;
            const pos = eventToField(e);
            if (!pos) return;
            pointerActive = true;
            state = setPlayerPosition(state, pos.x, pos.y);
            if (e.buttons > 0 || e.pointerType === 'touch') {
                state = tryFire(state, 0, true);
            }
        };
        onPointerDown = (e) => {
            if (!state) return;
            if (e.button != null && e.button !== 0) return;
            e.preventDefault();
            const pos = eventToField(e);
            if (pos) {
                pointerActive = true;
                state = setPlayerPosition(state, pos.x, pos.y);
            }
            KEYS.fire = true;
            state = tryFire(state, 0.2, false);
        };
        onPointerUp = () => {
            KEYS.fire = false;
        };
        onPointerLeave = () => {
            KEYS.fire = false;
        };
        canvas.addEventListener('pointermove', onPointerMove);
        canvas.addEventListener('pointerdown', onPointerDown);
        canvas.addEventListener('pointerup', onPointerUp);
        canvas.addEventListener('pointercancel', onPointerUp);
        canvas.addEventListener('pointerleave', onPointerLeave);
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    pageEl.querySelectorAll('[data-plane-action]').forEach((btn) => {
        btn.addEventListener('click', () => handleAction(btn.dataset.planeAction));
    });
}

function unbindInput() {
    if (onKeyDown) document.removeEventListener('keydown', onKeyDown);
    if (onKeyUp) document.removeEventListener('keyup', onKeyUp);
    if (canvas) {
        if (onPointerMove) canvas.removeEventListener('pointermove', onPointerMove);
        if (onPointerDown) canvas.removeEventListener('pointerdown', onPointerDown);
        if (onPointerUp) {
            canvas.removeEventListener('pointerup', onPointerUp);
            canvas.removeEventListener('pointercancel', onPointerUp);
        }
        if (onPointerLeave) canvas.removeEventListener('pointerleave', onPointerLeave);
    }
    onKeyDown = null;
    onKeyUp = null;
    onPointerMove = null;
    onPointerDown = null;
    onPointerUp = null;
    onPointerLeave = null;
    pointerActive = false;
    KEYS.left = KEYS.right = KEYS.up = KEYS.down = KEYS.fire = false;
}

function loop(ts) {
    rafId = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;
    if (!state) return;
    if (state.status !== 'playing') {
        draw();
        return;
    }
    const dx = (KEYS.right ? 1 : 0) - (KEYS.left ? 1 : 0);
    const dy = (KEYS.down ? 1 : 0) - (KEYS.up ? 1 : 0);
    if (dx || dy) {
        pointerActive = false;
        state = movePlayer(state, dx, dy, dt);
    }
    // auto-fire while holding space or always light auto for casual play
    state = tryFire(state, dt, true);
    if (KEYS.fire) state = tryFire(state, 0, true);
    state = tick(state, dt);
    updateHud();
    syncOverlay();
    draw();
}

function mount(el) {
    pageEl = el;
    canvas = el.querySelector('#pcPlaneBoard');
    ctx = canvas?.getContext('2d') || null;
    state = createGameState();
    state.highScore = Math.max(state.highScore || 0, readHighScore());
    lastTs = performance.now();
    loadSprites();
    bindInput();
    updateHud();
    syncOverlay();
    draw();
    rafId = requestAnimationFrame(loop);
}

function unmount() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    unbindInput();
    state = null;
    pageEl = null;
    canvas = null;
    ctx = null;
}

export { render, mount, unmount };
