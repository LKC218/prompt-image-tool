import {
    getRawSvgIcon,
    renderSvgIcon,
    svgToDataUri,
} from '../shared/svg-icons.js';

const PC_ICON_KEYS = [
    'archiveZip',
    'arrowRight',
    'arrowUpDown',
    'balance',
    'ban',
    'calendar',
    'chatImport',
    'check',
    'checkCircle',
    'checkUpdate',
    'chevronDown',
    'chevronLeft',
    'chevronRight',
    'chevronUp',
    'clipboard',
    'clock',
    'copy',
    'download',
    'edit',
    'eye',
    'fileJsonImport',
    'focus',
    'folder',
    'folderOpen',
    'gripVertical',
    'heart',
    'image',
    'import',
    'info',
    'listView',
    'map',
    'merge',
    'mindmap',
    'moon',
    'moreHorizontal',
    'moreVertical',
    'palette',
    'pencilLine',
    'plus',
    'prompt',
    'releaseNotes',
    'rotateCcw',
    'save',
    'search',
    'shield',
    'sparkles',
    'star',
    'starFilled',
    'sun',
    'tag',
    'trash',
    'user',
    'warning',
    'x',
];

const PC_ICON_MAP = Object.fromEntries(
    PC_ICON_KEYS.map(key => [key, svgToDataUri(getRawSvgIcon(key))])
);

function pcIcon(name, className = 'pc-icon-img', alt = '', options = {}) {
    return renderSvgIcon(name, {
        className,
        label: alt,
        tone: options.tone,
        duotone: options.duotone,
        size: options.size,
    });
}

export { PC_ICON_MAP, pcIcon };
