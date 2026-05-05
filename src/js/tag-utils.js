const TAG_STYLE_MAP = {
    '场景': 'm-tag-scene',
    '日系': 'm-tag-japanese',
    '科幻': 'm-tag-scifi',
    '插画': 'm-tag-illustration',
    '国风': 'm-tag-chinese',
};

const CUSTOM_TAGS_KEY = 'm_custom_tags';

function getTagStyleClass(tagName) {
    return TAG_STYLE_MAP[tagName] || 'm-tag-default';
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

export { TAG_STYLE_MAP, getTagStyleClass, aggregateTags, getCustomTags, saveCustomTag, removeCustomTag };
