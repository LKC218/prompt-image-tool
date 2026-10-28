import archiveZipSvg from '../../assets/icons/archive-zip.svg?raw';
import arrowUpDownSvg from '../../assets/icons/arrow-up-down.svg?raw';
import balanceSvg from '../../assets/icons/balance.svg?raw';
import banSvg from '../../assets/icons/ban.svg?raw';
import calendarSvg from '../../assets/icons/calendar.svg?raw';
import cameraSvg from '../../assets/icons/camera.svg?raw';
import chatImportSvg from '../../assets/icons/chat-import.svg?raw';
import checkCircleSvg from '../../assets/icons/check-circle.svg?raw';
import checkSvg from '../../assets/icons/check.svg?raw';
import checkUpdateSvg from '../../assets/icons/check-update.svg?raw';
import chevronDownSvg from '../../assets/icons/chevron-down.svg?raw';
import chevronLeftSvg from '../../assets/icons/chevron-left.svg?raw';
import chevronRightSvg from '../../assets/icons/chevron-right.svg?raw';
import chevronUpSvg from '../../assets/icons/chevron-up.svg?raw';
import clipboardSvg from '../../assets/icons/clipboard.svg?raw';
import clockSvg from '../../assets/icons/clock.svg?raw';
import copySvg from '../../assets/icons/copy.svg?raw';
import downloadSvg from '../../assets/icons/download.svg?raw';
import editSvg from '../../assets/icons/edit.svg?raw';
import eyeSvg from '../../assets/icons/eye.svg?raw';
import fileJsonImportSvg from '../../assets/icons/file-json-import.svg?raw';
import fileTextSvg from '../../assets/icons/file-text.svg?raw';
import focusSvg from '../../assets/icons/focus.svg?raw';
import folderOpenSvg from '../../assets/icons/folder-open.svg?raw';
import folderSvg from '../../assets/icons/folder.svg?raw';
import gripVerticalSvg from '../../assets/icons/grip-vertical.svg?raw';
import heartSvg from '../../assets/icons/heart.svg?raw';
import imageSvg from '../../assets/icons/image.svg?raw';
import importSvg from '../../assets/icons/import.svg?raw';
import infoSvg from '../../assets/icons/info.svg?raw';
import listViewSvg from '../../assets/icons/list-view.svg?raw';
import loaderCircleSvg from '../../assets/icons/loader-circle.svg?raw';
import mapSvg from '../../assets/icons/map.svg?raw';
import maximizeSvg from '../../assets/icons/maximize.svg?raw';
import mergeSvg from '../../assets/icons/merge.svg?raw';
import mindmapSvg from '../../assets/icons/mindmap.svg?raw';
import moonSvg from '../../assets/icons/moon.svg?raw';
import moreHorizontalSvg from '../../assets/icons/more-horizontal.svg?raw';
import moreVerticalSvg from '../../assets/icons/more-vertical.svg?raw';
import paletteSvg from '../../assets/icons/palette.svg?raw';
import pencilLineSvg from '../../assets/icons/pencil-line.svg?raw';
import plantBugClearSvg from '../../assets/icons/plant-bug-clear.svg?raw';
import plantFertilizeSvg from '../../assets/icons/plant-fertilize.svg?raw';
import plantWaterSvg from '../../assets/icons/plant-water.svg?raw';
import plusSvg from '../../assets/icons/plus.svg?raw';
import promptSvg from '../../assets/icons/prompt.svg?raw';
import refreshCwSvg from '../../assets/icons/refresh-cw.svg?raw';
import releaseNotesSvg from '../../assets/icons/release-notes.svg?raw';
import rocketSvg from '../../assets/icons/rocket.svg?raw';
import rotateCcwSvg from '../../assets/icons/rotate-ccw.svg?raw';
import saveSvg from '../../assets/icons/save.svg?raw';
import searchSvg from '../../assets/icons/search.svg?raw';
import shieldSvg from '../../assets/icons/shield.svg?raw';
import sparklesSvg from '../../assets/icons/sparkles.svg?raw';
import starFilledSvg from '../../assets/icons/star-filled.svg?raw';
import starSvg from '../../assets/icons/star.svg?raw';
import sunSvg from '../../assets/icons/sun.svg?raw';
import syncSvg from '../../assets/icons/sync.svg?raw';
import tagSvg from '../../assets/icons/tag.svg?raw';
import trashSvg from '../../assets/icons/trash.svg?raw';
import userRoundSvg from '../../assets/icons/user-round.svg?raw';
import warningSvg from '../../assets/icons/warning.svg?raw';
import xSvg from '../../assets/icons/x.svg?raw';

const WINDOW_CHROME_SVGS = {
    'window-back': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none"><path d="M10 3.5 5.5 8 10 12.5" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    'window-forward': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none"><path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    'window-minimize': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" fill="none"><path d="M2.2 6.2h7.6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
    'window-maximize': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" fill="none"><rect x="2.35" y="2.35" width="7.3" height="7.3" rx="0.9" stroke="currentColor" stroke-width="1.2"/></svg>',
    'window-restore': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" fill="none"><rect x="2.1" y="3.7" width="5.6" height="5.6" rx="0.8" stroke="currentColor" stroke-width="1.15"/><path d="M4.2 3.5V2.9a.6.6 0 0 1 .6-.6h3.9a.6.6 0 0 1 .6.6v3.9a.6.6 0 0 1-.6.6h-.5" stroke="currentColor" stroke-width="1.15" stroke-linecap="round"/></svg>',
    'window-close': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" fill="none"><path d="M3.3 3.3 8.7 8.7M8.7 3.3 3.3 8.7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
};

const CANONICAL_SVG_MAP = {
    'archive-zip': archiveZipSvg,
    'arrow-up-down': arrowUpDownSvg,
    balance: balanceSvg,
    ban: banSvg,
    calendar: calendarSvg,
    camera: cameraSvg,
    'chat-import': chatImportSvg,
    check: checkSvg,
    'check-circle': checkCircleSvg,
    'check-update': checkUpdateSvg,
    'chevron-down': chevronDownSvg,
    'chevron-left': chevronLeftSvg,
    'chevron-right': chevronRightSvg,
    'chevron-up': chevronUpSvg,
    clipboard: clipboardSvg,
    clock: clockSvg,
    copy: copySvg,
    download: downloadSvg,
    edit: editSvg,
    eye: eyeSvg,
    'file-json-import': fileJsonImportSvg,
    'file-text': fileTextSvg,
    focus: focusSvg,
    folder: folderSvg,
    'folder-open': folderOpenSvg,
    'grip-vertical': gripVerticalSvg,
    heart: heartSvg,
    image: imageSvg,
    import: importSvg,
    info: infoSvg,
    'list-view': listViewSvg,
    'loader-circle': loaderCircleSvg,
    map: mapSvg,
    maximize: maximizeSvg,
    merge: mergeSvg,
    mindmap: mindmapSvg,
    moon: moonSvg,
    'more-horizontal': moreHorizontalSvg,
    'more-vertical': moreVerticalSvg,
    palette: paletteSvg,
    'pencil-line': pencilLineSvg,
    'plant-bug-clear': plantBugClearSvg,
    'plant-fertilize': plantFertilizeSvg,
    'plant-water': plantWaterSvg,
    plus: plusSvg,
    prompt: promptSvg,
    'refresh-cw': refreshCwSvg,
    'release-notes': releaseNotesSvg,
    rocket: rocketSvg,
    'rotate-ccw': rotateCcwSvg,
    save: saveSvg,
    search: searchSvg,
    shield: shieldSvg,
    sparkles: sparklesSvg,
    star: starSvg,
    'star-filled': starFilledSvg,
    sun: sunSvg,
    sync: syncSvg,
    tag: tagSvg,
    trash: trashSvg,
    'user-round': userRoundSvg,
    warning: warningSvg,
    x: xSvg,
    ...WINDOW_CHROME_SVGS,
};

const ICON_ALIASES = {
    archiveZip: 'archive-zip',
    'export-json': 'archive-zip',
    arrowRight: 'chevron-right',
    'arrow-right': 'chevron-right',
    arrowLeft: 'chevron-left',
    'arrow-left': 'chevron-left',
    arrowUpDown: 'arrow-up-down',
    sort: 'arrow-up-down',
    chatImport: 'chat-import',
    'import-data': 'chat-import',
    checkCircle: 'check-circle',
    checkUpdate: 'check-update',
    chevronDown: 'chevron-down',
    chevronLeft: 'chevron-left',
    chevronRight: 'chevron-right',
    chevronUp: 'chevron-up',
    delete: 'trash',
    'trash-2': 'trash',
    trash2: 'trash',
    file: 'file-text',
    fileText: 'file-text',
    fileJsonImport: 'file-json-import',
    'import-json': 'file-json-import',
    folderOpen: 'folder-open',
    grip: 'grip-vertical',
    gripVertical: 'grip-vertical',
    listView: 'list-view',
    loader: 'loader-circle',
    loaderCircle: 'loader-circle',
    more: 'more-horizontal',
    moreHorizontal: 'more-horizontal',
    moreVertical: 'more-vertical',
    'palette-lucide': 'palette',
    paletteLucide: 'palette',
    pencilLine: 'pencil-line',
    rename: 'pencil-line',
    plantBugClear: 'plant-bug-clear',
    plantFertilize: 'plant-fertilize',
    plantWater: 'plant-water',
    refresh: 'refresh-cw',
    refreshCw: 'refresh-cw',
    releaseNotes: 'release-notes',
    rotateCcw: 'rotate-ccw',
    starFilled: 'star-filled',
    user: 'user-round',
    userRound: 'user-round',
};

function escapeSvgAttr(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function resolveSvgIconName(name = '') {
    const key = String(name).trim();
    if (!key) return '';
    if (CANONICAL_SVG_MAP[key]) return key;
    if (ICON_ALIASES[key]) return ICON_ALIASES[key];
    const kebab = key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    if (CANONICAL_SVG_MAP[kebab]) return kebab;
    return ICON_ALIASES[kebab] || '';
}

function getRawSvgIcon(name) {
    const resolved = resolveSvgIconName(name);
    return resolved ? CANONICAL_SVG_MAP[resolved] : '';
}

function svgToDataUri(rawSvg = '') {
    const compact = String(rawSvg)
        .trim()
        .replace(/>\s+</g, '><')
        .replace(/\s+/g, ' ');
    if (!compact) return '';
    const encoded = encodeURIComponent(compact)
        .replace(/'/g, '%27')
        .replace(/\(/g, '%28')
        .replace(/\)/g, '%29');
    return `data:image/svg+xml,${encoded}`;
}

/**
 * 渲染全局统一的内联 <svg> 图标，支持 currentColor 主题继承与轻双色调（Soft Duotone）图层。
 * @param {string} name
 * @param {{
 *   className?: string,
 *   label?: string,
 *   tone?: string,
 *   duotone?: boolean,
 *   size?: number | string
 * }} [options]
 */
function renderSvgIcon(name, options = {}) {
    const resolved = resolveSvgIconName(name);
    if (!resolved) return '';

    const raw = CANONICAL_SVG_MAP[resolved];
    const safeSlug = resolved.replace(/[^a-z0-9-]/gi, '-');
    const classes = ['ui-svg-icon', `ui-svg-icon-${safeSlug}`];

    if (options.tone) {
        classes.push(`ui-svg-icon--${String(options.tone).replace(/[^a-z0-9-]/gi, '-')}`);
    }
    if (options.duotone) {
        classes.push('ui-svg-icon--duotone');
    }
    if (options.className) {
        classes.push(String(options.className).trim());
    }

    const label = options.label ? String(options.label).trim() : '';
    const a11yAttrs = label
        ? `role="img" aria-label="${escapeSvgAttr(label)}"`
        : 'aria-hidden="true"';

    const sizeAttr = options.size != null && options.size !== ''
        ? ` width="${escapeSvgAttr(options.size)}" height="${escapeSvgAttr(options.size)}"`
        : '';

    const injectedAttrs = `class="${escapeSvgAttr(classes.filter(Boolean).join(' '))}" data-icon="${escapeSvgAttr(name)}" focusable="false"${sizeAttr} ${a11yAttrs}`;

    return raw.trim().replace(/^<svg\b/, `<svg ${injectedAttrs}`);
}

export {
    CANONICAL_SVG_MAP,
    ICON_ALIASES,
    escapeSvgAttr,
    getRawSvgIcon,
    renderSvgIcon,
    resolveSvgIconName,
    svgToDataUri,
};
