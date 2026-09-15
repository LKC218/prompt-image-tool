import { gsap } from 'gsap';

let activeController = null;

const NATIVE_CURSOR_VALUES = new Set([
    'col-resize', 'row-resize', 'ew-resize', 'ns-resize', 'nwse-resize', 'nesw-resize'
]);

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

function getCursorState(target, root) {
    if (!(target instanceof Element)) return null;

    const disabledTarget = target.closest('[disabled], [aria-disabled="true"], [data-cursor="disabled"]');
    if (disabledTarget && root.contains(disabledTarget)) return 'disabled';

    const loadingTarget = target.closest('[aria-busy="true"], [data-cursor="loading"]');
    if (loadingTarget && root.contains(loadingTarget)) return 'loading';

    const actionTarget = target.closest(
        'button, a[href], [role="button"], [data-ripple], [data-nav], [tabindex]:not([tabindex="-1"]), .active, .selected, [aria-current], [aria-selected="true"], [data-cursor]'
    );
    if (actionTarget && root.contains(actionTarget)) {
        const cursorAttr = actionTarget.dataset.cursor;
        if (cursorAttr === 'native') return null;
        return 'hover';
    }

    if (window.getComputedStyle(target).cursor === 'pointer' && root.contains(target)) return 'hover';

    return null;
}

function initPcCursor(root) {
    activeController?.destroy();
    if (!root || !supportsCustomCursor()) return null;

    const cursor = document.createElement('div');
    cursor.className = 'pc-custom-cursor';
    cursor.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cursor);
    root.classList.add('pc-custom-cursor-enabled');

    gsap.set(cursor, { xPercent: -50, yPercent: -50, x: window.innerWidth / 2, y: window.innerHeight / 2 });

    const setX = gsap.quickTo(cursor, 'x', { duration: 0.16, ease: 'power3.out' });
    const setY = gsap.quickTo(cursor, 'y', { duration: 0.16, ease: 'power3.out' });

    let visible = false;
    let currentState = null;

    function applyState(nextState) {
        if (currentState === nextState) return;
        currentState = nextState;

        cursor.classList.toggle('is-hover', nextState === 'hover');
        cursor.classList.toggle('is-disabled', nextState === 'disabled');
        cursor.classList.toggle('is-loading', nextState === 'loading');
    }

    function resolveTarget(target) {
        if (isNativeCursorTarget(target)) {
            cursor.classList.remove('is-custom-active');
            root.classList.add('pc-custom-cursor-native');
            applyState(null);
            return;
        }

        root.classList.remove('pc-custom-cursor-native');
        cursor.classList.add('is-custom-active');
        applyState(getCursorState(target, root));
    }

    function handlePointerMove(event) {
        visible = true;
        setX(event.clientX);
        setY(event.clientY);
        resolveTarget(event.target);
    }

    function handlePointerLeave() {
        visible = false;
        cursor.classList.remove('is-custom-active', 'is-hover', 'is-disabled', 'is-loading', 'is-pressed');
        root.classList.remove('pc-custom-cursor-native');
        currentState = null;
    }

    function handleWindowBlur() {
        handlePointerLeave();
    }

    function handlePointerDown() {
        if (!visible || !cursor.classList.contains('is-custom-active')) return;
        cursor.classList.add('is-pressed');
    }

    function handlePointerUp() {
        cursor.classList.remove('is-pressed');
    }

    function handleClick(event) {
        queueMicrotask(() => resolveTarget(event.target));
    }

    window.addEventListener('mousemove', handlePointerMove);
    root.addEventListener('pointerleave', handlePointerLeave);
    root.addEventListener('pointerdown', handlePointerDown);
    root.addEventListener('click', handleClick);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('blur', handleWindowBlur);

    const controller = {
        destroy() {
            window.removeEventListener('mousemove', handlePointerMove);
            root.removeEventListener('pointerleave', handlePointerLeave);
            root.removeEventListener('pointerdown', handlePointerDown);
            root.removeEventListener('click', handleClick);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('blur', handleWindowBlur);
            gsap.killTweensOf(cursor);
            cursor.remove();
            root.classList.remove('pc-custom-cursor-enabled', 'pc-custom-cursor-native');
            if (activeController === controller) activeController = null;
        }
    };

    activeController = controller;
    return controller;
}

export { initPcCursor, supportsCustomCursor };
