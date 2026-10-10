package io.sixa9a.guide

import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.vk.id.AccessToken
import com.vk.id.VKID
import com.vk.id.VKIDAuthFail
import com.vk.id.auth.AuthCodeData
import com.vk.id.auth.VKIDAuthCallback
import com.vk.id.auth.VKIDAuthParams
import org.json.JSONObject

class GuideAndroidBridge(
    private val activity: MainActivity,
    private val webView: WebView,
) {
    @JavascriptInterface
    fun isVkIdLoginAvailable(): Boolean {
        return BuildConfig.VKID_ENABLED
    }

    @JavascriptInterface
    fun startVkIdLogin() {
        if (!BuildConfig.VKID_ENABLED) {
            notifyJsError("VK ID не настроен в сборке APK (local.properties)")
            return
        }
        activity.runOnUiThread {
            try {
                val params = VKIDAuthParams.Builder().apply {
                    scopes = setOf("email")
                }.build()
                VKID.instance.authorize(activity, vkAuthCallback, params)
            } catch (e: Exception) {
                Log.e(TAG, "VK ID authorize failed", e)
                notifyJsError(e.message ?: "Не удалось открыть вход VK ID")
            }
        }
    }

    private val vkAuthCallback = object : VKIDAuthCallback {
        override fun onAuth(accessToken: AccessToken) {
            val token = accessToken.token
            if (token.isNullOrBlank()) {
                notifyJsError("Пустой access token VK ID")
                return
            }
            val js = "window.__guidebookHandleVkIdAccessToken(" + JSONObject.quote(token) + ");"
            webView.post { webView.evaluateJavascript(js, null) }
        }

        override fun onAuthCode(data: AuthCodeData, isCompletion: Boolean) {
            // OAuth code flow not used — access token comes via onAuth.
        }

        override fun onFail(fail: VKIDAuthFail) {
            when (fail) {
                is VKIDAuthFail.Canceled -> Log.i(TAG, "VK ID login canceled")
                else -> {
                    Log.w(TAG, "VK ID login fail: $fail")
                    notifyJsError("Вход через VK ID не выполнен")
                }
            }
        }
    }

    private fun notifyJsError(message: String) {
        val js = "window.__guidebookHandleVkIdAccessTokenError(" + JSONObject.quote(message) + ");"
        webView.post { webView.evaluateJavascript(js, null) }
    }

    companion object {
        private const val TAG = "SixA9AGuide"
    }
}
