import { initStorage, getStorage, isCapacitor, API_BASE } from './storage.js';
import { generateId, formatDate, showToast } from './utils.js';
import { LanSync, LanScanner, SyncState } from './lan-sync.js';
import { TutorialGuide, isTutorialCompleted, resetTutorialFlag } from './tutorial.js';
import { readFileAsDataURL, compressImageToJpeg } from './image-utils.js';

let App = null;
if (isCapacitor) {
    import('@capacitor/app').then(mod => { App = mod.App; });
}

import editIcon from '../assets/icons/edit.svg';
import copyIcon from '../assets/icons/copy.svg';
import trashIcon from '../assets/icons/trash.svg';
import addImageIcon from '../assets/icons/add-image.svg';
import linkIcon from '../assets/icons/link.svg';
import signalIcon from '../assets/icons/signal.svg';
import checkIcon from '../assets/icons/check.svg';
import warningIcon from '../assets/icons/warning.svg';
import errorIcon from '../assets/icons/error.svg';
import celebrateIcon from '../assets/icons/celebrate.svg';
import skipIcon from '../assets/icons/skip.svg';
import successIcon from '../assets/icons/success.svg';
import sunIcon from '../assets/icons/sun.svg';
import moonIcon from '../assets/icons/moon.svg';
import helpIcon from '../assets/icons/help.svg';

let currentPromptSetId = null;
let currentVersionIndex = 0;
let allPromptSets = [];
let allFolders = [];
let currentSetCache = null;
let currentView = 'list';
let viewMode = 'list';
let activeFolderFilter = 'all';
let expandedFolders = new Set();
let lanSync = null;
let lastBackPressTime = 0;
let tutorialGuide = null;

const FOLDER_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'];

const SPLASH_MIN_DURATION = 1200;

function dismissSplash() {
    const splash = document.getElementById('splashScreen');
    if (!splash) return;
    splash.classList.add('fade-out');
    splash.addEventListener('transitionend', () => splash.remove(), { once: true });
}

async function init() {
    const startTime = Date.now();
    initTheme();

    const forceMobile = new URLSearchParams(window.location.search).has('mobile');
    const isNarrowScreen = window.innerWidth <= 768;

    if (isCapacitor || forceMobile || isNarrowScreen) {
        await initMobileApp();
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, SPLASH_MIN_DURATION - elapsed);
        setTimeout(dismissSplash, remaining);
        return;
    }

    history.replaceState({ view: 'list' }, '');
    try {
        await initStorage();
        allPromptSets = await getStorage().getPromptSets();
        allFolders = await getStorage().getFolders();
        renderPromptList();
        setupEventListeners();
        setupSyncUI();
        setupBackButton();
    } catch (e) {
        console.error('Init failed:', e);
        showToast('初始化失败：无法连接后端服务', 'error');
        setupEventListeners();
        setupSyncUI();
        setupBackButton();
    }
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, SPLASH_MIN_DURATION - elapsed);
    setTimeout(dismissSplash, remaining);
    setTimeout(() => {
        if (!isTutorialCompleted()) {
            startTutorial();
        }
    }, remaining + 500);
}

async function initMobileApp() {
    try {
        await initStorage();
        const { mount } = await import('./mobile-app.js');
        const mobileEl = document.getElementById('mobileApp');
        if (mobileEl) {
            mobileEl.classList.add('mobile-app');
            mount(mobileEl);
        }
        document.querySelector('.app-header').style.display = 'none';
        document.querySelector('.app-layout').style.display = 'none';
    } catch (e) {
        console.error('Mobile init failed:', e);
        showToast('移动端初始化失败', 'error');
    }
}

function startTutorial() {
    if (tutorialGuide) return;
    tutorialGuide = new TutorialGuide();
    tutorialGuide.start(() => {
        tutorialGuide = null;
    });
}

function setupEventListeners() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (document.getElementById('imageViewer').classList.contains('active')) {
                closeImageViewer();
            } else if (document.getElementById('promptPreview').classList.contains('active')) {
                closePromptPreview();
            } else if (document.getElementById('helpOverlay').classList.contains('active')) {
                closeHelpModal();
            } else if (document.getElementById('modalOverlay').classList.contains('active')) {
                closeModal();
            }
        }
    });

    window.addEventListener('popstate', (e) => {
        const state = e.state;
        if (state && state.view === 'mobile') return;
        if (!state || !state.view) {
            if (currentView !== 'list') {
                currentView = 'list';
            } else {
                const now = Date.now();
                if (App && now - lastBackPressTime < 2000) {
                    App.exitApp();
                } else {
                    lastBackPressTime = now;
                    history.pushState({ view: 'list' }, '');
                    showToast('再按一次退出应用', 'warning');
                }
            }
            return;
        }
        switch (state.view) {
            case 'list':
                if (document.getElementById('modalOverlay').classList.contains('active')) {
                    document.getElementById('modalOverlay').classList.remove('active');
                }
                if (document.getElementById('syncOverlay').classList.contains('active')) {
                    if (lanSync?.isSyncing()) {
                        lanSync.abort();
                    }
                    document.getElementById('syncOverlay').classList.remove('active');
                }
                if (document.getElementById('imageViewer').classList.contains('active')) {
                    document.getElementById('imageViewer').classList.remove('active');
                }
                if (document.getElementById('promptPreview').classList.contains('active')) {
                    document.getElementById('promptPreview').classList.remove('active');
                }
                if (document.getElementById('helpOverlay').classList.contains('active')) {
                    document.getElementById('helpOverlay').classList.remove('active');
                }
                currentView = 'list';
                break;
            case 'detail':
                if (document.getElementById('imageViewer').classList.contains('active')) {
                    document.getElementById('imageViewer').classList.remove('active');
                    currentView = 'detail';
                } else if (document.getElementById('promptPreview').classList.contains('active')) {
                    document.getElementById('promptPreview').classList.remove('active');
                    currentView = 'detail';
                } else if (document.getElementById('helpOverlay').classList.contains('active')) {
                    document.getElementById('helpOverlay').classList.remove('active');
                    currentView = 'detail';
                } else if (document.getElementById('modalOverlay').classList.contains('active')) {
                    document.getElementById('modalOverlay').classList.remove('active');
                    currentView = 'detail';
                } else if (document.getElementById('syncOverlay').classList.contains('active')) {
                    if (lanSync?.isSyncing()) {
                        lanSync.abort();
                    }
                    document.getElementById('syncOverlay').classList.remove('active');
                    currentView = 'detail';
                } else {
                    currentView = 'detail';
                }
                break;
            case 'imageViewer':
                if (document.getElementById('imageViewer').classList.contains('active')) {
                    document.getElementById('imageViewer').classList.remove('active');
                }
                break;
            case 'promptPreview':
                if (document.getElementById('promptPreview').classList.contains('active')) {
                    document.getElementById('promptPreview').classList.remove('active');
                }
                break;
            case 'modal':
                if (document.getElementById('modalOverlay').classList.contains('active')) {
                    document.getElementById('modalOverlay').classList.remove('active');
                }
                break;
            case 'syncModal':
                if (document.getElementById('syncOverlay').classList.contains('active')) {
                    if (lanSync?.isSyncing()) {
                        lanSync.abort();
                    }
                    document.getElementById('syncOverlay').classList.remove('active');
                }
                break;
            case 'helpModal':
                if (document.getElementById('helpOverlay').classList.contains('active')) {
                    document.getElementById('helpOverlay').classList.remove('active');
                }
                break;
        }
    });

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => filterPromptSets(e.target.value));
    }

    document.getElementById('contextMenu').addEventListener('click', (e) => {
        const item = e.target.closest('.context-menu-item');
        if (item) {
            handleContextAction(item.dataset.action);
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.context-menu')) {
            hideContextMenu();
        }
    });

    document.addEventListener('scroll', () => hideContextMenu(), true);

    document.getElementById('viewToggleBtn').addEventListener('click', toggleViewMode);
    document.getElementById('createFolderBtn').addEventListener('click', createFolder);

    document.getElementById('folderFilter').addEventListener('click', (e) => {
        const btn = e.target.closest('.folder-filter-btn');
        if (btn) {
            activeFolderFilter = btn.dataset.filter;
            document.querySelectorAll('.folder-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderPromptList();
        }
    });
}

function setupBackButton() {
    if (!App) return;
    App.addListener('backButton', () => {
        if (currentView !== 'list') {
            history.back();
        } else {
            const now = Date.now();
            if (now - lastBackPressTime < 2000) {
                App.exitApp();
            } else {
                lastBackPressTime = now;
                showToast('再按一次退出应用', 'warning');
            }
        }
    });
}

function showEmptyState() {
    document.getElementById('emptyState').style.display = 'flex';
    document.getElementById('detailView').style.display = 'none';
}

function showDetailView() {
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('detailView').style.display = 'block';
}

async function createPromptSet() {
    try {
        const folderId = (viewMode === 'folder' && activeFolderFilter && activeFolderFilter !== 'all' && activeFolderFilter !== 'unclassified') ? activeFolderFilter : null;
        const result = await getStorage().createPromptSet('未命名提示词集合', folderId);
        if (result && result.id) {
            allPromptSets = await getStorage().getPromptSets();
            renderPromptList();
            selectPromptSet(result.id);
            showToast('已创建新提示词集合');
        } else {
            showToast('创建失败：后端未响应', 'error');
        }
    } catch (e) {
        console.error('createPromptSet error:', e);
        showToast('创建失败：' + (e.message || '未知错误'), 'error');
    }
}

async function deletePromptSet() {
    if (!currentPromptSetId) return;
    const name = document.getElementById('promptSetName').value;
    showConfirmModal(`确定要删除「${name}」吗？此操作不可恢复。`, async () => {
        await getStorage().deletePromptSet(currentPromptSetId);
        allPromptSets = await getStorage().getPromptSets();
        currentPromptSetId = null;
        currentSetCache = null;
        renderPromptList();
        showEmptyState();
        if (currentView !== 'list') {
            history.back();
        }
        showToast('已删除');
    });
}

function showConfirmModal(message, onConfirm) {
    const modal = document.getElementById('modalContent');
    modal.innerHTML = `
        <h3>确认操作</h3>
        <p style="color:var(--text2);font-size:14px;margin-bottom:20px;">${message}</p>
        <div class="modal-actions">
            <button class="btn" onclick="window._closeModal()">取消</button>
            <button class="btn btn-danger" id="confirmBtn">确定</button>
        </div>
    `;
    document.getElementById('confirmBtn').onclick = () => { closeModal(); onConfirm(); };
    document.getElementById('modalOverlay').classList.add('active');
    history.pushState({ view: 'modal' }, '');
}

function closeModal() {
    if (!document.getElementById('modalOverlay').classList.contains('active')) return;
    document.getElementById('modalOverlay').classList.remove('active');
    history.back();
}
window._closeModal = closeModal;

async function selectPromptSet(id) {
    currentPromptSetId = id;
    currentVersionIndex = 0;
    currentView = 'detail';
    const set = await getStorage().getPromptSet(id);
    if (!set || set.error) return;
    currentSetCache = set;

    if (history.state?.view === 'detail') {
        history.replaceState({ view: 'detail', id }, '');
    } else {
        history.pushState({ view: 'detail', id }, '');
    }

    document.getElementById('promptSetName').value = set.name;
    showDetailView();
    renderVersionTabs(set);
    renderVersionDetail(set, 0);

    document.querySelectorAll('.prompt-item').forEach(el => {
        el.classList.toggle('active', el.dataset.id === id);
    });
}

async function updatePromptSetName(name) {
    if (!currentPromptSetId) return;
    await getStorage().updatePromptSet(currentPromptSetId, { name });
    const idx = allPromptSets.findIndex(s => s.id === currentPromptSetId);
    if (idx !== -1) allPromptSets[idx].name = name;
    renderPromptList();
}

function renderVersionTabs(set) {
    const container = document.getElementById('versionTabs');
    let html = '';
    set.versions.forEach((v, i) => {
        const isActive = i === currentVersionIndex;
        html += `<div class="version-tab ${isActive ? 'active' : ''}" data-version="${i}">${v.version}</div>`;
    });
    html += `<div class="version-tab-add" id="addVersionBtn">+ 新版本</div>`;
    container.innerHTML = html;

    container.querySelectorAll('.version-tab').forEach(tab => {
        tab.addEventListener('click', () => switchVersion(parseInt(tab.dataset.version)));
    });
    document.getElementById('addVersionBtn').addEventListener('click', addNewVersion);
}

async function switchVersion(index) {
    currentVersionIndex = index;
    const set = await getStorage().getPromptSet(currentPromptSetId);
    currentSetCache = set;
    renderVersionTabs(set);
    renderVersionDetail(set, index);
}

async function addNewVersion() {
    if (!currentPromptSetId) return;
    const result = await getStorage().addVersion(currentPromptSetId, {
        prompt: '',
        negativePrompt: '',
        note: ''
    });
    currentSetCache = await getStorage().getPromptSet(currentPromptSetId);
    currentVersionIndex = currentSetCache.versions.length - 1;
    renderVersionTabs(currentSetCache);
    renderVersionDetail(currentSetCache, currentVersionIndex);
    showToast(`已添加 ${currentSetCache.versions[currentVersionIndex].version}`);
}

async function deleteVersion(index) {
    if (!currentPromptSetId) return;
    const set = await getStorage().getPromptSet(currentPromptSetId);
    if (set.versions.length <= 1) {
        showToast('至少保留一个版本', 'error');
        return;
    }
    const vName = set.versions[index].version;
    showConfirmModal(`确定要删除版本「${vName}」吗？`, async () => {
        await getStorage().deleteVersion(currentPromptSetId, index);
        currentSetCache = await getStorage().getPromptSet(currentPromptSetId);
        if (currentVersionIndex >= currentSetCache.versions.length) {
            currentVersionIndex = currentSetCache.versions.length - 1;
        }
        renderVersionTabs(currentSetCache);
        renderVersionDetail(currentSetCache, currentVersionIndex);
        showToast(`已删除 ${vName}`);
    });
}

async function renderVersionDetail(set, versionIndex) {
    const v = set.versions[versionIndex];
    const isLatest = versionIndex === set.versions.length - 1;
    const container = document.getElementById('versionDetail');
    const storage = getStorage();

    const imageUrls = await Promise.all(v.images.map(img => storage.getImageUrl(img)));

    container.innerHTML = `
        <div class="version-content">
            <div class="section">
                <div class="version-meta">
                    <span class="version-badge ${isLatest ? 'latest' : 'old'}">${isLatest ? '最新版本' : '历史版本'}</span>
                    <span class="version-date">${v.version} · ${formatDate(v.createdAt)}</span>
                    <div class="version-actions">
                        <button class="btn btn-sm" id="previewVersionBtn"><img src="${copyIcon}" alt="" class="btn-icon-sm"> 预览</button>
                        <button class="btn btn-sm" id="renameVersionBtn"><img src="${editIcon}" alt="" class="btn-icon-sm"> 重命名</button>
                        <button class="btn btn-sm" id="duplicateVersionBtn"><img src="${copyIcon}" alt="" class="btn-icon-sm"> 复制为新版本</button>
                        ${set.versions.length > 1 ? `<button class="btn btn-sm btn-danger" id="deleteVersionBtn"><img src="${trashIcon}" alt="" class="btn-icon-sm"> 删除版本</button>` : ''}
                    </div>
                </div>
                <div class="section-title">版本备注</div>
                <textarea class="version-note" placeholder="记录本版本的修改说明..." id="versionNoteInput">${v.note || ''}</textarea>
            </div>
            <div class="section">
                <div class="section-title-row">
                    <span class="section-title">正向提示词</span>
                    <div class="section-title-actions">
                        <button class="btn btn-sm copy-btn" id="copyPositiveBtn"><img src="${copyIcon}" alt="" class="btn-icon-sm"> 复制</button>
                    </div>
                </div>
                <textarea class="prompt-textarea" placeholder="输入正向提示词..." id="promptInput">${v.prompt || ''}</textarea>
            </div>
            <div class="section">
                <div class="section-title-row">
                    <span class="section-title">反向提示词</span>
                    <div class="section-title-actions">
                        <button class="btn btn-sm copy-btn" id="copyNegativeBtn"><img src="${copyIcon}" alt="" class="btn-icon-sm"> 复制</button>
                    </div>
                </div>
                <textarea class="prompt-textarea" style="min-height:80px" placeholder="输入反向提示词..." id="negativePromptInput">${v.negativePrompt || ''}</textarea>
            </div>
            <div class="section">
                <div class="section-title">生成图片（${v.images.length}张）</div>
                <div class="image-grid" id="imageGrid">
                    ${v.images.map((img, imgIdx) => {
                        const imgSrc = imageUrls[imgIdx];
                        return `
                        <div class="image-card">
                            <div class="image-card-actions">
                                <button class="remove-image-btn" data-img-idx="${imgIdx}" title="删除">✕</button>
                            </div>
                            <img src="${imgSrc}" alt="${img.name || ''}" data-img-src="${imgSrc}" loading="lazy">
                            <div class="image-card-info">
                                <div class="image-card-name" title="${img.path || img.name || ''}">${img.path || img.name || ''}</div>
                                <input class="image-card-note" placeholder="图片备注..." value="${(img.note || '').replace(/"/g, '&quot;')}" data-img-idx="${imgIdx}">
                            </div>
                        </div>
                    `}).join('')}
                    <div class="add-image-zone" id="addImageZone">
                        <img src="${addImageIcon}" alt="" width="32" height="32">
                        <span>点击或拖拽添加图片</span>
                    </div>
                </div>
                <input type="file" id="imageInput" accept="image/*" multiple style="display:none">
            </div>
        </div>
    `;

    bindVersionEvents(versionIndex, v);
}

function bindVersionEvents(versionIndex, v) {
    const renameBtn = document.getElementById('renameVersionBtn');
    const dupBtn = document.getElementById('duplicateVersionBtn');
    const delBtn = document.getElementById('deleteVersionBtn');

    if (renameBtn) renameBtn.addEventListener('click', () => renameVersion(versionIndex));
    if (dupBtn) dupBtn.addEventListener('click', () => duplicateVersion(versionIndex));
    if (delBtn) delBtn.addEventListener('click', () => deleteVersion(versionIndex));

    const previewBtn = document.getElementById('previewVersionBtn');
    if (previewBtn) previewBtn.addEventListener('click', () => openPromptPreview(v));

    const copyPositiveBtn = document.getElementById('copyPositiveBtn');
    const copyNegativeBtn = document.getElementById('copyNegativeBtn');
    if (copyPositiveBtn) copyPositiveBtn.addEventListener('click', () => copyToClipboard(document.getElementById('promptInput').value));
    if (copyNegativeBtn) copyNegativeBtn.addEventListener('click', () => copyToClipboard(document.getElementById('negativePromptInput').value));

    let _noteTimer = null;
    document.getElementById('versionNoteInput').addEventListener('input', (e) => {
        clearTimeout(_noteTimer);
        _noteTimer = setTimeout(async () => {
            const set = await getStorage().getPromptSet(currentPromptSetId);
            if (set.versions[versionIndex]) {
                set.versions[versionIndex].note = e.target.value;
                await getStorage().updatePromptSet(currentPromptSetId, { versions: set.versions });
                currentSetCache = set;
            }
        }, 500);
    });

    let _promptTimer = null;
    const promptHandler = async (field, value) => {
        clearTimeout(_promptTimer);
        _promptTimer = setTimeout(async () => {
            const set = await getStorage().getPromptSet(currentPromptSetId);
            if (set.versions[versionIndex]) {
                set.versions[versionIndex][field] = value;
                await getStorage().updatePromptSet(currentPromptSetId, { versions: set.versions });
                currentSetCache = set;
            }
        }, 500);
    };
    document.getElementById('promptInput').addEventListener('input', (e) => promptHandler('prompt', e.target.value));
    document.getElementById('negativePromptInput').addEventListener('input', (e) => promptHandler('negativePrompt', e.target.value));

    document.querySelectorAll('.remove-image-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const imgIdx = parseInt(btn.dataset.imgIdx);
            await removeImage(versionIndex, imgIdx);
        });
    });

    document.querySelectorAll('.image-card-note').forEach(input => {
        let _imgNoteTimer = null;
        input.addEventListener('input', (e) => {
            clearTimeout(_imgNoteTimer);
            _imgNoteTimer = setTimeout(async () => {
                const imgIdx = parseInt(input.dataset.imgIdx);
                const set = await getStorage().getPromptSet(currentPromptSetId);
                if (set.versions[versionIndex] && set.versions[versionIndex].images[imgIdx]) {
                    set.versions[versionIndex].images[imgIdx].note = e.target.value;
                    await getStorage().updatePromptSet(currentPromptSetId, { versions: set.versions });
                    currentSetCache = set;
                }
            }, 500);
        });
    });

    document.querySelectorAll('.image-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.remove-image-btn') || e.target.closest('.image-card-note')) return;
            const img = card.querySelector('img[data-img-src]');
            if (img) viewImage(img.dataset.imgSrc);
        });
    });

    const addImageZone = document.getElementById('addImageZone');
    const imageInput = document.getElementById('imageInput');

    addImageZone.addEventListener('click', () => imageInput.click());
    addImageZone.addEventListener('dragover', (e) => { e.preventDefault(); addImageZone.classList.add('drag-over'); });
    addImageZone.addEventListener('dragleave', () => addImageZone.classList.remove('drag-over'));
    addImageZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        addImageZone.classList.remove('drag-over');
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        if (files.length > 0) await processImageFiles(versionIndex, files);
    });
    imageInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) await processImageFiles(versionIndex, files);
        e.target.value = '';
    });
}

async function processImageFiles(versionIndex, files) {
    const set = await getStorage().getPromptSet(currentPromptSetId);
    const v = set.versions[versionIndex];
    const storage = getStorage();

    for (const file of files) {
        const imgId = generateId();
        const data = await readFileAsDataURL(file);
        const compressed = await compressImageToJpeg(data);
        const uploadResult = await storage.uploadImage(imgId, compressed, file.name);
        v.images.push({
            id: imgId,
            name: file.name,
            path: file.name,
            file: uploadResult.file,
            note: '',
            createdAt: new Date().toISOString()
        });
    }

    await storage.updatePromptSet(currentPromptSetId, { versions: set.versions });
    currentSetCache = await storage.getPromptSet(currentPromptSetId);
    renderVersionDetail(currentSetCache, versionIndex);
    showToast(`已添加 ${files.length} 张图片`);
}

async function removeImage(versionIndex, imageIndex) {
    const set = await getStorage().getPromptSet(currentPromptSetId);
    const img = set.versions[versionIndex].images[imageIndex];
    if (img && img.file) {
        await getStorage().deleteImage(img.file);
    }
    set.versions[versionIndex].images.splice(imageIndex, 1);
    await getStorage().updatePromptSet(currentPromptSetId, { versions: set.versions });
    currentSetCache = await getStorage().getPromptSet(currentPromptSetId);
    renderVersionDetail(currentSetCache, versionIndex);
    showToast('已移除图片');
}

async function renameVersion(versionIndex) {
    const set = await getStorage().getPromptSet(currentPromptSetId);
    const currentName = set.versions[versionIndex].version;
    const modal = document.getElementById('modalContent');
    modal.innerHTML = `
        <h3>重命名版本</h3>
        <label>版本名称</label>
        <input type="text" id="versionNameInput" value="${currentName}" autofocus>
        <div class="modal-actions">
            <button class="btn" onclick="window._closeModal()">取消</button>
            <button class="btn btn-primary" id="renameBtn">确定</button>
        </div>
    `;
    document.getElementById('renameBtn').onclick = async () => {
        const newName = document.getElementById('versionNameInput').value.trim();
        if (!newName) return;
        await getStorage().renameVersion(currentPromptSetId, versionIndex, newName);
        closeModal();
        currentSetCache = await getStorage().getPromptSet(currentPromptSetId);
        renderVersionTabs(currentSetCache);
        renderVersionDetail(currentSetCache, versionIndex);
        showToast('已重命名');
    };
    document.getElementById('modalOverlay').classList.add('active');
    history.pushState({ view: 'modal' }, '');
    setTimeout(() => {
        const input = document.getElementById('versionNameInput');
        input.focus();
        input.select();
    }, 100);
}

async function duplicateVersion(versionIndex) {
    await getStorage().duplicateVersion(currentPromptSetId, versionIndex);
    currentSetCache = await getStorage().getPromptSet(currentPromptSetId);
    currentVersionIndex = currentSetCache.versions.length - 1;
    renderVersionTabs(currentSetCache);
    renderVersionDetail(currentSetCache, currentVersionIndex);
    showToast(`已复制为新版本 ${currentSetCache.versions[currentVersionIndex].version}`);
}

function openPromptPreview(v) {
    document.getElementById('previewTitle').textContent = v.version;
    document.getElementById('previewPositive').textContent = v.prompt || '（空）';
    document.getElementById('previewNegative').textContent = v.negativePrompt || '（空）';

    const noteSection = document.getElementById('previewNoteSection');
    if (v.note) {
        noteSection.style.display = 'block';
        document.getElementById('previewNote').textContent = v.note;
    } else {
        noteSection.style.display = 'none';
    }

    document.getElementById('promptPreview').classList.add('active');
    history.pushState({ view: 'promptPreview' }, '');

    document.getElementById('previewCopyPositive').onclick = () => copyToClipboard(v.prompt || '');
    document.getElementById('previewCopyNegative').onclick = () => copyToClipboard(v.negativePrompt || '');
}

function closePromptPreview() {
    if (!document.getElementById('promptPreview').classList.contains('active')) return;
    document.getElementById('promptPreview').classList.remove('active');
    history.back();
}

function initTheme() {
    const stored = localStorage.getItem('theme');
    let theme;
    if (stored) {
        theme = stored;
    } else {
        theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    applyTheme(theme);

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            applyTheme(e.matches ? 'dark' : 'light');
        }
    });
}

function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const icon = document.getElementById('themeToggleIcon');
    if (icon) {
        icon.src = theme === 'dark' ? sunIcon : moonIcon;
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
        meta.content = theme === 'dark' ? '#0f0f0f' : '#f5f5f5';
    }
}

function toggleTheme() {
    const current = document.documentElement.dataset.theme || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    applyTheme(next);
}

async function copyToClipboard(text) {
    if (!text) {
        showToast('内容为空，无法复制', 'error');
        return;
    }
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
        showToast('已复制到剪贴板');
    } catch (e) {
        showToast('复制失败', 'error');
    }
}

function viewImage(src) {
    document.getElementById('imageViewerImg').src = src;
    document.getElementById('imageViewer').classList.add('active');
    history.pushState({ view: 'imageViewer' }, '');
}

function closeImageViewer() {
    if (!document.getElementById('imageViewer').classList.contains('active')) return;
    document.getElementById('imageViewer').classList.remove('active');
    history.back();
}

function toggleCompare() {
    const view = document.getElementById('compareView');
    if (view.style.display === 'none') {
        renderCompareView();
        view.style.display = 'block';
    } else {
        view.style.display = 'none';
    }
}

async function renderCompareView() {
    const set = await getStorage().getPromptSet(currentPromptSetId);
    if (set.versions.length < 2) {
        document.getElementById('compareView').innerHTML = '<p style="color:var(--text2);font-size:13px;">至少需要2个版本才能对比</p>';
        return;
    }
    let optionsHtml = set.versions.map((v, i) => `<option value="${i}">${v.version}</option>`).join('');
    document.getElementById('compareView').innerHTML = `
        <div style="display:flex;gap:12px;margin-bottom:12px;align-items:center;">
            <div class="select-wrap" style="flex:1"><select id="compareLeft">${optionsHtml}</select></div>
            <span style="color:var(--text2);">vs</span>
            <div class="select-wrap" style="flex:1"><select id="compareRight">${optionsHtml}</select></div>
        </div>
        <div id="compareResult"></div>
    `;
    if (set.versions.length > 1) document.getElementById('compareRight').value = '1';
    document.getElementById('compareLeft').addEventListener('change', updateCompare);
    document.getElementById('compareRight').addEventListener('change', updateCompare);
    updateCompare();
}

async function updateCompare() {
    const leftIdx = parseInt(document.getElementById('compareLeft').value);
    const rightIdx = parseInt(document.getElementById('compareRight').value);
    const set = await getStorage().getPromptSet(currentPromptSetId);
    const left = set.versions[leftIdx];
    const right = set.versions[rightIdx];
    const storage = getStorage();

    async function renderImages(version) {
        if (!version.images || version.images.length === 0) return '';
        const urls = await Promise.all(version.images.map(img => storage.getImageUrl(img)));
        return `<div class="compare-images">
            ${version.images.map((img, i) => {
                const src = urls[i];
                return `<img src="${src}" data-img-src="${src}" loading="lazy" class="compare-img">`;
            }).join('')}
        </div>`;
    }

    const leftImages = await renderImages(left);
    const rightImages = await renderImages(right);

    document.getElementById('compareResult').innerHTML = `
        <div class="compare-view">
            <div class="compare-panel">
                <h4>${left.version}</h4>
                <div class="compare-prompt">${left.prompt || '<span style="color:var(--text2)">（空）</span>'}</div>
                ${leftImages}
            </div>
            <div class="compare-panel">
                <h4>${right.version}</h4>
                <div class="compare-prompt">${right.prompt || '<span style="color:var(--text2)">（空）</span>'}</div>
                ${rightImages}
            </div>
        </div>
    `;
    document.querySelectorAll('.compare-img').forEach(img => {
        img.addEventListener('click', () => viewImage(img.dataset.imgSrc));
    });
}

function renderPromptList(filter = '') {
    const container = document.getElementById('promptList');
    let sets = allPromptSets;
    if (filter) {
        const keyword = filter.toLowerCase();
        sets = sets.filter(s => s.name.toLowerCase().includes(keyword));
    }

    if (viewMode === 'folder') {
        if (activeFolderFilter === 'unclassified') {
            sets = sets.filter(s => !s.folderId);
        }
    }

    sets.sort((a, b) => {
        const ta = a.updatedAt || a.createdAt || '';
        const tb = b.updatedAt || b.createdAt || '';
        return tb.localeCompare(ta);
    });

    if (viewMode === 'folder') {
        renderFolderList();
        let html = '';
        if (activeFolderFilter === 'all') {
            for (const folder of allFolders) {
                const folderSets = sets.filter(s => s.folderId === folder.id);
                if (folderSets.length > 0 && expandedFolders.has(folder.id)) {
                    html += folderSets.map(s => renderPromptItemHtml(s, true)).join('');
                }
            }
            const unclassifiedSets = sets.filter(s => !s.folderId);
            html += unclassifiedSets.map(s => renderPromptItemHtml(s, false)).join('');
        } else if (activeFolderFilter === 'unclassified') {
            html += sets.map(s => renderPromptItemHtml(s, false)).join('');
        } else {
            const folderSets = sets.filter(s => s.folderId === activeFolderFilter);
            html += folderSets.map(s => renderPromptItemHtml(s, true)).join('');
        }
        container.innerHTML = html;
    } else {
        container.innerHTML = sets.map(s => renderPromptItemHtml(s, false)).join('');
    }

    container.querySelectorAll('.prompt-item').forEach(item => {
        item.addEventListener('click', () => selectPromptSet(item.dataset.id));
        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showContextMenu(e.clientX, e.clientY, item.dataset.id);
        });
        setupLongPress(item, item.dataset.id);
    });
}

function renderPromptItemHtml(s, inFolder) {
    const folder = inFolder ? allFolders.find(f => f.id === s.folderId) : null;
    const colorDot = folder && folder.color ? `<span class="folder-color-dot" style="background:${folder.color};width:6px;height:6px;display:inline-block;margin-right:4px;vertical-align:middle;"></span>` : '';
    return `
        <div class="prompt-item ${s.id === currentPromptSetId ? 'active' : ''}" data-id="${s.id}">
            <div class="prompt-item-name">${colorDot}${s.name}</div>
            <div class="prompt-item-meta">
                <span>${s.versionCount || (s.versions && s.versions.length) || 0} 个版本</span>
                <span>${s.imageCount || 0} 张图片</span>
            </div>
        </div>
    `;
}

function filterPromptSets(keyword) {
    renderPromptList(keyword);
}

let contextMenuTargetId = null;
let longPressTimer = null;

function setupLongPress(element, id) {
    element.addEventListener('touchstart', (e) => {
        longPressTimer = setTimeout(() => {
            const touch = e.touches[0];
            showContextMenu(touch.clientX, touch.clientY, id);
        }, 500);
        element.classList.add('pressing');
    }, { passive: true });

    element.addEventListener('touchend', () => {
        clearTimeout(longPressTimer);
        element.classList.remove('pressing');
    });

    element.addEventListener('touchmove', () => {
        clearTimeout(longPressTimer);
        element.classList.remove('pressing');
    });
}

function showContextMenu(x, y, id) {
    contextMenuTargetId = id;
    const menu = document.getElementById('contextMenu');
    const moveOption = viewMode === 'folder' && allFolders.length > 0
        ? `<div class="context-menu-item" data-action="moveToFolder"><img src="${editIcon}" alt="" class="context-menu-icon"> 移动到文件夹</div>`
        : '';
    menu.innerHTML = `
        <div class="context-menu-item" data-action="rename">
            <img src="${editIcon}" alt="" class="context-menu-icon"> 重命名
        </div>
        <div class="context-menu-item" data-action="duplicate">
            <img src="${copyIcon}" alt="" class="context-menu-icon"> 复制
        </div>
        ${moveOption}
        <div class="context-menu-item context-menu-item-danger" data-action="delete">
            <img src="${trashIcon}" alt="" class="context-menu-icon"> 删除
        </div>
    `;
    const menuWidth = 160;
    const menuHeight = 120;
    const maxX = window.innerWidth - menuWidth - 8;
    const maxY = window.innerHeight - menuHeight - 8;
    menu.style.left = Math.min(x, maxX) + 'px';
    menu.style.top = Math.min(y, maxY) + 'px';
    menu.classList.add('active');
}

function hideContextMenu() {
    document.getElementById('contextMenu').classList.remove('active');
    contextMenuTargetId = null;
}

function toggleViewMode() {
    viewMode = viewMode === 'list' ? 'folder' : 'list';
    const btn = document.getElementById('viewToggleBtn');
    btn.textContent = viewMode === 'list' ? '☰' : '≡';
    document.getElementById('folderFilter').style.display = viewMode === 'folder' ? 'flex' : 'none';
    document.getElementById('folderList').style.display = viewMode === 'folder' ? 'block' : 'none';
    document.getElementById('sidebarFooter').style.display = viewMode === 'folder' ? 'block' : 'none';
    if (viewMode === 'folder') {
        activeFolderFilter = 'all';
        document.querySelectorAll('.folder-filter-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.filter === 'all');
        });
    }
    renderPromptList();
}

async function createFolder() {
    const modal = document.getElementById('modalContent');
    const colorHtml = FOLDER_COLORS.map(c =>
        `<div class="color-picker-item" style="background:${c}" data-color="${c}"></div>`
    ).join('');
    modal.innerHTML = `
        <h3>新建文件夹</h3>
        <label>文件夹名称</label>
        <input type="text" id="newFolderNameInput" placeholder="输入文件夹名称..." autofocus>
        <label style="margin-top:8px;">颜色标签</label>
        <div class="color-picker" id="colorPicker">${colorHtml}</div>
        <div class="modal-actions">
            <button class="btn" onclick="window._closeModal()">取消</button>
            <button class="btn btn-primary" id="confirmCreateFolderBtn">创建</button>
        </div>
    `;
    let selectedColor = '';
    document.querySelectorAll('.color-picker-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.color-picker-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            selectedColor = item.dataset.color;
        });
    });
    document.getElementById('confirmCreateFolderBtn').onclick = async () => {
        const name = document.getElementById('newFolderNameInput').value.trim();
        if (!name) return;
        await getStorage().createFolder(name, selectedColor);
        allFolders = await getStorage().getFolders();
        renderPromptList();
        closeModal();
        showToast('已创建文件夹');
    };
    document.getElementById('modalOverlay').classList.add('active');
    history.pushState({ view: 'modal' }, '');
    setTimeout(() => {
        document.getElementById('newFolderNameInput').focus();
    }, 100);
}

function renderFolderList() {
    const container = document.getElementById('folderList');
    const html = allFolders.map(f => {
        const count = allPromptSets.filter(s => s.folderId === f.id).length;
        const isExpanded = expandedFolders.has(f.id);
        const isActive = activeFolderFilter === f.id;
        return `
            <div class="folder-item ${isActive ? 'active' : ''}" data-folder-id="${f.id}">
                ${f.color ? `<span class="folder-color-dot" style="background:${f.color}"></span>` : '<span class="folder-color-dot" style="background:var(--text2)"></span>'}
                <span class="folder-item-name">${f.name}</span>
                <span class="folder-item-count">${count}</span>
                <span class="folder-item-arrow ${isExpanded ? 'expanded' : ''}">▶</span>
            </div>
        `;
    }).join('');
    container.innerHTML = html;

    container.querySelectorAll('.folder-item').forEach(item => {
        const folderId = item.dataset.folderId;
        item.addEventListener('click', () => {
            if (expandedFolders.has(folderId)) {
                expandedFolders.delete(folderId);
            } else {
                expandedFolders.add(folderId);
            }
            activeFolderFilter = folderId;
            document.querySelectorAll('.folder-filter-btn').forEach(b => b.classList.remove('active'));
            renderPromptList();
        });
        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showFolderContextMenu(e.clientX, e.clientY, folderId);
        });
        setupFolderLongPress(item, folderId);
    });
}

function setupFolderLongPress(element, folderId) {
    let timer = null;
    element.addEventListener('touchstart', (e) => {
        timer = setTimeout(() => {
            const touch = e.touches[0];
            showFolderContextMenu(touch.clientX, touch.clientY, folderId);
        }, 500);
    }, { passive: true });
    element.addEventListener('touchend', () => clearTimeout(timer));
    element.addEventListener('touchmove', () => clearTimeout(timer));
}

let folderContextMenuTargetId = null;

function showFolderContextMenu(x, y, folderId) {
    folderContextMenuTargetId = folderId;
    const menu = document.getElementById('contextMenu');
    menu.innerHTML = `
        <div class="context-menu-item" data-action="renameFolder">
            <img src="${editIcon}" alt="" class="context-menu-icon"> 重命名
        </div>
        <div class="context-menu-item" data-action="changeFolderColor">
            <img src="${editIcon}" alt="" class="context-menu-icon"> 更改颜色
        </div>
        <div class="context-menu-item context-menu-item-danger" data-action="deleteFolder">
            <img src="${trashIcon}" alt="" class="context-menu-icon"> 删除
        </div>
    `;
    const menuWidth = 160;
    const menuHeight = 120;
    const maxX = window.innerWidth - menuWidth - 8;
    const maxY = window.innerHeight - menuHeight - 8;
    menu.style.left = Math.min(x, maxX) + 'px';
    menu.style.top = Math.min(y, maxY) + 'px';
    menu.classList.add('active');
}

async function handleContextAction(action) {
    if (action === 'renameFolder' || action === 'changeFolderColor' || action === 'deleteFolder') {
        const folderId = folderContextMenuTargetId;
        hideContextMenu();
        if (!folderId) return;
        const folder = allFolders.find(f => f.id === folderId);
        if (!folder) return;

        switch (action) {
            case 'renameFolder': {
                const modal = document.getElementById('modalContent');
                modal.innerHTML = `
                    <h3>重命名文件夹</h3>
                    <label>文件夹名称</label>
                    <input type="text" id="renameFolderInput" value="${folder.name}" autofocus>
                    <div class="modal-actions">
                        <button class="btn" onclick="window._closeModal()">取消</button>
                        <button class="btn btn-primary" id="renameFolderBtn">确定</button>
                    </div>
                `;
                document.getElementById('renameFolderBtn').onclick = async () => {
                    const newName = document.getElementById('renameFolderInput').value.trim();
                    if (!newName) return;
                    await getStorage().updateFolder(folderId, { name: newName });
                    allFolders = await getStorage().getFolders();
                    renderPromptList();
                    closeModal();
                    showToast('已重命名');
                };
                document.getElementById('modalOverlay').classList.add('active');
                history.pushState({ view: 'modal' }, '');
                setTimeout(() => {
                    const input = document.getElementById('renameFolderInput');
                    input.focus();
                    input.select();
                }, 100);
                break;
            }
            case 'changeFolderColor': {
                const modal = document.getElementById('modalContent');
                const colorHtml = FOLDER_COLORS.map(c =>
                    `<div class="color-picker-item ${folder.color === c ? 'selected' : ''}" style="background:${c}" data-color="${c}"></div>`
                ).join('');
                modal.innerHTML = `
                    <h3>选择颜色</h3>
                    <div class="color-picker" id="colorPicker">${colorHtml}</div>
                    <div class="modal-actions">
                        <button class="btn" onclick="window._closeModal()">取消</button>
                        <button class="btn btn-primary" id="saveColorBtn">确定</button>
                    </div>
                `;
                let selectedColor = folder.color;
                document.querySelectorAll('.color-picker-item').forEach(item => {
                    item.addEventListener('click', () => {
                        document.querySelectorAll('.color-picker-item').forEach(i => i.classList.remove('selected'));
                        item.classList.add('selected');
                        selectedColor = item.dataset.color;
                    });
                });
                document.getElementById('saveColorBtn').onclick = async () => {
                    await getStorage().updateFolder(folderId, { color: selectedColor });
                    allFolders = await getStorage().getFolders();
                    renderPromptList();
                    closeModal();
                    showToast('已更改颜色');
                };
                document.getElementById('modalOverlay').classList.add('active');
                history.pushState({ view: 'modal' }, '');
                break;
            }
            case 'deleteFolder': {
                showConfirmModal(`确定要删除文件夹「${folder.name}」吗？集合将移至未分类。`, async () => {
                    await getStorage().deleteFolder(folderId);
                    allFolders = await getStorage().getFolders();
                    allPromptSets = await getStorage().getPromptSets();
                    renderPromptList();
                    showToast('已删除文件夹');
                });
                break;
            }
        }
        return;
    }

    const id = contextMenuTargetId;
    hideContextMenu();
    if (!id) return;

    switch (action) {
        case 'rename': {
            const set = allPromptSets.find(s => s.id === id);
            if (!set) return;
            const modal = document.getElementById('modalContent');
            modal.innerHTML = `
                <h3>重命名集合</h3>
                <label>集合名称</label>
                <input type="text" id="renameSetInput" value="${set.name}" autofocus>
                <div class="modal-actions">
                    <button class="btn" onclick="window._closeModal()">取消</button>
                    <button class="btn btn-primary" id="renameSetBtn">确定</button>
                </div>
            `;
            document.getElementById('renameSetBtn').onclick = async () => {
                const newName = document.getElementById('renameSetInput').value.trim();
                if (!newName) return;
                await getStorage().updatePromptSet(id, { name: newName });
                const idx = allPromptSets.findIndex(s => s.id === id);
                if (idx !== -1) allPromptSets[idx].name = newName;
                renderPromptList();
                if (currentPromptSetId === id) {
                    document.getElementById('promptSetName').value = newName;
                }
                closeModal();
                showToast('已重命名');
            };
            document.getElementById('modalOverlay').classList.add('active');
            history.pushState({ view: 'modal' }, '');
            setTimeout(() => {
                const input = document.getElementById('renameSetInput');
                input.focus();
                input.select();
            }, 100);
            break;
        }
        case 'duplicate': {
            try {
                const set = await getStorage().getPromptSet(id);
                if (!set) return;
                const newName = set.name + ' (副本)';
                const newSet = await getStorage().createPromptSet(newName);
                if (newSet && newSet.id) {
                    const fullSet = await getStorage().getPromptSet(id);
                    await getStorage().updatePromptSet(newSet.id, { versions: fullSet.versions });
                    allPromptSets = await getStorage().getPromptSets();
                    renderPromptList();
                    showToast('已复制集合');
                }
            } catch (e) {
                showToast('复制失败：' + e.message, 'error');
            }
            break;
        }
        case 'delete': {
            const set = allPromptSets.find(s => s.id === id);
            if (!set) return;
            showConfirmModal(`确定要删除「${set.name}」吗？此操作不可恢复。`, async () => {
                await getStorage().deletePromptSet(id);
                allPromptSets = await getStorage().getPromptSets();
                if (currentPromptSetId === id) {
                    currentPromptSetId = null;
                    currentSetCache = null;
                    showEmptyState();
                    if (currentView !== 'list') {
                        history.back();
                    }
                }
                renderPromptList();
                showToast('已删除');
            });
            break;
        }
        case 'moveToFolder': {
            const folderOptions = allFolders.map(f =>
                `<div class="context-menu-item" data-action="moveTo_${f.id}" data-folder-id="${f.id}">
                    ${f.color ? `<span class="folder-color-dot" style="background:${f.color};width:10px;height:10px;display:inline-block;border-radius:50%;margin-right:6px;"></span>` : ''}
                    ${f.name}
                </div>`
            ).join('');
            const modal = document.getElementById('modalContent');
            modal.innerHTML = `
                <h3>移动到文件夹</h3>
                <div style="margin:12px 0;">
                    <div class="context-menu-item" data-move-folder-id="" style="margin-bottom:4px;">未分类</div>
                    ${folderOptions}
                </div>
                <div class="modal-actions">
                    <button class="btn" onclick="window._closeModal()">取消</button>
                </div>
            `;
            modal.querySelectorAll('[data-move-folder-id]').forEach(item => {
                item.addEventListener('click', async () => {
                    const targetFolderId = item.dataset.moveFolderId || null;
                    await getStorage().movePromptToFolder(id, targetFolderId);
                    allPromptSets = await getStorage().getPromptSets();
                    renderPromptList();
                    closeModal();
                    showToast(targetFolderId ? '已移动到文件夹' : '已移至未分类');
                });
            });
            document.getElementById('modalOverlay').classList.add('active');
            history.pushState({ view: 'modal' }, '');
            break;
        }
    }
}

async function exportData() {
    const result = await getStorage().exportData();
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompt-tool-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('数据已导出');
}

async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!Array.isArray(data)) throw new Error('无效数据格式');
        const result = await getStorage().importData(data);
        allPromptSets = await getStorage().getPromptSets();
        renderPromptList();
        showToast(`已导入 ${result.imported} 个提示词集合`);
    } catch (e) {
        showToast('导入失败：' + e.message, 'error');
    }
    event.target.value = '';
}

document.getElementById('createBtn').addEventListener('click', createPromptSet);
document.getElementById('exportBtn').addEventListener('click', exportData);
document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
document.getElementById('importFile').addEventListener('change', importData);
document.getElementById('promptSetName').addEventListener('input', (e) => updatePromptSetName(e.target.value));
document.getElementById('deleteBtn').addEventListener('click', deletePromptSet);
document.getElementById('compareBtn').addEventListener('click', toggleCompare);
document.getElementById('imageViewer').addEventListener('click', closeImageViewer);
document.getElementById('closePreviewBtn').addEventListener('click', closePromptPreview);
document.getElementById('promptPreview').addEventListener('click', (e) => {
    if (e.target.id === 'promptPreview') closePromptPreview();
});
document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme);

document.getElementById('helpBtn').addEventListener('click', openHelpModal);
document.getElementById('helpCloseBtn').addEventListener('click', closeHelpModal);
document.getElementById('helpOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'helpOverlay') closeHelpModal();
});

function openHelpModal() {
    document.getElementById('helpOverlay').classList.add('active');
    history.pushState({ view: 'helpModal' }, '');
}

function closeHelpModal() {
    if (!document.getElementById('helpOverlay').classList.contains('active')) return;
    document.getElementById('helpOverlay').classList.remove('active');
    history.back();
}

document.getElementById('retutorialBtn').addEventListener('click', () => {
    closeHelpModal();
    resetTutorialFlag();
    setTimeout(() => startTutorial(), 400);
});

let lanScanner = null;
let discoveredDevices = [];

function setupSyncUI() {
    const syncBtn = document.getElementById('syncBtn');
    if (isCapacitor) {
        syncBtn.style.display = 'inline-flex';
        lanSync = new LanSync(getStorage());
        lanScanner = new LanScanner();
    }

    syncBtn.addEventListener('click', openSyncModal);

    document.getElementById('syncCloseBtn').addEventListener('click', closeSyncModal);
    document.getElementById('syncOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'syncOverlay' && !lanSync?.isSyncing()) closeSyncModal();
    });

    document.getElementById('syncStartBtn').addEventListener('click', startSync);
    document.getElementById('syncIpInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') startSync();
    });

    document.getElementById('syncRefreshBtn').addEventListener('click', () => {
        if (lanScanner && !lanScanner.scanning) startDeviceScan();
    });

    if (!isCapacitor) {
        document.getElementById('syncDiscoverySection').style.display = 'none';
        loadPCNetworkInfo();
    }
}

async function loadPCNetworkInfo() {
    try {
        const res = await fetch(`${API_BASE}/api/network-info`);
        if (res.ok) {
            const info = await res.json();
            const headerActions = document.querySelector('.header-actions');
            const ipDisplay = document.createElement('div');
            ipDisplay.className = 'ip-display';
            ipDisplay.innerHTML = `<span class="ip-display-label">IP:</span> ${info.ip}:${info.port}`;
            headerActions.insertBefore(ipDisplay, headerActions.firstChild);
        }
    } catch (e) {}
}

function openSyncModal() {
    document.getElementById('syncOverlay').classList.add('active');
    document.getElementById('syncInputSection').style.display = 'block';
    document.getElementById('syncProgressSection').style.display = 'none';
    document.getElementById('syncReportSection').style.display = 'none';
    document.getElementById('syncStartBtn').disabled = false;
    history.pushState({ view: 'syncModal' }, '');
    document.getElementById('syncIpInput').focus();
    if (lanScanner && !lanScanner.scanning) startDeviceScan();
}

async function startDeviceScan() {
    const deviceList = document.getElementById('syncDeviceList');
    deviceList.innerHTML = '';
    deviceList.classList.add('scanning');
    discoveredDevices = [];

    lanScanner.onDeviceFound = (device) => {
        discoveredDevices.push(device);
        renderDeviceCard(device);
    };

    try {
        await lanScanner.scan();
    } catch (e) {}

    deviceList.classList.remove('scanning');
    lanScanner.onDeviceFound = null;
}

function renderDeviceCard(device) {
    const deviceList = document.getElementById('syncDeviceList');
    deviceList.classList.remove('scanning');

    const card = document.createElement('div');
    card.className = 'sync-device-card';
    card.dataset.ip = device.ip;
    card.innerHTML = `
        <div class="sync-device-dot"></div>
        <div class="sync-device-info">
            <div class="sync-device-name">${device.name}</div>
            <div class="sync-device-ip">${device.ip}:${device.port}</div>
        </div>
    `;
    card.addEventListener('click', () => selectDevice(device));
    deviceList.appendChild(card);
}

function selectDevice(device) {
    document.getElementById('syncIpInput').value = device.ip;
    document.querySelectorAll('.sync-device-card').forEach(c => c.classList.remove('selected'));
    const card = document.querySelector(`.sync-device-card[data-ip="${device.ip}"]`);
    if (card) card.classList.add('selected');
}

function closeSyncModal() {
    if (!document.getElementById('syncOverlay').classList.contains('active')) return;
    if (lanSync?.isSyncing()) {
        lanSync.abort();
    }
    document.getElementById('syncOverlay').classList.remove('active');
    history.back();
}

async function startSync() {
    const ip = document.getElementById('syncIpInput').value.trim();
    if (!ip) {
        showToast('请输入 PC 端 IP 地址', 'error');
        return;
    }

    document.getElementById('syncInputSection').style.display = 'none';
    document.getElementById('syncDiscoverySection').style.display = 'none';
    document.getElementById('syncProgressSection').style.display = 'block';
    document.getElementById('syncReportSection').style.display = 'none';

    const syncStartTime = Date.now();

    lanSync.onStateChange = (state) => {
        const statusText = document.getElementById('syncStatusText');
        switch (state) {
            case SyncState.CONNECTING: statusText.innerHTML = `<img src="${linkIcon}" alt="" class="sync-status-icon"> 连接中...`; break;
            case SyncState.SYNCING: statusText.innerHTML = `<img src="${signalIcon}" alt="" class="sync-status-icon"> 同步数据中...`; break;
            case SyncState.VERIFYING: statusText.innerHTML = `<img src="${checkIcon}" alt="" class="sync-status-icon"> 校验数据中...`; break;
            case SyncState.SUCCESS: statusText.innerHTML = `<img src="${celebrateIcon}" alt="" class="sync-status-icon"> 同步完成！`; break;
            case SyncState.PARTIAL: statusText.innerHTML = `<img src="${warningIcon}" alt="" class="sync-status-icon"> 同步部分完成`; break;
            case SyncState.ERROR: statusText.innerHTML = `<img src="${errorIcon}" alt="" class="sync-status-icon"> 同步失败`; break;
        }
    };

    lanSync.onProgress = (current, total, phase) => {
        const fill = document.getElementById('syncProgressFill');
        const pctEl = document.getElementById('syncProgressPct');
        const detail = document.getElementById('syncProgressDetail');
        const stats = document.getElementById('syncProgressStats');
        const timeEl = document.getElementById('syncProgressTime');

        if (total > 0) {
            const pct = Math.round((current / total) * 100);
            fill.style.width = pct + '%';
            pctEl.textContent = pct + '%';
            detail.textContent = phase;

            const elapsed = Date.now() - syncStartTime;
            if (current > 0 && current < total) {
                const eta = Math.round((elapsed / current) * (total - current));
                timeEl.textContent = `已用时 ${formatDuration(elapsed)}，预计剩余 ${formatDuration(eta)}`;
            } else if (current >= total) {
                timeEl.textContent = `总用时 ${formatDuration(elapsed)}`;
            }
        } else {
            fill.style.width = '0%';
            pctEl.textContent = '0%';
            detail.textContent = phase;
            stats.textContent = '';
            timeEl.textContent = '';
        }
    };

    try {
        const report = await lanSync.sync(ip);
        if (report) renderSyncReport(report);
    } catch (e) {
        document.getElementById('syncProgressSection').style.display = 'none';
        document.getElementById('syncInputSection').style.display = 'block';
        if (isCapacitor) document.getElementById('syncDiscoverySection').style.display = '';
        showToast('同步失败：' + e.message, 'error');
    }

    allPromptSets = await getStorage().getPromptSets();
    renderPromptList();
}

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainSeconds = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remainSeconds}s`;
    const hours = Math.floor(minutes / 60);
    const remainMinutes = minutes % 60;
    return `${hours}h ${remainMinutes}m`;
}

function renderSyncReport(report) {
    const section = document.getElementById('syncReportSection');
    section.style.display = 'block';
    document.getElementById('syncProgressSection').style.display = 'none';

    let html = '';

    if (report.added > 0) {
        html += `<div class="sync-report-item"><span class="sync-report-icon"><img src="${successIcon}" alt="" class="report-icon-img"></span><span class="sync-report-text">${report.added} 个集合同步成功</span></div>`;
    }
    if (report.updated > 0) {
        html += `<div class="sync-report-item"><span class="sync-report-icon"><img src="${successIcon}" alt="" class="report-icon-img"></span><span class="sync-report-text">${report.updated} 个集合已更新</span></div>`;
    }
    if (report.skipped > 0) {
        html += `<div class="sync-report-item"><span class="sync-report-icon"><img src="${skipIcon}" alt="" class="report-icon-img"></span><span class="sync-report-text">${report.skipped} 个集合无需更新</span></div>`;
    }
    if (report.imagesDownloaded > 0) {
        html += `<div class="sync-report-item"><span class="sync-report-icon"><img src="${successIcon}" alt="" class="report-icon-img"></span><span class="sync-report-text">${report.imagesDownloaded} 张图片同步成功</span></div>`;
    }
    if (report.imagesSkipped > 0) {
        html += `<div class="sync-report-item"><span class="sync-report-icon"><img src="${skipIcon}" alt="" class="report-icon-img"></span><span class="sync-report-text">${report.imagesSkipped} 张图片已存在</span></div>`;
    }
    for (const name of (report.conflicts || [])) {
        html += `<div class="sync-report-item"><span class="sync-report-icon"><img src="${warningIcon}" alt="" class="report-icon-img"></span><span class="sync-report-text warning">1 个冲突已保留副本：${name}</span></div>`;
    }
    for (const file of (report.imagesFailed || [])) {
        html += `<div class="sync-report-item"><span class="sync-report-icon"><img src="${errorIcon}" alt="" class="report-icon-img"></span><span class="sync-report-text error">${file} 下载失败（可重试）</span></div>`;
    }

    if (report.error) {
        html += `<div class="sync-report-item"><span class="sync-report-icon"><img src="${errorIcon}" alt="" class="report-icon-img"></span><span class="sync-report-text error">${report.error}</span></div>`;
    }

    html += `<div class="sync-report-actions">
        <button class="btn" id="syncCloseReportBtn">关闭</button>
        <button class="btn btn-primary" id="syncRetryBtn">重新同步</button>
    </div>`;

    section.innerHTML = html;

    document.getElementById('syncCloseReportBtn').addEventListener('click', closeSyncModal);
    document.getElementById('syncRetryBtn').addEventListener('click', () => {
        section.style.display = 'none';
        document.getElementById('syncInputSection').style.display = 'block';
    });
}

init();
