import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getTagStyleClass, aggregateTags, getCustomTags, saveCustomTag, removeCustomTag } from './tag-utils.js';

describe('tag-utils', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    describe('getTagStyleClass', () => {
        it('should return mapped style for known tags', () => {
            expect(getTagStyleClass('场景')).toBe('m-tag-scene');
            expect(getTagStyleClass('日系')).toBe('m-tag-japanese');
            expect(getTagStyleClass('科幻')).toBe('m-tag-scifi');
            expect(getTagStyleClass('插画')).toBe('m-tag-illustration');
            expect(getTagStyleClass('国风')).toBe('m-tag-chinese');
        });

        it('should return default style for unknown tags', () => {
            expect(getTagStyleClass('自定义')).toBe('m-tag-default');
            expect(getTagStyleClass('')).toBe('m-tag-default');
        });
    });

    describe('custom tags (localStorage)', () => {
        it('should start with empty custom tags', () => {
            expect(getCustomTags()).toEqual([]);
        });

        it('should save and retrieve custom tags', () => {
            const result = saveCustomTag('测试标签');
            expect(result).toBe(true);
            expect(getCustomTags()).toContain('测试标签');
        });

        it('should not duplicate custom tags', () => {
            saveCustomTag('标签A');
            saveCustomTag('标签A');
            expect(getCustomTags().filter(t => t === '标签A').length).toBe(1);
        });

        it('should save multiple custom tags', () => {
            saveCustomTag('标签A');
            saveCustomTag('标签B');
            saveCustomTag('标签C');
            const tags = getCustomTags();
            expect(tags).toContain('标签A');
            expect(tags).toContain('标签B');
            expect(tags).toContain('标签C');
        });

        it('should remove custom tag', () => {
            saveCustomTag('标签A');
            saveCustomTag('标签B');
            removeCustomTag('标签A');
            const tags = getCustomTags();
            expect(tags).not.toContain('标签A');
            expect(tags).toContain('标签B');
        });

        it('should handle localStorage failure gracefully on save', () => {
            const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
            setItemSpy.mockImplementation(() => { throw new Error('QuotaExceededError'); });
            const result = saveCustomTag('测试');
            expect(result).toBe(false);
            setItemSpy.mockRestore();
        });

        it('should handle localStorage failure gracefully on remove', () => {
            saveCustomTag('标签A');
            const originalSetItem = localStorage.setItem;
            localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
            expect(() => removeCustomTag('标签A')).not.toThrow();
            localStorage.setItem = originalSetItem;
        });

        it('should handle corrupted localStorage data', () => {
            localStorage.setItem('m_custom_tags', 'not-valid-json');
            expect(getCustomTags()).toEqual([]);
        });
    });

    describe('aggregateTags', () => {
        it('should return empty array for null input', () => {
            expect(aggregateTags(null)).toEqual([]);
        });

        it('should return empty array for undefined input', () => {
            expect(aggregateTags(undefined)).toEqual([]);
        });

        it('should return empty array for empty array', () => {
            expect(aggregateTags([])).toEqual([]);
        });

        it('should aggregate tags from prompt sets', () => {
            const promptSets = [
                { tags: '["场景","日系"]' },
                { tags: '["场景","科幻"]' },
                { tags: '["日系","插画"]' },
            ];
            const result = aggregateTags(promptSets);
            expect(result.length).toBe(4);
            expect(result.find(t => t.name === '场景').count).toBe(2);
            expect(result.find(t => t.name === '日系').count).toBe(2);
            expect(result.find(t => t.name === '科幻').count).toBe(1);
            expect(result.find(t => t.name === '插画').count).toBe(1);
        });

        it('should sort tags by count descending', () => {
            const promptSets = [
                { tags: '["A","B","C"]' },
                { tags: '["A","B"]' },
                { tags: '["A"]' },
            ];
            const result = aggregateTags(promptSets);
            expect(result[0].name).toBe('A');
            expect(result[0].count).toBe(3);
            expect(result[1].name).toBe('B');
            expect(result[1].count).toBe(2);
            expect(result[2].name).toBe('C');
            expect(result[2].count).toBe(1);
        });

        it('should handle invalid tags JSON gracefully', () => {
            const promptSets = [
                { tags: 'invalid-json' },
                { tags: '["有效标签"]' },
            ];
            const result = aggregateTags(promptSets);
            expect(result.length).toBe(1);
            expect(result[0].name).toBe('有效标签');
        });

        it('should handle empty tags field', () => {
            const promptSets = [
                { tags: '' },
                { tags: '[]' },
                { tags: '["标签A"]' },
            ];
            const result = aggregateTags(promptSets);
            expect(result.length).toBe(1);
            expect(result[0].name).toBe('标签A');
        });

        it('should filter out empty and non-string tags', () => {
            const promptSets = [
                { tags: '["有效", "", "  ", null, 123, true]' },
            ];
            const result = aggregateTags(promptSets);
            expect(result.length).toBe(1);
            expect(result[0].name).toBe('有效');
        });

        it('should include custom tags with count 0 when not in prompt sets', () => {
            saveCustomTag('自定义标签');
            const result = aggregateTags([]);
            const customTag = result.find(t => t.name === '自定义标签');
            expect(customTag).toBeTruthy();
            expect(customTag.count).toBe(0);
        });

        it('should not duplicate custom tags that already exist in prompt sets', () => {
            saveCustomTag('场景');
            const promptSets = [
                { tags: '["场景"]' },
            ];
            const result = aggregateTags(promptSets);
            const sceneTags = result.filter(t => t.name === '场景');
            expect(sceneTags.length).toBe(1);
            expect(sceneTags[0].count).toBe(1);
        });

        it('should assign correct style classes', () => {
            const promptSets = [
                { tags: '["场景","日系","自定义"]' },
            ];
            const result = aggregateTags(promptSets);
            expect(result.find(t => t.name === '场景').style).toBe('m-tag-scene');
            expect(result.find(t => t.name === '日系').style).toBe('m-tag-japanese');
            expect(result.find(t => t.name === '自定义').style).toBe('m-tag-default');
        });
    });
});
