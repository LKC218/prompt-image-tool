import { getStorage } from './storage.js';
import { navigate, goBack } from './pc-router.js';
import { showToast, showModal, showConfirmModal, showPromptModal, showContextMenu, closeModal, escapeHtml, showImageViewer } from './pc-utils.js';
import { renderGoalImageIcon, mountGoalImageIcons, closeGoalImagePreview } from './goal-image-preview.js';
import {
    calcTaskTreeStats,
    getParentCheckState,
    setTaskTreeCompletion,
    flattenTasks,
    generateGoalId,
    importGoalImage,
    getGoalImageUrl,
    compressToWebp,
    TASK_PRIORITIES,
    getTaskPriorityLabel,
    TASK_STATUS_EXECUTING,
    isTaskExecuting
} from './goal-utils.js';
import Sortable from 'sortablejs';
import plusIcon from '../assets/icons/plus.svg';
import chevronDownIcon from '../assets/icons/mobile/chevron-down.svg';
import moreIcon from '../assets/icons/more-horizontal.svg';
import renameIcon from '../assets/icons/pencil-line.svg';
import copyIcon from '../assets/icons/copy.svg';
import imageIcon from '../assets/icons/image.svg';
import deleteIcon from '../assets/icons/trash-2.svg';
import gripIcon from '../assets/icons/grip-vertical.svg';
import checkIcon from '../assets/icons/check.svg';
import rabbitTip from '../assets/mobile/mascots/rabbit-tip.png';

let project = null;
let tasks = [];
let flatTasks = [];
let expandedIds = new Set();
let projectId = null;
let pageElRef = null;
let previewCleanup = null;
let imageManagerCurrent = null;
let imageManagerObserver = null;

if (typeof document !== 'undefined') {
    document.addEventListener('paste', handleManagerPaste);
}

function iconImg(icon, alt = '') {
    return `<img src="${icon}" alt="${escapeHtml(alt)}" aria-hidden="${alt ? 'false' : 'true'}">`;
}

function render(params = {}) {
    return `
        <div class="pc-goal-detail-page">
            <div class="pc-goal-detail-header">
                <button class="pc-goal-detail-back" id="pcGoalDetailBack" aria-label="返回">${iconImg(chevronDownIcon)}</button>
                <h2 class="pc-goal-detail-title" id="pcGoalDetailTitle">加载中...</h2>
                <div class="pc-goal-detail-actions">
                    <button class="pc-btn pc-btn-primary pc-btn-sm" id="pcGoalAddTask">
                        <span class="pc-btn-icon">${iconImg(plusIcon)}</span>
                        <span>添加任务</span>
                    </button>
                </div>
            </div>
            <div class="pc-goal-detail-progress" id="pcGoalDetailProgress"></div>
            <div id="pcGoalTaskList" class="pc-goal-task-list"></div>
        </div>
    `;
}

async function mount(pageEl, params = {}) {
    pageElRef = pageEl;
    projectId = params.id;
    if (!projectId) {
        showToast('项目不存在', 'error');
        navigate('/goals');
        return;
    }
    await loadData();
    setupEvents(pageEl);
}

function unmount(pageEl) {
    const container = pageEl?.querySelector('#pcGoalTaskList');
    if (container) destroySortables(container);
    if (previewCleanup) {
        previewCleanup.destroy();
        previewCleanup = null;
    }
    closeGoalImagePreview();
    pageElRef = null;
    projectId = null;
}

async function loadData() {
    try {
        const storage = getStorage();
        project = await storage.getGoalProject(projectId);
        tasks = await storage.getGoalTasks(projectId);
        flatTasks = flattenTasks(tasks);
        expandedIds = new Set(flatTasks.map(t => t.id));
        renderHeader();
        renderProgress();
        renderTasks();
    } catch (e) {
        console.error('loadData error:', e);
        showToast('加载任务失败', 'error');
    }
}

function renderHeader() {
    const titleEl = pageElRef?.querySelector('#pcGoalDetailTitle');
    if (titleEl && project) {
        titleEl.textContent = project.name;
        titleEl.title = project.name;
    }
}

function renderProgress() {
    const el = pageElRef?.querySelector('#pcGoalDetailProgress');
    if (!el) return;
    const stats = calcTaskTreeStats(tasks);
    el.innerHTML = `
        <div class="pc-goal-detail-progress-bar">
            <div class="pc-goal-detail-progress-fill" style="width: ${stats.progress}%"></div>
        </div>
        <span class="pc-goal-detail-progress-text">${stats.completed}/${stats.total} 完成 · ${stats.progress}%</span>
    `;
}

function renderTasks() {
    const container = pageElRef?.querySelector('#pcGoalTaskList');
    if (!container) return;

    destroySortables(container);

    if (tasks.length === 0) {
        container.innerHTML = `
            <div class="pc-empty-state pc-goal-tasks-empty">
                <span class="pc-empty-icon">${iconImg(rabbitTip, '目标计划')}</span>
                <span class="pc-empty-text">还没有任务，点击右上角添加第一个任务吧</span>
            </div>
        `;
        return;
    }

    container.innerHTML = renderTaskTree(tasks, 0);
    bindTaskItems(container);
    bindImagePreviews(container);
    bindSortable(container);
    container.querySelectorAll('.pc-goal-task-children').forEach(bindSortable);
}

function renderTaskTree(tree, depth) {
    return tree.map(task => {
        const isExpanded = expandedIds.has(task.id);
        const hasChildren = task.children && task.children.length > 0;
        const checkState = hasChildren ? getParentCheckState(task.children) : (task.completed ? 'checked' : 'unchecked');
        const isIndeterminate = checkState === 'indeterminate';
        const isChecked = checkState === 'checked';

        return `
            <div class="pc-goal-task-item ${isExpanded ? 'is-expanded' : ''}" data-task-id="${escapeHtml(task.id)}" data-depth="${depth}" style="--task-depth: ${depth}">
                <div class="pc-goal-task-row" data-executing="${isTaskExecuting(task) ? 'true' : 'false'}">
                    ${renderTaskPriority(task)}
                    <button class="pc-goal-task-drag-handle" type="button" aria-label="拖动排序" data-task-id="${escapeHtml(task.id)}">
                        ${iconImg(gripIcon)}
                    </button>
                    <button class="pc-goal-task-toggle ${hasChildren ? '' : 'is-leaf'}" type="button" aria-label="${isExpanded ? '折叠' : '展开'}" data-task-id="${escapeHtml(task.id)}">
                        ${hasChildren ? iconImg(chevronDownIcon) : ''}
                    </button>
                    <label class="pc-goal-task-check ${isIndeterminate ? 'is-indeterminate' : ''} ${isChecked ? 'is-checked' : ''}">
                        <input type="checkbox" data-task-id="${escapeHtml(task.id)}" ${isChecked ? 'checked' : ''}>
                    </label>
                    <div class="pc-goal-task-content">
                        <span class="pc-goal-task-title">${escapeHtml(task.title)}</span>
                        ${hasChildren && !isExpanded ? `<span class="pc-goal-task-child-count">${task.children.length}</span>` : ''}
                        ${renderGoalImageIcon(task)}
                    </div>
                    <button class="pc-icon-btn pc-goal-task-action" data-action="add-child" data-task-id="${escapeHtml(task.id)}" title="添加子任务">
                        ${iconImg(plusIcon)}
                    </button>
                    <button class="pc-icon-btn pc-goal-task-action" data-action="more" data-task-id="${escapeHtml(task.id)}" title="更多">
                        ${iconImg(moreIcon)}
                    </button>
                </div>
                ${hasChildren && isExpanded ? `
                    <div class="pc-goal-task-children">
                        ${renderTaskTree(task.children, depth + 1)}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function renderTaskPriority(task) {
    const priority = task.priority || '';
    const label = getTaskPriorityLabel(priority);
    const title = label ? `优先级：${label}` : '无优先级';
    return `<span class="pc-goal-task-priority" data-priority="${escapeHtml(priority)}" title="${escapeHtml(title)}"></span>`;
}

function bindTaskItems(container) {
    container.querySelectorAll('.pc-goal-task-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.taskId;
            if (expandedIds.has(id)) expandedIds.delete(id);
            else expandedIds.add(id);
            renderTasks();
        });
    });

    container.querySelectorAll('.pc-goal-task-check input').forEach(input => {
        input.addEventListener('change', () => {
            toggleTask(input.dataset.taskId, input.checked);
        });
    });

    container.querySelectorAll('.pc-goal-task-action').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = btn.dataset.action;
            const id = btn.dataset.taskId;
            if (action === 'add-child') addChildTask(id);
            else if (action === 'more') showTaskMenu(id, btn);
        });
    });

    container.querySelectorAll('.pc-goal-task-title').forEach(el => {
        el.addEventListener('dblclick', () => {
            const id = el.closest('.pc-goal-task-item').dataset.taskId;
            editTaskTitle(id);
        });
    });
}

function bindImagePreviews(container) {
    if (previewCleanup) {
        previewCleanup.destroy();
        previewCleanup = null;
    }
    const storage = getStorage();
    previewCleanup = mountGoalImageIcons(container, {
        getTask: (id) => flatTasks.find(t => t.id === id),
        getImageUrl: (img) => {
            if (img.data) return img.data;
            return getGoalImageUrl(storage, img.path);
        },
        onOpenViewer: (task, index) => {
            const img = task.images?.[index];
            if (!img) return;
            const url = img.data || getGoalImageUrl(storage, img.path);
            if (url) showImageViewer(url);
        }
    });
}

function destroySortables(container) {
    if (container._sortable) {
        container._sortable.destroy();
        container._sortable = null;
    }
    container.querySelectorAll('.pc-goal-task-children').forEach(child => {
        if (child._sortable) {
            child._sortable.destroy();
            child._sortable = null;
        }
    });
}

function bindSortable(container) {
    if (container._sortable) return;
    container._sortable = Sortable.create(container, {
        group: {
            name: 'goal-tasks',
            pull: true,
            put: true
        },
        handle: '.pc-goal-task-drag-handle',
        animation: 150,
        ghostClass: 'pc-goal-task-ghost',
        chosenClass: 'pc-goal-task-chosen',
        dragClass: 'pc-goal-task-drag',
        onMove: (evt) => {
            // 禁止将父任务拖入自己的子树中
            return !evt.dragged.contains(evt.to);
        },
        onEnd: (evt) => {
            if (evt.to === evt.from && evt.oldIndex === evt.newIndex) return;
            const rootContainer = pageElRef?.querySelector('#pcGoalTaskList');
            if (!rootContainer) return;
            tasks = buildTaskTreeFromDOM(rootContainer);
            flatTasks = flattenTasks(tasks);
            syncParentCompletion(tasks);
            renderTasks();
            saveTasks();
        }
    });
}

function buildTaskTreeFromDOM(container) {
    const result = [];
    container.querySelectorAll(':scope > .pc-goal-task-item').forEach((item, index) => {
        const id = item.dataset.taskId;
        const task = flatTasks.find(t => t.id === id);
        if (!task) return;
        const cloned = { ...task };
        const childrenContainer = item.querySelector(':scope > .pc-goal-task-children');
        if (childrenContainer) {
            cloned.children = buildTaskTreeFromDOM(childrenContainer);
        } else {
            cloned.children = task.children ? task.children.map(c => ({ ...c })) : [];
        }
        cloned.order = index;
        result.push(cloned);
    });
    return result;
}

function findTask(id, list = tasks) {
    for (const t of list) {
        if (t.id === id) return t;
        const found = findTask(id, t.children);
        if (found) return found;
    }
    return null;
}

function clearExecutingStatus(task) {
    if (!task) return;
    task.status = '';
    for (const child of task.children || []) {
        clearExecutingStatus(child);
    }
}

function syncParentCompletion(list) {
    for (const task of list) {
        if (task.children && task.children.length > 0) {
            syncParentCompletion(task.children);
            task.completed = task.children.every(c => c.completed);
        }
    }
}

async function saveTasks() {
    try {
        const storage = getStorage();
        await storage.updateGoalTasks(projectId, tasks);
        flatTasks = flattenTasks(tasks);
        renderProgress();
    } catch (e) {
        console.error('saveTasks error:', e);
        showToast('保存失败', 'error');
    }
}

function toggleTask(id, checked) {
    const task = findTask(id);
    if (!task) return;

    const hasChildren = task.children && task.children.length > 0;

    if (hasChildren) {
        // 父任务：级联设置所有后代
        setTaskTreeCompletion(task, checked);
    } else {
        // 叶子任务：仅改变自己
        task.completed = checked;
    }

    if (checked) {
        clearExecutingStatus(task);
    }

    syncParentCompletion(tasks);
    renderTasks();
    saveTasks();
}

async function addTask() {
    showPromptModal('请输入任务名称', '新任务', async (title) => {
        const newTask = {
            id: generateGoalId(),
            title,
            completed: false,
            order: tasks.length,
            priority: '',
            status: '',
            images: [],
            children: []
        };
        tasks.push(newTask);
        expandedIds.add(newTask.id);
        renderTasks();
        await saveTasks();
    });
}

async function addChildTask(parentId) {
    const parent = findTask(parentId);
    if (!parent) return;
    showPromptModal('请输入子任务名称', '新子任务', async (title) => {
        if (!parent.children) parent.children = [];
        const newTask = {
            id: generateGoalId(),
            title,
            completed: false,
            order: parent.children.length,
            priority: '',
            status: '',
            images: [],
            children: []
        };
        parent.children.push(newTask);
        expandedIds.add(parentId);
        expandedIds.add(newTask.id);
        syncParentCompletion(tasks);
        renderTasks();
        await saveTasks();
    });
}

async function editTaskTitle(id) {
    const task = findTask(id);
    if (!task) return;
    showPromptModal('编辑任务名称', task.title, async (title) => {
        task.title = title;
        renderTasks();
        await saveTasks();
    });
}

async function setTaskPriority(id, priority) {
    const task = findTask(id);
    if (!task) return;
    task.priority = priority === 'none' ? '' : (priority || '');
    renderTasks();
    await saveTasks();
    const label = getTaskPriorityLabel(task.priority);
    showToast(label ? `优先级已设为「${label}」` : '优先级已取消');
}

async function toggleTaskExecuting(id) {
    const task = findTask(id);
    if (!task) return;
    const executing = !isTaskExecuting(task);
    task.status = executing ? TASK_STATUS_EXECUTING : '';
    renderTasks();
    await saveTasks();
    showToast(executing ? '已标记为执行中' : '已取消执行中');
}

async function deleteTask(id) {
    showConfirmModal('确定删除这个任务吗？子任务也会被一并删除。', async () => {
        tasks = removeTaskFromList(tasks, id);
        syncParentCompletion(tasks);
        renderTasks();
        await saveTasks();
    });
}

function removeTaskFromList(list, id) {
    return list.filter(t => t.id !== id).map(t => ({
        ...t,
        children: removeTaskFromList(t.children || [], id)
    }));
}

function regenerateTaskIds(taskList) {
    for (const task of taskList) {
        task.id = generateGoalId();
        if (task.children && task.children.length > 0) {
            regenerateTaskIds(task.children);
        }
    }
    return taskList;
}

function copyTask(id) {
    const copyRecursively = (list, parentId = '') => {
        for (let i = 0; i < list.length; i++) {
            const t = list[i];
            if (t.id === id) {
                const copied = JSON.parse(JSON.stringify(t));
                copied.title = `${copied.title} 副本`;
                copied.completed = false;
                copied.order = (list.length + 1) * 10;
                copied.children = regenerateTaskIds(copied.children || []);
                copied.id = generateGoalId();
                list.splice(i + 1, 0, copied);
                return true;
            }
            if (t.children && t.children.length > 0) {
                if (copyRecursively(t.children, t.id)) return true;
            }
        }
        return false;
    };

    if (copyRecursively(tasks)) {
        syncParentCompletion(tasks);
        renderTasks();
        saveTasks();
        showToast('任务复制成功');
    }
}

async function showTaskMenu(id, anchorEl) {
    const task = findTask(id);
    if (!task || !anchorEl) return;

    const hasImages = task.images && task.images.length > 0;
    const rect = anchorEl.getBoundingClientRect();
    const currentPriority = task.priority || '';
    const priorityChildren = [
        { action: 'priority-none', icon: currentPriority === '' ? iconImg(checkIcon) : '', label: '无' },
        ...TASK_PRIORITIES.map(p => ({
            action: `priority-${p.key}`,
            icon: currentPriority === p.key ? iconImg(checkIcon) : '',
            label: p.label
        }))
    ];

    const executing = isTaskExecuting(task);

    const items = [
        { action: 'add-child', icon: iconImg(plusIcon), label: '添加子任务' },
        { action: 'rename', icon: iconImg(renameIcon), tone: 'rename', label: '重命名' },
        { action: 'copy', icon: iconImg(copyIcon), tone: 'copy', label: '复制' },
        { action: 'set-priority', icon: iconImg(moreIcon), label: '设置优先级', children: priorityChildren },
        { action: 'toggle-executing', icon: '', label: executing ? '取消执行中' : '标记为执行中' },
        { action: 'image-manager', icon: iconImg(imageIcon), label: '图片管理' }
    ];
    if (hasImages) {
        items.push({ action: 'view-images', icon: iconImg(imageIcon), label: '查看图片' });
    }
    items.push({ action: 'delete', icon: iconImg(deleteIcon), tone: 'delete', label: '删除', danger: true });

    const action = await showContextMenu(rect.right + 8, rect.bottom + 8, items, { anchor: anchorEl, source: 'more' });

    if (action === 'add-child') addChildTask(id);
    else if (action === 'rename') editTaskTitle(id);
    else if (action === 'copy') copyTask(id);
    else if (action === 'toggle-executing') toggleTaskExecuting(id);
    else if (action === 'image-manager') showTaskImageManager(id);
    else if (action === 'view-images') viewTaskImages(id);
    else if (action === 'delete') deleteTask(id);
    else if (action && action.startsWith('priority-')) setTaskPriority(id, action.replace('priority-', ''));
}

function viewTaskImages(id) {
    const task = findTask(id);
    if (!task || !task.images || task.images.length === 0) return;
    const storage = getStorage();
    const urls = task.images.map(img => img.data || getGoalImageUrl(storage, img.path)).filter(Boolean);
    if (urls.length > 0) {
        showImageViewer({ urls, index: 0 });
    }
}

async function importImageDataUrl(dataUrl, name, id, onAdded) {
    try {
        const compressed = await compressToWebp(dataUrl);
        const storage = getStorage();
        const img = await importGoalImage(storage, projectId, id, compressed, name);
        const task = findTask(id);
        if (task) {
            if (!task.images) task.images = [];
            task.images.push(img);
            if (onAdded) onAdded();
            renderTasks();
            await saveTasks();
            showToast('图片添加成功');
        }
    } catch (e) {
        console.error('importImageDataUrl error:', e);
        showToast('添加图片失败', 'error');
    }
}

async function addTaskImage(id, onAdded) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
            await importImageDataUrl(reader.result, file.name, id, onAdded);
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

function handleManagerPaste(e) {
    if (!imageManagerCurrent) return;
    const overlay = document.getElementById('pcModalOverlay');
    if (!overlay?.classList.contains('pc-modal-active')) return;
    if (!overlay.querySelector('.pc-goal-image-manager-body')) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;

    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
            e.preventDefault();
            const blob = item.getAsFile();
            const name = blob?.name || 'pasted-image.png';
            const reader = new FileReader();
            reader.onload = async () => {
                const task = findTask(imageManagerCurrent.taskId);
                const beforeCount = (task?.images || []).length;
                await importImageDataUrl(reader.result, name, imageManagerCurrent.taskId, () => {
                    imageManagerCurrent.refresh();
                    if ((task?.images || []).length > beforeCount) {
                        setTimeout(() => {
                            const modal = document.getElementById('pcModalContent');
                            const body = modal?.querySelector('.pc-goal-image-manager-body');
                            if (body) body.scrollTop = body.scrollHeight;
                        }, 50);
                    }
                });
            };
            reader.readAsDataURL(blob);
            break;
        }
    }
}

function observeImageManagerClose() {
    if (imageManagerObserver) imageManagerObserver.disconnect();
    const overlay = document.getElementById('pcModalOverlay');
    if (!overlay) return;
    imageManagerObserver = new MutationObserver(() => {
        if (!overlay.classList.contains('pc-modal-active')) {
            imageManagerCurrent = null;
            imageManagerObserver.disconnect();
            imageManagerObserver = null;
        }
    });
    imageManagerObserver.observe(overlay, { attributes: true, attributeFilter: ['class'] });
}

function showTaskImageManager(id) {
    const task = findTask(id);
    if (!task) return;

    const storage = getStorage();

    function renderManagerContent() {
        const images = task.images || [];
        const emptyState = images.length === 0 ? `
            <div class="pc-goal-image-manager-empty">
                <span class="pc-empty-icon">${iconImg(rabbitTip, '图片管理')}</span>
                <span class="pc-empty-text">暂无图片，点击下方按钮添加或粘贴图片</span>
            </div>
        ` : '';
        const grid = images.length > 0 ? `
            <div class="pc-goal-image-manager-grid">
                ${images.map((img, index) => {
                    const url = img.data || getGoalImageUrl(storage, img.path);
                    return `
                        <div class="pc-goal-image-manager-item" data-index="${index}">
                            <img src="${url}" alt="任务图片" loading="lazy">
                            <button class="pc-goal-image-manager-delete" type="button" aria-label="删除图片" data-index="${index}">
                                ${iconImg(deleteIcon)}
                            </button>
                        </div>
                    `;
                }).join('')}
            </div>
        ` : '';
        return `
            <h3>图片管理</h3>
            <div class="pc-goal-image-manager-body">
                ${emptyState}
                ${grid}
            </div>
            <div class="pc-modal-actions">
                <button class="pc-btn pc-btn-secondary" id="pcGoalImageManagerAdd">添加图片</button>
                <button class="pc-btn pc-btn-primary" id="pcGoalImageManagerClose">完成</button>
            </div>
        `;
    }

    const modal = showModal(renderManagerContent());

    async function refresh() {
        modal.innerHTML = renderManagerContent();
        bindManagerEvents();
    }

    imageManagerCurrent = { taskId: id, refresh };
    observeImageManagerClose();

    function bindManagerEvents() {
        modal.querySelector('#pcGoalImageManagerClose')?.addEventListener('click', closeModal);
        modal.querySelector('#pcGoalImageManagerAdd')?.addEventListener('click', () => {
            const beforeCount = (task.images || []).length;
            addTaskImage(id, () => {
                refresh();
                if ((task.images || []).length > beforeCount) {
                    setTimeout(() => {
                        const body = modal.querySelector('.pc-goal-image-manager-body');
                        if (body) body.scrollTop = body.scrollHeight;
                    }, 50);
                }
            });
        });
        modal.querySelectorAll('.pc-goal-image-manager-delete').forEach(btn => {
            btn.addEventListener('click', async () => {
                const index = Number(btn.dataset.index);
                showConfirmModal('确定删除这张图片吗？', async () => {
                    task.images.splice(index, 1);
                    renderTasks();
                    await saveTasks();
                    showToast('图片已删除');
                    refresh();
                });
            });
        });
        modal.querySelectorAll('.pc-goal-image-manager-item img').forEach(img => {
            img.addEventListener('click', () => {
                const item = img.closest('.pc-goal-image-manager-item');
                const index = Number(item?.dataset.index || 0);
                const urls = task.images.map(img => img.data || getGoalImageUrl(storage, img.path)).filter(Boolean);
                if (urls.length > 0) {
                    showImageViewer({ urls, index });
                }
            });
        });
    }

    bindManagerEvents();
}

function setupEvents(pageEl) {
    pageEl.querySelector('#pcGoalDetailBack')?.addEventListener('click', () => goBack());
    pageEl.querySelector('#pcGoalAddTask')?.addEventListener('click', addTask);
}

export { render, mount, unmount };
