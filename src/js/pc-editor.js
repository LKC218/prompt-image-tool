import { getStorage } from './storage.js';
import { navigate, goBack } from './pc-app.js';
import { showToast, showModal, closeModal, showConfirmModal, showContextMenu, hideContextMenu, showImageViewer, copyToClipboard, escapeHtml } from './pc-utils.js';
import { aggregateTags, getPcTagStyleClass } from './tag-utils.js';
import { readFileAsDataURL, optimizeImageDataUrl } from './image-utils.js';
import { renderPcWelcomeBanner, renderPcWelcomeWalkAnimation } from './pc-welcome-banner.js';
import { pcIcon } from './pc-icon-assets.js';
import { consumePromptImageToolImport, dataUrlToImportedImage } from './prompt-tool-json-import.js';
import editorImagePlaceholderIconUrl from '../../UI设计稿/图标/插画设计/图片.png';

let editMode = false;
let promptSetId = null;
let formData = {
    name: '',
    folderId: '',
    tags: [],
    versions: [{
        name: 'v1',
        prompt: '',
        negativePrompt: '',
        note: '',
        aspectRatio: '1:1',
        stylePreset: '',
        model: '',
        sampler: 'DPM++ 2M Karras',
        steps: 30,
        cfgScale: 7.0,
        hrFix: true,
        images: []
    }]
};
let hasUnsavedChanges = false;
let allTags = [];
let allFolders = [];
let importedImages = [];
let activeDraftKey = '';
let draftStorageWarned = false;
let isSaving = false;

const RATIO_OPTIONS = ['1:1', '3:4', '4:3', '16:9', '9:16', '21:9'];
const MAX_TITLE_LEN = 100;
const MAX_POSITIVE_PROMPT_LEN = 6666;
const MAX_NEGATIVE_PROMPT_LEN = 2000;
const MAX_IMAGES = 10;
const EDITOR_DRAFT_PREFIX = 'pc-editor-draft:';
const EDITOR_DRAFT_VERSION = 1;
const MAX_SOURCE_IMAGE_BYTES = 15 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const IMAGE_OPTIMIZE_OPTIONS = {
    quality: 0.9,
    maxSide: 2560,
    maxInputPixels: 40 * 1000 * 1000,
    outputType: 'image/webp'
};
const TEXT_SELECTION_MENU_DELAY = 180;

const beforeUnloadHandler = (e) => {
    if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
    }
};

function createDefaultFormData() {
    return {
        name: '',
        folderId: '',
        tags: [],
        versions: [{
            name: 'v1',
            prompt: '',
            negativePrompt: '',
            note: '',
            aspectRatio: '1:1',
            stylePreset: '',
            model: '',
            sampler: 'DPM++ 2M Karras',
            steps: 30,
            cfgScale: 7.0,
            hrFix: true,
            images: []
        }]
    };
}

function getEditorDraftKey(id) {
    return `${EDITOR_DRAFT_PREFIX}${id || 'new'}`;
}

function markEditorDirty() {
    hasUnsavedChanges = true;
    saveEditorDraft();
    updateClearAllButtonState();
}

function cloneFormDataForDraft(data) {
    const cloned = JSON.parse(JSON.stringify(data || createDefaultFormData()));
    if (!Array.isArray(cloned.tags)) cloned.tags = [];
    if (!Array.isArray(cloned.versions) || cloned.versions.length === 0) {
        cloned.versions = createDefaultFormData().versions;
    }
    return cloned;
}

function serializeImportedImages() {
    return importedImages
        .filter(img => img?.compressedUrl)
        .map(img => ({
            compressedUrl: img.compressedUrl,
            name: getImportedImageName(img),
            type: img.type || img.file?.type || 'image/jpeg',
            size: img.size || img.file?.size || 0
        }));
}

function deserializeImportedImages(images) {
    if (!Array.isArray(images)) return [];
    return images
        .filter(img => img?.compressedUrl)
        .map(img => ({
            compressedUrl: img.compressedUrl,
            dataUrl: img.compressedUrl,
            name: img.name || 'pasted-image.jpg',
            type: img.type || 'image/jpeg',
            size: img.size || 0,
            restoredFromDraft: true
        }));
}

async function applyPromptImageToolImport(importId) {
    const payload = await consumePromptImageToolImport(importId);
    if (!payload || !payload.prompt) return { applied: false, imageCount: 0 };

    const nextFormData = createDefaultFormData();
    const version = nextFormData.versions[0];

    nextFormData.name = String(payload.prompt.title || payload.conversationTitle || '').slice(0, MAX_TITLE_LEN);
    nextFormData.tags = Array.isArray(payload.prompt.tags) ? payload.prompt.tags.slice() : [];
    version.prompt = String(payload.prompt.positivePrompt || '').slice(0, MAX_POSITIVE_PROMPT_LEN);
    version.negativePrompt = String(payload.prompt.negativePrompt || '').slice(0, MAX_NEGATIVE_PROMPT_LEN);
    version.note = String(payload.prompt.note || '');
    if (RATIO_OPTIONS.includes(payload.prompt.aspectRatio)) {
        version.aspectRatio = payload.prompt.aspectRatio;
    }

    formData = nextFormData;
    importedImages = await buildPromptToolImportedImages(payload.images || []);
    hasUnsavedChanges = true;
    clearEditorDraft();
    saveEditorDraft();

    return { applied: true, imageCount: importedImages.length };
}

async function buildPromptToolImportedImages(images) {
    const result = [];
    const sourceImages = Array.isArray(images) ? images.slice(0, MAX_IMAGES) : [];

    for (let i = 0; i < sourceImages.length; i++) {
        const imported = dataUrlToImportedImage(sourceImages[i], i);
        if (!imported) continue;
        try {
            const optimized = await optimizeImageDataUrl(imported.dataUrl, IMAGE_OPTIMIZE_OPTIONS);
            result.push({
                ...imported,
                compressedUrl: optimized.dataUrl,
                optimized,
                type: optimized.mimeType || imported.type,
                size: optimized.size || imported.size,
            });
        } catch (e) {
            console.warn('prompt tool import image optimize failed:', e);
            result.push(imported);
        }
    }

    return result;
}

function saveEditorDraft() {
    if (!activeDraftKey) return;

    const payload = {
        version: EDITOR_DRAFT_VERSION,
        updatedAt: new Date().toISOString(),
        formData: cloneFormDataForDraft(formData),
        importedImages: serializeImportedImages()
    };

    try {
        localStorage.setItem(activeDraftKey, JSON.stringify(payload));
        return;
    } catch (e) {
        try {
            localStorage.setItem(activeDraftKey, JSON.stringify({ ...payload, importedImages: [] }));
            if (!draftStorageWarned) {
                draftStorageWarned = true;
                showToast('草稿图片较大，已优先保存文字内容', 'warning');
            }
        } catch (innerError) {
            if (!draftStorageWarned) {
                draftStorageWarned = true;
                showToast('临时草稿保存失败，但不影响正式保存', 'warning');
            }
        }
    }
}

function restoreEditorDraft() {
    if (!activeDraftKey) return;

    try {
        const raw = localStorage.getItem(activeDraftKey);
        if (!raw) return;

        const draft = JSON.parse(raw);
        if (!draft || draft.version !== EDITOR_DRAFT_VERSION || !draft.formData) return;

        formData = cloneFormDataForDraft(draft.formData);
        importedImages = deserializeImportedImages(draft.importedImages);
        hasUnsavedChanges = true;
        showToast('已恢复上次未保存内容');
    } catch (e) {
        console.error('restore editor draft error:', e);
    }
}

function clearEditorDraft() {
    if (!activeDraftKey) return;
    try {
        localStorage.removeItem(activeDraftKey);
    } catch (e) {}
}

function hasTextValue(value) {
    return String(value || '').trim().length > 0;
}

function hasNewPromptInputContent() {
    const version = formData.versions?.[0] || {};
    return hasTextValue(formData.name)
        || hasTextValue(formData.folderId)
        || (Array.isArray(formData.tags) && formData.tags.length > 0)
        || hasTextValue(version.prompt)
        || hasTextValue(version.negativePrompt)
        || hasTextValue(version.note)
        || hasTextValue(version.stylePreset)
        || (version.aspectRatio && version.aspectRatio !== '1:1')
        || getExistingImages().length > 0
        || importedImages.length > 0;
}

function updateClearAllButtonState() {
    const clearBtn = document.querySelector('#pcEditorClearAll');
    if (!clearBtn) return;
    clearBtn.disabled = editMode || isSaving || !hasNewPromptInputContent();
}

function clearNewPromptEditor(pageEl) {
    if (editMode) return;

    formData = createDefaultFormData();
    importedImages = [];
    hasUnsavedChanges = false;
    clearEditorDraft();

    renderEditorContent(pageEl);
    setupEditorEvents(pageEl);
    updateClearAllButtonState();
    showToast('已清空当前输入');
}

function getClipboardImageFiles(clipboardData) {
    if (!clipboardData) return [];

    const files = [];
    const items = Array.from(clipboardData.items || []);
    items.forEach((item, index) => {
        if (item.kind !== 'file' || !item.type?.startsWith('image/')) return;
        const file = item.getAsFile();
        if (file) files.push(normalizeClipboardImageFile(file, index));
    });

    if (files.length > 0) return files;

    return Array.from(clipboardData.files || [])
        .filter(file => file.type?.startsWith('image/'))
        .map((file, index) => normalizeClipboardImageFile(file, index));
}

function normalizeClipboardImageFile(file, index) {
    const ext = getImageExtension(file.type);
    const fallbackName = `pasted-image-${Date.now()}-${index + 1}.${ext}`;
    if (file.name && file.name !== 'image.png') return file;
    try {
        return new File([file], fallbackName, { type: file.type || 'image/png' });
    } catch (e) {
        return file;
    }
}

function getImageExtension(type = '') {
    if (type.includes('jpeg') || type.includes('jpg')) return 'jpg';
    if (type.includes('webp')) return 'webp';
    return 'png';
}

function getImportedImageName(img) {
    return img?.file?.name || img?.name || `imported-image.${getImageExtension(img?.type || img?.file?.type || 'image/jpeg')}`;
}

function render(params = {}) {
    const isNew = !params.id || params.id === '';
    const title = isNew ? '新建提示词' : '编辑提示词';
    const subtitle = isNew ? '创建专属提示词，让创作更高效' : '优化专属提示词，让创作更高效';
    const clearActionHtml = isNew ? `
                    <button class="pc-editor-clear-all-btn" id="pcEditorClearAll" type="button" disabled>
                        ${pcIcon('rotateCcw', 'pc-editor-clear-all-icon')}
                        <span>清空</span>
                    </button>
    ` : '';

    return `
        <div class="pc-editor-page">
            ${renderPcWelcomeBanner({
                title,
                subtitle,
                className: 'pc-welcome-banner-editor',
                actionsHtml: `
                    ${clearActionHtml}
                    <button class="pc-editor-save-btn pc-create-btn" id="pcEditorSave" type="button" aria-label="保存">
                        <span class="pc-create-btn-bg" aria-hidden="true"></span>
                        <span class="pc-create-btn-spin" aria-hidden="true"></span>
                        <span class="pc-create-btn-glow" aria-hidden="true"></span>

                        <span class="pc-create-btn-state pc-create-btn-state--default">
                            <span class="pc-create-btn-icon">
                                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h12l2 2v16H5z"></path><path d="M8 3v6h8V3"></path><path d="M8 21v-7h8v7"></path></svg>
                            </span>
                            <span class="pc-create-btn-text" aria-hidden="true">
                                <span style="--i:0">保</span>
                                <span style="--i:1">存</span>
                            </span>
                        </span>

                        <span class="pc-create-btn-state pc-create-btn-state--acting" aria-hidden="true">
                            <span class="pc-create-btn-icon">
                                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>
                            </span>
                            <span class="pc-create-btn-text">
                                <span style="--i:0">保</span>
                                <span style="--i:1">存</span>
                                <span style="--i:2">中</span>
                            </span>
                        </span>
                    </button>
                `,
                decorationsHtml: renderPcWelcomeWalkAnimation({ variant: 'editor' }),
                actionsPlacement: 'afterMascot'
            })}
            <div id="pcEditorContent"></div>
        </div>
    `;
}

async function mount(pageEl, params = {}) {
    promptSetId = params.id || null;
    editMode = !!promptSetId;
    activeDraftKey = getEditorDraftKey(promptSetId);
    hasUnsavedChanges = false;
    draftStorageWarned = false;
    importedImages = [];
    window.addEventListener('beforeunload', beforeUnloadHandler);

    try {
        const storage = getStorage();
        let importResult = { applied: false, imageCount: 0 };
        const [folders, promptSets] = await Promise.all([
            storage.getFolders(),
            storage.getPromptSets()
        ]);
        allFolders = folders;
        allTags = aggregateTags(promptSets);

        if (editMode && promptSetId) {
            const set = await storage.getPromptSet(promptSetId);
            if (set) {
                let parsedTags = [];
                try { parsedTags = JSON.parse(set.tags || '[]'); } catch (e) { parsedTags = []; }
                if (!Array.isArray(parsedTags)) parsedTags = [];

                const v = (set.versions && set.versions[0]) || {};
                formData = {
                    name: set.name || '',
                    folderId: set.folderId || '',
                    tags: parsedTags,
                    versions: [{
                        name: v.name || v.version || 'v1',
                        prompt: v.prompt || '',
                        negativePrompt: v.negativePrompt || v.negative_prompt || '',
                        note: v.note || '',
                        aspectRatio: v.aspectRatio || v.aspect_ratio || '1:1',
                        stylePreset: v.stylePreset || v.style_preset || '',
                        model: v.model || '',
                        sampler: v.sampler || 'DPM++ 2M Karras',
                        steps: v.steps || 30,
                        cfgScale: v.cfgScale || v.cfg_scale || 7.0,
                        hrFix: v.hrFix !== undefined ? v.hrFix : (v.hr_fix !== undefined ? v.hr_fix : true),
                        images: v.images || []
                    }]
                };
            } else {
                showToast('提示词不存在', 'error');
                navigate('/library');
                return;
            }
        } else {
            formData = createDefaultFormData();
            if (params.importId) {
                importResult = await applyPromptImageToolImport(params.importId);
            }
        }

        if (!importResult.applied) restoreEditorDraft();
        renderEditorContent(pageEl);
        setupEditorEvents(pageEl);
        updateClearAllButtonState();
        if (importResult.applied) {
            showToast(`已预填 prompt-image-tool 导入内容${importResult.imageCount ? `，图片 ${importResult.imageCount} 张` : ''}`);
        }
    } catch (e) {
        console.error('mount editor error:', e);
        showToast('加载失败', 'error');
    }
}

function getExistingImages() {
    return formData.versions[0]?.images || [];
}

function getAllImages() {
    return [...getExistingImages(), ...importedImages];
}

function getLocalPreviewSrc(img) {
    return img?.compressedUrl || img?.data || img?.dataUrl || '';
}

async function loadEditorPreviewImages(container) {
    const imgEls = container.querySelectorAll('img[data-editor-image-idx]');
    if (imgEls.length === 0) return;

    const storage = getStorage();
    const allImages = getAllImages();

    imgEls.forEach(async (imgEl) => {
        if (imgEl.getAttribute('src')) return;

        const idx = Number.parseInt(imgEl.dataset.editorImageIdx || '-1', 10);
        const imgData = allImages[idx];
        if (!imgData) return;

        try {
            const url = await storage.getImageUrl(imgData);
            if (url) imgEl.src = url;
        } catch (e) {
            console.error('load editor image preview error:', e);
        }
    });
}

function renderEditorContent(pageEl) {
    const container = pageEl.querySelector('#pcEditorContent');
    if (!container) return;

    const v = formData.versions[0] || {};
    const positivePrompt = v.prompt || '';
    const negativePrompt = v.negativePrompt || '';
    const aspectRatio = v.aspectRatio || '1:1';
    const currentFolder = allFolders.find(f => f.id === formData.folderId);
    const allImages = getAllImages();
    const imageCount = allImages.length;
    const canAddMore = imageCount < MAX_IMAGES;

    container.innerHTML = `
        <div class="pc-editor-layout">
            <div class="pc-editor-main">
                <div class="pc-editor-card">
                    <div class="pc-editor-form-group">
                        <label class="pc-editor-form-label">
                            <span>标题 <span class="pc-editor-form-required">*</span></span>
                        </label>
                        <div class="pc-editor-title-input-wrap">
                            <input type="text" class="pc-editor-title-input" id="pcEditorName"
                                value="${escapeHtml(formData.name)}" placeholder="输入名称..."
                                maxlength="${MAX_TITLE_LEN}">
                            <span class="pc-editor-title-char-count ${formData.name.length > MAX_TITLE_LEN ? 'pc-editor-char-over' : ''}" id="pcNameCount">${formData.name.length}/${MAX_TITLE_LEN}</span>
                        </div>
                        <div class="pc-editor-form-error" id="pcNameError">请输入标题</div>
                    </div>

                    <div class="pc-editor-form-group">
                        <label class="pc-editor-form-label">
                            <span>图片预览</span>
                            <span class="pc-editor-char-count">${imageCount}/${MAX_IMAGES}</span>
                        </label>
                        <div class="pc-editor-image-area" id="pcEditorImageArea">
                            ${imageCount === 0 ? `
                                <button class="pc-editor-image-placeholder" id="pcEditorImagePlaceholder" type="button">
                                    <img class="pc-editor-image-placeholder-icon" src="${editorImagePlaceholderIconUrl}" alt="" aria-hidden="true">
                                    <span class="pc-editor-image-placeholder-text">点击上传图片</span>
                                    <span class="pc-editor-image-paste-hint">也可 Ctrl+V 粘贴外部图片</span>
                                </button>
                            ` : `
                                <div class="pc-editor-image-paste-bar">
                                    <span>可继续 Ctrl+V 粘贴外部图片，图片会追加到末尾</span>
                                </div>
                                <div class="pc-editor-image-grid" id="pcEditorImageGrid">
                                    ${allImages.map((img, idx) => {
                                        const isExisting = idx < getExistingImages().length;
                                        const src = getLocalPreviewSrc(img);
                                        return `
                                            <div class="pc-editor-image-thumb" data-img-idx="${idx}" data-img-existing="${isExisting}" data-cursor="native" role="button" tabindex="0" aria-label="查看图片预览">
                                                <img ${src ? `src="${escapeAttr(src)}"` : ''} alt="预览" loading="lazy" data-editor-image-idx="${idx}">
                                                <button class="pc-editor-image-delete" data-img-idx="${idx}" data-img-existing="${isExisting}" type="button" aria-label="删除图片">${pcIcon('x', 'pc-editor-image-delete-icon')}</button>
                                            </div>
                                        `;
                                    }).join('')}
                                    ${canAddMore ? `
                                        <button class="pc-editor-image-add" id="pcEditorImageAdd" type="button" aria-label="添加图片">
                                            ${pcIcon('plus', 'pc-editor-image-add-icon')}
                                        </button>
                                    ` : ''}
                                </div>
                            `}
                        </div>
                    </div>

                    <div class="pc-editor-prompt-section">
                        <div class="pc-editor-prompt-header">
                            <span class="pc-editor-prompt-label pc-editor-prompt-label-positive">
                                ${pcIcon('sparkles', 'pc-editor-prompt-label-icon')}<span>正向提示词</span><span class="pc-editor-form-required">*</span>
                            </span>
                            <button class="pc-editor-prompt-clear" id="pcClearPositive" type="button" ${!positivePrompt ? 'disabled' : ''}>清空</button>
                        </div>
                        <div class="pc-editor-textarea-wrap">
                            <textarea class="pc-editor-textarea" id="pcEditorPositive"
                                placeholder="输入正向提示词..." maxlength="${MAX_POSITIVE_PROMPT_LEN}">${escapeHtml(positivePrompt)}</textarea>
                            <span class="pc-editor-textarea-char ${positivePrompt.length > MAX_POSITIVE_PROMPT_LEN ? 'pc-editor-char-over' : ''}"
                                id="pcPositiveCount">${positivePrompt.length}/${MAX_POSITIVE_PROMPT_LEN}</span>
                        </div>
                        <div class="pc-editor-form-error" id="pcPositiveError">请输入正向提示词</div>
                    </div>

                    <div class="pc-editor-prompt-section">
                        <div class="pc-editor-prompt-header">
                            <span class="pc-editor-prompt-label pc-editor-prompt-label-negative">
                                ${pcIcon('ban', 'pc-editor-prompt-label-icon')}<span>负向提示词</span>
                            </span>
                            <button class="pc-editor-prompt-clear" id="pcClearNegative" type="button" ${!negativePrompt ? 'disabled' : ''}>清空</button>
                        </div>
                        <div class="pc-editor-textarea-wrap">
                            <textarea class="pc-editor-textarea" id="pcEditorNegative"
                                placeholder="输入负向提示词..." maxlength="${MAX_NEGATIVE_PROMPT_LEN}">${escapeHtml(negativePrompt)}</textarea>
                            <span class="pc-editor-textarea-char ${negativePrompt.length > MAX_NEGATIVE_PROMPT_LEN ? 'pc-editor-char-over' : ''}"
                                id="pcNegativeCount">${negativePrompt.length}/${MAX_NEGATIVE_PROMPT_LEN}</span>
                        </div>
                    </div>

                    <div class="pc-editor-form-group">
                        <label class="pc-editor-form-label"><span>标签</span></label>
                        <div class="pc-editor-tags-area" id="pcEditorTags">
                            ${formData.tags.map(t => `
                                <span class="pc-editor-tag-pill ${getPcTagStyleClass(t)} pc-editor-tag-enter" data-tag="${escapeAttr(t)}">
                                    ${escapeHtml(t)}
                                    <button class="pc-editor-tag-remove" data-tag="${escapeAttr(t)}" type="button" aria-label="删除标签">${pcIcon('x', 'pc-editor-tag-remove-icon')}</button>
                                </span>
                            `).join('')}
                            <button class="pc-editor-add-tag-btn" id="pcAddTagBtn" type="button"><span class="pc-editor-add-tag-icon" aria-hidden="true"></span><span>添加标签</span></button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="pc-editor-side">
                <div class="pc-editor-card">
                    <div class="pc-editor-form-group">
                        <label class="pc-editor-form-label"><span>分类</span></label>
                        <button class="pc-select-card pc-editor-folder-select" id="pcEditorFolderSelect" type="button" aria-haspopup="dialog" aria-label="选择分类">
                            <span class="pc-select-card-icon" aria-hidden="true"></span>
                            <span class="pc-select-card-text" id="pcEditorFolderText">${currentFolder ? escapeHtml(currentFolder.name) : (formData.folderId ? '未分类' : '选择分类')}</span>
                            <span class="pc-select-card-arrow" aria-hidden="true"></span>
                        </button>
                    </div>

                    <div class="pc-editor-form-group">
                        <label class="pc-editor-form-label"><span>比例</span></label>
                        <div class="pc-editor-ratio-group" id="pcEditorRatio">
                            ${RATIO_OPTIONS.map(r => `
                                <button class="pc-editor-ratio-btn ${r === aspectRatio ? 'pc-editor-ratio-active' : ''}" data-ratio="${r}" type="button" aria-pressed="${r === aspectRatio}">${r}</button>
                            `).join('')}
                        </div>
                    </div>

                    <div class="pc-editor-illustration-bottom" id="pcEditorBottomIllustration" title="白兔装饰插画"></div>
                </div>
            </div>
        </div>

    `;
    loadEditorPreviewImages(container);
}

function setupEditorEvents(pageEl) {
    const nameInput = pageEl.querySelector('#pcEditorName');
    nameInput?.addEventListener('input', (e) => {
        formData.name = e.target.value;
        markEditorDirty();
        const countEl = pageEl.querySelector('#pcNameCount');
        if (countEl) {
            const len = e.target.value.length;
            countEl.textContent = `${len}/${MAX_TITLE_LEN}`;
            countEl.classList.toggle('pc-editor-char-over', len > MAX_TITLE_LEN);
        }
        clearFieldError(pageEl, 'pcEditorName', 'pcNameError');
    });

    const positiveInput = pageEl.querySelector('#pcEditorPositive');
    positiveInput?.addEventListener('input', (e) => {
        if (formData.versions[0]) formData.versions[0].prompt = e.target.value;
        markEditorDirty();
        updatePromptCharCount(pageEl, 'pcPositiveCount', e.target.value.length, MAX_POSITIVE_PROMPT_LEN);
        updateClearBtnState(pageEl, 'pcClearPositive', e.target.value.length > 0);
        clearFieldError(pageEl, 'pcEditorPositive', 'pcPositiveError');
    });

    const negativeInput = pageEl.querySelector('#pcEditorNegative');
    negativeInput?.addEventListener('input', (e) => {
        if (formData.versions[0]) formData.versions[0].negativePrompt = e.target.value;
        markEditorDirty();
        updatePromptCharCount(pageEl, 'pcNegativeCount', e.target.value.length, MAX_NEGATIVE_PROMPT_LEN);
        updateClearBtnState(pageEl, 'pcClearNegative', e.target.value.length > 0);
    });

    pageEl.querySelector('#pcClearPositive')?.addEventListener('click', () => {
        if (formData.versions[0]) formData.versions[0].prompt = '';
        markEditorDirty();
        const ta = pageEl.querySelector('#pcEditorPositive');
        if (ta) ta.value = '';
        updatePromptCharCount(pageEl, 'pcPositiveCount', 0, MAX_POSITIVE_PROMPT_LEN);
        updateClearBtnState(pageEl, 'pcClearPositive', false);
    });

    pageEl.querySelector('#pcClearNegative')?.addEventListener('click', () => {
        if (formData.versions[0]) formData.versions[0].negativePrompt = '';
        markEditorDirty();
        const ta = pageEl.querySelector('#pcEditorNegative');
        if (ta) ta.value = '';
        updatePromptCharCount(pageEl, 'pcNegativeCount', 0, MAX_NEGATIVE_PROMPT_LEN);
        updateClearBtnState(pageEl, 'pcClearNegative', false);
    });

    setupImagePreviewEvents(pageEl);

    pageEl.querySelector('#pcEditorTags')?.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.pc-editor-tag-remove');
        if (removeBtn) {
            const tag = removeBtn.dataset.tag;
            const tagEl = removeBtn.closest('.pc-editor-tag-pill');
            if (tagEl) {
                tagEl.classList.remove('pc-editor-tag-enter');
                tagEl.classList.add('pc-editor-tag-exit');
                tagEl.addEventListener('animationend', () => {
                    formData.tags = formData.tags.filter(t => t !== tag);
                    markEditorDirty();
                    renderEditorContent(pageEl);
                    setupEditorEvents(pageEl);
                }, { once: true });
            } else {
                formData.tags = formData.tags.filter(t => t !== tag);
                markEditorDirty();
                renderEditorContent(pageEl);
                setupEditorEvents(pageEl);
            }
        }
    });

    pageEl.querySelector('#pcAddTagBtn')?.addEventListener('click', () => {
        showTagPicker(pageEl);
    });

    pageEl.querySelector('#pcEditorFolderSelect')?.addEventListener('click', () => {
        showFolderPicker(pageEl);
    });

    pageEl.querySelector('#pcEditorRatio')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.pc-editor-ratio-btn');
        if (!btn) return;
        pageEl.querySelectorAll('.pc-editor-ratio-btn').forEach(b => {
            b.classList.remove('pc-editor-ratio-active');
            b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('pc-editor-ratio-active');
        btn.setAttribute('aria-pressed', 'true');
        if (formData.versions[0]) formData.versions[0].aspectRatio = btn.dataset.ratio;
        markEditorDirty();
    });

    const saveBtn = pageEl.querySelector('#pcEditorSave');
    if (saveBtn && pageEl._editorSaveHandler) {
        saveBtn.removeEventListener('click', pageEl._editorSaveHandler);
    }
    pageEl._editorSaveHandler = () => {
        savePromptSet(pageEl);
    };
    saveBtn?.addEventListener('click', pageEl._editorSaveHandler);

    const clearAllBtn = pageEl.querySelector('#pcEditorClearAll');
    if (clearAllBtn && pageEl._editorClearAllHandler) {
        clearAllBtn.removeEventListener('click', pageEl._editorClearAllHandler);
    }
    pageEl._editorClearAllHandler = () => {
        if (!hasNewPromptInputContent()) {
            updateClearAllButtonState();
            return;
        }
        showConfirmModal('确定清空当前未保存内容和图片预览吗？', () => clearNewPromptEditor(pageEl));
    };
    clearAllBtn?.addEventListener('click', pageEl._editorClearAllHandler);
    updateClearAllButtonState();

    setupKeyboardShortcuts(pageEl);
    setupPasteHandler(pageEl);
    setupTextSelectionContextMenu(pageEl);
}

function setupImagePreviewEvents(pageEl) {
    const placeholder = pageEl.querySelector('#pcEditorImagePlaceholder');
    if (placeholder) {
        placeholder.addEventListener('click', () => {
            openImageFilePicker(pageEl);
        });
    }

    const addBtn = pageEl.querySelector('#pcEditorImageAdd');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            openImageFilePicker(pageEl);
        });
    }

    pageEl.querySelectorAll('.pc-editor-image-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.imgIdx);
            const isExisting = btn.dataset.imgExisting === 'true';
            if (isExisting) {
                getExistingImages().splice(idx, 1);
            } else {
                const adjustedIdx = idx - getExistingImages().length;
                importedImages.splice(adjustedIdx, 1);
            }
            markEditorDirty();
            renderEditorContent(pageEl);
            setupEditorEvents(pageEl);
        });
    });

    pageEl.querySelectorAll('.pc-editor-image-thumb').forEach(thumb => {
        const openViewer = () => openEditorImageViewer(thumb);
        thumb.addEventListener('click', openViewer);
        thumb.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            openViewer();
        });
    });
}

async function openEditorImageViewer(thumb) {
    const index = Number.parseInt(thumb.dataset.imgIdx || '-1', 10);
    const image = getAllImages()[index];
    if (!image) return;

    let src = getLocalPreviewSrc(image);
    if (!src) {
        try {
            src = await getStorage().getImageUrl(image);
        } catch (e) {
            console.error('open editor image preview error:', e);
        }
    }
    if (!src) {
        showToast('图片预览加载失败', 'error');
        return;
    }
    showImageViewer({
        src,
        filename: getImportedImageName(image),
        image
    });
}

function setupTextSelectionContextMenu(pageEl) {
    clearTimeout(pageEl._editorTextSelectionTimer);
    if (pageEl._editorTextSelectionHandler) {
        pageEl.removeEventListener('select', pageEl._editorTextSelectionHandler, true);
        pageEl.removeEventListener('pointerup', pageEl._editorTextSelectionHandler, true);
        pageEl.removeEventListener('keyup', pageEl._editorTextSelectionHandler, true);
        pageEl.removeEventListener('input', pageEl._editorTextSelectionHandler, true);
        pageEl.removeEventListener('compositionstart', pageEl._editorTextSelectionHandler, true);
        pageEl.removeEventListener('compositionend', pageEl._editorTextSelectionHandler, true);
    }

    pageEl._editorTextSelectionHandler = (e) => {
        const input = e.target.closest('#pcEditorName, #pcEditorPositive, #pcEditorNegative');
        if (!input) return;
        if (e.type === 'compositionstart' || e.type === 'input') {
            input.dataset.editorComposing = e.type === 'compositionstart' ? 'true' : '';
            clearTimeout(pageEl._editorTextSelectionTimer);
            pageEl._editorTextSelectionSignature = '';
            hideContextMenu(null, false);
            return;
        }
        if (e.type === 'compositionend') input.dataset.editorComposing = '';
        queueEditorTextSelectionMenu(pageEl, input);
    };
    ['select', 'pointerup', 'keyup', 'input', 'compositionstart', 'compositionend'].forEach(type => {
        pageEl.addEventListener(type, pageEl._editorTextSelectionHandler, true);
    });
}

function queueEditorTextSelectionMenu(pageEl, input) {
    clearTimeout(pageEl._editorTextSelectionTimer);
    if (input.dataset.editorComposing === 'true' || input.selectionStart === input.selectionEnd) {
        pageEl._editorTextSelectionSignature = '';
        hideContextMenu(null, false);
        return;
    }
    const signature = `${input.id}:${input.selectionStart}:${input.selectionEnd}`;
    if (pageEl._editorTextSelectionSignature === signature) return;
    pageEl._editorTextSelectionTimer = setTimeout(() => {
        if (!input.isConnected || document.activeElement !== input || input.dataset.editorComposing === 'true') return;
        if (input.selectionStart === input.selectionEnd) return;
        pageEl._editorTextSelectionSignature = signature;
        showEditorTextContextMenu(pageEl, input, getEditorTextSelectionRect(input));
    }, TEXT_SELECTION_MENU_DELAY);
}

function getEditorTextSelectionRect(input) {
    const rect = input.getBoundingClientRect();
    const styles = getComputedStyle(input);
    const mirror = document.createElement('div');
    const marker = document.createElement('span');
    const copiedStyles = [
        'boxSizing', 'width', 'height', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
        'letterSpacing', 'lineHeight', 'textTransform', 'textIndent', 'textAlign', 'wordSpacing',
        'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth',
        'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'whiteSpace', 'wordBreak',
        'overflowWrap', 'tabSize', 'direction'
    ];
    copiedStyles.forEach(property => {
        mirror.style[property] = styles[property];
    });
    mirror.style.position = 'fixed';
    mirror.style.left = `${rect.left}px`;
    mirror.style.top = `${rect.top}px`;
    mirror.style.height = `${rect.height}px`;
    mirror.style.overflow = 'hidden';
    mirror.style.visibility = 'hidden';
    mirror.style.pointerEvents = 'none';
    mirror.style.zIndex = '-1';
    mirror.style.whiteSpace = input instanceof HTMLTextAreaElement ? 'pre-wrap' : 'pre';
    mirror.style.overflowWrap = 'break-word';
    mirror.textContent = input.value.slice(0, input.selectionStart);
    marker.textContent = input.value.slice(input.selectionStart, input.selectionEnd) || '\u200b';
    mirror.appendChild(marker);
    mirror.append(input.value.slice(input.selectionEnd));
    document.body.appendChild(mirror);
    mirror.scrollTop = input.scrollTop;
    mirror.scrollLeft = input.scrollLeft;
    const markerRects = [...marker.getClientRects()];
    mirror.remove();
    if (markerRects.length) {
        const left = Math.min(...markerRects.map(item => item.left));
        const right = Math.max(...markerRects.map(item => item.right));
        const top = Math.min(...markerRects.map(item => item.top));
        const bottom = Math.max(...markerRects.map(item => item.bottom));
        return { left, right, top, bottom, width: right - left, height: bottom - top };
    }
    return {
        left: rect.left + rect.width / 2,
        right: rect.left + rect.width / 2,
        top: rect.top + rect.height / 2,
        bottom: rect.top + rect.height / 2,
        width: 0,
        height: 0
    };
}

async function showEditorTextContextMenu(pageEl, input, selectionRect) {
    const selectionStart = input.selectionStart;
    const selectionEnd = input.selectionEnd;
    const selectedText = input.value.slice(selectionStart, selectionEnd);
    const action = await showContextMenu(selectionRect.left + selectionRect.width / 2, selectionRect.top, [
        { action: 'copy', icon: pcIcon('clipboard'), label: '复制', tone: 'copy' },
        { action: 'paste', icon: pcIcon('clipboard'), label: '粘贴', tone: 'paste' },
        { action: 'delete', icon: pcIcon('x'), label: '删除', tone: 'delete', danger: true },
    ], {
        restoreFocusElement: input,
        focusMenu: false,
        referenceRect: selectionRect,
        placement: {
            preferredSide: 'top',
            fallbackSide: 'bottom',
            gap: 20,
            safeMargin: 24
        }
    });
    if (!action || !input.isConnected) {
        pageEl._editorTextSelectionSignature = '';
        return;
    }

    input.focus({ preventScroll: true });
    input.setSelectionRange(selectionStart, selectionEnd);
    pageEl._editorTextSelectionSignature = '';
    if (action === 'copy') {
        await copyToClipboard(selectedText);
        return;
    }
    if (action === 'delete') {
        replaceSelectedEditorText(input, '');
        return;
    }
    try {
        const text = await navigator.clipboard?.readText?.();
        if (typeof text !== 'string') throw new Error('clipboard unavailable');
        replaceSelectedEditorText(input, text);
    } catch (e) {
        showToast('无法读取剪贴板，请使用 Ctrl+V 粘贴', 'warning');
    }
}

function replaceSelectedEditorText(input, text) {
    input.setRangeText(text, input.selectionStart, input.selectionEnd, 'end');
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

function openImageFilePicker(pageEl) {
    const currentCount = getAllImages().length;
    if (currentCount >= MAX_IMAGES) {
        showToast(`最多上传 ${MAX_IMAGES} 张图片`, 'warning');
        return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.multiple = true;
    input.onchange = (ev) => handleImageUpload(pageEl, ev.target.files);
    input.click();
}

async function handleImageUpload(pageEl, files) {
    if (!files || files.length === 0) return;

    const currentCount = getAllImages().length;
    const remaining = MAX_IMAGES - currentCount;
    const filesToProcess = Array.from(files).slice(0, remaining);
    const beforeImportCount = importedImages.length;

    if (files.length > remaining) {
        showToast(`仅添加前 ${remaining} 张（上限 ${MAX_IMAGES} 张）`, 'warning');
    }

    showToast('正在处理图片...');

    for (const file of filesToProcess) {
        if (file.size > MAX_SOURCE_IMAGE_BYTES) {
            showToast(`${file.name} 超过 15MB，已跳过`, 'warning');
            continue;
        }

        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
            showToast(`${file.name} 格式不支持，已跳过`, 'warning');
            continue;
        }

        try {
            const dataUrl = await readFileAsDataURL(file);
            const optimized = await optimizeImageDataUrl(dataUrl, IMAGE_OPTIMIZE_OPTIONS);
            importedImages.push({
                file,
                compressedUrl: optimized.dataUrl,
                optimized,
                name: file.name,
                type: file.type,
                size: file.size
            });
        } catch (e) {
            console.error('image import error:', e);
            if (e?.code === 'IMAGE_PIXELS_TOO_LARGE') {
                showToast(`${file.name} 像素过大，已跳过`, 'warning');
            } else {
                showToast(`${file.name} 处理失败`, 'error');
            }
        }
    }

    const addedCount = importedImages.length - beforeImportCount;
    if (addedCount > 0) {
        markEditorDirty();
        renderEditorContent(pageEl);
        setupEditorEvents(pageEl);
        showToast(`已导入 ${addedCount} 张图片`);
    }
}

function setupKeyboardShortcuts(pageEl) {
    if (pageEl._editorKeyHandler) {
        document.removeEventListener('keydown', pageEl._editorKeyHandler);
        delete pageEl._editorKeyHandler;
    }

    const handler = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            savePromptSet(pageEl);
        }
        if (e.key === 'Escape') {
            const modalOverlay = document.querySelector('.pc-modal-overlay.pc-modal-active');
            if (modalOverlay) return;
            const activeEl = document.activeElement;
            if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')) {
                activeEl.blur();
                return;
            }
            if (hasUnsavedChanges) {
                showConfirmModal('有未保存的修改，确定放弃吗？', () => goBack());
            } else {
                goBack();
            }
        }
    };
    document.addEventListener('keydown', handler);
    pageEl._editorKeyHandler = handler;
}

function setupPasteHandler(pageEl) {
    if (pageEl._editorPasteHandler) {
        pageEl.removeEventListener('paste', pageEl._editorPasteHandler);
        delete pageEl._editorPasteHandler;
    }

    const handler = (e) => {
        const files = getClipboardImageFiles(e.clipboardData);
        if (files.length === 0) return;
        e.preventDefault();
        handleImageUpload(pageEl, files);
    };

    pageEl.addEventListener('paste', handler);
    pageEl._editorPasteHandler = handler;
}

function updatePromptCharCount(pageEl, countId, len, maxLen) {
    const countEl = pageEl.querySelector(`#${countId}`);
    if (countEl) {
        countEl.textContent = `${len}/${maxLen}`;
        countEl.classList.toggle('pc-editor-char-over', len > maxLen);
    }
}

function updateClearBtnState(pageEl, btnId, hasContent) {
    const btn = pageEl.querySelector(`#${btnId}`);
    if (btn) btn.disabled = !hasContent;
}

function clearFieldError(pageEl, inputId, errorId) {
    const input = pageEl.querySelector(`#${inputId}`);
    const error = pageEl.querySelector(`#${errorId}`);
    if (input) input.classList.remove('pc-input-error');
    if (error) error.classList.remove('pc-editor-error-visible');
}

function showFieldError(pageEl, inputId, errorId) {
    const input = pageEl.querySelector(`#${inputId}`);
    const error = pageEl.querySelector(`#${errorId}`);
    if (input) input.classList.add('pc-input-error');
    if (error) error.classList.add('pc-editor-error-visible');
}

function showFolderPicker(pageEl) {
    const modal = showModal(`
        <div class="pc-folder-picker-dialog">
            <div class="pc-folder-picker-heading">
                <div>
                    <span class="pc-folder-picker-eyebrow">提示词归档</span>
                    <h3 id="pcFolderPickerTitle">选择分类</h3>
                </div>
                <button class="pc-folder-picker-close" id="pcFolderPickerClose" type="button" aria-label="关闭分类选择"></button>
            </div>
            <div class="pc-picker-list" role="listbox" aria-labelledby="pcFolderPickerTitle">
                <button class="pc-picker-list-item ${!formData.folderId ? 'pc-picker-list-active' : ''}" data-folder-id="" type="button" role="option" aria-selected="${!formData.folderId}">
                <span class="pc-picker-list-icon pc-picker-list-icon--folder" aria-hidden="true"></span>
                <span>未分类</span>
                ${!formData.folderId ? '<span class="pc-picker-list-check" aria-hidden="true"></span>' : ''}
            </button>
            ${allFolders.map(f => `
                <button class="pc-picker-list-item ${f.id === formData.folderId ? 'pc-picker-list-active' : ''}" data-folder-id="${f.id}" type="button" role="option" aria-selected="${f.id === formData.folderId}">
                    <span class="pc-picker-list-icon pc-picker-list-icon--folder-open" aria-hidden="true"></span>
                    <span>${escapeHtml(f.name)}</span>
                    ${f.id === formData.folderId ? '<span class="pc-picker-list-check" aria-hidden="true"></span>' : ''}
                </button>
            `).join('')}
            </div>
        </div>
    `);

    const closePicker = () => {
        closeModal();
        pageEl.querySelector('#pcEditorFolderSelect')?.focus();
    };
    modal.querySelector('#pcFolderPickerClose')?.addEventListener('click', closePicker);
    modal.querySelectorAll('.pc-picker-list-item').forEach(btn => {
        btn.addEventListener('click', () => {
            formData.folderId = btn.dataset.folderId || '';
            markEditorDirty();
            closeModal();
            renderEditorContent(pageEl);
            setupEditorEvents(pageEl);
            pageEl.querySelector('#pcEditorFolderSelect')?.focus();
        });
    });
    modal.querySelector('.pc-picker-list-item[aria-selected="true"]')?.focus();
}

function showTagPicker(pageEl) {
    const existingTags = allTags.filter(t => !formData.tags.includes(t.name || t));
    const tagNames = existingTags.map(t => t.name || t);

    const modal = showModal(`
        <h3>添加标签</h3>
        ${tagNames.length > 0 ? `
            <div class="pc-tag-picker-grid">
                ${tagNames.map(t => `
                    <button class="pc-tag-picker-item ${getPcTagStyleClass(t)}" data-tag="${escapeAttr(t)}">${escapeHtml(t)}</button>
                `).join('')}
            </div>
        ` : ''}
        <div class="pc-tag-custom-input-area">
            <input type="text" class="pc-tag-custom-input" id="pcCustomTagInput" placeholder="自定义标签...">
            <button class="pc-tag-custom-add-btn" id="pcCustomTagAdd">添加</button>
        </div>
    `);

    modal.querySelectorAll('.pc-tag-picker-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const tag = btn.dataset.tag;
            if (!formData.tags.includes(tag)) {
                formData.tags.push(tag);
                markEditorDirty();
            }
            closeModal();
            renderEditorContent(pageEl);
            setupEditorEvents(pageEl);
        });
    });

    const customInput = modal.querySelector('#pcCustomTagInput');
    const customAdd = modal.querySelector('#pcCustomTagAdd');

    const addCustomTag = () => {
        const tag = customInput?.value.trim();
        if (!tag) return;
        if (!formData.tags.includes(tag)) {
            formData.tags.push(tag);
            markEditorDirty();
        }
        closeModal();
        renderEditorContent(pageEl);
        setupEditorEvents(pageEl);
    };

    customAdd?.addEventListener('click', addCustomTag);
    customInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') addCustomTag(); });
}

async function savePromptSet(pageEl) {
    if (isSaving) return;

    const name = formData.name.trim();
    const positivePrompt = formData.versions[0]?.prompt?.trim() || '';
    let hasError = false;

    if (!name) {
        showFieldError(pageEl, 'pcEditorName', 'pcNameError');
        pageEl.querySelector('#pcEditorName')?.focus();
        hasError = true;
    }

    if (!positivePrompt) {
        showFieldError(pageEl, 'pcEditorPositive', 'pcPositiveError');
        if (!hasError) pageEl.querySelector('#pcEditorPositive')?.focus();
        hasError = true;
    }

    if (hasError) return;

    isSaving = true;
    setEditorSavingState(pageEl, true);

    try {
        const storage = getStorage();
        const tags = formData.tags || [];
        const tagsStr = typeof tags === 'string' ? tags : JSON.stringify(tags);

        if (editMode && promptSetId) {
            const versionImages = [...getExistingImages()];
            for (const img of importedImages) {
                const imgId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
                const imageName = getImportedImageName(img);
                const uploaded = await storage.uploadImage(imgId, img.compressedUrl, imageName);
                versionImages.push({
                    id: imgId,
                    name: imageName,
                    path: imageName,
                    file: uploaded?.file || `${imgId}.jpg`,
                    note: '',
                    createdAt: new Date().toISOString()
                });
            }

            await storage.updatePromptSet(promptSetId, {
                name,
                folderId: formData.folderId || null,
                tags: tagsStr,
                versions: [{
                    ...formData.versions[0],
                    images: versionImages
                }]
            });
            showToast('已保存');
        } else {
            const result = await storage.createPromptSet(name, formData.folderId || null, tagsStr);
            if (result && result.id) {
                const versionImages = [];
                for (const img of importedImages) {
                    const imgId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
                    const imageName = getImportedImageName(img);
                    const uploaded = await storage.uploadImage(imgId, img.compressedUrl, imageName);
                    versionImages.push({
                        id: imgId,
                        name: imageName,
                        path: imageName,
                        file: uploaded?.file || `${imgId}.jpg`,
                        note: '',
                        createdAt: new Date().toISOString()
                    });
                }

                await storage.updatePromptSet(result.id, {
                    versions: [{
                        ...formData.versions[0],
                        images: versionImages
                    }]
                });
            }
            showToast('已创建');
        }
        hasUnsavedChanges = false;
        clearEditorDraft();
        navigate('/library');
    } catch (e) {
        console.error('save error:', e);
        showToast('保存失败，请重试', 'error');
    } finally {
        isSaving = false;
        setEditorSavingState(pageEl, false);
    }
}

function setEditorSavingState(pageEl, saving) {
    const saveBtn = pageEl.querySelector('#pcEditorSave');
    if (saveBtn) {
        saveBtn.disabled = saving;
        saveBtn.classList.toggle('pc-editor-save-busy', saving);
        saveBtn.classList.toggle('is-acting', saving);
    }
    updateClearAllButtonState();
}

function escapeAttr(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function unmount(pageEl) {
    window.removeEventListener('beforeunload', beforeUnloadHandler);
    if (pageEl._editorPasteHandler) {
        pageEl.removeEventListener('paste', pageEl._editorPasteHandler);
        delete pageEl._editorPasteHandler;
    }
    clearTimeout(pageEl._editorTextSelectionTimer);
    if (pageEl._editorTextSelectionHandler) {
        ['select', 'pointerup', 'keyup', 'input', 'compositionstart', 'compositionend'].forEach(type => {
            pageEl.removeEventListener(type, pageEl._editorTextSelectionHandler, true);
        });
        delete pageEl._editorTextSelectionHandler;
    }
    if (pageEl._editorKeyHandler) {
        document.removeEventListener('keydown', pageEl._editorKeyHandler);
        delete pageEl._editorKeyHandler;
    }
    const saveBtn = pageEl.querySelector('#pcEditorSave');
    if (saveBtn && pageEl._editorSaveHandler) {
        saveBtn.removeEventListener('click', pageEl._editorSaveHandler);
        delete pageEl._editorSaveHandler;
    }
    const clearAllBtn = pageEl.querySelector('#pcEditorClearAll');
    if (clearAllBtn && pageEl._editorClearAllHandler) {
        clearAllBtn.removeEventListener('click', pageEl._editorClearAllHandler);
        delete pageEl._editorClearAllHandler;
    }
    formData = createDefaultFormData();
    importedImages = [];
    hasUnsavedChanges = false;
    isSaving = false;
    activeDraftKey = '';
    editMode = false;
    promptSetId = null;
}

export { render, mount, unmount };
