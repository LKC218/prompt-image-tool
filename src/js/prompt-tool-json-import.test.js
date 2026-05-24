import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    PROMPT_IMAGE_TOOL_IMPORT_SCHEMA,
    isPromptImageToolImportJson,
    normalizePromptImageToolImport,
    stagePromptImageToolImport,
    consumePromptImageToolImport,
    dataUrlToImportedImage,
    extractReadablePromptText,
} from './prompt-tool-json-import.js';

const sampleDataUrl = 'data:image/png;base64,AAAA';

describe('prompt-tool-json-import', () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        vi.restoreAllMocks();
    });

    afterEach(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    it('识别 prompt-image-tool 专用 schema', () => {
        expect(isPromptImageToolImportJson({
            schema: PROMPT_IMAGE_TOOL_IMPORT_SCHEMA,
            prompt: {},
            images: [],
        })).toBe(true);
        expect(isPromptImageToolImportJson({ schema: 'other' })).toBe(false);
    });

    it('标准化导入 payload 并保留图片与兜底字段', () => {
        const payload = normalizePromptImageToolImport({
            schema: PROMPT_IMAGE_TOOL_IMPORT_SCHEMA,
            sourceTool: 'ChatGPT Vault',
            conversationId: 'chat-1',
            conversationTitle: '对话标题',
            exportedFileName: '对话标题-prompt-image-tool.json',
            exportedAt: '2026-05-24T00:00:00.000Z',
            prompt: {
                title: '提示词标题',
                positivePrompt: '正向',
                negativePrompt: '负向',
                note: '备注',
                tags: ['ChatGPT导入', ''],
                aspectRatio: '16:9',
            },
            images: [{
                id: 'image-001',
                fileName: '图片-001.png',
                mimeType: 'image/png',
                dataUrl: sampleDataUrl,
                source: 'chatgpt',
                width: 800,
                height: 600,
                size: 3,
            }],
            skippedImages: [{ id: 'image-002', fileName: '图片-002.png', reason: 'too large', source: 'chatgpt' }],
            raw: { messageCount: 3 },
        });

        expect(payload.id).toBeTruthy();
        expect(payload.prompt.title).toBe('提示词标题');
        expect(payload.prompt.tags).toEqual(['ChatGPT导入']);
        expect(payload.images).toHaveLength(1);
        expect(payload.images[0]).toMatchObject({
            fileName: '图片-001.png',
            mimeType: 'image/png',
            source: 'chatgpt',
            width: 800,
            height: 600,
        });
        expect(payload.skippedImages).toHaveLength(1);
        expect(payload.raw.messageCount).toBe(3);
    });

    it('完整保留 10 张 prompt-image-tool JSON 内嵌图片', () => {
        const images = Array.from({ length: 10 }, (_, index) => ({
            id: `image-${String(index + 1).padStart(3, '0')}`,
            fileName: `图片-${String(index + 1).padStart(3, '0')}.png`,
            mimeType: 'image/png',
            dataUrl: sampleDataUrl,
            source: 'chatgpt',
            width: 800,
            height: 600,
            size: 3,
        }));

        const payload = normalizePromptImageToolImport({
            schema: PROMPT_IMAGE_TOOL_IMPORT_SCHEMA,
            conversationTitle: '十张图片导入',
            prompt: { title: '十张图片导入', positivePrompt: '正向', tags: [] },
            images,
        });

        expect(payload.images).toHaveLength(10);
        expect(payload.images[0].id).toBe('image-001');
        expect(payload.images[9]).toMatchObject({
            id: 'image-010',
            fileName: '图片-010.png',
            mimeType: 'image/png',
        });
    });

    it('支持暂存与消费联动', () => {
        const payload = stagePromptImageToolImport({
            schema: PROMPT_IMAGE_TOOL_IMPORT_SCHEMA,
            conversationTitle: '暂存测试',
            prompt: { title: '标题', positivePrompt: '正向', negativePrompt: '', tags: [] },
            images: [],
        });

        const stored = consumePromptImageToolImport(payload.id);
        expect(stored.prompt.title).toBe('标题');
        expect(consumePromptImageToolImport(payload.id)).toBeNull();
    });

    it('把 dataUrl 转成编辑器可用图片对象', () => {
        const image = dataUrlToImportedImage({
            fileName: '图片-001.png',
            mimeType: 'image/png',
            dataUrl: sampleDataUrl,
            source: 'chatgpt',
            width: 100,
            height: 100,
            size: 3,
        });

        expect(image).toMatchObject({
            name: '图片-001.png',
            type: 'image/png',
            dataUrl: sampleDataUrl,
            compressedUrl: sampleDataUrl,
            source: 'chatgpt',
            width: 100,
            height: 100,
        });
        expect(image.file).toMatchObject({
            name: '图片-001.png',
            type: 'image/png',
            size: 3,
        });
    });

    it('跳过开头代码块，只保留后续自然语言提示词', () => {
        const text = [
            '```json',
            '{',
            '  "content_type": "image_asset_pointer",',
            '  "asset_pointer": "sediment://file_000000009910720b8c7b283f5ea11333",',
            '  "size_bytes": 32092,',
            '  "metadata": {',
            '    "watermarked_asset_pointer": null',
            '  }',
            '}',
            '```',
            '',
            '参考附加图片，将其中的【物品名称】生成一张平面化图片。要求 1:1 比例，主体内容铺满整张画面。',
        ].join('\n');

        expect(extractReadablePromptText(text)).toBe('参考附加图片，将其中的【物品名称】生成一张平面化图片。要求 1:1 比例，主体内容铺满整张画面。');
    });

    it('空行只作为段落分隔，不截断后续正向提示词', () => {
        const text = [
            '请把画面处理成一种克制、清洁、带有纸面触感的高级视觉。',
            '',
            '文字要成为画面结构的一部分。使用超大尺度的主标题、关键词、汉字、数字或符号作为背景骨架。',
            '',
            '色彩系统以低饱和浅底作为空气和页面温度，点睛色只占很小面积。',
        ].join('\n');

        expect(extractReadablePromptText(text)).toBe([
            '请把画面处理成一种克制、清洁、带有纸面触感的高级视觉。',
            '',
            '文字要成为画面结构的一部分。使用超大尺度的主标题、关键词、汉字、数字或符号作为背景骨架。',
            '',
            '色彩系统以低饱和浅底作为空气和页面温度，点睛色只占很小面积。',
        ].join('\n'));
    });

    it('导入标准化时清理 positivePrompt 里的首段元数据', () => {
        const payload = normalizePromptImageToolImport({
            schema: PROMPT_IMAGE_TOOL_IMPORT_SCHEMA,
            conversationTitle: '首段清理',
            prompt: {
                title: '首段清理',
                positivePrompt: [
                    '```',
                    '{',
                    '  "content_type": "image_asset_pointer",',
                    '  "asset_pointer": "sediment://file_1"',
                    '}',
                    '```',
                    '',
                    '参考附加图片，将其中的【物品名称】生成一张平面化图片。',
                ].join('\n'),
                tags: [],
            },
            images: [],
        });

        expect(payload.prompt.positivePrompt).toBe('参考附加图片，将其中的【物品名称】生成一张平面化图片。');
    });

    it('导入标准化时跳过首段元数据并保留后续多段正向提示词', () => {
        const payload = normalizePromptImageToolImport({
            schema: PROMPT_IMAGE_TOOL_IMPORT_SCHEMA,
            conversationTitle: '多段提示词',
            prompt: {
                title: '多段提示词',
                positivePrompt: [
                    '```json',
                    '{',
                    '  "content_type": "image_asset_pointer",',
                    '  "asset_pointer": "sediment://file_1"',
                    '}',
                    '```',
                    '',
                    '第一段自然语言提示词。',
                    '',
                    '第二段自然语言提示词，不能因为空行被截断。',
                    '',
                    '第三段自然语言提示词。',
                ].join('\n'),
                tags: [],
            },
            images: [],
        });

        expect(payload.prompt.positivePrompt).toBe([
            '第一段自然语言提示词。',
            '',
            '第二段自然语言提示词，不能因为空行被截断。',
            '',
            '第三段自然语言提示词。',
        ].join('\n'));
    });
});
