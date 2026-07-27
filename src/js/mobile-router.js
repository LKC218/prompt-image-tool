const routes = {};
const routeStack = [];
let currentRoute = null;
let onRouteChange = null;

function registerRoute(path, handler) {
    routes[path] = { ...handler, key: path };
}

function setRouteChangeCallback(cb) {
    onRouteChange = cb;
}

function getRouteHandler(pathOrKey) {
    if (routes[pathOrKey]) return routes[pathOrKey];

    for (const key of Object.keys(routes)) {
        if (key.includes(':')) {
            const pattern = key.replace(/:[^/]+/g, '[^/]*');
            if (new RegExp(`^${pattern}$`).test(pathOrKey)) {
                return routes[key];
            }
        }
    }
    return null;
}

function resolveRouteKey(path) {
    const handler = getRouteHandler(path);
    return handler ? handler.key : path;
}

function cloneRoute(route) {
    return {
        path: route.path,
        params: { ...(route.params || {}) },
        routeKey: route.routeKey,
    };
}

function buildHistoryState() {
    return {
        view: 'mobile',
        path: currentRoute.path,
        params: { ...(currentRoute.params || {}) },
        stack: routeStack.map(cloneRoute),
    };
}

function hydrateHistoryState(state) {
    if (!state || state.view !== 'mobile' || typeof state.path !== 'string') return null;
    const handler = getRouteHandler(state.path);
    if (!handler) return null;

    const stack = Array.isArray(state.stack)
        ? state.stack.map((route) => {
            if (!route || typeof route.path !== 'string') return null;
            const stackHandler = getRouteHandler(route.path);
            return stackHandler
                ? { path: route.path, params: { ...(route.params || {}) }, routeKey: stackHandler.key }
                : null;
        }).filter(Boolean)
        : [];

    return {
        route: { path: state.path, params: { ...(state.params || {}) }, routeKey: handler.key },
        stack,
    };
}

function navigate(path, params = {}) {
    const handler = getRouteHandler(path);
    if (!handler) {
        console.warn('Route not found:', path);
        return;
    }

    const routeKey = handler.key;
    const prevRoute = currentRoute;
    currentRoute = { path, params, routeKey };

    if (prevRoute && prevRoute.path !== path) {
        routeStack.push(prevRoute);
    }

    history.pushState(buildHistoryState(), '');

    if (onRouteChange) {
        onRouteChange(currentRoute, prevRoute, 'push');
    }
}

function goBack() {
    if (routeStack.length === 0) return false;
    history.back();
    return true;
}

function getCurrentRoute() {
    return currentRoute;
}

function getRouteStack() {
    return routeStack;
}

function clearStack() {
    routeStack.length = 0;
}

function navigateToTab(path) {
    const handler = getRouteHandler(path);
    if (!handler) return;
    routeStack.length = 0;
    const prevRoute = currentRoute;
    currentRoute = { path, params: {}, routeKey: handler.key };

    history.replaceState(buildHistoryState(), '');

    if (onRouteChange) {
        onRouteChange(currentRoute, prevRoute, 'tab');
    }
}

function initRouter() {
    const restored = hydrateHistoryState(history.state);
    if (restored) {
        currentRoute = restored.route;
        routeStack.splice(0, routeStack.length, ...restored.stack);
    } else {
        routeStack.length = 0;
        currentRoute = { path: '/', params: {}, routeKey: '/' };
        history.replaceState(buildHistoryState(), '');
    }

    window.addEventListener('popstate', (e) => {
        const restoredState = hydrateHistoryState(e.state);
        if (!restoredState) return;
        const previousRoute = currentRoute;
        currentRoute = restoredState.route;
        routeStack.splice(0, routeStack.length, ...restoredState.stack);
        if (onRouteChange) {
            onRouteChange(currentRoute, previousRoute, 'pop');
        }
    });

    return currentRoute;
}

export {
    registerRoute,
    navigate,
    goBack,
    navigateToTab,
    getCurrentRoute,
    getRouteStack,
    clearStack,
    setRouteChangeCallback,
    initRouter,
    getRouteHandler,
    resolveRouteKey
};
