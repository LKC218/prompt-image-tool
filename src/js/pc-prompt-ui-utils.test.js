import { describe, expect, it } from 'vitest';
import { countPromptSetsByFolder, formatPromptForDisplay, getPromptFolderId } from './pc-prompt-ui-utils.js';

describe('pc-prompt-ui-utils', () => {
    it('removes leading whitespace only for detail display', () => {
        expect(formatPromptForDisplay('\n  #提示词\n  保留正文缩进')).toBe('#提示词\n  保留正文缩进');
        expect(formatPromptForDisplay('  hello\n  world')).toBe('hello\n  world');
        expect(formatPromptForDisplay('\t\n  第一行\n\t  第二行')).toBe('第一行\n\t  第二行');
        expect(formatPromptForDisplay('\uFEFF\u3000提示词正文')).toBe('提示词正文');
    });

    it('supports both folderId and folder_id fields', () => {
        expect(getPromptFolderId({ folderId: 'a' })).toBe('a');
        expect(getPromptFolderId({ folder_id: 'b' })).toBe('b');
        expect(getPromptFolderId({})).toBe('');
    });

    it('counts prompt sets by folder and ignores uncategorized items', () => {
        const counts = countPromptSetsByFolder([
            { folderId: 'scene' },
            { folder_id: 'scene' },
            { folderId: 'style' },
            { folderId: '' },
            {}
        ]);

        expect(counts.get('scene')).toBe(2);
        expect(counts.get('style')).toBe(1);
        expect(counts.has('')).toBe(false);
    });
});
