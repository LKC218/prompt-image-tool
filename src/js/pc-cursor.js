let activeController = null;

function supportsCustomCursor() {
    return window.matchMedia?.('(hover: hover) and (pointer: fine)')?.matches
        && !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
}

function isNativeCursorTarget(target) {
    if (!(target instanceof Element)) return true;

    if (target.closest('[data-cursor="native"]')) return true;

    const editable = target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
    if (editable && !editable.disabled && !editable.readOnly) return true;

    const cursor = window.getComputedStyle(target).cursor;
    return ['grab', 'grabbing', 'zoom-in', 'zoom-out', 'not-allowed', 'progress', 'wait', 'col-resize', 'row-resize', 'ew-resize', 'ns-resize', 'nwse-resize', 'nesw-resize'].includes(cursor);
}

function getInteractiveTarget(target, root) {
    if (!(target instanceof Element)) return null;
    const explicitTarget = target.closest('[data-cursor="action"]');
    if (explicitTarget && root.contains(explicitTarget)) return explicitTarget;

    const semanticTarget = target.closest('button, a[href], [role="button"], [data-ripple], [data-nav], [tabindex]:not([tabindex="-1"])');
    if (semanticTarget && root.contains(semanticTarget)) return semanticTarget;

    return window.getComputedStyle(target).cursor === 'pointer' && root.contains(target) ? target : null;
}

function initPcCursor(root) {
    activeController?.destroy();
    if (!root || !supportsCustomCursor()) return null;

    const cursor = document.createElement('div');
    cursor.className = 'pc-custom-cursor';
    cursor.setAttribute('aria-hidden', 'true');
    cursor.innerHTML = '<span class="pc-custom-cursor-ring"></span><span class="pc-custom-cursor-dot"></span>';
    root.appendChild(cursor);
    root.classList.add('pc-custom-cursor-enabled');

    let pointerX = -100;
    let pointerY = -100;
    let ringX = pointerX;
    let ringY = pointerY;
    let frameId = null;
    let visible = false;
    let currentTarget = null;

    function updateTarget(target) {
        currentTarget?.classList.remove('pc-custom-cursor-target');
        currentTarget = null;

        if (isNativeCursorTarget(target)) {
            cursor.classList.remove('is-hovering', 'is-custom-active');
            return;
        }

        currentTarget = getInteractiveTarget(target, root);
        currentTarget?.classList.add('pc-custom-cursor-target');
        cursor.classList.toggle('is-hovering', Boolean(currentTarget));
        cursor.classList.add('is-custom-active');
    }

    function render() {
        const deltaX = pointerX - ringX;
        const deltaY = pointerY - ringY;
        ringX += deltaX * 0.16;
        ringY += deltaY * 0.16;
        cursor.style.setProperty('--pc-cursor-dot-x', `${pointerX}px`);
        cursor.style.setProperty('--pc-cursor-dot-y', `${pointerY}px`);
        cursor.style.setProperty('--pc-cursor-ring-x', `${ringX}px`);
        cursor.style.setProperty('--pc-cursor-ring-y', `${ringY}px`);

        if (Math.abs(deltaX) > 0.1 || Math.abs(deltaY) > 0.1) {
            frameId = window.requestAnimationFrame(render);
        } else {
            frameId = null;
        }
    }

    function scheduleRender() {
        if (frameId === null) frameId = window.requestAnimationFrame(render);
    }

    function handlePointerMove(event) {
        pointerX = event.clientX;
        pointerY = event.clientY;
        if (!visible) {
            ringX = pointerX;
            ringY = pointerY;
            visible = true;
            cursor.classList.add('is-visible', 'is-custom-active');
        }
        updateTarget(event.target);
        scheduleRender();
    }

    function handlePointerLeave() {
        visible = false;
        cursor.classList.remove('is-visible', 'is-hovering', 'is-custom-active');
        currentTarget?.classList.remove('pc-custom-cursor-target');
        currentTarget = null;
    }

    root.addEventListener('pointermove', handlePointerMove);
    root.addEventListener('pointerleave', handlePointerLeave);

    const controller = {
        destroy() {
            root.removeEventListener('pointermove', handlePointerMove);
            root.removeEventListener('pointerleave', handlePointerLeave);
            if (frameId !== null) window.cancelAnimationFrame(frameId);
            currentTarget?.classList.remove('pc-custom-cursor-target');
            cursor.remove();
            root.classList.remove('pc-custom-cursor-enabled');
            if (activeController === controller) activeController = null;
        }
    };

    activeController = controller;
    return controller;
}

export { initPcCursor, supportsCustomCursor };
