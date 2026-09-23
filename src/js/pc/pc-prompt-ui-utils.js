function formatPromptForDisplay(text) {
    return String(text || '').replace(/^[\s\uFEFF]+/, '');
}

function getPromptFolderId(item) {
    return item?.folderId || item?.folder_id || '';
}

function countPromptSetsByFolder(items) {
    const counts = new Map();
    (items || []).forEach(item => {
        const folderId = getPromptFolderId(item);
        if (!folderId) return;
        counts.set(folderId, (counts.get(folderId) || 0) + 1);
    });
    return counts;
}

export { formatPromptForDisplay, getPromptFolderId, countPromptSetsByFolder };
