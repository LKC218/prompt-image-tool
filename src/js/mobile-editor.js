import { getStorage } from './storage.js';
import { goBack, showMobileToast, showActionSheet } from './mobile-utils.js';
import { getCurrentRoute } from './mobile-router.js';
import { getTagStyleClass, aggregateTags, saveCustomTag } from './tag-utils.js';
import { readFileAsDataURL, optimizeImageDataUrl } from './image-utils.js';
import { mobileIcon } from './mobile-icon-assets.js';
import { consumePromptImageToolImport, dataUrlToImportedImage } from './prompt-tool-json-import.js';
import imagePlaceholder from '../assets/mobile/image-placeholder.png';

let editMode = 'create';
let editId = null;
let currentSet = null;
let selectedTags = [];
let selectedFolder = null;
let selectedRatio = '1:1';
let hasUnsavedChanges = false;
let importedImages = [];
let existingImages = [];

const RATIOS = ['1:1', '3:4', '4:3', '16:9', '9:16'];
const MAX_IMAGES = 10;
const MAX_POSITIVE_PROMPT_LEN = 6666;
const MAX_NEGATIVE_PROMPT_LEN = 2000;
const MAX_SOURCE_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const IMAGE_OPTIMIZE_OPTIONS = {
    quality: 0.86,
    maxSide: 2048,
    maxInputPixels: 24 * 1000 * 1000,
    outputType: 'image/jpeg'
};

const FOLDER_ICONS = [
    { keyword: '插画', icon: 'palette', color: 'var(--m-blue-light)' },
    { keyword: '写实', icon: 'camera', color: 'var(--m-yellow-light)' },
    { keyword: '科幻', icon: 'rocket', color: 'var(--m-purple-light)' },
    { keyword: '国风', icon: 'folder-open', color: 'var(--m-pink-light)' },
    { keyword: '场景', icon: 'image', color: 'var(--m-green-light)' },
    { keyword: '人物', icon: 'tag', color: '#FFE8D0' },
];

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function escapeAttr(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function getTagStyle(tagName) {
    return getTagStyleClass(tagName);
}

function getFolderIcon(folderName) {
    const found = FOLDER_ICONS.find(f => folderName.includes(f.keyword));
    return mobileIcon(found ? found.icon : 'folder');
}

function render(params = {}) {
    return `
        <div class="m-top-nav">
            <button class="m-top-nav-back" id="mEditorBack" aria-label="返回">${mobileIcon('chevron-left')}</button>
            <span class="m-top-nav-title" id="mEditorTitle">新建提示词</span>
            <button class="m-save-btn" id="mEditorSave">保存</button>
        </div>
        <div class="m-page-inner" id="mEditorContent">
            <div class="m-form-group">
                <label class="m-form-label">
                    标题 <span class="m-form-required">*</span>
                </label>
                <input type="text" class="m-input" id="mEditorName" placeholder="输入提示词标题...">
                <div class="m-form-error" id="mNameError">请输入标题</div>
            </div>

            <div class="m-form-group">
                <label class="m-form-label">
                    正向提示词（Positive）<span class="m-form-required">*</span>
                    <button class="m-form-clear" id="mClearPositive">清空</button>
                    <button class="m-form-preview-btn" id="mPreviewPositive" aria-label="预览正向提示词">${mobileIcon('maximize', { className: 'm-icon-sm' })}</button>
                </label>
                <textarea class="m-input m-textarea" id="mEditorPositive" placeholder="输入正向提示词..." maxlength="${MAX_POSITIVE_PROMPT_LEN}"></textarea>
                <div class="m-char-count"><span id="mPositiveCount">0</span>/${MAX_POSITIVE_PROMPT_LEN}</div>
                <div class="m-form-error" id="mPositiveError">请输入正向提示词</div>
            </div>

            <div class="m-form-group">
                <label class="m-form-label">
                    负向提示词（Negative）
                    <button class="m-form-clear" id="mClearNegative">清空</button>
                    <button class="m-form-preview-btn" id="mPreviewNegative" aria-label="预览负向提示词">${mobileIcon('maximize', { className: 'm-icon-sm' })}</button>
                </label>
                <textarea class="m-input m-textarea" id="mEditorNegative" placeholder="输入负向提示词..." maxlength="${MAX_NEGATIVE_PROMPT_LEN}"></textarea>
                <div class="m-char-count"><span id="mNegativeCount">0</span>/${MAX_NEGATIVE_PROMPT_LEN}</div>
            </div>

            <div class="m-form-group">
                <label class="m-form-label">标签</label>
                <div class="m-tags-area" id="mEditorTags">
                    ${selectedTags.map(tag => `
                        <span class="m-tag-pill m-tag-removable ${getTagStyle(tag)}" data-tag="${tag}">
                            ${tag}
                            <button class="m-tag-remove" data-tag="${tag}" aria-label="移除标签">${mobileIcon('x', { className: 'm-icon-xs' })}</button>
                        </span>
                    `).join('')}
                    <button class="m-add-tag-btn" id="mAddTagBtn">${mobileIcon('plus', { className: 'm-icon-sm' })} 添加标签</button>
                </div>
            </div>

            <div class="m-form-group">
                <label class="m-form-label">分类</label>
                <button class="m-select-card" id="mEditorFolder" style="width:100%">
                    <span class="m-select-card-icon" id="mFolderIcon">${mobileIcon('folder')}</span>
                    <span class="m-select-card-text" id="mFolderText">未分类</span>
                    <span class="m-select-card-arrow">${mobileIcon('chevron-right', { className: 'm-icon-sm' })}</span>
                </button>
            </div>

            <div class="m-form-group">
                <label class="m-form-label">比例（Aspect Ratio）</label>
                <div class="m-ratio-group" id="mRatioGroup">
                    ${RATIOS.map(r => `
                        <button class="m-ratio-btn ${r === selectedRatio ? 'm-ratio-active' : ''}" data-ratio="${r}">${r}</button>
                    `).join('')}
                </div>
            </div>

            <div class="m-form-group">
                <label class="m-form-label">参考图片</label>
                <div class="m-image-import-area" id="mImageImportArea">
                    <div class="m-image-import-placeholder" id="mImagePlaceholder">
                        <span class="m-image-import-icon"><img src="${imagePlaceholder}" alt="" class="m-image-import-icon-img"></span>
                        <span class="m-image-import-text">点击导入参考图片</span>
                        <span class="m-image-import-hint">支持 JPG/PNG/WebP，自动压缩转 JPG</span>
                    </div>
                    <div class="m-image-import-preview" id="mImagePreview" style="display:none;"></div>
                </div>
                <input type="file" id="mImageFileInput" accept="image/jpeg,image/png,image/webp" style="display:none;" multiple>
            </div>

            <div class="m-form-group">
                <button class="m-collapse-header" id="mMoreOptions" style="width:100%">
                    <span>更多选项</span>
                    <span class="m-collapse-arrow" id="mCollapseArrow">${mobileIcon('chevron-down', { className: 'm-icon-sm' })}</span>
                </button>
                <div class="m-collapse-body" id="mCollapseBody">
                    <div style="padding: var(--m-space-md) 0;">
                        <div class="m-form-group">
                            <label class="m-form-label">版本备注</label>
                            <textarea class="m-input" id="mEditorNote" placeholder="记录本版本的修改说明..." style="min-height:80px"></textarea>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="m-confirm-overlay" id="mConfirmOverlay">
            <div class="m-confirm-dialog">
                <div class="m-confirm-text">有未保存的修改，确定放弃吗？</div>
                <div class="m-confirm-actions">
                    <button class="m-confirm-btn m-confirm-cancel" id="mConfirmCancel">继续编辑</button>
                    <button class="m-confirm-btn m-confirm-ok" id="mConfirmOk">放弃</button>
                </div>
            </div>
        </div>
        <div class="m-picker-overlay" id="mPickerOverlay">
            <div class="m-picker-sheet" id="mPickerSheet"></div>
        </div>
        <div class="m-preview-overlay" id="mPreviewOverlay">
            <div class="m-preview-page">
                <div class="m-top-nav">
                    <button class="m-top-nav-back" id="mPreviewBack" aria-label="返回">${mobileIcon('chevron-left')}</button>
                    <span class="m-top-nav-title" id="mPreviewTitle">提示词预览</span>
                    <button class="m-top-nav-action" id="mPreviewEdit">编辑</button>
                </div>
                <div class="m-preview-content" id="mPreviewContent"></div>
                <div class="m-preview-footer" id="mPreviewFooter"></div>
            </div>
        </div>
    `;
}

async function applyPromptImageToolImport(importId) {
    const payload = consumePromptImageToolImport(importId);
    if (!payload || !payload.prompt) return { applied: false, imageCount: 0 };

    currentSet = null;
    selectedFolder = null;
    selectedTags = Array.isArray(payload.prompt.tags) ? payload.prompt.tags.slice() : [];
    selectedRatio = RATIOS.includes(payload.prompt.aspectRatio) ? payload.prompt.aspectRatio : '1:1';
    importedImages = await buildPromptToolImportedImages(payload.images || []);
    existingImages = [];
    hasUnsavedChanges = true;

    return {
        applied: true,
        imageCount: importedImages.length,
        title: payload.prompt.title || payload.conversationTitle || '新建提示词',
        positivePrompt: payload.prompt.positivePrompt || '',
        negativePrompt: payload.prompt.negativePrompt || '',
        note: payload.prompt.note || '',
    };
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

async function mount(pageEl, params = {}) {
    const route = getCurrentRoute();
    const path = route ? (route.path || '') : '';
    const match = path.match(/\/editor\/(.*)$/);
    const id = params.id || (match ? match[1] : null);

    if (id && id !== '') {
        editMode = 'edit';
        editId = id;
        await loadEditData(pageEl, id);
    } else {
        editMode = 'create';
        editId = null;
        const titleEl = pageEl.querySelector('#mEditorTitle');
        if (titleEl) titleEl.textContent = '新建提示词';
        if (params.importId) {
            const importResult = await applyPromptImageToolImport(params.importId);
            if (importResult.applied) {
                const nameInput = pageEl.querySelector('#mEditorName');
                const positiveInput = pageEl.querySelector('#mEditorPositive');
                const negativeInput = pageEl.querySelector('#mEditorNegative');
                const noteInput = pageEl.querySelector('#mEditorNote');
                if (nameInput) nameInput.value = importResult.title || '';
                if (positiveInput) {
                    positiveInput.value = importResult.positivePrompt || '';
                    updateCharCount(pageEl, 'mPositiveCount', importResult.positivePrompt || '', MAX_POSITIVE_PROMPT_LEN);
                }
                if (negativeInput) {
                    negativeInput.value = importResult.negativePrompt || '';
                    updateCharCount(pageEl, 'mNegativeCount', importResult.negativePrompt || '', MAX_NEGATIVE_PROMPT_LEN);
                }
                if (noteInput) noteInput.value = importResult.note || '';
                renderTags(pageEl);
                renderImagePreviews(pageEl);
                pageEl.querySelectorAll('.m-ratio-btn').forEach(b => {
                    b.classList.toggle('m-ratio-active', b.dataset.ratio === selectedRatio);
                });
                showMobileToast(`已预填导入内容${importResult.imageCount ? `，图片 ${importResult.imageCount} 张` : ''}`);
            }
        }
    }

    setupEditorEvents(pageEl);
    setupSwipeBack(pageEl);
}

async function loadEditData(pageEl, id) {
    try {
        const storage = getStorage();
        currentSet = await storage.getPromptSet(id);
        if (!currentSet) {
            showMobileToast('提示词不存在', 'error');
            goBack();
            return;
        }

        const titleEl = pageEl.querySelector('#mEditorTitle');
        if (titleEl) titleEl.textContent = '编辑提示词';

        const nameInput = pageEl.querySelector('#mEditorName');
        if (nameInput) nameInput.value = currentSet.name;

        if (currentSet.versions && currentSet.versions.length > 0) {
            const v = currentSet.versions[0];
            const positiveInput = pageEl.querySelector('#mEditorPositive');
            const negativeInput = pageEl.querySelector('#mEditorNegative');
            const noteInput = pageEl.querySelector('#mEditorNote');

            if (positiveInput) {
                positiveInput.value = v.prompt || '';
                updateCharCount(pageEl, 'mPositiveCount', v.prompt || '', MAX_POSITIVE_PROMPT_LEN);
            }
            if (negativeInput) {
                negativeInput.value = v.negativePrompt || v.negative_prompt || '';
                updateCharCount(pageEl, 'mNegativeCount', v.negativePrompt || v.negative_prompt || '', MAX_NEGATIVE_PROMPT_LEN);
            }
            if (noteInput) noteInput.value = v.note || '';

            if (v.aspectRatio && v.aspectRatio !== '1:1') {
                selectedRatio = v.aspectRatio;
                pageEl.querySelectorAll('.m-ratio-btn').forEach(b => {
                    b.classList.toggle('m-ratio-active', b.dataset.ratio === selectedRatio);
                });
            }

            if (v.images && v.images.length > 0) {
                existingImages = v.images;
                renderImagePreviews(pageEl);
            }
        }

        if (currentSet.tags) {
            try {
                selectedTags = typeof currentSet.tags === 'string' ? JSON.parse(currentSet.tags) : (Array.isArray(currentSet.tags) ? currentSet.tags : []);
            } catch (e) { selectedTags = []; }
            renderTags(pageEl);
        }

        if (currentSet.folderId) {
            selectedFolder = currentSet.folderId;
            const folders = await storage.getFolders();
            const folder = folders.find(f => f.id === currentSet.folderId);
            const folderText = pageEl.querySelector('#mFolderText');
            const folderIcon = pageEl.querySelector('#mFolderIcon');
            if (folderText && folder) folderText.textContent = folder.name;
            if (folderIcon && folder) folderIcon.innerHTML = getFolderIcon(folder.name);
        }

        hasUnsavedChanges = false;
    } catch (e) {
        console.error('loadEditData error:', e);
        showMobileToast('加载失败', 'error');
    }
}

function renderTags(pageEl) {
    const tagsArea = pageEl.querySelector('#mEditorTags');
    if (!tagsArea) return;
    tagsArea.innerHTML = `
        ${selectedTags.map(tag => `
            <span class="m-tag-pill m-tag-removable ${getTagStyle(tag)} m-tag-enter" data-tag="${tag}">
                ${tag}
                <button class="m-tag-remove" data-tag="${tag}" aria-label="移除标签">${mobileIcon('x', { className: 'm-icon-xs' })}</button>
            </span>
        `).join('')}
        <button class="m-add-tag-btn" id="mAddTagBtn">${mobileIcon('plus', { className: 'm-icon-sm' })} 添加标签</button>
    `;
    tagsArea.querySelector('#mAddTagBtn')?.addEventListener('click', () => {
        showTagPicker(pageEl);
    });
}

function getLocalPreviewSrc(img) {
    return img?.compressedUrl || img?.data || img?.dataUrl || '';
}

async function loadMobileEditorPreviewImages(previewEl) {
    const imgEls = previewEl.querySelectorAll('img[data-mobile-editor-image-idx]');
    if (imgEls.length === 0) return;

    const storage = getStorage();
    const allImages = [...existingImages, ...importedImages];

    imgEls.forEach(async (imgEl) => {
        if (imgEl.getAttribute('src')) return;

        const idx = Number.parseInt(imgEl.dataset.mobileEditorImageIdx || '-1', 10);
        const imgData = allImages[idx];
        if (!imgData) return;

        try {
            const url = await storage.getImageUrl(imgData);
            if (url) imgEl.src = url;
        } catch (e) {
            console.error('load mobile editor image preview error:', e);
        }
    });
}

function renderImagePreviews(pageEl) {
    const previewEl = pageEl.querySelector('#mImagePreview');
    const placeholderEl = pageEl.querySelector('#mImagePlaceholder');
    if (!previewEl) return;

    const allImages = [...existingImages, ...importedImages];
    if (allImages.length === 0) {
        previewEl.style.display = 'none';
        if (placeholderEl) placeholderEl.style.display = '';
        return;
    }

    if (placeholderEl) placeholderEl.style.display = 'none';
    previewEl.style.display = 'flex';

    previewEl.innerHTML = allImages.map((img, idx) => {
        const src = getLocalPreviewSrc(img);
        const isExisting = idx < existingImages.length;
        return `
            <div class="m-image-thumb" data-img-idx="${idx}" data-img-existing="${isExisting}">
                <img ${src ? `src="${escapeAttr(src)}"` : ''} alt="预览" loading="lazy" data-mobile-editor-image-idx="${idx}">
                <button class="m-image-remove-btn" data-img-idx="${idx}" data-img-existing="${isExisting}" aria-label="移除图片">${mobileIcon('x', { className: 'm-icon-xs' })}</button>
            </div>
        `;
    }).join('') + (allImages.length < MAX_IMAGES ? `
        <div class="m-image-thumb m-image-add-thumb" id="mImageAddMore">
            <span>${mobileIcon('plus')}</span>
        </div>
    ` : '');

    previewEl.querySelectorAll('.m-image-remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.imgIdx);
            const isExisting = btn.dataset.imgExisting === 'true';
            if (isExisting) {
                existingImages.splice(idx, 1);
            } else {
                const adjustedIdx = idx - existingImages.length;
                importedImages.splice(adjustedIdx, 1);
            }
            renderImagePreviews(pageEl);
            hasUnsavedChanges = true;
        });
    });

    previewEl.querySelector('#mImageAddMore')?.addEventListener('click', () => {
        pageEl.querySelector('#mImageFileInput')?.click();
    });

    loadMobileEditorPreviewImages(previewEl);
}

function setupEditorEvents(pageEl) {
    pageEl.querySelector('#mEditorBack')?.addEventListener('click', () => {
        if (hasUnsavedChanges) {
            showConfirmDialog(pageEl);
        } else {
            goBack();
        }
    });

    pageEl.querySelector('#mEditorSave')?.addEventListener('click', () => {
        handleSave(pageEl);
    });

    pageEl.querySelector('#mClearPositive')?.addEventListener('click', () => {
        const input = pageEl.querySelector('#mEditorPositive');
        if (input) { input.value = ''; updateCharCount(pageEl, 'mPositiveCount', '', MAX_POSITIVE_PROMPT_LEN); }
        hasUnsavedChanges = true;
    });

    pageEl.querySelector('#mClearNegative')?.addEventListener('click', () => {
        const input = pageEl.querySelector('#mEditorNegative');
        if (input) { input.value = ''; updateCharCount(pageEl, 'mNegativeCount', '', MAX_NEGATIVE_PROMPT_LEN); }
        hasUnsavedChanges = true;
    });

    pageEl.querySelector('#mPreviewPositive')?.addEventListener('click', () => {
        showFullscreenPreview(pageEl, 'positive');
    });

    pageEl.querySelector('#mPreviewNegative')?.addEventListener('click', () => {
        showFullscreenPreview(pageEl, 'negative');
    });

    const nameInput = pageEl.querySelector('#mEditorName');
    const positiveInput = pageEl.querySelector('#mEditorPositive');
    const negativeInput = pageEl.querySelector('#mEditorNegative');
    const noteInput = pageEl.querySelector('#mEditorNote');

    if (nameInput) {
        nameInput.addEventListener('input', () => {
            hasUnsavedChanges = true;
            nameInput.classList.remove('m-input-error');
            const err = pageEl.querySelector('#mNameError');
            if (err) err.style.display = 'none';
        });
    }
    if (positiveInput) {
        positiveInput.addEventListener('input', (e) => {
            updateCharCount(pageEl, 'mPositiveCount', e.target.value, MAX_POSITIVE_PROMPT_LEN);
            hasUnsavedChanges = true;
            positiveInput.classList.remove('m-input-error');
            const err = pageEl.querySelector('#mPositiveError');
            if (err) err.style.display = 'none';
        });
    }
    if (negativeInput) {
        negativeInput.addEventListener('input', (e) => {
            updateCharCount(pageEl, 'mNegativeCount', e.target.value, MAX_NEGATIVE_PROMPT_LEN);
            hasUnsavedChanges = true;
        });
    }
    if (noteInput) {
        noteInput.addEventListener('input', () => { hasUnsavedChanges = true; });
    }

    pageEl.querySelector('#mRatioGroup')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.m-ratio-btn');
        if (!btn) return;
        selectedRatio = btn.dataset.ratio;
        pageEl.querySelectorAll('.m-ratio-btn').forEach(b => b.classList.remove('m-ratio-active'));
        btn.classList.add('m-ratio-active');
        hasUnsavedChanges = true;
    });

    pageEl.querySelector('#mEditorTags')?.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.m-tag-remove');
        if (removeBtn) {
            const tag = removeBtn.dataset.tag;
            const tagEl = removeBtn.closest('.m-tag-pill');
            if (tagEl) {
                tagEl.classList.add('m-tag-exit');
                tagEl.addEventListener('animationend', () => {
                    selectedTags = selectedTags.filter(t => t !== tag);
                    renderTags(pageEl);
                }, { once: true });
            }
            hasUnsavedChanges = true;
            return;
        }
        if (e.target.closest('#mAddTagBtn')) {
            showTagPicker(pageEl);
        }
    });

    pageEl.querySelector('#mEditorFolder')?.addEventListener('click', () => {
        showFolderPicker(pageEl);
    });

    pageEl.querySelector('#mImageImportArea')?.addEventListener('click', (e) => {
        if (e.target.closest('.m-image-remove-btn') || e.target.closest('#mImageAddMore')) return;
        if (existingImages.length + importedImages.length >= MAX_IMAGES) {
            showMobileToast(`最多上传 ${MAX_IMAGES} 张图片`, 'warning');
            return;
        }
        pageEl.querySelector('#mImageFileInput')?.click();
    });

    pageEl.querySelector('#mImageFileInput')?.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        await handleImageImport(pageEl, files);
        e.target.value = '';
    });

    pageEl.querySelector('#mMoreOptions')?.addEventListener('click', () => {
        const body = pageEl.querySelector('#mCollapseBody');
        const arrow = pageEl.querySelector('#mCollapseArrow');
        if (body) body.classList.toggle('m-collapse-expanded');
        if (arrow) arrow.classList.toggle('m-collapse-open');
    });

    pageEl.querySelector('#mPreviewBack')?.addEventListener('click', () => {
        const overlay = pageEl.querySelector('#mPreviewOverlay');
        if (overlay) overlay.classList.remove('m-preview-show');
    });

    pageEl.querySelector('#mPreviewEdit')?.addEventListener('click', () => {
        const overlay = pageEl.querySelector('#mPreviewOverlay');
        if (overlay) overlay.classList.remove('m-preview-show');
        const inputId = currentPreviewType === 'positive' ? '#mEditorPositive' : '#mEditorNegative';
        const input = pageEl.querySelector(inputId);
        if (input) input.focus();
    });
}

let currentPreviewType = 'positive';

function showFullscreenPreview(pageEl, type) {
    const overlay = pageEl.querySelector('#mPreviewOverlay');
    const title = pageEl.querySelector('#mPreviewTitle');
    const content = pageEl.querySelector('#mPreviewContent');
    const footer = pageEl.querySelector('#mPreviewFooter');

    const inputId = type === 'positive' ? '#mEditorPositive' : '#mEditorNegative';
    const text = pageEl.querySelector(inputId)?.value || '';
    const label = type === 'positive' ? '正向提示词预览' : '负向提示词预览';
    const maxLen = type === 'positive' ? MAX_POSITIVE_PROMPT_LEN : MAX_NEGATIVE_PROMPT_LEN;

    currentPreviewType = type;
    title.textContent = label;
    content.textContent = text;
    footer.textContent = `字数：${text.length}/${maxLen}`;

    overlay.classList.add('m-preview-show');
}

async function handleImageImport(pageEl, files) {
    const currentCount = existingImages.length + importedImages.length;
    const remaining = MAX_IMAGES - currentCount;
    if (remaining <= 0) {
        showMobileToast(`最多上传 ${MAX_IMAGES} 张图片`, 'warning');
        return;
    }

    const filesToProcess = Array.from(files).slice(0, remaining);
    if (files.length > remaining) {
        showMobileToast(`仅添加前 ${remaining} 张图片`, 'warning');
    }

    showMobileToast('正在处理图片...');
    let addedCount = 0;
    for (const file of filesToProcess) {
        if (file.size > MAX_SOURCE_IMAGE_BYTES) {
            showMobileToast(`${file.name} 超过 10MB，已跳过`, 'warning');
            continue;
        }

        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
            showMobileToast(`${file.name} 格式不支持，已跳过`, 'warning');
            continue;
        }

        try {
            const dataUrl = await readFileAsDataURL(file);
            const optimized = await optimizeImageDataUrl(dataUrl, IMAGE_OPTIMIZE_OPTIONS);
            importedImages.push({
                file,
                dataUrl,
                compressedUrl: optimized.dataUrl,
                optimized
            });
            addedCount += 1;
        } catch (e) {
            console.error('image import error:', e);
            if (e?.code === 'IMAGE_PIXELS_TOO_LARGE') {
                showMobileToast(`${file.name} 像素过大，已跳过`, 'warning');
            } else {
                showMobileToast(`图片 ${file.name} 处理失败`, 'error');
            }
        }
    }
    renderImagePreviews(pageEl);
    if (addedCount > 0) {
        hasUnsavedChanges = true;
        showMobileToast(`已导入 ${addedCount} 张图片`);
    }
}

function showConfirmDialog(pageEl) {
    const overlay = pageEl.querySelector('#mConfirmOverlay');
    if (!overlay) return;
    overlay.classList.add('m-confirm-show');
    pageEl.querySelector('#mConfirmCancel')?.addEventListener('click', () => {
        overlay.classList.remove('m-confirm-show');
    }, { once: true });
    pageEl.querySelector('#mConfirmOk')?.addEventListener('click', () => {
        overlay.classList.remove('m-confirm-show');
        goBack();
    }, { once: true });
}

async function showTagPicker(pageEl) {
    const overlay = pageEl.querySelector('#mPickerOverlay');
    const sheet = pageEl.querySelector('#mPickerSheet');
    if (!overlay || !sheet) return;
    sheet.classList.add('m-picker-sheet-tags');

    let availableTags = [];
    try {
        const storage = getStorage();
        const promptSets = await storage.getPromptSets();
        availableTags = aggregateTags(promptSets);
    } catch (e) {
        availableTags = [];
    }

    const tempSelected = [...selectedTags];

    function renderPickerContent() {
        sheet.innerHTML = `
            <div class="m-action-sheet-handle"></div>
            <div class="m-picker-header">
                <div class="m-picker-title">选择标签</div>
                <div class="m-picker-subtitle">${availableTags.length > 0 ? '点按标签可多选' : '也可以直接新建自定义标签'}</div>
            </div>
            <div class="m-tag-picker-body">
                ${availableTags.length > 0 ? `
                    <div class="m-tag-picker-grid">
                        ${availableTags.map(tag => `
                            <button class="m-tag-picker-item ${tag.style} ${tempSelected.includes(tag.name) ? 'm-tag-picker-selected' : ''}" data-tag="${tag.name}">
                                ${tag.name}
                            </button>
                        `).join('')}
                    </div>
                ` : `
                    <div class="m-tag-picker-empty">
                        <div class="m-tag-picker-empty-title">还没有可用标签</div>
                        <div class="m-tag-picker-empty-text">先创建一个标签，后续会显示在这里。</div>
                    </div>
                `}
                ${tempSelected.length > 0 ? `
                    <div class="m-picker-selected">
                        <span class="m-picker-selected-label">已选</span>
                        ${tempSelected.map(tag => `
                            <span class="m-tag-pill m-tag-removable ${getTagStyle(tag)}" data-remove-tag="${tag}">
                                ${tag}
                                <button class="m-tag-remove" data-remove-tag="${tag}" aria-label="移除标签">${mobileIcon('x', { className: 'm-icon-xs' })}</button>
                            </span>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
            <div class="m-picker-footer">
                <div class="m-tag-custom-input-area">
                    <input type="text" class="m-tag-custom-input" id="mCustomTagInput" placeholder="输入自定义标签..." maxlength="10">
                    <button class="m-tag-custom-add-btn" id="mCustomTagAddBtn">添加</button>
                </div>
                <button class="m-picker-confirm" id="mTagPickerConfirm">确定</button>
            </div>
        `;

        sheet.querySelectorAll('.m-tag-picker-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const tag = btn.dataset.tag;
                const idx = tempSelected.indexOf(tag);
                if (idx >= 0) {
                    tempSelected.splice(idx, 1);
                    btn.classList.remove('m-tag-picker-selected');
                } else {
                    tempSelected.push(tag);
                    btn.classList.add('m-tag-picker-selected');
                }
                renderPickerContent();
            });
        });

        sheet.querySelectorAll('[data-remove-tag]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tag = btn.dataset.removeTag;
                const idx = tempSelected.indexOf(tag);
                if (idx >= 0) tempSelected.splice(idx, 1);
                renderPickerContent();
            });
        });

        const customInput = sheet.querySelector('#mCustomTagInput');
        const customAddBtn = sheet.querySelector('#mCustomTagAddBtn');

        function addCustomTag() {
            const val = customInput?.value?.trim();
            if (!val) return;
            if (tempSelected.includes(val)) {
                showMobileToast('该标签已选择');
                return;
            }
            tempSelected.push(val);
            saveCustomTag(val);
            if (!availableTags.find(t => t.name === val)) {
                availableTags.push({ name: val, count: 0, style: getTagStyleClass(val) });
            }
            renderPickerContent();
        }

        if (customAddBtn) customAddBtn.addEventListener('click', addCustomTag);
        if (customInput) {
            customInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomTag();
                }
            });
        }

        sheet.querySelector('#mTagPickerConfirm')?.addEventListener('click', () => {
            selectedTags = [...tempSelected];
            renderTags(pageEl);
            hasUnsavedChanges = true;
            closePicker(pageEl);
        });
    }

    renderPickerContent();
    overlay.classList.add('m-picker-show');
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closePicker(pageEl);
    }, { once: true });
}

async function showFolderPicker(pageEl) {
    const overlay = pageEl.querySelector('#mPickerOverlay');
    const sheet = pageEl.querySelector('#mPickerSheet');
    if (!overlay || !sheet) return;
    sheet.classList.remove('m-picker-sheet-tags');

    let folders = [];
    try {
        const storage = getStorage();
        folders = await storage.getFolders();
    } catch (e) {
        showMobileToast('加载分类失败', 'error');
        return;
    }

    sheet.innerHTML = `
        <div class="m-action-sheet-handle"></div>
        <div class="m-picker-title">选择分类</div>
        <div class="m-picker-list">
            <button class="m-picker-list-item ${!selectedFolder ? 'm-picker-list-active' : ''}" data-folder-id="">
                <span class="m-picker-list-icon">${mobileIcon('folder')}</span>
                <span class="m-picker-list-text">未分类</span>
                ${!selectedFolder ? `<span class="m-picker-list-check">${mobileIcon('check', { className: 'm-icon-sm' })}</span>` : ''}
            </button>
            ${folders.map(f => `
                <button class="m-picker-list-item ${selectedFolder === f.id ? 'm-picker-list-active' : ''}" data-folder-id="${f.id}">
                    <span class="m-picker-list-icon">${getFolderIcon(f.name)}</span>
                    <span class="m-picker-list-text">${f.name}</span>
                    ${selectedFolder === f.id ? `<span class="m-picker-list-check">${mobileIcon('check', { className: 'm-icon-sm' })}</span>` : ''}
                </button>
            `).join('')}
        </div>
    `;

    sheet.querySelectorAll('.m-picker-list-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const folderId = btn.dataset.folderId || null;
            selectedFolder = folderId;
            const folderText = pageEl.querySelector('#mFolderText');
            const folderIcon = pageEl.querySelector('#mFolderIcon');
            if (folderId) {
                const folder = folders.find(f => f.id === folderId);
                if (folderText && folder) folderText.textContent = folder.name;
                if (folderIcon && folder) folderIcon.innerHTML = getFolderIcon(folder.name);
            } else {
                if (folderText) folderText.textContent = '未分类';
                if (folderIcon) folderIcon.innerHTML = mobileIcon('folder');
            }
            hasUnsavedChanges = true;
            closePicker(pageEl);
        });
    });

    overlay.classList.add('m-picker-show');
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closePicker(pageEl);
    }, { once: true });
}

function closePicker(pageEl) {
    const overlay = pageEl.querySelector('#mPickerOverlay');
    if (overlay) overlay.classList.remove('m-picker-show');
}

function setupSwipeBack(pageEl) {
    let startX = 0;
    let startY = 0;
    let isSwiping = false;

    pageEl.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        if (touch.clientX <= 20) {
            startX = touch.clientX;
            startY = touch.clientY;
            isSwiping = true;
        }
    }, { passive: true });

    pageEl.addEventListener('touchmove', (e) => {
        if (!isSwiping) return;
        const touch = e.touches[0];
        const dx = touch.clientX - startX;
        const dy = Math.abs(touch.clientY - startY);
        if (dx > 30 && dx > dy) {
            e.preventDefault();
            const offset = Math.min(dx * 0.3, 100);
            pageEl.style.transform = `translateX(${offset}px)`;
            pageEl.style.transition = 'none';
        }
    }, { passive: false });

    pageEl.addEventListener('touchend', (e) => {
        if (!isSwiping) return;
        isSwiping = false;
        const touch = e.changedTouches[0];
        const dx = touch.clientX - startX;
        pageEl.style.transform = '';
        pageEl.style.transition = '';
        if (dx > 80) {
            if (hasUnsavedChanges) {
                showConfirmDialog(pageEl);
            } else {
                goBack();
            }
        }
    }, { passive: true });
}

function updateCharCount(pageEl, countId, text, maxLen) {
    const countEl = pageEl.querySelector('#' + countId);
    if (!countEl) return;
    const len = text.length;
    countEl.textContent = len;
    const countContainer = countEl.parentElement;
    if (countContainer) {
        countContainer.classList.toggle('m-char-over', len > maxLen);
    }
}

async function handleSave(pageEl) {
    const name = pageEl.querySelector('#mEditorName')?.value?.trim();
    const positive = pageEl.querySelector('#mEditorPositive')?.value?.trim();
    const negative = pageEl.querySelector('#mEditorNegative')?.value?.trim();
    const note = pageEl.querySelector('#mEditorNote')?.value?.trim() || '';

    let hasError = false;
    const nameInput = pageEl.querySelector('#mEditorName');
    const positiveInput = pageEl.querySelector('#mEditorPositive');
    const nameError = pageEl.querySelector('#mNameError');
    const positiveError = pageEl.querySelector('#mPositiveError');

    if (!name) {
        if (nameInput) nameInput.classList.add('m-input-error');
        if (nameError) nameError.style.display = 'block';
        hasError = true;
    } else {
        if (nameInput) nameInput.classList.remove('m-input-error');
        if (nameError) nameError.style.display = 'none';
    }

    if (!positive) {
        if (positiveInput) positiveInput.classList.add('m-input-error');
        if (positiveError) positiveError.style.display = 'block';
        hasError = true;
    } else {
        if (positiveInput) positiveInput.classList.remove('m-input-error');
        if (positiveError) positiveError.style.display = 'none';
    }

    if (hasError) return;

    try {
        const storage = getStorage();
        const tagsJson = JSON.stringify(selectedTags);

        if (editMode === 'create') {
            const result = await storage.createPromptSet(name, selectedFolder || null, tagsJson);
            if (result && result.id) {
                const set = await storage.getPromptSet(result.id);
                if (set && set.versions && set.versions.length > 0) {
                    const versionImages = [...(set.versions[0].images || [])];

                    for (const img of importedImages) {
                        const imgId = generateId();
                        const uploaded = await storage.uploadImage(imgId, img.compressedUrl, img.file.name);
                        versionImages.push({
                            id: imgId,
                            name: img.file.name,
                            path: img.file.name,
                            file: uploaded?.file || `${imgId}.jpg`,
                            note: '',
                            createdAt: new Date().toISOString()
                        });
                    }

                    await storage.updatePromptSet(result.id, {
                        versions: [{
                            id: set.versions[0].id,
                            prompt: positive,
                            negativePrompt: negative,
                            note: note,
                            aspectRatio: selectedRatio,
                            images: versionImages
                        }]
                    });
                }
                hasUnsavedChanges = false;
                showMobileToast('已保存');
                goBack();
            }
        } else {
            const versionImages = [...existingImages];

            for (const img of importedImages) {
                const imgId = generateId();
                const uploaded = await storage.uploadImage(imgId, img.compressedUrl, img.file.name);
                versionImages.push({
                    id: imgId,
                    name: img.file.name,
                    path: img.file.name,
                    file: uploaded?.file || `${imgId}.jpg`,
                    note: '',
                    createdAt: new Date().toISOString()
                });
            }

            await storage.updatePromptSet(editId, {
                name: name,
                folderId: selectedFolder || '',
                tags: tagsJson,
                versions: currentSet && currentSet.versions && currentSet.versions.length > 0 ? [{
                    id: currentSet.versions[0].id,
                    prompt: positive,
                    negativePrompt: negative,
                    note: note,
                    aspectRatio: selectedRatio,
                    images: versionImages
                }] : []
            });
            hasUnsavedChanges = false;
            showMobileToast('已保存');
            goBack();
        }
    } catch (e) {
        console.error('save error:', e);
        showMobileToast('保存失败', 'error');
    }
}

function unmount(pageEl) {
    editMode = 'create';
    editId = null;
    currentSet = null;
    selectedTags = [];
    selectedFolder = null;
    selectedRatio = '1:1';
    hasUnsavedChanges = false;
    importedImages = [];
    existingImages = [];
}

export { render, mount, unmount };
