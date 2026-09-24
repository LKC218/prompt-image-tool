import { getStorage } from '../core/storage.js';
import { navigate, goBack, updateRouteParams } from './pc-router.js';
import { showToast, showModal, showConfirmModal, showPromptModal, showContextMenu, closeModal, escapeHtml, showImageViewer } from './pc-utils.js';
import { renderGoalImageIcon, mountGoalImageIcons, closeGoalImagePreview } from '../goal/goal-image-preview.js';
import {
    calcTaskTreeStats,
    getParentCheckState,
    setTaskTreeCompletion,
    flattenTasks,
    generateGoalId,
    importGoalImage,
    getGoalImageUrl,
    compressToWebp,
    getGoalThumbUrl,
    releaseGoalThumbUrls,
    getTaskPriorityLabel,
    TASK_STATUS_EXECUTING,
    isTaskExecuting,
    sortTasksByCompletion,
    moveTaskInTree,
    buildTaskContextMenuItems
} from '../goal/goal-utils.js';
import {
    buildMindmapGraph,
    layoutMindmap,
    normalizeMindmapLinks,
    readMindmapLinks,
    writeMindmapLinks,
    readMindmapView,
    writeMindmapView,
    consumeMindmapOpenView,
    normalizeMindmapViewMode,
    resolveInitialMindmapView,
    toggleMindmapLink,
    hierarchyPathToRoot,
    mindmapPriorityClass,
    zoomMindmapAtPoint,
    fitMindmapTransform,
    focusMindmapTransform,
    formatMindmapZoomLabel,
    clampMindmapScale,
    readMindmapMaximize,
    writeMindmapMaximize,
    assignMindmapBranchColors,
    orthogonalEdgePath,
    buildMindmapHierarchyEdgePaths,
    annotateMindmapProgress,
    filterIncompleteMindmap,
    interpolateMindmapTransform,
    stepMindmapInertia,
    estimateMindmapPanVelocity,
    resolveMindmapDropTarget,
    MINDMAP_CAMERA_DURATION,
    MINDMAP_ROOT_ID,
    MINDMAP_DEFAULT_TRANSFORM
} from '../goal/goal-mindmap-core.js';
import Sortable from 'sortablejs';
import plusIcon from '../../assets/icons/plus.svg';
import chevronDownIcon from '../../assets/icons/mobile/chevron-down.svg';
import moreIcon from '../../assets/icons/more-horizontal.svg';
import renameIcon from '../../assets/icons/pencil-line.svg';
import copyIcon from '../../assets/icons/copy.svg';
import imageIcon from '../../assets/icons/image.svg';
import deleteIcon from '../../assets/icons/trash-2.svg';
import gripIcon from '../../assets/icons/grip-vertical.svg';
import checkIcon from '../../assets/icons/check.svg';
import mapIcon from '../../assets/icons/map.svg';
import rabbitTip from '../../assets/mobile/mascots/rabbit-tip.png';

let project = null;
let tasks = [];
let flatTasks = [];
let expandedIds = new Set();
let projectId = null;
let pageElRef = null;
let previewCleanup = null;
let imageManagerCurrent = null;
let imageManagerObserver = null;
let viewMode = 'list';
let mindmapLinks = [];
let mindmapGraph = null;
let mindmapLayoutResult = null;
let mindmapTransform = { ...MINDMAP_DEFAULT_TRANSFORM };
let mindmapLinkMode = false;
let mindmapSelectedId = null;
let mindmapPendingFromId = null;
let mindmapPanState = null;
let mindmapMaximized = false;
let mindmapEscHandler = null;
let mindmapOnlyIncomplete = false;
let mindmapCameraRaf = 0;
let mindmapInertiaRaf = 0;
let mindmapPanSamples = [];
let mountParams = {};
let selectedTaskId = null;
let pendingMindmapFocusId = null;
let mindmapFitToken = 0;
let mindmapDragState = null;
let mindmapSuppressClick = false;
let mindmapDragWindowBound = false;

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
                    <div class="pc-goal-view-switch" role="tablist" aria-label="视图切换">
                        <button type="button" class="pc-goal-view-switch-btn" data-view="list" id="pcGoalViewList" role="tab" aria-label="列表视图">
                            <span class="pc-goal-view-switch-icon" aria-hidden="true">
                                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
                                    <path d="M3 4h10M3 8h10M3 12h10"></path>
                                </svg>
                            </span>
                            <span>列表</span>
                        </button>
                        <button type="button" class="pc-goal-view-switch-btn" data-view="mindmap" id="pcGoalViewMindmap" role="tab" aria-label="思维导图视图">
                            <span class="pc-goal-view-switch-icon" aria-hidden="true">
                                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="4" cy="4" r="1.5"></circle>
                                    <circle cx="12" cy="8" r="1.5"></circle>
                                    <circle cx="4" cy="12" r="1.5"></circle>
                                    <path d="M5.4 4.6 10.3 7.2M5.4 11.4 10.3 8.8"></path>
                                </svg>
                            </span>
                            <span>思维导图</span>
                        </button>
                    </div>
                    <button class="pc-btn pc-btn-primary pc-btn-sm" id="pcGoalAddTask">
                        <span class="pc-btn-icon">${iconImg(plusIcon)}</span>
                        <span>添加任务</span>
                    </button>
                </div>
            </div>
            <div class="pc-goal-detail-progress" id="pcGoalDetailProgress"></div>
            <div id="pcGoalTaskList" class="pc-goal-task-list"></div>
            <div id="pcGoalMindmap" class="pc-goal-mindmap" hidden></div>
        </div>
    `;
}

async function mount(pageEl, params = {}) {
    pageElRef = pageEl;
    projectId = params.id;
    mountParams = { ...params };
    if (!projectId) {
        showToast('项目不存在', 'error');
        navigate('/goals');
        return;
    }
    mindmapLinkMode = false;
    mindmapSelectedId = null;
    mindmapPendingFromId = null;
    mindmapTransform = { ...MINDMAP_DEFAULT_TRANSFORM };
    selectedTaskId = null;
    pendingMindmapFocusId = null;
    mindmapFitToken = 0;
    await loadData();
    setupEvents(pageEl);
    applyViewMode({
        focusTaskId: pendingMindmapFocusId || undefined,
        refit: true
    });
    bindMindmapEscHandler();
}

function unmount(pageEl) {
    const container = pageEl?.querySelector('#pcGoalTaskList');
    if (container) destroySortables(container);
    if (previewCleanup) {
        previewCleanup.destroy();
        previewCleanup = null;
    }
    closeGoalImagePreview();
    releaseGoalThumbUrls();
    unbindMindmapEscHandler();
    cancelMindmapCameraAnimation();
    cancelMindmapInertia();
    if (pageElRef) {
        pageElRef.classList.remove('is-mindmap-maximized');
        pageElRef.classList.remove('is-view-mindmap');
        delete pageElRef.dataset.view;
        pageElRef.querySelector('#pcGoalMindmap')?.classList.remove('is-maximized');
        const detailPage = pageElRef.querySelector('.pc-goal-detail-page');
        detailPage?.classList.remove('is-view-mindmap');
        if (detailPage) delete detailPage.dataset.view;
    }
    document.body.classList.remove('pc-goal-mindmap-max-open');
    unbindMindmapDragWindow();
    finishMindmapDrag({ commit: false });
    pageElRef = null;
    projectId = null;
    mindmapGraph = null;
    mindmapLayoutResult = null;
    mindmapPanState = null;
    mindmapPanSamples = [];
    mindmapMaximized = false;
    mountParams = {};
    selectedTaskId = null;
    pendingMindmapFocusId = null;
    mindmapFitToken = 0;
}

async function loadData() {
    try {
        const storage = getStorage();
        project = await storage.getGoalProject(projectId);
        tasks = await storage.getGoalTasks(projectId);
        flatTasks = flattenTasks(tasks);
        expandedIds = new Set(flatTasks.map(t => t.id));
        mindmapLinks = normalizeMindmapLinks(readMindmapLinks(window.localStorage, projectId), new Set(flatTasks.map(t => t.id)));
        const openView = consumeMindmapOpenView(window.localStorage, projectId);
        const routeView = normalizeMindmapViewMode(mountParams?.view);
        viewMode = resolveInitialMindmapView({
            routeView,
            openView,
            storedView: readMindmapView(window.localStorage, projectId, 'list'),
            fallback: 'list'
        });
        if (routeView) {
            writeMindmapView(window.localStorage, projectId, routeView);
        }
        mindmapMaximized = viewMode === 'mindmap' && readMindmapMaximize(window.localStorage, projectId, false);
        pendingMindmapFocusId = mountParams?.focusTaskId || mountParams?.locateTask || null;
        if (pendingMindmapFocusId) {
            selectedTaskId = pendingMindmapFocusId;
            mindmapSelectedId = pendingMindmapFocusId;
        }
        renderHeader();
        renderProgress();
        renderTasks();
        if (viewMode === 'mindmap') renderMindmap();
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
            <div class="pc-goal-task-item ${isExpanded ? 'is-expanded' : ''} ${selectedTaskId === task.id ? 'is-selected' : ''}" data-task-id="${escapeHtml(task.id)}" data-depth="${depth}" style="--task-depth: ${depth}">
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
                <div class="pc-goal-task-children" data-parent-id="${escapeHtml(task.id)}">
                    ${isExpanded && hasChildren ? renderTaskTree(task.children, depth + 1) : ''}
                </div>
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
    container.querySelectorAll('.pc-goal-task-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = item.dataset.taskId;
            if (!id) return;
            selectedTaskId = id;
            container.querySelectorAll('.pc-goal-task-item.is-selected').forEach(el => el.classList.remove('is-selected'));
            item.classList.add('is-selected');
        });
    });

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
        onOpenViewer: (task, index, sourceEl) => {
            const img = task.images?.[index];
            if (!img) return;
            const url = img.data || getGoalImageUrl(storage, img.path);
            if (url) showImageViewer({ src: url, sourceEl });
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

let listDropTarget = null;
let listExpandTimer = 0;

function parentTaskIdFromEl(el) {
    const host = el?.parentElement;
    if (!host?.classList?.contains('pc-goal-task-children')) return '';
    return host.dataset.parentId || host.closest('.pc-goal-task-item')?.dataset.taskId || '';
}

function clearListDropHints() {
    pageElRef?.querySelectorAll('.pc-goal-task-item.is-drop-parent, .pc-goal-task-item.is-drop-before, .pc-goal-task-item.is-drop-after')
        .forEach(el => el.classList.remove('is-drop-parent', 'is-drop-before', 'is-drop-after'));
    pageElRef?.querySelector('#pcGoalTaskList')?.classList.remove('is-drop-root');
    if (listExpandTimer) {
        clearTimeout(listExpandTimer);
        listExpandTimer = 0;
    }
}

function bindSortable(container) {
    if (container._sortable) return;
    const isRoot = container.id === 'pcGoalTaskList';
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
        emptyInsertThreshold: 24,
        onStart: () => {
            const list = pageElRef?.querySelector('#pcGoalTaskList');
            list?.classList.add('is-dragging');
            listDropTarget = null;
        },
        onMove: (evt) => {
            const dragged = evt.dragged;
            if (dragged.contains(evt.to)) return false;
            if (evt.related && (dragged.contains(evt.related) || evt.related.contains?.(dragged))) return false;

            clearListDropHints();
            const list = pageElRef?.querySelector('#pcGoalTaskList');
            list?.classList.add('is-dragging');

            const related = evt.related;
            const relatedItem = related?.closest?.('.pc-goal-task-item')
                || (related?.classList?.contains('pc-goal-task-item') ? related : null);
            const relatedChildren = related?.classList?.contains('pc-goal-task-children') ? related : null;

            if (relatedChildren && relatedChildren.dataset.parentId) {
                listDropTarget = { type: 'child', parentId: relatedChildren.dataset.parentId };
                relatedChildren.closest('.pc-goal-task-item')?.classList.add('is-drop-parent');
                return true;
            }

            if (relatedItem && !dragged.contains(relatedItem)) {
                const row = relatedItem.querySelector(':scope > .pc-goal-task-row');
                const rect = row?.getBoundingClientRect();
                const clientY = evt.originalEvent?.clientY ?? (rect ? rect.top + rect.height / 2 : 0);
                const rel = rect && rect.height > 0 ? (clientY - rect.top) / rect.height : 0.5;
                const id = relatedItem.dataset.taskId;
                const parentId = parentTaskIdFromEl(relatedItem);
                if (rel < 0.28) {
                    listDropTarget = { type: 'sibling', parentId, beforeId: id };
                    relatedItem.classList.add('is-drop-before');
                } else if (rel > 0.72) {
                    listDropTarget = { type: 'sibling', parentId, afterId: id };
                    relatedItem.classList.add('is-drop-after');
                } else {
                    listDropTarget = { type: 'child', parentId: id };
                    relatedItem.classList.add('is-drop-parent');
                    if (!expandedIds.has(id) && relatedItem.querySelector(':scope > .pc-goal-task-toggle:not(.is-leaf)')) {
                        if (!listExpandTimer) {
                            listExpandTimer = setTimeout(() => {
                                listExpandTimer = 0;
                                expandedIds.add(id);
                                relatedItem.classList.add('is-expanded');
                            }, 320);
                        }
                    } else {
                        relatedItem.classList.add('is-expanded');
                    }
                }
                return true;
            }

            if (isRoot || evt.to?.id === 'pcGoalTaskList') {
                listDropTarget = { type: 'root' };
                list?.classList.add('is-drop-root');
            } else if (evt.to?.dataset?.parentId) {
                listDropTarget = { type: 'child', parentId: evt.to.dataset.parentId };
            }
            return true;
        },
        onEnd: (evt) => {
            clearListDropHints();
            pageElRef?.querySelector('#pcGoalTaskList')?.classList.remove('is-dragging');
            const target = listDropTarget;
            listDropTarget = null;
            const dragId = evt.item?.dataset?.taskId;
            if (!dragId) return;
            if (target) {
                const next = moveTaskInTree(tasks, dragId, target);
                if (next !== tasks) {
                    tasks = next;
                    if (target.type === 'child' && target.parentId) expandedIds.add(target.parentId);
                    if (target.type === 'sibling' && target.parentId) expandedIds.add(target.parentId);
                }
            } else if (evt.to === evt.from && evt.oldIndex === evt.newIndex) {
                return;
            } else {
                const rootContainer = pageElRef?.querySelector('#pcGoalTaskList');
                if (!rootContainer) return;
                tasks = buildTaskTreeFromDOM(rootContainer);
            }
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
        const renderedKids = childrenContainer ? childrenContainer.querySelectorAll(':scope > .pc-goal-task-item') : [];
        if (childrenContainer && renderedKids.length > 0) {
            cloned.children = buildTaskTreeFromDOM(childrenContainer);
        } else if (childrenContainer && item.classList.contains('is-expanded')) {
            cloned.children = [];
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
        if (viewMode === 'mindmap') renderMindmap();
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
    tasks = sortTasksByCompletion(tasks);
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
        tasks = sortTasksByCompletion(tasks);
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
        tasks = sortTasksByCompletion(tasks);
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
        tasks = sortTasksByCompletion(tasks);
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
        tasks = sortTasksByCompletion(tasks);
        renderTasks();
        saveTasks();
        showToast('任务复制成功');
    }
}

async function showTaskMenu(id, anchorEl, options = {}) {
    const task = findTask(id);
    if (!task || !anchorEl) return;

    const hasImages = task.images && task.images.length > 0;
    const rect = anchorEl.getBoundingClientRect();
    const fromMindmap = options.source === 'mindmap';
    const iconByAction = {
        'toggle-complete': iconImg(checkIcon),
        'toggle-executing': '',
        'add-child': iconImg(plusIcon),
        'rename': iconImg(renameIcon),
        'copy': iconImg(copyIcon),
        'set-priority': iconImg(moreIcon),
        'import-image': iconImg(imageIcon),
        'image-manager': iconImg(imageIcon),
        'view-images': iconImg(imageIcon),
        'locate-mindmap': iconImg(mapIcon),
        'locate-list': iconImg(chevronDownIcon),
        'delete': iconImg(deleteIcon)
    };
    const items = buildTaskContextMenuItems(task, { hasImages, source: options.source }).map(item => {
        if (item.divider) return item;
        const children = item.children?.map(child => ({
            ...child,
            icon: child.selected ? iconImg(checkIcon) : ''
        }));
        return {
            ...item,
            icon: iconByAction[item.action] ?? '',
            ...(children ? { children } : {})
        };
    });

    // 不用 source:'more'：prepareMoreButton 会把锚点 innerHTML 换成三点，破坏导图节点标题
    const action = await showContextMenu(rect.right + 8, rect.bottom + 8, items, {
        anchor: anchorEl,
        source: fromMindmap ? 'mindmap' : 'more'
    });

    const refreshMindmap = () => {
        if (viewMode === 'mindmap') renderMindmap({ flip: false });
        else renderTasks();
    };

    if (action === 'toggle-complete') {
        toggleTask(id, !task.completed);
        refreshMindmap();
    } else if (action === 'add-child') addChildTask(id);
    else if (action === 'rename') editTaskTitle(id);
    else if (action === 'copy') copyTask(id);
    else if (action === 'toggle-executing') toggleTaskExecuting(id);
    else if (action === 'import-image') {
        if (fromMindmap) importMindmapImage(id);
        else addTaskImage(id, () => {});
    }
    else if (action === 'image-manager') showTaskImageManager(id);
    else if (action === 'view-images') viewTaskImages(id);
    else if (action === 'locate-list') openTaskInListView(id);
    else if (action === 'locate-mindmap') openTaskInMindmapView(id);
    else if (action === 'delete') deleteTask(id);
    else if (action && action.startsWith('priority-')) setTaskPriority(id, action.replace('priority-', ''));

    if (typeof window !== 'undefined') {
        window.__pcGoalMindmapMenuAction = action || '';
        window.__pcGoalMindmapViewMode = viewMode;
    }

    // 取消菜单后强制重绘，恢复可能被污染的节点 DOM
    if (fromMindmap && viewMode === 'mindmap' && action !== 'locate-list') {
        renderMindmap({ flip: false });
    }
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

function refreshAfterImageChange(options = {}) {
    if (viewMode === 'mindmap') {
        renderMindmap({ flip: options.flip === true });
        return;
    }
    renderTasks();
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
            refreshAfterImageChange();
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

function importMindmapImage(taskId) {
    if (!taskId || taskId === MINDMAP_ROOT_ID) {
        showToast('请先选中要导入图片的任务节点', 'error');
        return;
    }
    const task = findTask(taskId);
    if (!task) {
        showToast('任务不存在', 'error');
        return;
    }
    mindmapSelectedId = taskId;
    applyMindmapSelectionStyles();
    addTaskImage(taskId);
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
    const BATCH_SIZE = 20;
    let renderedCount = 0;
    let appendObserver = null;

    function renderManagerContent() {
        renderedCount = 0;
        const images = task.images || [];
        const emptyState = images.length === 0 ? `
            <div class="pc-goal-image-manager-empty">
                <span class="pc-empty-icon">${iconImg(rabbitTip, '图片管理')}</span>
                <span class="pc-empty-text">暂无图片，点击下方按钮添加或粘贴图片</span>
            </div>
        ` : '';
        const grid = images.length > 0 ? `
            <div class="pc-goal-image-manager-grid">
                ${renderImageBatch()}
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

    // 渲染一批图片项，返回 HTML（img 只放 data-src，进入视口后异步替换缩略图）
    function renderImageBatch() {
        const images = task.images || [];
        const end = Math.min(renderedCount + BATCH_SIZE, images.length);
        const parts = [];
        for (; renderedCount < end; renderedCount++) {
            const index = renderedCount;
            const url = images[index].data || getGoalImageUrl(storage, images[index].path);
            parts.push(`
                <div class="pc-goal-image-manager-item" data-index="${index}">
                    <img data-src="${url}" alt="任务图片" decoding="async">
                    <button class="pc-goal-image-manager-delete" type="button" aria-label="删除图片" data-index="${index}">
                        ${iconImg(deleteIcon)}
                    </button>
                </div>
            `);
        }
        if (end < images.length) {
            parts.push('<div class="pc-goal-image-manager-sentinel"></div>');
        }
        return parts.join('');
    }

    // 对网格内未加载的 img 惰性替换缩略图；滚动到底部 sentinel 时追加下一批
    function observeGridImages(modalEl) {
        if (appendObserver) {
            appendObserver.disconnect();
            appendObserver = null;
        }
        const grid = modalEl.querySelector('.pc-goal-image-manager-grid');
        if (!grid) return;

        const io = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                const img = entry.target;
                io.unobserve(img);
                getGoalThumbUrl(img.dataset.src).then((thumb) => {
                    if (img.isConnected) img.src = thumb;
                });
            }
        }, { root: modalEl.querySelector('.pc-goal-image-manager-body'), rootMargin: '200px' });
        grid.querySelectorAll('img[data-src]').forEach(img => io.observe(img));

        const sentinel = grid.querySelector('.pc-goal-image-manager-sentinel');
        if (sentinel) {
            appendObserver = new IntersectionObserver((entries) => {
                if (!entries.some(e => e.isIntersecting)) return;
                appendObserver.disconnect();
                appendObserver = null;
                sentinel.remove();
                sentinel.insertAdjacentHTML('beforebegin', renderImageBatch());
                observeGridImages(modalEl);
            }, { root: modalEl.querySelector('.pc-goal-image-manager-body') });
            appendObserver.observe(sentinel);
        }
    }

    const modal = showModal(renderManagerContent());

    async function refresh() {
        modal.innerHTML = renderManagerContent();
        bindManagerEvents();
        observeGridImages(modal);
    }

    imageManagerCurrent = { taskId: id, refresh };
    observeImageManagerClose();
    observeGridImages(modal);

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
                    refreshAfterImageChange();
                    await saveTasks();
                    showToast('图片已删除');
                    refresh();
                });
            });
        });
        modal.querySelectorAll('.pc-goal-image-manager-item > img').forEach(img => {
            img.addEventListener('click', () => {
                const item = img.closest('.pc-goal-image-manager-item');
                const index = Number(item?.dataset.index || 0);
                const urls = task.images.map(img => img.data || getGoalImageUrl(storage, img.path)).filter(Boolean);
                if (urls.length > 0) {
                    showImageViewer({ urls, index, sourceEl: img });
                }
            });
        });
    }

    bindManagerEvents();
}

function resolveMindmapGraph() {
    mindmapGraph = buildMindmapGraph(project, tasks);
    mindmapGraph = {
        ...mindmapGraph,
        nodes: annotateMindmapProgress(mindmapGraph.nodes)
    };
    if (mindmapOnlyIncomplete) {
        const filtered = filterIncompleteMindmap(mindmapGraph.nodes, mindmapGraph.hierarchyEdges);
        if (filtered.nodes.length === 0) {
            mindmapGraph = { ...mindmapGraph, nodes: [], hierarchyEdges: [] };
        } else {
            mindmapGraph = { ...mindmapGraph, nodes: filtered.nodes, hierarchyEdges: filtered.hierarchyEdges };
        }
    }
    mindmapLayoutResult = layoutMindmap(mindmapGraph.nodes, mindmapGraph.hierarchyEdges);
    return mindmapGraph;
}

function mindmapImageMarkup(node) {
    if (!node || node.isRoot) return '';
    const count = node.imageCount || 0;
    const importBtn = `
        <button type="button" class="pc-goal-mindmap-image-add" data-task-id="${escapeHtml(node.id)}" aria-label="导入图片" title="导入图片">
            <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
                <path d="M8 3.2v9.6M3.2 8h9.6"></path>
            </svg>
        </button>
    `;
    if (!count) return importBtn;
    const first = (node.images || [])[0];
    const dataSrc = first?.data || first?.path || '';
    return `
        <button type="button" class="pc-goal-mindmap-image" data-task-id="${escapeHtml(node.id)}" data-preview-src="${escapeHtml(dataSrc)}" aria-label="查看图片" title="查看图片">
            <img alt="" data-src="${escapeHtml(dataSrc)}" loading="lazy">
            ${count > 1 ? `<span class="pc-goal-mindmap-image-count">${count}</span>` : ''}
        </button>
        ${importBtn}
    `;
}

function mindmapStatusMarkup(node) {
    const kind = node.statusKind || (node.completed || node.checkState === 'checked' ? 'done' : 'todo');
    const title = kind === 'done' ? '已完成' : (kind === 'doing' ? '部分完成' : '未完成');
    return `<span class="pc-goal-mindmap-status is-${kind}" data-status="${kind}" title="${title}" aria-label="${title}"></span>`;
}

function mindmapPriorityBadgeMarkup(node) {
    const priorityClass = mindmapPriorityClass(node.priority);
    if (!priorityClass) return '';
    const label = getTaskPriorityLabel(node.priority) || node.priority;
    return `<span class="pc-goal-mindmap-priority-badge ${priorityClass}" data-priority="${escapeHtml(node.priority)}" title="优先级：${escapeHtml(label)}"></span>`;
}

function mindmapProgressMarkup(node) {
    if (!node.hasChildren && !node.isRoot) return '';
    return `<span class="pc-goal-mindmap-progress" title="子任务完成 ${escapeHtml(node.progressText || '')}">${escapeHtml(node.progressText || '')}</span>`;
}

function setViewMode(next, options = {}) {
    const mode = next === 'mindmap' ? 'mindmap' : 'list';
    if (mode !== 'mindmap' && mindmapMaximized) {
        setMindmapMaximized(false, { skipRender: true });
    }
    const focusTaskId = options.focusTaskId
        || (mode === 'mindmap' ? (selectedTaskId || mindmapSelectedId || pendingMindmapFocusId || '') : '');
    const same = mode === viewMode;
    if (same && !options.forceRefit && !options.focusTaskId && !focusTaskId) {
        applyViewMode({ refit: false });
        return;
    }
    if (!same) {
        viewMode = mode;
        writeMindmapView(window.localStorage, projectId, viewMode);
        updateRouteParams({ view: viewMode });
    }
    if (mode === 'mindmap') {
        pendingMindmapFocusId = focusTaskId || null;
        if (focusTaskId) mindmapSelectedId = focusTaskId;
        applyViewMode({
            focusTaskId: focusTaskId || undefined,
            refit: true
        });
        return;
    }
    pendingMindmapFocusId = null;
    applyViewMode({ refit: false, scrollList: true });
}

function applyViewMode(options = {}) {
    if (!pageElRef) return;
    const listEl = pageElRef.querySelector('#pcGoalTaskList');
    const mindEl = pageElRef.querySelector('#pcGoalMindmap');
    const addBtn = pageElRef.querySelector('#pcGoalAddTask');
    const detailPage = pageElRef.classList.contains('pc-goal-detail-page')
        ? pageElRef
        : pageElRef.querySelector('.pc-goal-detail-page');
    const viewMind = viewMode === 'mindmap';
    pageElRef.classList.toggle('is-view-mindmap', viewMind);
    pageElRef.dataset.view = viewMode;
    detailPage?.classList.toggle('is-view-mindmap', viewMind);
    if (detailPage) detailPage.dataset.view = viewMode;
    pageElRef.querySelectorAll('.pc-goal-view-switch-btn').forEach(btn => {
        const active = btn.dataset.view === viewMode;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    if (addBtn) addBtn.hidden = viewMode === 'mindmap' || mindmapMaximized;
    if (viewMind) {
        if (listEl) {
            destroySortables(listEl);
            listEl.hidden = true;
        }
        if (mindEl) mindEl.hidden = false;
        renderMindmap({ flip: false });
        applyMindmapMaximizedClass();
        if (options.refit !== false) {
            scheduleMindmapCamera({
                focusNodeId: options.focusTaskId || pendingMindmapFocusId || undefined
            });
        } else {
            updateMindmapTransform();
        }
    } else {
        if (mindEl) mindEl.hidden = true;
        if (listEl) listEl.hidden = false;
        applyMindmapMaximizedClass();
        renderTasks();
        if (selectedTaskId && options.scrollList !== false) {
            flashListItem(selectedTaskId, { scroll: options.scrollList === true });
        }
    }
}

function flashListItem(taskId, options = {}) {
    if (!taskId || !pageElRef) return;
    const item = pageElRef.querySelector(`.pc-goal-task-item[data-task-id="${CSS.escape(taskId)}"]`);
    if (!item) return;
    if (options.scroll !== false) {
        item.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    item.classList.add('is-flash', 'is-selected');
    setTimeout(() => item.classList.remove('is-flash'), 800);
}

function flashMindmapNode(taskId) {
    if (!taskId || !pageElRef) return;
    const node = pageElRef.querySelector(`.pc-goal-mindmap-node[data-node-id="${CSS.escape(taskId)}"]`);
    if (!node) return;
    node.classList.add('is-selected', 'is-flash');
    setTimeout(() => node.classList.remove('is-flash'), 800);
}

/**
 * 相机调度：等容器 layout 就绪后再 fit/focus，避免 hidden/动画阶段 stage=0x0。
 * 切换到导图时强制重新取景（不再 onlyIfUnset 卡在坏 transform）。
 */
function scheduleMindmapCamera(options = {}) {
    if (viewMode !== 'mindmap' || !pageElRef) return;
    const focusNodeId = options.focusNodeId
        || pendingMindmapFocusId
        || undefined;
    if (focusNodeId && mindmapLayoutResult?.positions?.has(focusNodeId)) {
        mindmapSelectedId = focusNodeId;
        applyMindmapSelectionStyles();
    }
    pendingMindmapFocusId = focusNodeId || null;
    const token = ++mindmapFitToken;
    const attempt = (triesLeft) => {
        if (token !== mindmapFitToken || viewMode !== 'mindmap' || !pageElRef) return;
        const size = getMindmapStageSize();
        if ((!size.width || !size.height) && triesLeft > 0) {
            requestAnimationFrame(() => attempt(triesLeft - 1));
            return;
        }
        const validFocus = focusNodeId && mindmapLayoutResult?.positions?.has(focusNodeId)
            ? focusNodeId
            : undefined;
        fitMindmapView({
            focusNodeId: validFocus,
            animate: options.animate !== false
        });
        if (validFocus) {
            requestAnimationFrame(() => flashMindmapNode(validFocus));
        }
        if (typeof window !== 'undefined') {
            window.__pcGoalMindmapViewMode = viewMode;
            window.__pcGoalMindmapFocus = validFocus || '';
        }
    };
    // 双 rAF + 重试：等 is-view-mindmap 高度链与 stage layout 就绪后再 fit
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => attempt(10));
        });
    });
}

function applyMindmapMaximizedClass() {
    if (!pageElRef) return;
    const on = !!(mindmapMaximized && viewMode === 'mindmap');
    pageElRef.classList.toggle('is-mindmap-maximized', on);
    const page = pageElRef.classList.contains('pc-goal-detail-page')
        ? pageElRef
        : pageElRef.querySelector('.pc-goal-detail-page');
    page?.classList.toggle('is-mindmap-maximized', on);
    pageElRef.querySelector('#pcGoalMindmap')?.classList.toggle('is-maximized', on);
    document.body.classList.toggle('pc-goal-mindmap-max-open', on);
    if (on) {
        pageElRef.style.transform = 'none';
        pageElRef.style.filter = 'none';
        pageElRef.style.perspective = 'none';
        const container = pageElRef.parentElement;
        if (container) {
            if (container.dataset.mindmapMaxRestore === undefined) {
                container.dataset.mindmapMaxRestore = container.style.transform || '';
            }
            container.style.transform = 'none';
        }
    } else if (pageElRef) {
        pageElRef.style.transform = '';
        pageElRef.style.filter = '';
        pageElRef.style.perspective = '';
        const container = pageElRef.parentElement;
        if (container && container.dataset.mindmapMaxRestore !== undefined) {
            container.style.transform = container.dataset.mindmapMaxRestore;
            delete container.dataset.mindmapMaxRestore;
        }
    }
}

function bindMindmapEscHandler() {
    unbindMindmapEscHandler();
    mindmapEscHandler = (e) => {
        if (e.key !== 'Escape' || !mindmapMaximized) return;
        if (document.querySelector('.pc-modal-overlay.pc-modal-active')) return;
        if (document.querySelector('#pcContextMenu.pc-context-active')) return;
        e.preventDefault();
        setMindmapMaximized(false);
    };
    document.addEventListener('keydown', mindmapEscHandler);
}

function unbindMindmapEscHandler() {
    if (mindmapEscHandler) {
        document.removeEventListener('keydown', mindmapEscHandler);
        mindmapEscHandler = null;
    }
}

function setMindmapMaximized(enabled, options = {}) {
    const next = !!enabled;
    mindmapMaximized = next;
    writeMindmapMaximize(window.localStorage, projectId, mindmapMaximized);
    applyMindmapMaximizedClass();
    syncMindmapMaximizeButton();
    if (!options.skipRender && viewMode === 'mindmap') {
        requestAnimationFrame(() => {
            applyMindmapMaximizedClass();
            syncMindmapMaximizeButton();
            scheduleMindmapCamera({
                focusNodeId: mindmapSelectedId && mindmapLayoutResult?.positions?.has(mindmapSelectedId)
                    ? mindmapSelectedId
                    : undefined
            });
        });
    }
}

function syncMindmapMaximizeButton() {
    const buttons = pageElRef?.querySelectorAll('#pcGoalMindmapMaximize') || [];
    buttons.forEach(maxBtn => {
        maxBtn.textContent = mindmapMaximized ? '退出最大化' : '最大化';
        maxBtn.setAttribute('aria-pressed', mindmapMaximized ? 'true' : 'false');
        maxBtn.classList.toggle('pc-btn-primary', mindmapMaximized);
    });
}

function getMindmapStageSize() {
    const stage = pageElRef?.querySelector('#pcGoalMindmapStage');
    if (!stage) return { width: 0, height: 0 };
    const rect = stage.getBoundingClientRect();
    return {
        width: rect.width || stage.clientWidth || 0,
        height: rect.height || stage.clientHeight || 0
    };
}

function updateMindmapTransform() {
    const world = pageElRef?.querySelector('#pcGoalMindmapWorld');
    if (!world) return;
    mindmapTransform.scale = clampMindmapScale(mindmapTransform.scale);
    world.style.transform = `translate(${mindmapTransform.x}px, ${mindmapTransform.y}px) scale(${mindmapTransform.scale})`;
    const zoomEl = pageElRef.querySelector('#pcGoalMindmapZoom');
    if (zoomEl) zoomEl.textContent = formatMindmapZoomLabel(mindmapTransform.scale);
}

function edgePathBetween(fromPos, toPos) {
    return orthogonalEdgePath(fromPos, toPos);
}

function nodeStatusClass(node) {
    const classes = ['pc-goal-mindmap-node'];
    if (node.isRoot) classes.push('is-root');
    const kind = node.statusKind || (node.completed || node.checkState === 'checked' ? 'done' : 'todo');
    classes.push(`is-status-${kind}`);
    if (node.completed || node.checkState === 'checked') classes.push('is-completed');
    if (node.checkState === 'indeterminate') classes.push('is-indeterminate');
    if (isTaskExecuting(node)) classes.push('is-executing');
    const priorityClass = mindmapPriorityClass(node.priority);
    if (priorityClass) classes.push('has-priority');
    if (mindmapSelectedId === node.id) classes.push('is-selected');
    if (mindmapPendingFromId === node.id) classes.push('is-link-from');
    return classes.join(' ');
}

function applyMindmapSelectionStyles() {
    const container = pageElRef?.querySelector('#pcGoalMindmap');
    if (!container) return;
    container.querySelectorAll('.pc-goal-mindmap-node').forEach(el => {
        const id = el.dataset.nodeId;
        el.classList.toggle('is-selected', mindmapSelectedId === id);
        el.classList.toggle('is-link-from', mindmapPendingFromId === id);
    });
}

function mountMindmapImagePreviews(container) {
    const storage = getStorage();
    const resolveUrl = (raw) => {
        if (!raw) return '';
        if (raw.startsWith('data:') || raw.startsWith('blob:') || raw.startsWith('http')) return raw;
        return getGoalImageUrl(storage, raw);
    };
    container.querySelectorAll('.pc-goal-mindmap-image img[data-src]').forEach(img => {
        const raw = img.dataset.src || '';
        if (!raw) return;
        if (raw.startsWith('data:') || raw.startsWith('blob:') || raw.startsWith('http')) {
            img.src = raw;
            return;
        }
        const url = resolveUrl(raw);
        if (!url) return;
        getGoalThumbUrl(url).then(thumb => {
            if (img.isConnected) img.src = thumb || url;
        }).catch(() => {
            if (img.isConnected) img.src = url;
        });
    });

    container.querySelectorAll('.pc-goal-mindmap-image').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const taskId = btn.dataset.taskId;
            const task = findTask(taskId);
            if (!task || !task.images || task.images.length === 0) return;
            const urls = task.images
                .map(img => img.data || getGoalImageUrl(storage, img.path))
                .filter(Boolean);
            if (urls.length > 0) {
                showImageViewer({ urls, index: 0, sourceEl: btn.querySelector('img') || btn });
            }
        });
    });

    container.querySelectorAll('.pc-goal-mindmap-image-add').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            importMindmapImage(btn.dataset.taskId);
        });
    });

    mountGoalImageIcons(container, {
        iconSelector: '.pc-goal-mindmap-image',
        getTask: (id) => findTask(id),
        getImageUrl: (img) => {
            if (!img) return '';
            if (img.data) return img.data;
            return getGoalImageUrl(storage, img.path);
        },
        onOpenViewer: (task, index, sourceEl) => {
            const urls = (task.images || [])
                .map(img => img.data || getGoalImageUrl(storage, img.path))
                .filter(Boolean);
            if (urls.length > 0) {
                showImageViewer({ urls, index: index || 0, sourceEl });
            }
        }
    });
}

function renderMindmap(options = {}) {
    const container = pageElRef?.querySelector('#pcGoalMindmap');
    if (!container) return;

    const useFlip = options.flip !== false;
    const prevRects = useFlip ? captureMindmapNodeRects() : new Map();

    if (!tasks || tasks.length === 0) {
        container.innerHTML = `
            <div class="pc-empty-state pc-goal-tasks-empty">
                <span class="pc-empty-icon">${iconImg(rabbitTip, '目标计划')}</span>
                <span class="pc-empty-text">还没有任务，点击右上角添加第一个任务吧</span>
            </div>
        `;
        return;
    }

    const graph = resolveMindmapGraph();
    if (!graph.nodes || graph.nodes.length === 0) {
        container.innerHTML = `
            <div class="pc-goal-mindmap-toolbar">
                <button type="button" class="pc-btn pc-btn-sm pc-btn-primary" id="pcGoalMindmapOnlyOpen" aria-pressed="true">只看未完成</button>
                <button type="button" class="pc-btn pc-btn-sm" id="pcGoalMindmapImportImage" title="为选中节点导入图片">导入图片</button>
            </div>
            <div class="pc-empty-state pc-goal-tasks-empty">
                <span class="pc-empty-icon">${iconImg(rabbitTip, '目标计划')}</span>
                <span class="pc-empty-text">没有未完成任务，可关闭「只看未完成」查看全部</span>
            </div>
        `;
        container.querySelector('#pcGoalMindmapOnlyOpen')?.addEventListener('click', () => {
            mindmapOnlyIncomplete = false;
            renderMindmap({ flip: true });
        });
        container.querySelector('#pcGoalMindmapImportImage')?.addEventListener('click', () => {
            importMindmapImage(mindmapSelectedId);
        });
        return;
    }

    const { positions, width, height } = mindmapLayoutResult;
    const validIds = new Set(flatTasks.map(t => t.id));
    const nextLinks = normalizeMindmapLinks(mindmapLinks, validIds);
    if (JSON.stringify(nextLinks) !== JSON.stringify(mindmapLinks)) {
        mindmapLinks = nextLinks;
        writeMindmapLinks(window.localStorage, projectId, mindmapLinks);
    } else {
        mindmapLinks = nextLinks;
    }

    const branchColors = assignMindmapBranchColors(graph.nodes);
    const hierarchyPathItems = buildMindmapHierarchyEdgePaths(graph.nodes, positions, graph.hierarchyEdges);
    const edgeMarkup = hierarchyPathItems.map(item => {
        const toNode = graph.nodes.find(n => n.id === item.to);
        const doneEdge = toNode?.statusKind === 'done';
        return `<path class="pc-goal-mindmap-edge is-hierarchy${doneEdge ? ' is-done' : ''}" d="${item.d}" stroke="${item.color}" style="opacity:${doneEdge ? Math.min(item.opacity, 0.35) : item.opacity}" data-from="${escapeHtml(item.from)}" data-to="${escapeHtml(item.to)}" />`;
    }).join('');

    const linkMarkup = mindmapLinks.map(link => {
        const fromPos = positions.get(link.fromId);
        const toPos = positions.get(link.toId);
        if (!fromPos || !toPos) return '';
        return `<path class="pc-goal-mindmap-edge is-relation" d="${orthogonalEdgePath(fromPos, toPos)}" data-from="${escapeHtml(link.fromId)}" data-to="${escapeHtml(link.toId)}" />`;
    }).join('');

    const nodeMarkup = graph.nodes.map(node => {
        const pos = positions.get(node.id);
        if (!pos) return '';
        const priorityLabel = node.priority ? ` · 优先级 ${getTaskPriorityLabel(node.priority) || node.priority}` : '';
        const branchColor = branchColors.get(node.id) || '';
        const branchStyle = branchColor && !node.isRoot
            ? `left:${pos.x}px;top:${pos.y}px;width:${pos.w}px;height:${pos.h}px;--pc-goal-mindmap-branch:${branchColor}`
            : `left:${pos.x}px;top:${pos.y}px;width:${pos.w}px;height:${pos.h}px`;
        return `
            <div class="${nodeStatusClass(node)}"
                 data-node-id="${escapeHtml(node.id)}"
                 data-status="${escapeHtml(node.statusKind || '')}"
                 style="${branchStyle}"
                 title="${escapeHtml(node.title + priorityLabel)}">
                ${mindmapStatusMarkup(node)}
                <span class="pc-goal-mindmap-node-title">${escapeHtml(node.title)}</span>
                ${mindmapProgressMarkup(node)}
                ${mindmapImageMarkup(node)}
                ${mindmapPriorityBadgeMarkup(node)}
            </div>
        `;
    }).join('');

    const openFilterClass = mindmapOnlyIncomplete ? 'pc-btn-primary' : '';
    container.innerHTML = `
        <div class="pc-goal-mindmap-toolbar">
            <button type="button" class="pc-btn pc-btn-sm ${mindmapLinkMode ? 'pc-btn-primary' : ''}" id="pcGoalMindmapLinkMode" aria-pressed="${mindmapLinkMode}">
                ${mindmapLinkMode ? '关联中…' : '关联模式'}
            </button>
            <button type="button" class="pc-btn pc-btn-sm" id="pcGoalMindmapClearLinks">清空关联</button>
            <button type="button" class="pc-btn pc-btn-sm ${openFilterClass}" id="pcGoalMindmapOnlyOpen" aria-pressed="${mindmapOnlyIncomplete}">只看未完成</button>
            <button type="button" class="pc-btn pc-btn-sm" id="pcGoalMindmapImportImage" title="为选中节点导入图片">导入图片</button>
            <button type="button" class="pc-btn pc-btn-sm" id="pcGoalMindmapFit">适应画布</button>
            <button type="button" class="pc-btn pc-btn-sm" id="pcGoalMindmapReset">重置视图</button>
            <button type="button" class="pc-btn pc-btn-sm ${mindmapMaximized ? 'pc-btn-primary' : ''}" id="pcGoalMindmapMaximize" aria-pressed="${mindmapMaximized}">
                ${mindmapMaximized ? '退出最大化' : '最大化'}
            </button>
            <span class="pc-goal-mindmap-zoom" id="pcGoalMindmapZoom" title="当前缩放">${formatMindmapZoomLabel(mindmapTransform.scale)}</span>
            <span class="pc-goal-mindmap-hint">${mindmapLinkMode
                ? (mindmapPendingFromId ? '再点击目标节点以创建/取消关联' : '点击起点节点')
                : '左侧状态 · 右上优先级 · 父节点显示进度'}</span>
        </div>
        <div class="pc-goal-mindmap-stage" id="pcGoalMindmapStage">
            <div class="pc-goal-mindmap-world" id="pcGoalMindmapWorld"
                 style="width:${width}px;height:${height}px;transform:translate(${mindmapTransform.x}px, ${mindmapTransform.y}px) scale(${mindmapTransform.scale})">
                <svg class="pc-goal-mindmap-edges" width="${width}" height="${height}" aria-hidden="true">
                    ${edgeMarkup}
                    ${linkMarkup}
                </svg>
                <div class="pc-goal-mindmap-nodes">${nodeMarkup}</div>
            </div>
        </div>
        <div class="pc-goal-mindmap-legend">
            <span><i class="is-status-todo"></i>未完成</span>
            <span><i class="is-status-doing"></i>部分完成</span>
            <span><i class="is-status-done"></i>已完成</span>
            <span><i class="is-priority-badge"></i>优先级（右上）</span>
            <span><i class="is-progress"></i>父级进度</span>
            <span><i class="is-hierarchy"></i>任务层级</span>
            <span><i class="is-relation"></i>手动关联</span>
        </div>
    `;

    bindMindmapEvents(container);
    applyMindmapMaximizedClass();
    mountMindmapImagePreviews(container);
    if (useFlip) animateMindmapNodesWithFlip(prevRects);
}

function handleMindmapNodeClick(nodeId, anchorEl) {
    if (nodeId === MINDMAP_ROOT_ID && mindmapLinkMode) {
        showToast('根节点不能建立关联', 'error');
        return;
    }
    if (!mindmapLinkMode) {
        // 任务节点：单击始终选中并弹出菜单（取消后再点也能重新打开）
        if (nodeId === MINDMAP_ROOT_ID) {
            mindmapSelectedId = mindmapSelectedId === nodeId ? null : nodeId;
            mindmapPendingFromId = null;
            applyMindmapSelectionStyles();
            return;
        }
        mindmapSelectedId = nodeId;
        mindmapPendingFromId = null;
        applyMindmapSelectionStyles();
        if (anchorEl) {
            showTaskMenu(nodeId, anchorEl, { source: 'mindmap' });
        }
        return;
    }
    if (!mindmapPendingFromId) {
        mindmapPendingFromId = nodeId;
        mindmapSelectedId = nodeId;
        applyMindmapSelectionStyles();
        return;
    }
    if (mindmapPendingFromId === nodeId) {
        mindmapPendingFromId = null;
        applyMindmapSelectionStyles();
        return;
    }
    mindmapLinks = toggleMindmapLink(mindmapLinks, mindmapPendingFromId, nodeId);
    const validIds = new Set(flatTasks.map(t => t.id));
    mindmapLinks = normalizeMindmapLinks(mindmapLinks, validIds);
    writeMindmapLinks(window.localStorage, projectId, mindmapLinks);
    mindmapPendingFromId = null;
    mindmapSelectedId = nodeId;
    showToast('已更新跨分支关联', 'success');
    renderMindmap();
}

function captureMindmapNodeRects() {
    const map = new Map();
    const container = pageElRef?.querySelector('#pcGoalMindmap');
    if (!container) return map;
    container.querySelectorAll('.pc-goal-mindmap-node').forEach(el => {
        const id = el.dataset.nodeId;
        if (!id) return;
        map.set(id, {
            left: parseFloat(el.style.left) || 0,
            top: parseFloat(el.style.top) || 0
        });
    });
    return map;
}

function prefersMindmapMotionReduced() {
    return typeof window !== 'undefined'
        && window.matchMedia
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function cancelMindmapCameraAnimation() {
    if (mindmapCameraRaf) {
        cancelAnimationFrame(mindmapCameraRaf);
        mindmapCameraRaf = 0;
    }
}

function cancelMindmapInertia() {
    if (mindmapInertiaRaf) {
        cancelAnimationFrame(mindmapInertiaRaf);
        mindmapInertiaRaf = 0;
    }
}

function animateMindmapCameraTo(target, options = {}) {
    const to = {
        x: Number(target?.x) || 0,
        y: Number(target?.y) || 0,
        scale: clampMindmapScale(target?.scale)
    };
    const duration = Number.isFinite(options.duration) ? options.duration : MINDMAP_CAMERA_DURATION;
    if (prefersMindmapMotionReduced() || duration <= 0) {
        cancelMindmapCameraAnimation();
        mindmapTransform = { ...to };
        updateMindmapTransform();
        return;
    }
    cancelMindmapCameraAnimation();
    cancelMindmapInertia();
    const from = { ...mindmapTransform };
    const start = performance.now();
    const step = (now) => {
        const t = duration <= 0 ? 1 : Math.min(1, (now - start) / duration);
        mindmapTransform = interpolateMindmapTransform(from, to, t);
        updateMindmapTransform();
        if (t < 1) {
            mindmapCameraRaf = requestAnimationFrame(step);
        } else {
            mindmapCameraRaf = 0;
            mindmapTransform = { ...to };
            updateMindmapTransform();
        }
    };
    mindmapCameraRaf = requestAnimationFrame(step);
}

function startMindmapPanInertia(velocity) {
    cancelMindmapInertia();
    if (prefersMindmapMotionReduced()) return;
    let vx = Number(velocity?.x) || 0;
    let vy = Number(velocity?.y) || 0;
    if (!vx && !vy) return;
    const step = () => {
        const next = stepMindmapInertia({ x: vx * 16, y: vy * 16 });
        if (!next.active) {
            mindmapInertiaRaf = 0;
            return;
        }
        // next 已含 friction，换算回像素/帧
        vx = next.x / 16;
        vy = next.y / 16;
        mindmapTransform = {
            ...mindmapTransform,
            x: mindmapTransform.x + next.x,
            y: mindmapTransform.y + next.y
        };
        updateMindmapTransform();
        mindmapInertiaRaf = requestAnimationFrame(step);
    };
    mindmapInertiaRaf = requestAnimationFrame(step);
}

function fitMindmapView(options = {}) {
    if (viewMode !== 'mindmap' || !pageElRef) return;
    const stageSize = getMindmapStageSize();
    if (!stageSize.width || !stageSize.height) return;
    if (options.onlyIfUnset && mindmapTransform.scale !== MINDMAP_DEFAULT_TRANSFORM.scale) {
        if (mindmapTransform.x !== MINDMAP_DEFAULT_TRANSFORM.x || mindmapTransform.y !== MINDMAP_DEFAULT_TRANSFORM.y) {
            updateMindmapTransform();
            return;
        }
    }
    let target = null;
    if (options.focusNodeId && mindmapLayoutResult?.positions?.has(options.focusNodeId)) {
        target = focusMindmapTransform(mindmapLayoutResult.positions, options.focusNodeId, stageSize, {
            scale: options.scale ?? 1.05
        });
    }
    if (!target) {
        const content = mindmapLayoutResult
            ? { width: mindmapLayoutResult.width, height: mindmapLayoutResult.height }
            : { width: 800, height: 480 };
        target = fitMindmapTransform(content, stageSize, {
            padding: mindmapMaximized ? 28 : 20,
            maxScale: 1.15
        });
    }
    if (options.animate === false) {
        cancelMindmapCameraAnimation();
        mindmapTransform = target;
        updateMindmapTransform();
        return;
    }
    animateMindmapCameraTo(target, { duration: options.duration ?? MINDMAP_CAMERA_DURATION });
}

function animateMindmapNodesWithFlip(prevRects) {
    const container = pageElRef?.querySelector('#pcGoalMindmap');
    if (!container || prefersMindmapMotionReduced()) return;
    const nodes = container.querySelectorAll('.pc-goal-mindmap-node');
    nodes.forEach(el => {
        const id = el.dataset.nodeId;
        const nextLeft = parseFloat(el.style.left) || 0;
        const nextTop = parseFloat(el.style.top) || 0;
        const prev = prevRects.get(id);
        el.classList.remove('is-entering', 'is-leaving');
        if (!prev) {
            el.classList.add('is-entering');
            return;
        }
        const dx = prev.left - nextLeft;
        const dy = prev.top - nextTop;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
        el.style.transition = 'none';
        el.style.transform = `translate(${dx}px, ${dy}px)`;
        requestAnimationFrame(() => {
            el.style.transition = 'transform 260ms cubic-bezier(0.22, 0.8, 0.24, 1), opacity 200ms ease';
            el.style.transform = 'translate(0, 0)';
        });
    });
    const edges = container.querySelector('.pc-goal-mindmap-edges');
    if (edges) {
        edges.classList.remove('is-animating');
        void edges.offsetWidth;
        edges.classList.add('is-animating');
    }
}

function openTaskInListView(taskId) {
    const graph = mindmapGraph || resolveMindmapGraph();
    const path = hierarchyPathToRoot(graph.nodes, taskId);
    for (const id of path) {
        if (id !== MINDMAP_ROOT_ID) expandedIds.add(id);
    }
    selectedTaskId = taskId || null;
    if (mindmapMaximized) {
        mindmapMaximized = false;
        writeMindmapMaximize(window.localStorage, projectId, false);
    }
    setViewMode('list');
    applyMindmapMaximizedClass();
    syncMindmapMaximizeButton();
    if (typeof window !== 'undefined') {
        window.__pcGoalMindmapLocated = taskId;
        window.__pcGoalMindmapViewMode = viewMode;
    }
    requestAnimationFrame(() => {
        flashListItem(taskId, { scroll: true });
    });
}

function openTaskInMindmapView(taskId) {
    selectedTaskId = taskId || null;
    if (taskId) {
        mindmapSelectedId = taskId;
        const graph = mindmapGraph || resolveMindmapGraph();
        const path = hierarchyPathToRoot(graph.nodes, taskId);
        for (const id of path) {
            if (id !== MINDMAP_ROOT_ID) expandedIds.add(id);
        }
    }
    pendingMindmapFocusId = taskId || null;
    if (viewMode === 'mindmap') {
        applyViewMode({ focusTaskId: taskId || undefined, refit: true });
    } else {
        setViewMode('mindmap', { focusTaskId: taskId || undefined, forceRefit: true });
    }
    if (typeof window !== 'undefined') {
        window.__pcGoalMindmapLocated = taskId || '';
        window.__pcGoalMindmapViewMode = viewMode;
    }
}

function mindmapClientToWorld(stage, clientX, clientY) {
    const rect = stage.getBoundingClientRect();
    const scale = mindmapTransform.scale || 1;
    return {
        x: (clientX - rect.left - mindmapTransform.x) / scale,
        y: (clientY - rect.top - mindmapTransform.y) / scale
    };
}

function clearMindmapDropHints(container) {
    container?.querySelectorAll('.pc-goal-mindmap-node.is-drop-child, .pc-goal-mindmap-node.is-drop-before, .pc-goal-mindmap-node.is-drop-after')
        .forEach(el => el.classList.remove('is-drop-child', 'is-drop-before', 'is-drop-after'));
    container?.querySelector('#pcGoalMindmapStage')?.classList.remove('is-drop-root');
    container?.querySelector('.pc-goal-mindmap-drop-hint')?.remove();
}

function applyMindmapDropHints(container, target, clientX, clientY) {
    clearMindmapDropHints(container);
    if (!target) return;
    const stage = container.querySelector('#pcGoalMindmapStage');
    const hint = document.createElement('div');
    hint.className = 'pc-goal-mindmap-drop-hint';
    if (target.type === 'child') {
        container.querySelector(`.pc-goal-mindmap-node[data-node-id="${CSS.escape(target.parentId)}"]`)?.classList.add('is-drop-child');
        hint.textContent = '成子级';
    } else if (target.type === 'sibling') {
        const id = target.beforeId || target.afterId;
        const cls = target.beforeId ? 'is-drop-before' : 'is-drop-after';
        container.querySelector(`.pc-goal-mindmap-node[data-node-id="${CSS.escape(id)}"]`)?.classList.add(cls);
        hint.textContent = target.beforeId ? '插到上方' : '插到下方';
    } else {
        stage?.classList.add('is-drop-root');
        hint.textContent = '放到空白处成为顶层';
    }
    if (stage) {
        const rect = stage.getBoundingClientRect();
        hint.style.left = `${clientX - rect.left}px`;
        hint.style.top = `${clientY - rect.top}px`;
        stage.appendChild(hint);
    }
}

function bindMindmapDragWindow() {
    if (mindmapDragWindowBound || typeof window === 'undefined') return;
    mindmapDragWindowBound = true;
    window.addEventListener('pointerup', handleMindmapDragWindowEnd);
    window.addEventListener('pointercancel', handleMindmapDragWindowEnd);
}

function unbindMindmapDragWindow() {
    if (!mindmapDragWindowBound || typeof window === 'undefined') return;
    mindmapDragWindowBound = false;
    window.removeEventListener('pointerup', handleMindmapDragWindowEnd);
    window.removeEventListener('pointercancel', handleMindmapDragWindowEnd);
}

function handleMindmapDragWindowEnd() {
    finishMindmapDrag({ commit: true });
}

function finishMindmapDrag({ commit = false } = {}) {
    const state = mindmapDragState;
    if (!state) return;
    mindmapDragState = null;
    unbindMindmapDragWindow();
    state.el?.classList.remove('is-dragging');
    if (state.el) {
        state.el.style.transform = '';
        state.el.style.zIndex = '';
    }
    clearMindmapDropHints(pageElRef?.querySelector('#pcGoalMindmap'));
    try { state.el?.releasePointerCapture(state.pointerId); } catch { /* ignore */ }
    if (commit && state.active) {
        mindmapSuppressClick = true;
        if (state.dropTarget) {
            commitMindmapReparent(state.nodeId, state.dropTarget);
        }
    }
}

function commitMindmapReparent(taskId, target) {
    if (!taskId || !target || taskId === MINDMAP_ROOT_ID) return false;
    const next = moveTaskInTree(tasks, taskId, target);
    if (next === tasks) return false;
    tasks = next;
    if (target.type === 'child' && target.parentId) expandedIds.add(target.parentId);
    if (target.type === 'sibling' && target.parentId) expandedIds.add(target.parentId);
    flatTasks = flattenTasks(tasks);
    syncParentCompletion(tasks);
    renderTasks();
    saveTasks();
    return true;
}

function bindMindmapEvents(container) {
    container.querySelector('#pcGoalMindmapLinkMode')?.addEventListener('click', () => {
        mindmapLinkMode = !mindmapLinkMode;
        mindmapPendingFromId = null;
        if (!mindmapLinkMode) mindmapSelectedId = null;
        renderMindmap();
    });

    container.querySelector('#pcGoalMindmapClearLinks')?.addEventListener('click', () => {
        if (!mindmapLinks.length) {
            showToast('当前没有手动关联', 'error');
            return;
        }
        showConfirmModal('确定清空本项目的跨分支关联吗？', async () => {
            mindmapLinks = [];
            writeMindmapLinks(window.localStorage, projectId, mindmapLinks);
            mindmapPendingFromId = null;
            showToast('已清空关联', 'success');
            renderMindmap();
        });
    });

    container.querySelector('#pcGoalMindmapOnlyOpen')?.addEventListener('click', () => {
        mindmapOnlyIncomplete = !mindmapOnlyIncomplete;
        renderMindmap({ flip: true });
        scheduleMindmapCamera({
            focusNodeId: mindmapSelectedId && mindmapLayoutResult?.positions?.has(mindmapSelectedId)
                ? mindmapSelectedId
                : undefined
        });
    });

    container.querySelector('#pcGoalMindmapImportImage')?.addEventListener('click', () => {
        if (mindmapLinkMode) {
            showToast('关联模式下请先退出再导入图片', 'error');
            return;
        }
        importMindmapImage(mindmapSelectedId);
    });

    container.querySelector('#pcGoalMindmapFit')?.addEventListener('click', () => {
        scheduleMindmapCamera({
            focusNodeId: mindmapSelectedId && mindmapLayoutResult?.positions?.has(mindmapSelectedId)
                ? mindmapSelectedId
                : undefined
        });
    });

    container.querySelector('#pcGoalMindmapMaximize')?.addEventListener('click', () => {
        setMindmapMaximized(!mindmapMaximized, { force: true });
    });

    container.querySelector('#pcGoalMindmapReset')?.addEventListener('click', () => {
        mindmapSelectedId = null;
        mindmapPendingFromId = null;
        pendingMindmapFocusId = null;
        applyMindmapSelectionStyles();
        scheduleMindmapCamera({ focusNodeId: undefined });
    });

    container.querySelectorAll('.pc-goal-mindmap-node').forEach(nodeEl => {
        nodeEl.addEventListener('click', (e) => {
            e.stopPropagation();
            if (mindmapSuppressClick) {
                mindmapSuppressClick = false;
                return;
            }
            if (e.target.closest('.pc-goal-mindmap-image') || e.target.closest('.pc-goal-mindmap-image-add')) return;
            handleMindmapNodeClick(nodeEl.dataset.nodeId, nodeEl);
        });
        nodeEl.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            if (mindmapLinkMode) return;
            const id = nodeEl.dataset.nodeId;
            if (!id || id === MINDMAP_ROOT_ID) return;
            openTaskInListView(id);
        });
        nodeEl.addEventListener('pointerdown', (e) => {
            if (e.button !== 0 || mindmapLinkMode) return;
            if (e.target.closest('.pc-goal-mindmap-image') || e.target.closest('.pc-goal-mindmap-image-add')) return;
            const nodeId = nodeEl.dataset.nodeId;
            if (!nodeId || nodeId === MINDMAP_ROOT_ID) return;
            mindmapDragState = {
                nodeId,
                el: nodeEl,
                pointerId: e.pointerId,
                startX: e.clientX,
                startY: e.clientY,
                active: false,
                dropTarget: null
            };
            try { nodeEl.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        });
        nodeEl.addEventListener('pointermove', (e) => {
            const state = mindmapDragState;
            if (!state || state.nodeId !== nodeEl.dataset.nodeId) return;
            const dx = e.clientX - state.startX;
            const dy = e.clientY - state.startY;
            if (!state.active && Math.hypot(dx, dy) > 4) {
                state.active = true;
                state.el.classList.add('is-dragging');
                state.el.style.zIndex = '5';
                bindMindmapDragWindow();
                cancelMindmapInertia();
                cancelMindmapCameraAnimation();
            }
            if (!state.active) return;
            e.preventDefault();
            e.stopPropagation();
            const scale = mindmapTransform.scale || 1;
            state.el.style.transform = `translate(${dx / scale}px, ${dy / scale}px)`;
            const stage = container.querySelector('#pcGoalMindmapStage');
            if (!stage) return;
            const world = mindmapClientToWorld(stage, e.clientX, e.clientY);
            state.dropTarget = resolveMindmapDropTarget(
                state.nodeId,
                world,
                mindmapGraph?.nodes,
                mindmapLayoutResult?.positions
            );
            applyMindmapDropHints(container, state.dropTarget, e.clientX, e.clientY);
        });
        const endMindmapDrag = () => {
            if (!mindmapDragState || mindmapDragState.nodeId !== nodeEl.dataset.nodeId) return;
            finishMindmapDrag({ commit: true });
        };
        nodeEl.addEventListener('pointerup', endMindmapDrag);
        nodeEl.addEventListener('pointercancel', endMindmapDrag);
    });

    const stage = container.querySelector('#pcGoalMindmapStage');
    if (stage) {
        stage.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            if (e.target.closest('.pc-goal-mindmap-node')) return;
            cancelMindmapInertia();
            cancelMindmapCameraAnimation();
            const now = performance.now();
            mindmapPanSamples = [{ x: e.clientX, y: e.clientY, t: now }];
            mindmapPanState = {
                startX: e.clientX,
                startY: e.clientY,
                originX: mindmapTransform.x,
                originY: mindmapTransform.y,
                moved: false,
                lastX: e.clientX,
                lastY: e.clientY,
                lastT: now
            };
            stage.classList.add('is-panning');
        });
        stage.addEventListener('mousemove', (e) => {
            if (!mindmapPanState) return;
            const dx = e.clientX - mindmapPanState.startX;
            const dy = e.clientY - mindmapPanState.startY;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) mindmapPanState.moved = true;
            const now = performance.now();
            mindmapPanSamples.push({ x: e.clientX, y: e.clientY, t: now });
            if (mindmapPanSamples.length > 12) mindmapPanSamples.shift();
            mindmapPanState.lastX = e.clientX;
            mindmapPanState.lastY = e.clientY;
            mindmapPanState.lastT = now;
            mindmapTransform.x = mindmapPanState.originX + dx;
            mindmapTransform.y = mindmapPanState.originY + dy;
            updateMindmapTransform();
        });
        const endPan = (e) => {
            const state = mindmapPanState;
            mindmapPanState = null;
            stage.classList.remove('is-panning');
            if (state && state.moved) {
                const velocity = estimateMindmapPanVelocity(mindmapPanSamples);
                startMindmapPanInertia(velocity);
            }
            mindmapPanSamples = [];
            if (state && !state.moved && e && e.type === 'mouseup') {
                const target = e.target;
                if (target === stage || target.closest('.pc-goal-mindmap-world') === pageElRef?.querySelector('#pcGoalMindmapWorld')
                    || target.classList?.contains('pc-goal-mindmap-edges')
                    || target.classList?.contains('pc-goal-mindmap-nodes')) {
                    if (!target.closest?.('.pc-goal-mindmap-node')) {
                        mindmapSelectedId = null;
                        mindmapPendingFromId = null;
                        applyMindmapSelectionStyles();
                    }
                }
            }
        };
        stage.addEventListener('mouseup', endPan);
        stage.addEventListener('mouseleave', endPan);
        stage.addEventListener('click', (e) => {
            if (e.target.closest('.pc-goal-mindmap-node')) return;
            if (e.target.closest('.pc-goal-mindmap-toolbar') || e.target.closest('.pc-goal-mindmap-legend')) return;
            mindmapSelectedId = null;
            mindmapPendingFromId = null;
            applyMindmapSelectionStyles();
        });
        stage.addEventListener('wheel', (e) => {
            e.preventDefault();
            cancelMindmapInertia();
            cancelMindmapCameraAnimation();
            const rect = stage.getBoundingClientRect();
            const pointX = e.clientX - rect.left;
            const pointY = e.clientY - rect.top;
            if (e.shiftKey) {
                mindmapTransform = {
                    ...mindmapTransform,
                    x: mindmapTransform.x - e.deltaY,
                    y: mindmapTransform.y - e.deltaX
                };
                updateMindmapTransform();
                return;
            }
            mindmapTransform = zoomMindmapAtPoint(mindmapTransform, e.deltaY, pointX, pointY);
            updateMindmapTransform();
        }, { passive: false });
    }
}

function setupEvents(pageEl) {
    pageEl.querySelector('#pcGoalDetailBack')?.addEventListener('click', () => goBack());
    pageEl.querySelector('#pcGoalAddTask')?.addEventListener('click', addTask);
    pageEl.querySelector('#pcGoalViewList')?.addEventListener('click', () => {
        setViewMode('list', { scrollList: true });
    });
    pageEl.querySelector('#pcGoalViewMindmap')?.addEventListener('click', () => {
        // 再点当前「思维导图」：重新取景；有列表选中项则聚焦对应节点
        const focus = selectedTaskId || mindmapSelectedId || '';
        setViewMode('mindmap', {
            forceRefit: true,
            focusTaskId: focus || undefined
        });
    });
}

export { render, mount, unmount };
