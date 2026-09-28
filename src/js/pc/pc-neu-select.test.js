import { describe, it, expect, afterEach } from 'vitest';
import { bindNeuSelect, renderNeuSelect } from './pc-neu-select.js';

describe('pc-neu-select 轻拟态下拉', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('渲染自定义 listbox 而非原生 select', () => {
        document.body.innerHTML = renderNeuSelect({
            id: 'demoSelect',
            value: 'b',
            label: '演示',
            options: [
                { value: 'a', label: '甲' },
                { value: 'b', label: '乙' },
                { value: 'c', label: '丙' },
            ],
        });
        expect(document.querySelector('select')).toBeNull();
        const root = document.querySelector('#demoSelect');
        expect(root.dataset.value).toBe('b');
        expect(root.querySelector('.pc-neu-select-value').textContent).toBe('乙');
        expect(root.querySelectorAll('[role="option"]')).toHaveLength(3);
        expect(root.querySelector('[data-value="b"]').getAttribute('aria-selected')).toBe('true');
    });

    it('支持展开、选择并回传 onChange', () => {
        document.body.innerHTML = renderNeuSelect({
            id: 'demoSelect',
            value: 'a',
            options: [
                { value: 'a', label: '甲' },
                { value: 'c', label: '丙' },
            ],
        });
        const root = document.querySelector('#demoSelect');
        const calls = [];
        bindNeuSelect(root, (value, label) => calls.push([value, label]));

        const trigger = root.querySelector('.pc-neu-select-trigger');
        const menu = root.querySelector('.pc-neu-select-menu');
        trigger.click();
        expect(menu.hidden).toBe(false);
        expect(trigger.getAttribute('aria-expanded')).toBe('true');

        root.querySelector('[data-value="c"]').click();
        expect(calls).toEqual([['c', '丙']]);
        expect(root.dataset.value).toBe('c');
        expect(menu.hidden).toBe(true);
    });
});
