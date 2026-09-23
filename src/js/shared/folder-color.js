export const FOLDER_COLOR_OPTIONS = [
    { key: 'sky', color: '#2F80ED', bg: '#EAF3FF', darkBg: '#173C63' },
    { key: 'coral', color: '#E85D75', bg: '#FDECEF', darkBg: '#642B35' },
    { key: 'pine', color: '#35A875', bg: '#E8F6EF', darkBg: '#194A37' },
    { key: 'grape', color: '#8267D5', bg: '#F0ECFF', darkBg: '#373967' },
    { key: 'amber', color: '#D88A16', bg: '#FFF5DB', darkBg: '#604514' },
    { key: 'teal', color: '#1796A7', bg: '#E4F7F8', darkBg: '#174C55' },
];

const LEGACY_COLOR_KEYS = {
    '#2D8CFF': 'sky', '#2D9CFF': 'sky', '#2580D6': 'sky',
    '#FF6B9A': 'coral', '#FF6F9F': 'coral', '#D4567F': 'coral', '#FF5A5A': 'coral', '#D64545': 'coral',
    '#29B37A': 'pine', '#72D879': 'pine', '#3D9942': 'pine',
    '#8A6BFF': 'grape', '#B99CFF': 'grape', '#8B6FCC': 'grape',
    '#FFC94A': 'amber', '#FFD15C': 'amber', '#C4A030': 'amber', '#E07020': 'amber', '#FF8C42': 'amber',
    '#1796A7': 'teal', '#00BCD4': 'teal', '#2BA5A5': 'teal',
};

function stableIndex(value) {
    const text = String(value || 'folder');
    return Array.from(text).reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) >>> 0, 0) % FOLDER_COLOR_OPTIONS.length;
}

export function getFolderColor(folder = {}, appearance = 'light') {
    const key = FOLDER_COLOR_OPTIONS.some(option => option.key === folder.colorKey)
        ? folder.colorKey
        : LEGACY_COLOR_KEYS[String(folder.color || '').toUpperCase()] || FOLDER_COLOR_OPTIONS[stableIndex(folder.id || folder.name)].key;
    const option = FOLDER_COLOR_OPTIONS.find(item => item.key === key);
    return appearance === 'dark' ? { ...option, bg: option.darkBg } : option;
}

export function getFolderColorPayload(colorKey) {
    const option = getFolderColor({ colorKey });
    return { colorKey: option.key, color: option.color };
}
