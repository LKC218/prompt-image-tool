import { escapeHtml } from './pc-utils.js';

const STAGE_LABELS = [
    { key: 'downloading', label: '下载安装包' },
    { key: 'verifying', label: '校验完整性' },
    { key: 'installing', label: '启动安装' },
];

const PHASE_TO_STAGE = {
    pending: 'downloading',
    downloading: 'downloading',
    verifying: 'verifying',
    installing: 'installing',
    ready: 'installing',
};

function formatBytes(bytes) {
    const n = Number(bytes) || 0;
    if (n <= 0) return '0 B';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function stageStatus(stageKey, currentStage, phase) {
    if (phase === 'failed' || phase === 'cancelled') {
        const index = STAGE_LABELS.findIndex((s) => s.key === currentStage);
        const stageIndex = STAGE_LABELS.findIndex((s) => s.key === stageKey);
        if (stageIndex < index) return 'done';
        if (stageIndex === index) return 'active';
        return 'waiting';
    }
    if (phase === 'ready' || phase === 'installing') {
        return 'done';
    }
    const order = ['downloading', 'verifying', 'installing'];
    const cur = order.indexOf(currentStage);
    const idx = order.indexOf(stageKey);
    if (idx < cur) return 'done';
    if (idx === cur) return 'active';
    return 'waiting';
}

export function formatUpdateProgressLine(progress) {
    const downloaded = formatBytes(progress?.downloaded);
    if (!progress?.total) {
        return `${downloaded} 已下载`;
    }
    const total = formatBytes(progress.total);
    const speed = progress.speed > 0 ? ` · ${formatBytes(progress.speed)}/s` : '';
    return `${downloaded} / ${total}${speed}`;
}

export function openUpdateProgressModal({ onCancel, onRetry } = {}) {
    const existing = document.getElementById('pcUpdateProgressOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'pc-update-progress-overlay';
    overlay.id = 'pcUpdateProgressOverlay';
    overlay.innerHTML = `
        <div class="pc-update-progress-modal" role="dialog" aria-modal="true" aria-labelledby="pcUpdateProgressTitle" aria-describedby="pcUpdateProgressStatus">
            <h3 id="pcUpdateProgressTitle">正在更新</h3>
            <p class="pc-update-progress-desc" id="pcUpdateProgressStatus" aria-live="polite">准备下载…</p>
            <div class="pc-update-progress-row">
                <div
                    class="pc-update-progress-bar"
                    id="pcUpdateProgressBar"
                    role="progressbar"
                    aria-label="更新进度"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-valuenow="0"
                >
                    <div class="pc-update-progress-fill" id="pcUpdateProgressFill"></div>
                    <div class="pc-update-progress-indeterminate" id="pcUpdateProgressIndeterminate" hidden></div>
                </div>
                <strong class="pc-update-progress-percent" id="pcUpdateProgressPercent">0%</strong>
            </div>
            <p class="pc-update-progress-meta" id="pcUpdateProgressMeta"></p>
            <ul class="pc-update-stage-list" id="pcUpdateStageList" aria-label="更新阶段">
                ${STAGE_LABELS.map((stage) => `
                    <li data-stage="${stage.key}" class="waiting">
                        <span class="stage-dot" aria-hidden="true"></span>
                        <span>${stage.label}</span>
                        <strong>等待中</strong>
                    </li>
                `).join('')}
            </ul>
            <div class="pc-update-progress-error" id="pcUpdateProgressError" hidden></div>
            <div class="pc-update-progress-actions" id="pcUpdateProgressActions"></div>
        </div>
    `;

    const app = document.getElementById('pcApp') || document.body;
    app.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('pc-update-progress-active'));

    const statusEl = overlay.querySelector('#pcUpdateProgressStatus');
    const barEl = overlay.querySelector('#pcUpdateProgressBar');
    const fillEl = overlay.querySelector('#pcUpdateProgressFill');
    const indeterminateEl = overlay.querySelector('#pcUpdateProgressIndeterminate');
    const percentEl = overlay.querySelector('#pcUpdateProgressPercent');
    const metaEl = overlay.querySelector('#pcUpdateProgressMeta');
    const stageListEl = overlay.querySelector('#pcUpdateStageList');
    const errorEl = overlay.querySelector('#pcUpdateProgressError');
    const actionsEl = overlay.querySelector('#pcUpdateProgressActions');

    let active = true;

    function renderStages(phase, currentStage) {
        stageListEl.querySelectorAll('li').forEach((li) => {
            const key = li.dataset.stage;
            const status = stageStatus(key, currentStage, phase);
            li.className = status;
            const strong = li.querySelector('strong');
            strong.textContent = status === 'done' ? '已完成' : status === 'active' ? '进行中' : '等待中';
        });
    }

    function setActions(mode) {
        actionsEl.innerHTML = '';
        if (mode === 'cancel') {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'pc-btn pc-btn-secondary';
            btn.id = 'pcUpdateProgressCancelBtn';
            btn.textContent = '取消更新';
            btn.addEventListener('click', () => onCancel?.());
            actionsEl.appendChild(btn);
            return;
        }
        if (mode === 'retry') {
            const retry = document.createElement('button');
            retry.type = 'button';
            retry.className = 'pc-btn pc-btn-primary';
            retry.id = 'pcUpdateProgressRetryBtn';
            retry.textContent = '重试';
            retry.addEventListener('click', () => onRetry?.());
            actionsEl.appendChild(retry);
        }
        const close = document.createElement('button');
        close.type = 'button';
        close.className = mode === 'retry' ? 'pc-btn pc-btn-secondary' : 'pc-btn pc-btn-primary';
        close.id = 'pcUpdateProgressCloseBtn';
        close.textContent = mode === 'success' ? '知道了' : '关闭';
        close.addEventListener('click', () => destroy());
        actionsEl.appendChild(close);
    }

    function destroy() {
        if (!active) return;
        active = false;
        overlay.classList.remove('pc-update-progress-active');
        setTimeout(() => overlay.remove(), 200);
    }

    function onKeydown(event) {
        if (event.key === 'Escape' && active) {
            event.preventDefault();
            event.stopPropagation();
        }
    }
    document.addEventListener('keydown', onKeydown, true);

    setActions('cancel');

    return {
        setProgress(progress = {}) {
            if (!active) return;
            const phase = progress.phase || 'pending';
            const currentStage = PHASE_TO_STAGE[phase] || 'downloading';
            const percent = Number(progress.percent) || 0;
            const indeterminate = phase !== 'downloading' || !progress.total;

            if (phase === 'pending') {
                statusEl.textContent = '准备下载…';
            } else if (phase === 'downloading') {
                statusEl.textContent = '正在下载安装包…';
            } else if (phase === 'verifying') {
                statusEl.textContent = '正在校验安装包完整性…';
            } else if (phase === 'installing') {
                statusEl.textContent = '正在启动安装程序…';
            } else if (phase === 'ready') {
                statusEl.textContent = '安装程序已启动，应用即将退出';
            } else if (phase === 'failed') {
                statusEl.textContent = '更新失败';
            } else if (phase === 'cancelled') {
                statusEl.textContent = '已取消更新';
            }

            if (indeterminate) {
                fillEl.style.width = phase === 'ready' || phase === 'installing' || phase === 'verifying' ? '100%' : '0%';
                indeterminateEl.hidden = false;
                percentEl.textContent = phase === 'ready' ? '完成' : '';
            } else {
                indeterminateEl.hidden = true;
                fillEl.style.width = `${Math.min(100, Math.max(0, percent))}%`;
                percentEl.textContent = `${Math.round(percent)}%`;
            }
            barEl.setAttribute('aria-valuenow', String(Math.round(percent)));

            metaEl.textContent = phase === 'downloading' || phase === 'pending'
                ? formatUpdateProgressLine(progress)
                : '';
            errorEl.hidden = phase !== 'failed';
            errorEl.textContent = phase === 'failed' ? (progress.error || '更新失败') : '';

            renderStages(phase, currentStage);

            if (phase === 'ready' || phase === 'installing') {
                setActions('none');
            } else if (phase === 'failed' || phase === 'cancelled') {
                setActions('retry');
            } else {
                setActions('cancel');
            }
        },
        close: destroy,
        isActive: () => active,
    };
}
