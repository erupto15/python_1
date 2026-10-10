package io.sixa9a.guide

import android.app.Application
import com.vk.id.VKID
import java.util.Locale

class GuideApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        if (!BuildConfig.VKID_ENABLED) return
        VKID.init(this)
        VKID.instance.setLocale(Locale("ru"))
    }
}
