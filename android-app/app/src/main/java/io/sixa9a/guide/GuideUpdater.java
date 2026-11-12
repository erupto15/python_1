package io.sixa9a.guide;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;

import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Автообновление при наличии сети:
 * веб-часть — перезагрузка WebView, если на сервере новый билд фронта;
 * нативная часть — скачивание нового APK и запрос установки у пользователя.
 */
final class GuideUpdater {

    interface Host {
        /** Перезагрузить фронт с сервера. */
        void reloadGuide();

        /** Активити видна пользователю (можно показывать диалоги). */
        boolean isUiVisible();
    }

    private static final String TAG = "SixA9AUpdater";
    private static final String PREFS = "guide_updater";
    private static final String PREF_DISMISSED_CODE = "dismissed_code";
    private static final String PREF_DISMISSED_AT = "dismissed_at";
    private static final long DISMISS_SNOOZE_MS = 24L * 60 * 60 * 1000;
    private static final long MIN_CHECK_INTERVAL_MS = 60L * 1000;

    private final Activity activity;
    private final Host host;
    private final String baseUrl;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean downloading = new AtomicBoolean(false);
    private final SharedPreferences prefs;

    private ConnectivityManager.NetworkCallback networkCallback;
    private volatile String loadedWebBuild;
    private volatile boolean loadedOffline;
    private volatile boolean hadNetwork = true;
    private long lastCheckAt;
    private File pendingInstallApk;
    private AlertDialog visibleDialog;

    GuideUpdater(Activity activity, Host host, String baseUrl) {
        this.activity = activity;
        this.host = host;
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
        this.prefs = activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    void start() {
        ConnectivityManager cm = (ConnectivityManager) activity.getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return;
        hadNetwork = isOnline(cm);
        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onAvailable(Network network) {
                boolean wasOffline = !hadNetwork;
                hadNetwork = true;
                if (wasOffline) {
                    Log.i(TAG, "Network back online");
                    mainHandler.postDelayed(() -> checkNow("network", true), 1500);
                }
            }

            @Override
            public void onLost(Network network) {
                hadNetwork = isOnline(cm);
            }
        };
        try {
            cm.registerDefaultNetworkCallback(networkCallback);
        } catch (Exception e) {
            Log.w(TAG, "registerDefaultNetworkCallback failed", e);
            networkCallback = null;
        }
    }

    void stop() {
        ConnectivityManager cm = (ConnectivityManager) activity.getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm != null && networkCallback != null) {
            try {
                cm.unregisterNetworkCallback(networkCallback);
            } catch (Exception ignored) {
                /* already unregistered */
            }
        }
        networkCallback = null;
        dismissDialog();
        executor.shutdownNow();
    }

    /** Главная страница пришла из сети — запоминаем билд фронта, который сейчас на сервере. */
    void markWebLoadedOnline() {
        loadedOffline = false;
        loadedWebBuild = null;
        if (executor.isShutdown()) return;
        executor.execute(() -> {
            JSONObject info = fetchVersionInfo();
            if (info != null && loadedWebBuild == null && !loadedOffline) {
                loadedWebBuild = info.optString("web_build", null);
            }
            Log.i(TAG, "Web loaded online, build=" + loadedWebBuild);
        });
    }

    /** Главная страница отдана из кэша/assets или показан офлайн-экран. */
    void markWebLoadedOffline() {
        loadedOffline = true;
        loadedWebBuild = null;
        Log.i(TAG, "Web loaded offline");
    }

    void onResume() {
        if (pendingInstallApk != null && canInstallPackages()) {
            File apk = pendingInstallApk;
            pendingInstallApk = null;
            launchInstaller(apk);
            return;
        }
        checkNow("resume", false);
    }

    void checkNow(String reason, boolean force) {
        long now = System.currentTimeMillis();
        if (!force && now - lastCheckAt < MIN_CHECK_INTERVAL_MS) return;
        lastCheckAt = now;
        if (executor.isShutdown()) return;
        executor.execute(() -> runCheck(reason));
    }

    private void runCheck(String reason) {
        JSONObject info = fetchVersionInfo();
        if (info == null) {
            Log.d(TAG, "Version check (" + reason + "): server unreachable");
            return;
        }

        String serverBuild = info.optString("web_build", "");
        if (loadedWebBuild == null && !loadedOffline && !serverBuild.isEmpty()) {
            loadedWebBuild = serverBuild;
        }
        boolean webStale = loadedOffline
                || (loadedWebBuild != null && !serverBuild.isEmpty() && !serverBuild.equals(loadedWebBuild));
        if (webStale) {
            Log.i(TAG, "Web update (" + reason + "): loaded=" + loadedWebBuild
                    + " offline=" + loadedOffline + " server=" + serverBuild);
            loadedOffline = false;
            loadedWebBuild = serverBuild;
            mainHandler.post(host::reloadGuide);
        }

        if (!BuildConfig.SELF_UPDATE_ENABLED) return;
        JSONObject android = info.optJSONObject("android");
        if (android == null) return;
        int latestCode = android.optInt("version_code", 0);
        if (latestCode <= BuildConfig.VERSION_CODE) return;
        if (isSnoozed(latestCode)) return;

        String versionName = android.optString("version_name", String.valueOf(latestCode));
        String apkPath = android.optString("apk_url", "");
        long size = android.optLong("size", 0);
        if (apkPath.isEmpty()) return;

        File apk = apkFileFor(latestCode);
        if (apk.isFile() && (size <= 0 || apk.length() == size)) {
            mainHandler.post(() -> offerInstall(apk, versionName, latestCode));
            return;
        }
        if (isMeteredNetwork()) {
            mainHandler.post(() -> offerDownload(apkPath, apk, versionName, latestCode, size));
        } else {
            downloadAndOffer(apkPath, apk, versionName, latestCode, size);
        }
    }

    private void downloadAndOffer(String apkPath, File target, String versionName, int code, long size) {
        if (!downloading.compareAndSet(false, true)) return;
        if (executor.isShutdown()) {
            downloading.set(false);
            return;
        }
        executor.execute(() -> {
            try {
                if (download(resolveUrl(apkPath), target, size)) {
                    mainHandler.post(() -> offerInstall(target, versionName, code));
                }
            } finally {
                downloading.set(false);
            }
        });
    }

    private void offerDownload(String apkPath, File target, String versionName, int code, long size) {
        if (!host.isUiVisible() || visibleDialog != null) return;
        String sizeText = size > 0
                ? String.format(Locale.ROOT, " (%.1f МБ)", size / 1024f / 1024f)
                : "";
        visibleDialog = new AlertDialog.Builder(activity)
                .setTitle("Доступно обновление " + versionName)
                .setMessage("Скачать новую версию приложения" + sizeText + "? Сейчас используется мобильный интернет.")
                .setPositiveButton("Скачать", (d, w) -> downloadAndOffer(apkPath, target, versionName, code, size))
                .setNegativeButton("Позже", (d, w) -> snooze(code))
                .setOnDismissListener(d -> visibleDialog = null)
                .show();
    }

    private void offerInstall(File apk, String versionName, int code) {
        if (!host.isUiVisible() || visibleDialog != null) return;
        visibleDialog = new AlertDialog.Builder(activity)
                .setTitle("Обновление " + versionName + " готово")
                .setMessage("Новая версия приложения скачана. Установить сейчас?")
                .setPositiveButton("Установить", (d, w) -> installApk(apk))
                .setNegativeButton("Позже", (d, w) -> snooze(code))
                .setOnDismissListener(d -> visibleDialog = null)
                .show();
    }

    private void installApk(File apk) {
        if (!canInstallPackages()) {
            pendingInstallApk = apk;
            try {
                Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + activity.getPackageName()));
                activity.startActivity(settings);
            } catch (Exception e) {
                Log.w(TAG, "Cannot open unknown sources settings", e);
                pendingInstallApk = null;
            }
            return;
        }
        launchInstaller(apk);
    }

    private void launchInstaller(File apk) {
        try {
            Uri uri = FileProvider.getUriForFile(activity, activity.getPackageName() + ".updates", apk);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(intent);
        } catch (Exception e) {
            Log.e(TAG, "Failed to launch installer", e);
        }
    }

    private boolean canInstallPackages() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true;
        return activity.getPackageManager().canRequestPackageInstalls();
    }

    private boolean download(String url, File target, long expectedSize) {
        File dir = target.getParentFile();
        if (dir != null && !dir.isDirectory() && !dir.mkdirs()) return false;
        File tmp = new File(target.getPath() + ".part");
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setInstanceFollowRedirects(true);
            conn.setConnectTimeout(20000);
            conn.setReadTimeout(120000);
            int code = conn.getResponseCode();
            if (code != 200) {
                Log.w(TAG, "APK download HTTP " + code);
                return false;
            }
            try (InputStream in = conn.getInputStream(); OutputStream out = new FileOutputStream(tmp)) {
                byte[] buf = new byte[64 * 1024];
                int n;
                while ((n = in.read(buf)) != -1) {
                    out.write(buf, 0, n);
                }
            }
            if (expectedSize > 0 && tmp.length() != expectedSize) {
                Log.w(TAG, "APK size mismatch " + tmp.length() + " != " + expectedSize);
                tmp.delete();
                return false;
            }
            File[] old = dir != null ? dir.listFiles() : null;
            if (old != null) {
                for (File f : old) {
                    if (!f.equals(tmp)) f.delete();
                }
            }
            boolean ok = tmp.renameTo(target);
            Log.i(TAG, "APK downloaded " + target + " ok=" + ok);
            return ok;
        } catch (Exception e) {
            Log.w(TAG, "APK download failed: " + e.getMessage());
            tmp.delete();
            return false;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private JSONObject fetchVersionInfo() {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(baseUrl + "api/app/version").openConnection();
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(10000);
            conn.setRequestProperty("Cache-Control", "no-cache");
            if (conn.getResponseCode() != 200) return null;
            try (InputStream in = conn.getInputStream()) {
                return new JSONObject(new String(GuideHttpCache.readAll(in), "UTF-8"));
            }
        } catch (Exception e) {
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private String resolveUrl(String pathOrUrl) {
        if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl;
        String p = pathOrUrl.startsWith("/") ? pathOrUrl.substring(1) : pathOrUrl;
        return baseUrl + p;
    }

    private File apkFileFor(int code) {
        File dir = new File(activity.getExternalFilesDir(null), "updates");
        return new File(dir, "6a9a-guide-" + code + ".apk");
    }

    private boolean isSnoozed(int code) {
        int dismissed = prefs.getInt(PREF_DISMISSED_CODE, 0);
        long at = prefs.getLong(PREF_DISMISSED_AT, 0);
        return dismissed == code && System.currentTimeMillis() - at < DISMISS_SNOOZE_MS;
    }

    private void snooze(int code) {
        prefs.edit()
                .putInt(PREF_DISMISSED_CODE, code)
                .putLong(PREF_DISMISSED_AT, System.currentTimeMillis())
                .apply();
    }

    private void dismissDialog() {
        if (visibleDialog != null) {
            try {
                visibleDialog.dismiss();
            } catch (Exception ignored) {
                /* activity finishing */
            }
            visibleDialog = null;
        }
    }

    private boolean isMeteredNetwork() {
        ConnectivityManager cm = (ConnectivityManager) activity.getSystemService(Context.CONNECTIVITY_SERVICE);
        return cm == null || cm.isActiveNetworkMetered();
    }

    private static boolean isOnline(ConnectivityManager cm) {
        Network network = cm.getActiveNetwork();
        if (network == null) return false;
        NetworkCapabilities caps = cm.getNetworkCapabilities(network);
        return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }
}
