// PC 端切页「多层速度差与物理弹簧」动效编排器（固定 1.25x 饱满爽快档）

export const KINETIC_INTENSITY = 1.25;

const ROUTE_ORDER = [
    '/',
    '/library',
    '/editor/:id',
    '/compress',
    '/goals',
    '/category',
    '/games',
    '/settings',
];

const JELLY_BAR_HEIGHT = 22;
const MAX_BURST_ITEMS = 12;
const MAX_TABLE_ROWS = 8;

const MID_LAYER_SELECTOR = [
    '.pc-home-search-bar',
    '.pc-library-search-row',
    '.pc-category-segment',
    '.pc-goal-projects-header',
    '.png-toolbar',
    '.pc-editor-header',
].join(', ');

const CARD_BURST_SELECTOR = [
    '.pc-stat-card',
    '.pc-recent-item',
    '.pc-home-category-card',
    '.pc-home-quick-card',
    '.pc-library-table-panel',
    '.pc-library-preview-panel',
    '#pcLibraryContent > .pc-empty-state',
    '.pc-goal-project-card',
    '#pcGoalProjectList > .pc-empty-state',
    '.pc-category-card-panel',
    '.pc-tag-manage-panel',
    '.pc-games-card',
    '.pc-settings-panel',
    '.png-panel',
    '.pc-editor-main > *',
    '.pc-detail-main > *',
    '.pc-detail-side > *',
].join(', ');

const COUNTUP_SELECTOR = [
    '#pcStatTotal',
    '#pcStatCategories',
    '#pcStatTags',
    '#pcStatFavorites',
    '.pc-goal-project-progress-text',
].join(', ');

export function prefersReducedMotion() {
    return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
}

export function canAnimateElement(el) {
    return Boolean(el && !prefersReducedMotion() && typeof el.animate === 'function');
}

export function normalizeRouteAnchor(routeKey = '') {
    if (!routeKey) return '/';
    if (routeKey === '/editor/' || routeKey.startsWith('/editor')) return '/editor/:id';
    if (routeKey.startsWith('/detail')) return '/library';
    if (routeKey.startsWith('/goals')) return '/goals';
    if (routeKey === '/tetris' || routeKey === '/plane') return '/games';
    return routeKey;
}

export function resolveTransitionVector(oldRouteKey, newRouteKey, direction = 'tab') {
    if (!oldRouteKey) {
        return { mode: 'initial', axis: 'y', sign: 1 };
    }
    if (direction === 'push') {
        return { mode: 'push', axis: 'x', sign: 1 };
    }
    if (direction === 'pop') {
        return { mode: 'pop', axis: 'x', sign: -1 };
    }

    const prevAnchor = normalizeRouteAnchor(oldRouteKey);
    const nextAnchor = normalizeRouteAnchor(newRouteKey);
    if (prevAnchor === nextAnchor && oldRouteKey === newRouteKey) {
        return { mode: 'refresh', axis: 'y', sign: 1 };
    }

    const oldIdx = ROUTE_ORDER.indexOf(prevAnchor);
    const newIdx = ROUTE_ORDER.indexOf(nextAnchor);
    if (oldIdx === -1 || newIdx === -1 || newIdx >= oldIdx) {
        return { mode: 'tab-down', axis: 'y', sign: 1 };
    }
    return { mode: 'tab-up', axis: 'y', sign: -1 };
}

/**
 * 侧栏左侧果冻拉伸弹簧滑条控制器
 */
export function createSidebarJellyController(appEl) {
    const navEl = appEl?.querySelector('#pcSidebarNav');
    if (!navEl) {
        return { sync: () => {}, dispose: () => {} };
    }

    let jellyBar = navEl.querySelector('.pc-nav-jelly-bar');
    if (!jellyBar) {
        jellyBar = document.createElement('div');
        jellyBar.className = 'pc-nav-jelly-bar';
        jellyBar.setAttribute('aria-hidden', 'true');
        navEl.prepend(jellyBar);
    }

    let currentTop = null;
    let activeAnim = null;

    const cancelAnim = () => {
        if (activeAnim) {
            try { activeAnim.cancel(); } catch (_) { /* ignore */ }
            activeAnim = null;
        }
    };

    const sync = (navPath, { animate = true } = {}) => {
        if (!navEl.isConnected) return;

        const targetItem = navPath
            ? navEl.querySelector(`.pc-nav-item[data-nav="${navPath}"]`)
            : navEl.querySelector('.pc-nav-item.pc-nav-active');

        if (!targetItem || !canAnimateElement(jellyBar)) {
            cancelAnim();
            navEl.classList.remove('has-jelly-bar');
            currentTop = null;
            return;
        }

        const itemHeight = targetItem.offsetHeight;
        const itemTop = targetItem.offsetTop;
        // 无真实几何布局（如无头 JSDOM 单测）时保持原生 ::before 指示条显示
        if (itemHeight === 0 && itemTop === 0) {
            navEl.classList.remove('has-jelly-bar');
            return;
        }

        const nextTop = itemTop + (itemHeight - JELLY_BAR_HEIGHT) / 2;
        const nextLeft = targetItem.offsetLeft > 0 ? targetItem.offsetLeft : 18;
        jellyBar.style.left = `${nextLeft}px`;
        navEl.classList.add('has-jelly-bar');

        if (currentTop !== null && Math.abs(nextTop - currentTop) < 1) {
            if (!activeAnim) {
                jellyBar.style.top = `${nextTop}px`;
                jellyBar.style.transform = 'scaleY(1)';
            }
            currentTop = nextTop;
            return;
        }

        if (!animate || currentTop === null) {
            cancelAnim();
            jellyBar.style.top = `${nextTop}px`;
            jellyBar.style.transform = 'scaleY(1)';
            currentTop = nextTop;
            return;
        }

        const prevTop = currentTop;
        const dist = nextTop - prevTop;
        const stretch = Math.min(2.25, 1 + Math.abs(dist) / 96);
        const overshoot = Math.sign(dist) * Math.min(7, Math.abs(dist) * 0.12);

        cancelAnim();
        jellyBar.style.top = `${nextTop}px`;
        jellyBar.style.transform = 'scaleY(1)';

        activeAnim = jellyBar.animate(
            [
                { top: `${prevTop}px`, transform: 'scaleY(1)' },
                { top: `${prevTop + dist * 0.48}px`, transform: `scaleY(${stretch.toFixed(2)})`, offset: 0.42 },
                { top: `${nextTop + overshoot}px`, transform: 'scaleY(0.86)', offset: 0.78 },
                { top: `${nextTop}px`, transform: 'scaleY(1)' },
            ],
            {
                duration: 360,
                easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            }
        );

        const animRef = activeAnim;
        activeAnim.finished?.catch?.(() => {}).finally?.(() => {
            if (activeAnim === animRef) activeAnim = null;
        });
        currentTop = nextTop;
    };

    const handleResize = () => sync(null, { animate: false });
    window.addEventListener('resize', handleResize);

    return {
        sync,
        dispose() {
            cancelAnim();
            window.removeEventListener('resize', handleResize);
            navEl.classList.remove('has-jelly-bar');
            jellyBar.remove();
        },
    };
}

/**
 * PC 主页面多层速度差与物理弹簧编排控制器
 */
export function createPageTransitionOrchestrator(pageContainer, { intensity = KINETIC_INTENSITY } = {}) {
    let activeCleanups = [];

    function registerCleanup(fn) {
        activeCleanups.push(fn);
    }

    function trackAnimation(anim) {
        if (!anim) return null;
        registerCleanup(() => {
            try { anim.cancel(); } catch (_) { /* ignore */ }
        });
        return anim;
    }

    function abort() {
        if (activeCleanups.length === 0) return;
        const list = activeCleanups;
        activeCleanups = [];
        for (let i = list.length - 1; i >= 0; i--) {
            try { list[i](); } catch (_) { /* ignore */ }
        }
    }

    function animateMascotAndVitality(pageEl, seenNodes) {
        // 1. 横幅柯基与设置台球形吉祥物 Q 弹跳跃
        pageEl.querySelectorAll('.pc-welcome-mascot img, .pc-settings-console-orb img').forEach((img) => {
            if (seenNodes.has(img) || !canAnimateElement(img)) return;
            seenNodes.add(img);
            const jumpDown = Math.round(24 * intensity);
            const jumpUp = Math.round(-8 * intensity);
            trackAnimation(img.animate(
                [
                    { transform: `translateY(${jumpDown}px) scale(0.82)` },
                    { transform: `translateY(${jumpUp}px) scale(1.06)`, offset: 0.62 },
                    { transform: 'translateY(0) scale(1)' },
                ],
                {
                    duration: 460,
                    delay: 55,
                    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                    fill: 'backwards',
                }
            ));
        });

        // 2. 标题栏挥手小手欢快摇摆
        pageEl.querySelectorAll('.pc-greeting-hand').forEach((hand) => {
            if (seenNodes.has(hand) || !canAnimateElement(hand)) return;
            seenNodes.add(hand);
            trackAnimation(hand.animate(
                [
                    { transform: 'rotate(0deg) scale(0.82)' },
                    { transform: 'rotate(24deg) scale(1.18)', offset: 0.35 },
                    { transform: 'rotate(-14deg) scale(1.08)', offset: 0.68 },
                    { transform: 'rotate(0deg) scale(1)' },
                ],
                {
                    duration: 520,
                    delay: 115,
                    easing: 'ease-out',
                }
            ));
        });

        // 3. 首页小盆栽萌芽弹跳
        const plantHost = pageEl.querySelector('#pcPlantAnchor');
        if (plantHost && plantHost.childElementCount > 0 && !seenNodes.has(plantHost) && canAnimateElement(plantHost)) {
            seenNodes.add(plantHost);
            trackAnimation(plantHost.animate(
                [
                    { opacity: 0, transform: 'scale(0.68) rotate(-7deg)' },
                    { opacity: 1, transform: 'scale(1.08) rotate(3.5deg)', offset: 0.66 },
                    { opacity: 1, transform: 'scale(1) rotate(0deg)' },
                ],
                {
                    duration: 440,
                    delay: 85,
                    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                    fill: 'backwards',
                }
            ));
        }

        // 4. 首页四色统计液面涌动激荡
        pageEl.querySelectorAll('.pc-stat-liquid-svg').forEach((svg, idx) => {
            if (seenNodes.has(svg) || !canAnimateElement(svg)) return;
            seenNodes.add(svg);
            trackAnimation(svg.animate(
                [
                    { transform: 'scaleY(0.22)' },
                    { transform: 'scaleY(1.18)', offset: 0.58 },
                    { transform: 'scaleY(0.94)', offset: 0.82 },
                    { transform: 'scaleY(1)' },
                ],
                {
                    duration: 560,
                    delay: 80 + idx * 35,
                    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                    fill: 'backwards',
                }
            ));
        });

        // 5. 统计数字与百分比快速滚动跳变
        pageEl.querySelectorAll(COUNTUP_SELECTOR).forEach((numEl) => {
            if (seenNodes.has(numEl) || !canAnimateElement(numEl)) return;
            const rawText = (numEl.textContent || '').trim();
            const match = rawText.match(/^(\d+)(%?)$/);
            if (!match) return;
            const targetVal = Number.parseInt(match[1], 10);
            const suffix = match[2] || '';
            if (!Number.isFinite(targetVal) || targetVal <= 0) return;

            seenNodes.add(numEl);
            const duration = 380;
            const startTime = performance.now();
            let stopped = false;
            let rafId = 0;

            registerCleanup(() => {
                stopped = true;
                if (rafId) cancelAnimationFrame(rafId);
                if (numEl.isConnected) numEl.textContent = rawText;
            });

            const step = (now) => {
                if (stopped || !numEl.isConnected) return;
                const progress = Math.min(1, Math.max(0, (now - startTime) / duration));
                const eased = 1 - Math.pow(1 - progress, 3);
                numEl.textContent = `${Math.round(targetVal * eased)}${suffix}`;
                if (progress < 1) {
                    rafId = requestAnimationFrame(step);
                } else {
                    numEl.textContent = rawText;
                }
            };
            rafId = requestAnimationFrame(step);
        });

        // 6. 目标计划进度条弹性充能
        pageEl.querySelectorAll('.pc-goal-project-progress-fill').forEach((bar, idx) => {
            if (seenNodes.has(bar) || !canAnimateElement(bar)) return;
            seenNodes.add(bar);
            trackAnimation(bar.animate(
                [
                    { transform: 'scaleX(0)' },
                    { transform: 'scaleX(1.03)', offset: 0.76 },
                    { transform: 'scaleX(1)' },
                ],
                {
                    duration: 520,
                    delay: 105 + Math.min(idx, 8) * 50,
                    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                    fill: 'backwards',
                }
            ));
        });
    }

    function animateLayeredBurst(pageEl, seenNodes, baseDelay = 55) {
        // 中段搜索栏 / 工具栏 / 分段器速度差跟进
        pageEl.querySelectorAll(MID_LAYER_SELECTOR).forEach((bar, idx) => {
            if (seenNodes.has(bar) || !canAnimateElement(bar)) return;
            seenNodes.add(bar);
            const dy = Math.round(22 * intensity);
            const overY = Math.round(-3 * intensity);
            trackAnimation(bar.animate(
                [
                    { opacity: 0, transform: `translateY(${dy}px) scale(0.975)` },
                    { opacity: 1, transform: `translateY(${overY}px) scale(1.008)`, offset: 0.7 },
                    { opacity: 1, transform: 'translateY(0) scale(1)' },
                ],
                {
                    duration: 360,
                    delay: 42 + idx * 24,
                    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                    fill: 'backwards',
                }
            ));
        });

        // 词库顶部筛选胶囊轻弹
        const filterBtns = Array.from(pageEl.querySelectorAll('.pc-library-filter-btn')).slice(0, 8);
        filterBtns.forEach((btn, idx) => {
            if (seenNodes.has(btn) || !canAnimateElement(btn)) return;
            seenNodes.add(btn);
            trackAnimation(btn.animate(
                [
                    { opacity: 0, transform: 'translateY(14px) scale(0.92)' },
                    { opacity: 1, transform: 'translateY(-2px) scale(1.02)', offset: 0.72 },
                    { opacity: 1, transform: 'translateY(0) scale(1)' },
                ],
                {
                    duration: 320,
                    delay: 50 + idx * 22,
                    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                    fill: 'backwards',
                }
            ));
        });

        // 卡片网格波浪式弹簧弹射
        const cards = Array.from(pageEl.querySelectorAll(CARD_BURST_SELECTOR))
            .filter((el) => !seenNodes.has(el) && !el.closest('.is-mindmap-maximized'));

        cards.forEach((card, idx) => {
            seenNodes.add(card);
            if (!canAnimateElement(card)) return;
            const staggerIdx = Math.min(idx, MAX_BURST_ITEMS - 1);
            const dy = Math.round(28 * intensity);
            const overY = Math.round(-4 * intensity);
            trackAnimation(card.animate(
                [
                    { opacity: 0, transform: `translateY(${dy}px) scale(0.91)` },
                    { opacity: 1, transform: `translateY(${overY}px) scale(1.018)`, offset: 0.72 },
                    { opacity: 1, transform: 'translateY(0) scale(1)' },
                ],
                {
                    duration: 390,
                    delay: baseDelay + staggerIdx * 32,
                    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                    fill: 'backwards',
                }
            ));
        });

        // 词库表格前若干行纯位移波浪浮现（不缩放 tr 以免列宽抖动）
        const rows = Array.from(pageEl.querySelectorAll('#pcLibraryTableBody > tr')).slice(0, MAX_TABLE_ROWS);
        rows.forEach((row, idx) => {
            if (seenNodes.has(row) || !canAnimateElement(row)) return;
            seenNodes.add(row);
            trackAnimation(row.animate(
                [
                    { opacity: 0, transform: 'translateY(16px)' },
                    { opacity: 1, transform: 'translateY(-2px)', offset: 0.72 },
                    { opacity: 1, transform: 'translateY(0)' },
                ],
                {
                    duration: 310,
                    delay: baseDelay + 25 + idx * 24,
                    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                    fill: 'backwards',
                }
            ));
        });
    }

    /**
     * 执行新旧页面的交接过渡，并返回供异步 mount 完成后调用的补帧钩子
     */
    function startTransition({ oldPageEl, nextPageEl, oldRouteKey, newRouteKey, direction = 'tab', prevScrollTop = 0 }) {
        abort();

        // 低动效或无 WAAPI 环境：立即移除旧页，同步直出新页
        if (!canAnimateElement(nextPageEl)) {
            if (oldPageEl?.parentNode) oldPageEl.remove();
            if (nextPageEl.parentNode !== pageContainer) {
                pageContainer.appendChild(nextPageEl);
            }
            return { onMounted: () => {} };
        }

        const vector = resolveTransitionVector(oldRouteKey, newRouteKey, direction);
        const seenNodes = new WeakSet();

        nextPageEl.classList.add('pc-page-kinetic', 'pc-page-entering');

        // 新页置于容器首位，保证同屏期间 document.getElementById 100% 命中新页
        if (oldPageEl && oldPageEl.parentNode === pageContainer) {
            pageContainer.prepend(nextPageEl);

            oldPageEl.classList.remove('pc-page-entering');
            oldPageEl.classList.add('pc-page-kinetic', 'pc-page-exiting');
            oldPageEl.style.top = `${-prevScrollTop}px`;
            oldPageEl.setAttribute('aria-hidden', 'true');
            oldPageEl.inert = true;

            const exitDx = vector.axis === 'x' ? Math.round(-vector.sign * 72 * intensity) : 0;
            const exitDy = vector.axis === 'y' ? Math.round(-vector.sign * 56 * intensity) : 0;
            const exitAnim = oldPageEl.animate(
                [
                    { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' },
                    { opacity: 0, transform: `translate3d(${exitDx}px, ${exitDy}px, 0) scale(0.93)` },
                ],
                {
                    duration: 210,
                    easing: 'cubic-bezier(0.36, 0, 0.66, -0.05)',
                    fill: 'forwards',
                }
            );

            const removeOld = () => {
                try { exitAnim.cancel(); } catch (_) { /* ignore */ }
                if (oldPageEl.parentNode) oldPageEl.remove();
            };
            registerCleanup(removeOld);
            exitAnim.finished?.then?.(removeOld, removeOld);
        } else if (nextPageEl.parentNode !== pageContainer) {
            pageContainer.appendChild(nextPageEl);
        }

        // 第一拍：主页面骨架方向弹簧冲刺 + 微超调落定（无 forwards，落定后 transform 自动归零为 none）
        const isInitialOrRefresh = vector.mode === 'initial' || vector.mode === 'refresh';
        const enterDx = (!isInitialOrRefresh && vector.axis === 'x') ? Math.round(vector.sign * 78 * intensity) : 0;
        const enterDy = isInitialOrRefresh
            ? Math.round(18 * intensity)
            : (vector.axis === 'y' ? Math.round(vector.sign * 62 * intensity) : 0);
        const overDx = enterDx ? Math.round(-vector.sign * 6 * intensity) : 0;
        const overDy = enterDy ? Math.round(-(isInitialOrRefresh ? 1 : vector.sign) * 5 * intensity) : 0;
        const enterDur = isInitialOrRefresh ? 340 : 420;

        const enterAnim = trackAnimation(nextPageEl.animate(
            [
                { opacity: 0, transform: `translate3d(${enterDx}px, ${enterDy}px, 0) scale(0.94)` },
                { opacity: 1, transform: `translate3d(${overDx}px, ${overDy}px, 0) scale(1.012)`, offset: 0.68 },
                { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' },
            ],
            {
                duration: enterDur,
                easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            }
        ));

        const clearEnteringClass = () => nextPageEl.classList.remove('pc-page-entering');
        registerCleanup(clearEnteringClass);
        enterAnim?.finished?.then?.(clearEnteringClass, clearEnteringClass);

        // 第二拍（同步已就绪部分）：横幅吉祥物 + 首屏同步区块
        animateMascotAndVitality(nextPageEl, seenNodes);
        animateLayeredBurst(nextPageEl, seenNodes, 55);

        return {
            onMounted() {
                if (!nextPageEl.isConnected || prefersReducedMotion()) return;
                // 第三拍（异步数据装载完成后）：新插入的卡片波浪弹射 + 统计数字滚动 + 进度充能
                animateMascotAndVitality(nextPageEl, seenNodes);
                animateLayeredBurst(nextPageEl, seenNodes, 20);
            },
        };
    }

    return {
        startTransition,
        abort,
    };
}
