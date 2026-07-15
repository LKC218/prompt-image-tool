import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storageMocks = vi.hoisted(() => ({
    getStorage: vi.fn(),
}));

const appMocks = vi.hoisted(() => ({
    navigate: vi.fn(),
}));

const utilsMocks = vi.hoisted(() => ({
    showToast: vi.fn(),
    showConfirmModal: vi.fn(),
    copyToClipboard: vi.fn(),
    showImageViewer: vi.fn(),
    showContextMenu: vi.fn(),
}));

vi.mock('./storage.js', () => ({
    getStorage: storageMocks.getStorage,
}));

vi.mock('./pc-app.js', () => ({
    navigate: appMocks.navigate,
}));

vi.mock('./pc-utils.js', () => ({
    showToast: utilsMocks.showToast,
    showConfirmModal: utilsMocks.showConfirmModal,
    copyToClipboard: utilsMocks.copyToClipboard,
    showImageViewer: utilsMocks.showImageViewer,
    showContextMenu: utilsMocks.showContextMenu,
    escapeHtml: (value = '') => String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;'),
    formatDate: (value = '') => value,
}));

vi.mock('./pc-prompt-ui-utils.js', () => ({
    formatPromptForDisplay: (value = '') => String(value).trim(),
}));

vi.mock('./pc-icon-assets.js', () => ({
    pcIcon: (name, className = '') => `<svg data-icon="${name}" class="${className}"></svg>`,
}));

vi.mock('./pc-welcome-banner.js', () => ({
    renderPcWelcomeWalkAnimation: vi.fn(() => ''),
}));

function buildPromptSet() {
    return {
        id: 'prompt-1',
        name: '多图提示词',
        tags: JSON.stringify(['测试']),
        isFavorite: false,
        createdAt: '2026-07-15T09:00:00.000Z',
        updatedAt: '2026-07-15T09:00:00.000Z',
        versions: [{
            id: 'version-1',
            name: 'v1',
            prompt: 'positive prompt',
            negativePrompt: '',
            aspectRatio: '16:9',
            createdAt: '2026-07-15T09:00:00.000Z',
            images: [
                { id: 'image-1', name: 'first.webp', file: 'first.webp' },
                { id: 'image-2', name: 'second.webp', file: 'second.webp' },
                { id: 'image-3', name: 'third.webp', file: 'third.webp' },
            ],
        }],
    };
}

async function mountDetailPage() {
    const detailPage = await import('./pc-detail.js');
    const pageEl = document.createElement('div');
    pageEl.innerHTML = detailPage.render();
    document.body.appendChild(pageEl);
    await detailPage.mount(pageEl, { id: 'prompt-1' });
    return { detailPage, pageEl };
}

describe('pc-detail image preview', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.resetModules();
        document.body.innerHTML = '';
        storageMocks.getStorage.mockReturnValue({
            getPromptSet: vi.fn(async () => buildPromptSet()),
            getImageUrl: vi.fn(async (image) => `https://local.test/images/${image.file}`),
        });
        utilsMocks.showImageViewer.mockClear();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('渲染多图缩略图并切换当前预览图', async () => {
        const { pageEl } = await mountDetailPage();

        const thumbs = pageEl.querySelectorAll('.pc-detail-image-thumb');
        expect(thumbs).toHaveLength(3);
        expect(pageEl.querySelector('#pcDetailImgCounter')?.textContent).toBe('1 / 3');
        expect(pageEl.querySelector('#pcDetailCoverImgWrap img')?.src).toContain('first.webp');

        thumbs[2].click();
        vi.advanceTimersByTime(160);

        expect(pageEl.querySelector('#pcDetailCoverImgWrap img')?.src).toContain('third.webp');
        expect(pageEl.querySelector('#pcDetailImgCounter')?.textContent).toBe('3 / 3');
        expect(thumbs[2].classList.contains('pc-detail-image-thumb-active')).toBe(true);
        expect(thumbs[2].getAttribute('aria-pressed')).toBe('true');

        pageEl.querySelector('#pcDetailCoverImgWrap')?.click();
        expect(utilsMocks.showImageViewer).toHaveBeenCalledWith(expect.objectContaining({
            src: expect.stringContaining('third.webp'),
            filename: 'third.webp',
            image: expect.objectContaining({ id: 'image-3' }),
        }));
    });
});
