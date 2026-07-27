import { describe, expect, it, vi } from 'vitest';

const routerVariants = [
    { name: 'PC', view: 'pc', modulePath: './pc-router.js' },
    { name: '移动端', view: 'mobile', modulePath: './mobile-router.js' },
];

function registerRoutes(router) {
    router.registerRoute('/', {});
    router.registerRoute('/library', {});
}

describe.each(routerVariants)('%s 路由 History 状态恢复', ({ view, modulePath }) => {
    it('初始化时恢复合法状态，popstate 恢复页面与业务返回栈', async () => {
        history.replaceState({ view, path: '/library', params: {}, stack: [] }, '');
        vi.resetModules();
        const router = await import(modulePath);
        registerRoutes(router);
        const onRouteChange = vi.fn();
        router.setRouteChangeCallback(onRouteChange);

        expect(router.initRouter()).toMatchObject({ path: '/library', routeKey: '/library' });
        expect(router.getCurrentRoute()).toMatchObject({ path: '/library' });

        const libraryState = structuredClone(history.state);
        router.navigate('/');
        expect(history.state).toMatchObject({ view, path: '/', stack: [{ path: '/library' }] });

        window.dispatchEvent(new PopStateEvent('popstate', { state: libraryState }));
        expect(router.getCurrentRoute()).toMatchObject({ path: '/library' });
        expect(router.getRouteStack()).toEqual([]);
        expect(onRouteChange).toHaveBeenCalledTimes(2);
        expect(onRouteChange).toHaveBeenLastCalledWith(
            expect.objectContaining({ path: '/library' }),
            expect.objectContaining({ path: '/' }),
            'pop'
        );
    });

    it('仅由 popstate 协调应用内返回，并安全回退无效状态', async () => {
        history.replaceState(null, '');
        vi.resetModules();
        const router = await import(modulePath);
        registerRoutes(router);
        const onRouteChange = vi.fn();
        router.setRouteChangeCallback(onRouteChange);
        router.initRouter();
        const homeState = structuredClone(history.state);
        router.navigate('/library');

        const historyBack = vi.spyOn(history, 'back').mockImplementation(() => {});
        historyBack.mockClear();
        expect(router.goBack()).toBe(true);
        expect(historyBack).toHaveBeenCalledOnce();
        expect(onRouteChange).toHaveBeenCalledTimes(1);

        window.dispatchEvent(new PopStateEvent('popstate', { state: homeState }));
        expect(router.getCurrentRoute()).toMatchObject({ path: '/' });
        expect(onRouteChange).toHaveBeenCalledTimes(2);

        history.replaceState({ view: 'other', path: '/library', params: {} }, '');
        vi.resetModules();
        const freshRouter = await import(modulePath);
        registerRoutes(freshRouter);
        expect(freshRouter.initRouter()).toMatchObject({ path: '/' });
        expect(history.state).toMatchObject({ view, path: '/', stack: [] });
    });
});
