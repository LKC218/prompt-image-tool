import { getStorage } from '../core/storage.js';
import { navigate } from './pc-router.js';
import { showToast, showConfirmModal, showPromptModal, showContextMenu, escapeHtml } from './pc-utils.js';
import {
    generateGoalId,
    calcTaskTreeStats,
    getGoalImageUrl,
    getProjectInitials,
    generateProjectCoverGradient,
    importGoalProjectCover,
    formatBytes,
    GOAL_COVER_ALLOWED_TYPES,
    GOAL_COVER_MAX_SOURCE_BYTES
} from '../goal/goal-utils.js';
import { requestOpenMindmapView } from '../goal/goal-mindmap-core.js';
import { renderPcWelcomeBanner, renderPcWelcomeWalkAnimation } from './pc-welcome-banner.js';
import { setupCardParallaxTilt, clearCardParallaxIn } from './pc-card-parallax.js';
import plusIcon from '../../assets/icons/plus.svg';
import moreIcon from '../../assets/icons/more-horizontal.svg';
import imageIcon from '../../assets/icons/image.svg';
import renameIcon from '../../assets/icons/pencil-line.svg';
import copyIcon from '../../assets/icons/copy.svg';
import deleteIcon from '../../assets/icons/trash-2.svg';
import sortIcon from '../../assets/icons/arrow-up-down.svg';
import checkIcon from '../../assets/icons/check.svg';
import rabbitTip from '../../assets/mobile/mascots/rabbit-tip.png';

const PROJECT_SORT_KEY = 'pc-goal-project-sort';
const PROJECT_SORT_OPTIONS = [
    { key: 'default', label: '默认顺序' },
    { key: 'name', label: '按名称' },
    { key: 'createdAt', label: '按创建时间' },
    { key: 'updatedAt', label: '按更新时间' },
    { key: 'progress', label: '按进度' },
    { key: 'imageBytes', label: '按存储大小' }
];

let projects = [];
let pageElRef = null;
let currentSort = loadProjectSort();

function loadProjectSort() {
    try {
        const saved = localStorage.getItem(PROJECT_SORT_KEY);
        return PROJECT_SORT_OPTIONS.some(o => o.key === saved) ? saved : 'default';
    } catch (_) {
        return 'default';
    }
}

function saveProjectSort(key) {
    currentSort = key;
    try {
        localStorage.setItem(PROJECT_SORT_KEY, key);
    } catch (_) { /* ignore */ }
}

function applyProjectSort(list) {
    const sorted = [...list];
    switch (currentSort) {
        case 'name':
            return sorted.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-CN'));
        case 'createdAt':
            return sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        case 'updatedAt':
            return sorted.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
        case 'progress':
            return sorted.sort((a, b) => (b.progress || 0) - (a.progress || 0));
        case 'imageBytes':
            return sorted.sort((a, b) => (b.imageBytes || 0) - (a.imageBytes || 0));
        default:
            return sorted.sort((a, b) => (a.order || 0) - (b.order || 0));
    }
}

function getSortLabel() {
    return PROJECT_SORT_OPTIONS.find(o => o.key === currentSort)?.label || '默认顺序';
}

function iconImg(icon, alt = '') {
    return `<img src="${icon}" alt="${escapeHtml(alt)}" aria-hidden="${alt ? 'false' : 'true'}">`;
}

function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function render(params = {}) {
    return `
        ${renderPcWelcomeBanner({
            title: '目标计划',
            subtitle: '把大目标拆成小任务，一步步达成~',
            className: 'pc-welcome-banner-category',
            decorationsHtml: renderPcWelcomeWalkAnimation({ variant: 'category' })
        })}

        <div class="pc-goal-projects-page">
            <div class="pc-goal-projects-header">
                <h2 class="pc-goal-projects-title">我的项目</h2>
                <div class="pc-goal-projects-actions">
                    <button class="pc-icon-btn pc-goal-project-sort" id="pcGoalProjectSort" type="button" aria-label="项目排序" aria-haspopup="menu" aria-expanded="false" title="排序：${escapeHtml(getSortLabel())}">
                        ${iconImg(sortIcon)}
                    </button>
                    <button class="pc-btn pc-btn-primary pc-btn-sm" id="pcGoalCreateProject">
                        <span class="pc-btn-icon">${iconImg(plusIcon)}</span>
                        <span>新建项目</span>
                    </button>
                </div>
            </div>
            <div id="pcGoalProjectList" class="pc-goal-projects-list"></div>
        </div>
    `;
}

async function mount(pageEl, params = {}) {
    pageElRef = pageEl;
    await loadProjects();
    setupEvents(pageEl);
}

function unmount(pageEl) {
    clearCardParallaxIn(pageElRef, '.pc-goal-project-card');
    pageElRef = null;
}

async function loadProjects() {
    try {
        const storage = getStorage();
        projects = await storage.getGoalProjects();
        renderList();
    } catch (e) {
        console.error('loadProjects error:', e);
        showToast('加载项目失败', 'error');
    }
}

function renderList() {
    const container = pageElRef?.querySelector('#pcGoalProjectList');
    if (!container) return;

    if (projects.length === 0) {
        container.innerHTML = `
            <div class="pc-empty-state pc-goal-projects-empty">
                <span class="pc-empty-icon">${iconImg(rabbitTip, '目标计划')}</span>
                <span class="pc-empty-text">还没有项目，点击右上角创建第一个目标计划吧</span>
            </div>
        `;
        return;
    }

    const storage = getStorage();
    const sorted = applyProjectSort(projects);
    container.innerHTML = sorted.map(p => {
        const gradient = generateProjectCoverGradient(p.name);
        const initials = escapeHtml(getProjectInitials(p.name));
        const coverHtml = p.coverImage
            ? `<img src="${getGoalImageUrl(storage, p.coverImage)}" alt="" loading="lazy" data-goal-cover-fallback data-name="${escapeHtml(p.name)}">`
            : `<div class="pc-goal-project-cover-gradient" style="background: ${gradient}"><span class="pc-goal-project-cover-initials">${initials}</span></div>`;
        return `
        <div class="pc-goal-project-card" data-project-id="${escapeHtml(p.id)}">
            <div class="pc-goal-project-cover" data-gradient="${gradient}" data-initials="${initials}">${coverHtml}</div>
            <div class="pc-goal-project-body">
                <div class="pc-goal-project-header">
                    <h3 class="pc-goal-project-name" title="${escapeHtml(p.name)}"><span>${escapeHtml(p.name)}</span></h3>
                    <button class="pc-icon-btn pc-goal-project-more" type="button" aria-label="更多操作" data-project-id="${escapeHtml(p.id)}">
                        ${iconImg(moreIcon)}
                    </button>
                </div>
                <div class="pc-goal-project-meta">
                    <span>${p.taskCount} 个任务</span>
                    <span>·</span>
                    <span>${formatBytes(p.imageBytes || 0)}</span>
                    <span>·</span>
                    <span>更新于 ${formatDate(p.updatedAt)}</span>
                </div>
                <div class="pc-goal-project-progress-wrap">
                    <div class="pc-goal-project-progress-bar">
                        <div class="pc-goal-project-progress-fill" style="width: ${p.progress || 0}%"></div>
                    </div>
                    <span class="pc-goal-project-progress-text">${p.progress || 0}%</span>
                </div>
            </div>
        </div>
    `}).join('');

    setupProjectNameMarquee(container);
    setupCoverFallback(container);
    setupCardParallaxTilt(container, { cardSelector: '.pc-goal-project-card' });
}

// 封面加载失败时回退为首字母渐变，避免裂图
function setupCoverFallback(container) {
    container.querySelectorAll('img[data-goal-cover-fallback]').forEach(img => {
        img.addEventListener('error', () => {
            const wrap = img.closest('.pc-goal-project-cover');
            if (!wrap) return;
            const gradient = wrap.dataset.gradient || generateProjectCoverGradient(img.dataset.name || '');
            const initials = wrap.dataset.initials || escapeHtml(getProjectInitials(img.dataset.name || ''));
            wrap.innerHTML = `<div class="pc-goal-project-cover-gradient" style="background: ${gradient}"><span class="pc-goal-project-cover-initials">${initials}</span></div>`;
        }, { once: true });
    });
}

// 项目名称溢出时启动往返滚动（复用提示词库名称滚动模式）
function setupProjectNameMarquee(container) {
    if (!container || window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;

    container.querySelectorAll('.pc-goal-project-name').forEach((name, index) => {
        name.classList.remove('is-overflow');
        name.style.removeProperty('--pc-goal-name-shift');
        name.style.removeProperty('--pc-goal-name-duration');
        name.style.removeProperty('--pc-goal-name-delay');

        const distance = name.scrollWidth - name.clientWidth;
        if (distance <= 1) return;

        const duration = Math.min(14, Math.max(8, 7 + distance / 35));
        name.style.setProperty('--pc-goal-name-shift', `-${distance}px`);
        name.style.setProperty('--pc-goal-name-duration', `${duration.toFixed(2)}s`);
        name.style.setProperty('--pc-goal-name-delay', `${(0.8 + (index % 5) * 0.14).toFixed(2)}s`);
        name.classList.add('is-overflow');
    });
}

function setupEvents(pageEl) {
    pageEl.querySelector('#pcGoalCreateProject')?.addEventListener('click', createProject);
    pageEl.querySelector('#pcGoalProjectSort')?.addEventListener('click', (e) => {
        e.stopPropagation();
        showSortMenu(e.currentTarget);
    });

    pageEl.querySelector('#pcGoalProjectList')?.addEventListener('click', (e) => {
        const card = e.target.closest('.pc-goal-project-card');
        const moreBtn = e.target.closest('.pc-goal-project-more');
        if (moreBtn) {
            e.stopPropagation();
            showProjectMenu(moreBtn.dataset.projectId, moreBtn);
            return;
        }
        if (card) {
            navigate(`/goals/${card.dataset.projectId}`);
        }
    });
}

async function createProject() {
    showPromptModal('请输入项目名称', '新项目', async (name) => {
        try {
            const storage = getStorage();
            const project = await storage.createGoalProject(name);
            projects.push(project);
            renderList();
            showToast('项目创建成功');
        } catch (e) {
            console.error('createProject error:', e);
            showToast('创建项目失败', 'error');
        }
    });
}

async function renameProject(id) {
    const project = projects.find(p => p.id === id);
    if (!project) return;
    showPromptModal('重命名项目', project.name, async (name) => {
        try {
            const storage = getStorage();
            await storage.updateGoalProject(id, { name });
            project.name = name;
            renderList();
            showToast('已重命名');
        } catch (e) {
            console.error('renameProject error:', e);
            showToast('重命名失败', 'error');
        }
    });
}

async function deleteProject(id) {
    const project = projects.find(p => p.id === id);
    if (!project) return;
    showConfirmModal(
        `确定删除「${project.name}」吗？该项目下的所有任务和图片都会被删除，且无法恢复。`,
        async () => {
            try {
                const storage = getStorage();
                await storage.deleteGoalProject(id);
                projects = projects.filter(p => p.id !== id);
                renderList();
                showToast('项目已删除');
            } catch (e) {
                console.error('deleteProject error:', e);
                showToast('删除失败', 'error');
            }
        }
    );
}

async function copyProject(id) {
    const project = projects.find(p => p.id === id);
    if (!project) return;
    try {
        const storage = getStorage();
        const sourceTasks = await storage.getGoalTasks(id);
        const copiedTasks = JSON.parse(JSON.stringify(sourceTasks || []));
        function regenerateTaskIds(taskList) {
            for (const task of taskList) {
                task.id = generateGoalId();
                if (task.children && task.children.length > 0) {
                    regenerateTaskIds(task.children);
                }
            }
            return taskList;
        }
        const newProject = await storage.createGoalProject(`${project.name} 副本`);
        await storage.updateGoalTasks(newProject.id, regenerateTaskIds(copiedTasks));
        newProject.name = `${project.name} 副本`;
        Object.assign(newProject, calcTaskTreeStats(copiedTasks));
        projects.push(newProject);
        renderList();
        showToast('项目复制成功');
    } catch (e) {
        console.error('copyProject error:', e);
        showToast('复制项目失败', 'error');
    }
}

async function setProjectCover(id) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = GOAL_COVER_ALLOWED_TYPES.join(',');
    input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;

        if (!GOAL_COVER_ALLOWED_TYPES.includes(file.type)) {
            showToast(`${file.name} 格式不支持，已跳过`, 'warning');
            return;
        }
        if (file.size > GOAL_COVER_MAX_SOURCE_BYTES) {
            showToast(`${file.name} 超过 15MB，已跳过`, 'warning');
            return;
        }

        showToast('正在处理封面...');
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const storage = getStorage();
                const project = projects.find(p => p.id === id);
                const relPath = await importGoalProjectCover(storage, id, reader.result, file.name);
                if (!relPath) throw new Error('封面保存失败');
                await storage.updateGoalProject(id, { coverImage: relPath, coverColor: '' });
                if (project) {
                    project.coverImage = relPath;
                    project.coverColor = '';
                    project.updatedAt = new Date().toISOString();
                }
                renderList();
                showToast('封面设置成功');
            } catch (e) {
                console.error('setProjectCover error:', e);
                showToast('设置封面失败', 'error');
            }
        };
        reader.onerror = () => showToast('封面读取失败', 'error');
        reader.readAsDataURL(file);
    };
    input.click();
}

async function showSortMenu(anchorEl) {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const items = PROJECT_SORT_OPTIONS.map(opt => ({
        action: `sort:${opt.key}`,
        label: opt.label,
        icon: opt.key === currentSort ? iconImg(checkIcon) : ''
    }));
    const action = await showContextMenu(rect.left, rect.bottom + 8, items, {
        anchor: anchorEl,
        source: 'more'
    });
    if (!action?.startsWith('sort:')) return;
    const nextKey = action.slice(5);
    if (nextKey === currentSort) return;
    saveProjectSort(nextKey);
    anchorEl.title = `排序：${getSortLabel()}`;
    renderList();
}

async function showProjectMenu(id, anchorEl) {
    const project = projects.find(p => p.id === id);
    if (!project || !anchorEl) return;

    const rect = anchorEl.getBoundingClientRect();
    const action = await showContextMenu(rect.right + 8, rect.bottom + 8, [
        { action: 'openMindmap', icon: iconImg(sortIcon), tone: 'default', label: '查看思维导图' },
        { action: 'setCover', icon: iconImg(imageIcon), tone: 'default', label: '设置封面' },
        { action: 'rename', icon: iconImg(renameIcon), tone: 'rename', label: '重命名' },
        { action: 'copy', icon: iconImg(copyIcon), tone: 'copy', label: '复制' },
        { action: 'delete', icon: iconImg(deleteIcon), tone: 'delete', label: '删除', danger: true }
    ], { anchor: anchorEl, source: 'more' });

    if (action === 'openMindmap') {
        // URL params.view 优先；一次性标记作兼容回退
        requestOpenMindmapView(window.localStorage, id);
        navigate(`/goals/${id}`, { view: 'mindmap' });
    } else if (action === 'setCover') setProjectCover(id);
    else if (action === 'rename') renameProject(id);
    else if (action === 'copy') copyProject(id);
    else if (action === 'delete') deleteProject(id);
}

export { render, mount, unmount };
