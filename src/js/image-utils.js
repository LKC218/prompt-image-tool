function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

function compressImageToJpeg(dataUrl, quality = 0.92) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            canvas.toBlob((blob) => {
                if (!blob) { resolve(dataUrl); return; }
                const originalSize = Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 3 / 4);
                if (blob.size >= originalSize) { resolve(dataUrl); return; }
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            }, 'image/jpeg', quality);
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
    });
}

export { readFileAsDataURL, compressImageToJpeg };
