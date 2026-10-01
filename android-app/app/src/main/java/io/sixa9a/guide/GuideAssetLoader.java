package io.sixa9a.guide;

import android.content.Context;
import android.net.Uri;
import android.util.Log;
import android.webkit.WebResourceResponse;

import java.io.InputStream;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/** Статика Mini App из assets/guidebook (офлайн-оболочка). */
public final class GuideAssetLoader {

    private static final String TAG = "GuideAssetLoader";
    private static final String ASSET_ROOT = "guidebook";

    private GuideAssetLoader() {
    }

    public static WebResourceResponse open(Context context, Uri uri) {
        if (context == null || uri == null) return null;
        String path = uri.getPath();
        if (path == null) return null;
        if (path.startsWith("/api/")) return null;

        String assetPath = assetPathForUrlPath(path);
        if (assetPath == null) return null;

        try {
            InputStream in = context.getAssets().open(assetPath);
            String mime = guessMime(assetPath);
            Map<String, String> headers = new HashMap<>();
            headers.put("Content-Type", mime);
            Log.d(TAG, "Asset hit " + assetPath);
            return new WebResourceResponse(mime, "utf-8", 200, "OK", headers, in);
        } catch (Exception e) {
            return null;
        }
    }

    private static String assetPathForUrlPath(String path) {
        String p = path;
        if (p.isEmpty() || "/".equals(p)) {
            return ASSET_ROOT + "/index.html";
        }
        while (p.startsWith("/")) {
            p = p.substring(1);
        }
        if (p.isEmpty() || p.contains("..")) return null;
        return ASSET_ROOT + "/" + p;
    }

    private static String guessMime(String assetPath) {
        String p = assetPath.toLowerCase(Locale.US);
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "text/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".webp")) return "image/webp";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".woff2")) return "font/woff2";
        return "application/octet-stream";
    }
}
