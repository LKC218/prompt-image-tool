const PROMPT_IMAGE_TOOL_IMPORT_SCHEMA = 'prompt-image-tool.import.v1';
const PROMPT_IMAGE_TOOL_IMPORT_PREFIX = 'prompt-image-tool-import:';

function isPromptImageToolImportJson(data) {
    return Boolean(
        data &&
        data.schema === PROMPT_IMAGE_TOOL_IMPORT_SCHEMA &&
        (Array.isArray(data.images) || data.images == null) &&
        (data.prompt == null || typeof data.prompt === 'object')
    );
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

function stagePromptImageToolImport(payload) {
    const normalized = normalizePromptImageToolImport(payload);
    if (!normalized) return null;
    const storage = getStageStorage();
    storage.setItem(buildPromptImageToolImportKey(normalized.id), JSON.stringify(normalized));
    return normalized;
}

function consumePromptImageToolImport(importId) {
    const storage = getStageStorage();
    const key = buildPromptImageToolImportKey(importId);
    const raw = storage.getItem(key);
    if (!raw) return null;
    storage.removeItem(key);
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

function getStageStorage() {
    try {
        if (typeof sessionStorage !== 'undefined') return sessionStorage;
    } catch (e) {}
    return localStorage;
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
    normalizePromptImageToolImport,
    stagePromptImageToolImport,
    consumePromptImageToolImport,
    dataUrlToImportedImage,
    extractReadablePromptText,
};
