import { describe, expect, it } from 'vitest';
import {
    CYCLE_DAYS,
    DAY_MS,
    DEW_DAYS,
    BUG_DAYS,
    FLOWER_COUNT,
    applyCare,
    applyCareAll,
    clearBug,
    createInitialState,
    cycleDayFromStart,
    dayPose,
    decorationsForDay,
    forceResetCycle,
    isCareComplete,
    normalizeState,
    refreshCycle,
    setCycleDayDirect,
    shovelCycle,
    stageKeyFromDay,
} from './plant-core.js';

describe('30 天轮回基础', () => {
    it('cycleDayFromStart 从 1 起算并封顶 30', () => {
        const start = Date.UTC(2026, 8, 1);
        expect(cycleDayFromStart(start, start)).toBe(1);
        expect(cycleDayFromStart(start, start + DAY_MS)).toBe(2);
        expect(cycleDayFromStart(start, start + 29 * DAY_MS)).toBe(30);
        expect(cycleDayFromStart(start, start + 90 * DAY_MS)).toBe(30);
    });

    it('stageKeyFromDay 映射 12 档', () => {
        expect(stageKeyFromDay(1)).toBe('01-seed');
        expect(stageKeyFromDay(2)).toBe('01-seed');
        expect(stageKeyFromDay(3)).toBe('02-sprout');
        expect(stageKeyFromDay(20)).toBe('08-peak');
        expect(stageKeyFromDay(24)).toBe('10-bloom-full');
        expect(stageKeyFromDay(27)).toBe('11-wilt');
        expect(stageKeyFromDay(30)).toBe('12-dead');
    });

    it('dayPose 对同一天确定', () => {
        const a = dayPose(9);
        const b = dayPose(9);
        expect(a).toEqual(b);
        expect(a.tilt).toBeGreaterThanOrEqual(-3);
        expect(a.tilt).toBeLessThanOrEqual(3);
        expect(a.scale).toBeGreaterThanOrEqual(0.97);
        expect(a.scale).toBeLessThanOrEqual(1.04);
    });

    it('decorationsForDay 与对照表一致', () => {
        expect(DEW_DAYS.has(2)).toBe(true);
        expect(BUG_DAYS.has(5)).toBe(true);
        expect(decorationsForDay(2).dew).toBe(true);
        expect(decorationsForDay(5).bug).toBe(true);
        expect(decorationsForDay(8).butterfly).toBe(true);
        expect(decorationsForDay(20).flowerCount).toBe(FLOWER_COUNT[20]);
        expect(decorationsForDay(27).leafFall).toBe(1);
        expect(decorationsForDay(29).leafFall).toBe(2);
        expect(decorationsForDay(1).flowerCount).toBe(0);
    });
});

describe('createInitialState / refreshCycle', () => {
    it('初始为第 1 天 seed', () => {
        const now = Date.UTC(2026, 8, 16, 4, 0, 0);
        const s = createInitialState(now);
        expect(s.cycleDay).toBe(1);
        expect(s.stageKey).toBe('01-seed');
        expect(s.canShovel).toBe(false);
        expect(isCareComplete(s.care)).toBe(false);
    });

    it('跨日重置养护', () => {
        const day1 = Date.UTC(2026, 8, 16, 4, 0, 0);
        let s = createInitialState(day1);
        s = applyCareAll(s, day1);
        expect(isCareComplete(s.care)).toBe(true);
        const day2 = day1 + DAY_MS;
        s = refreshCycle(s, day2);
        expect(s.care.watered).toBe(false);
        expect(s.cycleDay).toBe(2);
    });

    it('第 30 天 canShovel', () => {
        const start = Date.UTC(2026, 8, 1);
        const s = setCycleDayDirect(createInitialState(start), 30, start + 29 * DAY_MS);
        expect(s.cycleDay).toBe(30);
        expect(s.canShovel).toBe(true);
        expect(s.stageKey).toBe('12-dead');
    });

    it('normalizeState 非法回退', () => {
        expect(normalizeState(null).cycleDay).toBe(1);
        expect(normalizeState('x').stageKey).toBe('01-seed');
    });
});

describe('养护 / 除害 / 铲除', () => {
    it('养护幂等且不改变 cycleDay', () => {
        const now = Date.UTC(2026, 8, 16, 4, 0, 0);
        let s = createInitialState(now);
        s = applyCare(s, 'watered', now);
        expect(s.care.watered).toBe(true);
        expect(s.cycleDay).toBe(1);
        const s2 = applyCare(s, 'watered', now);
        expect(s2.care.watered).toBe(true);
    });

    it('clearBug 仅标记 bugCleared', () => {
        const now = Date.UTC(2026, 8, 16, 4, 0, 0);
        let s = setCycleDayDirect(createInitialState(now), 5, now);
        expect(s.bugCleared).toBe(false);
        s = clearBug(s, now);
        expect(s.bugCleared).toBe(true);
        expect(s.cycleDay).toBe(5);
    });

    it('未到 30 天不能铲除', () => {
        const now = Date.UTC(2026, 8, 16, 4, 0, 0);
        let s = createInitialState(now);
        s = shovelCycle(s, now);
        expect(s.cycleDay).toBe(1);
        expect(s.cycleStartAt).toBe(now);
    });

    it('第 30 天铲除后回到第 1 天并 totalCycles+1', () => {
        const start = Date.UTC(2026, 8, 1);
        const now = start + 29 * DAY_MS;
        let s = setCycleDayDirect(createInitialState(start), 30, now);
        expect(s.canShovel).toBe(true);
        s = shovelCycle(s, now + 1000);
        expect(s.cycleDay).toBe(1);
        expect(s.stageKey).toBe('01-seed');
        expect(s.canShovel).toBe(false);
        expect(s.totalCycles).toBe(1);
    });

    it('forceResetCycle 任意天数可重置且保留 totalCycles', () => {
        const now = Date.UTC(2026, 8, 16);
        let s = createInitialState(now);
        s = setCycleDayDirect(s, 30, now);
        s = shovelCycle(s, now);
        s = setCycleDayDirect(s, 12, now);
        s = forceResetCycle(s, now);
        expect(s.cycleDay).toBe(1);
        expect(s.totalCycles).toBe(1);
    });
});
