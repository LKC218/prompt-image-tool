import {
    COLS,
    PIECE_COLORS,
    ROWS,
    createGameState,
    dropIntervalForLevel,
    getShapeMatrix,
    hardDrop,
    moveHorizontal,
    readHighScore,
    rotateActive,
    softDrop,
    tickDown,
    togglePause,
    writeHighScore,
} from '../games/tetris-core.js';
import { renderPcWelcomeBanner } from './pc-welcome-banner.js';

const CELL = 28;

let state = null;
let pageEl = null;
let canvas = null;
let ctx = null;
let nextCanvas = null;
let nextCtx = null;
let rafId = 0;
let lastDrop = 0;
let keyHandler = null;
let boundButtons = [];

function render() {
    return `
        ${renderPcWelcomeBanner({
            title: '俄罗斯方块',
            subtitle: '摸鱼五分钟，消行一整天~',
            className: 'pc-welcome-banner-tetris',
        })}
        <div class="pc-tetris-page">
            <div class="pc-tetris-layout">
                <div class="pc-tetris-board-wrap">
                    <canvas class="pc-tetris-board" id="pcTetrisBoard" width="${COLS * CELL}" height="${ROWS * CELL}" aria-label="俄罗斯方块棋盘"></canvas>
                    <div class="pc-tetris-overlay" id="pcTetrisOverlay" hidden>
                        <div class="pc-tetris-overlay-card">
                            <div class="pc-tetris-overlay-title" id="pcTetrisOverlayTitle">暂停</div>
                            <div class="pc-tetris-overlay-desc" id="pcTetrisOverlayDesc">按 P / Esc 继续，或点击下方按钮</div>
                            <div class="pc-tetris-overlay-actions">
                                <button type="button" class="pc-tetris-btn pc-tetris-btn-primary" data-tetris-action="resume">继续</button>
                                <button type="button" class="pc-tetris-btn" data-tetris-action="restart" data-tetris-overlay-restart hidden>重开</button>
                            </div>
                        </div>
                    </div>
                </div>
                <aside class="pc-tetris-side">
                    <div class="pc-tetris-panel">
                        <div class="pc-tetris-label">下一个</div>
                        <canvas class="pc-tetris-next" id="pcTetrisNext" width="120" height="120" aria-label="下一个方块"></canvas>
                    </div>
                    <div class="pc-tetris-panel pc-tetris-stats">
                        <div class="pc-tetris-stat"><span>分数</span><strong id="pcTetrisScore">0</strong></div>
                        <div class="pc-tetris-stat"><span>等级</span><strong id="pcTetrisLevel">1</strong></div>
                        <div class="pc-tetris-stat"><span>消行</span><strong id="pcTetrisLines">0</strong></div>
                        <div class="pc-tetris-stat"><span>最高分</span><strong id="pcTetrisHigh">0</strong></div>
                    </div>
                    <div class="pc-tetris-actions">
                        <button type="button" class="pc-tetris-btn" data-tetris-action="left">←</button>
                        <button type="button" class="pc-tetris-btn" data-tetris-action="rotate">旋转</button>
                        <button type="button" class="pc-tetris-btn" data-tetris-action="right">→</button>
                        <button type="button" class="pc-tetris-btn" data-tetris-action="soft">软降</button>
                        <button type="button" class="pc-tetris-btn pc-tetris-btn-primary" data-tetris-action="hard">硬降</button>
                        <button type="button" class="pc-tetris-btn" data-tetris-action="pause">暂停</button>
                        <button type="button" class="pc-tetris-btn" data-tetris-action="restart">重开</button>
                    </div>
                    <p class="pc-tetris-hint">键盘：← → 移动 · ↑ 旋转 · ↓ 软降 · Space 硬降 · P/Esc 暂停 · R 重开</p>
                </aside>
            </div>
        </div>
    `;
}

function paintCell(targetCtx, x, y, color, size = CELL) {
    const pad = 1;
    targetCtx.fillStyle = color;
    targetCtx.fillRect(x * size + pad, y * size + pad, size - pad * 2, size - pad * 2);
    targetCtx.fillStyle = 'rgba(255,255,255,0.18)';
    targetCtx.fillRect(x * size + pad, y * size + pad, size - pad * 2, 4);
}

function drawBoard() {
    if (!ctx || !state) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0,0,0,0.04)';
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if ((x + y) % 2 === 0) ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
        }
    }
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const cell = state.board[y][x];
            if (cell) paintCell(ctx, x, y, PIECE_COLORS[cell] || '#888');
        }
    }
    const { piece } = state;
    if (piece && state.status !== 'over') {
        const color = PIECE_COLORS[piece.type] || '#888';
        for (let y = 0; y < piece.matrix.length; y++) {
            for (let x = 0; x < piece.matrix[y].length; x++) {
                if (!piece.matrix[y][x]) continue;
                paintCell(ctx, piece.x + x, piece.y + y, color);
            }
        }
    }
}

function drawNext() {
    if (!nextCtx || !state?.nextType) return;
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    const matrix = createPreviewMatrix(state.nextType);
    const size = 22;
    const ox = (nextCanvas.width - matrix[0].length * size) / 2;
    const oy = (nextCanvas.height - matrix.length * size) / 2;
    const color = PIECE_COLORS[state.nextType] || '#888';
    for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < matrix[y].length; x++) {
            if (!matrix[y][x]) continue;
            nextCtx.fillStyle = color;
            nextCtx.fillRect(ox + x * size + 1, oy + y * size + 1, size - 2, size - 2);
            nextCtx.fillStyle = 'rgba(255,255,255,0.18)';
            nextCtx.fillRect(ox + x * size + 1, oy + y * size + 1, size - 2, 3);
        }
    }
}

function createPreviewMatrix(type) {
    return getShapeMatrix(type).filter((row) => row.some((cell) => cell));
}

function updateHud() {
    if (!pageEl || !state) return;
    const score = pageEl.querySelector('#pcTetrisScore');
    const level = pageEl.querySelector('#pcTetrisLevel');
    const lines = pageEl.querySelector('#pcTetrisLines');
    const high = pageEl.querySelector('#pcTetrisHigh');
    if (score) score.textContent = String(state.score);
    if (level) level.textContent = String(state.level);
    if (lines) lines.textContent = String(state.lines);
    if (high) high.textContent = String(state.highScore || readHighScore());
}

function syncOverlay() {
    const overlay = pageEl?.querySelector('#pcTetrisOverlay');
    const title = pageEl?.querySelector('#pcTetrisOverlayTitle');
    const desc = pageEl?.querySelector('#pcTetrisOverlayDesc');
    const resumeBtn = overlay?.querySelector('[data-tetris-action="resume"]');
    const restartBtn = overlay?.querySelector('[data-tetris-overlay-restart]');
    if (!overlay) return;
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

function commit(next) {
    state = next;
    if (state.score > (state.highScore || 0)) {
        state.highScore = writeHighScore(state.score);
    }
    drawBoard();
    drawNext();
    updateHud();
    syncOverlay();
}

function handleAction(action) {
    if (!state) return;
    switch (action) {
        case 'left':
            commit(moveHorizontal(state, -1));
            break;
        case 'right':
            commit(moveHorizontal(state, 1));
            break;
        case 'rotate':
            commit(rotateActive(state, 1));
            break;
        case 'soft':
            commit(softDrop(state));
            break;
        case 'hard':
            commit(hardDrop(state));
            break;
        case 'pause':
            commit(togglePause(state));
            break;
        case 'resume':
            if (state.status === 'paused') commit({ ...state, status: 'playing' });
            break;
        case 'restart':
            state = createGameState();
            lastDrop = performance.now();
            commit(state);
            break;
        default:
            break;
    }
}

function onKeyDown(e) {
    if (!state) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
    const key = e.key;
    if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' ', 'Spacebar', 'Escape'].includes(key)) {
        e.preventDefault();
    }
    if (key === 'ArrowLeft') handleAction('left');
    else if (key === 'ArrowRight') handleAction('right');
    else if (key === 'ArrowUp') handleAction('rotate');
    else if (key === 'ArrowDown') handleAction('soft');
    else if (key === ' ' || key === 'Spacebar') handleAction('hard');
    else if (key === 'p' || key === 'P' || key === 'Escape') handleAction('pause');
    else if (key === 'r' || key === 'R') handleAction('restart');
}

function loop(now) {
    rafId = requestAnimationFrame(loop);
    if (!state || state.status !== 'playing') {
        lastDrop = now;
        return;
    }
    const interval = dropIntervalForLevel(state.level);
    if (now - lastDrop >= interval) {
        lastDrop = now;
        commit(tickDown(state));
    }
}

function bindControls() {
    keyHandler = onKeyDown;
    document.addEventListener('keydown', keyHandler);
    const buttons = pageEl.querySelectorAll('[data-tetris-action]');
    boundButtons = Array.from(buttons);
    boundButtons.forEach((btn) => {
        btn.addEventListener('click', () => handleAction(btn.dataset.tetrisAction));
    });
}

function unbindControls() {
    if (keyHandler) {
        document.removeEventListener('keydown', keyHandler);
        keyHandler = null;
    }
    boundButtons.forEach((btn) => {
        btn.replaceWith(btn.cloneNode(true));
    });
    boundButtons = [];
}

function mount(el) {
    pageEl = el;
    canvas = el.querySelector('#pcTetrisBoard');
    nextCanvas = el.querySelector('#pcTetrisNext');
    ctx = canvas?.getContext('2d') || null;
    nextCtx = nextCanvas?.getContext('2d') || null;
    state = createGameState();
    state.highScore = Math.max(state.highScore || 0, readHighScore());
    lastDrop = performance.now();
    bindControls();
    commit(state);
    rafId = requestAnimationFrame(loop);
}

function unmount() {
    if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
    }
    unbindControls();
    state = null;
    pageEl = null;
    canvas = null;
    ctx = null;
    nextCanvas = null;
    nextCtx = null;
}

export { render, mount, unmount };
