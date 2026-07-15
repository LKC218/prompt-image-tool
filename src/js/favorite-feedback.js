import { getStorage } from './storage.js';
import { showMobileToast } from './mobile-utils.js';
import { mobileIcon } from './mobile-icon-assets.js';

const pendingFavoriteIds = new Set();

function setFavoriteButtonState(button, isFavorite) {
    if (!button) return;
    button.classList.toggle('m-starred', isFavorite);
    button.setAttribute('aria-pressed', String(isFavorite));
    button.setAttribute('aria-label', isFavorite ? '取消收藏' : '收藏');
    button.title = isFavorite ? '取消收藏' : '收藏';
    button.innerHTML = mobileIcon(isFavorite ? 'star-filled' : 'star');
}

function playFavoriteFeedback(button, isFavorite) {
    if (!button) return;
    button.classList.remove('m-star-btn--favorited', 'm-star-btn--unfavorited');
    void button.offsetWidth;
    button.classList.add(isFavorite ? 'm-star-btn--favorited' : 'm-star-btn--unfavorited');
    button.addEventListener('animationend', (event) => {
        if (event.target !== button) return;
        button.classList.remove('m-star-btn--favorited', 'm-star-btn--unfavorited');
    }, { once: true });
}

async function toggleFavoriteWithFeedback({ id, button, isFavorite, onStateChange }) {
    if (!id || pendingFavoriteIds.has(id)) return null;

    const previousState = isFavorite === true;
    const optimisticState = !previousState;
    pendingFavoriteIds.add(id);
    button?.setAttribute('aria-busy', 'true');
    button?.setAttribute('disabled', '');
    setFavoriteButtonState(button, optimisticState);
    onStateChange?.(optimisticState);

    try {
        const result = await getStorage().toggleFavorite(id);
        const confirmedState = result.isFavorite === true;
        setFavoriteButtonState(button, confirmedState);
        onStateChange?.(confirmedState);
        playFavoriteFeedback(button, confirmedState);
        showMobileToast(confirmedState ? '已收藏' : '已取消收藏');
        return result;
    } catch (error) {
        setFavoriteButtonState(button, previousState);
        onStateChange?.(previousState);
        showMobileToast('操作失败，已恢复原状态', 'error');
        return null;
    } finally {
        pendingFavoriteIds.delete(id);
        button?.removeAttribute('aria-busy');
        button?.removeAttribute('disabled');
    }
}

export { setFavoriteButtonState, toggleFavoriteWithFeedback };
