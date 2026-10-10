package io.sixa9a.guide;

import android.annotation.SuppressLint;
import android.graphics.Color;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.SslErrorHandler;
import android.net.http.SslError;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "SixA9AGuide";
    private WebView webView;
    private String guideHost = "92.246.76.142.sslip.io";
    private String guideBaseUrl;
    private String userAgent;
    private GuideHttpCache httpCache;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView.setWebContentsDebuggingEnabled(true);

        webView = new WebView(this);
        setContentView(webView);
        webView.addJavascriptInterface(new GuideAndroidBridge(this, webView), "GuideAndroidBridge");

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        userAgent = settings.getUserAgentString();

        guideBaseUrl = baseUrlForProbe();
        guideHost = hostFromGuideUrl(guideBaseUrl);
        httpCache = new GuideHttpCache(this);

        probeHttpFromJava(guideBaseUrl);

        webView.setBackgroundColor(Color.parseColor("#0f1419"));
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(android.webkit.ConsoleMessage consoleMessage) {
                Log.i(TAG, "JS " + consoleMessage.messageLevel() + ": "
                        + consoleMessage.message()
                        + " @" + consoleMessage.sourceId() + ":" + consoleMessage.lineNumber());
                return true;
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request == null || request.getUrl() == null) {
                    return false;
                }
                Uri uri = request.getUrl();
                if (shouldOpenOutsideWebView(uri)) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                    } catch (Exception e) {
                        Log.w(TAG, "Failed to open external uri: " + uri, e);
                    }
                    return true;
                }
                return false;
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return proxyGuideRequest(request);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                Log.i(TAG, "Page finished: " + url);
                scheduleCatalogDebugSnapshots(view);
                prefetchOfflineResources();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                Log.e(TAG, "WebView error: " + error.getDescription()
                        + " mainFrame=" + (request != null && request.isForMainFrame())
                        + " url=" + (request != null ? request.getUrl() : "null"));
                if (request != null && request.isForMainFrame() && isGuideAppUrl(request.getUrl())) {
                    view.post(() -> view.loadUrl("file:///android_asset/guidebook/offline_fallback.html"));
                }
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                Log.e(TAG, "WebView SSL error: " + error + " url=" + error.getUrl());
                handler.cancel();
            }
        });

        String url = guideBaseUrl + "?app=android&_=" + System.currentTimeMillis();
        Log.i(TAG, "Loading " + url + " (proxy host=" + guideHost + ")");
        webView.loadUrl(url);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                dispatchGuidebookBack();
            }
        });
    }

    private void dispatchGuidebookBack() {
        if (webView == null) {
            moveTaskToBack(true);
            return;
        }
        webView.post(() -> {
            final CountDownLatch latch = new CountDownLatch(1);
            final boolean[] handled = { false };
            webView.evaluateJavascript(
                    "(function(){try{if(typeof window.handleGuidebookSystemBack==='function')"
                            + "return window.handleGuidebookSystemBack();"
                            + "return false;}catch(e){return false;}})();",
                    value -> {
                        handled[0] = isJsTruthy(value);
                        latch.countDown();
                    }
            );
            try {
                boolean completed = latch.await(500, TimeUnit.MILLISECONDS);
                if (completed && !handled[0]) {
                    moveTaskToBack(true);
                } else if (!completed) {
                    Log.w(TAG, "Back: JS did not respond in time, keeping app open");
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        });
    }

    /** WebView evaluateJavascript returns JSON-encoded booleans (and sometimes quoted strings). */
    private static boolean isJsTruthy(String value) {
        if (value == null || value.isEmpty() || "null".equalsIgnoreCase(value)) {
            return false;
        }
        String v = value.trim();
        if ("true".equalsIgnoreCase(v)) return true;
        if ("false".equalsIgnoreCase(v)) return false;
        if (v.length() >= 2 && v.startsWith("\"") && v.endsWith("\"")) {
            return isJsTruthy(v.substring(1, v.length() - 1));
        }
        return false;
    }

    private WebResourceResponse proxyGuideRequest(WebResourceRequest request) {
        if (request == null || request.getUrl() == null) return null;
        if (!"GET".equalsIgnoreCase(request.getMethod())) return null;
        Uri uri = request.getUrl();
        if (!"https".equalsIgnoreCase(uri.getScheme())) return null;
        if (!guideHost.equalsIgnoreCase(uri.getHost())) return null;

        String urlKey = uri.toString();
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(urlKey).openConnection();
            conn.setInstanceFollowRedirects(true);
            conn.setConnectTimeout(25000);
            conn.setReadTimeout(120000);
            conn.setRequestMethod("GET");
            if (userAgent != null) {
                conn.setRequestProperty("User-Agent", userAgent);
            }
            conn.setRequestProperty("Accept-Encoding", "identity");

            int code = conn.getResponseCode();
            InputStream raw = code >= 400 ? conn.getErrorStream() : conn.getInputStream();
            if (raw == null) return responseFromCache(urlKey, uri);

            byte[] bytes = GuideHttpCache.readAll(raw);
            String mime = conn.getContentType();
            if (mime != null && mime.contains(";")) {
                mime = mime.substring(0, mime.indexOf(';')).trim();
            }
            if (mime == null || mime.isEmpty()) {
                mime = guessMime(uri.getPath());
            }

            String reason = conn.getResponseMessage();
            if (reason == null) reason = "OK";

            if (code == 200) {
                httpCache.save(urlKey, bytes, mime, code, reason);
            } else {
                WebResourceResponse asset = GuideAssetLoader.open(this, uri);
                if (asset != null) return asset;
                return responseFromCache(urlKey, uri);
            }

            Map<String, String> headers = new HashMap<>();
            String ct = conn.getHeaderField("Content-Type");
            if (ct != null) headers.put("Content-Type", ct);

            Log.d(TAG, "Proxy " + code + " " + uri);
            return new WebResourceResponse(mime, "utf-8", code, reason, headers, new ByteArrayInputStream(bytes));
        } catch (Exception e) {
            Log.w(TAG, "Proxy network fail " + uri + ": " + e.getMessage());
            if (conn != null) conn.disconnect();
            WebResourceResponse asset = GuideAssetLoader.open(this, uri);
            if (asset != null) return asset;
            return responseFromCache(urlKey, uri);
        }
    }

    private WebResourceResponse responseFromCache(String urlKey, Uri uri) {
        GuideHttpCache.Entry hit = httpCache.load(urlKey);
        if (hit == null) return null;
        Log.i(TAG, "Proxy cache (offline) " + uri);
        Map<String, String> headers = new HashMap<>();
        if (hit.mime != null) headers.put("Content-Type", hit.mime);
        return new WebResourceResponse(
                hit.mime,
                "utf-8",
                hit.statusCode,
                hit.reason != null ? hit.reason : "OK",
                headers,
                new ByteArrayInputStream(hit.body)
        );
    }

    private static String guessMime(String path) {
        if (path == null) return "application/octet-stream";
        String p = path.toLowerCase(Locale.US);
        if (p.endsWith(".html") || p.endsWith("/")) return "text/html";
        if (p.endsWith(".js")) return "text/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".webp")) return "image/webp";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".pdf")) return "application/pdf";
        return "application/octet-stream";
    }

    private static String hostFromGuideUrl(String base) {
        try {
            URL url = new URL(base);
            if (url.getHost() != null && !url.getHost().isEmpty()) {
                return url.getHost();
            }
        } catch (Exception ignored) {
            /* fallback below */
        }
        return "92.246.76.142.sslip.io";
    }

    private String baseUrlForProbe() {
        String base = BuildConfig.GUIDE_URL;
        if (base == null) base = "https://92.246.76.142.sslip.io/";
        if (!base.endsWith("/")) base = base + "/";
        return base;
    }

    private void probeHttpFromJava(String base) {
        new Thread(() -> {
            String healthUrl = base + "health";
            try {
                HttpURLConnection conn = (HttpURLConnection) new URL(healthUrl).openConnection();
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(15000);
                conn.setRequestMethod("GET");
                int code = conn.getResponseCode();
                Log.i(TAG, "Java HTTP GET " + healthUrl + " -> " + code);
            } catch (Exception e) {
                Log.e(TAG, "Java HTTP GET " + healthUrl + " failed: " + e.getMessage(), e);
            }
        }).start();
    }

    /** Прогрев HTTP-кэша: оболочка + catalog API для офлайн (как после первого онлайн-сеанса). */
    private void prefetchOfflineResources() {
        new Thread(() -> {
            String base = guideBaseUrl.endsWith("/") ? guideBaseUrl.substring(0, guideBaseUrl.length() - 1) : guideBaseUrl;
            String[] paths = {
                    "/",
                    "/index.html",
                    "/boot.js",
                    "/app.js",
                    "/styles.css",
                    "/map-tiles.js",
                    "/icons/map-route-sector-climber.svg",
                    "/icons/map-boulder-sector-climber.svg",
                    "/api/catalog/manifest",
                    "/api/catalog/bundle"
            };
            for (String path : paths) {
                warmCacheGet(base + path);
            }
        }).start();
    }

    private void warmCacheGet(String urlKey) {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(urlKey).openConnection();
            conn.setInstanceFollowRedirects(true);
            conn.setConnectTimeout(20000);
            conn.setReadTimeout(120000);
            conn.setRequestMethod("GET");
            if (userAgent != null) {
                conn.setRequestProperty("User-Agent", userAgent);
            }
            conn.setRequestProperty("Accept-Encoding", "identity");
            int code = conn.getResponseCode();
            InputStream raw = code >= 400 ? conn.getErrorStream() : conn.getInputStream();
            if (raw == null) return;
            byte[] bytes = GuideHttpCache.readAll(raw);
            String mime = conn.getContentType();
            if (mime != null && mime.contains(";")) {
                mime = mime.substring(0, mime.indexOf(';')).trim();
            }
            if (code == 200) {
                httpCache.save(urlKey, bytes, mime, code, "OK");
                Log.i(TAG, "Warm cache OK " + urlKey + " (" + bytes.length + " bytes)");
            }
        } catch (Exception e) {
            Log.d(TAG, "Warm cache skip " + urlKey + ": " + e.getMessage());
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private void scheduleCatalogDebugSnapshots(WebView view) {
        long[] delaysMs = {3000L, 12000L, 30000L};
        for (long delay : delaysMs) {
            mainHandler.postDelayed(() -> logCatalogSnapshot(view, delay), delay);
        }
    }

    private void logCatalogSnapshot(WebView view, long afterMs) {
        if (view == null) return;
        view.evaluateJavascript(
                "(function(){try{if(typeof window.__guidebookCatalogDebug==='function')"
                        + "return JSON.stringify(window.__guidebookCatalogDebug());"
                        + "return JSON.stringify({err:'no debug hook',href:location.href});"
                        + "}catch(e){return JSON.stringify({err:String(e)});}})();",
                value -> Log.i(TAG, "Catalog @" + afterMs + "ms: " + value)
        );
    }

    /** Внешние приложения: Telegram, карты (2ГИС и др.) — не грузить внутри WebView. */
    private static boolean shouldOpenOutsideWebView(Uri uri) {
        if (uri == null) return false;
        String scheme = uri.getScheme();
        if (scheme != null) {
            String s = scheme.toLowerCase(Locale.ROOT);
            if (s.equals("tg") || s.equals("dgis")) {
                return true;
            }
        }
        String host = uri.getHost();
        if (host == null) return false;
        String h = host.toLowerCase(Locale.ROOT);
        if (h.equals("t.me") || h.endsWith(".t.me") || h.equals("telegram.me") || h.equals("oauth.telegram.org")) {
            return true;
        }
        if (h.contains("2gis") || h.equals("dublgis.ru")) {
            return true;
        }
        if (h.contains("yandex.") && (uri.getPath() != null && uri.getPath().contains("maps"))) {
            return true;
        }
        if (h.contains("google.") && uri.getPath() != null && uri.getPath().contains("maps")) {
            return true;
        }
        if (h.equals("maps.apple.com")) {
            return true;
        }
        return false;
    }

    private boolean isGuideAppUrl(Uri uri) {
        if (uri == null) return false;
        String scheme = uri.getScheme();
        if (scheme != null && scheme.equalsIgnoreCase("file")) {
            String path = uri.getPath();
            return path != null && path.contains("/guidebook/");
        }
        if (scheme == null || (!scheme.equalsIgnoreCase("http") && !scheme.equalsIgnoreCase("https"))) {
            return false;
        }
        String host = uri.getHost();
        if (host == null) return false;
        String gh = guideHost == null ? "" : guideHost.toLowerCase(Locale.ROOT);
        String h = host.toLowerCase(Locale.ROOT);
        return h.equals(gh) || h.endsWith("." + gh);
    }

}
