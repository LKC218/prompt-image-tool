function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

function estimateDataUrlSize(dataUrl = '') {
    const commaIndex = dataUrl.indexOf(',');
    if (commaIndex < 0) return 0;
    const base64 = dataUrl.slice(commaIndex + 1);
    const padding = base64.endsWith('==') ? 2 : (base64.endsWith('=') ? 1 : 0);
    return Math.max(0, Math.floor(base64.length * 3 / 4) - padding);
}

function getDataUrlMimeType(dataUrl = '') {
    const match = dataUrl.match(/^data:([^;,]+)[;,]/i);
    return match ? match[1].toLowerCase() : 'image/png';
}

function getImageExtensionByMime(mimeType = '') {
    const normalized = mimeType.toLowerCase();
    if (normalized === 'image/jpeg' || normalized === 'image/jpg') return 'jpg';
    if (normalized === 'image/webp') return 'webp';
    if (normalized === 'image/gif') return 'gif';
    return 'png';
}

function readBlobAsDataURL(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

function createImageTooLargeError(width, height, maxInputPixels) {
    const error = new Error(`Image pixels exceed limit: ${width}x${height}`);
    error.code = 'IMAGE_PIXELS_TOO_LARGE';
    error.width = width;
    error.height = height;
    error.maxInputPixels = maxInputPixels;
    return error;
}

function getTargetSize(width, height, maxSide) {
    if (!maxSide || maxSide <= 0 || Math.max(width, height) <= maxSide) {
        return { width, height, resized: false };
    }
    const scale = maxSide / Math.max(width, height);
    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
        resized: true
    };
}

function buildOriginalResult(dataUrl, width = 0, height = 0) {
    const mimeType = getDataUrlMimeType(dataUrl);
    const size = estimateDataUrlSize(dataUrl);
    return {
        dataUrl,
        mimeType,
        extension: getImageExtensionByMime(mimeType),
        size,
        originalSize: size,
        width,
        height,
        originalWidth: width,
        originalHeight: height,
        usedOriginal: true,
        resized: false
    };
}

function optimizeImageDataUrl(dataUrl, options = {}) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = async () => {
            try {
                const originalWidth = img.naturalWidth || img.width || 0;
                const originalHeight = img.naturalHeight || img.height || 0;
                const maxInputPixels = options.maxInputPixels || 0;
                const originalSize = estimateDataUrlSize(dataUrl);

                if (!originalWidth || !originalHeight) {
                    resolve(buildOriginalResult(dataUrl));
                    return;
                }

                if (maxInputPixels && originalWidth * originalHeight > maxInputPixels) {
                    reject(createImageTooLargeError(originalWidth, originalHeight, maxInputPixels));
                    return;
                }

                const target = getTargetSize(originalWidth, originalHeight, options.maxSide || 0);
                const canvas = document.createElement('canvas');
                canvas.width = target.width;
                canvas.height = target.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(buildOriginalResult(dataUrl, originalWidth, originalHeight));
                    return;
                }

                const outputType = options.outputType || 'image/jpeg';
                const quality = options.quality ?? 0.92;
                if (outputType === 'image/jpeg') {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
                ctx.drawImage(img, 0, 0, target.width, target.height);

                canvas.toBlob(async (blob) => {
                    try {
                        if (!blob) {
                            resolve(buildOriginalResult(dataUrl, originalWidth, originalHeight));
                            return;
                        }

                        if (!target.resized && blob.size >= originalSize) {
                            resolve(buildOriginalResult(dataUrl, originalWidth, originalHeight));
                            return;
                        }

                        const optimizedDataUrl = await readBlobAsDataURL(blob);
                        resolve({
                            dataUrl: optimizedDataUrl,
                            mimeType: blob.type || outputType,
                            extension: getImageExtensionByMime(blob.type || outputType),
                            size: blob.size,
                            originalSize,
                            width: target.width,
                            height: target.height,
                            originalWidth,
                            originalHeight,
                            usedOriginal: false,
                            resized: target.resized
                        });
                    } catch (e) {
                        reject(e);
                    }
                }, outputType, quality);
            } catch (e) {
                reject(e);
            }
        };
        img.onerror = () => resolve(buildOriginalResult(dataUrl));
        img.src = dataUrl;
    });
}

async function compressImageToJpeg(dataUrl, quality = 0.92) {
    try {
        const result = await optimizeImageDataUrl(dataUrl, {
            quality,
            outputType: 'image/jpeg'
        });
        return result.dataUrl;
    } catch (e) {
        return dataUrl;
    }
}

export {
    readFileAsDataURL,
    compressImageToJpeg,
    optimizeImageDataUrl,
    estimateDataUrlSize,
    getDataUrlMimeType,
    getImageExtensionByMime
};
