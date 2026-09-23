import { afterEach, describe, expect, it } from 'vitest';
import { closeModal, showModal } from './pc-utils.js';

describe('PC 通用弹层', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('激活后支持点击遮罩与 Escape 关闭', () => {
        const modal = showModal('<button type="button">内容</button>');
        const overlay = document.querySelector('#pcModalOverlay');

        expect(modal).toBeTruthy();
        expect(overlay.classList.contains('pc-modal-active')).toBe(true);

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(overlay.classList.contains('pc-modal-active')).toBe(false);

        showModal('<button type="button">内容</button>');
        overlay.click();
        expect(overlay.classList.contains('pc-modal-active')).toBe(false);
        closeModal();
    });
});
