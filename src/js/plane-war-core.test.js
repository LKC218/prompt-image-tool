import { describe, expect, it } from 'vitest';
import {
    FIELD_H,
    FIELD_W,
    clamp,
    createGameState,
    createPlayer,
    movePlayer,
    rectsOverlap,
    spawnEnemy,
    tick,
    togglePause,
    tryFire,
} from './plane-war-core.js';

describe('plane-war-core', () => {
    it('clamp 边界', () => {
        expect(clamp(5, 0, 10)).toBe(5);
        expect(clamp(-1, 0, 10)).toBe(0);
        expect(clamp(99, 0, 10)).toBe(10);
    });

    it('玩家初始在底部中央', () => {
        const p = createPlayer();
        expect(p.x).toBe(FIELD_W / 2);
        expect(p.y).toBeGreaterThan(FIELD_H * 0.8);
        expect(p.lives).toBe(3);
    });

    it('移动限制在场地内', () => {
        let state = createGameState(() => 0.5);
        state = { ...state, player: { ...state.player, x: 10, y: FIELD_H - 50 } };
        const left = movePlayer(state, -1, 0, 1);
        expect(left.player.x).toBe(state.player.w / 2);
        const right = movePlayer(state, 1, 0, 5);
        expect(right.player.x).toBe(FIELD_W - state.player.w / 2);
    });

    it('射击生成子弹并进入冷却', () => {
        let state = createGameState();
        state = tryFire(state, 0.2);
        expect(state.bullets).toHaveLength(1);
        const again = tryFire(state, 0.01);
        expect(again.bullets).toHaveLength(1);
    });

    it('矩形碰撞', () => {
        expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 4, y: 4, w: 10, h: 10 })).toBe(true);
        expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 40, y: 40, w: 10, h: 10 })).toBe(false);
    });

    it('敌机生成含类型字段', () => {
        const e = spawnEnemy({ wave: 1, enemyId: 1, random: () => 0.1 });
        expect(e.type).toBe('basic');
        expect(e.hp).toBeGreaterThan(0);
    });

    it('tick 后子弹上移敌机下移', () => {
        let state = createGameState(() => 0);
        state = tryFire(state, 0.2);
        const yBullet = state.bullets[0].y;
        const next = tick(state, 0.05);
        expect(next.bullets[0].y).toBeLessThan(yBullet);
    });

    it('暂停切换', () => {
        let state = createGameState();
        state = togglePause(state);
        expect(state.status).toBe('paused');
        state = togglePause(state);
        expect(state.status).toBe('playing');
    });

    it('敌机撞玩家扣命并进入无敌', () => {
        let state = createGameState(() => 0);
        const p = state.player;
        state = {
            ...state,
            player: { ...p, invincible: 0 },
            enemies: [{
                id: 99,
                type: 'basic',
                hp: 1,
                maxHp: 1,
                w: 20,
                h: 20,
                x: p.x,
                y: p.y,
                vy: 0,
                vx: 0,
                score: 10,
            }],
            spawnTimer: 99,
        };
        const next = tick(state, 0.016);
        expect(next.player.lives).toBe(2);
        expect(next.player.invincible).toBeGreaterThan(0);
        expect(next.enemies).toHaveLength(0);
    });

    it('子弹击毁敌机加分', () => {
        let state = createGameState(() => 0);
        const p = state.player;
        state = {
            ...state,
            score: 0,
            player: { ...p, cooldown: 0.99 },
            bullets: [{ id: 'b1', x: 100, y: 100, w: 4, h: 12, vy: 0 }],
            enemies: [{
                id: 7,
                type: 'basic',
                hp: 1,
                maxHp: 1,
                w: 20,
                h: 20,
                x: 100,
                y: 100,
                vy: 0,
                vx: 0,
                score: 10,
            }],
            spawnTimer: 99,
        };
        const next = tick(state, 0.016);
        expect(next.score).toBe(10);
        expect(next.enemies).toHaveLength(0);
        expect(next.bullets).toHaveLength(0);
    });

    it('生命归零进入结束态', () => {
        let state = createGameState(() => 0);
        const p = state.player;
        state = {
            ...state,
            player: { ...p, lives: 1, invincible: 0 },
            enemies: [{
                id: 1,
                type: 'basic',
                hp: 1,
                maxHp: 1,
                w: 20,
                h: 20,
                x: p.x,
                y: p.y,
                vy: 0,
                vx: 0,
                score: 10,
            }],
            spawnTimer: 99,
        };
        const next = tick(state, 0.016);
        expect(next.status).toBe('over');
        expect(next.player.lives).toBe(0);
    });
});
