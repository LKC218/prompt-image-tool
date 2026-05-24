package com.promptimagemanager.app.plugins;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(
    name = "ImageGallerySaver",
    permissions = {
        @Permission(alias = "storage", strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE })
    }
)
public class ImageGallerySaverPlugin extends Plugin {

    @PluginMethod
    public void save(PluginCall call) {
        if (requiresLegacyStoragePermission() && getPermissionState("storage") != PermissionState.GRANTED) {
            requestPermissionForAlias("storage", call, "saveAfterPermission");
            return;
        }

        saveToGallery(call);
    }

    @PermissionCallback
    public void saveAfterPermission(PluginCall call) {
        if (requiresLegacyStoragePermission() && getPermissionState("storage") != PermissionState.GRANTED) {
            call.reject("需要存储权限才能保存到相册");
            return;
        }

        saveToGallery(call);
    }

    private boolean requiresLegacyStoragePermission() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.Q;
    }

    private void saveToGallery(PluginCall call) {
        String dataUrl = call.getString("dataUrl");
        if (dataUrl == null || dataUrl.isEmpty()) {
            call.reject("缺少图片数据");
            return;
        }

        String mimeType = resolveMimeType(call.getString("mimeType"), dataUrl);
        String filename = ensureFilename(call.getString("filename"), mimeType);
        String album = sanitizeSegment(call.getString("album"), "PromptImageManager");

        byte[] imageBytes;
        try {
            imageBytes = decodeDataUrl(dataUrl);
        } catch (IllegalArgumentException e) {
            call.reject("图片数据格式不正确");
            return;
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                saveModernImage(call, imageBytes, filename, mimeType, album);
            } else {
                saveLegacyImage(call, imageBytes, filename, mimeType, album);
            }
        } catch (IOException e) {
            call.reject("保存到相册失败：" + e.getMessage(), e);
        }
    }

    private void saveModernImage(PluginCall call, byte[] imageBytes, String filename, String mimeType, String album) throws IOException {
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        String relativePath = Environment.DIRECTORY_PICTURES + "/" + album;
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
        values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath);
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);

        Uri collection = MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
        Uri uri = resolver.insert(collection, values);
        if (uri == null) {
            throw new IOException("无法创建相册记录");
        }

        try (OutputStream stream = resolver.openOutputStream(uri)) {
            if (stream == null) {
                throw new IOException("无法打开输出流");
            }
            stream.write(imageBytes);
            stream.flush();
        } catch (IOException e) {
            resolver.delete(uri, null, null);
            throw e;
        }

        values.clear();
        values.put(MediaStore.MediaColumns.IS_PENDING, 0);
        resolver.update(uri, values, null, null);

        JSObject result = buildResult(filename, uri.toString(), relativePath);
        call.resolve(result);
    }

    private void saveLegacyImage(PluginCall call, byte[] imageBytes, String filename, String mimeType, String album) throws IOException {
        File picturesDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES);
        File albumDir = new File(picturesDir, album);
        if (!albumDir.exists() && !albumDir.mkdirs()) {
            throw new IOException("无法创建相册目录");
        }

        File outFile = new File(albumDir, filename);
        try (FileOutputStream fos = new FileOutputStream(outFile)) {
            fos.write(imageBytes);
            fos.flush();
        }

        MediaScannerConnection.scanFile(
            getContext(),
            new String[] { outFile.getAbsolutePath() },
            new String[] { mimeType },
            null
        );

        JSObject result = buildResult(filename, outFile.getAbsolutePath(), albumDir.getAbsolutePath());
        call.resolve(result);
    }

    private JSObject buildResult(String filename, String path, String directory) {
        JSObject result = new JSObject();
        result.put("success", true);
        result.put("method", "native-gallery");
        result.put("filename", filename);
        result.put("path", path);
        result.put("directory", directory);
        result.put("locationLabel", "手机相册");
        return result;
    }

    private byte[] decodeDataUrl(String dataUrl) {
        int commaIndex = dataUrl.indexOf(',');
        if (commaIndex < 0) {
            throw new IllegalArgumentException("缺少数据分隔符");
        }
        String base64 = dataUrl.substring(commaIndex + 1);
        return Base64.decode(base64, Base64.DEFAULT);
    }

    private String resolveMimeType(String mimeType, String dataUrl) {
        if (mimeType != null && !mimeType.isEmpty()) {
            return mimeType;
        }

        if (dataUrl.startsWith("data:")) {
            int endIndex = dataUrl.indexOf(';');
            if (endIndex > 5) {
                return dataUrl.substring(5, endIndex);
            }
        }

        return "image/png";
    }

    private String ensureFilename(String filename, String mimeType) {
        String clean = sanitizeSegment(filename, "image");
        if (clean.contains(".")) {
            return clean;
        }

        String ext = ".png";
        if ("image/jpeg".equalsIgnoreCase(mimeType) || "image/jpg".equalsIgnoreCase(mimeType)) {
            ext = ".jpg";
        } else if ("image/webp".equalsIgnoreCase(mimeType)) {
            ext = ".webp";
        } else if ("image/gif".equalsIgnoreCase(mimeType)) {
            ext = ".gif";
        }

        return clean + ext;
    }

    private String sanitizeSegment(String value, String fallback) {
        String clean = value == null ? "" : value.trim();
        clean = clean.replaceAll("[\\\\/:*?\"<>|\\u0000-\\u001F]", "_");
        clean = clean.replaceAll("^\\.+", "");
        if (clean.isEmpty()) {
            return fallback;
        }
        return clean;
    }
}
