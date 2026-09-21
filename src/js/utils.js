export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export function formatDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleDateString('zh-CN') + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

export function showToast(msg, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

export function isMobile() {
    return window.innerWidth <= 768;
}

export function debounce(fn, wait = 160) {
    let timer = null;
    let pendingArgs = null;
    let pendingThis = null;

    function debounced(...args) {
        pendingArgs = args;
        pendingThis = this;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            timer = null;
            const ctx = pendingThis;
            const callArgs = pendingArgs;
            pendingArgs = null;
            pendingThis = null;
            fn.apply(ctx, callArgs);
        }, wait);
    }

    debounced.cancel = () => {
        if (timer) clearTimeout(timer);
        timer = null;
        pendingArgs = null;
        pendingThis = null;
    };

    debounced.flush = () => {
        if (!timer) return;
        clearTimeout(timer);
        timer = null;
        const ctx = pendingThis;
        const callArgs = pendingArgs;
        pendingArgs = null;
        pendingThis = null;
        if (callArgs) fn.apply(ctx, callArgs);
    };

    return debounced;
}
