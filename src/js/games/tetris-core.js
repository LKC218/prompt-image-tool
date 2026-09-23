export const COLS = 10;
export const ROWS = 20;
export const HIGHSCORE_KEY = 'pc-tetris-highscore';

export const PIECE_TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

export const PIECE_COLORS = {
    I: '#5AD7FF',
    O: '#FFD84D',
    T: '#B388FF',
    S: '#4ADE80',
    Z: '#FF6B6B',
    J: '#6EA8FE',
    L: '#FF9F43',
};

const SHAPES = {
    I: [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
    ],
    O: [
        [1, 1],
        [1, 1],
    ],
    T: [
        [0, 1, 0],
        [1, 1, 1],
        [0, 0, 0],
    ],
    S: [
        [0, 1, 1],
        [1, 1, 0],
        [0, 0, 0],
    ],
    Z: [
        [1, 1, 0],
        [0, 1, 1],
        [0, 0, 0],
    ],
    J: [
        [1, 0, 0],
        [1, 1, 1],
        [0, 0, 0],
    ],
    L: [
        [0, 0, 1],
        [1, 1, 1],
        [0, 0, 0],
    ],
};

export function cloneMatrix(matrix) {
    return matrix.map((row) => row.slice());
}

export function createEmptyBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

export function createPiece(type) {
    return {
        type,
        matrix: cloneMatrix(SHAPES[type]),
        x: Math.floor((COLS - SHAPES[type][0].length) / 2),
        y: 0,
    };
}

export function getShapeMatrix(type) {
    return cloneMatrix(SHAPES[type] || SHAPES.T);
}

export function createBag(random = Math.random) {
    const bag = PIECE_TYPES.slice();
    for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
}

export function rotateMatrix(matrix, dir = 1) {
    const n = matrix.length;
    const result = Array.from({ length: n }, () => Array(n).fill(0));
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
            if (dir > 0) {
                result[x][n - 1 - y] = matrix[y][x];
            } else {
                result[n - 1 - x][y] = matrix[y][x];
            }
        }
    }
    return result;
}

export function collides(board, piece, offsetX = piece.x, offsetY = piece.y, matrix = piece.matrix) {
    for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < matrix[y].length; x++) {
            if (!matrix[y][x]) continue;
            const bx = offsetX + x;
            const by = offsetY + y;
            if (bx < 0 || bx >= COLS || by >= ROWS) return true;
            if (by < 0) continue;
            if (board[by][bx]) return true;
        }
    }
    return false;
}

export function mergePiece(board, piece) {
    const next = cloneMatrix(board);
    const { matrix, x: px, y: py, type } = piece;
    for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < matrix[y].length; x++) {
            if (!matrix[y][x]) continue;
            const by = py + y;
            const bx = px + x;
            if (by < 0 || by >= ROWS || bx < 0 || bx >= COLS) continue;
            next[by][bx] = type;
        }
    }
    return next;
}

export function clearLines(board) {
    const kept = [];
    let lines = 0;
    for (let y = 0; y < ROWS; y++) {
        const row = board[y];
        if (row.every((cell) => cell)) {
            lines += 1;
        } else {
            kept.push(row.slice());
        }
    }
    while (kept.length < ROWS) {
        kept.unshift(Array(COLS).fill(null));
    }
    return { board: kept, lines };
}

export function scoreForLines(lines, level = 1) {
    const base = { 1: 100, 2: 300, 3: 500, 4: 800 }[lines] || 0;
    return base * Math.max(1, level);
}

export function dropIntervalForLevel(level) {
    const lv = Math.max(1, level);
    return Math.max(100, 800 - (lv - 1) * 70);
}

export function tryMove(board, piece, dx, dy) {
    const nx = piece.x + dx;
    const ny = piece.y + dy;
    if (collides(board, piece, nx, ny)) return null;
    return { ...piece, x: nx, y: ny };
}

export function tryRotate(board, piece, dir = 1) {
    const rotated = rotateMatrix(piece.matrix, dir);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
        const nx = piece.x + kick;
        if (!collides(board, piece, nx, piece.y, rotated)) {
            return { ...piece, matrix: rotated, x: nx };
        }
    }
    return null;
}

export function hardDropY(board, piece) {
    let y = piece.y;
    while (!collides(board, piece, piece.x, y + 1)) {
        y += 1;
    }
    return y;
}

export function createGameState(random = Math.random) {
    let bag = createBag(random);
    const pull = () => {
        if (!bag.length) bag = createBag(random);
        return bag.pop();
    };
    const current = createPiece(pull());
    const nextType = pull();
    return {
        board: createEmptyBoard(),
        piece: current,
        nextType,
        bag,
        pull,
        score: 0,
        lines: 0,
        level: 1,
        status: 'playing',
        highScore: readHighScore(),
    };
}

export function readHighScore() {
    try {
        const raw = localStorage.getItem(HIGHSCORE_KEY);
        const value = Number(raw);
        return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (e) {
        return 0;
    }
}

export function writeHighScore(score) {
    try {
        const prev = readHighScore();
        if (score > prev) {
            localStorage.setItem(HIGHSCORE_KEY, String(score));
            return score;
        }
        return prev;
    } catch (e) {
        return readHighScore();
    }
}

export function spawnNext(state, random = Math.random) {
    const pull = state.pull || (() => {
        if (!state.bag?.length) {
            state.bag = createBag(random);
        }
        return state.bag.pop();
    });
    const piece = createPiece(state.nextType || pull());
    const nextType = pull();
    if (collides(state.board, piece)) {
        return {
            ...state,
            piece,
            nextType,
            status: 'over',
            highScore: writeHighScore(state.score),
        };
    }
    return {
        ...state,
        piece,
        nextType,
        status: 'playing',
    };
}

export function lockAndAdvance(state) {
    const board = mergePiece(state.board, state.piece);
    const cleared = clearLines(board);
    const gained = scoreForLines(cleared.lines, state.level);
    const lines = state.lines + cleared.lines;
    const level = 1 + Math.floor(lines / 10);
    const score = state.score + gained;
    const next = {
        ...state,
        board: cleared.board,
        score,
        lines,
        level,
        highScore: Math.max(state.highScore, score),
    };
    return spawnNext(next);
}

export function moveHorizontal(state, dx) {
    if (state.status !== 'playing') return state;
    const moved = tryMove(state.board, state.piece, dx, 0);
    return moved ? { ...state, piece: moved } : state;
}

export function rotateActive(state, dir = 1) {
    if (state.status !== 'playing') return state;
    const rotated = tryRotate(state.board, state.piece, dir);
    return rotated ? { ...state, piece: rotated } : state;
}

export function softDrop(state) {
    if (state.status !== 'playing') return state;
    const moved = tryMove(state.board, state.piece, 0, 1);
    if (moved) {
        return { ...state, piece: moved, score: state.score + 1 };
    }
    return lockAndAdvance(state);
}

export function hardDrop(state) {
    if (state.status !== 'playing') return state;
    const y = hardDropY(state.board, state.piece);
    const distance = Math.max(0, y - state.piece.y);
    const dropped = { ...state, piece: { ...state.piece, y }, score: state.score + distance * 2 };
    return lockAndAdvance(dropped);
}

export function tickDown(state) {
    if (state.status !== 'playing') return state;
    const moved = tryMove(state.board, state.piece, 0, 1);
    if (moved) return { ...state, piece: moved };
    return lockAndAdvance(state);
}

export function togglePause(state) {
    if (state.status === 'over') return state;
    if (state.status === 'paused') return { ...state, status: 'playing' };
    return { ...state, status: 'paused' };
}
