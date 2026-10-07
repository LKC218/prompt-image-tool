import { describe, it, expect } from 'vitest';
import cases from '../../../tests/fixtures/image-resize-cases.json';
import { calculateResize, normalizeResize } from './image-resize.js';

describe('前后端共用尺寸规则', () => {
    for (const item of cases) it(item.name, () => {
        const calculate = () => calculateResize(...item.source, item.settings);
        if (!item.expected) expect(calculate).toThrow();
        else {
            const result = calculate();
            expect([result.width, result.height]).toEqual(item.expected);
            expect(result.changed).toBe(item.expected.some((value, index) => value !== item.source[index]));
            expect(calculateResize(...item.source, normalizeResize(item.settings))).toEqual(result);
        }
    });
});
