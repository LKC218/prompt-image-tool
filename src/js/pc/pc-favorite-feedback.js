function setPcFavoriteButtonState(button, isFavorite) {
    if (!button) return;
    button.classList.toggle('pc-library-starred', isFavorite);
    button.classList.toggle('pc-detail-top-nav-btn-starred', isFavorite);
    button.setAttribute('aria-pressed', String(isFavorite));
    button.setAttribute('aria-label', isFavorite ? '取消收藏' : '收藏');
    button.title = isFavorite ? '取消收藏' : '收藏';
}

function playPcFavoriteFeedback(button, isFavorite) {
    if (!button) return;
    const prefix = button.classList.contains('pc-library-star-btn')
        ? 'pc-library-star-btn'
        : button.classList.contains('pc-detail-top-nav-btn')
            ? 'pc-detail-top-nav-btn'
            : 'pc-star-btn';
    const favoredClass = `${prefix}--favorited`;
    const unfavoredClass = `${prefix}--unfavorited`;
    button.classList.remove(favoredClass, unfavoredClass);
    void button.offsetWidth;
    button.classList.add(isFavorite ? favoredClass : unfavoredClass);
    button.addEventListener('animationend', (event) => {
        if (event.target !== button) return;
        button.classList.remove(favoredClass, unfavoredClass);
    }, { once: true });
}

export { playPcFavoriteFeedback, setPcFavoriteButtonState };
