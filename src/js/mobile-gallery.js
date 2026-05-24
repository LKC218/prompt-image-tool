import { registerPlugin } from '@capacitor/core';

const ImageGallerySaver = registerPlugin('ImageGallerySaver');

async function saveImageToGallery(options = {}) {
    return ImageGallerySaver.save(options);
}

export { saveImageToGallery };
