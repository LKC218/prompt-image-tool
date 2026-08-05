import { gsap } from 'gsap';

let activeController = null;

const NATIVE_CURSOR_VALUES = new Set([
    'col-resize', 'row-resize', 'ew-resize', 'ns-resize', 'nwse-resize', 'nesw-resize'
]);

const CURSOR_STATES = new Set([
    'action', 'media', 'favorite', 'menu', 'copy', 'drag', 'zoom', 'loading', 'disabled'
]);

const CORNER_SIZE = 12;
const BORDER_WIDTH = 3;
const IDLE_CORNERS = [
    { x: -CORNER_SIZE * 1.5, y: -CORNER_SIZE * 1.5 },
    { x: CORNER_SIZE * 0.5, y: -CORNER_SIZE * 1.5 },
    { x: CORNER_SIZE * 0.5, y: CORNER_SIZE * 0.5 },
    { x: -CORNER_SIZE * 1.5, y: CORNER_SIZE * 0.5 }
];

function supportsCustomCursor() {
    return window.matchMedia?.('(hover: hover) and (pointer: fine)')?.matches
        && !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
}

function isNativeCursorTarget(target) {
    if (!(target instanceof Element)) return true;
    if (target.closest('[data-cursor="native"]')) return true;

    const editable = target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
    if (editable && !editable.disabled && !editable.readOnly) return true;

    return NATIVE_CURSOR_VALUES.has(window.getComputedStyle(target).cursor);
}

function getCursorTarget(target, root) {
    if (!(target instanceof Element)) return null;

    const disabledTarget = target.closest('[disabled], [aria-disabled="true"], [data-cursor="disabled"]');
    if (disabledTarget && root.contains(disabledTarget)) return { element: disabledTarget, state: 'disabled' };

    const loadingTarget = target.closest('[aria-busy="true"], [data-cursor="loading"]');
    if (loadingTarget && root.contains(loadingTarget)) return { element: loadingTarget, state: 'loading' };

    const semanticTarget = target.closest('[data-cursor]');
    if (semanticTarget && root.contains(semanticTarget)) {
        const state = semanticTarget.dataset.cursor;
        if (CURSOR_STATES.has(state)) return { element: semanticTarget, state };
    }

    const actionTarget = target.closest('button, a[href], [role="button"], [data-ripple], [data-nav], [tabindex]:not([tabindex="-1"]), .active, .selected, [aria-current], [aria-selected="true"]');
    if (actionTarget && root.contains(actionTarget)) return { element: actionTarget, state: 'action' };

    return window.getComputedStyle(target).cursor === 'pointer' && root.contains(target)
        ? { element: target, state: 'action' }
        : null;
}

function isSelectedCursorTarget(target) {
    return target?.matches?.('.active, .selected, [aria-current]:not([aria-current="false"]), [aria-selected="true"]');
}

function initPcCursor(root) {
    activeController?.destroy();
    if (!root || !supportsCustomCursor()) return null;

    const cursor = document.createElement('div');
    cursor.className = 'pc-custom-cursor';
    cursor.setAttribute('aria-hidden', 'true');
    cursor.innerHTML = [
        '<span class="pc-custom-cursor-dot"></span>',
        '<span class="pc-custom-cursor-glyph"></span>',
        '<span class="pc-custom-cursor-core">',
        '<span class="pc-custom-cursor-corner corner-tl"></span>',
        '<span class="pc-custom-cursor-corner corner-tr"></span>',
        '<span class="pc-custom-cursor-corner corner-br"></span>',
        '<span class="pc-custom-cursor-corner corner-bl"></span>',
        '</span>'
    ].join('');
    document.body.appendChild(cursor);
    root.classList.add('pc-custom-cursor-enabled');

    const core = cursor.querySelector('.pc-custom-cursor-core');
    const dot = cursor.querySelector('.pc-custom-cursor-dot');
    const corners = Array.from(cursor.querySelectorAll('.pc-custom-cursor-corner'));
    let pointerX = window.innerWidth / 2;
    let pointerY = window.innerHeight / 2;
    let visible = false;
    let currentTarget = null;
    let currentState = 'idle';
    let currentSelected = false;
    let targetRect = null;
    let resizeObserver = null;
    let spinTween = null;
    let releaseTimer = null;
    let activeStrength = 0;
    let scrollRafPending = false;

    function handleScrollThrottled() {
        if (scrollRafPending) return;
        scrollRafPending = true;
        requestAnimationFrame(() => {
            scrollRafPending = false;
            handleLayoutChange();
        });
    }

    function updateTargetRect() {
        if (!currentTarget?.isConnected) {
            setTarget(null);
            return;
        }
        targetRect = currentTarget?.getBoundingClientRect() || null;
    }

    function setIdleSpin(isActive) {
        if (!isActive) {
            spinTween?.pause();
            gsap.to(cursor, { rotation: 0, duration: 0.16, ease: 'power2.out', overwrite: 'auto' });
            return;
        }
        spinTween?.kill();
        gsap.set(cursor, { rotation: 0 });
        spinTween = gsap.to(cursor, {
            rotation: 360,
            duration: 4,
            ease: 'none',
            repeat: -1
        });
    }

    function setTarget(nextTarget) {
        const nextElement = nextTarget?.element || null;
        const nextState = nextTarget?.state || 'idle';
        const nextSelected = isSelectedCursorTarget(nextElement);
        if (currentTarget === nextElement && currentState === nextState && currentSelected === nextSelected) return;

        currentTarget?.classList.remove('pc-custom-cursor-target', 'pc-custom-cursor-media-target');
        resizeObserver?.disconnect();
        currentTarget = nextElement;
        currentState = nextState;
        currentSelected = nextSelected;
        targetRect = null;

        if (currentTarget) {
            currentTarget.classList.add('pc-custom-cursor-target');
            if (currentState === 'media') currentTarget.classList.add('pc-custom-cursor-media-target');
            resizeObserver?.observe(currentTarget);
            updateTargetRect();
        }

        cursor.classList.toggle('is-targeting', Boolean(currentTarget));
        cursor.classList.toggle('is-media', currentState === 'media');
        cursor.classList.toggle('is-selected', currentSelected);
        CURSOR_STATES.forEach(state => cursor.classList.toggle(`is-${state}`, currentState === state));
        setIdleSpin(!currentTarget && visible);

        if (!currentTarget) {
            gsap.ticker.remove(renderTargetParallax);
            activeStrength = 0;
            gsap.to(corners, {
                x: index => IDLE_CORNERS[index].x,
                y: index => IDLE_CORNERS[index].y,
                duration: 0.3,
                ease: 'power3.out',
                overwrite: 'auto'
            });
            return;
        }

        gsap.killTweensOf(corners, 'x,y');
        gsap.killTweensOf(cursor, 'rotation');
        spinTween?.pause();
        gsap.set(cursor, { rotation: 0 });
        activeStrength = 0;
        gsap.to({ strength: 0 }, {
            strength: 1,
            duration: 0.2,
            ease: 'power2.out',
            onUpdate() {
                activeStrength = this.targets()[0].strength;
            }
        });
        gsap.ticker.add(renderTargetParallax);
        animateCornersToTarget();
    }

    function resolveTarget(target) {
        if (isNativeCursorTarget(target)) {
            cursor.classList.remove('is-custom-active');
            root.classList.add('pc-custom-cursor-native');
            setTarget(null);
            return;
        }

        root.classList.remove('pc-custom-cursor-native');
        cursor.classList.add('is-custom-active');
        setTarget(getCursorTarget(target, root));
    }

    function getCornerTargets() {
        if (!targetRect || !currentTarget) return IDLE_CORNERS;
        const padding = currentState === 'media' ? 6 : 4;
        const size = currentState === 'media' ? 14 : 12;
        return [
            { x: targetRect.left - padding - pointerX, y: targetRect.top - padding - pointerY },
            { x: targetRect.right + padding - size - pointerX, y: targetRect.top - padding - pointerY },
            { x: targetRect.right + padding - size - pointerX, y: targetRect.bottom + padding - size - pointerY },
            { x: targetRect.left - padding - pointerX, y: targetRect.bottom + padding - size - pointerY }
        ];
    }

    function animateCornersToTarget() {
        const targets = getCornerTargets();
        corners.forEach((corner, index) => {
            gsap.to(corner, {
                x: targets[index].x,
                y: targets[index].y,
                duration: 0.12,
                ease: 'power2.out',
                overwrite: 'auto'
            });
        });
    }

    function renderTargetParallax() {
        if (!currentTarget || !targetRect) return;
        const targets = getCornerTargets();
        corners.forEach((corner, index) => {
            const currentX = Number(gsap.getProperty(corner, 'x')) || 0;
            const currentY = Number(gsap.getProperty(corner, 'y')) || 0;
            const nextX = currentX + (targets[index].x - currentX) * activeStrength;
            const nextY = currentY + (targets[index].y - currentY) * activeStrength;
            gsap.set(corner, { x: nextX, y: nextY });
        });
    }

    function handlePointerMove(event) {
        pointerX = event.clientX;
        pointerY = event.clientY;
        if (!visible) {
            visible = true;
            setIdleSpin(true);
        }
        resolveTarget(event.target);
        gsap.to(cursor, { x: pointerX, y: pointerY, duration: 0.05, ease: 'power2.out', overwrite: 'auto' });
    }

    function handlePointerLeave() {
        visible = false;
        cursor.classList.remove('is-custom-active');
        root.classList.remove('pc-custom-cursor-native');
        setTarget(null);
        spinTween?.pause();
    }

    function handleWindowBlur() {
        handlePointerLeave();
    }

    function handleLayoutChange() {
        if (currentTarget) {
            const elementUnderPointer = document.elementFromPoint(pointerX, pointerY);
            const isStillOverTarget = elementUnderPointer
                && (elementUnderPointer === currentTarget || elementUnderPointer.closest('[data-cursor]') === currentTarget || currentTarget.contains(elementUnderPointer));
            if (!isStillOverTarget) {
                setTarget(null);
                return;
            }
            updateTargetRect();
            animateCornersToTarget();
        }
    }

    function handlePointerDown() {
        if (!visible || !cursor.classList.contains('is-custom-active')) return;
        cursor.classList.add('is-pressed');
        gsap.to(dot, { scale: 0.7, duration: 0.15, overwrite: 'auto' });
        gsap.to(cursor, { scale: 0.9, duration: 0.1, overwrite: 'auto' });
    }

    function handlePointerUp() {
        cursor.classList.remove('is-pressed');
        gsap.to(dot, { scale: 1, duration: 0.15, overwrite: 'auto' });
        gsap.to(cursor, { scale: 1, duration: 0.1, overwrite: 'auto' });
    }

    function handleClick(event) {
        queueMicrotask(() => resolveTarget(event.target));
    }

    resizeObserver = typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(handleLayoutChange);

    window.addEventListener('mousemove', handlePointerMove);
    root.addEventListener('pointerleave', handlePointerLeave);
    root.addEventListener('pointerdown', handlePointerDown);
    root.addEventListener('click', handleClick);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('scroll', handleScrollThrottled, true);
    window.addEventListener('resize', handleLayoutChange);

    const controller = {
        destroy() {
            window.removeEventListener('mousemove', handlePointerMove);
            root.removeEventListener('pointerleave', handlePointerLeave);
            root.removeEventListener('pointerdown', handlePointerDown);
            root.removeEventListener('click', handleClick);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('blur', handleWindowBlur);
            window.removeEventListener('scroll', handleScrollThrottled, true);
            window.removeEventListener('resize', handleLayoutChange);
            resizeObserver?.disconnect();
            spinTween?.kill();
            gsap.ticker.remove(renderTargetParallax);
            clearTimeout(releaseTimer);
            currentTarget?.classList.remove('pc-custom-cursor-target', 'pc-custom-cursor-media-target');
            cursor.remove();
            root.classList.remove('pc-custom-cursor-enabled', 'pc-custom-cursor-native');
            if (activeController === controller) activeController = null;
        }
    };

    activeController = controller;
    return controller;
}

export { initPcCursor, supportsCustomCursor };
