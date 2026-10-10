# Android APK (WebView)

Оболочка вокруг того же frontend, что и Telegram Mini App (`climbing-guidebook/`).

## Сборка APK

```bash
./scripts/build-android-apk.sh
```

Скрипт копирует актуальные `index.html`, `app.js`, `boot.js`, `styles.css`, `map-tiles.js`, `sw.js`, `icons/` в `app/src/main/assets/guidebook/` и запускает `./gradlew assembleRelease`.

Готовый файл: `dist/6a9a-guide-YYYYMMDD-vX.Y.Z.apk`.

Для установки на устройство release-APK нужно подписать (debug-ключ или release keystore). Debug-сборка:

```bash
cd android-app && ./gradlew assembleDebug
# app/build/outputs/apk/debug/app-debug.apk
```

## Как работает офлайн (опыт прошлых итераций)

| Слой | Механизм |
|------|----------|
| **Оболочка UI** | В APK зашита копия статики (`assets/guidebook/`). WebView грузит `https://<GUIDE_URL>/?app=android`, но `GuideAssetLoader` отдаёт JS/CSS/HTML из APK, если сеть недоступна. |
| **GET с сервера** | `GuideHttpCache` — дисковый кэш всех успешных GET на guide-хост (в т.ч. `/api/catalog/bundle`, фото по URL). При обрыве сети WebView подставляет кэш. |
| **Каталог «БД»** | В JS: `localStorage` ключ `climbingApp_catalog_v2` + мета `climbingApp_offline_meta_v1`. После успешной загрузки с API каталог сохраняется; офлайн — `bootstrapCatalogFromStorage()`. |
| **Фото** | IndexedDB (`hydrateCatalogPhotosFromIndexedDb`) — превью топо после первого онлайн-просмотра. |
| **Исходящие действия** | `climbingApp_sync_outbox_v1` — очередь POST/PATCH при «офлайне»; `flushOfflineOutbox()` при `online` и возврате в приложение. |
| **Android-режим** | `?app=android` → `CLIMBING_STANDALONE`: без Telegram SDK; `shouldTrustOfflineHint()` не доверяет ложному `navigator.onLine` в WebView. |
| **Вход VK ID (RuStore)** | В «Профиль» — **Войти через VK ID** (нативный SDK). Токен отправляется на `POST /api/auth/vk-id`. Нужны `VKIDClientID` / `VKIDClientSecret` в `android-app/local.properties` и `VK_ID_CLIENT_ID` на сервере. |
| **Вход Telegram** | В «Профиль» — **deep link** `t.me/бот?start=login_…` (без oauth.telegram.org / VPN). APK опрашивает `GET /api/auth/telegram-deeplink`. WebView открывает `t.me` во внешнем Telegram. |

### RuStore: настройка VK ID

1. [RuStore Консоль](https://console.rustore.ru/) → **Инструменты** → приложение → **Авторизация VK ID** → перейти в кабинет VK ID.
2. Создайте приложение Android: пакет **`io.sixa9a.guide`**, SHA-256 подписи APK (для sideload — debug keystore: `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android`).
3. Скопируйте **ID приложения** и **защищённый ключ** в `android-app/local.properties` (`VKIDClientID`, `VKIDClientSecret`).
4. На сервере гайда: переменная **`VK_ID_CLIENT_ID`** (тот же ID).
5. Соберите APK: `./scripts/build-android-apk.sh`.

### Рекомендуемый сценарий для пользователя

1. **Первый запуск с интернетом** — подтягиваются API и каталог, прогревается `GuideHttpCache` (в т.ч. `/api/catalog/bundle` после `onPageFinished`).
2. **Дальше офлайн** — UI из APK + кэш GET + сохранённый каталог в WebView storage.
3. **Пролазы/оценки офлайн** — попадают в outbox и уходят на сервер при появлении сети.

Service Worker в Mini App для Android **не используется** (`clearServiceWorkers()` при старте) — офлайн держится на связке **APK assets + GuideHttpCache + localStorage**.

## URL production

Задаётся в `app/build.gradle` → `buildConfigField GUIDE_URL` (сейчас `https://92.246.76.142.sslip.io/`).

## Отладка

`adb logcat -s SixA9AGuide GuideHttpCache GuideAssetLoader` — прокси, кэш, catalog debug (`window.__guidebookCatalogDebug()`).
