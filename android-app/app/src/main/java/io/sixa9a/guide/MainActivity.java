package io.sixa9a.guide;

import android.annotation.SuppressLint;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "SixA9AGuide";
    private WebView webView;
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

        webView.clearCache(true);

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
            public void onPageFinished(WebView view, String url) {
                Log.i(TAG, "Page finished: " + url);
                scheduleCatalogDebugSnapshots(view);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request == null || !request.isForMainFrame()) return;
                Log.e(TAG, "WebView error: " + error.getDescription()
                        + " url=" + request.getUrl());
            }
        });

        String base = BuildConfig.GUIDE_URL;
        if (base == null) base = "https://92.246.76.142.sslip.io/";
        if (!base.endsWith("/")) base = base + "/";
        String url = base + "?app=android&_=" + System.currentTimeMillis();
        Log.i(TAG, "Loading " + url);
        webView.loadUrl(url);
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

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }
}
