let _showMobileToast = null;
let _showActionSheet = null;
let _navigate = null;
let _goBack = null;

function initMobileUtils(fns) {
    _showMobileToast = fns.showMobileToast;
    _showActionSheet = fns.showActionSheet;
    _navigate = fns.navigate;
    _goBack = fns.goBack;
}

function showMobileToast(msg, type) {
    if (_showMobileToast) _showMobileToast(msg, type);
}

function showActionSheet(items) {
    if (_showActionSheet) _showActionSheet(items);
}

function navigate(path, params) {
    if (_navigate) _navigate(path, params);
}

function goBack() {
    if (_goBack) _goBack();
}

function iconImg(src, alt = '') {
    const hidden = alt ? '' : ' aria-hidden="true"';
    return `<img src="${src}" alt="${alt}" class="m-icon-img"${hidden}>`;
}

export { initMobileUtils, showMobileToast, showActionSheet, navigate, goBack, iconImg };
