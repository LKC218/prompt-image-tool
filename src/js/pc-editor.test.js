import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as editorPage from './pc-editor.js';

const storageMocks = vi.hoisted(() => ({
    getStorage: vi.fn(),
}));

const pcAppMocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    goBack: vi.fn(),
}));

const pcUtilsMocks = vi.hoisted(() => ({
    showToast: vi.fn(),
    showModal: vi.fn(),
    closeModal: vi.fn(),
    showConfirmModal: vi.fn(),
    showContextMenu: vi.fn(),
    hideContextMenu: vi.fn(),
    showImageViewer: vi.fn(),
    copyToClipboard: vi.fn(),
}));

vi.mock('./storage.js', () => ({
    getStorage: storageMocks.getStorage,
}));

vi.mock('./pc-app.js', () => ({
    navigate: pcAppMocks.navigate,
    goBack: pcAppMocks.goBack,
}));

vi.mock('./pc-utils.js', () => ({
    showToast: pcUtilsMocks.showToast,
    showModal: pcUtilsMocks.showModal,
    closeModal: pcUtilsMocks.closeModal,
    showConfirmModal: pcUtilsMocks.showConfirmModal,
    showContextMenu: pcUtilsMocks.showContextMenu,
    hideContextMenu: pcUtilsMocks.hideContextMenu,
    showImageViewer: pcUtilsMocks.showImageViewer,
    copyToClipboard: pcUtilsMocks.copyToClipboard,
    escapeHtml: (value = '') => String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;'),
}));

vi.mock('./pc-icon-assets.js', () => ({
    pcIcon: (name, className = '') => `<span class="${className}" data-icon="${name}"></span>`,
}));

vi.mock('./pc-welcome-banner.js', () => ({
    renderPcWelcomeBanner: ({ leadingHtml = '', actionsHtml = '' }) => `
        <div class="pc-welcome-banner">
            ${leadingHtml}
            ${actionsHtml}
        </div>
    `,
    renderPcWelcomeWalkAnimation: () => '<div class="pc-welcome-pixel-stage"></div>',
}));

function createStorage() {
    return {
        getFolders: vi.fn(async () => []),
        getPromptSets: vi.fn(async () => [
            {
                id: 'prompt-1',
                name: '已有提示词',
                tags: JSON.stringify(['测试标签']),
                versions: [],
            },
        ]),
        getPromptSet: vi.fn(async () => ({
            id: 'prompt-1',
            name: '已有提示词',
            folderId: '',
            tags: JSON.stringify(['测试标签']),
            versions: [{
                name: 'v1',
                prompt: 'saved prompt',
                negativePrompt: '',
                images: [],
            }],
        })),
        createPromptSet: vi.fn(async () => ({ id: 'prompt-new' })),
        updatePromptSet: vi.fn(async () => ({ ok: true })),
        uploadImage: vi.fn(async (id, data, name) => ({ file: `${id}-${name}` })),
    };
}

async function mountEditor() {
    const pageEl = document.createElement('div');
    pageEl.innerHTML = editorPage.render({});
    document.body.appendChild(pageEl);
    await editorPage.mount(pageEl, {});
    return pageEl;
}

async function flush() {
    await new Promise(resolve => setTimeout(resolve, 0));
}

describe('PC 编辑页保存流程', () => {
    let storage;

    beforeEach(() => {
        storage = createStorage();
        storageMocks.getStorage.mockReturnValue(storage);
        pcUtilsMocks.showModal.mockImplementation((content) => {
            const modal = document.createElement('div');
            modal.innerHTML = content;
            document.body.appendChild(modal);
            return modal;
        });
        document.body.innerHTML = '<div id="pcApp"></div>';
        localStorage.clear();
    });

    afterEach(() => {
        editorPage.unmount(document.body);
        vi.clearAllMocks();
    });

    it('内容重绘后点击一次保存只发起一次新建请求', async () => {
        const pageEl = await mountEditor();

        const nameInput = pageEl.querySelector('#pcEditorName');
        nameInput.value = 'PC 保存回归';
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));

        const positiveInput = pageEl.querySelector('#pcEditorPositive');
        positiveInput.value = 'positive prompt';
        positiveInput.dispatchEvent(new Event('input', { bubbles: true }));

        pageEl.querySelector('#pcAddTagBtn').click();
        document.querySelector('.pc-tag-picker-item').click();

        pageEl.querySelector('#pcEditorSave').click();
        await flush();

        expect(storage.createPromptSet).toHaveBeenCalledTimes(1);
        expect(storage.updatePromptSet).toHaveBeenCalledTimes(1);
        expect(pcUtilsMocks.showToast).toHaveBeenCalledWith('已创建');
        expect(pcAppMocks.navigate).toHaveBeenCalledWith('/library');
    });

    it('连续点击保存时只执行一次保存链路', async () => {
        const pageEl = await mountEditor();

        pageEl.querySelector('#pcEditorName').value = 'PC 连续点击';
        pageEl.querySelector('#pcEditorName').dispatchEvent(new Event('input', { bubbles: true }));
        pageEl.querySelector('#pcEditorPositive').value = 'positive prompt';
        pageEl.querySelector('#pcEditorPositive').dispatchEvent(new Event('input', { bubbles: true }));

        const saveBtn = pageEl.querySelector('#pcEditorSave');
        saveBtn.click();
        saveBtn.click();
        await flush();

        expect(storage.createPromptSet).toHaveBeenCalledTimes(1);
        expect(storage.updatePromptSet).toHaveBeenCalledTimes(1);
    });

    it('新建页一键清空会确认后重置输入并删除草稿', async () => {
        pcUtilsMocks.showConfirmModal.mockImplementation((message, onConfirm) => onConfirm());
        const pageEl = await mountEditor();

        const clearBtn = pageEl.querySelector('#pcEditorClearAll');
        expect(clearBtn).not.toBeNull();
        expect(clearBtn.disabled).toBe(true);

        const nameInput = pageEl.querySelector('#pcEditorName');
        nameInput.value = '待清空提示词';
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));

        const positiveInput = pageEl.querySelector('#pcEditorPositive');
        positiveInput.value = 'positive prompt';
        positiveInput.dispatchEvent(new Event('input', { bubbles: true }));

        expect(localStorage.getItem('pc-editor-draft:new')).not.toBeNull();
        expect(clearBtn.disabled).toBe(false);

        clearBtn.click();

        expect(pcUtilsMocks.showConfirmModal).toHaveBeenCalledWith(
            '确定清空当前未保存内容和图片预览吗？',
            expect.any(Function)
        );
        expect(pageEl.querySelector('#pcEditorName').value).toBe('');
        expect(pageEl.querySelector('#pcEditorPositive').value).toBe('');
        expect(pageEl.querySelector('#pcEditorClearAll').disabled).toBe(true);
        expect(localStorage.getItem('pc-editor-draft:new')).toBeNull();
        expect(pcUtilsMocks.showToast).toHaveBeenCalledWith('已清空当前输入');
    });

    it('编辑模式不渲染新建页一键清空按钮', () => {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = editorPage.render({ id: 'prompt-1' });
        expect(wrapper.querySelector('#pcEditorClearAll')).toBeNull();
    });

    it('比例选项包含并可选择21:9', async () => {
        const pageEl = await mountEditor();
        const ratioBtn = [...pageEl.querySelectorAll('.pc-editor-ratio-btn')]
            .find(btn => btn.dataset.ratio === '21:9');

        expect(ratioBtn).toBeTruthy();
        ratioBtn.click();

        expect(ratioBtn.classList.contains('pc-editor-ratio-active')).toBe(true);
        expect(ratioBtn.getAttribute('aria-pressed')).toBe('true');
    });

    it('选中文本后自动弹出菜单并同步删除数据', async () => {
        vi.useFakeTimers();
        pcUtilsMocks.showContextMenu.mockResolvedValueOnce('delete');
        const pageEl = await mountEditor();
        const positiveInput = pageEl.querySelector('#pcEditorPositive');
        positiveInput.value = '保留删除保留';
        positiveInput.focus();
        positiveInput.setSelectionRange(2, 4);

        positiveInput.dispatchEvent(new Event('select', {
            bubbles: true,
        }));
        await vi.advanceTimersByTimeAsync(180);

        expect(pcUtilsMocks.showContextMenu).toHaveBeenCalledTimes(1);
        expect(pcUtilsMocks.showContextMenu).toHaveBeenCalledWith(
            expect.any(Number),
            expect.any(Number),
            expect.any(Array),
            expect.objectContaining({
                focusMenu: false,
                referenceRect: expect.objectContaining({ width: expect.any(Number), height: expect.any(Number) }),
                placement: expect.objectContaining({ preferredSide: 'top', gap: 20, safeMargin: 24 })
            })
        );
        expect(pcUtilsMocks.showContextMenu.mock.calls[0][2]).toEqual(expect.arrayContaining([
            expect.objectContaining({ action: 'copy', tone: 'copy' }),
            expect.objectContaining({ action: 'paste', tone: 'paste' }),
            expect.objectContaining({ action: 'delete', tone: 'delete' })
        ]));
        expect(positiveInput.value).toBe('保留保留');
        expect(pageEl.querySelector('#pcPositiveCount').textContent).toBe(`4/6666`);
        vi.useRealTimers();
    });

    it('右键选区不再触发项目操作菜单', async () => {
        const pageEl = await mountEditor();
        const positiveInput = pageEl.querySelector('#pcEditorPositive');
        positiveInput.value = '右键不触发';
        positiveInput.setSelectionRange(0, 2);

        positiveInput.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
        await flush();

        expect(pcUtilsMocks.showContextMenu).not.toHaveBeenCalled();
    });
});
