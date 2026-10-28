import {
    getRawSvgIcon,
    renderSvgIcon,
    svgToDataUri,
} from '../shared/svg-icons.js';

const MOBILE_ICON_KEYS = [
    'plus',
    'copy',
    'edit',
    'folder',
    'folder-open',
    'more',
    'rename',
    'trash',
    'warning',
    'palette',
    'sync',
    'check',
    'check-circle',
    'grip',
    'rocket',
    'camera',
    'chat-import',
    'image',
    'import',
    'tag',
    'sort',
    'merge',
    'chevron-left',
    'chevron-right',
    'chevron-down',
    'chevron-up',
    'x',
    'star',
    'star-filled',
    'maximize',
    'file',
    'refresh',
    'loader',
    'clipboard',
    'heart',
    'download',
];

const MOBILE_ICONS = Object.fromEntries(
    MOBILE_ICON_KEYS.map(key => [key, svgToDataUri(getRawSvgIcon(key))])
);

function mobileIcon(name, options = {}) {
    const safeName = String(name || '').replace(/[^a-z0-9-]/gi, '-');
    const classes = ['m-svg-icon', `m-svg-icon-${safeName}`];
    if (options.className) {
        classes.push(String(options.className).trim());
    }

    return renderSvgIcon(name, {
        className: classes.join(' '),
        label: options.label || '',
        tone: options.tone,
        duotone: options.duotone,
        size: options.size,
    });
}

export { MOBILE_ICONS, mobileIcon };
