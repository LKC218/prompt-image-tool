const TAG_STYLE_MAP = {
    '场景': 'scene',
    '日系': 'japanese',
    '科幻': 'scifi',
    '插画': 'illustration',
    '国风': 'chinese',
};

const LIBRARY_TAG_STYLE_MAP = {
    'UI提示词指令': 'blue',
    'ChatGPT导入': 'purple',
    '人物海报': 'orange',
    '实用平面设计': 'indigo',
    '小趣mona m03': 'yellow',
    '功能提示词指令': 'green',
    '图标/logo': 'pink',
    '个性化汇报': 'coral',
};

const LIBRARY_TAG_TOKENS = ['blue', 'purple', 'orange', 'indigo', 'yellow', 'green', 'pink', 'coral'];

const CUSTOM_TAGS_KEY = 'm_custom_tags';

function getTagStyleToken(tagName) {
    const normalizedName = typeof tagName === 'string' ? tagName.trim() : '';
    if (!normalizedName) return 'default';
    return TAG_STYLE_MAP[normalizedName] || 'default';
}

function getTagStyleClass(tagName) {
    return `m-tag-${getTagStyleToken(tagName)}`;
}

function getPcTagStyleClass(tagName) {
    return `pc-tag-${getTagStyleToken(tagName)}`;
}

function getLibraryTagStyleClass(tagName) {
    const normalizedName = typeof tagName === 'string' ? tagName.trim() : '';
    if (!normalizedName) return 'pc-library-tag-default';
    const token = LIBRARY_TAG_STYLE_MAP[normalizedName] || LIBRARY_TAG_TOKENS[getStableTagIndex(normalizedName)];
    return `pc-library-tag-${token}`;
}

function getStableTagIndex(tagName) {
    let hash = 0;
    for (let index = 0; index < tagName.length; index += 1) {
        hash = ((hash << 5) - hash + tagName.charCodeAt(index)) | 0;
    }
    return Math.abs(hash) % LIBRARY_TAG_TOKENS.length;
}

function getCustomTags() {
    try {
        return JSON.parse(localStorage.getItem(CUSTOM_TAGS_KEY) || '[]');
    } catch (e) {
        return [];
    }
}

function saveCustomTag(tagName) {
    try {
        const tags = getCustomTags();
        if (!tags.includes(tagName)) {
            tags.push(tagName);
            localStorage.setItem(CUSTOM_TAGS_KEY, JSON.stringify(tags));
        }
        return true;
    } catch (e) {
        return false;
    }
}

function removeCustomTag(tagName) {
    try {
        const tags = getCustomTags();
        const filtered = tags.filter(t => t !== tagName);
        localStorage.setItem(CUSTOM_TAGS_KEY, JSON.stringify(filtered));
    } catch (e) {}
}

function aggregateTags(promptSets) {
    const tagMap = new Map();
    (promptSets || []).forEach(set => {
        let tags = [];
        try {
            tags = JSON.parse(set.tags || '[]');
        } catch (e) {
            tags = [];
        }
        if (!Array.isArray(tags)) tags = [];
        tags.forEach(tag => {
            if (typeof tag !== 'string' || !tag.trim()) return;
            const name = tag.trim();
            tagMap.set(name, (tagMap.get(name) || 0) + 1);
        });
    });
    getCustomTags().forEach(name => {
        if (!tagMap.has(name)) {
            tagMap.set(name, 0);
        }
    });
    return Array.from(tagMap.entries())
        .map(([name, count]) => ({ name, count, style: getTagStyleClass(name) }))
        .sort((a, b) => b.count - a.count);
}

export { TAG_STYLE_MAP, LIBRARY_TAG_STYLE_MAP, getTagStyleToken, getTagStyleClass, getPcTagStyleClass, getLibraryTagStyleClass, aggregateTags, getCustomTags, saveCustomTag, removeCustomTag };
