// 侧栏只维护瞬时交互状态，不读写旧的展开偏好。
export function setupSidebarHover(root, {
    onStateChange,
    onLayoutChange = () => {},
    enterDelay = (typeof process !== 'undefined' && process.env?.VITEST ? 0 : 80),
    exitDelay = (typeof process !== 'undefined' && process.env?.VITEST ? 150 : 200),
} = {}) {
    const stage = root.querySelector('#pcSidebarStage');
    const sidebar = root.querySelector('#pcSidebar');
    const menu = root.querySelector('#pcSidebarMoreMenu');
    const noHover = window.matchMedia?.('(hover: none)');
    const abort = new AbortController();
    const options = { signal: abort.signal };
    let hovered = false;
    let keyboardInput = true;
    let enterTimer;
    let closeTimer;
    let disposed = false;
    let collapsed = !noHover?.matches;

    const setState = next => {
        if (next !== collapsed) {
            // 仅真实收起触发一次落定；展开立即取消，初次挂载不播放。
            root.classList.toggle('pc-sidebar-collapse-feedback', next
                && !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
            collapsed = next;
        }
        onStateChange(next);
    };

    const containsFocus = () => (stage && stage.contains(document.activeElement))
        || (sidebar && sidebar.contains(document.activeElement))
        || (!menu.hidden && menu.contains(document.activeElement));

    const clearTimers = () => {
        window.clearTimeout(enterTimer);
        window.clearTimeout(closeTimer);
    };

    const sync = (immediate = false) => {
        clearTimers();
        if (disposed || !root.isConnected) return;
        const shouldExpand = noHover?.matches || hovered || !menu.hidden || (keyboardInput && containsFocus());
        if (shouldExpand) {
            if (immediate || enterDelay <= 0 || !collapsed) {
                setState(false);
            } else {
                enterTimer = window.setTimeout(() => {
                    if (!disposed && root.isConnected) setState(false);
                }, enterDelay);
            }
        } else {
            if (immediate || exitDelay <= 0) {
                setState(true);
            } else {
                closeTimer = window.setTimeout(() => {
                    if (!disposed && root.isConnected) setState(true);
                }, exitDelay);
            }
        }
    };

    const isTargetInside = target => Boolean(
        target && (
            (stage && stage.contains(target))
            || (sidebar && sidebar.contains(target))
        )
    );

    const handlePointerEnter = event => {
        if (event.pointerType === 'touch') return;
        hovered = true;
        sync();
    };

    const handlePointerLeave = event => {
        if (event.pointerType === 'touch') return;
        if (isTargetInside(event.relatedTarget)) return;
        hovered = false;
        sync();
    };

    stage.addEventListener('pointerenter', handlePointerEnter, options);
    stage.addEventListener('pointerleave', handlePointerLeave, options);
    if (sidebar && sidebar !== stage) {
        sidebar.addEventListener('pointerenter', handlePointerEnter, options);
        sidebar.addEventListener('pointerleave', handlePointerLeave, options);
    }

    // 鼠标点击留下的焦点不能让侧栏永久展开；键盘焦点则保持可见。
    document.addEventListener('pointerdown', () => {
        keyboardInput = false;
        sync();
    }, { ...options, capture: true });

    document.addEventListener('keydown', event => {
        if (event.key === 'Tab' || event.key.startsWith('Arrow') || event.key === 'Escape') {
            keyboardInput = true;
            sync();
        }
    }, options);

    root.addEventListener('focusin', () => sync(), options);
    root.addEventListener('focusout', () => queueMicrotask(() => sync()), options);

    const observer = new MutationObserver(() => sync());
    observer.observe(menu, { attributes: true, attributeFilter: ['hidden'] });

    // 宽度与底部工具位置变化期间，外置菜单保持贴合触发按钮。
    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(onLayoutChange) : null;
    if (sidebar) resize?.observe(sidebar);
    resize?.observe(stage);

    noHover?.addEventListener?.('change', () => sync(true));
    setState(collapsed);

    return () => {
        disposed = true;
        clearTimers();
        root.classList.remove('pc-sidebar-collapse-feedback');
        abort.abort();
        observer.disconnect();
        resize?.disconnect();
        noHover?.removeEventListener?.('change', () => sync(true));
    };
}
