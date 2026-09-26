package io.sixa9a.guide;

import android.annotation.SuppressLint;
import android.graphics.Color;
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

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "SixA9AGuide";
    private WebView webView;
    private String guideHost = "92.246.76.142.sslip.io";
    private String userAgent;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView.setWebContentsDebuggingEnabled(true);

        webView = new WebView(this);
        setContentView(webView);

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

        guideHost = hostFromGuideUrl(baseUrlForProbe());

        webView.clearCache(true);

        probeHttpFromJava(baseUrlForProbe());

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
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                Log.e(TAG, "WebView error: " + error.getDescription()
                        + " mainFrame=" + (request != null && request.isForMainFrame())
                        + " url=" + (request != null ? request.getUrl() : "null"));
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                Log.e(TAG, "WebView SSL error: " + error + " url=" + error.getUrl());
                handler.cancel();
            }
        });

        String base = baseUrlForProbe();
        String url = base + "?app=android&_=" + System.currentTimeMillis();
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
        webView.evaluateJavascript(
                "(function(){try{if(typeof window.handleGuidebookSystemBack==='function')"
                        + "return window.handleGuidebookSystemBack()?'true':'false';"
                        + "return 'false';}catch(e){return 'false';}})();",
                value -> {
                    if (!"true".equals(value)) {
                        moveTaskToBack(true);
                    }
                }
        );
    }

    private WebResourceResponse proxyGuideRequest(WebResourceRequest request) {
        if (request == null || request.getUrl() == null) return null;
        if (!"GET".equalsIgnoreCase(request.getMethod())) return null;
        Uri uri = request.getUrl();
        if (!"https".equalsIgnoreCase(uri.getScheme())) return null;
        if (!guideHost.equalsIgnoreCase(uri.getHost())) return null;

        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(uri.toString()).openConnection();
            conn.setInstanceFollowRedirects(true);
            conn.setConnectTimeout(25000);
            conn.setReadTimeout(120000);
            conn.setRequestMethod("GET");
            if (userAgent != null) {
                conn.setRequestProperty("User-Agent", userAgent);
            }
            conn.setRequestProperty("Accept-Encoding", "identity");

            int code = conn.getResponseCode();
            InputStream body = code >= 400 ? conn.getErrorStream() : conn.getInputStream();
            if (body == null) return null;

            String mime = conn.getContentType();
            if (mime != null && mime.contains(";")) {
                mime = mime.substring(0, mime.indexOf(';')).trim();
            }
            if (mime == null || mime.isEmpty()) {
                mime = guessMime(uri.getPath());
            }

            Map<String, String> headers = new HashMap<>();
            String ct = conn.getHeaderField("Content-Type");
            if (ct != null) headers.put("Content-Type", ct);

            String reason = conn.getResponseMessage();
            if (reason == null) reason = "OK";

            Log.d(TAG, "Proxy " + code + " " + uri);
            return new WebResourceResponse(mime, "utf-8", code, reason, headers, body);
        } catch (Exception e) {
            Log.e(TAG, "Proxy failed " + uri + ": " + e.getMessage());
            if (conn != null) conn.disconnect();
            return null;
        }
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

}
