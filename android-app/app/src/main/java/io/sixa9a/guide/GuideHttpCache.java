package io.sixa9a.guide;

import android.content.Context;
import android.util.Log;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;

/** Дисковый кэш GET-ответов guide-хоста для офлайн WebView. */
public final class GuideHttpCache {

    private static final String TAG = "GuideHttpCache";
    private static final int MAX_ENTRY_BYTES = 20 * 1024 * 1024;

    private final File dir;

    public GuideHttpCache(Context context) {
        dir = new File(context.getCacheDir(), "guide_http");
        if (!dir.exists() && !dir.mkdirs()) {
            Log.w(TAG, "Could not create cache dir " + dir);
        }
    }

    public static final class Entry {
        public final byte[] body;
        public final String mime;
        public final int statusCode;
        public final String reason;

        Entry(byte[] body, String mime, int statusCode, String reason) {
            this.body = body;
            this.mime = mime;
            this.statusCode = statusCode;
            this.reason = reason;
        }
    }

    public Entry load(String url) {
        try {
            File meta = metaFile(url);
            File body = bodyFile(url);
            if (!meta.exists() || !body.exists()) return null;
            String[] parts = readUtf8(meta).split("\n", 4);
            if (parts.length < 4) return null;
            int code = Integer.parseInt(parts[0]);
            String mime = parts[1];
            String reason = parts[2];
            byte[] bytes = readAll(new FileInputStream(body));
            return new Entry(bytes, mime, code, reason);
        } catch (Exception e) {
            Log.w(TAG, "Cache read failed: " + e.getMessage());
            return null;
        }
    }

    public void save(String url, byte[] body, String mime, int statusCode, String reason) {
        if (body == null || body.length == 0 || body.length > MAX_ENTRY_BYTES || statusCode != 200) {
            return;
        }
        try {
            writeUtf8(metaFile(url), statusCode + "\n" + nullToEmpty(mime) + "\n" + nullToEmpty(reason) + "\n");
            try (FileOutputStream out = new FileOutputStream(bodyFile(url))) {
                out.write(body);
            }
        } catch (Exception e) {
            Log.w(TAG, "Cache write failed: " + e.getMessage());
        }
    }

    private File metaFile(String url) {
        return new File(dir, safeName(url) + ".meta");
    }

    private File bodyFile(String url) {
        return new File(dir, safeName(url) + ".body");
    }

    private static String safeName(String url) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(url.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) {
                sb.append(String.format(Locale.US, "%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            return Integer.toHexString(url.hashCode());
        }
    }

    private static String nullToEmpty(String s) {
        return s == null ? "" : s;
    }

    private static String readUtf8(File file) throws IOException {
        return new String(readAll(new FileInputStream(file)), StandardCharsets.UTF_8);
    }

    private static void writeUtf8(File file, String text) throws IOException {
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(text.getBytes(StandardCharsets.UTF_8));
        }
    }

    static byte[] readAll(java.io.InputStream in) throws IOException {
        java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) != -1) {
            bos.write(buf, 0, n);
        }
        in.close();
        return bos.toByteArray();
    }
}
