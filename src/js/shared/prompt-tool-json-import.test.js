import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    PROMPT_IMAGE_TOOL_IMPORT_SCHEMA,
    isPromptImageToolImportJson,
    isChatGptVaultConversationJson,
    normalizeAnyPromptImageToolImport,
    normalizePromptImageToolImport,
    normalizeChatGptVaultConversationImport,
    stagePromptImageToolImport,
    stageChatGptVaultConversationImport,
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
        vi.unstubAllGlobals();
    });

    it('识别 prompt-image-tool 专用 schema', () => {
        expect(isPromptImageToolImportJson({
            schema: PROMPT_IMAGE_TOOL_IMPORT_SCHEMA,
            prompt: {},
            images: [],
        })).toBe(true);
        expect(isPromptImageToolImportJson({ schema: 'other' })).toBe(false);
    });

    it('不会把完整备份 JSON 误判为提示词导入包', async () => {
        const backupJson = {
            backup_meta: { format: 'prompt-image-tool-backup' },
            folders: [],
            prompt_sets: [{ id: 'set-1', versions: [] }],
        };

        expect(normalizeAnyPromptImageToolImport(backupJson)).toBeNull();
        await expect(stagePromptImageToolImport(backupJson)).resolves.toBeNull();
        await expect(stageChatGptVaultConversationImport(backupJson)).resolves.toBeNull();
    });

    it('把单条 ChatGPT 档案 JSON 转成新建提示词导入 payload', () => {
        const archiveJson = {
            schemaVersion: '1.0',
            id: 'chat-archive-1',
            source: 'ChatGPT Conversation Vault - CheeseTa',
            title: '归档对话标题',
            savedAt: '2026-05-24T00:00:00.000Z',
            messages: [
                {
                    id: 'msg-1',
                    role: 'user',
                    content: [
                        '```json',
                        '{ "content_type": "image_asset_pointer" }',
                        '```',
                        '',
                        '第一段提示词。',
                        '',
                        '第二段提示词。',
                    ].join('\n'),
                },
            ],
        };

        expect(isChatGptVaultConversationJson(archiveJson)).toBe(true);
        const payload = normalizeAnyPromptImageToolImport(archiveJson);
        expect(normalizeChatGptVaultConversationImport(archiveJson)).toMatchObject({
            prompt: {
                title: '归档对话标题',
            },
        });

        expect(payload).toMatchObject({
            schema: PROMPT_IMAGE_TOOL_IMPORT_SCHEMA,
            conversationId: 'chat-archive-1',
            conversationTitle: '归档对话标题',
            prompt: {
                title: '归档对话标题',
                positivePrompt: ['第一段提示词。', '', '第二段提示词。'].join('\n'),
                note: '从 ChatGPT 对话归档导入',
            },
        });
        expect(payload.images).toEqual([]);
        expect(payload.raw.messageCount).toBe(1);
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

    it('支持暂存与消费联动', async () => {
        const payload = await stagePromptImageToolImport({
            schema: PROMPT_IMAGE_TOOL_IMPORT_SCHEMA,
            conversationTitle: '暂存测试',
            prompt: { title: '标题', positivePrompt: '正向', negativePrompt: '', tags: [] },
            images: [],
        });

        const stored = await consumePromptImageToolImport(payload.id);
        expect(stored.prompt.title).toBe('标题');
        await expect(consumePromptImageToolImport(payload.id)).resolves.toBeNull();
    });

    it('暂存入口兼容单条 ChatGPT 档案 JSON', async () => {
        const payload = await stagePromptImageToolImport({
            schemaVersion: '1.0',
            id: 'chat-archive-stage',
            title: '档案暂存',
            messages: [{ role: 'user', content: '自然语言提示词' }],
        });

        const stored = await consumePromptImageToolImport(payload.id);
        expect(stored.prompt.title).toBe('档案暂存');
        expect(stored.prompt.positivePrompt).toBe('自然语言提示词');
    });

    it('导入对话入口兼容单条 ChatGPT 档案 JSON', async () => {
        const payload = await stageChatGptVaultConversationImport({
            schemaVersion: '1.0',
            id: 'chat-archive-chatgpt',
            title: '对话导入',
            messages: [{ role: 'user', content: '导入对话正文' }],
        });

        const stored = await consumePromptImageToolImport(payload.id);
        expect(stored.prompt.title).toBe('对话导入');
        expect(stored.prompt.positivePrompt).toBe('导入对话正文');
    });

    it('导入对话入口也兼容 prompt-image-tool 专用 JSON', async () => {
        const payload = await stageChatGptVaultConversationImport({
            schema: PROMPT_IMAGE_TOOL_IMPORT_SCHEMA,
            conversationTitle: '专用导入',
            prompt: { title: '专用导入', positivePrompt: '正向', tags: [] },
            images: [],
        });

        const stored = await consumePromptImageToolImport(payload.id);
        expect(stored.prompt.title).toBe('专用导入');
        expect(stored.prompt.positivePrompt).toBe('正向');
    });

    it('Web Storage 配额失败时仍能暂存带参考图片的专用 JSON', async () => {
        vi.stubGlobal('indexedDB', undefined);
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('Quota exceeded', 'QuotaExceededError');
        });

        const payload = await stagePromptImageToolImport({
            schema: PROMPT_IMAGE_TOOL_IMPORT_SCHEMA,
            conversationTitle: '大图导入',
            prompt: { title: '大图导入', positivePrompt: '正向', tags: [] },
            images: [{
                fileName: '参考图.png',
                mimeType: 'image/png',
                dataUrl: `data:image/png;base64,${'A'.repeat(128 * 1024)}`,
                source: 'chatgpt-current-dom',
            }],
        });

        const stored = await consumePromptImageToolImport(payload.id);
        expect(stored.prompt.title).toBe('大图导入');
        expect(stored.images).toHaveLength(1);
        expect(stored.images[0].fileName).toBe('参考图.png');
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
