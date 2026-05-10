const routes = {};
const routeStack = [];
let currentRoute = null;
let onRouteChange = null;
let isProgrammaticBack = false;

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

function extractParams(routeKey, actualPath) {
    const params = {};
    if (!routeKey || !routeKey.includes(':')) return params;
    const keyParts = routeKey.split('/');
    const pathParts = actualPath.split('/');
    for (let i = 0; i < keyParts.length; i++) {
        if (keyParts[i].startsWith(':')) {
            params[keyParts[i].slice(1)] = pathParts[i] || '';
        }
    }
    return params;
}

function navigate(path, params = {}) {
    const handler = getRouteHandler(path);
    if (!handler) {
        console.warn('Route not found:', path);
        return;
    }
    const routeKey = handler.key;
    const extractedParams = extractParams(routeKey, path);
    const mergedParams = { ...extractedParams, ...params };
    const prevRoute = currentRoute;
    currentRoute = { path, params: mergedParams, routeKey };

    if (prevRoute && prevRoute.path !== path) {
        routeStack.push(prevRoute);
    }

    history.pushState({ view: 'pc', path, params: mergedParams }, '');

    if (onRouteChange) {
        onRouteChange(currentRoute, prevRoute, 'push');
    }
}

function replace(path, params = {}) {
    const handler = getRouteHandler(path);
    if (!handler) return;
    const routeKey = handler.key;
    const extractedParams = extractParams(routeKey, path);
    const mergedParams = { ...extractedParams, ...params };
    const prevRoute = currentRoute;
    currentRoute = { path, params: mergedParams, routeKey };

    history.replaceState({ view: 'pc', path, params: mergedParams }, '');

    if (onRouteChange) {
        onRouteChange(currentRoute, prevRoute, 'replace');
    }
}

function goBack() {
    if (routeStack.length === 0) return false;
    const prevRoute = routeStack.pop();
    const currentSnapshot = currentRoute;
    currentRoute = prevRoute;
    isProgrammaticBack = true;
    history.back();
    if (onRouteChange) {
        onRouteChange(currentRoute, currentSnapshot, 'pop');
    }
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
    routeStack.length = 0;
    const prevRoute = currentRoute;
    currentRoute = { path, params: {}, routeKey: path };
    history.replaceState({ view: 'pc', path, params: {} }, '');
    if (onRouteChange) {
        onRouteChange(currentRoute, prevRoute, 'tab');
    }
}

function initRouter() {
    history.replaceState({ view: 'pc', path: '/', params: {} }, '');
    currentRoute = { path: '/', params: {}, routeKey: '/' };

    window.addEventListener('popstate', (e) => {
        if (!e.state || e.state.view !== 'pc') return;
        if (isProgrammaticBack) {
            isProgrammaticBack = false;
            return;
        }
        if (routeStack.length > 0) {
            const prev = routeStack.pop();
            const currentSnapshot = currentRoute;
            currentRoute = prev;
            if (onRouteChange) {
                onRouteChange(currentRoute, currentSnapshot, 'pop');
            }
        }
    });
}

export {
    registerRoute,
    navigate,
    replace,
    goBack,
    navigateToTab,
    getCurrentRoute,
    getRouteStack,
    clearStack,
    setRouteChangeCallback,
    initRouter,
    getRouteHandler,
    resolveRouteKey,
    extractParams
};
