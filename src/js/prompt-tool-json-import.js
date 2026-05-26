const PROMPT_IMAGE_TOOL_IMPORT_SCHEMA = 'prompt-image-tool.import.v1';
const PROMPT_IMAGE_TOOL_IMPORT_PREFIX = 'prompt-image-tool-import:';
const PROMPT_IMAGE_TOOL_IMPORT_DB_NAME = 'prompt-image-tool-import-stage';
const PROMPT_IMAGE_TOOL_IMPORT_STORE_NAME = 'imports';
const PROMPT_IMAGE_TOOL_IMPORT_DB_VERSION = 1;
const IMPORT_STAGE_STORAGE_ERROR = 'PROMPT_IMAGE_TOOL_IMPORT_STAGE_STORAGE_ERROR';

const memoryImportStage = new Map();

function isPromptImageToolImportJson(data) {
    return Boolean(
        data &&
        data.schema === PROMPT_IMAGE_TOOL_IMPORT_SCHEMA &&
        (Array.isArray(data.images) || data.images == null) &&
        (data.prompt == null || typeof data.prompt === 'object')
    );
}

function isChatGptVaultConversationJson(data) {
    return Boolean(
        data &&
        !data.backup_meta &&
        !data.backupMeta &&
        Array.isArray(data.messages) &&
        data.messages.some(message => message && String(message.content || message.text || '').trim()) &&
        (data.source || data.schemaVersion || data.schema_version || data.title)
    );
}

function normalizeAnyPromptImageToolImport(data) {
    const chatGptVaultImport = normalizeChatGptVaultConversationImport(data);
    if (chatGptVaultImport) return chatGptVaultImport;
    if (isPromptImageToolImportJson(data)) return normalizePromptImageToolImport(data);
    return null;
}

function normalizePromptImageToolImport(data) {
    if (!isPromptImageToolImportJson(data)) return null;

    const conversationTitle = safeText(data.conversationTitle || data.prompt?.title || '未命名对话');
    const prompt = data.prompt || {};
    const images = Array.isArray(data.images) ? data.images.map((image, index) => normalizeImportImage(image, index)).filter(Boolean) : [];

    return {
        id: safeText(data.importId || data.conversationId || generateImportId()),
        schema: PROMPT_IMAGE_TOOL_IMPORT_SCHEMA,
        sourceTool: safeText(data.sourceTool || ''),
        targetTool: 'prompt-image-tool',
        conversationId: safeText(data.conversationId || ''),
        conversationTitle,
        exportedFileName: safeText(data.exportedFileName || ''),
        exportedAt: safeText(data.exportedAt || ''),
        prompt: {
            title: safeText(prompt.title || conversationTitle),
            positivePrompt: normalizePositivePromptText(prompt.positivePrompt),
            negativePrompt: safeText(prompt.negativePrompt || ''),
            note: safeText(prompt.note || ''),
            tags: normalizeTags(prompt.tags),
            aspectRatio: safeText(prompt.aspectRatio || '1:1') || '1:1',
        },
        images,
        skippedImages: Array.isArray(data.skippedImages) ? data.skippedImages.map(item => ({
            id: safeText(item?.id || ''),
            fileName: safeText(item?.fileName || ''),
            reason: safeText(item?.reason || ''),
            source: safeText(item?.source || ''),
            size: item?.size ?? null,
        })) : [],
        raw: data.raw && typeof data.raw === 'object' ? { ...data.raw } : {},
    };
}

function normalizeChatGptVaultConversationImport(data) {
    if (isPromptImageToolImportJson(data)) return normalizePromptImageToolImport(data);
    if (!isChatGptVaultConversationJson(data)) return null;
    return normalizePromptImageToolImport(convertChatGptVaultConversation(data));
}

function convertChatGptVaultConversation(data) {
    const messages = Array.isArray(data.messages) ? data.messages : [];
    const firstMessage = messages.find(message => {
        const content = message?.content || message?.text || '';
        return String(content).trim();
    });
    const title = safeText(data.title || data.conversationTitle || '导入对话');
    const sourceText = firstMessage?.content || firstMessage?.text || '';

    return {
        schema: PROMPT_IMAGE_TOOL_IMPORT_SCHEMA,
        sourceTool: safeText(data.source || 'ChatGPT Conversation Vault'),
        targetTool: 'prompt-image-tool',
        conversationId: safeText(data.id || data.conversationId || data.conversation_id || ''),
        conversationTitle: title,
        exportedFileName: safeText(data.metadata?.filename || ''),
        exportedAt: safeText(data.savedAt || data.updatedAt || data.updated_at || ''),
        prompt: {
            title,
            positivePrompt: sourceText,
            negativePrompt: '',
            note: '从 ChatGPT 对话归档导入',
            tags: ['ChatGPT导入'],
            aspectRatio: '1:1',
        },
        images: [],
        skippedImages: [],
        raw: {
            messageCount: messages.length,
            model: safeText(data.model || ''),
        },
    };
}

async function stagePromptImageToolImport(payload) {
    const normalized = normalizeAnyPromptImageToolImport(payload);
    if (!normalized) return null;
    await storePromptImageToolImport(normalized);
    return normalized;
}

async function stageChatGptVaultConversationImport(payload) {
    const normalized = normalizeChatGptVaultConversationImport(payload);
    if (!normalized) return null;
    await storePromptImageToolImport(normalized);
    return normalized;
}

async function consumePromptImageToolImport(importId) {
    const key = buildPromptImageToolImportKey(importId);
    const raw = await readPromptImageToolImport(key);
    await removePromptImageToolImport(key);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
}

function dataUrlToImportedImage(image, index = 0) {
    if (!image || !image.dataUrl) return null;
    const mimeType = safeText(image.mimeType || getDataUrlMimeType(image.dataUrl) || 'image/png') || 'image/png';
    const fileName = safeText(image.fileName || buildImportImageName(index, mimeType));
    const size = Number(image.size || estimateDataUrlSize(image.dataUrl) || 0);
    const file = createFileLike(fileName, mimeType, size);
    return {
        dataUrl: image.dataUrl,
        compressedUrl: image.dataUrl,
        name: fileName,
        type: mimeType,
        size,
        file,
        source: safeText(image.source || ''),
        width: image.width ?? null,
        height: image.height ?? null,
        restoredFromPromptToolImport: true,
    };
}

function buildPromptImageToolImportKey(importId) {
    return `${PROMPT_IMAGE_TOOL_IMPORT_PREFIX}${safeText(importId || 'default')}`;
}

function isPromptImageToolImportStorageError(error) {
    return Boolean(error && error.code === IMPORT_STAGE_STORAGE_ERROR);
}

async function storePromptImageToolImport(payload) {
    const key = buildPromptImageToolImportKey(payload.id);
    const raw = JSON.stringify(payload);
    const errors = [];

    if (await writeIndexedDbImport(key, raw, errors)) return;
    if (writeWebStorageImport(key, raw, errors)) return;

    try {
        memoryImportStage.set(key, raw);
        return;
    } catch (error) {
        errors.push(error);
    }

    throw createImportStageStorageError(errors);
}

async function readPromptImageToolImport(key) {
    const indexedDbValue = await readIndexedDbImport(key);
    if (indexedDbValue != null) return indexedDbValue;

    const storageValue = readWebStorageImport(key);
    if (storageValue != null) return storageValue;

    return memoryImportStage.get(key) || null;
}

async function removePromptImageToolImport(key) {
    await deleteIndexedDbImport(key);
    removeWebStorageImport(key);
    memoryImportStage.delete(key);
}

function getStageStorages() {
    const storages = [];
    try {
        if (typeof sessionStorage !== 'undefined') storages.push(sessionStorage);
    } catch (e) {}
    try {
        if (typeof localStorage !== 'undefined') storages.push(localStorage);
    } catch (e) {}
    return storages;
}

function writeWebStorageImport(key, raw, errors = []) {
    const storages = getStageStorages();
    for (const storage of storages) {
        try {
            storage.setItem(key, raw);
            return true;
        } catch (error) {
            errors.push(error);
        }
    }
    return false;
}

function readWebStorageImport(key) {
    const storages = getStageStorages();
    for (const storage of storages) {
        try {
            const raw = storage.getItem(key);
            if (raw != null) return raw;
        } catch (e) {}
    }
    return null;
}

function removeWebStorageImport(key) {
    getStageStorages().forEach(storage => {
        try {
            storage.removeItem(key);
        } catch (e) {}
    });
}

async function writeIndexedDbImport(key, raw, errors = []) {
    try {
        const db = await openImportStageDb();
        if (!db) return false;
        await runImportStageRequest(db, 'readwrite', store => store.put({ key, raw }));
        db.close();
        return true;
    } catch (error) {
        errors.push(error);
        return false;
    }
}

async function readIndexedDbImport(key) {
    try {
        const db = await openImportStageDb();
        if (!db) return null;
        const record = await runImportStageRequest(db, 'readonly', store => store.get(key));
        db.close();
        return record?.raw || null;
    } catch (e) {
        return null;
    }
}

async function deleteIndexedDbImport(key) {
    try {
        const db = await openImportStageDb();
        if (!db) return;
        await runImportStageRequest(db, 'readwrite', store => store.delete(key));
        db.close();
    } catch (e) {}
}

function openImportStageDb() {
    if (typeof indexedDB === 'undefined' || !indexedDB.open) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(PROMPT_IMAGE_TOOL_IMPORT_DB_NAME, PROMPT_IMAGE_TOOL_IMPORT_DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(PROMPT_IMAGE_TOOL_IMPORT_STORE_NAME)) {
                db.createObjectStore(PROMPT_IMAGE_TOOL_IMPORT_STORE_NAME, { keyPath: 'key' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('打开导入暂存数据库失败'));
        request.onblocked = () => reject(new Error('导入暂存数据库被占用'));
    });
}

function runImportStageRequest(db, mode, createRequest) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(PROMPT_IMAGE_TOOL_IMPORT_STORE_NAME, mode);
        const store = transaction.objectStore(PROMPT_IMAGE_TOOL_IMPORT_STORE_NAME);
        const request = createRequest(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('导入暂存读写失败'));
        transaction.onerror = () => reject(transaction.error || new Error('导入暂存事务失败'));
    });
}

function createImportStageStorageError(errors) {
    const error = new Error('导入文件过大或浏览器暂存不可用');
    error.code = IMPORT_STAGE_STORAGE_ERROR;
    error.causes = errors;
    return error;
}

function createFileLike(name, type, size) {
    return { name, type, size };
}

function normalizeTags(tags) {
    if (!Array.isArray(tags)) return [];
    return tags.map(tag => safeText(tag).trim()).filter(Boolean);
}

function normalizePositivePromptText(value) {
    const text = normalizePlainText(value);
    return extractReadablePromptText(text) || text;
}

function extractReadablePromptText(text) {
    const withoutFencedBlocks = safeText(text).replace(/```[\s\S]*?```/g, '\n\n');
    const paragraphs = withoutFencedBlocks
        .split(/\n\s*\n+/)
        .map(part => normalizePlainText(part))
        .filter(Boolean);
    const firstReadableIndex = paragraphs.findIndex(paragraph => !isPromptNoiseParagraph(paragraph));
    if (firstReadableIndex < 0) return '';
    return paragraphs
        .slice(firstReadableIndex)
        .filter(paragraph => !isPromptNoiseParagraph(paragraph))
        .join('\n\n');
}

function isPromptNoiseParagraph(paragraph) {
    const text = normalizePlainText(paragraph);
    if (!text) return true;
    if (/^```/.test(text)) return true;
    if (/\b(content_type|asset_pointer|sediment:\/\/|size_bytes|fovea|metadata|watermarked_asset_pointer)\b/i.test(text)) return true;
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const jsonLikeLines = lines.filter(line => /^["'][^"']+["']\s*:/.test(line) || /^[{}[\],]+$/.test(line));
    if (lines.length >= 3 && jsonLikeLines.length / lines.length > 0.45) return true;
    if (/^[{[]/.test(text) && /[}\]]$/.test(text) && jsonLikeLines.length >= 2) return true;
    return false;
}

function normalizeImportImage(image, index) {
    if (!image || !image.dataUrl) return null;
    return {
        id: safeText(image.id || `image-${String(index + 1).padStart(3, '0')}`),
        fileName: safeText(image.fileName || buildImportImageName(index, image.mimeType || 'image/png')),
        mimeType: safeText(image.mimeType || getDataUrlMimeType(image.dataUrl) || 'image/png') || 'image/png',
        dataUrl: image.dataUrl,
        source: safeText(image.source || ''),
        width: image.width ?? null,
        height: image.height ?? null,
        size: image.size ?? estimateDataUrlSize(image.dataUrl),
    };
}

function buildImportImageName(index, mimeType) {
    const ext = getImageExtensionByMime(mimeType || 'image/png');
    return `prompt-image-tool-import-${String(index + 1).padStart(3, '0')}.${ext}`;
}

function generateImportId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeText(value) {
    return String(value == null ? '' : value);
}

function normalizePlainText(value) {
    return safeText(value)
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function estimateDataUrlSize(dataUrl = '') {
    const commaIndex = dataUrl.indexOf(',');
    if (commaIndex < 0) return 0;
    const base64 = dataUrl.slice(commaIndex + 1);
    const padding = base64.endsWith('==') ? 2 : (base64.endsWith('=') ? 1 : 0);
    return Math.max(0, Math.floor(base64.length * 3 / 4) - padding);
}

function getDataUrlMimeType(dataUrl = '') {
    const match = String(dataUrl || '').match(/^data:([^;,]+)[;,]/i);
    return match ? match[1].toLowerCase() : 'image/png';
}

function getImageExtensionByMime(mimeType = '') {
    const normalized = String(mimeType || '').toLowerCase();
    if (normalized === 'image/jpeg' || normalized === 'image/jpg') return 'jpg';
    if (normalized === 'image/webp') return 'webp';
    if (normalized === 'image/gif') return 'gif';
    return 'png';
}

export {
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
    isPromptImageToolImportStorageError,
};
