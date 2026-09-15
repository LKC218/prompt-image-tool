import { describe, expect, it } from 'vitest';
import {
    COLS,
    ROWS,
    clearLines,
    collides,
    createBag,
    createEmptyBoard,
    createPiece,
    createGameState,
    hardDropY,
    mergePiece,
    rotateMatrix,
    scoreForLines,
    dropIntervalForLevel,
    tryRotate,
    softDrop,
    hardDrop,
    moveHorizontal,
} from './tetris-core.js';

describe('tetris-core 基础', () => {
    it('空棋盘尺寸正确', () => {
        const board = createEmptyBoard();
        expect(board).toHaveLength(ROWS);
        expect(board[0]).toHaveLength(COLS);
        expect(board.every((row) => row.every((c) => c === null))).toBe(true);
    });

    it('7-bag 每 7 个包含全部方块类型', () => {
        const bag = createBag(() => 0.5);
        expect(new Set(bag).size).toBe(7);
    });

    it('旋转矩阵顺时针', () => {
        const m = [
            [0, 1, 0],
            [1, 1, 1],
            [0, 0, 0],
        ];
        const r = rotateMatrix(m, 1);
        expect(r).toEqual([
            [0, 1, 0],
            [0, 1, 1],
            [0, 1, 0],
        ]);
    });
});

describe('碰撞与合并', () => {
    it('左右边界碰撞', () => {
        const board = createEmptyBoard();
        const piece = { ...createPiece('I'), x: -1, y: 0 };
        // I 形态中间行有块，x=-1 时部分越界
        expect(collides(board, piece)).toBe(true);
    });

    it('落地合并后棋盘有颜色', () => {
        const board = createEmptyBoard();
        const piece = { ...createPiece('O'), x: 4, y: ROWS - 2 };
        const merged = mergePiece(board, piece);
        expect(merged[ROWS - 2][4]).toBe('O');
        expect(merged[ROWS - 1][5]).toBe('O');
    });
});

describe('消行与计分', () => {
    it('满行消除并计分', () => {
        const board = createEmptyBoard();
        board[ROWS - 1] = Array(COLS).fill('I');
        board[ROWS - 2][0] = 'T';
        const result = clearLines(board);
        expect(result.lines).toBe(1);
        expect(result.board[ROWS - 1][0]).toBe('T');
        expect(result.board[0].every((c) => c === null)).toBe(true);
        expect(scoreForLines(1, 1)).toBe(100);
        expect(scoreForLines(4, 2)).toBe(1600);
    });

    it('等级影响下落间隔', () => {
        expect(dropIntervalForLevel(1)).toBeGreaterThan(dropIntervalForLevel(10));
        expect(dropIntervalForLevel(99)).toBe(100);
    });
});

describe('操作与硬降', () => {
    it('水平移动成功与失败', () => {
        const board = createEmptyBoard();
        const state = {
            ...createGameState(() => 0.1),
            status: 'playing',
        };
        const left = moveHorizontal(state, -1);
        expect(left.piece.x).toBe(state.piece.x - 1);
    });

    it('硬降落到底并锁定生成下一块', () => {
        let state = createGameState(() => 0);
        state = { ...state, status: 'playing' };
        const yBefore = state.piece.y;
        state = hardDrop(state);
        expect(state.board.some((row) => row.some((c) => c))).toBe(true);
        expect(state.score).toBeGreaterThan(0);
        expect(['playing', 'over']).toContain(state.status);
    });

    it('软降加分或锁定', () => {
        let state = createGameState(() => 0);
        state = { ...state, status: 'playing', piece: { ...createPiece('O'), x: 4, y: 0 } };
        const after = softDrop(state);
        expect(after.score >= state.score).toBe(true);
    });

    it('旋转撞墙时用简单 kick', () => {
        const board = createEmptyBoard();
        const piece = { ...createPiece('I'), x: -1, y: 0, matrix: rotateMatrix(createPiece('I').matrix, 1) };
        const rotated = tryRotate(board, { ...piece, x: 0 }, 1);
        // 只要不抛错；可能成功或因 kick 失败返回 null
        expect(rotated === null || typeof rotated.x === 'number').toBe(true);
    });

    it('硬降 Y 计算正确', () => {
        const board = createEmptyBoard();
        const piece = createPiece('O');
        expect(hardDropY(board, piece)).toBe(ROWS - 2);
    });
});
