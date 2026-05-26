import { getStorage } from './storage.js';
import { navigate, goBack } from './pc-app.js';
import { showToast, showModal, closeModal, showConfirmModal, escapeHtml } from './pc-utils.js';
import { aggregateTags } from './tag-utils.js';
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

const RATIO_OPTIONS = ['1:1', '3:4', '4:3', '16:9', '9:16'];
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
    outputType: 'image/jpeg'
};

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
                leadingHtml: `
                    <button class="pc-top-nav-back pc-welcome-back" id="pcEditorBack" aria-label="返回">${pcIcon('chevronLeft', 'pc-editor-back-icon')}</button>
                `,
                actionsHtml: `
                    ${clearActionHtml}
                    <button class="pc-editor-save-btn" id="pcEditorSave">
                        ${pcIcon('save', 'pc-editor-save-icon')}
                        <span>保存</span>
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
                                <div class="pc-editor-image-placeholder" id="pcEditorImagePlaceholder">
                                    <img class="pc-editor-image-placeholder-icon" src="${editorImagePlaceholderIconUrl}" alt="" aria-hidden="true">
                                    <span class="pc-editor-image-placeholder-text">点击上传图片</span>
                                    <span class="pc-editor-image-paste-hint">也可 Ctrl+V 粘贴外部图片</span>
                                </div>
                            ` : `
                                <div class="pc-editor-image-paste-bar">
                                    <span>可继续 Ctrl+V 粘贴外部图片，图片会追加到末尾</span>
                                </div>
                                <div class="pc-editor-image-grid" id="pcEditorImageGrid">
                                    ${allImages.map((img, idx) => {
                                        const isExisting = idx < getExistingImages().length;
                                        const src = getLocalPreviewSrc(img);
                                        return `
                                            <div class="pc-editor-image-thumb" data-img-idx="${idx}" data-img-existing="${isExisting}">
                                                <img ${src ? `src="${escapeAttr(src)}"` : ''} alt="预览" loading="lazy" data-editor-image-idx="${idx}">
                                                <button class="pc-editor-image-delete" data-img-idx="${idx}" data-img-existing="${isExisting}" type="button" aria-label="删除图片">${pcIcon('x', 'pc-editor-image-delete-icon')}</button>
                                            </div>
                                        `;
                                    }).join('')}
                                    ${canAddMore ? `
                                        <div class="pc-editor-image-add" id="pcEditorImageAdd">
                                            ${pcIcon('plus', 'pc-editor-image-add-icon')}
                                        </div>
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
                            <button class="pc-editor-prompt-clear" id="pcClearPositive" ${!positivePrompt ? 'disabled' : ''}>清空</button>
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
                            <button class="pc-editor-prompt-clear" id="pcClearNegative" ${!negativePrompt ? 'disabled' : ''}>清空</button>
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
                                <span class="pc-editor-tag-pill pc-editor-tag-enter" data-tag="${escapeAttr(t)}">
                                    ${escapeHtml(t)}
                                    <button class="pc-editor-tag-remove" data-tag="${escapeAttr(t)}" type="button" aria-label="删除标签">${pcIcon('x', 'pc-editor-tag-remove-icon')}</button>
                                </span>
                            `).join('')}
                            <button class="pc-editor-add-tag-btn" id="pcAddTagBtn">${pcIcon('plus', 'pc-editor-add-tag-icon')}<span>添加标签</span></button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="pc-editor-side">
                <div class="pc-editor-card">
                    <div class="pc-editor-form-group">
                        <label class="pc-editor-form-label"><span>分类</span></label>
                        <div class="pc-select-card" id="pcEditorFolderSelect">
                            <span class="pc-select-card-icon">${pcIcon('folder', 'pc-select-card-icon-img')}</span>
                            <span class="pc-select-card-text" id="pcEditorFolderText">${currentFolder ? escapeHtml(currentFolder.name) : (formData.folderId ? '未分类' : '选择分类')}</span>
                            <span class="pc-select-card-arrow">${pcIcon('chevronRight', 'pc-select-card-arrow-icon')}</span>
                        </div>
                    </div>

                    <div class="pc-editor-form-group">
                        <label class="pc-editor-form-label"><span>比例</span></label>
                        <div class="pc-editor-ratio-group" id="pcEditorRatio">
                            ${RATIO_OPTIONS.map(r => `
                                <button class="pc-editor-ratio-btn ${r === aspectRatio ? 'pc-editor-ratio-active' : ''}" data-ratio="${r}">${r}</button>
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
    const backBtn = pageEl.querySelector('#pcEditorBack');
    if (backBtn && pageEl._editorBackHandler) {
        backBtn.removeEventListener('click', pageEl._editorBackHandler);
    }
    pageEl._editorBackHandler = () => {
        if (hasUnsavedChanges) {
            showConfirmModal('有未保存的修改，确定放弃吗？', () => goBack());
        } else {
            goBack();
        }
    };
    backBtn?.addEventListener('click', pageEl._editorBackHandler);

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
        pageEl.querySelectorAll('.pc-editor-ratio-btn').forEach(b => b.classList.remove('pc-editor-ratio-active'));
        btn.classList.add('pc-editor-ratio-active');
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
        <h3>选择分类</h3>
        <div class="pc-picker-list">
            <button class="pc-picker-list-item ${!formData.folderId ? 'pc-picker-list-active' : ''}" data-folder-id="">
                <span class="pc-picker-list-icon">${pcIcon('folder', 'pc-picker-list-icon-img')}</span>
                <span>未分类</span>
                ${!formData.folderId ? `<span class="pc-picker-list-check">${pcIcon('check', 'pc-picker-list-check-icon')}</span>` : ''}
            </button>
            ${allFolders.map(f => `
                <button class="pc-picker-list-item ${f.id === formData.folderId ? 'pc-picker-list-active' : ''}" data-folder-id="${f.id}">
                    <span class="pc-picker-list-icon">${pcIcon('folderOpen', 'pc-picker-list-icon-img')}</span>
                    <span>${escapeHtml(f.name)}</span>
                    ${f.id === formData.folderId ? `<span class="pc-picker-list-check">${pcIcon('check', 'pc-picker-list-check-icon')}</span>` : ''}
                </button>
            `).join('')}
        </div>
    `);

    modal.querySelectorAll('.pc-picker-list-item').forEach(btn => {
        btn.addEventListener('click', () => {
            formData.folderId = btn.dataset.folderId || '';
            markEditorDirty();
            closeModal();
            renderEditorContent(pageEl);
            setupEditorEvents(pageEl);
        });
    });
}

function showTagPicker(pageEl) {
    const existingTags = allTags.filter(t => !formData.tags.includes(t.name || t));
    const tagNames = existingTags.map(t => t.name || t);

    const modal = showModal(`
        <h3>添加标签</h3>
        ${tagNames.length > 0 ? `
            <div class="pc-tag-picker-grid">
                ${tagNames.map(t => `
                    <button class="pc-tag-picker-item pc-tag-default" data-tag="${escapeAttr(t)}">${escapeHtml(t)}</button>
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
        const label = saveBtn.querySelector('span');
        if (label) label.textContent = saving ? '保存中' : '保存';
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
    if (pageEl._editorKeyHandler) {
        document.removeEventListener('keydown', pageEl._editorKeyHandler);
        delete pageEl._editorKeyHandler;
    }
    const backBtn = pageEl.querySelector('#pcEditorBack');
    if (backBtn && pageEl._editorBackHandler) {
        backBtn.removeEventListener('click', pageEl._editorBackHandler);
        delete pageEl._editorBackHandler;
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
