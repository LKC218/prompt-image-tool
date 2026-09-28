/**
 * 轻拟态下拉（listbox）公共组件。
 * 闭合触发器 + 展开浮层均使用 --pc-neu-* 阴影，不依赖原生 <select> 系统弹层。
 */
export function renderNeuSelect({
    id,
    value,
    options,
    label = '',
    className = '',
    placeholder = '',
    align = 'start',
} = {}) {
    const items = (options || []).map(opt => ({
        value: String(opt.value),
        label: String(opt.label ?? opt.value),
    }));
    const current = items.find(item => item.value === String(value)) || items[0];
    const display = current?.label || placeholder || '';

    return `
        <div class="pc-neu-select ${className}" id="${id}" data-value="${current?.value ?? ''}" data-align="${align}">
            <button type="button" class="pc-neu-select-trigger" aria-haspopup="listbox" aria-expanded="false"${label ? ` aria-label="${label}"` : ''}>
                <span class="pc-neu-select-value">${escapeNeuText(display)}</span>
                <span class="pc-neu-select-arrow" aria-hidden="true"></span>
            </button>
            <ul class="pc-neu-select-menu" role="listbox"${label ? ` aria-label="${label}"` : ''} hidden>
                ${items.map(item => `
                    <li class="pc-neu-select-option" role="option" data-value="${escapeNeuAttr(item.value)}" aria-selected="${item.value === current?.value ? 'true' : 'false'}" tabindex="-1">
                        <span class="pc-neu-select-option-label">${escapeNeuText(item.label)}</span>
                        <span class="pc-neu-select-option-check" aria-hidden="true"></span>
                    </li>
                `).join('')}
            </ul>
        </div>
    `;
}

export function bindNeuSelect(root, onChange) {
    if (!root) return () => {};

    const trigger = root.querySelector('.pc-neu-select-trigger');
    const menu = root.querySelector('.pc-neu-select-menu');
    const valueEl = root.querySelector('.pc-neu-select-value');
    const options = Array.from(root.querySelectorAll('.pc-neu-select-option'));
    if (!trigger || !menu || !valueEl || !options.length) return () => {};

    let activeIndex = Math.max(0, options.findIndex(option => option.dataset.value === root.dataset.value));
    let disposed = false;

    const setOpen = (open) => {
        root.classList.toggle('pc-neu-select-open', open);
        trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
        menu.hidden = !open;
        if (open) {
            activeIndex = Math.max(0, options.findIndex(option => option.dataset.value === root.dataset.value));
            options.forEach((option, index) => option.classList.toggle('pc-neu-select-option-active', index === activeIndex));
        }
    };

    const commitValue = (value) => {
        const target = options.find(option => option.dataset.value === value);
        const label = target?.querySelector('.pc-neu-select-option-label')?.textContent?.trim() || value;
        root.dataset.value = value;
        valueEl.textContent = label;
        options.forEach(option => {
            const selected = option.dataset.value === value;
            option.setAttribute('aria-selected', selected ? 'true' : 'false');
            option.classList.toggle('pc-neu-select-option-active', selected);
        });
        setOpen(false);
        trigger.focus();
        onChange?.(value, label);
    };

    const onTriggerClick = () => setOpen(menu.hidden);
    const onTriggerKeyDown = (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(true);
            options[activeIndex]?.focus();
            return;
        }
        if (e.key === 'Escape') setOpen(false);
    };

    trigger.addEventListener('click', onTriggerClick);
    trigger.addEventListener('keydown', onTriggerKeyDown);

    const optionHandlers = options.map((option, index) => {
        const onClick = () => commitValue(option.dataset.value);
        const onKeyDown = (e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const delta = e.key === 'ArrowDown' ? 1 : -1;
                activeIndex = (index + delta + options.length) % options.length;
                options.forEach((item, i) => item.classList.toggle('pc-neu-select-option-active', i === activeIndex));
                options[activeIndex].focus();
                return;
            }
            if (e.key === 'Home') {
                e.preventDefault();
                activeIndex = 0;
                options[0].focus();
                return;
            }
            if (e.key === 'End') {
                e.preventDefault();
                activeIndex = options.length - 1;
                options[activeIndex].focus();
                return;
            }
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                commitValue(option.dataset.value);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setOpen(false);
                trigger.focus();
                return;
            }
            if (e.key === 'Tab') setOpen(false);
        };
        option.addEventListener('click', onClick);
        option.addEventListener('keydown', onKeyDown);
        return { option, onClick, onKeyDown };
    });

    const onDocPointerDown = (e) => {
        if (disposed || !root.isConnected) {
            document.removeEventListener('pointerdown', onDocPointerDown);
            return;
        }
        if (!root.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDocPointerDown);

    return () => {
        disposed = true;
        trigger.removeEventListener('click', onTriggerClick);
        trigger.removeEventListener('keydown', onTriggerKeyDown);
        optionHandlers.forEach(({ option, onClick, onKeyDown }) => {
            option.removeEventListener('click', onClick);
            option.removeEventListener('keydown', onKeyDown);
        });
        document.removeEventListener('pointerdown', onDocPointerDown);
    };
}

function escapeNeuText(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escapeNeuAttr(value) {
    return escapeNeuText(value).replace(/'/g, '&#39;');
}
