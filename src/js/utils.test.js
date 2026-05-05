import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateId, formatDate, isMobile } from './utils.js';

describe('generateId', () => {
    it('should return a non-empty string', () => {
        const id = generateId();
        expect(id).toBeTruthy();
        expect(typeof id).toBe('string');
    });

    it('should return unique ids on consecutive calls', () => {
        const ids = new Set();
        for (let i = 0; i < 100; i++) {
            ids.add(generateId());
        }
        expect(ids.size).toBe(100);
    });

    it('should contain base-36 characters', () => {
        const id = generateId();
        expect(id).toMatch(/^[a-z0-9]+$/);
    });
});

describe('formatDate', () => {
    it('should return empty string for falsy input', () => {
        expect(formatDate(null)).toBe('');
        expect(formatDate(undefined)).toBe('');
        expect(formatDate('')).toBe('');
        expect(formatDate(0)).toBe('');
    });

    it('should format a valid timestamp', () => {
        const ts = new Date(2025, 0, 15, 10, 30).getTime();
        const result = formatDate(ts);
        expect(result).toBeTruthy();
        expect(result).toContain('2025');
    });

    it('should return original string for invalid date', () => {
        expect(formatDate('not-a-date')).toBe('not-a-date');
    });

    it('should handle ISO string input', () => {
        const result = formatDate('2025-06-01T12:00:00.000Z');
        expect(result).toBeTruthy();
    });
});

describe('isMobile', () => {
    it('should return true when window width <= 768', () => {
        Object.defineProperty(window, 'innerWidth', { value: 768, configurable: true });
        expect(isMobile()).toBe(true);
    });

    it('should return false when window width > 768', () => {
        Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
        expect(isMobile()).toBe(false);
    });

    it('should return true for small widths', () => {
        Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
        expect(isMobile()).toBe(true);
    });
});
