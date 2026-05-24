import plusIcon from '../assets/icons/plus.svg';
import copyIcon from '../assets/icons/copy.svg';
import editIcon from '../assets/icons/edit.svg';
import folderIcon from '../assets/icons/folder.svg';
import folderOpenIcon from '../assets/icons/folder-open.svg';
import moreHorizontalIcon from '../assets/icons/more-horizontal.svg';
import pencilLineIcon from '../assets/icons/pencil-line.svg';
import trashIcon from '../assets/icons/trash-2.svg';
import warningIcon from '../assets/icons/warning.svg';
import paletteIcon from '../assets/icons/palette.svg';
import syncIcon from '../assets/icons/sync.svg';
import checkIcon from '../assets/icons/check.svg';
import gripVerticalIcon from '../assets/icons/grip-vertical.svg';
import rocketIcon from '../assets/icons/rocket.svg';
import cameraIcon from '../assets/icons/camera.svg';
import imageIcon from '../assets/icons/image.svg';
import tagIcon from '../assets/icons/tag.svg';
import arrowUpDownIcon from '../assets/icons/arrow-up-down.svg';
import mergeIcon from '../assets/icons/merge.svg';
import chevronLeftIcon from '../assets/icons/mobile/chevron-left.svg';
import chevronRightIcon from '../assets/icons/mobile/chevron-right.svg';
import chevronDownIcon from '../assets/icons/mobile/chevron-down.svg';
import chevronUpIcon from '../assets/icons/mobile/chevron-up.svg';
import xIcon from '../assets/icons/mobile/x.svg';
import starIcon from '../assets/icons/mobile/star.svg';
import starFilledIcon from '../assets/icons/mobile/star-filled.svg';
import maximizeIcon from '../assets/icons/mobile/maximize.svg';
import fileTextIcon from '../assets/icons/mobile/file-text.svg';
import refreshCwIcon from '../assets/icons/mobile/refresh-cw.svg';
import loaderCircleIcon from '../assets/icons/mobile/loader-circle.svg';
import clipboardIcon from '../assets/icons/mobile/clipboard.svg';
import heartIcon from '../assets/icons/mobile/heart.svg';
import downloadIcon from '../assets/icons/mobile/download.svg';

const MOBILE_ICONS = {
    plus: plusIcon,
    copy: copyIcon,
    edit: editIcon,
    folder: folderIcon,
    'folder-open': folderOpenIcon,
    more: moreHorizontalIcon,
    rename: pencilLineIcon,
    trash: trashIcon,
    warning: warningIcon,
    palette: paletteIcon,
    sync: syncIcon,
    check: checkIcon,
    grip: gripVerticalIcon,
    rocket: rocketIcon,
    camera: cameraIcon,
    image: imageIcon,
    tag: tagIcon,
    sort: arrowUpDownIcon,
    merge: mergeIcon,
    'chevron-left': chevronLeftIcon,
    'chevron-right': chevronRightIcon,
    'chevron-down': chevronDownIcon,
    'chevron-up': chevronUpIcon,
    x: xIcon,
    star: starIcon,
    'star-filled': starFilledIcon,
    maximize: maximizeIcon,
    file: fileTextIcon,
    refresh: refreshCwIcon,
    loader: loaderCircleIcon,
    clipboard: clipboardIcon,
    heart: heartIcon,
    download: downloadIcon
};

function escapeAttr(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function mobileIcon(name, options = {}) {
    const src = MOBILE_ICONS[name];
    if (!src) return '';

    const iconClass = ` m-svg-icon-${escapeAttr(name.replace(/[^a-z0-9-]/gi, '-'))}`;
    const className = options.className ? ` ${escapeAttr(options.className)}` : '';
    const label = options.label ? escapeAttr(options.label) : '';
    const a11y = label ? `alt="${label}" role="img" aria-label="${label}"` : 'alt="" aria-hidden="true"';
    return `<img src="${src}" class="m-svg-icon${iconClass}${className}" ${a11y}>`;
}

export { MOBILE_ICONS, mobileIcon };
