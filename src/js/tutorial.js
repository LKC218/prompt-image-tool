import { isMobile } from './utils.js';

const TUTORIAL_KEY = 'tutorial_completed';
const HAND_DRAWN_JITTER = 3;

const STEPS = [
    {
        target: '#createBtn',
        title: '创建提示词',
        desc: '点击这里创建你的第一个提示词集合',
        position: 'right',
        mobileView: 'list'
    },
    {
        target: '#folderFilter',
        title: '文件夹分类',
        desc: '使用文件夹对提示词进行分类管理',
        position: 'right',
        mobileView: 'list'
    },
    {
        target: '#searchInput',
        title: '快速搜索',
        desc: '快速搜索你需要的提示词',
        position: 'right',
        mobileView: 'list'
    },
    {
        target: '#versionTabs',
        title: '版本管理',
        desc: '每个集合支持多个版本，方便对比和管理',
        position: 'bottom',
        mobileView: 'detail'
    },
    {
        target: '.add-image-zone',
        title: '上传参考图',
        desc: '上传参考图片，拖拽或点击即可添加',
        position: 'top',
        mobileView: 'detail'
    },
    {
        target: '#exportBtn',
        title: '导入/导出',
        desc: '支持 JSON 格式导入导出你的数据',
        position: 'bottom',
        mobileView: 'any'
    },
    {
        target: '#syncBtn',
        title: '局域网同步',
        desc: '局域网同步，将手机数据同步到电脑端',
        position: 'bottom',
        mobileView: 'any'
    },
    {
        target: '#themeToggleBtn',
        title: '主题切换',
        desc: '切换暗色/亮色主题',
        position: 'bottom',
        mobileView: 'any'
    },
    {
        target: '#helpBtn',
        title: '使用帮助',
        desc: '随时查看使用帮助',
        position: 'bottom',
        mobileView: 'any'
    }
];

export class TutorialGuide {
    constructor() {
        this.currentStep = 0;
        this.isActive = false;
        this.overlay = null;
        this.spotlight = null;
        this.tooltip = null;
        this.svgLayer = null;
        this.resizeHandler = null;
        this.onComplete = null;
        this._savedMobileView = null;
    }

    start(onComplete) {
        if (this.isActive) return;
        this.onComplete = onComplete || null;
        this.currentStep = 0;
        this.isActive = true;
        this._createElements();
        this.resizeHandler = () => this._positionCurrentStep();
        window.addEventListener('resize', this.resizeHandler);
        this._showStep();
    }

    skip() {
        this._complete();
    }

    _complete() {
        this.isActive = false;
        localStorage.setItem(TUTORIAL_KEY, 'true');
        this._removeElements();
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
            this.resizeHandler = null;
        }
        if (this.onComplete) this.onComplete();
    }

    _createElements() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'tutorial-overlay';
        this.overlay.id = 'tutorialOverlay';

        this.spotlight = document.createElement('div');
        this.spotlight.className = 'tutorial-spotlight';

        this.svgLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svgLayer.classList.add('tutorial-svg-layer');
        this.svgLayer.setAttribute('width', '100%');
        this.svgLayer.setAttribute('height', '100%');

        this.tooltip = document.createElement('div');
        this.tooltip.className = 'tutorial-tooltip';

        this.overlay.appendChild(this.spotlight);
        this.overlay.appendChild(this.svgLayer);
        this.overlay.appendChild(this.tooltip);
        document.body.appendChild(this.overlay);

        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) e.stopPropagation();
        });
    }

    _removeElements() {
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
        this.overlay = null;
        this.spotlight = null;
        this.tooltip = null;
        this.svgLayer = null;
    }

    _showStep() {
        const step = STEPS[this.currentStep];
        if (!step) {
            this._complete();
            return;
        }

        const targetEl = document.querySelector(step.target);
        if (!targetEl || getComputedStyle(targetEl).display === 'none') {
            this._nextStep();
            return;
        }

        if (isMobile() && step.mobileView !== 'any') {
            return;
        }

        if (step.target === '.add-image-zone' && !document.querySelector('.add-image-zone')) {
            this._nextStep();
            return;
        }

        this._positionCurrentStep();
    }

    _switchMobileView(view) {
        return;
    }

    _positionCurrentStep() {
        if (!this.isActive) return;

        const step = STEPS[this.currentStep];
        if (!step) return;

        const targetEl = document.querySelector(step.target);
        if (!targetEl) return;

        const isLast = this.currentStep === STEPS.length - 1;
        const stepNum = this.currentStep + 1;
        const totalSteps = STEPS.length;

        this.tooltip.innerHTML = `
            <div class="tutorial-tooltip-title">${step.title}</div>
            <div class="tutorial-tooltip-desc">${step.desc}</div>
            <div class="tutorial-tooltip-footer">
                <span class="tutorial-tooltip-step">${stepNum} / ${totalSteps}</span>
                <div class="tutorial-tooltip-actions">
                    <button class="tutorial-btn-skip" id="tutorialSkipBtn">跳过教程</button>
                    <button class="tutorial-btn-next" id="tutorialNextBtn">${isLast ? '完成' : '下一步'}</button>
                </div>
            </div>
        `;

        document.getElementById('tutorialSkipBtn').onclick = () => this.skip();
        document.getElementById('tutorialNextBtn').onclick = () => {
            if (isLast) {
                this._complete();
            } else {
                this._nextStep();
            }
        };

        const rect = targetEl.getBoundingClientRect();
        const padding = 8;

        this.spotlight.style.top = (rect.top - padding) + 'px';
        this.spotlight.style.left = (rect.left - padding) + 'px';
        this.spotlight.style.width = (rect.width + padding * 2) + 'px';
        this.spotlight.style.height = (rect.height + padding * 2) + 'px';

        this.tooltip.style.visibility = 'hidden';
        this._positionTooltip(rect, step.position);

        requestAnimationFrame(() => {
            this._drawArrow(rect, step.position);
            this.tooltip.style.visibility = 'visible';
            this._adjustTooltipOverflow();
        });

        this.overlay.classList.add('active');
    }

    _nextStep() {
        this.currentStep++;
        if (this.currentStep >= STEPS.length) {
            this._complete();
        } else {
            this._showStep();
        }
    }

    _positionTooltip(targetRect, position) {
        const tooltip = this.tooltip;
        tooltip.style.top = 'auto';
        tooltip.style.left = 'auto';
        tooltip.style.right = 'auto';
        tooltip.style.bottom = 'auto';
        tooltip.style.transform = 'none';

        const gap = 20;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        switch (position) {
            case 'right':
                tooltip.style.top = (targetRect.top + targetRect.height / 2) + 'px';
                tooltip.style.left = (targetRect.right + gap) + 'px';
                tooltip.style.transform = 'translateY(-50%)';
                break;
            case 'left':
                tooltip.style.top = (targetRect.top + targetRect.height / 2) + 'px';
                tooltip.style.right = (vw - targetRect.left + gap) + 'px';
                tooltip.style.transform = 'translateY(-50%)';
                break;
            case 'bottom':
                tooltip.style.top = (targetRect.bottom + gap) + 'px';
                tooltip.style.left = (targetRect.left + targetRect.width / 2) + 'px';
                tooltip.style.transform = 'translateX(-50%)';
                break;
            case 'top':
                tooltip.style.bottom = (vh - targetRect.top + gap) + 'px';
                tooltip.style.left = (targetRect.left + targetRect.width / 2) + 'px';
                tooltip.style.transform = 'translateX(-50%)';
                break;
        }
    }

    _adjustTooltipOverflow() {
        const tooltip = this.tooltip;
        const rect = tooltip.getBoundingClientRect();
        const margin = 12;

        if (rect.left < margin) {
            const currentLeft = parseFloat(tooltip.style.left) || 0;
            tooltip.style.left = (currentLeft + (margin - rect.left)) + 'px';
        }
        if (rect.right > window.innerWidth - margin) {
            const currentLeft = parseFloat(tooltip.style.left) || 0;
            tooltip.style.left = (currentLeft - (rect.right - window.innerWidth + margin)) + 'px';
        }
        if (rect.top < margin) {
            const currentTop = parseFloat(tooltip.style.top) || 0;
            tooltip.style.top = (currentTop + (margin - rect.top)) + 'px';
        }
        if (rect.bottom > window.innerHeight - margin) {
            const currentTop = parseFloat(tooltip.style.top) || 0;
            tooltip.style.top = (currentTop - (rect.bottom - window.innerHeight + margin)) + 'px';
        }
    }

    _drawArrow(targetRect, position) {
        while (this.svgLayer.firstChild) {
            this.svgLayer.removeChild(this.svgLayer.firstChild);
        }

        const tooltipRect = this.tooltip.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        this.svgLayer.setAttribute('viewBox', `0 0 ${vw} ${vh}`);

        const startEdgeGap = 8;
        const arrowSize = 12;
        const arrowHalfWidth = 5;
        const spotlightPad = 8;
        const tipGap = 3;

        let startX, startY, arrowTipX, arrowTipY, arrowBaseX, arrowBaseY;

        switch (position) {
            case 'right':
                startX = tooltipRect.left - startEdgeGap;
                startY = tooltipRect.top + tooltipRect.height / 2;
                arrowTipX = targetRect.right + spotlightPad + tipGap;
                arrowTipY = targetRect.top + targetRect.height / 2;
                arrowBaseX = arrowTipX + arrowSize;
                arrowBaseY = arrowTipY;
                break;
            case 'left':
                startX = tooltipRect.right + startEdgeGap;
                startY = tooltipRect.top + tooltipRect.height / 2;
                arrowTipX = targetRect.left - spotlightPad - tipGap;
                arrowTipY = targetRect.top + targetRect.height / 2;
                arrowBaseX = arrowTipX - arrowSize;
                arrowBaseY = arrowTipY;
                break;
            case 'bottom':
                startX = tooltipRect.left + tooltipRect.width / 2;
                startY = tooltipRect.top - startEdgeGap;
                arrowTipX = targetRect.left + targetRect.width / 2;
                arrowTipY = targetRect.bottom + spotlightPad + tipGap;
                arrowBaseX = arrowTipX;
                arrowBaseY = arrowTipY + arrowSize;
                break;
            case 'top':
                startX = tooltipRect.left + tooltipRect.width / 2;
                startY = tooltipRect.bottom + startEdgeGap;
                arrowTipX = targetRect.left + targetRect.width / 2;
                arrowTipY = targetRect.top - spotlightPad - tipGap;
                arrowBaseX = arrowTipX;
                arrowBaseY = arrowTipY - arrowSize;
                break;
        }

        this._createHandDrawnPath(startX, startY, arrowBaseX, arrowBaseY, position);

        const arrowHead = this._createArrowHead(arrowTipX, arrowTipY, arrowBaseX, arrowBaseY, arrowHalfWidth);
        this.svgLayer.appendChild(arrowHead);
    }

    _createHandDrawnPath(x1, y1, x2, y2, position) {
        let cx1, cy1, cx2, cy2;

        if (position === 'right' || position === 'left') {
            const midX = (x1 + x2) / 2;
            cx1 = midX + this._jitter();
            cy1 = y1 + this._jitter();
            cx2 = midX + this._jitter();
            cy2 = y2 + this._jitter();
        } else {
            const midY = (y1 + y2) / 2;
            cx1 = x1 + this._jitter();
            cy1 = midY + this._jitter();
            cx2 = x2 + this._jitter();
            cy2 = midY + this._jitter();
        }

        const d = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('stroke', '#8B6914');
        path.setAttribute('stroke-width', '2.5');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-linecap', 'round');
        path.classList.add('tutorial-arrow-path');

        this.svgLayer.appendChild(path);

        let length = 300;
        try { length = path.getTotalLength(); } catch(e) {}

        path.style.strokeDasharray = length;
        path.style.strokeDashoffset = length;
        path.style.animation = 'tutorialDrawLine 0.6s ease forwards';

        return path;
    }

    _createArrowHead(tipX, tipY, baseX, baseY, halfWidth) {
        const dx = baseX - tipX;
        const dy = baseY - tipY;
        const len = Math.sqrt(dx * dx + dy * dy);
        const ux = dx / len;
        const uy = dy / len;
        const px = -uy * halfWidth;
        const py = ux * halfWidth;

        const p1x = tipX;
        const p1y = tipY;
        const p2x = baseX + px;
        const p2y = baseY + py;
        const p3x = baseX - px;
        const p3y = baseY - py;

        const points = `${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y}`;

        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', points);
        polygon.setAttribute('fill', '#8B6914');
        polygon.style.opacity = '0';
        polygon.style.animation = 'tutorialFadeIn 0.3s ease 0.5s forwards';

        return polygon;
    }

    _jitter() {
        return (Math.random() - 0.5) * HAND_DRAWN_JITTER * 2;
    }
}

export function isTutorialCompleted() {
    return localStorage.getItem(TUTORIAL_KEY) === 'true';
}

export function resetTutorialFlag() {
    localStorage.removeItem(TUTORIAL_KEY);
}
