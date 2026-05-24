import banIcon from '../assets/icons/pc/ban.svg';
import balanceIcon from '../assets/icons/pc/balance.svg';
import calendarIcon from '../assets/icons/pc/calendar.svg';
import checkIcon from '../assets/icons/check.svg';
import chevronLeftIcon from '../assets/icons/pc/chevron-left.svg';
import chevronRightIcon from '../assets/icons/pc/chevron-right.svg';
import clockIcon from '../assets/icons/pc/clock.svg';
import clipboardIcon from '../assets/icons/pc/clipboard.svg';
import downloadIcon from '../assets/icons/pc/download.svg';
import editIcon from '../assets/icons/edit.svg';
import folderIcon from '../assets/icons/folder.svg';
import folderOpenIcon from '../assets/icons/folder-open.svg';
import heartIcon from '../assets/icons/pc/heart.svg';
import infoIcon from '../assets/icons/pc/info.svg';
import moreHorizontalIcon from '../assets/icons/more-horizontal.svg';
import moreVerticalIcon from '../assets/icons/pc/more-vertical.svg';
import plusIcon from '../assets/icons/plus.svg';
import rotateCcwIcon from '../assets/icons/pc/rotate-ccw.svg';
import saveIcon from '../assets/icons/pc/save.svg';
import shieldIcon from '../assets/icons/pc/shield.svg';
import sparklesIcon from '../assets/icons/pc/sparkles.svg';
import starIcon from '../assets/icons/pc/star.svg';
import starFilledIcon from '../assets/icons/pc/star-filled.svg';
import tagIcon from '../assets/icons/tag.svg';
import userIcon from '../assets/icons/user-round.svg';
import xIcon from '../assets/icons/pc/x.svg';

const PC_ICON_MAP = {
    ban: banIcon,
    balance: balanceIcon,
    calendar: calendarIcon,
    check: checkIcon,
    chevronLeft: chevronLeftIcon,
    chevronRight: chevronRightIcon,
    clock: clockIcon,
    clipboard: clipboardIcon,
    download: downloadIcon,
    edit: editIcon,
    folder: folderIcon,
    folderOpen: folderOpenIcon,
    heart: heartIcon,
    info: infoIcon,
    moreHorizontal: moreHorizontalIcon,
    moreVertical: moreVerticalIcon,
    plus: plusIcon,
    rotateCcw: rotateCcwIcon,
    save: saveIcon,
    shield: shieldIcon,
    sparkles: sparklesIcon,
    star: starIcon,
    starFilled: starFilledIcon,
    tag: tagIcon,
    user: userIcon,
    x: xIcon
};

function escapeIconAttr(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function pcIcon(name, className = 'pc-icon-img', alt = '') {
    const src = PC_ICON_MAP[name];
    if (!src) return '';
    const ariaHidden = alt ? '' : ' aria-hidden="true"';
    return `<img src="${src}" alt="${escapeIconAttr(alt)}" class="${escapeIconAttr(className)}"${ariaHidden}>`;
}

export { PC_ICON_MAP, pcIcon };
