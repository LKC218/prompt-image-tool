import { describe, expect, it } from 'vitest';
import {
    estimateDataUrlSize,
    getDataUrlMimeType,
    getImageExtensionByMime
} from './image-utils.js';

describe('image-utils', () => {
    it('estimates base64 data url byte size with padding', () => {
        expect(estimateDataUrlSize('data:image/png;base64,YQ==')).toBe(1);
        expect(estimateDataUrlSize('data:image/png;base64,YWI=')).toBe(2);
        expect(estimateDataUrlSize('data:image/png;base64,YWJj')).toBe(3);
    });

    it('reads mime type from data url and falls back to png', () => {
        expect(getDataUrlMimeType('data:image/webp;base64,abc')).toBe('image/webp');
        expect(getDataUrlMimeType('data:image/JPEG;base64,abc')).toBe('image/jpeg');
        expect(getDataUrlMimeType('invalid')).toBe('image/png');
    });

    it('maps supported image mime types to storage extensions', () => {
        expect(getImageExtensionByMime('image/jpeg')).toBe('jpg');
        expect(getImageExtensionByMime('image/jpg')).toBe('jpg');
        expect(getImageExtensionByMime('image/webp')).toBe('webp');
        expect(getImageExtensionByMime('image/gif')).toBe('gif');
        expect(getImageExtensionByMime('image/png')).toBe('png');
    });
});
