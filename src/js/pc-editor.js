import { getStorage } from './storage.js';
import { navigate, goBack } from './pc-app.js';
import { showToast, showModal, closeModal, showConfirmModal, escapeHtml } from './pc-utils.js';
import { aggregateTags } from './tag-utils.js';
import { readFileAsDataURL, compressImageToJpeg } from './image-utils.js';
import { renderPcWelcomeBanner } from './pc-welcome-banner.js';

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

const RATIO_OPTIONS = ['1:1', '3:4', '4:3', '16:9', '9:16'];
const MAX_TITLE_LEN = 100;
const MAX_PROMPT_LEN = 2000;
const MAX_IMAGES = 10;

const beforeUnloadHandler = (e) => {
    if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
    }
};

function render(params = {}) {
    const isNew = !params.id || params.id === '';
    const title = isNew ? '新建提示词 ✨' : '编辑提示词 ✨';
    const subtitle = isNew ? '创建专属提示词，让创作更高效' : '优化专属提示词，让创作更高效';

    return `
        <div class="pc-editor-page">
            ${renderPcWelcomeBanner({
                title,
                subtitle,
                className: 'pc-welcome-banner-editor',
                leadingHtml: `
                    <button class="pc-top-nav-back pc-welcome-back" id="pcEditorBack" aria-label="返回">‹</button>
                `,
                actionsHtml: `
                    <button class="pc-editor-save-btn" id="pcEditorSave">
                        <span class="pc-editor-save-icon" aria-hidden="true">▣</span>
                        <span>保存</span>
                    </button>
                `,
                actionsPlacement: 'afterMascot'
            })}
            <div id="pcEditorContent"></div>
        </div>
    `;
}

async function mount(pageEl, params = {}) {
    promptSetId = params.id || null;
    editMode = !!promptSetId;
    hasUnsavedChanges = false;
    importedImages = [];
    window.addEventListener('beforeunload', beforeUnloadHandler);

    try {
        const storage = getStorage();
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
            formData = {
                name: '',
                folderId: '',
                tags: [],
                versions: [{
                    name: 'v1', prompt: '', negativePrompt: '', note: '',
                    aspectRatio: '1:1', stylePreset: '', model: '',
                    sampler: 'DPM++ 2M Karras', steps: 30, cfgScale: 7.0, hrFix: true, images: []
                }]
            };
        }

        renderEditorContent(pageEl);
        setupEditorEvents(pageEl);
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
                                    <span class="pc-editor-image-placeholder-icon">🖼️</span>
                                    <span class="pc-editor-image-placeholder-text">点击上传图片</span>
                                </div>
                            ` : `
                                <div class="pc-editor-image-grid" id="pcEditorImageGrid">
                                    ${allImages.map((img, idx) => {
                                        const isExisting = idx < getExistingImages().length;
                                        const src = img.compressedUrl || img.data || '';
                                        return `
                                            <div class="pc-editor-image-thumb" data-img-idx="${idx}" data-img-existing="${isExisting}">
                                                <img src="${src}" alt="预览" loading="lazy">
                                                <button class="pc-editor-image-delete" data-img-idx="${idx}" data-img-existing="${isExisting}">×</button>
                                            </div>
                                        `;
                                    }).join('')}
                                    ${canAddMore ? `
                                        <div class="pc-editor-image-add" id="pcEditorImageAdd">
                                            <span>+</span>
                                        </div>
                                    ` : ''}
                                </div>
                            `}
                        </div>
                    </div>

                    <div class="pc-editor-prompt-section">
                        <div class="pc-editor-prompt-header">
                            <span class="pc-editor-prompt-label pc-editor-prompt-label-positive">
                                ✨ 正向提示词<span class="pc-editor-form-required">*</span>
                            </span>
                            <button class="pc-editor-prompt-clear" id="pcClearPositive" ${!positivePrompt ? 'disabled' : ''}>清空</button>
                        </div>
                        <div class="pc-editor-textarea-wrap">
                            <textarea class="pc-editor-textarea" id="pcEditorPositive"
                                placeholder="输入正向提示词..." maxlength="${MAX_PROMPT_LEN}">${escapeHtml(positivePrompt)}</textarea>
                            <span class="pc-editor-textarea-char ${positivePrompt.length > MAX_PROMPT_LEN ? 'pc-editor-char-over' : ''}"
                                id="pcPositiveCount">${positivePrompt.length}/${MAX_PROMPT_LEN}</span>
                        </div>
                        <div class="pc-editor-form-error" id="pcPositiveError">请输入正向提示词</div>
                    </div>

                    <div class="pc-editor-prompt-section">
                        <div class="pc-editor-prompt-header">
                            <span class="pc-editor-prompt-label pc-editor-prompt-label-negative">
                                🚫 负向提示词
                            </span>
                            <button class="pc-editor-prompt-clear" id="pcClearNegative" ${!negativePrompt ? 'disabled' : ''}>清空</button>
                        </div>
                        <div class="pc-editor-textarea-wrap">
                            <textarea class="pc-editor-textarea" id="pcEditorNegative"
                                placeholder="输入负向提示词..." maxlength="${MAX_PROMPT_LEN}">${escapeHtml(negativePrompt)}</textarea>
                            <span class="pc-editor-textarea-char ${negativePrompt.length > MAX_PROMPT_LEN ? 'pc-editor-char-over' : ''}"
                                id="pcNegativeCount">${negativePrompt.length}/${MAX_PROMPT_LEN}</span>
                        </div>
                    </div>

                    <div class="pc-editor-form-group">
                        <label class="pc-editor-form-label"><span>标签</span></label>
                        <div class="pc-editor-tags-area" id="pcEditorTags">
                            ${formData.tags.map(t => `
                                <span class="pc-editor-tag-pill pc-editor-tag-enter" data-tag="${escapeAttr(t)}">
                                    ${escapeHtml(t)}
                                    <button class="pc-editor-tag-remove" data-tag="${escapeAttr(t)}">×</button>
                                </span>
                            `).join('')}
                            <button class="pc-editor-add-tag-btn" id="pcAddTagBtn">+ 添加标签</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="pc-editor-side">
                <div class="pc-editor-card">
                    <div class="pc-editor-form-group">
                        <label class="pc-editor-form-label"><span>分类</span></label>
                        <div class="pc-select-card" id="pcEditorFolderSelect">
                            <span class="pc-select-card-icon">📁</span>
                            <span class="pc-select-card-text" id="pcEditorFolderText">${currentFolder ? escapeHtml(currentFolder.name) : (formData.folderId ? '未分类' : '选择分类')}</span>
                            <span class="pc-select-card-arrow">▸</span>
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
}

function setupEditorEvents(pageEl) {
    pageEl.querySelector('#pcEditorBack')?.addEventListener('click', () => {
        if (hasUnsavedChanges) {
            showConfirmModal('有未保存的修改，确定放弃吗？', () => goBack());
        } else {
            goBack();
        }
    });

    const nameInput = pageEl.querySelector('#pcEditorName');
    nameInput?.addEventListener('input', (e) => {
        formData.name = e.target.value;
        hasUnsavedChanges = true;
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
        hasUnsavedChanges = true;
        updatePromptCharCount(pageEl, 'pcPositiveCount', e.target.value.length);
        updateClearBtnState(pageEl, 'pcClearPositive', e.target.value.length > 0);
        clearFieldError(pageEl, 'pcEditorPositive', 'pcPositiveError');
    });

    const negativeInput = pageEl.querySelector('#pcEditorNegative');
    negativeInput?.addEventListener('input', (e) => {
        if (formData.versions[0]) formData.versions[0].negativePrompt = e.target.value;
        hasUnsavedChanges = true;
        updatePromptCharCount(pageEl, 'pcNegativeCount', e.target.value.length);
        updateClearBtnState(pageEl, 'pcClearNegative', e.target.value.length > 0);
    });

    pageEl.querySelector('#pcClearPositive')?.addEventListener('click', () => {
        if (formData.versions[0]) formData.versions[0].prompt = '';
        hasUnsavedChanges = true;
        const ta = pageEl.querySelector('#pcEditorPositive');
        if (ta) ta.value = '';
        updatePromptCharCount(pageEl, 'pcPositiveCount', 0);
        updateClearBtnState(pageEl, 'pcClearPositive', false);
    });

    pageEl.querySelector('#pcClearNegative')?.addEventListener('click', () => {
        if (formData.versions[0]) formData.versions[0].negativePrompt = '';
        hasUnsavedChanges = true;
        const ta = pageEl.querySelector('#pcEditorNegative');
        if (ta) ta.value = '';
        updatePromptCharCount(pageEl, 'pcNegativeCount', 0);
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
                    hasUnsavedChanges = true;
                    renderEditorContent(pageEl);
                    setupEditorEvents(pageEl);
                }, { once: true });
            } else {
                formData.tags = formData.tags.filter(t => t !== tag);
                hasUnsavedChanges = true;
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
        hasUnsavedChanges = true;
    });

    pageEl.querySelector('#pcEditorSave')?.addEventListener('click', () => {
        savePromptSet(pageEl);
    });

    setupKeyboardShortcuts(pageEl);
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
            hasUnsavedChanges = true;
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

    if (files.length > remaining) {
        showToast(`仅添加前 ${remaining} 张（上限 ${MAX_IMAGES} 张）`, 'warning');
    }

    showToast('正在处理图片...');

    for (const file of filesToProcess) {
        if (file.size > 5 * 1024 * 1024) {
            showToast(`${file.name} 超过 5MB，已跳过`, 'warning');
            continue;
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            showToast(`${file.name} 格式不支持，已跳过`, 'warning');
            continue;
        }

        try {
            const dataUrl = await readFileAsDataURL(file);
            const compressed = await compressImageToJpeg(dataUrl);
            importedImages.push({
                file,
                dataUrl,
                compressedUrl: compressed,
                name: file.name
            });
        } catch (e) {
            console.error('image import error:', e);
            showToast(`${file.name} 处理失败`, 'error');
        }
    }

    hasUnsavedChanges = true;
    renderEditorContent(pageEl);
    setupEditorEvents(pageEl);

    const addedCount = importedImages.length;
    if (addedCount > 0) {
        showToast(`已导入图片`);
    }
}

function setupKeyboardShortcuts(pageEl) {
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

function updatePromptCharCount(pageEl, countId, len) {
    const countEl = pageEl.querySelector(`#${countId}`);
    if (countEl) {
        countEl.textContent = `${len}/${MAX_PROMPT_LEN}`;
        countEl.classList.toggle('pc-editor-char-over', len > MAX_PROMPT_LEN);
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
                <span class="pc-picker-list-icon">📁</span>
                <span>未分类</span>
                ${!formData.folderId ? '<span class="pc-picker-list-check">✓</span>' : ''}
            </button>
            ${allFolders.map(f => `
                <button class="pc-picker-list-item ${f.id === formData.folderId ? 'pc-picker-list-active' : ''}" data-folder-id="${f.id}">
                    <span class="pc-picker-list-icon">📂</span>
                    <span>${escapeHtml(f.name)}</span>
                    ${f.id === formData.folderId ? '<span class="pc-picker-list-check">✓</span>' : ''}
                </button>
            `).join('')}
        </div>
    `);

    modal.querySelectorAll('.pc-picker-list-item').forEach(btn => {
        btn.addEventListener('click', () => {
            formData.folderId = btn.dataset.folderId || '';
            hasUnsavedChanges = true;
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
                hasUnsavedChanges = true;
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
            hasUnsavedChanges = true;
        }
        closeModal();
        renderEditorContent(pageEl);
        setupEditorEvents(pageEl);
    };

    customAdd?.addEventListener('click', addCustomTag);
    customInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') addCustomTag(); });
}

async function savePromptSet(pageEl) {
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

    try {
        const storage = getStorage();
        const tags = formData.tags || [];
        const tagsStr = typeof tags === 'string' ? tags : JSON.stringify(tags);

        if (editMode && promptSetId) {
            const versionImages = [...getExistingImages()];
            for (const img of importedImages) {
                const imgId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
                await storage.uploadImage(imgId, img.compressedUrl, img.file.name);
                versionImages.push({
                    id: imgId,
                    name: img.file.name,
                    path: img.file.name,
                    file: `${imgId}.jpg`,
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
                    await storage.uploadImage(imgId, img.compressedUrl, img.file.name);
                    versionImages.push({
                        id: imgId,
                        name: img.file.name,
                        path: img.file.name,
                        file: `${imgId}.jpg`,
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
        navigate('/library');
    } catch (e) {
        console.error('save error:', e);
        showToast('保存失败，请重试', 'error');
    }
}

function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function unmount(pageEl) {
    window.removeEventListener('beforeunload', beforeUnloadHandler);
    if (pageEl._editorKeyHandler) {
        document.removeEventListener('keydown', pageEl._editorKeyHandler);
        delete pageEl._editorKeyHandler;
    }
    formData = {
        name: '', folderId: '', tags: [],
        versions: [{
            name: 'v1', prompt: '', negativePrompt: '', note: '',
            aspectRatio: '1:1', stylePreset: '', model: '',
            sampler: 'DPM++ 2M Karras', steps: 30, cfgScale: 7.0, hrFix: true, images: []
        }]
    };
    importedImages = [];
    hasUnsavedChanges = false;
    editMode = false;
    promptSetId = null;
}

export { render, mount, unmount };
