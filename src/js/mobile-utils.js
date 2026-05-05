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

export { initMobileUtils, showMobileToast, showActionSheet, navigate, goBack };
