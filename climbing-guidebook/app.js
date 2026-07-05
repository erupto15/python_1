        /**
         * Telegram Mini App: высота viewport, тема, MainButton / BackButton.
         * Для авторизации на своём API передайте initData на бэкенд и проверьте подпись (см. документацию Telegram);
         * настройте CORS для домена Mini App. Сырые данные: window.__TG_INIT_DATA
         */
        window.__TG_DIALOG_MAIN = {
            areaDialog: {
                text: 'Сохранить',
                btnId: 'areaSubmitBtn'
            },
            sectorDialog: {
                text: 'Сохранить',
                btnId: 'sectorSubmitBtn'
            },
            quickRouteDialog: {
                text: 'Добавить трассу',
                btnId: 'saveQuickRouteBtn'
            },
            quickBoulderDialog: {
                text: 'Добавить боулдеринг',
                btnId: 'saveQuickBoulderBtn'
            },
            climbDetailDialog: {
                resolve() {
                    const app = window.app;
                    const canLog = app && app.isLoggedIn && app.isLoggedIn() && app.isTelegramUser && app.isTelegramUser();
                    if (canLog) {
                        return {
                            text: 'Пролаз',
                            btnId: 'climbDetailOpenLogBtn'
                        };
                    }
                    const mkBtn = document.getElementById('climbDetailMarkupBtn');
                    const saveRow = document.getElementById('climbDetailSaveRow');
                    const hasPhoto = mkBtn && mkBtn.style.display !== 'none';
                    if (!hasPhoto) {
                        return null;
                    }
                    const showSave = saveRow && !saveRow.classList.contains('hidden');
                    return {
                        text: 'Схема на фото',
                        btnId: 'climbDetailMarkupBtn',
                        secondaryText: showSave ? 'Сохранить со схемой' : '',
                        secondaryBtnId: showSave ? 'climbDetailSavePhotoBtn' : ''
                    };
                }
            },
            routeLineMarkupDialog: {
                resolve() {
                    if (window.app && window.app._markupDialogViewOnly) {
                        return null;
                    }
                    return {
                        text: 'Сохранить разметку',
                        btnId: 'saveRouteLineMarkupBtn'
                    };
                }
            },
            boulderHoldsMarkupDialog: {
                resolve() {
                    if (window.app && window.app._markupDialogViewOnly) {
                        return null;
                    }
                    return {
                        text: 'Сохранить разметку',
                        btnId: 'saveBoulderHoldsMarkupBtn'
                    };
                }
            },
            climbLogDialog: {
                text: 'Записать пролаз',
                btnId: 'climbTgLogConfirmBtn'
            }
        };

        window.__TG_DIALOG_CANCEL = {
            areaDialog: 'closeAreaDialogBtn',
            sectorDialog: 'closeSectorDialogBtn',
            quickRouteDialog: 'closeQuickRouteDialogBtn',
            quickBoulderDialog: 'closeQuickBoulderDialogBtn',
            climbDetailDialog: 'closeClimbDetailDialogBtn',
            climbLogDialog: 'closeClimbLogDialogBtn',
            routeLineMarkupDialog: 'closeRouteLineMarkupDialogBtn',
            boulderHoldsMarkupDialog: 'closeBoulderHoldsMarkupDialogBtn',
            profileSendsDialog: 'profileSendsDialogCloseBtn',
            profileStylesDialog: 'profileStylesDialogCloseBtn'
        };

        window.initTelegramWebApp = function initTelegramWebApp() {
            const tg = window.Telegram && window.Telegram.WebApp;
            if (!tg) return;
            if (window.__TG_WEB_APP_INITIALIZED) return;
            window.__TG_WEB_APP_INITIALIZED = true;

            document.documentElement.classList.add('tg-mini-app');
            window.__TG_INIT_DATA = tg.initData || '';

            function hexColor(c) {
                if (c == null || c === '') return '';
                const s = String(c).trim();
                if (!s) return '';
                return s.startsWith('#') ? s : `#${s}`;
            }

            function isLightTelegramColor(hex) {
                const h = String(hex || '').replace('#', '');
                if (h.length !== 6) return false;
                const r = parseInt(h.slice(0, 2), 16);
                const g = parseInt(h.slice(2, 4), 16);
                const b = parseInt(h.slice(4, 6), 16);
                if (![r, g, b].every(Number.isFinite)) return false;
                const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                return lum > 0.58;
            }

            function applyTelegramTheme() {
                const tp = tg.themeParams || {};
                const root = document.documentElement;
                const bg = hexColor(tp.bg_color);
                const lightTheme = bg ? isLightTelegramColor(bg) : false;
                root.classList.toggle('tg-theme-light', lightTheme);
                root.classList.toggle('tg-theme-dark', !lightTheme);
                const txt = hexColor(tp.text_color);
                const hint = hexColor(tp.hint_color);
                const link = hexColor(tp.link_color);
                const btn = hexColor(tp.button_color);
                const secondaryBg = hexColor(tp.secondary_bg_color);
                const sectionBg = hexColor(tp.section_bg_color);
                const destructive = hexColor(tp.destructive_text_color);

                if (bg) root.style.setProperty('--background-color', bg);
                if (txt) root.style.setProperty('--text-color', txt);
                if (hint) root.style.setProperty('--light-text', hint);
                if (link) root.style.setProperty('--primary-color', link);
                if (btn) {
                    root.style.setProperty('--tg-blue', btn);
                    root.style.setProperty('--tg-blue-hover', btn);
                    root.style.setProperty('--tg-blue-active', btn);
                }
                const card = secondaryBg || sectionBg;
                if (card) root.style.setProperty('--card-bg', card);
                if (destructive) {
                    root.style.setProperty('--tg-danger', destructive);
                    root.style.setProperty('--danger-color', destructive);
                }
                if (txt && bg) {
                    root.style.setProperty(
                        '--border-color',
                        `color-mix(in srgb, ${txt} 14%, ${bg})`
                    );
                } else if (hint) {
                    root.style.setProperty('--border-color', hint);
                }

                try {
                    if (bg) {
                        tg.setHeaderColor(bg);
                        tg.setBackgroundColor(bg);
                    }
                } catch (e) {
                    /* старые клиенты / ограничения WebView */
                }
                if (typeof window.applyTelegramThemeToNativeButtons === 'function') {
                    window.applyTelegramThemeToNativeButtons(tg);
                }
            }

            function syncTelegramViewport() {
                const h = tg.viewportStableHeight || tg.viewportHeight;
                if (h && h > 0) {
                    document.documentElement.style.setProperty('--app-height', `${h}px`);
                }
                window.dispatchEvent(new Event('resize'));
            }

            tg.ready();
            if (typeof tg.expand === 'function') tg.expand();
            if (typeof window.signalTelegramAppReady === 'function') window.signalTelegramAppReady();

            applyTelegramTheme();
            syncTelegramViewport();

            if (typeof tg.onEvent === 'function') {
                tg.onEvent('themeChanged', applyTelegramTheme);
                tg.onEvent('viewportChanged', syncTelegramViewport);
                tg.onEvent('visibility_changed', () => {
                    if (tg.isActive === false) return;
                    scheduleCatalogRefreshOnAppVisible();
                });
                tg.onEvent('activated', () => {
                    scheduleCatalogRefreshOnAppVisible();
                });
            } else {
                window.addEventListener('resize', syncTelegramViewport);
            }

            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    scheduleCatalogRefreshOnAppVisible();
                }
            });

            let _telegramBackLockUntil = 0;

            const handleTelegramBack = () => {
                const now = Date.now();
                if (now < _telegramBackLockUntil) return;
                _telegramBackLockUntil = now + 280;

                if (typeof window.closeTopTelegramOverlay === 'function' && window.closeTopTelegramOverlay()) {
                    return;
                }
                const app = window.app;
                if (!app || !app.catalog) return;
                if (app.catalog.view === 'problems') {
                    app.catalog = { view: 'sectors', areaId: app.catalog.areaId, sectorId: null };
                    app.renderCatalog();
                    if (typeof window.syncTelegramMiniAppUi === 'function') {
                        window.syncTelegramMiniAppUi();
                    }
                    return;
                }
                if (app.catalog.view === 'sectors') {
                    app.catalog = { view: 'areas', areaId: null, sectorId: null };
                    app.renderCatalog();
                    if (typeof window.syncTelegramMiniAppUi === 'function') {
                        window.syncTelegramMiniAppUi();
                    }
                }
            };

            if (tg.BackButton && !tg.__backBound) {
                tg.__backBound = true;
                tg.BackButton.onClick(handleTelegramBack);
                if (typeof tg.onEvent === 'function') {
                    tg.onEvent('backButtonClicked', handleTelegramBack);
                }
            }

            if (tg.MainButton && !tg.__mainBound) {
                tg.__mainBound = true;
                tg.MainButton.onClick(() => {
                    const openId = window.findOpenTelegramDialogId && window.findOpenTelegramDialogId();
                    if (!openId) return;
                    const cfg = window.resolveTelegramDialogButtonConfig
                        ? window.resolveTelegramDialogButtonConfig(openId)
                        : window.__TG_DIALOG_MAIN[openId];
                    if (cfg && cfg.btnId) {
                        document.getElementById(cfg.btnId)?.click();
                    }
                });
            }

            if (tg.SecondaryButton && !tg.__secondaryBound) {
                tg.__secondaryBound = true;
                tg.SecondaryButton.onClick(() => {
                    const openId = window.findOpenTelegramDialogId && window.findOpenTelegramDialogId();
                    if (!openId) return;
                    const cfg = window.resolveTelegramDialogButtonConfig
                        ? window.resolveTelegramDialogButtonConfig(openId)
                        : null;
                    if (cfg && cfg.secondaryBtnId) {
                        document.getElementById(cfg.secondaryBtnId)?.click();
                    }
                });
            }

        };

        window.getTelegramWebApp = function getTelegramWebApp() {
            return (window.Telegram && window.Telegram.WebApp) || null;
        };

        window.isTelegramMiniApp = function isTelegramMiniApp() {
            return document.documentElement.classList.contains('tg-mini-app');
        };

        window.findOpenTelegramDialogId = function findOpenTelegramDialogId() {
            const overlays = Array.from(document.querySelectorAll('.dialog-overlay:not(.hidden)'));
            if (!overlays.length) return null;
            const domOrder = Array.from(document.querySelectorAll('.dialog-overlay'));
            overlays.sort((a, b) => {
                const za = parseInt(window.getComputedStyle(a).zIndex, 10) || 0;
                const zb = parseInt(window.getComputedStyle(b).zIndex, 10) || 0;
                if (zb !== za) return zb - za;
                return domOrder.indexOf(b) - domOrder.indexOf(a);
            });
            return overlays[0]?.id || null;
        };

        /** Закрыть верхний полноэкранный диалог (фото, разметка, формы). */
        window.closeTopTelegramOverlay = function closeTopTelegramOverlay() {
            const openId = window.findOpenTelegramDialogId();
            if (!openId) return false;

            const app = window.app;
            if (app && typeof app.hideDialog === 'function') {
                app.hideDialog(openId);
                return true;
            }

            const cancelId = window.__TG_DIALOG_CANCEL?.[openId];
            const closeBtn = (cancelId && document.getElementById(cancelId))
                || document.querySelector(`[data-close-dialog="${openId}"]`);
            if (closeBtn) {
                closeBtn.click();
                return true;
            }

            const el = document.getElementById(openId);
            if (el) {
                el.classList.add('hidden');
                if (app && typeof app.syncBodyDialogScreenLock === 'function') {
                    app.syncBodyDialogScreenLock();
                }
                if (typeof window.syncTelegramMiniAppUi === 'function') {
                    window.syncTelegramMiniAppUi();
                }
                return true;
            }
            return false;
        };

        window.resolveTelegramDialogButtonConfig = function resolveTelegramDialogButtonConfig(dialogId) {
            const raw = window.__TG_DIALOG_MAIN && window.__TG_DIALOG_MAIN[dialogId];
            if (!raw) return null;
            if (typeof raw.resolve === 'function') return raw.resolve(dialogId);
            return raw;
        };

        window.applyTelegramThemeToNativeButtons = function applyTelegramThemeToNativeButtons(tg) {
            if (!tg) return;
            const tp = tg.themeParams || {};
            const btn = (() => {
                const c = tp.button_color;
                if (c == null || c === '') return '';
                const s = String(c).trim();
                return s.startsWith('#') ? s : `#${s}`;
            })();
            const btnText = (() => {
                const c = tp.button_text_color;
                if (c == null || c === '') return '';
                const s = String(c).trim();
                return s.startsWith('#') ? s : `#${s}`;
            })();
            const secBg = (() => {
                const c = tp.secondary_bg_color || tp.bg_color;
                if (c == null || c === '') return '';
                const s = String(c).trim();
                return s.startsWith('#') ? s : `#${s}`;
            })();
            try {
                if (btn && tg.MainButton) tg.MainButton.color = btn;
                if (btnText && tg.MainButton) tg.MainButton.textColor = btnText;
                if (secBg && tg.SecondaryButton) tg.SecondaryButton.color = secBg;
                if (btnText && tg.SecondaryButton) tg.SecondaryButton.textColor = btnText;
            } catch (_) {
                /* старые клиенты */
            }
        };

        window.setTelegramMainButtonLoading = function setTelegramMainButtonLoading(loading) {
            const tg = window.getTelegramWebApp();
            if (!tg || !tg.MainButton || !window.isTelegramMiniApp()) return;
            try {
                if (loading) {
                    if (typeof tg.MainButton.showProgress === 'function') {
                        tg.MainButton.showProgress(loading === true ? true : loading);
                    }
                    if (typeof tg.MainButton.disable === 'function') tg.MainButton.disable();
                } else {
                    if (typeof tg.MainButton.hideProgress === 'function') tg.MainButton.hideProgress();
                    if (typeof tg.MainButton.enable === 'function') tg.MainButton.enable();
                }
            } catch (_) {
                /* ignore */
            }
        };

        window.setTelegramWebAppButtonsBusy = function setTelegramWebAppButtonsBusy(busy) {
            const tg = window.getTelegramWebApp();
            if (!tg || !window.isTelegramMiniApp()) return;
            try {
                if (busy) {
                    if (tg.MainButton && typeof tg.MainButton.disable === 'function') tg.MainButton.disable();
                    if (tg.SecondaryButton && typeof tg.SecondaryButton.disable === 'function') tg.SecondaryButton.disable();
                } else if (typeof window.syncTelegramWebAppButtons === 'function') {
                    window.syncTelegramWebAppButtons();
                }
            } catch (_) {
                /* ignore */
            }
        };

        window.syncTelegramWebAppButtons = function syncTelegramWebAppButtons(dialogId) {
            const tg = window.getTelegramWebApp();
            const isTg = window.isTelegramMiniApp();
            const root = document.documentElement;
            root.classList.toggle('tg-webapp-buttons', isTg);

            if (!isTg || !tg) {
                root.removeAttribute('data-tg-main-visible');
                root.removeAttribute('data-tg-secondary-visible');
                if (tg && tg.MainButton) tg.MainButton.hide();
                if (tg && tg.SecondaryButton) tg.SecondaryButton.hide();
                return;
            }

            window.applyTelegramThemeToNativeButtons(tg);

            const openId = dialogId || window.findOpenTelegramDialogId();
            const cfg = openId ? window.resolveTelegramDialogButtonConfig(openId) : null;

            if (!cfg || !cfg.btnId) {
                root.removeAttribute('data-tg-main-visible');
                if (tg.MainButton) tg.MainButton.hide();
            } else {
                const mainBtn = document.getElementById(cfg.btnId);
                if (mainBtn && !mainBtn.disabled) {
                    tg.MainButton.setText(cfg.text || 'OK');
                    if (typeof tg.MainButton.enable === 'function') tg.MainButton.enable();
                    tg.MainButton.show();
                    root.setAttribute('data-tg-main-visible', 'true');
                } else {
                    root.removeAttribute('data-tg-main-visible');
                    tg.MainButton.hide();
                }
            }

            const secId = cfg && cfg.secondaryBtnId;
            const showSecondary = !!(secId && cfg.secondaryText);
            if (showSecondary && tg.SecondaryButton) {
                const secBtn = document.getElementById(secId);
                if (secBtn && !secBtn.disabled) {
                    tg.SecondaryButton.setText(cfg.secondaryText);
                    if (typeof tg.SecondaryButton.show === 'function') tg.SecondaryButton.show();
                    root.setAttribute('data-tg-secondary-visible', 'true');
                } else {
                    root.removeAttribute('data-tg-secondary-visible');
                    tg.SecondaryButton.hide();
                }
            } else {
                root.removeAttribute('data-tg-secondary-visible');
                if (tg.SecondaryButton) tg.SecondaryButton.hide();
            }
        };

        window.applyTelegramMainButtonForDialog = function applyTelegramMainButtonForDialog(dialogId) {
            window.syncTelegramWebAppButtons(dialogId);
        };

        window.hideTelegramMainButton = function hideTelegramMainButton() {
            window.syncTelegramWebAppButtons(null);
        };

        window.syncTelegramMiniAppUi = function syncTelegramMiniAppUi() {
            const tg = window.getTelegramWebApp();
            if (!tg || !tg.BackButton) return;
            const app = window.app;
            const dialogOpen = !!window.findOpenTelegramDialogId();
            if (dialogOpen) {
                tg.BackButton.show();
            } else if (app && app.catalog && app.catalog.view !== 'areas') {
                tg.BackButton.show();
            } else {
                tg.BackButton.hide();
            }
            window.syncTelegramWebAppButtons();
        };

        if (window.isTelegramMiniApp()) {
            window.syncTelegramWebAppButtons();
            window.syncTelegramMiniAppUi();
        }

        window.CLIMBING_API_BASE_URL = '';
        /** Только боулдеринг: скрыты трассы (вкладка, каталог, карта, фильтр в альбоме). Данные трасс в хранилище не трогаем. */
        const APP_BOULDER_ONLY = false;
        /** База API: пустая строка означает same-origin API через reverse proxy. */
        const API_BASE_URL = (() => {
            const c = typeof window.CLIMBING_API_BASE_URL === 'string' ? window.CLIMBING_API_BASE_URL.trim() : '';
            if (c) return c.replace(/\/$/, '');
            if (window.location.protocol === 'file:') return 'http://127.0.0.1:8000';
            const host = (window.location.hostname || '').toLowerCase();
            const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
            if (isLocalHost && window.location.port !== '8000') return 'http://127.0.0.1:8000';
            return '';
        })();
        const AUTH_STORAGE_KEY = 'climbingApp_auth';
        const CLIMBING_DATA_STORAGE_KEY = 'climbingApp_catalog_v2';
        const CLIMBING_OFFLINE_META_KEY = 'climbingApp_offline_meta_v1';
        const CLIMBING_OFFLINE_PACKS_KEY = 'climbingApp_offline_packs_v1';
        const OFFLINE_OUTBOX_KEY = 'climbingApp_sync_outbox_v1';
        const OFFLINE_OUTBOX_LIMIT = 50;
        const ADMIN_EMAIL_HINT = window.CLIMBING_ADMIN_EMAIL || 'admin@climbing-guidebook.local';
        const MAX_PHOTO_SIZE_MB = 25;
        const MAX_PHOTO_SIZE_BYTES = MAX_PHOTO_SIZE_MB * 1024 * 1024;
        /** Фото грузим лениво при первом заходе во «Фотоальбом», чтобы старт Mini App не ждал сотни запросов. */
        let _photosLoadedFromApi = false;
        const PHOTO_FETCH_CHUNK = 14;
        /** Запросы секторов по районам — небольшими пачками, чтобы не забивать канал. */
        const SECTOR_FETCH_BATCH = 6;
        /** Проверка доступности API перед первичной загрузкой каталога. */
        const API_WAKE_ATTEMPTS = 12;
        const API_WAKE_ATTEMPT_TIMEOUT_MS = 20000;
        const API_WAKE_PAUSE_MS = 2000;
        const CATALOG_RELOAD_DEBOUNCE_MS = 4000;
        let _catalogReloadPromise = null;
        let _lastCatalogReloadFinishedAt = 0;
        let _appRemoteDataReady = false;
        let _offlineMode = false;
        let _persistCatalogTimer = null;
        let _leafletLoadPromise = null;

        function ensureLeafletLoaded() {
            if (typeof L !== 'undefined' && L.map) return Promise.resolve();
            if (_leafletLoadPromise) return _leafletLoadPromise;
            _leafletLoadPromise = new Promise((resolve, reject) => {
                if (!document.querySelector('link[data-leaflet-css]')) {
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
                    link.dataset.leafletCss = '1';
                    document.head.appendChild(link);
                }
                const existing = document.querySelector('script[data-leaflet-loader]');
                if (existing) {
                    existing.addEventListener('load', () => resolve(), { once: true });
                    existing.addEventListener('error', () => reject(new Error('Leaflet load failed')), { once: true });
                    return;
                }
                const script = document.createElement('script');
                script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
                script.async = true;
                script.dataset.leafletLoader = '1';
                script.onload = () => resolve();
                script.onerror = () => reject(new Error('Leaflet load failed'));
                document.head.appendChild(script);
            });
            return _leafletLoadPromise;
        }

        async function clearServiceWorkers() {
            if (!('serviceWorker' in navigator)) return;
            try {
                const regs = await navigator.serviceWorker.getRegistrations();
                await Promise.all(regs.map((reg) => reg.unregister()));
                if ('caches' in window) {
                    const keys = await caches.keys();
                    await Promise.all(
                        keys.filter((key) => key.startsWith('guidebook-')).map((key) => caches.delete(key))
                    );
                }
            } catch (err) {
                console.warn('service worker cleanup', err);
            }
        }

        /** Перед отправкой на API: уменьшаем base64 (быстрее JSON и отклик «Добавить»). */
        const QUICK_PHOTO_MAX_EDGE = 1920;
        const QUICK_PHOTO_JPEG_QUALITY = 0.82;
        const QUICK_PHOTO_DATAURL_SOFT_CAP = 900000;

        /** Автосохранение открытых фото в память устройства (Telegram/WebView). */
        const AUTO_SAVE_OPENED_MEDIA_KEY = 'climbingApp_auto_save_opened_media_v1';

        function getAutoSavedMediaSet() {
            try {
                const raw = localStorage.getItem(AUTO_SAVE_OPENED_MEDIA_KEY);
                if (!raw) return new Set();
                const arr = JSON.parse(raw);
                if (!Array.isArray(arr)) return new Set();
                return new Set(arr.map((x) => String(x || '')).filter(Boolean));
            } catch (_) {
                return new Set();
            }
        }

        function markMediaAutoSaved(key) {
            const set = getAutoSavedMediaSet();
            set.add(String(key || ''));
            try {
                localStorage.setItem(AUTO_SAVE_OPENED_MEDIA_KEY, JSON.stringify(Array.from(set).filter(Boolean)));
            } catch (_) {
                /* ignore */
            }
        }

        function wasMediaAutoSaved(key) {
            return getAutoSavedMediaSet().has(String(key || ''));
        }

        function guessImageExtFromDataUrl(dataUrl) {
            const s = String(dataUrl || '');
            if (s.startsWith('data:image/jpeg')) return 'jpg';
            if (s.startsWith('data:image/png')) return 'png';
            if (s.startsWith('data:image/webp')) return 'webp';
            if (s.startsWith('data:image/gif')) return 'gif';
            return 'jpg';
        }

        /**
         * Готовит растровый data: URL исходника (в т.ч. скачивает https с API при CORS),
         * чтобы canvas не был «tainted» и можно было наложить разметку.
         */
        async function resolvePhotoImageDataUrlForExport(photo) {
            const raw = photo?.imageData;
            if (!raw || typeof raw !== 'string') return null;
            const s = raw.trim();
            if (s.startsWith('data:')) return s;
            if (s.startsWith('blob:')) return s;
            let url = s;
            if (s.startsWith('/')) {
                url = API_BASE_URL ? `${API_BASE_URL.replace(/\/$/, '')}${s}` : s;
            }
            if (!url.startsWith('/') && !/^https?:\/\//i.test(url)) return null;
            try {
                const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
                const timer = ac ? setTimeout(() => ac.abort(), 45000) : 0;
                const res = await fetch(url, {
                    mode: 'cors',
                    credentials: 'omit',
                    signal: ac ? ac.signal : undefined
                });
                if (timer) clearTimeout(timer);
                if (!res.ok) return null;
                const blob = await res.blob();
                return await new Promise((resolve) => {
                    const fr = new FileReader();
                    fr.onload = () => resolve(String(fr.result || '') || null);
                    fr.onerror = () => resolve(null);
                    fr.readAsDataURL(blob);
                });
            } catch (_) {
                return null;
            }
        }

        const PHOTO_CACHE_DB_NAME = 'climbingApp_photos_v1';
        const PHOTO_CACHE_STORE = 'photos';
        const PHOTO_CACHE_MAX_ITEMS = 180;
        const PHOTO_CACHE_WRITE_BATCH = 4;
        let _photoCacheDbPromise = null;
        let _photoCacheStats = { count: 0, updatedAt: 0 };

        function openPhotoCacheDb() {
            if (!('indexedDB' in window)) {
                return Promise.reject(new Error('IndexedDB unavailable'));
            }
            if (!_photoCacheDbPromise) {
                _photoCacheDbPromise = new Promise((resolve, reject) => {
                    const req = indexedDB.open(PHOTO_CACHE_DB_NAME, 1);
                    req.onupgradeneeded = () => {
                        const db = req.result;
                        if (!db.objectStoreNames.contains(PHOTO_CACHE_STORE)) {
                            const store = db.createObjectStore(PHOTO_CACHE_STORE, { keyPath: 'id' });
                            store.createIndex('cachedAt', 'cachedAt', { unique: false });
                        }
                    };
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
                });
            }
            return _photoCacheDbPromise;
        }

        function idbRequest(request) {
            return new Promise((resolve, reject) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
            });
        }

        async function getCachedPhotoDataUrl(photoId) {
            const id = String(photoId || '').trim();
            if (!id || !('indexedDB' in window)) return null;
            try {
                const db = await openPhotoCacheDb();
                const tx = db.transaction(PHOTO_CACHE_STORE, 'readonly');
                const record = await idbRequest(tx.objectStore(PHOTO_CACHE_STORE).get(id));
                return record?.dataUrl || null;
            } catch (err) {
                console.warn('photo cache read', err);
                return null;
            }
        }

        async function listPhotoCacheRecords() {
            if (!('indexedDB' in window)) return [];
            try {
                const db = await openPhotoCacheDb();
                const tx = db.transaction(PHOTO_CACHE_STORE, 'readonly');
                return await idbRequest(tx.objectStore(PHOTO_CACHE_STORE).getAll());
            } catch (err) {
                console.warn('photo cache list', err);
                return [];
            }
        }

        async function deletePhotoCacheRecord(photoId) {
            const id = String(photoId || '').trim();
            if (!id || !('indexedDB' in window)) return;
            try {
                const db = await openPhotoCacheDb();
                const tx = db.transaction(PHOTO_CACHE_STORE, 'readwrite');
                tx.objectStore(PHOTO_CACHE_STORE).delete(id);
                await new Promise((resolve, reject) => {
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => reject(tx.error);
                });
            } catch (err) {
                console.warn('photo cache delete', err);
            }
        }

        async function prunePhotoCache(validPhotoIds) {
            const valid = new Set((validPhotoIds || []).map((id) => String(id)));
            const records = await listPhotoCacheRecords();
            const stale = records.filter((rec) => !valid.has(String(rec.id)));
            const overflow = records
                .filter((rec) => valid.has(String(rec.id)))
                .sort((a, b) => Number(a.cachedAt || 0) - Number(b.cachedAt || 0));
            let toDelete = stale.map((rec) => rec.id);
            if (overflow.length > PHOTO_CACHE_MAX_ITEMS) {
                toDelete = toDelete.concat(
                    overflow.slice(0, overflow.length - PHOTO_CACHE_MAX_ITEMS).map((rec) => rec.id)
                );
            }
            await Promise.all(toDelete.map((id) => deletePhotoCacheRecord(id)));
            await refreshPhotoCacheStats();
        }

        async function refreshPhotoCacheStats() {
            const records = await listPhotoCacheRecords();
            _photoCacheStats = {
                count: records.length,
                updatedAt: Date.now()
            };
            return _photoCacheStats;
        }

        async function putCachedPhoto(photoId, dataUrl, mimeType) {
            const id = String(photoId || '').trim();
            const url = String(dataUrl || '').trim();
            if (!id || !url.startsWith('data:') || !('indexedDB' in window)) return false;
            try {
                const db = await openPhotoCacheDb();
                const tx = db.transaction(PHOTO_CACHE_STORE, 'readwrite');
                tx.objectStore(PHOTO_CACHE_STORE).put({
                    id,
                    dataUrl: url,
                    mimeType: mimeType || '',
                    cachedAt: Date.now(),
                    byteSize: url.length
                });
                await new Promise((resolve, reject) => {
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => reject(tx.error);
                });
                _photoCacheStats.count = Math.max(_photoCacheStats.count, 0) + 1;
                return true;
            } catch (err) {
                console.warn('photo cache write', err);
                return false;
            }
        }

        async function cachePhotoToIndexedDb(photo) {
            const id = String(photo?.id || '').trim();
            if (!id) return false;
            const existing = await getCachedPhotoDataUrl(id);
            if (existing) return true;
            const dataUrl = await resolvePhotoImageDataUrlForExport(photo);
            if (!dataUrl || !dataUrl.startsWith('data:')) return false;
            return putCachedPhoto(id, dataUrl, photo.fileType || '');
        }

        async function cachePhotosToIndexedDb(photos) {
            const list = Array.isArray(photos) ? photos.filter((p) => p && p.id) : [];
            if (!list.length || !('indexedDB' in window)) return;
            for (let i = 0; i < list.length; i += PHOTO_CACHE_WRITE_BATCH) {
                const slice = list.slice(i, i + PHOTO_CACHE_WRITE_BATCH);
                await Promise.all(slice.map((photo) => cachePhotoToIndexedDb(photo)));
            }
            await prunePhotoCache(list.map((p) => p.id));
            await refreshPhotoCacheStats();
            updateOfflineStatusBanner();
        }

        async function hydratePhotosFromIndexedDb(photos) {
            const list = Array.isArray(photos) ? photos : [];
            if (!list.length || !('indexedDB' in window)) return false;
            let changed = false;
            for (const photo of list) {
                const current = resolvePhotoDisplayUrl(photo?.imageData);
                if (current) continue;
                const cached = await getCachedPhotoDataUrl(photo.id);
                if (!cached) continue;
                photo.imageData = cached;
                changed = true;
            }
            if (changed) {
                const data = getClimbingData();
                const byId = new Map(list.map((p) => [String(p.id), p]));
                data.photos = (data.photos || []).map((p) => byId.get(String(p.id)) || p);
                saveClimbingData(data);
                _photosLoadedFromApi = (data.photos || []).some(photoMayHaveImage);
            }
            return changed;
        }

        async function hydrateCatalogPhotosFromIndexedDb() {
            const data = getClimbingData();
            const photos = data.photos || [];
            if (!photos.length) return false;
            const changed = await hydratePhotosFromIndexedDb(photos);
            if (changed) {
                window.app?.refreshUiAfterRemoteLoad?.();
            }
            await refreshPhotoCacheStats();
            return changed;
        }

        async function resolvePhotoImageSource(photo) {
            const direct = resolvePhotoDisplayUrl(photo?.imageData);
            if (direct && direct.startsWith('data:')) return direct;
            if (photo?.id) {
                const cached = await getCachedPhotoDataUrl(photo.id);
                if (cached) return cached;
            }
            if (direct && !shouldUseOfflineQueue()) return direct;
            return direct || '';
        }

        function composeMarkupOnDataUrl(srcDataUrl, photo, climbType) {
            return new Promise((resolve) => {
                const markup = normalizePhotoMarkup(photo.markup, climbType);
                if (!markup) {
                    resolve(srcDataUrl);
                    return;
                }
                const img = new Image();
                img.onload = () => {
                    try {
                        const w = img.naturalWidth || img.width || 0;
                        const h = img.naturalHeight || img.height || 0;
                        if (!w || !h) {
                            resolve(srcDataUrl);
                            return;
                        }
                        const canvas = document.createElement('canvas');
                        canvas.width = w;
                        canvas.height = h;
                        const ctx = canvas.getContext('2d');
                        if (!ctx) {
                            resolve(srcDataUrl);
                            return;
                        }
                        ctx.drawImage(img, 0, 0, w, h);

                        const toPx = (p) => ({ x: Number(p?.x) * w, y: Number(p?.y) * h });
                        const drawLine = (pts) => {
                            if (!Array.isArray(pts) || pts.length < 2) return;
                            ctx.beginPath();
                            pts.forEach((p, i) => {
                                const q = toPx(p);
                                if (!Number.isFinite(q.x) || !Number.isFinite(q.y)) return;
                                if (i === 0) ctx.moveTo(q.x, q.y);
                                else ctx.lineTo(q.x, q.y);
                            });
                            ctx.strokeStyle = '#d32f2f';
                            ctx.lineWidth = Math.max(2, Math.round(Math.min(w, h) * 0.006));
                            ctx.lineJoin = 'round';
                            ctx.lineCap = 'round';
                            ctx.stroke();
                        };
                        const drawCircle = (p, rPx, fill, stroke, lineW) => {
                            const q = toPx(p);
                            if (!Number.isFinite(q.x) || !Number.isFinite(q.y)) return;
                            ctx.beginPath();
                            ctx.arc(q.x, q.y, rPx, 0, Math.PI * 2);
                            if (fill) {
                                ctx.fillStyle = fill;
                                ctx.fill();
                            }
                            ctx.strokeStyle = stroke;
                            ctx.lineWidth = lineW;
                            ctx.stroke();
                        };

                        if (climbType === 'route') {
                            const routeMarkup = normalizePhotoMarkup(markup, 'route') || markup;
                            const pts = Array.isArray(routeMarkup.points) ? routeMarkup.points : [];
                            const starts = Array.isArray(routeMarkup.startHolds) ? routeMarkup.startHolds : [];
                            drawLine(pts);
                            const rHold = Math.max(5, Math.round(Math.min(w, h) * 0.018));
                            starts.forEach((p, i) => {
                                drawCircle(p, rHold, TOPO_MARKUP.holdFill, TOPO_MARKUP.holdStroke, TOPO_MARKUP.holdStrokePx);
                            });
                        } else {
                            const boulderMarkup = normalizePhotoMarkup(markup, 'boulder') || markup;
                            const holds = Array.isArray(boulderMarkup.holds) ? boulderMarkup.holds : [];
                            const linePts = Array.isArray(boulderMarkup.linePoints) ? boulderMarkup.linePoints : [];
                            drawLine(linePts);
                            const r = Math.max(5, Math.round(Math.min(w, h) * 0.018));
                            holds.forEach((p, i) => {
                                drawCircle(p, r, TOPO_MARKUP.holdFill, TOPO_MARKUP.holdStroke, TOPO_MARKUP.holdStrokePx);
                            });
                        }

                        resolve(canvas.toDataURL('image/jpeg', 0.92));
                    } catch (_) {
                        resolve(srcDataUrl);
                    }
                };
                img.onerror = () => resolve(srcDataUrl);
                img.src = srcDataUrl;
            });
        }

        async function buildClimbPhotoExportPackage(photo, climbType, climbName) {
            const src = await resolvePhotoImageDataUrlForExport(photo);
            if (!src) return null;
            const dataUrl = await composeMarkupOnDataUrl(src, photo, climbType);
            const extByMime = {
                'image/jpeg': 'jpg',
                'image/png': 'png',
                'image/webp': 'webp',
                'image/gif': 'gif'
            };
            const mime = String(photo.fileType || '').toLowerCase();
            const baseName = String(climbName || (climbType === 'route' ? 'route' : 'boulder'))
                .toLowerCase()
                .replace(/[^a-z0-9а-яё_-]+/gi, '_')
                .replace(/^_+|_+$/g, '')
                .slice(0, 42) || (climbType === 'route' ? 'route' : 'boulder');
            const pid = String(photo.id || '').trim();
            let outExt = extByMime[mime] || 'jpg';
            if (dataUrl.startsWith('data:image/jpeg')) outExt = 'jpg';
            else if (dataUrl.startsWith('data:image/png')) outExt = 'png';
            else if (dataUrl.startsWith('data:image/webp')) outExt = 'webp';
            else if (dataUrl.startsWith('data:image/gif')) outExt = 'gif';
            else outExt = guessImageExtFromDataUrl(dataUrl);
            const fileName = `${baseName}_${pid || Date.now()}.${outExt}`;
            return { dataUrl, fileName };
        }

        /**
         * Сохранение на устройство: в Telegram Mini App сначала Web Share (часто есть «Сохранить в Фото»),
         * иначе загрузка через blob URL + download (срабатывает при явном жесте пользователя).
         */
        async function triggerClimbPhotoSaveToDevice(dataUrl, fileName, opts = {}) {
            const tryShareFirst = !!opts.tryShareFirstInTelegram
                && document.documentElement.classList.contains('tg-mini-app');
            try {
                const res = await fetch(dataUrl);
                const blob = await res.blob();
                const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
                if (tryShareFirst && navigator.share && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
                    try {
                        await navigator.share({ files: [file], title: fileName });
                        return true;
                    } catch (e) {
                        if (e && e.name === 'AbortError') return false;
                    }
                }
                const objUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = objUrl;
                a.download = fileName;
                a.rel = 'noopener';
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => {
                    try {
                        URL.revokeObjectURL(objUrl);
                    } catch (_) {
                        /* ignore */
                    }
                }, 90000);
                return true;
            } catch (_) {
                return false;
            }
        }

        function downscaleDataUrlForUpload(dataUrl) {
            if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return Promise.resolve(dataUrl);
            return new Promise((resolve) => {
                const img = new Image();
                const done = (out) => resolve(out);
                img.onload = () => {
                    try {
                        const w = img.naturalWidth || img.width;
                        const h = img.naturalHeight || img.height;
                        if (!w || !h) {
                            done(dataUrl);
                            return;
                        }
                        const tooLarge = Math.max(w, h) > QUICK_PHOTO_MAX_EDGE;
                        const tooHeavy = dataUrl.length > QUICK_PHOTO_DATAURL_SOFT_CAP;
                        if (!tooLarge && !tooHeavy) {
                            done(dataUrl);
                            return;
                        }
                        const scale = Math.min(1, QUICK_PHOTO_MAX_EDGE / Math.max(w, h));
                        const tw = Math.max(1, Math.round(w * scale));
                        const th = Math.max(1, Math.round(h * scale));
                        const canvas = document.createElement('canvas');
                        canvas.width = tw;
                        canvas.height = th;
                        const ctx = canvas.getContext('2d');
                        if (!ctx) {
                            done(dataUrl);
                            return;
                        }
                        ctx.drawImage(img, 0, 0, tw, th);
                        done(canvas.toDataURL('image/jpeg', QUICK_PHOTO_JPEG_QUALITY));
                    } catch (_) {
                        done(dataUrl);
                    }
                };
                img.onerror = () => done(dataUrl);
                img.src = dataUrl;
            });
        }

        function getAuthData() {
            const raw = localStorage.getItem(AUTH_STORAGE_KEY);
            if (!raw) return { accessToken: null, currentUser: null };
            try {
                const parsed = JSON.parse(raw);
                return {
                    accessToken: parsed?.accessToken || null,
                    currentUser: parsed?.currentUser || null
                };
            } catch {
                return { accessToken: null, currentUser: null };
            }
        }

        function saveAuthData(data) {
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
        }

        /** Текст ошибки из тела ответа FastAPI (`detail` строка, массив валидации или объект). */
        function formatApiErrorDetail(detail) {
            if (detail == null) return '';
            if (typeof detail === 'string') return detail;
            if (Array.isArray(detail)) {
                return detail
                    .map((item) => {
                        if (typeof item === 'string') return item;
                        if (item && typeof item.msg === 'string') {
                            const loc = Array.isArray(item.loc)
                                ? item.loc.filter((x) => x !== 'body').join('.')
                                : '';
                            return loc ? `${loc}: ${item.msg}` : item.msg;
                        }
                        try {
                            return JSON.stringify(item);
                        } catch {
                            return String(item);
                        }
                    })
                    .filter(Boolean)
                    .join('; ');
            }
            if (typeof detail === 'object' && detail.msg) return String(detail.msg);
            try {
                return JSON.stringify(detail);
            } catch {
                return String(detail);
            }
        }

        /** Проверить API: GET /health с повторами. */
        async function wakeApiServer(options = {}) {
            const attempts = options.attempts ?? API_WAKE_ATTEMPTS;
            const timeoutMs = options.timeoutMs ?? API_WAKE_ATTEMPT_TIMEOUT_MS;
            const pauseMs = options.pauseMs ?? API_WAKE_PAUSE_MS;
            for (let i = 0; i < attempts; i++) {
                try {
                    const ctrl = new AbortController();
                    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
                    const res = await fetch(`${API_BASE_URL}/health`, {
                        method: 'GET',
                        cache: 'no-store',
                        signal: ctrl.signal
                    });
                    clearTimeout(timer);
                    if (res.ok) return true;
                } catch (_) {
                    /* сон / cold start */
                }
                if (i < attempts - 1) {
                    await new Promise((r) => setTimeout(r, pauseMs));
                }
            }
            return false;
        }

        /**
         * Полная подгрузка каталога с API (после пробуждения сервера).
         * initial — первый запуск; иначе debounce и тост при повторном открытии Mini App.
         */
        async function refreshCatalogFromApi(options = {}) {
            const isInitial = options.initial === true;
            const force = options.force === true;
            const now = Date.now();
            if (
                !isInitial &&
                !force &&
                _appRemoteDataReady &&
                now - _lastCatalogReloadFinishedAt < CATALOG_RELOAD_DEBOUNCE_MS
            ) {
                return true;
            }
            if (_catalogReloadPromise) return _catalogReloadPromise;

            _catalogReloadPromise = (async () => {
                try {
                    if (!isInitial && _appRemoteDataReady) {
                        window.app?.showToast?.('Обновление данных…', false);
                    }
                    if (!options.skipWake) {
                        const awake = await wakeApiServer();
                        if (!awake) {
                            throw new Error('Сервер не отвечает');
                        }
                    }
                    if (options.refreshPhotos) {
                        _photosLoadedFromApi = false;
                    }
                    await loadClimbingDataFromApi({ includePhotos: options.includePhotos === true });
                    _appRemoteDataReady = true;
                    _lastCatalogReloadFinishedAt = Date.now();
                    leaveOfflineMode();
                    window.app?.refreshUiAfterRemoteLoad?.();
                    if (options.refreshPhotos) {
                        await ensurePhotosLoadedFromApi();
                        window.app?.renderPhotoAlbum?.();
                    }
                    return true;
                } catch (err) {
                    console.warn('catalog refresh', err);
                    if (catalogHasContent(getClimbingData())) {
                        enterOfflineMode('Не удалось обновить данные. Показана сохранённая копия каталога.');
                        return true;
                    }
                    if (_appRemoteDataReady) {
                        window.app?.showToast?.('Не удалось обновить данные. Проверьте сеть.', true);
                    }
                    throw err;
                } finally {
                    _catalogReloadPromise = null;
                }
            })();
            return _catalogReloadPromise;
        }

        function scheduleCatalogRefreshOnAppVisible() {
            if (!_appRemoteDataReady) return;
            if (typeof navigator.onLine === 'boolean' && !navigator.onLine) return;
            void refreshCatalogFromApi().catch(() => {});
        }

        function setAppDataStatus(mode, message, { showRetry } = {}) {
            const el = document.getElementById('appDataStatus');
            if (!el) return;
            el.classList.remove('hidden', 'app-data-status--loading', 'app-data-status--error', 'app-data-status--offline');
            if (mode === 'hidden') {
                el.classList.add('hidden');
                el.innerHTML = '';
                return;
            }
            if (mode === 'error') el.classList.add('app-data-status--error');
            else if (mode === 'offline') el.classList.add('app-data-status--offline');
            else el.classList.add('app-data-status--loading');
            const retryBtn = showRetry
                ? '<button type="button" class="btn btn-primary btn-small" id="appDataRetryBtn">Повторить загрузку</button>'
                : '';
            el.innerHTML = `${message}${retryBtn}`;
            if (showRetry) {
                document.getElementById('appDataRetryBtn')?.addEventListener('click', () => {
                    void retryAppDataLoad();
                }, { once: true });
            }
        }

        async function retryAppDataLoad() {
            setAppDataStatus('loading', 'Загрузка данных с сервера…');
            try {
                const awake = await wakeApiServer({ attempts: 8 });
                if (!awake) throw new Error('Сервер не отвечает');
                await flushOfflineOutbox();
                await refreshCatalogFromApi({ force: true, skipWake: true });
                leaveOfflineMode();
                if (window.app) {
                    await window.app.restoreAuthSession();
                    if (!getAuthData().accessToken) {
                        await window.app.tryTelegramLogin();
                    }
                }
                void ensurePhotosLoadedFromApi().then(() => {
                    window.app?.renderPhotoAlbum?.();
                }).catch((err) => console.warn('photos prefetch', err));
                setAppDataStatus('hidden');
            } catch (err) {
                console.error('retry data load', err);
                setAppDataStatus(
                    'error',
                    `Не удалось загрузить данные: ${err.message || 'ошибка сети'}.`,
                    { showRetry: true }
                );
                window.app?.showToast?.('Не удалось загрузить данные', true);
            }
        }

        async function runTelegramAuthBootstrap() {
            if (!window.app) return;
            try {
                await window.app.restoreAuthSession();
                if (!getAuthData().accessToken) {
                    const loggedIn = await window.app.tryTelegramLogin();
                    if (!loggedIn && window.isTelegramMiniApp?.()) {
                        console.warn('Telegram login skipped or failed; catalog still available');
                    }
                }
                await window.app.syncLegacyLocalStorageToBackend();
                if (window.app?.isLoggedIn?.()) {
                    window.app.refreshListsAfterRoleChange();
                    void window.app.renderProfileTab?.();
                }
            } catch (err) {
                console.warn('auth bootstrap', err);
            }
        }

        /** Предупреждение, если API на SQLite (данные пропадают после рестарта). */
        async function warnIfApiStorageNotPersistent() {
            try {
                const res = await fetch(`${API_BASE_URL}/health`);
                if (!res.ok) return;
                const body = await res.json();
                if (body && body.persistent_storage === false) {
                    console.warn('API uses non-persistent SQLite; catalog data may be lost after server restart.');
                    window.app?.showToast?.(
                        'Сервер использует временную БД — данные могут пропадать. Нужен PostgreSQL.',
                        true
                    );
                }
            } catch (_) {
                /* ignore */
            }
        }

        /** Подтверждение удаления: в Telegram Mini App window.confirm часто не работает. */
        function confirmDestructive(message) {
            return new Promise((resolve) => {
                const tg = window.Telegram?.WebApp;
                if (tg && typeof tg.showConfirm === 'function') {
                    tg.showConfirm(message, (ok) => resolve(!!ok));
                    return;
                }
                resolve(window.confirm(message));
            });
        }

        async function apiFetchDirect(path, options = {}) {
            const url = `${API_BASE_URL}${path}`;
            const headers = Object.assign({}, options.headers || {});
            const auth = getAuthData();
            if (auth.accessToken) {
                headers.Authorization = `Bearer ${auth.accessToken}`;
            }
            const method = String(options.method || 'GET').toUpperCase();
            const timeoutMs = options.timeoutMs ?? (method === 'GET' ? 20000 : 60000);
            const controller = !options.signal && typeof AbortController !== 'undefined'
                ? new AbortController()
                : null;
            const timeoutId = controller
                ? setTimeout(() => controller.abort(), timeoutMs)
                : null;
            const fetchOptions = Object.assign({}, options, { headers });
            delete fetchOptions.timeoutMs;
            if (controller) fetchOptions.signal = controller.signal;
            let res;
            try {
                res = await fetch(url, fetchOptions);
            } catch (err) {
                if (err?.name === 'AbortError') {
                    throw new Error('Превышено время ожидания сети');
                }
                throw err;
            } finally {
                if (timeoutId) clearTimeout(timeoutId);
            }
            if (!res.ok) {
                let msg = `HTTP ${res.status}`;
                try {
                    const errBody = await res.json();
                    const fromDetail = formatApiErrorDetail(errBody?.detail);
                    msg = (fromDetail && fromDetail.trim()) || errBody?.message || msg;
                } catch {}
                throw new Error(msg);
            }
            if (res.status === 204) return null;
            const text = await res.text();
            return text ? JSON.parse(text) : null;
        }

        async function apiFetch(path, options = {}) {
            const method = String(options.method || 'GET').toUpperCase();
            const isMutation = !['GET', 'HEAD'].includes(method);
            if (isMutation && shouldUseOfflineQueue()) {
                const entry = enqueueOfflineMutation(path, options);
                throw new OfflineQueuedError('Нет сети — действие сохранено и отправится при появлении сети', entry);
            }
            try {
                return await apiFetchDirect(path, options);
            } catch (err) {
                if (isMutation && isFetchNetworkError(err)) {
                    const entry = enqueueOfflineMutation(path, options);
                    throw new OfflineQueuedError('Нет сети — действие сохранено и отправится при появлении сети', entry);
                }
                throw err;
            }
        }

        if (APP_BOULDER_ONLY) {
            document.documentElement.classList.add('app-boulder-only');
        }
        document.querySelectorAll('.tab-btn').forEach((btn) => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach((panel) => panel.classList.remove('active'));
        document.querySelector('.tab-btn[data-tab="catalog"]')?.classList.add('active');
        document.getElementById('catalog')?.classList.add('active');

        // Функции для работы с localStorage
        function migrateLegacyData() {
            const legacyRoutes = JSON.parse(localStorage.getItem('climb_routes') || '[]');
            const legacyBoulders = JSON.parse(localStorage.getItem('climb_boulders') || '[]');
            const legacyPhotos = JSON.parse(localStorage.getItem('climb_photos') || '[]');

            if (legacyRoutes.length === 0 && legacyBoulders.length === 0 && legacyPhotos.length === 0) {
                return null;
            }

            const routeIdMap = new Map();
            const boulderIdMap = new Map();

            const defaultAreaId = 1;
            const defaultSectorId = 1;
            const areas = [{
                id: defaultAreaId,
                name: 'Общий район',
                description: 'Создан при импорте данных',
                latitude: null,
                longitude: null,
                createdAt: new Date().toISOString()
            }];
            const sectors = [{
                id: defaultSectorId,
                areaId: defaultAreaId,
                name: 'Сектор по умолчанию',
                description: '',
                createdAt: new Date().toISOString()
            }];

            const routes = legacyRoutes.map((route, index) => {
                const newId = index + 1;
                routeIdMap.set(String(route.id), newId);
                return {
                    id: newId,
                    areaId: defaultAreaId,
                    sectorId: defaultSectorId,
                    name: route.name || '',
                    description: route.description || '',
                    grade: route.grade || '',
                    length: route.length || '',
                    bolts: route.bolts || '',
                    sector: route.sector || '',
                    latitude: route.latitude || '',
                    longitude: route.longitude || '',
                    createdAt: route.createdAt || new Date().toISOString(),
                    updatedAt: route.updatedAt || new Date().toISOString()
                };
            });

            const boulders = legacyBoulders.map((boulder, index) => {
                const newId = index + 1;
                boulderIdMap.set(String(boulder.id), newId);
                return {
                    id: newId,
                    areaId: defaultAreaId,
                    sectorId: defaultSectorId,
                    name: boulder.name || '',
                    description: boulder.description || '',
                    grade: boulder.grade || '',
                    height: boulder.height || '',
                    latitude: boulder.latitude || '',
                    longitude: boulder.longitude || '',
                    createdAt: boulder.createdAt || new Date().toISOString(),
                    updatedAt: boulder.updatedAt || new Date().toISOString()
                };
            });

            const photos = legacyPhotos.map((photo, index) => {
                const mappedClimbId = photo.type === 'route'
                    ? routeIdMap.get(String(photo.climbId))
                    : boulderIdMap.get(String(photo.climbId));
                return {
                    id: String(index + 1),
                    climbId: String(mappedClimbId || photo.climbId || ''),
                    type: photo.type === 'route' ? 'route' : 'boulder',
                    imageData: photo.imageData || '',
                    description: photo.description || '',
                    fileName: photo.fileName || '',
                    fileType: photo.fileType || '',
                    markup: photo.markup || null,
                    createdAt: photo.createdAt || new Date().toISOString()
                };
            });

            return {
                areas,
                sectors,
                routes,
                boulders,
                photos,
                nextAreaId: 2,
                nextSectorId: 2,
                nextRouteId: routes.length + 1,
                nextBoulderId: boulders.length + 1,
                nextPhotoId: photos.length + 1
            };
        }

        /** Трасса: французская шкала 4 … 9c; буквы a, b, c — строчные; есть ступени с «+». */
        function normalizeRouteGrade(g) {
            if (g == null || g === '') return '';
            const s = String(g).trim();
            const m45 = s.match(/^(4|5)(\+)?$/);
            if (m45) return m45[1] + (m45[2] || '');
            const m = s.match(/^([6-9])([A-Za-z])(\+)?$/);
            if (m) return m[1] + m[2].toLowerCase() + (m[3] || '');
            return s;
        }

        /** Боулдер: только 4 и 5 без букв; с 6 — латинские A, B, C заглавные, у каждой ступени есть вариант с «+»; до 9A+. */
        function normalizeBoulderGrade(g) {
            if (g == null || g === '') return '';
            const s = String(g).trim();
            if (/^[45]$/.test(s)) return s;
            const m = s.match(/^([6-9])([A-Za-z])(\+)?$/);
            if (m) return m[1] + m[2].toUpperCase() + (m[3] || '');
            return s;
        }

        /** Только форма массивов и next*Id — без подмены районов/секторов (KISS). */
        function recomputeCatalogIds(data) {
            const areaIds = (data.areas || []).map((a) => Number(a.id)).filter(Number.isFinite);
            const sectorIds = (data.sectors || []).map((s) => Number(s.id)).filter(Number.isFinite);
            const routeIds = (data.routes || []).map((r) => Number(r.id)).filter(Number.isFinite);
            const boulderIds = (data.boulders || []).map((b) => Number(b.id)).filter(Number.isFinite);
            const photoIds = (data.photos || []).map((p) => Number(p.id)).filter(Number.isFinite);
            data.nextAreaId = areaIds.length ? Math.max(...areaIds) + 1 : 1;
            data.nextSectorId = sectorIds.length ? Math.max(...sectorIds) + 1 : 1;
            data.nextRouteId = routeIds.length ? Math.max(...routeIds) + 1 : 1;
            data.nextBoulderId = boulderIds.length ? Math.max(...boulderIds) + 1 : 1;
            data.nextPhotoId = photoIds.length ? Math.max(...photoIds) + 1 : 1;
            return data;
        }

        function ensureCatalogArrays(data) {
            if (!Array.isArray(data.areas)) data.areas = [];
            if (!Array.isArray(data.sectors)) data.sectors = [];
            if (!Array.isArray(data.routes)) data.routes = [];
            if (!Array.isArray(data.boulders)) data.boulders = [];
            if (!Array.isArray(data.photos)) data.photos = [];
            (data.routes || []).forEach((r) => {
                if (r.grade) r.grade = normalizeRouteGrade(r.grade);
            });
            (data.boulders || []).forEach((b) => {
                if (b.grade) b.grade = normalizeBoulderGrade(b.grade);
            });
            return recomputeCatalogIds(data);
        }

        /**
         * Однократно добавляет район/сектор/проблемы с theCrag (node 6031720431).
         * Источник: https://www.thecrag.com/en/climbing/russia/treugolnoje/area/6031720431
         * Контент theCrag распространяется на условиях CC BY-NC-SA — указание источника обязательно.
         */
        function mergeTreugolnojeTheCrag6031720431(data) {
            if (!data || (data.imports && data.imports.treugolnoje6031720431)) {
                return false;
            }
            const ts = new Date().toISOString();
            const theCragAreaUrl = 'https://www.thecrag.com/en/climbing/russia/treugolnoje/area/6031720431';
            const maxAreaId = Math.max(0, ...(data.areas || []).map(a => Number(a.id) || 0));
            const maxSectorId = Math.max(0, ...(data.sectors || []).map(s => Number(s.id) || 0));
            const maxBoulderId = Math.max(0, ...(data.boulders || []).map(b => Number(b.id) || 0));
            const aid = maxAreaId + 1;
            const sid = maxSectorId + 1;
            let nextBid = maxBoulderId + 1;

            const areaDescription = [
                'Импорт справочных данных с theCrag (область node 6031720431, «Развал под основным массивом», Треугольное озеро). https://www.thecrag.com/',
                '',
                'На theCrag также указаны подобласти Made in America и Seek and destroy.',
                '',
                'Лицензия материалов theCrag: CC BY-NC-SA 3.0 — https://creativecommons.org/licenses/by-nc-sa/3.0/ — сохраняйте атрибуцию при публикации.'
            ].join('\n');

            const sectorDescription = [
                'Доступ (как на theCrag, унаследовано от Triangular lake): зона озера доступна бесплатно, не частная; соседняя территория Lietlahti Eco Park — частная. По описанию на theCrag лазание комфортно с мая по сентябрь включительно.',
                '',
                'Этика: парковочных мест мало; при нехватке — парковка в Lietlahti. Не загораживайте проезд машинами на дороге.',
                '',
                'Координаты для карты (из блока Directions на theCrag): 61.110053, 29.165610.',
                '',
                `Полная страница: ${theCragAreaUrl}`
            ].join('\n');

            const problems = [
                [6031721205, 'Déjà vu', '7C'],
                [6031721673, 'Do or Die', '7A'],
                [6031723425, 'In frames', '8B+'],
                [6031728717, 'Sverhnovaya zvezda', '8A+'],
                [6031740516, 'Эликсир молодости натощак', '8A+'],
                [6031728249, 'SKS direct', '7A'],
                [6031721439, 'Diesel Power', '7A+'],
                [6031732005, 'Золотой дождь', '7B'],
                [6031730481, 'Вертолёт', '7B+'],
                [6031728483, 'Suomen ragazze', '7C'],
                [6031724739, 'Made in America', '7C+'],
                [6031726485, 'Piterskij forsazh', '8B']
            ];

            data.areas.push({
                id: aid,
                name: 'Треугольное озеро',
                description: areaDescription,
                latitude: 61.110053,
                longitude: 29.165610,
                createdAt: ts
            });
            data.sectors.push({
                id: sid,
                areaId: aid,
                name: 'Развал под основным массивом',
                description: sectorDescription,
                createdAt: ts
            });

            const routeBase = 'https://www.thecrag.com/en/climbing/russia/treugolnoje/route/';
            problems.forEach(([rid, name, grade]) => {
                data.boulders.push({
                    id: nextBid++,
                    areaId: aid,
                    sectorId: sid,
                    name,
                    description: `Карточка на theCrag: ${routeBase}${rid}`,
                    grade,
                    height: '',
                    latitude: 61.110053,
                    longitude: 29.165610,
                    createdAt: ts,
                    updatedAt: ts
                });
            });

            data.nextAreaId = Math.max(Number(data.nextAreaId) || 1, aid + 1);
            data.nextSectorId = Math.max(Number(data.nextSectorId) || 1, sid + 1);
            data.nextBoulderId = Math.max(Number(data.nextBoulderId) || 1, nextBid);

            data.imports = Object.assign({}, data.imports || {}, {
                treugolnoje6031720431: { at: ts, theCragAreaUrl, theCragNodeId: 6031720431 }
            });
            saveClimbingData(data);
            return true;
        }

        /**
         * Каталог: кэш в памяти + localStorage для офлайн.
         * Поток step-by-step:
         * 1) API (POST/PATCH/DELETE)
         * 2) merge*FromApiResponse / remove*FromLocalCache (без полной перезагрузки)
         * 3) render* UI
         * Полная загрузка loadClimbingDataFromApi — при старте и при появлении сети.
         */
        function catalogHasContent(data) {
            if (!data) return false;
            return (
                (Array.isArray(data.areas) && data.areas.length > 0) ||
                (Array.isArray(data.sectors) && data.sectors.length > 0) ||
                (Array.isArray(data.routes) && data.routes.length > 0) ||
                (Array.isArray(data.boulders) && data.boulders.length > 0)
            );
        }

        function slimCatalogForStorage(data) {
            const areas = (data.areas || []).map((a) => ({
                ...a,
                imageData: (typeof a.imageData === 'string' && !a.imageData.startsWith('data:'))
                    ? a.imageData
                    : ''
            }));
            const photos = (data.photos || []).map((p) => ({
                ...p,
                imageData: (typeof p.imageData === 'string' && !p.imageData.startsWith('data:'))
                    ? p.imageData
                    : ''
            }));
            return { ...data, areas, photos };
        }

        function persistClimbingDataToStorage(data) {
            if (!data) return;
            clearTimeout(_persistCatalogTimer);
            _persistCatalogTimer = setTimeout(() => {
                const payload = slimCatalogForStorage(data);
                try {
                    localStorage.setItem(CLIMBING_DATA_STORAGE_KEY, JSON.stringify(payload));
                    localStorage.setItem(CLIMBING_OFFLINE_META_KEY, JSON.stringify({
                        savedAt: Date.now(),
                        areas: payload.areas?.length || 0,
                        sectors: payload.sectors?.length || 0,
                        routes: payload.routes?.length || 0,
                        boulders: payload.boulders?.length || 0,
                        photos: payload.photos?.length || 0,
                        photosCached: _photoCacheStats.count || 0
                    }));
                } catch (err) {
                    console.warn('catalog persist (full)', err);
                    try {
                        const slim = slimCatalogForStorage({
                            ...data,
                            photos: (data.photos || []).map((p) => ({ ...p, imageData: '' }))
                        });
                        localStorage.setItem(CLIMBING_DATA_STORAGE_KEY, JSON.stringify(slim));
                    } catch (err2) {
                        console.warn('catalog persist (slim)', err2);
                    }
                }
            }, 350);
        }

        function loadClimbingDataFromStorage() {
            try {
                const raw = localStorage.getItem(CLIMBING_DATA_STORAGE_KEY);
                if (!raw) return null;
                return ensureCatalogArrays(JSON.parse(raw));
            } catch (err) {
                console.warn('catalog load from storage', err);
                return null;
            }
        }

        function getOfflineMeta() {
            try {
                const raw = localStorage.getItem(CLIMBING_OFFLINE_META_KEY);
                return raw ? JSON.parse(raw) : null;
            } catch (_) {
                return null;
            }
        }

        function formatCacheAge(ts) {
            if (!ts) return '';
            const min = Math.round((Date.now() - Number(ts)) / 60000);
            if (min < 1) return 'только что';
            if (min < 60) return `${min} мин назад`;
            const hours = Math.round(min / 60);
            if (hours < 48) return `${hours} ч назад`;
            return new Date(ts).toLocaleDateString('ru-RU');
        }

        function loadOfflineOutbox() {
            try {
                const raw = localStorage.getItem(OFFLINE_OUTBOX_KEY);
                const parsed = raw ? JSON.parse(raw) : [];
                return Array.isArray(parsed) ? parsed : [];
            } catch (_) {
                return [];
            }
        }

        function saveOfflineOutbox(queue) {
            try {
                localStorage.setItem(OFFLINE_OUTBOX_KEY, JSON.stringify(queue.slice(0, OFFLINE_OUTBOX_LIMIT)));
            } catch (err) {
                console.warn('offline outbox persist', err);
            }
        }

        function offlineOutboxSize() {
            return loadOfflineOutbox().length;
        }

        function offlineMutationLabel(path, method) {
            const m = String(method || 'GET').toUpperCase();
            if (path.startsWith('/api/ascents')) return 'пролаз';
            if (path.startsWith('/api/ratings')) return 'оценка';
            if (path.includes('/photos')) return 'фото';
            if (path.includes('/areas')) return m === 'DELETE' ? 'удаление района' : 'район';
            if (path.includes('/sectors')) return m === 'DELETE' ? 'удаление сектора' : 'сектор';
            if (path.includes('/routes')) return m === 'DELETE' ? 'удаление трассы' : 'трасса';
            if (path.includes('/boulders')) return m === 'DELETE' ? 'удаление боулдера' : 'боулдер';
            return 'изменение';
        }

        function enqueueOfflineMutation(path, options = {}) {
            const method = String(options.method || 'GET').toUpperCase();
            const headers = Object.assign({}, options.headers || {});
            const body = typeof options.body === 'string' ? options.body : '';
            const entry = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                createdAt: Date.now(),
                path,
                method,
                headers,
                body,
                label: offlineMutationLabel(path, method)
            };
            const queue = loadOfflineOutbox();
            queue.push(entry);
            saveOfflineOutbox(queue);
            updateOfflineStatusBanner();
            window.app?.showToast?.('Сохранено локально — отправится при появлении сети', false);
            return entry;
        }

        function buildOfflineStatusMessage(baseMessage) {
            const parts = [baseMessage || 'Офлайн — показаны сохранённые данные.'];
            const meta = getOfflineMeta();
            if (meta?.savedAt) {
                parts.push(`Кэш каталога: ${formatCacheAge(meta.savedAt)}.`);
            }
            const pending = offlineOutboxSize();
            if (pending > 0) {
                parts.push(`В очереди на отправку: ${pending}.`);
            }
            const cachedPhotos = _photoCacheStats.count || meta?.photosCached || 0;
            if (cachedPhotos > 0) {
                parts.push(`Фото в локальном кэше: ${cachedPhotos}.`);
            }
            parts.push('При появлении сети данные синхронизируются автоматически.');
            return parts.join(' ');
        }

        function updateOfflineStatusBanner() {
            if (!_offlineMode) return;
            setAppDataStatus('offline', buildOfflineStatusMessage(), { showRetry: true });
        }

        function shouldUseOfflineQueue() {
            return typeof navigator.onLine === 'boolean' && !navigator.onLine;
        }

        function isFetchNetworkError(err) {
            const msg = String(err?.message || err || '');
            return err?.name === 'AbortError'
                || msg.includes('Превышено время ожидания сети')
                || msg.includes('Failed to fetch')
                || msg.includes('Load failed')
                || msg.includes('NetworkError')
                || msg.includes('Сервер не отвечает');
        }

        class OfflineQueuedError extends Error {
            constructor(message, entry) {
                super(message);
                this.name = 'OfflineQueuedError';
                this.queued = true;
                this.entry = entry;
            }
        }

        let _flushOutboxPromise = null;

        async function flushOfflineOutbox() {
            if (_flushOutboxPromise) return _flushOutboxPromise;
            const queue = loadOfflineOutbox();
            if (!queue.length) return { sent: 0, failed: 0 };

            _flushOutboxPromise = (async () => {
                const awake = await wakeApiServer({ attempts: 2, timeoutMs: 4000, pauseMs: 300 });
                if (!awake) return { sent: 0, failed: 0, skipped: true };

                let sent = 0;
                const remaining = [];
                for (let i = 0; i < queue.length; i++) {
                    const entry = queue[i];
                    try {
                        await apiFetchDirect(entry.path, {
                            method: entry.method,
                            headers: entry.headers,
                            body: entry.body || undefined
                        });
                        sent += 1;
                    } catch (err) {
                        if (shouldUseOfflineQueue() || isFetchNetworkError(err)) {
                            remaining.push(...queue.slice(i));
                            break;
                        }
                        const msg = String(err?.message || '');
                        if (msg.includes('HTTP 401') || msg.includes('HTTP 403') || msg.includes('HTTP 500') || msg.includes('HTTP 502') || msg.includes('HTTP 503')) {
                            remaining.push(entry);
                            continue;
                        }
                        console.warn('offline outbox drop', entry, err);
                    }
                }
                saveOfflineOutbox(remaining);
                updateOfflineStatusBanner();
                if (sent > 0) {
                    window.app?.showToast?.(`Синхронизировано: ${sent}`, false);
                    try {
                        await refreshCatalogFromApi({ force: true, skipWake: true });
                        leaveOfflineMode();
                    } catch (err) {
                        console.warn('catalog refresh after outbox flush', err);
                    }
                    if (window.app?.isLoggedIn?.()) {
                        void window.app.loadAscentSummary?.();
                        void window.app.renderProfileTab?.();
                    }
                }
                return { sent, failed: queue.length - sent - remaining.length, remaining: remaining.length };
            })().finally(() => {
                _flushOutboxPromise = null;
            });
            return _flushOutboxPromise;
        }

        function enterOfflineMode(message) {
            _offlineMode = true;
            setAppDataStatus('offline', buildOfflineStatusMessage(message), { showRetry: true });
        }

        function leaveOfflineMode() {
            _offlineMode = false;
            setAppDataStatus('hidden');
        }

        function bootstrapCatalogFromStorage() {
            const cached = loadClimbingDataFromStorage();
            if (!catalogHasContent(cached)) return false;
            climbingDataCache = cached;
            _appRemoteDataReady = true;
            _photosLoadedFromApi = (cached.photos || []).length > 0;
            void refreshPhotoCacheStats();
            return true;
        }

        function registerOfflineServiceWorker() {
            /* Отключено: SW мешал старту в Telegram WebView. Офлайн — через localStorage. */
        }

        let climbingDataCache = {
            areas: [],
            sectors: [],
            routes: [],
            boulders: [],
            photos: [],
            nextAreaId: 1,
            nextSectorId: 1,
            nextRouteId: 1,
            nextBoulderId: 1,
            nextPhotoId: 1
        };

        function mapApiAreaToUi(a) {
            return {
                id: a.id,
                name: a.name,
                description: a.description || '',
                access: a.access || '',
                season: a.season || '',
                parking: a.parking || '',
                approach: a.approach || '',
                warnings: a.warnings || '',
                imageData: a.image_url || '',
                latitude: a.latitude,
                longitude: a.longitude,
                createdAt: a.created_at,
                updatedAt: a.updated_at
            };
        }

        function mapApiSectorToUi(s) {
            return {
                id: s.id,
                areaId: s.area_id,
                name: s.name,
                description: s.description || '',
                access: s.access || '',
                season: s.season || '',
                parking: s.parking || '',
                approach: s.approach || '',
                warnings: s.warnings || '',
                createdAt: s.created_at,
                updatedAt: s.updated_at
            };
        }

        function mapApiRouteToUi(r) {
            return {
                id: r.id,
                areaId: r.area_id,
                sectorId: r.sector_id,
                name: r.name,
                description: r.description || '',
                grade: r.grade || '',
                length: r.length_m ?? '',
                bolts: r.bolts ?? '',
                sector: r.sector_label || '',
                category: r.category || '',
                rating: r.rating ?? null,
                latitude: r.latitude,
                longitude: r.longitude,
                createdAt: r.created_at,
                updatedAt: r.updated_at
            };
        }

        function mapApiBoulderToUi(b) {
            return {
                id: b.id,
                areaId: b.area_id,
                sectorId: b.sector_id,
                name: b.name,
                description: b.description || '',
                grade: b.grade || '',
                category: b.category || '',
                rating: b.rating ?? null,
                height: b.height_m ?? '',
                latitude: b.latitude,
                longitude: b.longitude,
                createdAt: b.created_at,
                updatedAt: b.updated_at
            };
        }

        /** 8a.nu style: mean of 1–3 star votes, one decimal. */
        function formatStarAverage(rating) {
            if (rating == null || rating === '') return '';
            const n = Number(rating);
            if (!Number.isFinite(n)) return String(rating);
            return n.toFixed(1);
        }

        function formatStarAverageLabel(rating, count) {
            const avg = formatStarAverage(rating);
            if (!avg) return '';
            if (count != null && count > 0) return `${avg} ★ (${count})`;
            return `${avg} ★`;
        }

        function patchClimbRatingInLocalCache(climbType, climbId, rating) {
            const data = getClimbingData();
            if (climbType === 'route') {
                const arr = data.routes || [];
                const idx = arr.findIndex((r) => Number(r.id) === Number(climbId));
                if (idx < 0) return;
                data.routes = [...arr.slice(0, idx), { ...arr[idx], rating: rating ?? null }, ...arr.slice(idx + 1)];
            } else {
                const arr = data.boulders || [];
                const idx = arr.findIndex((b) => Number(b.id) === Number(climbId));
                if (idx < 0) return;
                data.boulders = [...arr.slice(0, idx), { ...arr[idx], rating: rating ?? null }, ...arr.slice(idx + 1)];
            }
            saveClimbingData(data);
        }

        function mapApiPhotoToUi(p) {
            return {
                id: String(p.id),
                climbId: String(p.route_id ?? p.boulder_id ?? ''),
                type: p.climb_type,
                climbName: p.climb_name || '',
                climbCategory: p.climb_category || '',
                imageData: p.image_url,
                description: p.description || '',
                fileName: p.file_name || '',
                fileType: p.mime_type || '',
                markup: normalizePhotoMarkup(p.markup, p.climb_type === 'route' ? 'route' : 'boulder'),
                createdAt: p.created_at
            };
        }

        function resolvePhotoDisplayUrl(raw) {
            if (!raw || typeof raw !== 'string') return '';
            const s = raw.trim();
            if (!s) return '';
            if (s.startsWith('data:') || s.startsWith('blob:') || /^https?:\/\//i.test(s)) return s;
            if (s.startsWith('/')) {
                return API_BASE_URL ? `${API_BASE_URL.replace(/\/$/, '')}${s}` : s;
            }
            return s;
        }

        function photoMayHaveImage(photo) {
            if (!photo) return false;
            if (resolvePhotoDisplayUrl(photo.imageData)) return true;
            return !!String(photo.id || '').trim();
        }

        function photoHasDisplayImage(photo) {
            return photoMayHaveImage(photo);
        }

        function loadImageIntoElement(img, photo, onReady) {
            if (!img) {
                if (onReady) onReady();
                return;
            }
            const done = () => {
                if (onReady) onReady();
            };
            void (async () => {
                const src = await resolvePhotoImageSource(photo);
                if (!src) {
                    img.removeAttribute('src');
                    done();
                    return;
                }
                if (photo && src.startsWith('data:')) {
                    photo.imageData = src;
                }
                img.onload = () => {
                    img.onload = null;
                    img.onerror = null;
                    done();
                };
                img.onerror = () => {
                    img.onerror = null;
                    void (async () => {
                        try {
                            const dataUrl = await resolvePhotoImageDataUrlForExport(photo);
                            if (dataUrl) {
                                img.onload = () => {
                                    img.onload = null;
                                    done();
                                };
                                if (img.src) img.removeAttribute('src');
                                img.src = dataUrl;
                                void cachePhotoToIndexedDb({ ...photo, imageData: dataUrl });
                                if (img.complete && img.naturalWidth > 0) done();
                                return;
                            }
                        } catch (_) {
                            /* ignore */
                        }
                        done();
                    })();
                };
                if (img.src) img.removeAttribute('src');
                void img.offsetWidth;
                img.src = src;
                if (img.complete && img.naturalWidth > 0) done();
            })();
        }

        function pickClimbDetailPhoto(photos, preferPhotoId) {
            if (!Array.isArray(photos) || !photos.length) return null;
            const withImage = photos.filter(photoHasDisplayImage);
            if (preferPhotoId) {
                const preferred = withImage.find((p) => String(p.id) === String(preferPhotoId));
                if (preferred) return preferred;
            }
            return withImage.find((p) => p.markup) || withImage[0] || photos[0];
        }

        /** Тап по фото и горизонтальный свайп (touch / pointer). */
        function bindPhotoTapAndSwipe(element, handlers) {
            if (!element || element._photoTapSwipeBound) return;
            element._photoTapSwipeBound = true;
            const threshold = handlers.threshold ?? 48;
            const tapMaxMove = handlers.tapMaxMove ?? 14;
            let startX = 0;
            let startY = 0;
            let tracking = false;
            let moved = false;

            const pointFrom = (e) => {
                const t = e.changedTouches?.[0] || e.touches?.[0] || e;
                return { x: t.clientX, y: t.clientY };
            };

            const onStart = (e) => {
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                const p = pointFrom(e);
                startX = p.x;
                startY = p.y;
                tracking = true;
                moved = false;
            };

            const onMove = (e) => {
                if (!tracking) return;
                const p = pointFrom(e);
                if (Math.abs(p.x - startX) > tapMaxMove || Math.abs(p.y - startY) > tapMaxMove) {
                    moved = true;
                }
            };

            const onEnd = (e) => {
                if (!tracking) return;
                tracking = false;
                const p = pointFrom(e);
                const dx = p.x - startX;
                const dy = p.y - startY;
                if (!moved && Math.abs(dx) <= tapMaxMove && Math.abs(dy) <= tapMaxMove) {
                    handlers.onTap?.();
                    return;
                }
                if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.15) return;
                if (dx < 0) handlers.onSwipeLeft?.();
                else handlers.onSwipeRight?.();
            };

            element.addEventListener('touchstart', onStart, { passive: true });
            element.addEventListener('touchmove', onMove, { passive: true });
            element.addEventListener('touchend', onEnd, { passive: true });
            element.addEventListener('pointerdown', onStart);
            element.addEventListener('pointermove', onMove);
            element.addEventListener('pointerup', onEnd);
            element.addEventListener('pointercancel', () => {
                tracking = false;
            });
        }

        async function fetchPhotosBatched(routes, boulders) {
            const tasks = [];
            if (!APP_BOULDER_ONLY) {
                routes.forEach((r) => {
                    tasks.push(() => apiFetch(`/api/photos/by-route/${r.id}`).catch(() => []));
                });
            }
            boulders.forEach((b) => {
                tasks.push(() => apiFetch(`/api/photos/by-boulder/${b.id}`).catch(() => []));
            });
            const flat = [];
            for (let i = 0; i < tasks.length; i += PHOTO_FETCH_CHUNK) {
                const slice = tasks.slice(i, i + PHOTO_FETCH_CHUNK);
                const part = await Promise.all(slice.map((fn) => fn()));
                flat.push(...part);
            }
            return flat.flat().map(mapApiPhotoToUi);
        }

        async function loadClimbingDataFromApi(options = {}) {
            const includePhotos = options.includePhotos !== false;
            const existingPhotos =
                Array.isArray(climbingDataCache?.photos) ? climbingDataCache.photos.slice() : [];

            const [areasRaw, routesRaw, bouldersRaw] = await Promise.all([
                apiFetch('/api/areas'),
                apiFetch('/api/routes'),
                apiFetch('/api/boulders')
            ]);

            const areas = (areasRaw || []).map(mapApiAreaToUi);
            const areasList = areasRaw || [];
            const sectorsGrouped = [];
            for (let i = 0; i < areasList.length; i += SECTOR_FETCH_BATCH) {
                const chunk = areasList.slice(i, i + SECTOR_FETCH_BATCH);
                const part = await Promise.all(chunk.map((a) => apiFetch(`/api/areas/${a.id}/sectors`)));
                sectorsGrouped.push(...part);
            }
            const sectors = sectorsGrouped.flat().map(mapApiSectorToUi);
            const routes = (routesRaw || []).map(mapApiRouteToUi);
            const boulders = (bouldersRaw || []).map(mapApiBoulderToUi);

            let photos = existingPhotos;
            if (includePhotos) {
                photos = await fetchPhotosBatched(routes, boulders);
                _photosLoadedFromApi = true;
                void cachePhotosToIndexedDb(photos);
            }

            saveClimbingData(ensureCatalogArrays({
                areas,
                sectors,
                routes,
                boulders,
                photos
            }));
            return getClimbingData();
        }

        async function ensurePhotosLoadedFromApi(options = {}) {
            if (_photosLoadedFromApi && !options.force) return;
            const routes = getRoutes();
            const boulders = getBoulders();
            const photos = await fetchPhotosBatched(routes, boulders);
            const data = getClimbingData();
            data.photos = photos;
            data.nextPhotoId = Math.max(1, ...photos.map(p => Number(p.id) || 0)) + 1;
            saveClimbingData(data);
            _photosLoadedFromApi = true;
            void cachePhotosToIndexedDb(photos);
        }

        async function fetchClimbPhotosFromApi(climbType, climbId) {
            const id = Number(climbId);
            if (!Number.isFinite(id)) return [];
            const path = climbType === 'route'
                ? `/api/photos/by-route/${id}`
                : `/api/photos/by-boulder/${id}`;
            const rows = await apiFetch(path).catch(() => []);
            const mapped = (rows || []).map(mapApiPhotoToUi);
            const idStr = String(climbId);
            const data = getClimbingData();
            const rest = (data.photos || []).filter(
                (p) => !(p.type === climbType && String(p.climbId) === idStr)
            );
            data.photos = [...rest, ...mapped];
            recomputeNextPhotoId(data);
            saveClimbingData(data);
            _photosLoadedFromApi = true;
            void cachePhotosToIndexedDb(mapped);
            return mapped;
        }

        async function ensureClimbPhotosForDetail(climbType, climbId) {
            await ensurePhotosLoadedFromApi();
            const idStr = String(climbId);
            let photos = getPhotos().filter(
                (p) => p.type === climbType && String(p.climbId) === idStr
            );
            if (!photos.some(photoMayHaveImage)) {
                try {
                    photos = await fetchClimbPhotosFromApi(climbType, climbId);
                } catch (err) {
                    console.warn('climb photos fetch', err);
                }
            }
            await hydratePhotosFromIndexedDb(photos);
            return photos;
        }

        /** Геометрия видимой области фото (object-fit: contain) — всегда по naturalWidth/Height. */
        function getMarkupStageGeometry(container) {
            const img = container?.querySelector('img');
            const cw = Math.max(1, container?.clientWidth || container?.offsetWidth || 1);
            const ch = Math.max(1, container?.clientHeight || container?.offsetHeight || 1);
            const base = { cw, ch, left: 0, top: 0, iw: cw, ih: ch, ready: false };
            if (!img || !img.naturalWidth || !img.naturalHeight) {
                return base;
            }
            const scale = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
            const iw = img.naturalWidth * scale;
            const ih = img.naturalHeight * scale;
            return {
                cw,
                ch,
                left: (cw - iw) / 2,
                top: (ch - ih) / 2,
                iw,
                ih,
                ready: iw >= 8 && ih >= 8
            };
        }

        function isMarkupStageReady(geom) {
            return !!(geom && geom.ready && geom.iw >= 8 && geom.ih >= 8);
        }

        function normalizePhotoMarkup(raw, climbType) {
            if (raw == null || raw === '') return null;
            let m = raw;
            if (typeof m === 'string') {
                try {
                    m = JSON.parse(m);
                } catch (_) {
                    return null;
                }
            }
            if (!m || typeof m !== 'object') return null;

            const normPoint = (p) => {
                const x = Number(p?.x);
                const y = Number(p?.y);
                if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
                return { x, y };
            };

            if (climbType === 'route') {
                const points = Array.isArray(m.points) ? m.points : (Array.isArray(m.linePoints) ? m.linePoints : []);
                const startHolds = Array.isArray(m.startHolds)
                    ? m.startHolds
                    : (Array.isArray(m.starts) ? m.starts : []);
                const pts = points.map(normPoint).filter(Boolean);
                const starts = startHolds.map(normPoint).filter(Boolean);
                if (!pts.length && !starts.length) return null;
                return {
                    type: 'route-line',
                    coordSpace: m.coordSpace === 'image' ? 'image' : (m.coordSpace || 'image'),
                    points: pts,
                    startHolds: starts,
                    savedAt: m.savedAt
                };
            }

            if (climbType === 'boulder') {
                const holds = Array.isArray(m.holds) ? m.holds : [];
                const linePoints = Array.isArray(m.linePoints)
                    ? m.linePoints
                    : (Array.isArray(m.points) ? m.points : []);
                const h = holds.map(normPoint).filter(Boolean);
                const lp = linePoints.map(normPoint).filter(Boolean);
                if (!h.length && lp.length < 2) return null;
                return {
                    type: 'boulder-holds',
                    coordSpace: m.coordSpace === 'image' ? 'image' : (m.coordSpace || 'image'),
                    holds: h,
                    linePoints: lp,
                    savedAt: m.savedAt
                };
            }

            return null;
        }

        function markupPxFromNorm(nx, ny, geom) {
            return {
                x: geom.left + nx * geom.iw,
                y: geom.top + ny * geom.ih
            };
        }

        function markupNormFromClient(container, clientX, clientY) {
            const rect = container.getBoundingClientRect();
            const geom = getMarkupStageGeometry(container);
            const localX = clientX - rect.left;
            const localY = clientY - rect.top;
            const ix = localX - geom.left;
            const iy = localY - geom.top;
            const x = Math.max(0, Math.min(1, ix / geom.iw));
            const y = Math.max(0, Math.min(1, iy / geom.ih));
            const px = markupPxFromNorm(x, y, geom);
            return { x, y, px: px.x, py: px.y, geom };
        }

        /** Минимальный шаг при рисовании линии (норм. координаты фото). */
        const MARKUP_DRAW_MIN_DIST = 0.006;
        /** Тап vs проведение пальцем/мышью (px). */
        const MARKUP_TAP_MAX_MOVE_PX = 14;

        /** Общий стиль топо-разметки: тонкая линия, пронумерованные стартовые кружки. */
        const TOPO_MARKUP = {
            holdDiameterPx: 28,
            holdRadiusPx: 14,
            holdStrokePx: 2,
            holdFill: 'rgba(255, 255, 255, 0.84)',
            holdStroke: '#d32f2f',
            holdNumberColor: '#c62828',
            lineStrokePx: 2,
            lineColor: '#d32f2f',
            hitRadiusPx: 16,
            linePointDiameterPx: 8
        };
        const BOULDER_MARKUP = TOPO_MARKUP;

        function topoHoldRadiusNorm(geom) {
            const iw = geom?.iw > 0 ? geom.iw : 400;
            return Math.min(TOPO_MARKUP.holdRadiusPx / iw, 0.08);
        }

        function topoStrokeNorm(geom, px) {
            const iw = geom?.iw > 0 ? geom.iw : 400;
            return px / iw;
        }

        function appendTopoLineSvg(svg, NS, linePts, geom) {
            if (!isMarkupStageReady(geom)) return;
            if (!linePts || linePts.length < 2) return;
            const pairs = linePts
                .map((p) => {
                    const x = Number(p.x);
                    const y = Number(p.y);
                    if (Number.isFinite(x) && Number.isFinite(y)) {
                        return `${Math.max(0, Math.min(1, x))},${Math.max(0, Math.min(1, y))}`;
                    }
                    return null;
                })
                .filter(Boolean);
            if (pairs.length < 2) return;
            const pl = document.createElementNS(NS, 'polyline');
            pl.setAttribute('points', pairs.join(' '));
            pl.setAttribute('fill', 'none');
            pl.setAttribute('stroke', TOPO_MARKUP.lineColor);
            pl.setAttribute('stroke-width', String(topoStrokeNorm(geom, TOPO_MARKUP.lineStrokePx)));
            pl.setAttribute('stroke-linecap', 'round');
            pl.setAttribute('stroke-linejoin', 'round');
            svg.appendChild(pl);
        }

        function appendTopoHoldSvg(svg, NS, hold, index, geom) {
            if (!isMarkupStageReady(geom)) return;
            const nx = Math.max(0, Math.min(1, Number(hold.x)));
            const ny = Math.max(0, Math.min(1, Number(hold.y)));
            if (!Number.isFinite(nx) || !Number.isFinite(ny)) return;
            const r = topoHoldRadiusNorm(geom);
            const sw = topoStrokeNorm(geom, TOPO_MARKUP.holdStrokePx);
            const c = document.createElementNS(NS, 'circle');
            c.setAttribute('cx', String(nx));
            c.setAttribute('cy', String(ny));
            c.setAttribute('r', String(r));
            c.setAttribute('fill', TOPO_MARKUP.holdFill);
            c.setAttribute('stroke', TOPO_MARKUP.holdStroke);
            c.setAttribute('stroke-width', String(sw));
            svg.appendChild(c);

            const label = document.createElementNS(NS, 'text');
            label.setAttribute('x', String(nx));
            label.setAttribute('y', String(ny));
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('dominant-baseline', 'central');
            label.setAttribute('fill', TOPO_MARKUP.holdNumberColor);
            label.setAttribute('font-size', String(topoStrokeNorm(geom, TOPO_MARKUP.holdRadiusPx * 0.88)));
            label.setAttribute('font-weight', '700');
            label.setAttribute('font-family', 'system-ui, -apple-system, Segoe UI, sans-serif');
            label.setAttribute('pointer-events', 'none');
            label.textContent = String(index + 1);
            svg.appendChild(label);
        }

        const appendBoulderLineSvg = appendTopoLineSvg;
        const appendBoulderHoldSvg = appendTopoHoldSvg;
        const boulderHoldRadiusNorm = topoHoldRadiusNorm;

        function appendMarkupLinePoint(points, x, y, force = false) {
            if (!Array.isArray(points)) return false;
            if (!force && points.length) {
                const last = points[points.length - 1];
                if (Math.hypot(last.x - x, last.y - y) < MARKUP_DRAW_MIN_DIST) {
                    return false;
                }
            }
            points.push({
                id: Date.now() + Math.floor(Math.random() * 1000),
                x,
                y
            });
            return true;
        }

        /** Старые точки (0–1 по контейнеру) → 0–1 по видимой области фото. */
        function boulderStoredToImageNorm(stored, geom, coordSpaceImage) {
            let x = Number(stored?.x);
            let y = Number(stored?.y);
            if (!Number.isFinite(x) || !Number.isFinite(y)) {
                return { x: 0.5, y: 0.5 };
            }
            if (coordSpaceImage) {
                return {
                    x: Math.max(0, Math.min(1, x)),
                    y: Math.max(0, Math.min(1, y))
                };
            }
            if (x > 1 || y > 1) {
                x /= geom.cw;
                y /= geom.ch;
            }
            const px = x * geom.cw;
            const py = y * geom.ch;
            return {
                x: Math.max(0, Math.min(1, (px - geom.left) / geom.iw)),
                y: Math.max(0, Math.min(1, (py - geom.top) / geom.ih))
            };
        }

        function getClimbingData() {
            return climbingDataCache;
        }

        function saveClimbingData(data) {
            climbingDataCache = data;
            persistClimbingDataToStorage(data);
        }

        function getRoutes() {
            return getClimbingData().routes;
        }

        function getBoulders() {
            return getClimbingData().boulders;
        }

        function getPhotos() {
            return getClimbingData().photos;
        }

        function saveRoutes(routes) {
            const data = getClimbingData();
            data.routes = routes;
            saveClimbingData(data);
        }

        function saveBoulders(boulders) {
            const data = getClimbingData();
            data.boulders = boulders;
            saveClimbingData(data);
        }

        function savePhotos(photos) {
            const data = getClimbingData();
            data.photos = photos;
            saveClimbingData(data);
        }

        function recomputeNextPhotoId(data) {
            const ids = (data.photos || []).map((p) => Number(p.id)).filter(Number.isFinite);
            data.nextPhotoId = ids.length ? Math.max(...ids) + 1 : 1;
        }

        function appendPhotoFromApiResponse(apiPhoto) {
            const data = getClimbingData();
            const ui = mapApiPhotoToUi(apiPhoto);
            data.photos = [...(data.photos || []), ui];
            recomputeNextPhotoId(data);
            saveClimbingData(data);
            _photosLoadedFromApi = true;
        }

        function mergeAreaFromApiResponse(apiArea) {
            const ui = mapApiAreaToUi(apiArea);
            const data = getClimbingData();
            const idx = data.areas.findIndex((a) => Number(a.id) === Number(ui.id));
            if (idx >= 0) {
                data.areas[idx] = ui;
            } else {
                data.areas.push(ui);
            }
            recomputeCatalogIds(data);
            saveClimbingData(data);
            return ui;
        }

        function mergeSectorFromApiResponse(apiSector) {
            const ui = mapApiSectorToUi(apiSector);
            const data = getClimbingData();
            const idx = data.sectors.findIndex((s) => Number(s.id) === Number(ui.id));
            if (idx >= 0) {
                data.sectors[idx] = ui;
            } else {
                data.sectors.push(ui);
            }
            recomputeCatalogIds(data);
            saveClimbingData(data);
            return ui;
        }

        function removeAreaFromLocalCache(areaId) {
            const aid = Number(areaId);
            const data = getClimbingData();
            const sectorIds = new Set(
                (data.sectors || [])
                    .filter((s) => Number(s.areaId) === aid)
                    .map((s) => Number(s.id))
            );
            data.areas = (data.areas || []).filter((a) => Number(a.id) !== aid);
            data.sectors = (data.sectors || []).filter((s) => Number(s.areaId) !== aid);
            data.routes = (data.routes || []).filter(
                (r) => Number(r.areaId) !== aid && !sectorIds.has(Number(r.sectorId))
            );
            data.boulders = (data.boulders || []).filter(
                (b) => Number(b.areaId) !== aid && !sectorIds.has(Number(b.sectorId))
            );
            data.photos = (data.photos || []).filter((p) => {
                const cid = Number(p.climbId);
                if (p.type === 'route') {
                    return data.routes.some((r) => Number(r.id) === cid);
                }
                return data.boulders.some((b) => Number(b.id) === cid);
            });
            recomputeCatalogIds(data);
            saveClimbingData(data);
        }

        function removeSectorFromLocalCache(sectorId) {
            const sid = Number(sectorId);
            const data = getClimbingData();
            data.sectors = (data.sectors || []).filter((s) => Number(s.id) !== sid);
            data.routes = (data.routes || []).filter((r) => Number(r.sectorId) !== sid);
            data.boulders = (data.boulders || []).filter((b) => Number(b.sectorId) !== sid);
            data.photos = (data.photos || []).filter((p) => {
                const cid = Number(p.climbId);
                if (p.type === 'route') {
                    return data.routes.some((r) => Number(r.id) === cid);
                }
                return data.boulders.some((b) => Number(b.id) === cid);
            });
            recomputeCatalogIds(data);
            saveClimbingData(data);
        }

        function mergeRouteFromApiResponse(apiRoute) {
            const ui = mapApiRouteToUi(apiRoute);
            const data = getClimbingData();
            const arr = data.routes || [];
            const idx = arr.findIndex((r) => Number(r.id) === Number(ui.id));
            if (idx >= 0) {
                data.routes = [...arr.slice(0, idx), ui, ...arr.slice(idx + 1)];
            } else {
                data.routes = [...arr, ui];
            }
            recomputeCatalogIds(data);
            saveClimbingData(data);
        }

        function mergeBoulderFromApiResponse(apiBoulder) {
            const ui = mapApiBoulderToUi(apiBoulder);
            const data = getClimbingData();
            const arr = data.boulders || [];
            const idx = arr.findIndex((b) => Number(b.id) === Number(ui.id));
            if (idx >= 0) {
                data.boulders = [...arr.slice(0, idx), ui, ...arr.slice(idx + 1)];
            } else {
                data.boulders = [...arr, ui];
            }
            recomputeCatalogIds(data);
            saveClimbingData(data);
        }

        function removeRouteFromLocalCache(routeId) {
            const id = Number(routeId);
            const data = getClimbingData();
            data.routes = (data.routes || []).filter((r) => Number(r.id) !== id);
            data.photos = (data.photos || []).filter(
                (p) => !(String(p.type) === 'route' && String(p.climbId) === String(id))
            );
            recomputeNextPhotoId(data);
            recomputeCatalogIds(data);
            saveClimbingData(data);
        }

        function removeBoulderFromLocalCache(boulderId) {
            const id = Number(boulderId);
            const data = getClimbingData();
            data.boulders = (data.boulders || []).filter((b) => Number(b.id) !== id);
            data.photos = (data.photos || []).filter(
                (p) => !(String(p.type) === 'boulder' && String(p.climbId) === String(id))
            );
            recomputeNextPhotoId(data);
            recomputeCatalogIds(data);
            saveClimbingData(data);
        }

        function removePhotoFromLocalCache(photoId) {
            const pid = String(photoId);
            const data = getClimbingData();
            data.photos = (data.photos || []).filter((p) => String(p.id) !== pid);
            recomputeNextPhotoId(data);
            saveClimbingData(data);
            _photosLoadedFromApi = true;
        }

        function patchPhotoInLocalCacheFromApi(apiPhoto) {
            const ui = mapApiPhotoToUi(apiPhoto);
            const data = getClimbingData();
            const idx = data.photos.findIndex((p) => String(p.id) === String(ui.id));
            if (idx >= 0) {
                data.photos[idx] = ui;
                recomputeNextPhotoId(data);
                saveClimbingData(data);
            }
        }

        function getAreas() {
            return getClimbingData().areas || [];
        }

        function getSectors() {
            return getClimbingData().sectors || [];
        }

        function saveAreas(areas) {
            const data = getClimbingData();
            data.areas = areas;
            saveClimbingData(data);
        }

        function saveSectors(sectors) {
            const data = getClimbingData();
            data.sectors = sectors;
            saveClimbingData(data);
        }

        class ClimbingApp {
            constructor() {
                this.data = getClimbingData();
                this.auth = getAuthData();
                /** Форма входа админа — только после 4 тапов по логотипу в этой вкладке. */
                this._adminFormUnlocked = false;
                this._climbDetailImgGen = 0;
                this._climbViewerImgGen = 0;
                this._photoGallery = null;
                this._photoAlbumNavList = [];
                this.map = null;
                this.mapLayers = [];
                this.mapMarkerIndex = new Map();
                this.mapFilter = 'all';
                this.mapCatalogScope = null;
                this.mapTarget = null;
                this.userLocation = null;
                this.userLocationMarker = null;
                this.mapNavigationLine = null;
                this._geoWatchId = null;
                this.areaPhotoData = null;
                this.areaPhotoRemove = false;
                this.currentPhotoPreview = null;
                this.quickRoutePhotoData = null;
                this.quickBoulderPhotoData = null;

                this.routeMarkupMode = 'line';
                this.boulderMarkupMode = 'circles';

                this.currentRouteLineMarkup = {
                    points: [],
                    startHolds: [],
                    photoId: null,
                    climbId: null
                };

                this.currentBoulderHoldsMarkup = {
                    holds: [],
                    linePoints: [],
                    photoId: null,
                    climbId: null
                };

                this.routeLineCanvas = null;
                this.routeLineCtx = null;

                this._routeLineMarkupAbort = null;
                this._boulderHoldsMarkupAbort = null;
                this._routeSearchDebounceTimer = null;
                this._boulderSearchDebounceTimer = null;
                this._globalSearchDebounceTimer = null;
                this.updatesFilter = 'all';
                this._boulderHoldDrag = null;
                this._onBoulderHoldPointerMove = this.onBoulderHoldPointerMove.bind(this);
                this._onBoulderHoldPointerUp = this.onBoulderHoldPointerUp.bind(this);
                document.addEventListener('pointermove', this._onBoulderHoldPointerMove);
                document.addEventListener('pointerup', this._onBoulderHoldPointerUp);
                document.addEventListener('pointercancel', this._onBoulderHoldPointerUp);

                this.catalog = { view: 'areas', areaId: null, sectorId: null };

                /** Просмотр разметки без редактирования (гость / пользователь). */
                this._markupDialogViewOnly = false;
                this._climbDetailContext = null;
                this._ascentSummary = null;
                this._climbCommunityStats = null;

                this.init();
            }

            onBoulderHoldPointerMove(e) {
                const drag = this._boulderHoldDrag;
                if (!drag || e.pointerId !== drag.pointerId) return;

                const container = document.getElementById('boulderHoldsMarkupContainer');
                if (!container) return;

                const { x, y, px, py } = markupNormFromClient(container, e.clientX, e.clientY);
                drag.marker.style.left = `${px}px`;
                drag.marker.style.top = `${py}px`;

                const holds = this.currentBoulderHoldsMarkup?.holds;
                if (holds && holds[drag.index]) {
                    holds[drag.index].x = x;
                    holds[drag.index].y = y;
                }

                this.updateBoulderHoldsPolyline();
            }

            onBoulderHoldPointerUp(e) {
                const drag = this._boulderHoldDrag;
                if (!drag || (e && e.pointerId !== drag.pointerId)) return;
                try {
                    drag.marker.releasePointerCapture(drag.pointerId);
                } catch (_) {
                    /* ignore */
                }
                drag.marker.classList.remove('active');
                this._boulderHoldDrag = null;
            }

            init() {
                this.data = getClimbingData();
                this.setupHiddenAdminAccess();
                this.renderAuthUI();
                this.fillSectorSelects();
                if (!APP_BOULDER_ONLY) {
                    this.renderRoutes();
                }
                this.renderBoulders();
                this.renderPhotoAlbum();
                this.renderCatalog();
                this.setupEventListeners();
                this.setupCommunityListeners();
                this.setupTabSwitching();
                this.applyRoleUI();
            }

            /** После фоновой загрузки с API — обновить списки и карту (не блокирует первый показ UI). */
            refreshUiAfterRemoteLoad() {
                this.data = getClimbingData();
                this.fillSectorSelects();
                if (!APP_BOULDER_ONLY) {
                    this.renderRoutes();
                }
                this.renderBoulders();
                this.renderPhotoAlbum();
                this.renderCatalog();
                if (document.getElementById('updates')?.classList.contains('active')) {
                    this.renderUpdatesTab();
                }
                this.applyRoleUI();
                if (this.isLoggedIn()) {
                    void this.refreshProfileLogbookSection();
                }
                if (this.map) {
                    this.updateMapMarkers();
                }
            }

            getCurrentUser() {
                const auth = getAuthData();
                return auth.currentUser || null;
            }

            isAdmin() {
                const user = this.getCurrentUser();
                if (!user) return false;
                const em = String(user.email || '').toLowerCase();
                return em === String(ADMIN_EMAIL_HINT).toLowerCase();
            }

            /** Показ полей логина/пароля только после 4 тапов по логотипу. */
            isAdminPasswordFormUnlocked() {
                return this._adminFormUnlocked === true;
            }

            clearAdminLoginFields() {
                const userInput = document.getElementById('loginUsername');
                const pwd = document.getElementById('loginPassword');
                if (userInput) userInput.value = '';
                if (pwd) pwd.value = '';
            }

            logoutAdminSession(message = 'Режим администратора выключен') {
                this._adminFormUnlocked = false;
                saveAuthData({ accessToken: null, currentUser: null });
                this.auth = getAuthData();
                this._ascentSummary = null;
                this.clearAdminLoginFields();
                this.renderAuthUI();
                this.applyRoleUI();
                this.refreshListsAfterRoleChange();
                this.showToast(message);
            }

            async exitAdminAndRestoreUserMode() {
                this.logoutAdminSession('Выход из админа');
                if (window.isTelegramMiniApp?.() && window.__TG_INIT_DATA) {
                    const ok = await this.tryTelegramLogin();
                    if (ok) {
                        this.showToast('Вход как пользователь Telegram');
                    }
                }
            }

            openAdminPasswordForm() {
                if (this.isLoggedIn() && !this.isAdmin()) {
                    saveAuthData({ accessToken: null, currentUser: null });
                    this.auth = getAuthData();
                    this._ascentSummary = null;
                }
                this._adminFormUnlocked = true;
                const userInput = document.getElementById('loginUsername');
                if (userInput && !userInput.value.trim()) {
                    userInput.value = 'admin';
                }
                this.renderAuthUI();
                this.showToast('Вход администратора: логин admin');
                setTimeout(() => userInput?.focus(), 0);
            }

            closeAdminPasswordForm() {
                this._adminFormUnlocked = false;
                this.clearAdminLoginFields();
                this.renderAuthUI();
                this.showToast('Форма входа администратора скрыта');
            }

            setupHiddenAdminAccess() {
                const logo = document.querySelector('.site-logo');
                if (!logo) return;
                const TAPS_OPEN_ADMIN = 4;
                const TAPS_EXIT_ADMIN = 2;
                const TAP_WINDOW_MS = 4000;
                let clicks = 0;
                let lastClickTs = 0;
                const onLogoTap = (e) => {
                    e.preventDefault();
                    const now = Date.now();
                    if (now - lastClickTs > TAP_WINDOW_MS) clicks = 0;
                    lastClickTs = now;
                    clicks += 1;

                    if (this.isAdmin()) {
                        if (clicks < TAPS_EXIT_ADMIN) return;
                        clicks = 0;
                        void this.exitAdminAndRestoreUserMode();
                        return;
                    }

                    if (clicks < TAPS_OPEN_ADMIN) return;
                    clicks = 0;

                    if (this._adminFormUnlocked) {
                        this.closeAdminPasswordForm();
                        return;
                    }
                    this.openAdminPasswordForm();
                };
                logo.addEventListener('click', onLogoTap);
            }

            formatAdminLoginError(loginRes, errBody) {
                const detail = formatApiErrorDetail(errBody?.detail);
                if (loginRes.status === 403) {
                    return detail || 'Вход разрешён только для учётной записи администратора';
                }
                if (loginRes.status === 401) {
                    return 'Неверный логин или пароль. Логин и пароль: admin.';
                }
                return detail || `Ошибка входа (HTTP ${loginRes.status})`;
            }

            async restoreAuthSession() {
                const auth = getAuthData();
                if (!auth.accessToken) return;
                try {
                    const me = await apiFetch('/api/auth/me');
                    auth.currentUser = me;
                    saveAuthData(auth);
                    this.auth = auth;
                    this.renderAuthUI();
                    this.applyRoleUI();
                    await this.loadAscentSummary();
                    this.refreshListsAfterRoleChange();
                } catch {
                    saveAuthData({ accessToken: null, currentUser: null });
                    this.auth = getAuthData();
                    this._ascentSummary = null;
                    this.renderAuthUI();
                    this.applyRoleUI();
                    this.refreshListsAfterRoleChange();
                }
            }

            isLoggedIn() {
                return !!(getAuthData().accessToken && getAuthData().currentUser);
            }

            isTelegramUser() {
                const em = String(this.getCurrentUser()?.email || '').toLowerCase();
                return em.endsWith('@telegram.local');
            }

            async tryTelegramLogin() {
                if (!window.isTelegramMiniApp?.() || !window.__TG_INIT_DATA) return false;
                if (getAuthData().accessToken) return false;
                try {
                    const tokenData = await apiFetch('/api/auth/telegram', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ init_data: window.__TG_INIT_DATA })
                    });
                    const auth = {
                        accessToken: tokenData.access_token,
                        currentUser: tokenData.user || null
                    };
                    if (!auth.currentUser) {
                        saveAuthData(auth);
                        auth.currentUser = await apiFetch('/api/auth/me');
                    }
                    saveAuthData(auth);
                    this.auth = auth;
                    this.renderAuthUI();
                    this.applyRoleUI();
                    await this.loadAscentSummary();
                    this.refreshListsAfterRoleChange();
                    return true;
                } catch (err) {
                    console.warn('telegram login', err);
                    return false;
                }
            }

            async loadAscentSummary() {
                if (!this.isLoggedIn()) {
                    this._ascentSummary = null;
                    return null;
                }
                try {
                    this._ascentSummary = await apiFetch('/api/me/ascents/summary');
                    return this._ascentSummary;
                } catch (err) {
                    console.warn('ascent summary', err);
                    this._ascentSummary = null;
                    return null;
                }
            }

            hasUserSent(climbType, climbId) {
                const s = this._ascentSummary;
                if (!s) return false;
                const id = Number(climbId);
                if (climbType === 'route') return (s.sent_route_ids || []).includes(id);
                return (s.sent_boulder_ids || []).includes(id);
            }

            climbSentRowAttrs(climbType, climbId) {
                if (!this.hasUserSent(climbType, climbId)) return { className: '', badge: '' };
                return {
                    className: ' is-sent',
                    badge: '<span class="climb-sent-check" title="Пролазано"><i class="fas fa-check"></i></span>'
                };
            }

            renderAuthUI() {
                this.auth = getAuthData();
                const user = this.isAdmin() ? this.getCurrentUser() : null;
                const authPanel = document.getElementById('authPanel');
                const adminBlock = document.getElementById('adminPasswordLoginBlock');
                const usernameInput = document.getElementById('loginUsername');
                const passwordInput = document.getElementById('loginPassword');
                const loginBtn = document.getElementById('loginBtn');
                const logoutBtn = document.getElementById('logoutBtn');
                const status = document.getElementById('authStatus');
                if (!usernameInput || !passwordInput || !loginBtn || !logoutBtn || !status) return;

                const showAdminForm = !user && this.isAdminPasswordFormUnlocked();

                const profileBtn = document.getElementById('openProfileBtn');
                if (user) {
                    adminBlock?.classList.remove('is-visible');
                    adminBlock?.setAttribute('aria-hidden', 'true');
                    status.style.display = 'inline-flex';
                    const isAdmin = this.isAdmin();
                    const badgeClass = isAdmin ? 'admin' : 'user';
                    const icon = isAdmin ? 'fa-user-shield' : 'fa-user';
                    status.innerHTML = `<span class="role-badge ${badgeClass}"><i class="fas ${icon}"></i> ${this.escapeHtml(user.display_name || user.email || 'Пользователь')}</span>`;
                    logoutBtn.style.display = 'inline-flex';
                    if (profileBtn) profileBtn.style.display = this.isTelegramUser() ? 'inline-flex' : 'none';
                    authPanel?.classList.add('auth-panel--visible');
                } else {
                    if (profileBtn) profileBtn.style.display = 'none';
                    if (showAdminForm) {
                        adminBlock?.classList.add('is-visible');
                        adminBlock?.setAttribute('aria-hidden', 'false');
                        authPanel?.classList.add('auth-panel--visible');
                    } else {
                        adminBlock?.classList.remove('is-visible');
                        adminBlock?.setAttribute('aria-hidden', 'true');
                        authPanel?.classList.remove('auth-panel--visible');
                    }
                    status.style.display = 'none';
                    status.innerHTML = '';
                    logoutBtn.style.display = 'none';
                }
            }

            setupAuthEventListeners() {
                document.getElementById('loginBtn')?.addEventListener('click', async () => {
                    const username = (document.getElementById('loginUsername')?.value || '').trim().toLowerCase();
                    const password = document.getElementById('loginPassword')?.value || '';
                    if (!username || !password) {
                        this.showToast('Введите логин и пароль', true);
                        return;
                    }
                    const loginBtn = document.getElementById('loginBtn');
                    if (loginBtn) loginBtn.disabled = true;
                    try {
                        const formBody = new URLSearchParams({ username, password }).toString();
                        const loginRes = await fetch(`${API_BASE_URL}/api/auth/login`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                            body: formBody
                        });
                        let errBody = null;
                        if (!loginRes.ok) {
                            try {
                                errBody = await loginRes.json();
                            } catch (_) {
                                /* ignore */
                            }
                            throw new Error(this.formatAdminLoginError(loginRes, errBody));
                        }
                        const tokenData = await loginRes.json();
                        let me = tokenData.user || null;
                        if (!me) {
                            const authProbe = { accessToken: tokenData.access_token, currentUser: null };
                            saveAuthData(authProbe);
                            me = await apiFetch('/api/auth/me');
                        }
                        const adminEmail = String(ADMIN_EMAIL_HINT).toLowerCase();
                        if (String(me?.email || '').toLowerCase() !== adminEmail) {
                            throw new Error('Вошли не как администратор. Используйте логин admin или email администратора.');
                        }
                        const auth = { accessToken: tokenData.access_token, currentUser: me };
                        saveAuthData(auth);
                        this.auth = auth;
                        this._adminFormUnlocked = false;
                        this.clearAdminLoginFields();
                        this.renderAuthUI();
                        this.applyRoleUI();
                        await this.loadAscentSummary();
                        this.refreshListsAfterRoleChange();
                        this.showToast(`Вход выполнен: ${me.display_name || me.email}`);
                    } catch (err) {
                        const msg = err?.message || '';
                        if (!msg || msg === 'Failed to fetch' || msg.includes('NetworkError')) {
                            this.showToast('Нет связи с сервером. Закройте Mini App и откройте снова через /start.', true);
                        } else {
                            this.showToast(msg || 'Ошибка входа', true);
                        }
                    } finally {
                        if (loginBtn) loginBtn.disabled = false;
                    }
                });

                document.getElementById('logoutBtn')?.addEventListener('click', () => {
                    void this.exitAdminAndRestoreUserMode();
                });

                document.getElementById('loginPassword')?.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        document.getElementById('loginBtn')?.click();
                    }
                });
            }

            requireAdmin(actionLabel = 'Это действие') {
                if (this.isAdmin()) return true;
                this.showToast(`${actionLabel} доступно только администратору`, true);
                return false;
            }

            /** Перенос старых трас/боулдеров из localStorage в API (один раз, только админ). */
            async syncLegacyLocalStorageToBackend() {
                if (!this.isAdmin()) return;
                const legacyRoutes = JSON.parse(localStorage.getItem('climb_routes') || '[]');
                const legacyBoulders = JSON.parse(localStorage.getItem('climb_boulders') || '[]');
                if (!legacyRoutes.length && !legacyBoulders.length) return;

                const defaultAreaName = 'Общий район (импорт)';
                const defaultSectorName = 'Сектор по умолчанию';

                try {
                    let areas = await apiFetch('/api/areas');
                    let area = (areas || []).find((a) => a.name === defaultAreaName);
                    if (!area) {
                        area = await apiFetch('/api/areas', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                name: defaultAreaName,
                                description: 'Создан при переносе из localStorage'
                            })
                        });
                    }

                    let sectors = await apiFetch(`/api/areas/${area.id}/sectors`);
                    let sector = (sectors || []).find((s) => s.name === defaultSectorName);
                    if (!sector) {
                        sector = await apiFetch(`/api/areas/${area.id}/sectors`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name: defaultSectorName, description: '' })
                        });
                    }

                    let imported = 0;
                    for (const r of legacyRoutes) {
                        const name = (r.name || '').trim();
                        if (!name) continue;
                        await apiFetch('/api/routes', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                sector_id: sector.id,
                                area_id: area.id,
                                name,
                                description: (r.description || '').trim() || null,
                                grade: normalizeRouteGrade((r.grade || '').trim() || '6a'),
                                length_m: r.length ? Number(r.length) : null,
                                bolts: r.bolts ? Number(r.bolts) : null,
                                sector_label: (r.sector || defaultSectorName).trim() || defaultSectorName,
                                latitude: r.latitude ? Number(r.latitude) : null,
                                longitude: r.longitude ? Number(r.longitude) : null
                            })
                        });
                        imported += 1;
                    }

                    for (const b of legacyBoulders) {
                        const name = (b.name || '').trim();
                        if (!name) continue;
                        await apiFetch('/api/boulders', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                sector_id: sector.id,
                                area_id: area.id,
                                name,
                                description: (b.description || '').trim() || null,
                                grade: normalizeBoulderGrade((b.grade || '').trim() || '7A'),
                                height_m: b.height ? Number(b.height) : null,
                                latitude: b.latitude ? Number(b.latitude) : null,
                                longitude: b.longitude ? Number(b.longitude) : null
                            })
                        });
                        imported += 1;
                    }

                    localStorage.removeItem('climb_routes');
                    localStorage.removeItem('climb_boulders');
                    localStorage.removeItem('climb_photos');

                    await loadClimbingDataFromApi({ includePhotos: false });
                    await ensurePhotosLoadedFromApi();
                    this.data = getClimbingData();
                    this.refreshUiAfterRemoteLoad();
                    this.showToast(`Перенесено на сервер: ${imported} записей`);
                } catch (err) {
                    console.error('legacy sync', err);
                    this.showToast(`Не удалось перенести старые данные: ${err.message}`, true);
                }
            }

            applyRoleUI() {
                const adminMode = this.isAdmin();
                const loggedIn = this.isLoggedIn();
                document.querySelectorAll('.admin-only').forEach(el => {
                    if (adminMode) el.classList.remove('hidden-by-role');
                    else el.classList.add('hidden-by-role');
                });
                const showSentFilter = loggedIn && this.isTelegramUser();
                document.getElementById('hideSentRoutesWrap')?.style.setProperty('display', showSentFilter ? '' : 'none');
                document.getElementById('hideSentBouldersWrap')?.style.setProperty('display', showSentFilter ? '' : 'none');
                document.getElementById('profileTabBtn')?.classList.toggle('hidden-by-role', !loggedIn);
            }

            /**
             * После смены роли (вход/выход): обновить списки без блокировки UI.
             * Альбом с data URL перерисовываем только на вкладке «Фото» и после кадра отрисовки —
             * иначе десятки base64-картинок в одном синхронном проходе дают длинный фриз.
             */
            refreshListsAfterRoleChange() {
                this.renderCatalog();
                if (!APP_BOULDER_ONLY) {
                    this.renderRoutes();
                }
                this.renderBoulders();
                const activeTab = document.querySelector('.tab-content.active')?.id || '';
                if (activeTab !== 'photos') {
                    return;
                }
                const run = () => this.renderPhotoAlbum();
                if (typeof requestAnimationFrame === 'function') {
                    requestAnimationFrame(() => requestAnimationFrame(run));
                } else {
                    setTimeout(run, 0);
                }
            }

            setStarRating(targetId, value) {
                const hidden = document.getElementById(targetId);
                if (!hidden) return;
                const normalized = value ? String(Math.max(1, Math.min(3, Number(value)))) : '';
                hidden.value = normalized;
                const wrap = document.querySelector(`.star-rating[data-rating-target="${targetId}"]`);
                if (!wrap) return;
                wrap.querySelectorAll('.star-btn').forEach(btn => {
                    const v = Number(btn.dataset.value || 0);
                    btn.classList.toggle('active', normalized !== '' && v <= Number(normalized));
                });
            }

            _gradeChipToneByValue(v) {
                const s = String(v || '').trim();
                if (!s) return 'all';
                const m = s.match(/^(\d+)/);
                const n = m ? Number(m[1]) : NaN;
                if (!Number.isFinite(n)) return 'all';
                if (n <= 5) return 'easy';
                if (n <= 7) return 'mid';
                return 'hard';
            }

            _buildVisualGradeFilter(selectId, stripId, toggleId, panelId, onSelect) {
                const select = document.getElementById(selectId);
                const strip = document.getElementById(stripId);
                const toggle = document.getElementById(toggleId);
                const panel = document.getElementById(panelId);
                const picker = toggle ? toggle.closest('.grade-picker') : null;
                if (!select || !strip || !toggle || !panel || !picker) return;

                const options = Array.from(select.options || []);
                strip.innerHTML = '';
                options.forEach((opt, idx) => {
                    const value = String(opt.value || '');
                    const label = idx === 0 ? 'Категория' : String(opt.textContent || value || '—');
                    const chip = document.createElement('button');
                    chip.type = 'button';
                    chip.className = `grade-chip grade-chip--${this._gradeChipToneByValue(value)}`;
                    chip.dataset.value = value;
                    chip.textContent = label;
                    chip.setAttribute('aria-pressed', 'false');
                    chip.addEventListener('click', () => {
                        select.value = value;
                        this._syncVisualGradeFilter(strip, value, toggle, select);
                        this._setGradePickerOpen(picker, toggle, false);
                        onSelect();
                    });
                    strip.appendChild(chip);
                });

                this._syncVisualGradeFilter(strip, String(select.value || ''), toggle, select);

                toggle.addEventListener('click', (e) => {
                    e.preventDefault();
                    const open = picker.classList.contains('open');
                    this._closeAllGradePickers();
                    this._setGradePickerOpen(picker, toggle, !open);
                });
            }

            _syncVisualGradeFilter(strip, selectedValue, toggle, selectEl) {
                strip.querySelectorAll('.grade-chip').forEach((chip) => {
                    const active = String(chip.dataset.value || '') === String(selectedValue || '');
                    chip.classList.toggle('active', active);
                    chip.setAttribute('aria-pressed', active ? 'true' : 'false');
                });
                if (toggle && selectEl) {
                    const current = Array.from(selectEl.options || []).find((o) => String(o.value || '') === String(selectedValue || ''));
                    toggle.textContent = current ? String(current.textContent || '').trim() || 'Категория' : 'Категория';
                }
            }

            _setGradePickerOpen(picker, toggle, open) {
                if (!picker || !toggle) return;
                picker.classList.toggle('open', !!open);
                toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            }

            _closeAllGradePickers() {
                document.querySelectorAll('.grade-picker.open').forEach((picker) => {
                    const t = picker.querySelector('.grade-picker-toggle');
                    if (t) this._setGradePickerOpen(picker, t, false);
                });
            }

            initVisualGradeFilters() {
                this._buildVisualGradeFilter(
                    'routeGradeFilter',
                    'routeGradeVisualStrip',
                    'routeGradeToggleBtn',
                    'routeGradeDropdown',
                    () => this.renderRoutes()
                );
                this._buildVisualGradeFilter(
                    'boulderGradeFilter',
                    'boulderGradeVisualStrip',
                    'boulderGradeToggleBtn',
                    'boulderGradeDropdown',
                    () => this.renderBoulders()
                );
            }

            parseCoordinates(rawValue) {
                const raw = String(rawValue || '').trim();
                if (!raw) return { latitude: null, longitude: null };
                const parts = raw.split(',').map(s => s.trim());
                if (parts.length !== 2) return null;
                const lat = Number(parts[0]);
                const lon = Number(parts[1]);
                if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
                return { latitude: lat, longitude: lon };
            }

            _setQuickSaveLoading(kind, busy) {
                const ids = kind === 'route' ? ['saveQuickRouteBtn'] : ['saveQuickBoulderBtn'];
                ids.forEach((id) => {
                    const btn = document.getElementById(id);
                    if (!btn) return;
                    if (busy) {
                        if (!btn.dataset._saveOrigHtml) btn.dataset._saveOrigHtml = btn.innerHTML;
                        btn.disabled = true;
                        btn.innerHTML = 'Сохранение…';
                    } else {
                        btn.disabled = false;
                        if (btn.dataset._saveOrigHtml) {
                            btn.innerHTML = btn.dataset._saveOrigHtml;
                            delete btn.dataset._saveOrigHtml;
                        }
                    }
                });
                if (typeof window.setTelegramMainButtonLoading === 'function') {
                    window.setTelegramMainButtonLoading(busy);
                }
                if (typeof window.syncTelegramWebAppButtons === 'function') {
                    const dlg = kind === 'route' ? 'quickRouteDialog' : 'quickBoulderDialog';
                    window.syncTelegramWebAppButtons(dlg);
                }
            }

            async tryAutoSaveOpenedMediaToDevice(photo, climbType, climbName) {
                if (!photo || !photo.imageData || typeof photo.imageData !== 'string') return;
                const pid = String(photo.id || '').trim();
                const key = pid ? `${climbType}:photo:${pid}` : `${climbType}:climb:${String(photo.climbId || '')}:open`;
                if (!key || wasMediaAutoSaved(key)) return;
                try {
                    const pkg = await buildClimbPhotoExportPackage(photo, climbType, climbName);
                    if (!pkg) return;
                    const ok = await triggerClimbPhotoSaveToDevice(pkg.dataUrl, pkg.fileName, {
                        tryShareFirstInTelegram: false
                    });
                    if (ok) markMediaAutoSaved(key);
                } catch (_) {
                    /* WebView может блокировать загрузку без жеста — есть кнопка «Сохранить фото». */
                }
            }

            /** Явное сохранение из карточки трассы/боулдера (жест пользователя): share или загрузка файла. */
            async saveClimbDetailPhotoFromUserGesture() {
                const ctx = this._climbDetailContext;
                if (!ctx) {
                    this.showToast('Фото для сохранения не найдено', true);
                    return;
                }
                const photos = getPhotos().filter(
                    (p) => p.type === ctx.climbType && String(p.climbId) === String(ctx.climbId)
                );
                const photo = (ctx.shownPhotoId && photos.find((p) => String(p.id) === String(ctx.shownPhotoId)))
                    || photos[0];
                if (!photo || !photo.imageData) {
                    this.showToast('Фото для сохранения не найдено', true);
                    return;
                }
                const btn = document.getElementById('climbDetailSavePhotoBtn');
                if (btn) {
                    btn.disabled = true;
                    if (!btn.dataset._saveOrigHtml) btn.dataset._saveOrigHtml = btn.innerHTML;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Готовим файл…';
                }
                if (typeof window.setTelegramWebAppButtonsBusy === 'function') {
                    window.setTelegramWebAppButtonsBusy(true);
                }
                try {
                    const pkg = await buildClimbPhotoExportPackage(photo, ctx.climbType, ctx.climbName || '');
                    if (!pkg) {
                        this.showToast(
                            'Не удалось скачать снимок для сборки файла (сеть или CORS). Попробуйте долгое нажатие на фото выше.',
                            true
                        );
                        return;
                    }
                    const ok = await triggerClimbPhotoSaveToDevice(pkg.dataUrl, pkg.fileName, {
                        tryShareFirstInTelegram: true
                    });
                    if (ok) {
                        this.showToast('Готово: «Фото», загрузки или пункт в «Поделиться»');
                    } else {
                        this.showToast('Сохранение отменено. Нажмите кнопку ещё раз или используйте долгое нажатие на фото.', false);
                    }
                } catch (e) {
                    this.showToast(`Ошибка: ${e && e.message ? e.message : 'не удалось сохранить'}`, true);
                } finally {
                    if (btn) {
                        btn.disabled = false;
                        if (btn.dataset._saveOrigHtml) {
                            btn.innerHTML = btn.dataset._saveOrigHtml;
                            delete btn.dataset._saveOrigHtml;
                        }
                    }
                    if (typeof window.setTelegramWebAppButtonsBusy === 'function') {
                        window.setTelegramWebAppButtonsBusy(false);
                    }
                }
            }

            clearQuickDialogPhoto(kind) {
                const isRoute = kind === 'route';
                if (isRoute) {
                    this.quickRoutePhotoData = null;
                    const input = document.getElementById('quickRoutePhoto');
                    if (input) input.value = '';
                    const box = document.getElementById('quickRoutePhotoPreview');
                    if (box) box.innerHTML = '';
                    const actions = document.getElementById('quickRoutePhotoActions');
                    if (actions) actions.style.display = 'none';
                } else {
                    this.quickBoulderPhotoData = null;
                    const input = document.getElementById('quickBoulderPhoto');
                    if (input) input.value = '';
                    const box = document.getElementById('quickBoulderPhotoPreview');
                    if (box) box.innerHTML = '';
                    const actions = document.getElementById('quickBoulderPhotoActions');
                    if (actions) actions.style.display = 'none';
                }
            }

            clearAreaDialogPhoto({ markRemove = true } = {}) {
                this.areaPhotoData = null;
                this.areaPhotoRemove = !!markRemove;
                const input = document.getElementById('areaPhoto');
                if (input) input.value = '';
                const box = document.getElementById('areaPhotoPreview');
                if (box) {
                    box.classList.add('hidden');
                    box.innerHTML = '';
                }
                const actions = document.getElementById('areaPhotoActions');
                if (actions) actions.style.display = 'none';
            }

            renderAreaDialogPhotoPreview(src) {
                const box = document.getElementById('areaPhotoPreview');
                const actions = document.getElementById('areaPhotoActions');
                if (!box || !actions || !src) {
                    if (box) {
                        box.classList.add('hidden');
                        box.innerHTML = '';
                    }
                    if (actions) actions.style.display = 'none';
                    return;
                }
                box.classList.remove('hidden');
                box.innerHTML = `
                    <img src="${this.escapeHtml(src)}" alt="Картинка района">
                    <span>Обложка района</span>
                `;
                actions.style.display = 'flex';
            }

            async onAreaPhotoSelected(event) {
                const file = event?.target?.files?.[0];
                if (!file) return;
                if (!String(file.type || '').startsWith('image/')) {
                    this.showToast('Выберите файл изображения', true);
                    this.clearAreaDialogPhoto();
                    return;
                }
                if (file.size > MAX_PHOTO_SIZE_BYTES) {
                    this.showToast(`Размер файла не должен превышать ${MAX_PHOTO_SIZE_MB}MB`, true);
                    this.clearAreaDialogPhoto();
                    return;
                }
                try {
                    const dataUrl = await this.fileToDataUrl(file);
                    const scaled = await downscaleDataUrlForUpload(dataUrl);
                    const mime = scaled.startsWith('data:image/jpeg') ? 'image/jpeg' : (file.type || '');
                    this.areaPhotoData = {
                        data: scaled,
                        fileName: file.name || '',
                        type: mime
                    };
                    this.areaPhotoRemove = false;
                    this.renderAreaDialogPhotoPreview(scaled);
                } catch (err) {
                    this.showToast(`Ошибка чтения файла: ${err.message}`, true);
                    this.clearAreaDialogPhoto();
                }
            }

            renderQuickDialogPhotoPreview(kind) {
                const isRoute = kind === 'route';
                const data = isRoute ? this.quickRoutePhotoData : this.quickBoulderPhotoData;
                const box = document.getElementById(isRoute ? 'quickRoutePhotoPreview' : 'quickBoulderPhotoPreview');
                const actions = document.getElementById(isRoute ? 'quickRoutePhotoActions' : 'quickBoulderPhotoActions');
                if (!box || !actions) return;
                box.innerHTML = '';
                if (!data) {
                    actions.style.display = 'none';
                    return;
                }
                const item = document.createElement('div');
                item.className = 'photo-preview-with-markup';
                item.dataset.climbType = isRoute ? 'route' : 'boulder';
                item.dataset.photoId = isRoute ? 'temp-quick-route' : 'temp-quick-boulder';
                const img = document.createElement('img');
                img.alt = 'Preview';
                const applyOverlay = () => {
                    this.schedulePhotoMarkupOverlay(
                        item,
                        data.markup,
                        isRoute ? 'route' : 'boulder'
                    );
                };
                img.onload = () => {
                    img.onload = null;
                    applyOverlay();
                };
                img.src = data.data;
                item.appendChild(img);
                box.appendChild(item);
                if (img.complete && img.naturalWidth > 0) {
                    applyOverlay();
                }
                actions.style.display = 'flex';
            }

            async onQuickDialogPhotoSelected(kind, event) {
                const file = event?.target?.files?.[0];
                if (!file) return;
                if (!String(file.type || '').startsWith('image/')) {
                    this.showToast('Выберите файл изображения', true);
                    this.clearQuickDialogPhoto(kind);
                    return;
                }
                if (file.size > MAX_PHOTO_SIZE_BYTES) {
                    this.showToast(`Размер файла не должен превышать ${MAX_PHOTO_SIZE_MB}MB`, true);
                    this.clearQuickDialogPhoto(kind);
                    return;
                }
                try {
                    const dataUrl = await this.fileToDataUrl(file);
                    const scaled = await downscaleDataUrlForUpload(dataUrl);
                    const mime = scaled.startsWith('data:image/jpeg') ? 'image/jpeg' : (file.type || '');
                    let fileName = file.name || '';
                    if (mime === 'image/jpeg' && /\.png$/i.test(fileName)) {
                        fileName = fileName.replace(/\.png$/i, '.jpg');
                    }
                    const payload = {
                        data: scaled,
                        fileName,
                        type: mime,
                        markup: null
                    };
                    if (kind === 'route') this.quickRoutePhotoData = payload;
                    else this.quickBoulderPhotoData = payload;
                    this.renderQuickDialogPhotoPreview(kind);
                } catch (err) {
                    this.showToast(`Ошибка чтения файла: ${err.message}`, true);
                    this.clearQuickDialogPhoto(kind);
                }
            }

            openQuickDialogPhotoMarkup(kind) {
                const isRoute = kind === 'route';
                const data = isRoute ? this.quickRoutePhotoData : this.quickBoulderPhotoData;
                if (!data) {
                    this.showToast('Сначала прикрепите фото', true);
                    return;
                }
                this.currentPhotoPreview = {
                    data: data.data,
                    fileName: data.fileName,
                    type: data.type,
                    climbType: isRoute ? 'route' : 'boulder',
                    climbId: isRoute ? 'temp-quick-route' : 'temp-quick-boulder',
                    previewBoxId: isRoute ? 'quickRoutePhotoPreview' : 'quickBoulderPhotoPreview',
                    markup: data.markup || null
                };
                if (isRoute) this.showRouteLineMarkupDialog(this.currentPhotoPreview);
                else this.showBoulderHoldsMarkupDialog(this.currentPhotoPreview);
            }

            async fileToDataUrl(file) {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
                    reader.onload = () => resolve(reader.result);
                    reader.readAsDataURL(file);
                });
            }

            escapeHtml(value) {
                return String(value ?? '')
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
            }

            initMap() {
                const mapContainer = document.getElementById('mapContainer');
                if (!mapContainer || this.map) return;

                this.map = L.map('mapContainer', {
                    attributionControl: false
                }).setView([55.7558, 37.6173], 5);
                L.tileLayer('https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
                    subdomains: ['0', '1', '2', '3'],
                    attribution: '',
                    maxZoom: 21
                }).addTo(this.map);

                this.updateMapMarkers();
                this.updateMapNavigationLine();
                requestAnimationFrame(() => this.map.invalidateSize({ animate: false }));
                setTimeout(() => this.map.invalidateSize({ animate: false }), 120);
            }

            /** Вкладка с display:none даёт контейнеру 0×0 — пересчитать размер после показа */
            syncMapAfterTabShow() {
                if (!this.map) return;
                const m = this.map;
                const fix = () => m.invalidateSize({ animate: false });
                requestAnimationFrame(fix);
                setTimeout(fix, 100);
                setTimeout(() => {
                    fix();
                    this.updateMapMarkers();
                }, 280);
            }

            validMapCoord(lat, lng) {
                const la = Number(lat);
                const ln = Number(lng);
                return Number.isFinite(la) && Number.isFinite(ln) && Math.abs(la) <= 90 && Math.abs(ln) <= 180
                    ? { lat: la, lng: ln }
                    : null;
            }

            mapKey(kind, id) {
                return `${kind}:${String(id)}`;
            }

            mapLayerVisible(kind) {
                if (this.mapFilter === 'all') return true;
                if (this.mapFilter === 'areas') return kind === 'area';
                if (this.mapFilter === 'sectors') return kind === 'sector';
                if (this.mapFilter === 'routes') return kind === 'route';
                if (this.mapFilter === 'boulders') return kind === 'boulder';
                return true;
            }

            guideSnippetForMapEntry(entry) {
                const source = entry.guideSource;
                if (!source) return '';
                const fields = [
                    ['warnings', 'Важно'],
                    ['approach', 'Подход'],
                    ['parking', 'Парковка'],
                    ['season', 'Сезон'],
                    ['access', 'Доступ']
                ];
                return fields
                    .map(([key, label]) => {
                        const value = String(source[key] || '').trim();
                        if (!value) return '';
                        const short = value.length > 120 ? `${value.slice(0, 117).trim()}…` : value;
                        return `<div class="map-popup-guide-row"><strong>${label}:</strong> ${this.escapeHtml(short)}</div>`;
                    })
                    .filter(Boolean)
                    .slice(0, 2)
                    .join('');
            }

            buildMapPopupHtml(entry) {
                const meta = entry.meta ? `<div class="map-popup-meta">${this.escapeHtml(entry.meta)}</div>` : '';
                const guide = this.guideSnippetForMapEntry(entry);
                const guideBlock = guide ? `<div class="map-popup-guide">${guide}</div>` : '';
                const detailButton = entry.climbType
                    ? `<button type="button" class="btn btn-small btn-primary" onclick="event.preventDefault(); window.app?.handleMapPopupAction?.('open','${entry.climbType}', '${this.escapeHtml(entry.id)}'); return false;">Открыть</button>`
                    : '';
                const catalogButton = entry.catalog
                    ? `<button type="button" class="btn btn-small btn-ghost" onclick="event.preventDefault(); window.app?.handleMapPopupAction?.('catalog','${entry.kind}', '${this.escapeHtml(entry.id)}'); return false;">В каталог</button>`
                    : '';
                const guideButton = entry.kind === 'area' || entry.kind === 'sector'
                    ? `<button type="button" class="btn btn-small btn-primary" onclick="event.preventDefault(); window.app?.handleMapPopupAction?.('guide','${entry.kind}', '${this.escapeHtml(entry.id)}'); return false;">Guide</button>`
                    : '';
                return `
                    <div class="map-popup">
                        <strong>${this.escapeHtml(entry.title)}</strong>
                        ${meta}
                        ${guideBlock}
                        <div class="map-popup-actions">
                            ${detailButton}
                            ${guideButton}
                            ${catalogButton}
                            <button type="button" class="btn btn-small btn-secondary" onclick="event.preventDefault(); window.app?.handleMapPopupAction?.('target','${entry.kind}', '${this.escapeHtml(entry.id)}'); return false;">К точке</button>
                            <button type="button" class="btn btn-small btn-ghost" onclick="event.preventDefault(); window.app?.handleMapPopupAction?.('external','${entry.kind}', '${this.escapeHtml(entry.id)}'); return false;">Навигатор</button>
                        </div>
                    </div>
                `;
            }

            sectorMapCoordinate(sectorId) {
                const points = [];
                if (!APP_BOULDER_ONLY) {
                    getRoutes().forEach((r) => {
                        if (Number(r.sectorId) !== Number(sectorId)) return;
                        const c = this.validMapCoord(r.latitude, r.longitude);
                        if (c) points.push(c);
                    });
                }
                getBoulders().forEach((b) => {
                    if (Number(b.sectorId) !== Number(sectorId)) return;
                    const c = this.validMapCoord(b.latitude, b.longitude);
                    if (c) points.push(c);
                });
                if (!points.length) return null;
                return {
                    lat: points.reduce((sum, p) => sum + p.lat, 0) / points.length,
                    lng: points.reduce((sum, p) => sum + p.lng, 0) / points.length
                };
            }

            areaMapCoordinate(areaId) {
                const area = getAreas().find((a) => Number(a.id) === Number(areaId));
                const explicit = this.validMapCoord(area?.latitude, area?.longitude);
                if (explicit) return explicit;
                const points = getSectors()
                    .filter((s) => Number(s.areaId) === Number(areaId))
                    .map((s) => this.sectorMapCoordinate(s.id))
                    .filter(Boolean);
                if (!points.length) return null;
                return {
                    lat: points.reduce((sum, p) => sum + p.lat, 0) / points.length,
                    lng: points.reduce((sum, p) => sum + p.lng, 0) / points.length
                };
            }

            addMapEntry(entry) {
                if (!this.map || !this.mapLayerVisible(entry.kind)) return;
                const coord = this.validMapCoord(entry.lat, entry.lng);
                if (!coord) return;
                const styles = {
                    area: { radius: 13, fillColor: '#2aabee', color: '#ffffff', weight: 2, opacity: 1, fillOpacity: 0.88 },
                    sector: { radius: 11, fillColor: '#8e6cff', color: '#ffffff', weight: 2, opacity: 1, fillOpacity: 0.88 },
                    route: { radius: 8, fillColor: '#2cb5a9', color: '#ffffff', weight: 2, opacity: 1, fillOpacity: 0.9 },
                    boulder: { radius: 8, fillColor: '#ff5757', color: '#ffffff', weight: 2, opacity: 1, fillOpacity: 0.9 }
                };
                const marker = L.circleMarker([coord.lat, coord.lng], styles[entry.kind] || styles.route)
                    .addTo(this.map)
                    .bindPopup(this.buildMapPopupHtml(entry));
                const item = { ...entry, lat: coord.lat, lng: coord.lng, marker };
                marker.on('click', () => this.setMapTarget(item));
                this.mapLayers.push(marker);
                this.mapMarkerIndex.set(this.mapKey(entry.kind, entry.id), item);
            }

            mapEntryInScope(entry) {
                if (!this.mapCatalogScope) return true;
                const { areaId, sectorId } = this.mapCatalogScope;
                if (sectorId != null) return Number(entry.sectorId) === Number(sectorId) || (entry.kind === 'sector' && Number(entry.id) === Number(sectorId));
                if (areaId != null) return Number(entry.areaId) === Number(areaId) || (entry.kind === 'area' && Number(entry.id) === Number(areaId));
                return true;
            }

            buildMapEntries() {
                const entries = [];
                getAreas().forEach((area) => {
                    const c = this.areaMapCoordinate(area.id);
                    if (!c) return;
                    const sectorsCount = getSectors().filter((s) => Number(s.areaId) === Number(area.id)).length;
                    entries.push({
                        kind: 'area',
                        id: area.id,
                        title: area.name,
                        meta: `${sectorsCount} секторов`,
                        lat: c.lat,
                        lng: c.lng,
                        catalog: true,
                        areaId: area.id,
                        guideSource: area
                    });
                });

                getSectors().forEach((sector) => {
                    const c = this.sectorMapCoordinate(sector.id);
                    if (!c) return;
                    const area = getAreas().find((a) => Number(a.id) === Number(sector.areaId));
                    const routesCount = getRoutes().filter((r) => Number(r.sectorId) === Number(sector.id)).length;
                    const bouldersCount = getBoulders().filter((b) => Number(b.sectorId) === Number(sector.id)).length;
                    entries.push({
                        kind: 'sector',
                        id: sector.id,
                        title: sector.name,
                        meta: `${area?.name || 'Район'} · ${routesCount} трасс · ${bouldersCount} боулдеров`,
                        lat: c.lat,
                        lng: c.lng,
                        catalog: true,
                        areaId: sector.areaId,
                        sectorId: sector.id,
                        guideSource: sector
                    });
                });

                if (!APP_BOULDER_ONLY) {
                    getRoutes().forEach((route) => {
                        const c = this.validMapCoord(route.latitude, route.longitude);
                        if (!c) return;
                        entries.push({
                            kind: 'route',
                            climbType: 'route',
                            id: route.id,
                            title: route.name,
                            meta: `${this.getStructureLabel(route.sectorId) || 'Каталог'} · ${route.grade || '—'}`,
                            lat: c.lat,
                            lng: c.lng,
                            catalog: true,
                            areaId: route.areaId,
                            sectorId: route.sectorId
                        });
                    });
                }

                getBoulders().forEach((boulder) => {
                    const c = this.validMapCoord(boulder.latitude, boulder.longitude);
                    if (!c) return;
                    entries.push({
                        kind: 'boulder',
                        climbType: 'boulder',
                        id: boulder.id,
                        title: boulder.name,
                        meta: `${this.getStructureLabel(boulder.sectorId) || 'Каталог'} · ${boulder.grade || '—'}`,
                        lat: c.lat,
                        lng: c.lng,
                        catalog: true,
                        areaId: boulder.areaId,
                        sectorId: boulder.sectorId
                    });
                });
                return entries.filter((entry) => this.mapEntryInScope(entry));
            }

            updateMapMarkers() {
                if (!this.map) return;
                this.data = getClimbingData();
                this.mapLayers.forEach((layer) => this.map.removeLayer(layer));
                this.mapLayers = [];
                this.mapMarkerIndex = new Map();

                const entries = this.buildMapEntries();
                entries.forEach((entry) => this.addMapEntry(entry));
                this.updateMapNavigationLine();
                this.renderMapContextBar();
                this.renderMapGuideStrip();
                this.updateMapStatus();

                if (!this._mapFitDone && this.mapLayers.length) {
                    const bounds = L.latLngBounds(this.mapLayers.map((layer) => layer.getLatLng()));
                    this.map.fitBounds(bounds.pad(0.2), { maxZoom: 14, animate: false });
                    this._mapFitDone = true;
                }
            }

            syncMapFilterButtons() {
                document.querySelectorAll('[data-map-filter]').forEach((btn) => {
                    btn.classList.toggle('active', btn.getAttribute('data-map-filter') === this.mapFilter);
                });
            }

            setMapFilter(filter) {
                this.mapFilter = ['all', 'areas', 'sectors', 'routes', 'boulders'].includes(filter) ? filter : 'all';
                this.syncMapFilterButtons();
                this.updateMapMarkers();
            }

            fitMapToVisibleMarkers(maxZoom = 15) {
                if (!this.map || !this.mapLayers.length) return;
                const bounds = L.latLngBounds(this.mapLayers.map((layer) => layer.getLatLng()));
                this.map.fitBounds(bounds.pad(0.22), { maxZoom, animate: true });
            }

            setMapScopeForEntry(kind, id) {
                const normalizedKind = kind === 'routes' ? 'route'
                    : kind === 'boulders' ? 'boulder'
                    : kind;
                if (normalizedKind === 'area') {
                    this.mapCatalogScope = { areaId: Number(id), sectorId: null };
                    return;
                }
                if (normalizedKind === 'sector') {
                    const sector = getSectors().find((s) => Number(s.id) === Number(id));
                    this.mapCatalogScope = sector ? { areaId: Number(sector.areaId), sectorId: Number(sector.id) } : null;
                    return;
                }
                const climb = normalizedKind === 'route'
                    ? getRoutes().find((r) => Number(r.id) === Number(id))
                    : getBoulders().find((b) => Number(b.id) === Number(id));
                this.mapCatalogScope = climb ? { areaId: Number(climb.areaId), sectorId: Number(climb.sectorId) } : null;
            }

            clearMapScope() {
                this.mapCatalogScope = null;
                this.updateMapMarkers();
            }

            async showMapTab() {
                document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
                document.querySelector('.tab-btn[data-tab="map"]')?.classList.add('active');
                document.getElementById('map')?.classList.add('active');
                await ensureLeafletLoaded();
                if (!this.map) {
                    this.initMap();
                } else {
                    this.syncMapAfterTabShow();
                }
                if (typeof window.syncTelegramMiniAppUi === 'function') window.syncTelegramMiniAppUi();
            }

            async focusMapTarget(kind, id, { openPopup = true, setTarget = true } = {}) {
                const normalizedKind = kind === 'routes' ? 'route'
                    : kind === 'boulders' ? 'boulder'
                    : kind;
                if (!this.mapLayerVisible(normalizedKind)) {
                    this.setMapFilter('all');
                }
                this.setMapScopeForEntry(normalizedKind, id);
                await this.showMapTab();
                this.updateMapMarkers();
                const entry = this.mapMarkerIndex.get(this.mapKey(normalizedKind, id));
                if (!entry) {
                    this.showToast('У объекта нет координат на карте', true);
                    this.updateMapStatus('У объекта нет координат на карте.');
                    return null;
                }
                if (normalizedKind === 'area' || normalizedKind === 'sector') {
                    this.fitMapToVisibleMarkers(normalizedKind === 'area' ? 13 : 16);
                } else {
                    this.map.setView([entry.lat, entry.lng], Math.max(this.map.getZoom(), 17), { animate: true });
                }
                if (openPopup) entry.marker.openPopup();
                if (setTarget) this.setMapTarget(entry);
                return entry;
            }

            handleMapPopupAction(action, kind, id) {
                if (action === 'open') {
                    void this.showClimbDetailDialog(kind, id);
                    return;
                }
                if (action === 'catalog' || action === 'guide') {
                    this.openCatalogFromMap(kind, id);
                    if (action === 'guide') {
                        setTimeout(() => document.getElementById('catalogGuideHero')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
                    }
                    return;
                }
                if (action === 'target') {
                    const entry = this.mapMarkerIndex.get(this.mapKey(kind, id));
                    if (entry) this.setMapTarget(entry);
                }
                if (action === 'external') {
                    const entry = this.mapMarkerIndex.get(this.mapKey(kind, id));
                    if (entry) this.openExternalNavigation(entry);
                }
            }

            openCatalogFromMap(kind, id) {
                let nextCatalog = null;
                if (kind === 'area') {
                    nextCatalog = { view: 'sectors', areaId: Number(id), sectorId: null };
                } else if (kind === 'sector') {
                    const sector = getSectors().find((s) => String(s.id) === String(id));
                    if (sector) nextCatalog = { view: 'problems', areaId: Number(sector.areaId), sectorId: Number(sector.id) };
                } else if (kind === 'route') {
                    const route = getRoutes().find((r) => String(r.id) === String(id));
                    if (route) nextCatalog = { view: 'problems', areaId: Number(route.areaId), sectorId: Number(route.sectorId) };
                } else if (kind === 'boulder') {
                    const boulder = getBoulders().find((b) => String(b.id) === String(id));
                    if (boulder) nextCatalog = { view: 'problems', areaId: Number(boulder.areaId), sectorId: Number(boulder.sectorId) };
                }
                if (!nextCatalog) {
                    this.showToast('Не удалось найти объект в каталоге', true);
                    return;
                }
                this.catalog = nextCatalog;
                document.querySelector('.tab-btn[data-tab="catalog"]')?.click();
                this.renderCatalog();
            }

            setMapTarget(entry) {
                this.mapTarget = {
                    kind: entry.kind,
                    id: entry.id,
                    title: entry.title,
                    lat: entry.lat,
                    lng: entry.lng
                };
                const btn = document.getElementById('mapTargetBtn');
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-crosshairs"></i> Показать цель';
                }
                const navBtn = document.getElementById('mapExternalNavBtn');
                if (navBtn) navBtn.disabled = false;
                this.renderMapGuideStrip();
                this.updateMapNavigationLine();
                this.updateMapStatus();
            }

            renderMapContextBar() {
                const el = document.getElementById('mapContextBar');
                if (!el) return;
                if (!this.mapCatalogScope) {
                    el.classList.add('hidden');
                    el.innerHTML = '';
                    return;
                }
                const area = getAreas().find((a) => Number(a.id) === Number(this.mapCatalogScope.areaId));
                const sector = this.mapCatalogScope.sectorId != null
                    ? getSectors().find((s) => Number(s.id) === Number(this.mapCatalogScope.sectorId))
                    : null;
                const label = sector
                    ? `${area?.name || 'Район'} → ${sector.name}`
                    : `${area?.name || 'Район'}`;
                el.classList.remove('hidden');
                el.innerHTML = `
                    <span><i class="fas fa-filter"></i> На карте: ${this.escapeHtml(label)}</span>
                    <button type="button" class="btn btn-ghost btn-small" id="mapScopeResetBtn">Показать всё</button>
                `;
            }

            mapGuideSourceForTarget() {
                if (!this.mapTarget) return null;
                if (this.mapTarget.kind === 'area') return getAreas().find((a) => Number(a.id) === Number(this.mapTarget.id));
                if (this.mapTarget.kind === 'sector') return getSectors().find((s) => Number(s.id) === Number(this.mapTarget.id));
                const climb = this.mapTarget.kind === 'route'
                    ? getRoutes().find((r) => Number(r.id) === Number(this.mapTarget.id))
                    : getBoulders().find((b) => Number(b.id) === Number(this.mapTarget.id));
                const sector = climb ? getSectors().find((s) => Number(s.id) === Number(climb.sectorId)) : null;
                return sector || (climb ? getAreas().find((a) => Number(a.id) === Number(climb.areaId)) : null);
            }

            renderMapGuideStrip() {
                const el = document.getElementById('mapGuideStrip');
                if (!el) return;
                const source = this.mapGuideSourceForTarget();
                if (!this.mapTarget || !source) {
                    el.classList.add('hidden');
                    el.innerHTML = '';
                    return;
                }
                const guide = this.guideSnippetForMapEntry({ guideSource: source });
                const scope = source.areaId != null ? 'sector' : 'area';
                const pack = this.findOfflinePack(scope, source.id);
                el.classList.remove('hidden');
                el.innerHTML = `
                    <div class="map-guide-strip-title">
                        <strong>${this.escapeHtml(this.mapTarget.title)}</strong>
                        <span>${pack ? this.escapeHtml(this.offlinePackLabel(pack)) : 'Офлайн-пакет не сохранён'}</span>
                    </div>
                    ${guide ? `<div class="map-guide-strip-body">${guide}</div>` : '<div class="map-guide-strip-body">Guide-поля для этой точки пока не заполнены.</div>'}
                    <div class="map-guide-strip-actions">
                        <button type="button" class="btn btn-ghost btn-small" id="mapGuideOpenBtn">Подробнее в каталоге</button>
                        <button type="button" class="btn btn-secondary btn-small" id="mapOfflinePackBtn" data-pack-scope="${scope}" data-id="${source.id}">
                            <i class="fas fa-download"></i> ${pack ? 'Обновить офлайн' : 'Сохранить офлайн'}
                        </button>
                    </div>
                `;
            }

            bearingDegrees(a, b) {
                const toRad = (v) => Number(v) * Math.PI / 180;
                const toDeg = (v) => Number(v) * 180 / Math.PI;
                const lat1 = toRad(a.lat);
                const lat2 = toRad(b.lat);
                const dLng = toRad(b.lng - a.lng);
                const y = Math.sin(dLng) * Math.cos(lat2);
                const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
                return (toDeg(Math.atan2(y, x)) + 360) % 360;
            }

            formatBearing(degrees) {
                if (!Number.isFinite(degrees)) return '';
                const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
                return dirs[Math.round(degrees / 45) % 8];
            }

            openExternalNavigation(entry = null) {
                const target = entry || this.mapTarget;
                if (!target) {
                    this.showToast('Сначала выберите точку на карте', true);
                    return;
                }
                const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${target.lat},${target.lng}`)}&travelmode=walking`;
                if (window.Telegram?.WebApp?.openLink) {
                    window.Telegram.WebApp.openLink(url);
                } else {
                    window.open(url, '_blank', 'noopener');
                }
            }

            updateMapStatus(message = '') {
                const el = document.getElementById('mapStatus');
                if (!el) return;
                if (message) {
                    el.textContent = message;
                    return;
                }
                if (this.mapTarget && this.userLocation) {
                    const dist = this.distanceMeters(this.userLocation, this.mapTarget);
                    const bearing = this.formatBearing(this.bearingDegrees(this.userLocation, this.mapTarget));
                    el.textContent = `${this.mapTarget.title}: ${this.formatDistanceMeters(dist)} по прямой${bearing ? ` · ${bearing}` : ''}. Для маршрута по тропам откройте навигатор.`;
                    return;
                }
                if (this.mapTarget) {
                    el.textContent = `Цель: ${this.mapTarget.title}. Нажмите «Моё место», чтобы показать расстояние, или «Маршрут в навигаторе».`;
                    return;
                }
                el.textContent = 'Выберите объект на карте или в каталоге.';
            }

            distanceMeters(a, b) {
                const toRad = (v) => Number(v) * Math.PI / 180;
                const r = 6371000;
                const dLat = toRad(b.lat - a.lat);
                const dLng = toRad(b.lng - a.lng);
                const lat1 = toRad(a.lat);
                const lat2 = toRad(b.lat);
                const h = Math.sin(dLat / 2) ** 2
                    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
                return 2 * r * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
            }

            formatDistanceMeters(meters) {
                const n = Number(meters);
                if (!Number.isFinite(n)) return '—';
                if (n < 1000) return `${Math.round(n)} м`;
                return `${(n / 1000).toFixed(n < 10000 ? 1 : 0)} км`;
            }

            updateMapNavigationLine() {
                if (!this.map) return;
                if (this.mapNavigationLine) {
                    this.map.removeLayer(this.mapNavigationLine);
                    this.mapNavigationLine = null;
                }
                if (!this.userLocation || !this.mapTarget) return;
                this.mapNavigationLine = L.polyline(
                    [[this.userLocation.lat, this.userLocation.lng], [this.mapTarget.lat, this.mapTarget.lng]],
                    { color: '#2aabee', weight: 3, opacity: 0.85, dashArray: '6 8' }
                ).addTo(this.map);
            }

            startUserLocationWatch() {
                if (!navigator.geolocation) {
                    this.showToast('Геолокация недоступна на этом устройстве', true);
                    this.updateMapStatus('Геолокация недоступна на этом устройстве.');
                    return;
                }
                if (this._geoWatchId != null) {
                    this.updateMapStatus('Геолокация уже включена.');
                    return;
                }
                this.updateMapStatus('Запрашиваю геолокацию…');
                this._geoWatchId = navigator.geolocation.watchPosition(
                    (pos) => this.updateUserLocation(pos),
                    (err) => {
                        this.showToast(err?.message || 'Не удалось получить геолокацию', true);
                        this.updateMapStatus('Не удалось получить геолокацию.');
                        if (this._geoWatchId != null) {
                            navigator.geolocation.clearWatch(this._geoWatchId);
                            this._geoWatchId = null;
                        }
                    },
                    { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
                );
            }

            updateUserLocation(pos) {
                if (!this.map || !pos?.coords) return;
                const coord = this.validMapCoord(pos.coords.latitude, pos.coords.longitude);
                if (!coord) return;
                this.userLocation = coord;
                if (!this.userLocationMarker) {
                    this.userLocationMarker = L.circleMarker([coord.lat, coord.lng], {
                        radius: 7,
                        fillColor: '#ffffff',
                        color: '#2aabee',
                        weight: 3,
                        opacity: 1,
                        fillOpacity: 1
                    }).addTo(this.map).bindPopup('Вы здесь');
                } else {
                    this.userLocationMarker.setLatLng([coord.lat, coord.lng]);
                }
                if (!this.mapTarget) {
                    this.map.setView([coord.lat, coord.lng], Math.max(this.map.getZoom(), 15), { animate: true });
                }
                this.updateMapNavigationLine();
                this.updateMapStatus();
            }

            focusCurrentMapTarget() {
                if (!this.map || !this.mapTarget) return;
                this.map.setView([this.mapTarget.lat, this.mapTarget.lng], Math.max(this.map.getZoom(), 17), { animate: true });
                const entry = this.mapMarkerIndex.get(this.mapKey(this.mapTarget.kind, this.mapTarget.id));
                entry?.marker?.openPopup();
                this.updateMapStatus();
            }

            getStructureLabel(sectorId) {
                const sector = getSectors().find(s => Number(s.id) === Number(sectorId));
                if (!sector) return '';
                const area = getAreas().find(a => Number(a.id) === Number(sector.areaId));
                const a = area ? this.escapeHtml(area.name) : '?';
                const s = this.escapeHtml(sector.name);
                return `${a} → ${s}`;
            }

            formatFeedDate(value) {
                if (!value) return '';
                const d = new Date(value);
                if (Number.isNaN(d.getTime())) return '';
                return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
            }

            guideFieldRows(entity) {
                const fields = [
                    ['access', 'Доступ', 'fa-door-open'],
                    ['season', 'Сезон', 'fa-cloud-sun'],
                    ['parking', 'Парковка', 'fa-square-parking'],
                    ['approach', 'Подход', 'fa-person-hiking'],
                    ['warnings', 'Важно', 'fa-triangle-exclamation']
                ];
                return fields
                    .map(([key, label, icon]) => {
                        const value = String(entity?.[key] || '').trim();
                        if (!value) return '';
                        return `
                            <div class="catalog-guide-field catalog-guide-field--${key}">
                                <div class="catalog-guide-field-title"><i class="fas ${icon}"></i> ${label}</div>
                                <div class="catalog-guide-field-text">${this.escapeHtml(value)}</div>
                            </div>
                        `;
                    })
                    .filter(Boolean)
                    .join('');
            }

            getOfflinePacks() {
                try {
                    const raw = JSON.parse(localStorage.getItem(CLIMBING_OFFLINE_PACKS_KEY) || '[]');
                    return Array.isArray(raw) ? raw : [];
                } catch (_) {
                    return [];
                }
            }

            saveOfflinePacks(packs) {
                localStorage.setItem(CLIMBING_OFFLINE_PACKS_KEY, JSON.stringify(Array.isArray(packs) ? packs : []));
            }

            findOfflinePack(scope, id) {
                const key = scope === 'sector' ? 'sectorId' : 'areaId';
                return this.getOfflinePacks().find((p) => p.scope === scope && Number(p[key]) === Number(id));
            }

            offlinePackLabel(pack) {
                if (!pack) return 'Сохранить для офлайна';
                const date = this.formatFeedDate(pack.downloadedAt);
                const suffix = date ? ` · ${date}` : '';
                return `Офлайн сохранён${suffix}`;
            }

            renderCatalogGuideHero(kind, entity) {
                const hero = document.getElementById('catalogGuideHero');
                if (!hero) return;
                if (!entity) {
                    hero.classList.add('hidden');
                    hero.innerHTML = '';
                    return;
                }
                const isArea = kind === 'area';
                const area = isArea
                    ? entity
                    : getAreas().find((a) => Number(a.id) === Number(entity.areaId));
                const sectorIds = isArea
                    ? getSectors().filter((s) => Number(s.areaId) === Number(entity.id)).map((s) => Number(s.id))
                    : [Number(entity.id)];
                const routes = getRoutes().filter((r) => sectorIds.includes(Number(r.sectorId)));
                const boulders = getBoulders().filter((b) => sectorIds.includes(Number(b.sectorId)));
                const sectorsCount = isArea ? sectorIds.length : 1;
                const meta = APP_BOULDER_ONLY
                    ? `${sectorsCount} секторов · ${boulders.length} боулдеров`
                    : `${sectorsCount} секторов · ${routes.length} трасс · ${boulders.length} боулдеров`;
                const desc = String(entity.description || '').trim();
                const fieldsHtml = this.guideFieldRows(entity);
                const inherited = !isArea && area ? this.guideFieldRows({
                    access: entity.access || area.access,
                    season: entity.season || area.season,
                    parking: entity.parking || area.parking,
                    approach: entity.approach || area.approach,
                    warnings: entity.warnings || area.warnings
                }) : '';
                const scope = isArea ? 'area' : 'sector';
                const pack = this.findOfflinePack(scope, entity.id);
                const heroImageUrl = isArea ? resolvePhotoDisplayUrl(entity.imageData) : '';
                const heroImage = heroImageUrl
                    ? `<img class="catalog-guide-cover" src="${this.escapeHtml(heroImageUrl)}" alt="${this.escapeHtml(entity.name || 'Район')}" loading="lazy">`
                    : '';
                hero.classList.remove('hidden');
                hero.innerHTML = `
                    ${heroImage}
                    <div class="catalog-guide-head">
                        <div>
                            <div class="catalog-guide-kicker">${isArea ? 'Район' : 'Сектор'} · ${this.escapeHtml(meta)}</div>
                            <h2>${this.escapeHtml(entity.name || '—')}</h2>
                            ${!isArea && area ? `<p class="catalog-guide-parent">${this.escapeHtml(area.name)}</p>` : ''}
                        </div>
                        <div class="catalog-guide-actions">
                            <button type="button" class="btn btn-secondary btn-small" data-catalog-act="show-map" data-map-kind="${scope}" data-id="${entity.id}">
                                <i class="fas fa-map-location-dot"></i> На карте
                            </button>
                            <button type="button" class="btn btn-ghost btn-small" data-catalog-act="save-offline-pack" data-pack-scope="${scope}" data-id="${entity.id}">
                                <i class="fas fa-download"></i> ${this.escapeHtml(this.offlinePackLabel(pack))}
                            </button>
                        </div>
                    </div>
                    ${desc ? `<div class="catalog-guide-desc">${this.escapeHtml(desc)}</div>` : ''}
                    <div class="catalog-guide-grid">${fieldsHtml || inherited || '<div class="catalog-guide-empty">Guide-поля пока не заполнены.</div>'}</div>
                `;
            }

            switchToTab(tabId) {
                const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
                if (btn) btn.click();
            }

            buildGlobalSearchIndex() {
                const areas = getAreas();
                const sectors = getSectors();
                const areaById = new Map(areas.map((a) => [Number(a.id), a]));
                const sectorById = new Map(sectors.map((s) => [Number(s.id), s]));
                const guideText = (item) => [item.description, item.access, item.season, item.parking, item.approach, item.warnings]
                    .filter(Boolean)
                    .join(' ');
                const items = [];
                areas.forEach((area) => {
                    const sectorCount = sectors.filter((s) => Number(s.areaId) === Number(area.id)).length;
                    items.push({
                        kind: 'area',
                        id: area.id,
                        title: area.name,
                        subtitle: `${sectorCount} секторов`,
                        search: `${area.name} ${guideText(area)}`
                    });
                });
                sectors.forEach((sector) => {
                    const area = areaById.get(Number(sector.areaId));
                    items.push({
                        kind: 'sector',
                        id: sector.id,
                        areaId: sector.areaId,
                        title: sector.name,
                        subtitle: area ? area.name : 'Сектор',
                        search: `${sector.name} ${area?.name || ''} ${guideText(sector)}`
                    });
                });
                getRoutes().forEach((route) => {
                    const sector = sectorById.get(Number(route.sectorId));
                    const area = sector ? areaById.get(Number(sector.areaId)) : null;
                    items.push({
                        kind: 'route',
                        id: route.id,
                        areaId: route.areaId,
                        sectorId: route.sectorId,
                        title: route.name,
                        subtitle: `${route.grade || '—'} · ${area?.name || ''}${sector ? ` → ${sector.name}` : ''}`,
                        search: `${route.name} ${route.grade || ''} ${route.category || ''} ${route.description || ''} ${area?.name || ''} ${sector?.name || ''}`
                    });
                });
                getBoulders().forEach((boulder) => {
                    const sector = sectorById.get(Number(boulder.sectorId));
                    const area = sector ? areaById.get(Number(sector.areaId)) : null;
                    items.push({
                        kind: 'boulder',
                        id: boulder.id,
                        areaId: boulder.areaId,
                        sectorId: boulder.sectorId,
                        title: boulder.name,
                        subtitle: `${boulder.grade || '—'} · ${area?.name || ''}${sector ? ` → ${sector.name}` : ''}`,
                        search: `${boulder.name} ${boulder.grade || ''} ${boulder.category || ''} ${boulder.description || ''} ${area?.name || ''} ${sector?.name || ''}`
                    });
                });
                return items;
            }

            renderGlobalSearchResults() {
                const input = document.getElementById('globalSearch');
                const box = document.getElementById('globalSearchResults');
                if (!input || !box) return;
                const query = String(input.value || '').trim().toLowerCase();
                if (query.length < 2) {
                    box.classList.add('hidden');
                    box.innerHTML = '';
                    return;
                }
                const words = query.split(/\s+/).filter(Boolean);
                const results = this.buildGlobalSearchIndex()
                    .map((item) => {
                        const hay = String(item.search || '').toLowerCase();
                        const all = words.every((w) => hay.includes(w));
                        if (!all) return null;
                        const title = String(item.title || '').toLowerCase();
                        const score = title === query ? 3 : title.includes(query) ? 2 : 1;
                        return { ...item, score };
                    })
                    .filter(Boolean)
                    .sort((a, b) => b.score - a.score || String(a.title).localeCompare(String(b.title), 'ru'))
                    .slice(0, 12);
                if (!results.length) {
                    box.classList.remove('hidden');
                    box.innerHTML = '<div class="global-search-empty">Ничего не найдено</div>';
                    return;
                }
                const kindLabels = { area: 'Район', sector: 'Сектор', route: 'Трасса', boulder: 'Боулдер' };
                box.classList.remove('hidden');
                box.innerHTML = results.map((item) => `
                    <button type="button" class="global-search-item" data-global-kind="${item.kind}" data-id="${item.id}">
                        <span class="global-search-kind">${kindLabels[item.kind] || 'Объект'}</span>
                        <strong>${this.escapeHtml(item.title)}</strong>
                        <span>${this.escapeHtml(item.subtitle || '')}</span>
                    </button>
                `).join('');
            }

            openGlobalSearchResult(kind, id) {
                const input = document.getElementById('globalSearch');
                const box = document.getElementById('globalSearchResults');
                if (input) input.value = '';
                if (box) {
                    box.classList.add('hidden');
                    box.innerHTML = '';
                }
                if (kind === 'route' || kind === 'boulder') {
                    void this.showClimbDetailDialog(kind, id);
                    return;
                }
                if (kind === 'area') {
                    this.catalog = { view: 'sectors', areaId: Number(id), sectorId: null };
                    this.switchToTab('catalog');
                    this.renderCatalog();
                    return;
                }
                if (kind === 'sector') {
                    const sector = getSectors().find((s) => Number(s.id) === Number(id));
                    if (!sector) return;
                    this.catalog = { view: 'problems', areaId: Number(sector.areaId), sectorId: Number(id) };
                    this.switchToTab('catalog');
                    this.renderCatalog();
                }
            }

            buildUpdatesFeedItems() {
                const areas = getAreas();
                const sectors = getSectors();
                const areaById = new Map(areas.map((a) => [Number(a.id), a]));
                const sectorById = new Map(sectors.map((s) => [Number(s.id), s]));
                const items = [];
                const pushItem = (kind, entity, title, subtitle, filterGroup) => {
                    const updated = entity.updatedAt || entity.updated_at || entity.createdAt || entity.created_at;
                    if (!updated) return;
                    const created = entity.createdAt || entity.created_at;
                    const action = created && updated && String(created) !== String(updated) ? 'Обновлено' : 'Добавлено';
                    items.push({
                        kind,
                        id: entity.id,
                        at: updated,
                        title,
                        subtitle,
                        action,
                        filterGroup
                    });
                };
                areas.forEach((area) => pushItem('area', area, area.name, 'Район', 'places'));
                sectors.forEach((sector) => {
                    const area = areaById.get(Number(sector.areaId));
                    pushItem('sector', sector, sector.name, area ? `Сектор · ${area.name}` : 'Сектор', 'places');
                });
                getRoutes().forEach((route) => {
                    const sector = sectorById.get(Number(route.sectorId));
                    const area = sector ? areaById.get(Number(sector.areaId)) : null;
                    pushItem('route', route, route.name, `${route.grade || '—'} · ${area?.name || ''}${sector ? ` → ${sector.name}` : ''}`, 'routes');
                });
                getBoulders().forEach((boulder) => {
                    const sector = sectorById.get(Number(boulder.sectorId));
                    const area = sector ? areaById.get(Number(sector.areaId)) : null;
                    pushItem('boulder', boulder, boulder.name, `${boulder.grade || '—'} · ${area?.name || ''}${sector ? ` → ${sector.name}` : ''}`, 'boulders');
                });
                return items
                    .filter((item) => this.updatesFilter === 'all' || item.filterGroup === this.updatesFilter)
                    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
                    .slice(0, 60);
            }

            renderUpdatesTab() {
                const feed = document.getElementById('updatesFeed');
                if (!feed) return;
                document.querySelectorAll('[data-update-filter]').forEach((btn) => {
                    btn.classList.toggle('active', btn.dataset.updateFilter === this.updatesFilter);
                });
                const items = this.buildUpdatesFeedItems();
                if (!items.length) {
                    feed.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-newspaper"></i>
                            <h3>Лента пока пустая</h3>
                            <p>Обновления появятся после загрузки каталога.</p>
                        </div>`;
                    return;
                }
                const icons = {
                    area: 'fa-map',
                    sector: 'fa-layer-group',
                    route: 'fa-route',
                    boulder: 'fa-mountain'
                };
                feed.innerHTML = items.map((item) => `
                    <button type="button" class="updates-feed-item updates-feed-item--${item.kind}" data-update-kind="${item.kind}" data-id="${item.id}">
                        <span class="updates-feed-icon"><i class="fas ${icons[item.kind] || 'fa-circle'}"></i></span>
                        <span class="updates-feed-main">
                            <strong>${this.escapeHtml(item.title)}</strong>
                            <span>${this.escapeHtml(item.subtitle || '')}</span>
                        </span>
                        <span class="updates-feed-meta">${this.escapeHtml(item.action)} · ${this.escapeHtml(this.formatFeedDate(item.at))}</span>
                    </button>
                `).join('');
            }

            openUpdatesFeedTarget(kind, id) {
                if (kind === 'route' || kind === 'boulder') {
                    void this.showClimbDetailDialog(kind, id);
                    return;
                }
                this.openGlobalSearchResult(kind, id);
            }

            async downloadOfflinePack(scope, rawId) {
                const id = Number(rawId);
                if (!Number.isFinite(id)) return;
                const label = scope === 'sector' ? 'сектор' : 'район';
                this.showToast(`Сохраняю ${label} для офлайна…`);
                try {
                    const bundle = await apiFetch('/api/catalog/bundle');
                    (bundle.areas || []).forEach(mergeAreaFromApiResponse);
                    (bundle.sectors || []).forEach(mergeSectorFromApiResponse);
                    (bundle.routes || []).forEach(mergeRouteFromApiResponse);
                    (bundle.boulders || []).forEach(mergeBoulderFromApiResponse);

                    const sectors = scope === 'sector'
                        ? getSectors().filter((s) => Number(s.id) === id)
                        : getSectors().filter((s) => Number(s.areaId) === id);
                    const sectorIds = new Set(sectors.map((s) => Number(s.id)));
                    const routes = getRoutes().filter((r) => sectorIds.has(Number(r.sectorId)));
                    const boulders = getBoulders().filter((b) => sectorIds.has(Number(b.sectorId)));
                    const photos = await fetchPhotosBatched(routes, boulders);
                    const data = getClimbingData();
                    const targetKeys = new Set([
                        ...routes.map((r) => `route:${String(r.id)}`),
                        ...boulders.map((b) => `boulder:${String(b.id)}`)
                    ]);
                    const photoKey = (p) => `${p.type}:${String(p.climbId)}`;
                    data.photos = [
                        ...(data.photos || []).filter((p) => !targetKeys.has(photoKey(p))),
                        ...photos
                    ];
                    data.nextPhotoId = Math.max(1, ...(data.photos || []).map((p) => Number(p.id) || 0)) + 1;
                    saveClimbingData(data);
                    await cachePhotosToIndexedDb(photos);
                    await refreshPhotoCacheStats();
                    const packs = this.getOfflinePacks().filter((p) => {
                        if (scope === 'sector') return !(p.scope === scope && Number(p.sectorId) === id);
                        return !(p.scope === scope && Number(p.areaId) === id);
                    });
                    packs.push({
                        scope,
                        areaId: scope === 'area' ? id : Number(sectors[0]?.areaId || 0),
                        sectorId: scope === 'sector' ? id : null,
                        downloadedAt: new Date().toISOString(),
                        sectors: sectors.length,
                        climbs: routes.length + boulders.length,
                        photosCached: photos.length
                    });
                    this.saveOfflinePacks(packs);
                    this.data = getClimbingData();
                    this.renderCatalog();
                    this.renderGlobalSearchResults();
                    if (document.getElementById('updates')?.classList.contains('active')) {
                        this.renderUpdatesTab();
                    }
                    this.showToast(`Офлайн-пакет сохранён: ${routes.length + boulders.length} объектов, ${photos.length} фото`);
                } catch (err) {
                    this.showToast(`Не удалось сохранить офлайн-пакет: ${err.message}`, true);
                }
            }

            fillSectorSelects(preferredSectorId = null) {
                const routeSel = document.getElementById('routeCatalogSectorId');
                const boulderSel = document.getElementById('boulderCatalogSectorId');
                if (!routeSel && !boulderSel) return;

                const areas = getAreas();
                const sectors = getSectors();
                const buildOptions = (sel) => {
                    if (!sel) return;
                    sel.innerHTML = '';
                    sectors.forEach(sec => {
                        const area = areas.find(a => Number(a.id) === Number(sec.areaId));
                        const opt = document.createElement('option');
                        opt.value = String(sec.id);
                        opt.textContent = `${area ? area.name : '?'} — ${sec.name}`;
                        sel.appendChild(opt);
                    });
                };
                buildOptions(routeSel);
                buildOptions(boulderSel);

                const pick = preferredSectorId ?? sectors[0]?.id;
                if (pick != null) {
                    if (routeSel) routeSel.value = String(pick);
                    if (boulderSel) boulderSel.value = String(pick);
                }
            }

            renderCatalog() {
                const bc = document.getElementById('catalogBreadcrumb');
                const tb = document.getElementById('catalogToolbar');
                const list = document.getElementById('catalogList');
                const hero = document.getElementById('catalogGuideHero');
                if (!bc || !tb || !list) return;

                const areas = getAreas();
                const sectors = getSectors();

                if (this.catalog.view === 'areas') {
                    if (hero) {
                        hero.classList.add('hidden');
                        hero.innerHTML = '';
                    }
                    bc.innerHTML = '<span><strong>Районы</strong></span>';
                    tb.innerHTML = this.isAdmin() ? `
                        <button type="button" class="btn btn-primary" data-catalog-act="add-area">
                            <i class="fas fa-plus"></i> Добавить район
                        </button>` : '';
                    list.innerHTML = areas.length ? areas.map(a => {
                        const sc = sectors.filter(s => Number(s.areaId) === Number(a.id)).length;
                        const rc = getRoutes().filter(r => Number(r.areaId) === Number(a.id)).length;
                        const bcnt = getBoulders().filter(b => Number(b.areaId) === Number(a.id)).length;
                        const meta = APP_BOULDER_ONLY
                            ? `${sc} секторов · ${bcnt} боулдеров`
                            : `${sc} секторов · ${rc} трасс · ${bcnt} боулдеров`;
                        const imageUrl = resolvePhotoDisplayUrl(a.imageData);
                        const thumb = imageUrl
                            ? `<img class="catalog-area-card-image" src="${this.escapeHtml(imageUrl)}" alt="${this.escapeHtml(a.name)}" loading="lazy">`
                            : `<div class="catalog-area-card-image catalog-area-card-image--placeholder"><i class="fas fa-mountain-sun"></i></div>`;
                        const desc = String(a.description || '').trim();
                        return `
                            <div class="catalog-row catalog-area-card">
                                ${thumb}
                                <button type="button" class="catalog-row-open" data-catalog-go="area" data-id="${a.id}" aria-label="Открыть район: ${this.escapeHtml(a.name)}">
                                    <div class="catalog-row-title">${this.escapeHtml(a.name)}</div>
                                    <div class="catalog-row-meta">${meta}</div>
                                    ${desc ? `<div class="catalog-area-card-desc">${this.escapeHtml(desc)}</div>` : ''}
                                </button>
                                <button type="button" class="catalog-map-btn btn btn-ghost btn-small" data-catalog-act="show-map" data-map-kind="area" data-id="${a.id}">
                                    <i class="fas fa-map-location-dot"></i> На карте
                                </button>
                                <div class="catalog-row-actions ${this.isAdmin() ? '' : 'hidden-by-role'}" style="align-self:center;padding-right:12px">
                                    <button type="button" class="btn btn-ghost btn-small" data-catalog-act="edit-area" data-id="${a.id}"><i class="fas fa-edit"></i></button>
                                    <button type="button" class="btn btn-danger btn-small" data-catalog-act="delete-area" data-id="${a.id}"><i class="fas fa-trash"></i></button>
                                </div>
                            </div>`;
                    }).join('') : '<div class="empty-state"><p>Нет районов. Создайте первый.</p></div>';
                    if (typeof window.syncTelegramMiniAppUi === 'function') window.syncTelegramMiniAppUi();
                    return;
                }

                if (this.catalog.view === 'sectors') {
                    const area = areas.find(a => Number(a.id) === Number(this.catalog.areaId));
                    this.renderCatalogGuideHero('area', area);
                    const areaName = area ? this.escapeHtml(area.name) : '?';
                    bc.innerHTML = `
                        <button type="button" class="linkish" data-catalog-act="nav-areas">Районы</button>
                        <span>/</span><span><strong>${areaName}</strong></span>`;
                    tb.innerHTML = this.isAdmin() ? `
                        <button type="button" class="btn btn-ghost" data-catalog-act="nav-areas"><i class="fas fa-arrow-left"></i> Назад</button>
                        <button type="button" class="btn btn-primary" data-catalog-act="add-sector" data-id="${this.catalog.areaId}">
                            <i class="fas fa-plus"></i> Добавить сектор
                        </button>` : `
                        <button type="button" class="btn btn-ghost" data-catalog-act="nav-areas"><i class="fas fa-arrow-left"></i> Назад</button>`;
                    const listSectors = sectors.filter(s => Number(s.areaId) === Number(this.catalog.areaId));
                    list.innerHTML = listSectors.length ? listSectors.map(s => {
                        const rc = getRoutes().filter(r => Number(r.sectorId) === Number(s.id)).length;
                        const bcnt = getBoulders().filter(b => Number(b.sectorId) === Number(s.id)).length;
                        const meta = APP_BOULDER_ONLY
                            ? `${bcnt} боулдеров`
                            : `${rc} трасс · ${bcnt} боулдеров`;
                        return `
                            <div class="catalog-row">
                                <button type="button" class="catalog-row-open" data-catalog-go="sector" data-id="${s.id}" aria-label="Открыть сектор: ${this.escapeHtml(s.name)}">
                                    <div class="catalog-row-title">${this.escapeHtml(s.name)}</div>
                                    <div class="catalog-row-meta">${meta}</div>
                                </button>
                                <button type="button" class="catalog-map-btn btn btn-ghost btn-small" data-catalog-act="show-map" data-map-kind="sector" data-id="${s.id}">
                                    <i class="fas fa-map-location-dot"></i> На карте
                                </button>
                                <div class="catalog-row-actions ${this.isAdmin() ? '' : 'hidden-by-role'}" style="align-self:center;padding-right:12px">
                                    <button type="button" class="btn btn-ghost btn-small" data-catalog-act="edit-sector" data-id="${s.id}"><i class="fas fa-edit"></i></button>
                                    <button type="button" class="btn btn-danger btn-small" data-catalog-act="delete-sector" data-id="${s.id}"><i class="fas fa-trash"></i></button>
                                </div>
                            </div>`;
                    }).join('') : '<div class="empty-state"><p>В этом районе пока нет секторов.</p></div>';
                    if (typeof window.syncTelegramMiniAppUi === 'function') window.syncTelegramMiniAppUi();
                    return;
                }

                if (this.catalog.view === 'problems') {
                    const area = areas.find(a => Number(a.id) === Number(this.catalog.areaId));
                    const sector = sectors.find(s => Number(s.id) === Number(this.catalog.sectorId));
                    this.renderCatalogGuideHero('sector', sector);
                    const areaName = area ? this.escapeHtml(area.name) : '?';
                    const sectorName = sector ? this.escapeHtml(sector.name) : '?';
                    bc.innerHTML = `
                        <button type="button" class="linkish" data-catalog-act="nav-areas">Районы</button>
                        <span>/</span>
                        <button type="button" class="linkish" data-catalog-act="nav-area" data-id="${this.catalog.areaId}">${areaName}</button>
                        <span>/</span><span><strong>${sectorName}</strong></span>`;
                    const addButtons = this.isAdmin() ? `
                        ${APP_BOULDER_ONLY ? '' : `
                        <button type="button" class="btn btn-primary" data-catalog-act="add-route" data-id="${this.catalog.sectorId}">
                            <i class="fas fa-plus"></i> Добавить трассу
                        </button>`}
                        <button type="button" class="btn btn-primary" data-catalog-act="add-boulder" data-id="${this.catalog.sectorId}">
                            <i class="fas fa-plus"></i> Добавить боулдеринг
                        </button>
                    ` : '';
                    tb.innerHTML = `
                        <button type="button" class="btn btn-ghost" data-catalog-act="nav-area" data-id="${this.catalog.areaId}"><i class="fas fa-arrow-left"></i> К секторам</button>
                        ${addButtons}`;

                    const rs = getRoutes().filter(r => Number(r.sectorId) === Number(this.catalog.sectorId));
                    const bs = getBoulders().filter(b => Number(b.sectorId) === Number(this.catalog.sectorId));
                    const blocks = [];
                    if (!APP_BOULDER_ONLY && rs.length) {
                        blocks.push('<h4 style="margin:12px 0 8px;color:var(--light-text)">Трассы</h4>');
                        rs.forEach(r => {
                            blocks.push(`
                                <div class="list-item catalog-climb-row" style="margin-bottom:8px" data-open-climb="route" data-open-climb-id="${r.id}">
                                    <button type="button" class="climb-row-open" aria-label="Просмотр: ${this.escapeHtml(r.name)}">
                                        <div class="item-info">
                                            <h3 style="font-size:16px">${this.escapeHtml(r.name)}</h3>
                                            <div class="item-meta">
                                                <span>Категория: <span class="grade-badge grade-route">${this.escapeHtml(r.grade)}</span></span>
                                                ${r.category ? `<span><i class="fas fa-tag"></i> ${this.escapeHtml(r.category)}</span>` : ''}
                                                ${r.rating != null && r.rating !== '' ? `<span><i class="fas fa-star"></i> ${this.escapeHtml(formatStarAverage(r.rating))}</span>` : ''}
                                                ${r.length ? `<span><i class="fas fa-ruler-vertical"></i> ${this.escapeHtml(r.length)}м</span>` : ''}
                                                ${r.sector ? `<span><i class="fas fa-map-marker-alt"></i> ${this.escapeHtml(r.sector)}</span>` : ''}
                                            </div>
                                        </div>
                                    </button>
                                    <button type="button" class="catalog-map-btn catalog-map-climb-btn btn btn-ghost btn-small" data-catalog-act="show-map" data-map-kind="route" data-id="${r.id}">
                                        <i class="fas fa-map-location-dot"></i> На карте
                                    </button>
                                    <div class="item-actions ${this.isAdmin() ? '' : 'hidden-by-role'}">
                                    <button type="button" class="btn btn-ghost btn-small" data-action="edit-route" data-route-id="${r.id}"><i class="fas fa-edit"></i></button>
                                        <button type="button" class="btn btn-danger btn-small" data-action="delete-route" data-route-id="${r.id}"><i class="fas fa-trash"></i></button>
                                    </div>
                                </div>`);
                        });
                    }
                    if (bs.length) {
                        blocks.push('<h4 style="margin:16px 0 8px;color:var(--light-text)">Боулдеринг</h4>');
                        bs.forEach(b => {
                            blocks.push(`
                                <div class="list-item catalog-climb-row" style="margin-bottom:8px" data-open-climb="boulder" data-open-climb-id="${b.id}">
                                    <button type="button" class="climb-row-open" aria-label="Просмотр: ${this.escapeHtml(b.name)}">
                                        <div class="item-info">
                                            <h3 style="font-size:16px">${this.escapeHtml(b.name)}</h3>
                                            <div class="item-meta">
                                                <span>Категория: <span class="grade-badge grade-boulder">${this.escapeHtml(b.grade)}</span></span>
                                                ${b.category ? `<span><i class="fas fa-tag"></i> ${this.escapeHtml(b.category)}</span>` : ''}
                                                ${b.rating != null && b.rating !== '' ? `<span><i class="fas fa-star"></i> ${this.escapeHtml(formatStarAverage(b.rating))}</span>` : ''}
                                                ${b.height ? `<span><i class="fas fa-ruler-vertical"></i> ${this.escapeHtml(b.height)}м</span>` : ''}
                                            </div>
                                        </div>
                                    </button>
                                    <button type="button" class="catalog-map-btn catalog-map-climb-btn btn btn-ghost btn-small" data-catalog-act="show-map" data-map-kind="boulder" data-id="${b.id}">
                                        <i class="fas fa-map-location-dot"></i> На карте
                                    </button>
                                    <div class="item-actions ${this.isAdmin() ? '' : 'hidden-by-role'}">
                                    <button type="button" class="btn btn-ghost btn-small" data-action="edit-boulder" data-boulder-id="${b.id}"><i class="fas fa-edit"></i></button>
                                        <button type="button" class="btn btn-danger btn-small" data-action="delete-boulder" data-boulder-id="${b.id}"><i class="fas fa-trash"></i></button>
                                    </div>
                                </div>`);
                        });
                    }
                    if (!bs.length && (!rs.length || APP_BOULDER_ONLY)) {
                        const msg = APP_BOULDER_ONLY
                            ? 'В секторе пока нет боулдеров.'
                            : 'В секторе пока нет трасс и боулдеров.';
                        blocks.push(`<div class="empty-state"><p>${msg}</p></div>`);
                    }
                    list.innerHTML = blocks.join('');
                }
                if (typeof window.syncTelegramMiniAppUi === 'function') window.syncTelegramMiniAppUi();
            }

            handleCatalogClick(e) {
                const act = e.target.closest('[data-catalog-act]');
                const go = e.target.closest('[data-catalog-go]');
                if (act) {
                    e.preventDefault();
                    const id = act.dataset.id ? Number(act.dataset.id) : null;
                    const action = act.dataset.catalogAct;
                    if (action === 'add-area') { if (!this.requireAdmin('Добавление района')) return; this.showAddAreaDialog(); }
                    if (action === 'edit-area') { if (!this.requireAdmin('Редактирование района')) return; this.showEditAreaDialog(id); }
                    if (action === 'delete-area') { if (!this.requireAdmin('Удаление района')) return; void this.deleteArea(id); }
                    if (action === 'add-sector') { if (!this.requireAdmin('Добавление сектора')) return; this.showAddSectorDialog(Number(act.dataset.id)); }
                    if (action === 'edit-sector') { if (!this.requireAdmin('Редактирование сектора')) return; this.showEditSectorDialog(id); }
                    if (action === 'delete-sector') { if (!this.requireAdmin('Удаление сектора')) return; void this.deleteSector(id); }
                    if (action === 'add-route') { if (!this.requireAdmin('Добавление трассы')) return; this.quickAddRouteInSector(id); }
                    if (action === 'add-boulder') { if (!this.requireAdmin('Добавление боулдеринга')) return; this.quickAddBoulderInSector(id); }
                    if (action === 'show-map') {
                        const kind = act.dataset.mapKind || '';
                        if (kind && id != null) void this.focusMapTarget(kind, id);
                    }
                    if (action === 'save-offline-pack') {
                        const scope = act.dataset.packScope === 'sector' ? 'sector' : 'area';
                        if (id != null) void this.downloadOfflinePack(scope, id);
                    }
                    if (action === 'nav-areas') {
                        this.catalog = { view: 'areas', areaId: null, sectorId: null };
                        this.renderCatalog();
                    }
                    if (action === 'nav-area') {
                        this.catalog = { view: 'sectors', areaId: id, sectorId: null };
                        this.renderCatalog();
                    }
                    return;
                }
                if (go) {
                    const gid = Number(go.dataset.id);
                    if (go.dataset.catalogGo === 'area') {
                        this.catalog = { view: 'sectors', areaId: gid, sectorId: null };
                        this.renderCatalog();
                    }
                    if (go.dataset.catalogGo === 'sector') {
                        this.catalog = { view: 'problems', areaId: this.catalog.areaId, sectorId: gid };
                        this.renderCatalog();
                    }
                    return;
                }
                const climbOpen = e.target.closest('[data-open-climb]');
                if (climbOpen && !e.target.closest('[data-action]')) {
                    const oc = climbOpen.getAttribute('data-open-climb');
                    const oid = Number(climbOpen.dataset.openClimbId);
                    if ((oc === 'route' || oc === 'boulder') && Number.isFinite(oid)) {
                        e.preventDefault();
                        this.showClimbDetailDialog(oc, oid);
                    }
                }
            }

            showAddAreaDialog() {
                if (!this.requireAdmin('Добавление района')) return;
                document.getElementById('areaDialogTitle').textContent = 'Новый район';
                document.getElementById('areaId').value = '';
                document.getElementById('areaName').value = '';
                document.getElementById('areaDescription').value = '';
                document.getElementById('areaAccess').value = '';
                document.getElementById('areaSeason').value = '';
                document.getElementById('areaParking').value = '';
                document.getElementById('areaApproach').value = '';
                document.getElementById('areaWarnings').value = '';
                document.getElementById('areaLatitude').value = '';
                document.getElementById('areaLongitude').value = '';
                this.clearAreaDialogPhoto({ markRemove: false });
                this.showDialog('areaDialog');
            }

            showEditAreaDialog(areaId) {
                if (!this.requireAdmin('Редактирование района')) return;
                const area = getAreas().find(a => Number(a.id) === Number(areaId));
                if (!area) return;
                document.getElementById('areaDialogTitle').textContent = 'Редактировать район';
                document.getElementById('areaId').value = area.id;
                document.getElementById('areaName').value = area.name;
                document.getElementById('areaDescription').value = area.description || '';
                document.getElementById('areaAccess').value = area.access || '';
                document.getElementById('areaSeason').value = area.season || '';
                document.getElementById('areaParking').value = area.parking || '';
                document.getElementById('areaApproach').value = area.approach || '';
                document.getElementById('areaWarnings').value = area.warnings || '';
                document.getElementById('areaLatitude').value = area.latitude ?? '';
                document.getElementById('areaLongitude').value = area.longitude ?? '';
                this.areaPhotoData = null;
                this.areaPhotoRemove = false;
                const input = document.getElementById('areaPhoto');
                if (input) input.value = '';
                this.renderAreaDialogPhotoPreview(resolvePhotoDisplayUrl(area.imageData));
                this.showDialog('areaDialog');
            }

            async saveArea() {
                if (!this.requireAdmin('Сохранение района')) return;
                const id = document.getElementById('areaId').value;
                const name = document.getElementById('areaName').value.trim();
                if (!name) {
                    this.showToast('Укажите название района', true);
                    return;
                }
                const payload = {
                    name,
                    description: document.getElementById('areaDescription').value.trim(),
                    access: document.getElementById('areaAccess').value.trim() || null,
                    season: document.getElementById('areaSeason').value.trim() || null,
                    parking: document.getElementById('areaParking').value.trim() || null,
                    approach: document.getElementById('areaApproach').value.trim() || null,
                    warnings: document.getElementById('areaWarnings').value.trim() || null,
                    latitude: document.getElementById('areaLatitude').value ? parseFloat(document.getElementById('areaLatitude').value) : null,
                    longitude: document.getElementById('areaLongitude').value ? parseFloat(document.getElementById('areaLongitude').value) : null
                };
                if (this.areaPhotoData?.data) {
                    payload.image_url = this.areaPhotoData.data;
                } else if (this.areaPhotoRemove || !id) {
                    payload.image_url = null;
                }
                try {
                    const savedArea = id
                        ? await apiFetch(`/api/areas/${Number(id)}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        })
                        : await apiFetch('/api/areas', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                    mergeAreaFromApiResponse(savedArea);
                    this.data = getClimbingData();
                } catch (err) {
                    this.showToast(`Ошибка сохранения района: ${err.message}`, true);
                    return;
                }
                this.hideDialog('areaDialog');
                this.clearAreaDialogPhoto({ markRemove: false });
                this.fillSectorSelects();
                this.renderCatalog();
                this.updateMapMarkers();
                this.showToast(id ? 'Район обновлён' : 'Район сохранён');
            }

            async deleteArea(areaId) {
                if (!this.requireAdmin('Удаление района')) return;
                const msg = APP_BOULDER_ONLY
                    ? 'Удалить этот район? Секторы и боулдеры внутри будут скрыты из каталога.'
                    : 'Удалить этот район? Секторы, трассы и боулдеры внутри будут скрыты из каталога.';
                if (!(await confirmDestructive(msg))) return;
                try {
                    await apiFetch(`/api/areas/${Number(areaId)}`, { method: 'DELETE' });
                    removeAreaFromLocalCache(areaId);
                } catch (err) {
                    this.showToast(`Ошибка удаления района: ${err.message}`, true);
                    return;
                }
                this.catalog = { view: 'areas', areaId: null, sectorId: null };
                this.data = getClimbingData();
                this.fillSectorSelects();
                this.renderCatalog();
                this.renderRoutes();
                this.renderBoulders();
                this.updateMapMarkers();
                if (document.getElementById('photos')?.classList.contains('active')) {
                    const run = () => this.renderPhotoAlbum();
                    if (typeof requestAnimationFrame === 'function') {
                        requestAnimationFrame(() => requestAnimationFrame(run));
                    } else run();
                }
                this.showToast('Район удалён');
            }

            showAddSectorDialog(areaId) {
                if (!this.requireAdmin('Добавление сектора')) return;
                document.getElementById('sectorDialogTitle').textContent = 'Новый сектор';
                document.getElementById('sectorId').value = '';
                document.getElementById('sectorAreaId').value = String(areaId);
                document.getElementById('sectorName').value = '';
                document.getElementById('sectorDescription').value = '';
                document.getElementById('sectorAccess').value = '';
                document.getElementById('sectorSeason').value = '';
                document.getElementById('sectorParking').value = '';
                document.getElementById('sectorApproach').value = '';
                document.getElementById('sectorWarnings').value = '';
                this.showDialog('sectorDialog');
            }

            showEditSectorDialog(sectorId) {
                if (!this.requireAdmin('Редактирование сектора')) return;
                const sector = getSectors().find(s => Number(s.id) === Number(sectorId));
                if (!sector) return;
                document.getElementById('sectorDialogTitle').textContent = 'Редактировать сектор';
                document.getElementById('sectorId').value = sector.id;
                document.getElementById('sectorAreaId').value = sector.areaId;
                document.getElementById('sectorName').value = sector.name;
                document.getElementById('sectorDescription').value = sector.description || '';
                document.getElementById('sectorAccess').value = sector.access || '';
                document.getElementById('sectorSeason').value = sector.season || '';
                document.getElementById('sectorParking').value = sector.parking || '';
                document.getElementById('sectorApproach').value = sector.approach || '';
                document.getElementById('sectorWarnings').value = sector.warnings || '';
                this.showDialog('sectorDialog');
            }

            async quickAddRouteInSector(sectorId) {
                const sid = Number(sectorId || this.catalog.sectorId || 0);
                document.getElementById('quickRouteId').value = '';
                document.getElementById('quickRouteSectorId').value = String(sid || '');
                document.getElementById('quickRouteForm')?.reset();
                document.getElementById('quickRouteGrade').value = '6a';
                document.getElementById('quickRouteDialogTitle').textContent = 'Добавить трассу';
                document.getElementById('quickRouteDialogSubtitle').textContent = 'Новая трасса в выбранном секторе';
                document.getElementById('saveQuickRouteBtn').innerHTML = '<i class="fas fa-save"></i> Добавить трассу';
                this.setStarRating('quickRouteRating', '');
                this.clearQuickDialogPhoto('route');
                this.showDialog('quickRouteDialog');
            }

            async quickAddBoulderInSector(sectorId) {
                const sid = Number(sectorId || this.catalog.sectorId || 0);
                document.getElementById('quickBoulderId').value = '';
                document.getElementById('quickBoulderSectorId').value = String(sid || '');
                document.getElementById('quickBoulderForm')?.reset();
                document.getElementById('quickBoulderGrade').value = '7A';
                document.getElementById('quickBoulderDialogTitle').textContent = 'Добавить боулдеринг';
                document.getElementById('quickBoulderDialogSubtitle').textContent = 'Новый боулдеринг в выбранном секторе';
                document.getElementById('saveQuickBoulderBtn').innerHTML = '<i class="fas fa-save"></i> Добавить боулдеринг';
                this.setStarRating('quickBoulderRating', '');
                this.clearQuickDialogPhoto('boulder');
                this.showDialog('quickBoulderDialog');
            }

            showEditRouteDialog(routeId) {
                if (!this.requireAdmin('Редактирование трассы')) return;
                const route = getRoutes().find((r) => Number(r.id) === Number(routeId));
                if (!route) {
                    this.showToast('Трасса не найдена', true);
                    return;
                }
                document.getElementById('quickRouteId').value = String(route.id);
                document.getElementById('quickRouteSectorId').value = String(route.sectorId || '');
                document.getElementById('quickRouteName').value = route.name || '';
                document.getElementById('quickRouteGrade').value = route.grade || '6a';
                document.getElementById('quickRouteDescription').value = route.description || '';
                document.getElementById('quickRouteLength').value = route.length ?? '';
                document.getElementById('quickRouteBolts').value = route.bolts ?? '';
                document.getElementById('quickRouteCoordinates').value =
                    route.latitude != null && route.longitude != null ? `${route.latitude}, ${route.longitude}` : '';
                this.setStarRating('quickRouteRating', route.rating != null ? String(route.rating) : '');
                document.getElementById('quickRouteDialogTitle').textContent = 'Редактировать трассу';
                document.getElementById('quickRouteDialogSubtitle').textContent = 'Измените параметры трассы';
                document.getElementById('saveQuickRouteBtn').innerHTML = '<i class="fas fa-save"></i> Сохранить изменения';
                this.clearQuickDialogPhoto('route');
                this.showDialog('quickRouteDialog');
            }

            showEditBoulderDialog(boulderId) {
                if (!this.requireAdmin('Редактирование боулдеринга')) return;
                const boulder = getBoulders().find((b) => Number(b.id) === Number(boulderId));
                if (!boulder) {
                    this.showToast('Боулдеринг не найден', true);
                    return;
                }
                document.getElementById('quickBoulderId').value = String(boulder.id);
                document.getElementById('quickBoulderSectorId').value = String(boulder.sectorId || '');
                document.getElementById('quickBoulderName').value = boulder.name || '';
                document.getElementById('quickBoulderGrade').value = boulder.grade || '7A';
                document.getElementById('quickBoulderDescription').value = boulder.description || '';
                document.getElementById('quickBoulderHeight').value = boulder.height ?? '';
                document.getElementById('quickBoulderCoordinates').value =
                    boulder.latitude != null && boulder.longitude != null ? `${boulder.latitude}, ${boulder.longitude}` : '';
                this.setStarRating('quickBoulderRating', boulder.rating != null ? String(boulder.rating) : '');
                document.getElementById('quickBoulderDialogTitle').textContent = 'Редактировать боулдеринг';
                document.getElementById('quickBoulderDialogSubtitle').textContent = 'Измените параметры боулдеринга';
                document.getElementById('saveQuickBoulderBtn').innerHTML = '<i class="fas fa-save"></i> Сохранить изменения';
                this.clearQuickDialogPhoto('boulder');
                this.showDialog('quickBoulderDialog');
            }

            async saveQuickRoute() {
                const editId = Number(document.getElementById('quickRouteId').value || 0);
                if (!this.requireAdmin(editId ? 'Редактирование трассы' : 'Добавление трассы')) return;
                const sid = Number(document.getElementById('quickRouteSectorId').value || 0);
                const sector = getSectors().find(s => Number(s.id) === sid);
                if (!sector) {
                    this.showToast('Сектор не найден', true);
                    return;
                }
                const name = (document.getElementById('quickRouteName').value || '').trim();
                if (!name) {
                    this.showToast('Введите название трассы', true);
                    return;
                }
                const grade = normalizeRouteGrade((document.getElementById('quickRouteGrade').value || '').trim() || '6a');
                const description = (document.getElementById('quickRouteDescription').value || '').trim();
                const ratingStr = (document.getElementById('quickRouteRating').value || '').trim();
                const lengthStr = (document.getElementById('quickRouteLength').value || '').trim();
                const boltsStr = (document.getElementById('quickRouteBolts').value || '').trim();
                const routePhotoData = this.quickRoutePhotoData;
                const coordinates = this.parseCoordinates(document.getElementById('quickRouteCoordinates').value || '');
                if (coordinates === null) {
                    this.showToast('Координаты в формате: широта, долгота', true);
                    return;
                }

                this._setQuickSaveLoading('route', true);
                try {
                    const routePayload = {
                        sector_id: sid,
                        area_id: Number(sector.areaId),
                        name,
                        description: description || null,
                        grade,
                        rating: ratingStr ? Number(ratingStr) : null,
                        length_m: lengthStr ? Number(lengthStr) : null,
                        bolts: boltsStr ? Number(boltsStr) : null,
                        latitude: coordinates.latitude,
                        longitude: coordinates.longitude,
                        sector_label: sector.name
                    };
                    const savedRoute = await apiFetch(editId ? `/api/routes/${editId}` : '/api/routes', {
                        method: editId ? 'PATCH' : 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(routePayload)
                    });
                    let createdRoutePhoto = null;
                    if (!editId && routePhotoData?.data) {
                        createdRoutePhoto = await apiFetch('/api/photos', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                climb_type: 'route',
                                route_id: Number(savedRoute.id),
                                boulder_id: null,
                                image_url: routePhotoData.data,
                                description: `Фото трассы: ${name}`,
                                file_name: routePhotoData.fileName || null,
                                mime_type: routePhotoData.type || null,
                                markup: routePhotoData.markup || null
                            })
                        });
                    }
                    mergeRouteFromApiResponse(savedRoute);
                    if (createdRoutePhoto) appendPhotoFromApiResponse(createdRoutePhoto);
                    this.data = getClimbingData();
                    this.hideDialog('quickRouteDialog');
                    this.clearQuickDialogPhoto('route');
                    this.renderCatalog();
                    this.renderRoutes();
                    this.updateMapMarkers();
                    this.showToast(editId ? 'Трасса обновлена' : 'Трасса добавлена');
                    this.showClimbDetailDialog('route', Number(savedRoute.id));
                } catch (err) {
                    this.showToast(`Ошибка сохранения трассы: ${err.message}`, true);
                } finally {
                    this._setQuickSaveLoading('route', false);
                }
            }

            async saveQuickBoulder() {
                const editId = Number(document.getElementById('quickBoulderId').value || 0);
                if (!this.requireAdmin(editId ? 'Редактирование боулдеринга' : 'Добавление боулдеринга')) return;
                const sid = Number(document.getElementById('quickBoulderSectorId').value || 0);
                const sector = getSectors().find(s => Number(s.id) === sid);
                if (!sector) {
                    this.showToast('Сектор не найден', true);
                    return;
                }
                const name = (document.getElementById('quickBoulderName').value || '').trim();
                if (!name) {
                    this.showToast('Введите название боулдеринга', true);
                    return;
                }
                const grade = normalizeBoulderGrade((document.getElementById('quickBoulderGrade').value || '').trim() || '7A');
                const description = (document.getElementById('quickBoulderDescription').value || '').trim();
                const ratingStr = (document.getElementById('quickBoulderRating').value || '').trim();
                const heightStr = (document.getElementById('quickBoulderHeight').value || '').trim();
                const boulderPhotoData = this.quickBoulderPhotoData;
                const coordinates = this.parseCoordinates(document.getElementById('quickBoulderCoordinates').value || '');
                if (coordinates === null) {
                    this.showToast('Координаты в формате: широта, долгота', true);
                    return;
                }

                this._setQuickSaveLoading('boulder', true);
                try {
                    const boulderPayload = {
                        sector_id: sid,
                        area_id: Number(sector.areaId),
                        name,
                        description: description || null,
                        grade,
                        rating: ratingStr ? Number(ratingStr) : null,
                        height_m: heightStr ? Number(heightStr) : null,
                        latitude: coordinates.latitude,
                        longitude: coordinates.longitude
                    };
                    const savedBoulder = await apiFetch(editId ? `/api/boulders/${editId}` : '/api/boulders', {
                        method: editId ? 'PATCH' : 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(boulderPayload)
                    });
                    let createdBoulderPhoto = null;
                    if (!editId && boulderPhotoData?.data) {
                        createdBoulderPhoto = await apiFetch('/api/photos', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                climb_type: 'boulder',
                                route_id: null,
                                boulder_id: Number(savedBoulder.id),
                                image_url: boulderPhotoData.data,
                                description: `Фото боулдеринга: ${name}`,
                                file_name: boulderPhotoData.fileName || null,
                                mime_type: boulderPhotoData.type || null,
                                markup: boulderPhotoData.markup || null
                            })
                        });
                    }
                    mergeBoulderFromApiResponse(savedBoulder);
                    if (createdBoulderPhoto) appendPhotoFromApiResponse(createdBoulderPhoto);
                    this.data = getClimbingData();
                    this.hideDialog('quickBoulderDialog');
                    this.clearQuickDialogPhoto('boulder');
                    this.renderCatalog();
                    this.renderBoulders();
                    this.updateMapMarkers();
                    this.showToast(editId ? 'Боулдеринг обновлён' : 'Боулдеринг добавлен');
                    this.showClimbDetailDialog('boulder', Number(savedBoulder.id));
                } catch (err) {
                    this.showToast(`Ошибка сохранения боулдеринга: ${err.message}`, true);
                } finally {
                    this._setQuickSaveLoading('boulder', false);
                }
            }

            async saveSector() {
                if (!this.requireAdmin('Сохранение сектора')) return;
                const id = document.getElementById('sectorId').value;
                const areaId = Number(document.getElementById('sectorAreaId').value);
                const name = document.getElementById('sectorName').value.trim();
                if (!name || !areaId) {
                    this.showToast('Укажите название сектора', true);
                    return;
                }
                const payload = {
                    name,
                    description: document.getElementById('sectorDescription').value.trim(),
                    access: document.getElementById('sectorAccess').value.trim() || null,
                    season: document.getElementById('sectorSeason').value.trim() || null,
                    parking: document.getElementById('sectorParking').value.trim() || null,
                    approach: document.getElementById('sectorApproach').value.trim() || null,
                    warnings: document.getElementById('sectorWarnings').value.trim() || null
                };
                try {
                    const savedSector = id
                        ? await apiFetch(`/api/sectors/${Number(id)}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        })
                        : await apiFetch(`/api/areas/${areaId}/sectors`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                    mergeSectorFromApiResponse(savedSector);
                    this.data = getClimbingData();
                } catch (err) {
                    this.showToast(`Ошибка сохранения сектора: ${err.message}`, true);
                    return;
                }
                this.hideDialog('sectorDialog');
                this.fillSectorSelects();
                this.renderCatalog();
                this.updateMapMarkers();
                this.showToast(id ? 'Сектор обновлён' : 'Сектор сохранён');
            }

            async deleteSector(sectorId) {
                if (!this.requireAdmin('Удаление сектора')) return;
                const msg = APP_BOULDER_ONLY
                    ? 'Удалить этот сектор? Боулдеры в нём будут скрыты из каталога.'
                    : 'Удалить этот сектор? Трассы и боулдеры в нём будут скрыты из каталога.';
                if (!(await confirmDestructive(msg))) return;
                try {
                    await apiFetch(`/api/sectors/${Number(sectorId)}`, { method: 'DELETE' });
                    removeSectorFromLocalCache(sectorId);
                } catch (err) {
                    this.showToast(`Ошибка удаления сектора: ${err.message}`, true);
                    return;
                }
                this.catalog = { view: 'sectors', areaId: this.catalog.areaId, sectorId: null };
                this.data = getClimbingData();
                this.fillSectorSelects();
                this.renderCatalog();
                this.renderRoutes();
                this.renderBoulders();
                this.updateMapMarkers();
                if (document.getElementById('photos')?.classList.contains('active')) {
                    const run = () => this.renderPhotoAlbum();
                    if (typeof requestAnimationFrame === 'function') {
                        requestAnimationFrame(() => requestAnimationFrame(run));
                    } else run();
                }
                this.showToast('Сектор удалён');
            }

            renderRoutes() {
                if (APP_BOULDER_ONLY) return;
                const routesList = document.getElementById('routesList');
                if (!routesList) return;
                const routes = getRoutes();

                if (routes.length === 0) {
                    routesList.innerHTML = `
                        <div class="empty-state">
                            <h3>Нет трасс</h3>
                            <p>Список пуст. Данные можно наполнить вне интерфейса (например, импортом в localStorage).</p>
                        </div>
                    `;
                    return;
                }

                const searchTerm = document.getElementById('routeSearch')?.value.toLowerCase() || '';
                const gradeFilter = document.getElementById('routeGradeFilter')?.value || '';
                const hideSent = document.getElementById('hideSentRoutes')?.checked;

                const filteredRoutes = routes.filter(route => {
                    if (hideSent && this.hasUserSent('route', route.id)) return false;
                    const sector = getSectors().find(s => Number(s.id) === Number(route.sectorId));
                    const area = sector ? getAreas().find(a => Number(a.id) === Number(sector.areaId)) : null;
                    const catalogStr = [area?.name, sector?.name].filter(Boolean).join(' ').toLowerCase();
                    const gradeStr = String(route.grade ?? '').toLowerCase();
                    const matchesSearch = route.name.toLowerCase().includes(searchTerm) ||
                                         route.description?.toLowerCase().includes(searchTerm) ||
                                         route.sector?.toLowerCase().includes(searchTerm) ||
                                         catalogStr.includes(searchTerm) ||
                                         gradeStr.includes(searchTerm);
                    const matchesGrade = !gradeFilter || route.grade === gradeFilter;
                    return matchesSearch && matchesGrade;
                });

                if (filteredRoutes.length === 0) {
                    routesList.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-search"></i>
                            <h3>Ничего не найдено</h3>
                            <p>Попробуйте изменить параметры поиска</p>
                        </div>
                    `;
                    return;
                }

                routesList.innerHTML = filteredRoutes.map(route => {
                    const sent = this.climbSentRowAttrs('route', route.id);
                    return `
                    <div class="list-item catalog-climb-row${sent.className}" data-id="${route.id}" data-open-climb="route" data-open-climb-id="${route.id}">
                        <button type="button" class="climb-row-open" aria-label="Просмотр: ${this.escapeHtml(route.name)}">
                            <div class="item-info">
                                <h3>${sent.badge}${this.escapeHtml(route.name)}</h3>
                                <div class="item-meta">
                                    ${route.sectorId != null && this.getStructureLabel(route.sectorId) ? `<span><i class="fas fa-layer-group"></i> ${this.getStructureLabel(route.sectorId)}</span>` : ''}
                                    <span>Категория: <span class="grade-badge grade-route">${this.escapeHtml(route.grade)}</span></span>
                                    ${route.category ? `<span><i class="fas fa-tag"></i> ${this.escapeHtml(route.category)}</span>` : ''}
                                    ${route.rating != null && route.rating !== '' ? `<span><i class="fas fa-star"></i> ${this.escapeHtml(formatStarAverage(route.rating))}</span>` : ''}
                                    ${route.length ? `<span><i class="fas fa-ruler-vertical"></i> ${this.escapeHtml(route.length)}м</span>` : ''}
                                    ${route.bolts ? `<span><i class="fas fa-bolt"></i> ${this.escapeHtml(route.bolts)} болтов</span>` : ''}
                                    ${route.sector ? `<span><i class="fas fa-map-marker-alt"></i> ${this.escapeHtml(route.sector)}</span>` : ''}
                                </div>
                                ${route.description ? `<p style="margin-top: 8px; color: var(--light-text);">${this.escapeHtml(route.description)}</p>` : ''}
                            </div>
                        </button>
                        <div class="item-actions ${this.isAdmin() ? '' : 'hidden-by-role'}">
                            <button type="button" class="btn btn-ghost btn-small" data-action="edit-route" data-route-id="${route.id}">
                                <i class="fas fa-edit"></i> Редактировать
                            </button>
                            <button type="button" class="btn btn-danger btn-small" data-action="delete-route" data-route-id="${route.id}">
                                <i class="fas fa-trash"></i> Удалить
                            </button>
                        </div>
                    </div>
                `;
                }).join('');
            }

            renderBoulders() {
                const bouldersList = document.getElementById('bouldersList');
                if (!bouldersList) return;
                const boulders = getBoulders();

                if (boulders.length === 0) {
                    bouldersList.innerHTML = `
                        <div class="empty-state">
                            <h3>Нет боулдерингов</h3>
                            <p>Список пуст. Данные можно наполнить вне интерфейса (например, импортом в localStorage).</p>
                        </div>
                    `;
                    return;
                }

                const searchTerm = document.getElementById('boulderSearch')?.value.toLowerCase() || '';
                const gradeFilter = document.getElementById('boulderGradeFilter')?.value || '';
                const hideSent = document.getElementById('hideSentBoulders')?.checked;

                const filteredBoulders = boulders.filter(boulder => {
                    if (hideSent && this.hasUserSent('boulder', boulder.id)) return false;
                    const sector = getSectors().find(s => Number(s.id) === Number(boulder.sectorId));
                    const area = sector ? getAreas().find(a => Number(a.id) === Number(sector.areaId)) : null;
                    const catalogStr = [area?.name, sector?.name].filter(Boolean).join(' ').toLowerCase();
                    const gradeStr = String(boulder.grade ?? '').toLowerCase();
                    const matchesSearch = boulder.name.toLowerCase().includes(searchTerm) ||
                                         boulder.description?.toLowerCase().includes(searchTerm) ||
                                         catalogStr.includes(searchTerm) ||
                                         gradeStr.includes(searchTerm);
                    const matchesGrade = !gradeFilter || boulder.grade === gradeFilter;
                    return matchesSearch && matchesGrade;
                });

                if (filteredBoulders.length === 0) {
                    bouldersList.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-search"></i>
                            <h3>Боулдеринги не найдены</h3>
                            <p>Попробуйте изменить параметры поиска</p>
                        </div>
                    `;
                    return;
                }

                bouldersList.innerHTML = filteredBoulders.map(boulder => {
                    const sent = this.climbSentRowAttrs('boulder', boulder.id);
                    return `
                    <div class="list-item catalog-climb-row${sent.className}" data-id="${boulder.id}" data-open-climb="boulder" data-open-climb-id="${boulder.id}">
                        <button type="button" class="climb-row-open" aria-label="Просмотр: ${this.escapeHtml(boulder.name)}">
                            <div class="item-info">
                                <h3>${sent.badge}${this.escapeHtml(boulder.name)}</h3>
                                <div class="item-meta">
                                    ${boulder.sectorId != null && this.getStructureLabel(boulder.sectorId) ? `<span><i class="fas fa-layer-group"></i> ${this.getStructureLabel(boulder.sectorId)}</span>` : ''}
                                    <span>Категория: <span class="grade-badge grade-boulder">${this.escapeHtml(boulder.grade)}</span></span>
                                    ${boulder.category ? `<span><i class="fas fa-tag"></i> ${this.escapeHtml(boulder.category)}</span>` : ''}
                                    ${boulder.rating != null && boulder.rating !== '' ? `<span><i class="fas fa-star"></i> ${this.escapeHtml(formatStarAverage(boulder.rating))}</span>` : ''}
                                    ${boulder.height ? `<span><i class="fas fa-ruler-vertical"></i> ${this.escapeHtml(boulder.height)}м</span>` : ''}
                                </div>
                                ${boulder.description ? `<p style="margin-top: 8px; color: var(--light-text);">${this.escapeHtml(boulder.description)}</p>` : ''}
                            </div>
                        </button>
                        <div class="item-actions ${this.isAdmin() ? '' : 'hidden-by-role'}">
                            <button type="button" class="btn btn-ghost btn-small" data-action="edit-boulder" data-boulder-id="${boulder.id}">
                                <i class="fas fa-edit"></i> Редактировать
                            </button>
                            <button type="button" class="btn btn-danger btn-small" data-action="delete-boulder" data-boulder-id="${boulder.id}">
                                <i class="fas fa-trash"></i> Удалить
                            </button>
                        </div>
                    </div>
                `;
                }).join('');
            }

            getPhotoClimbRecord(photo) {
                const cid = String(photo?.climbId ?? '');
                if (!cid) return null;
                return photo.type === 'route'
                    ? getRoutes().find((r) => String(r.id) === cid)
                    : getBoulders().find((b) => String(b.id) === cid);
            }

            renderPhotoAlbum() {
                const photoAlbum = document.getElementById('photoAlbum');
                const photos = getPhotos();
                const filterType = document.querySelector('#photos .filter-btn.active')?.dataset.type || 'all';
                const searchTerm = (document.getElementById('photoAlbumSearch')?.value || '').trim().toLowerCase();

                let filteredPhotos = photos;
                if (filterType === 'route' && !APP_BOULDER_ONLY) {
                    filteredPhotos = photos.filter(p => p.type === 'route');
                } else if (filterType === 'boulder') {
                    filteredPhotos = photos.filter(p => p.type === 'boulder');
                } else if (filterType === 'marked') {
                    filteredPhotos = photos.filter(p => p.markup);
                }

                if (searchTerm) {
                    filteredPhotos = filteredPhotos.filter((photo) => {
                        const climb = this.getPhotoClimbRecord(photo);
                        const name = (climb?.name || '').toLowerCase();
                        return name.includes(searchTerm);
                    });
                }

                if (filteredPhotos.length === 0) {
                    let emptyHint = APP_BOULDER_ONLY
                        ? 'Добавьте фотографии к боулдерингам'
                        : 'Добавьте фотографии к маршрутам или боулдерингам';
                    if (searchTerm) {
                        emptyHint = 'По этому названию ничего не найдено. Попробуйте другой запрос или сбросьте фильтры.';
                    } else if (filterType !== 'all') {
                        emptyHint = 'Для выбранного фильтра фотографии не найдены';
                    }
                    photoAlbum.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-${searchTerm ? 'search' : 'images'}"></i>
                            <h3>${searchTerm ? 'Ничего не найдено' : 'Нет фотографий'}</h3>
                            <p>${emptyHint}</p>
                        </div>
                    `;
                    return;
                }

                photoAlbum.innerHTML = filteredPhotos.map(photo => {
                    const climb = this.getPhotoClimbRecord(photo);
                    const struct = climb && climb.sectorId != null && this.getStructureLabel(climb.sectorId)
                        ? this.getStructureLabel(climb.sectorId)
                        : '';
                    const grade = climb && climb.grade != null && climb.grade !== ''
                        ? ` · ${this.escapeHtml(climb.grade)}`
                        : '';

                    const climbLabel = this.escapeHtml(climb ? climb.name : 'Неизвестно');
                    return `
                        <div class="photo-preview-with-markup photo-album-tile-wrap">
                            <button type="button" class="photo-album-open-btn" data-open-photo-id="${this.escapeHtml(String(photo.id))}" aria-label="Просмотр: ${climbLabel}">
                                <img src="" data-photo-id="${this.escapeHtml(String(photo.id))}" alt="${this.escapeHtml(photo.description || 'Фото')}">
                                ${photo.markup ? '<div class="markup-badge"><i class="fas fa-draw-polygon"></i> Размечено</div>' : ''}
                                <div class="photo-album-caption">
                                    <div><strong>${climbLabel}</strong>${grade}</div>
                                    ${struct ? `<div style="opacity:0.92;margin-top:2px;font-size:9px;">${this.escapeHtml(struct)}</div>` : ''}
                                </div>
                            </button>
                            <div class="photo-preview-actions">
                                <button type="button" class="remove-btn small ${this.isAdmin() ? '' : 'hidden-by-role'}" data-action="delete-photo" data-photo-id="${photo.id}">
                                    <i class="fas fa-times"></i> Удалить
                                </button>
                                <button type="button" class="markup-btn small ${photo.type} ${this.isAdmin() ? '' : 'hidden-by-role'}" data-action="edit-markup" data-photo-id="${photo.id}">
                                    <i class="fas fa-draw-polygon"></i> ${photo.markup ? 'Изменить' : 'Разметить'}
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');

                photoAlbum.querySelectorAll('.photo-album-tile-wrap').forEach((tile) => {
                    const pid = tile.querySelector('[data-open-photo-id]')?.dataset?.openPhotoId;
                    const photo = filteredPhotos.find((p) => String(p.id) === String(pid));
                    const img = tile.querySelector('img[data-photo-id]');
                    if (photo && img) {
                        loadImageIntoElement(img, photo);
                    }
                    if (photo?.markup) {
                        this.schedulePhotoMarkupOverlay(tile, photo.markup, photo.type);
                    }
                });

                this._photoAlbumNavList = filteredPhotos
                    .filter(photoHasDisplayImage)
                    .map((p) => ({
                        photoId: String(p.id),
                        climbType: p.type,
                        climbId: String(p.climbId)
                    }));
            }

            setupTabSwitching() {
                document.querySelectorAll('.tab-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        void (async () => {
                            const tabId = btn.dataset.tab;

                            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

                            btn.classList.add('active');
                            document.getElementById(tabId).classList.add('active');

                            if (tabId === 'map') {
                                void ensureLeafletLoaded()
                                    .then(() => {
                                        if (!this.map) {
                                            this.initMap();
                                        } else {
                                            this.syncMapAfterTabShow();
                                        }
                                    })
                                    .catch((err) => {
                                        console.warn('leaflet', err);
                                        this.showToast('Карта недоступна без сети', true);
                                    });
                            } else if (tabId === 'photos') {
                                try {
                                    await ensurePhotosLoadedFromApi();
                                } catch (err) {
                                    console.error(err);
                                    this.showToast('Не удалось загрузить фотографии', true);
                                }
                                this.renderPhotoAlbum();
                            } else if (tabId === 'catalog') {
                                this.renderCatalog();
                            } else if (tabId === 'routes') {
                                this.renderRoutes();
                            } else if (tabId === 'boulders') {
                                this.renderBoulders();
                            } else if (tabId === 'updates') {
                                this.renderUpdatesTab();
                            } else if (tabId === 'ranking') {
                                void this.renderRankingTab();
                            }
                            if (typeof window.syncTelegramMiniAppUi === 'function') {
                                window.syncTelegramMiniAppUi();
                            }
                        })();
                    });
                });
            }

            setupEventListeners() {
                this.setupAuthEventListeners();
                document.getElementById('catalog')?.addEventListener('click', (e) => this.handleCatalogClick(e));
                document.getElementById('catalogList')?.addEventListener('click', (e) => {
                    const editRoute = e.target.closest('[data-action="edit-route"]');
                    const editBoulder = e.target.closest('[data-action="edit-boulder"]');
                    if (editRoute) {
                        e.preventDefault();
                        if (!this.requireAdmin('Редактирование трассы')) return;
                        this.showEditRouteDialog(Number(editRoute.dataset.routeId));
                        return;
                    }
                    if (editBoulder) {
                        e.preventDefault();
                        if (!this.requireAdmin('Редактирование боулдеринга')) return;
                        this.showEditBoulderDialog(Number(editBoulder.dataset.boulderId));
                        return;
                    }
                });
                document.getElementById('cancelAreaBtn')?.addEventListener('click', () => this.hideDialog('areaDialog'));
                document.getElementById('areaSubmitBtn')?.addEventListener('click', () => {
                    if (!this.requireAdmin('Сохранение района')) return;
                    this.saveArea();
                });
                document.getElementById('areaPhoto')?.addEventListener('change', (e) => this.onAreaPhotoSelected(e));
                document.getElementById('areaPhotoClearBtn')?.addEventListener('click', () => this.clearAreaDialogPhoto());
                document.getElementById('cancelSectorBtn')?.addEventListener('click', () => this.hideDialog('sectorDialog'));
                document.getElementById('sectorSubmitBtn')?.addEventListener('click', () => {
                    if (!this.requireAdmin('Сохранение сектора')) return;
                    this.saveSector();
                });
                document.getElementById('cancelQuickRouteBtn')?.addEventListener('click', () => this.hideDialog('quickRouteDialog'));
                document.getElementById('saveQuickRouteBtn')?.addEventListener('click', () => this.saveQuickRoute());
                document.getElementById('cancelQuickBoulderBtn')?.addEventListener('click', () => this.hideDialog('quickBoulderDialog'));
                document.getElementById('saveQuickBoulderBtn')?.addEventListener('click', () => this.saveQuickBoulder());
                document.getElementById('quickRoutePhoto')?.addEventListener('change', (e) => this.onQuickDialogPhotoSelected('route', e));
                document.getElementById('quickBoulderPhoto')?.addEventListener('change', (e) => this.onQuickDialogPhotoSelected('boulder', e));
                document.getElementById('quickRouteMarkupBtn')?.addEventListener('click', () => this.openQuickDialogPhotoMarkup('route'));
                document.getElementById('quickBoulderMarkupBtn')?.addEventListener('click', () => this.openQuickDialogPhotoMarkup('boulder'));
                document.getElementById('quickRoutePhotoClearBtn')?.addEventListener('click', () => this.clearQuickDialogPhoto('route'));
                document.getElementById('quickBoulderPhotoClearBtn')?.addEventListener('click', () => this.clearQuickDialogPhoto('boulder'));
                document.querySelectorAll('[data-close-dialog]').forEach((btn) => {
                    btn.addEventListener('click', () => {
                        const dialogId = btn.getAttribute('data-close-dialog');
                        if (dialogId) this.hideDialog(dialogId);
                    });
                });
                document.querySelectorAll('[data-map-filter]').forEach((btn) => {
                    btn.addEventListener('click', () => {
                        this.setMapFilter(btn.getAttribute('data-map-filter') || 'all');
                    });
                });
                document.getElementById('mapLocateBtn')?.addEventListener('click', () => {
                    this.startUserLocationWatch();
                });
                document.getElementById('mapTargetBtn')?.addEventListener('click', () => {
                    this.focusCurrentMapTarget();
                });
                document.getElementById('mapExternalNavBtn')?.addEventListener('click', () => {
                    this.openExternalNavigation();
                });
                document.getElementById('mapToolbar')?.addEventListener('click', (e) => {
                    const resetBtn = e.target.closest('#mapScopeResetBtn');
                    if (resetBtn) {
                        e.preventDefault();
                        this.clearMapScope();
                        return;
                    }
                    const guideBtn = e.target.closest('#mapGuideOpenBtn');
                    if (guideBtn && this.mapTarget) {
                        e.preventDefault();
                        this.openCatalogFromMap(this.mapTarget.kind, this.mapTarget.id);
                        return;
                    }
                    const packBtn = e.target.closest('#mapOfflinePackBtn');
                    if (packBtn) {
                        e.preventDefault();
                        const scope = packBtn.dataset.packScope === 'sector' ? 'sector' : 'area';
                        void this.downloadOfflinePack(scope, Number(packBtn.dataset.id));
                    }
                });
                document.querySelectorAll('.star-rating').forEach((wrap) => {
                    const targetId = wrap.getAttribute('data-rating-target');
                    wrap.querySelectorAll('.star-btn').forEach((btn) => {
                        btn.addEventListener('click', () => {
                            const hidden = document.getElementById(targetId);
                            const next = String(btn.dataset.value || '');
                            const current = String(hidden?.value || '');
                            this.setStarRating(targetId, current === next ? '' : next);
                        });
                    });
                });

                document.getElementById('catalogList')?.addEventListener('click', (e) => {
                    const delRoute = e.target.closest('[data-action="delete-route"]');
                    const delBoulder = e.target.closest('[data-action="delete-boulder"]');
                    if (delRoute) {
                        e.preventDefault();
                        if (!this.requireAdmin('Удаление трассы')) return;
                        this.deleteRoute(Number(delRoute.dataset.routeId));
                    } else if (delBoulder) {
                        e.preventDefault();
                        if (!this.requireAdmin('Удаление боулдера')) return;
                        this.deleteBoulder(Number(delBoulder.dataset.boulderId));
                    }
                });

                // Поиск и фильтры
                const searchDebounceMs = 200;
                document.getElementById('routeSearch')?.addEventListener('input', () => {
                    clearTimeout(this._routeSearchDebounceTimer);
                    this._routeSearchDebounceTimer = setTimeout(() => this.renderRoutes(), searchDebounceMs);
                });
                document.getElementById('boulderSearch')?.addEventListener('input', () => {
                    clearTimeout(this._boulderSearchDebounceTimer);
                    this._boulderSearchDebounceTimer = setTimeout(() => this.renderBoulders(), searchDebounceMs);
                });
                document.getElementById('globalSearch')?.addEventListener('input', () => {
                    clearTimeout(this._globalSearchDebounceTimer);
                    this._globalSearchDebounceTimer = setTimeout(() => this.renderGlobalSearchResults(), searchDebounceMs);
                });
                document.getElementById('globalSearchResults')?.addEventListener('click', (e) => {
                    const item = e.target.closest('[data-global-kind]');
                    if (!item) return;
                    e.preventDefault();
                    this.openGlobalSearchResult(item.dataset.globalKind, Number(item.dataset.id));
                });
                document.getElementById('updatesFilters')?.addEventListener('click', (e) => {
                    const btn = e.target.closest('[data-update-filter]');
                    if (!btn) return;
                    e.preventDefault();
                    this.updatesFilter = btn.dataset.updateFilter || 'all';
                    this.renderUpdatesTab();
                });
                document.getElementById('updatesFeed')?.addEventListener('click', (e) => {
                    const item = e.target.closest('[data-update-kind]');
                    if (!item) return;
                    e.preventDefault();
                    this.openUpdatesFeedTarget(item.dataset.updateKind, Number(item.dataset.id));
                });
                document.getElementById('routeGradeFilter')?.addEventListener('change', () => {
                    this.renderRoutes();
                    this._syncVisualGradeFilter(
                        document.getElementById('routeGradeVisualStrip'),
                        document.getElementById('routeGradeFilter')?.value || '',
                        document.getElementById('routeGradeToggleBtn'),
                        document.getElementById('routeGradeFilter')
                    );
                });
                document.getElementById('boulderGradeFilter')?.addEventListener('change', () => {
                    this.renderBoulders();
                    this._syncVisualGradeFilter(
                        document.getElementById('boulderGradeVisualStrip'),
                        document.getElementById('boulderGradeFilter')?.value || '',
                        document.getElementById('boulderGradeToggleBtn'),
                        document.getElementById('boulderGradeFilter')
                    );
                });
                this.initVisualGradeFilters();

                document.addEventListener('click', (e) => {
                    if (e.target && e.target.closest && e.target.closest('.grade-picker')) return;
                    if (e.target && e.target.closest && e.target.closest('.global-search-wrap')) return;
                    const box = document.getElementById('globalSearchResults');
                    box?.classList.add('hidden');
                    this._closeAllGradePickers();
                });
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') {
                        if (typeof window.closeTopTelegramOverlay === 'function' && window.closeTopTelegramOverlay()) {
                            e.preventDefault();
                            return;
                        }
                        document.getElementById('globalSearchResults')?.classList.add('hidden');
                        this._closeAllGradePickers();
                    }
                });

                // Поиск и фильтры фотоальбома
                document.getElementById('photoAlbumSearch')?.addEventListener('input', () => {
                    clearTimeout(this._photoAlbumSearchDebounceTimer);
                    this._photoAlbumSearchDebounceTimer = setTimeout(() => this.renderPhotoAlbum(), searchDebounceMs);
                });
                document.querySelectorAll('#photos .filter-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        document.querySelectorAll('#photos .filter-btn').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        this.renderPhotoAlbum();
                    });
                });

                // Слушатели для диалога разметки трасс (линии)
                document.getElementById('clearRouteLineMarkupBtn').addEventListener('click', () => {
                    this.clearRouteLineMarkup();
                });
                document.getElementById('saveRouteLineMarkupBtn').addEventListener('click', () => {
                    if (!this.requireAdmin('Сохранение разметки')) return;
                    this.saveRouteLineMarkup();
                });

                document.getElementById('routeLineMarkupDialog')?.addEventListener('click', (e) => {
                    const modeBtn = e.target.closest('.route-markup-mode-btn');
                    if (!modeBtn) return;
                    e.preventDefault();
                    this.routeMarkupMode = modeBtn.dataset.mode || 'line';
                    this.syncRouteMarkupModeUI();
                });

                // Слушатели для диалога разметки боулдеринга (зацепки)
                document.getElementById('clearBoulderHoldsMarkupBtn').addEventListener('click', () => {
                    this.clearBoulderHoldsMarkup();
                });
                document.getElementById('saveBoulderHoldsMarkupBtn').addEventListener('click', () => {
                    if (!this.requireAdmin('Сохранение разметки')) return;
                    this.saveBoulderHoldsMarkup();
                });

                document.getElementById('boulderHoldsMarkupDialog')?.addEventListener('click', (e) => {
                    const modeBtn = e.target.closest('.boulder-markup-mode-btn');
                    if (!modeBtn) return;
                    e.preventDefault();
                    this.boulderMarkupMode = modeBtn.dataset.mode || 'circles';
                    this.syncBoulderMarkupModeUI();
                });

                document.getElementById('routesList')?.addEventListener('click', (e) => {
                    const editBtn = e.target.closest('[data-action="edit-route"]');
                    if (editBtn) {
                        e.preventDefault();
                        if (!this.requireAdmin('Редактирование трассы')) return;
                        this.showEditRouteDialog(Number(editBtn.dataset.routeId));
                        return;
                    }
                    const deleteBtn = e.target.closest('[data-action="delete-route"]');
                    if (deleteBtn) {
                        e.preventDefault();
                        if (!this.requireAdmin('Удаление трассы')) return;
                        this.deleteRoute(Number(deleteBtn.dataset.routeId));
                        return;
                    }
                    const row = e.target.closest('[data-open-climb="route"]');
                    if (row && !e.target.closest('[data-action]')) {
                        const oid = Number(row.dataset.openClimbId);
                        if (Number.isFinite(oid)) this.showClimbDetailDialog('route', oid);
                    }
                });

                document.getElementById('bouldersList')?.addEventListener('click', (e) => {
                    const editBtn = e.target.closest('[data-action="edit-boulder"]');
                    if (editBtn) {
                        e.preventDefault();
                        if (!this.requireAdmin('Редактирование боулдеринга')) return;
                        this.showEditBoulderDialog(Number(editBtn.dataset.boulderId));
                        return;
                    }
                    const deleteBtn = e.target.closest('[data-action="delete-boulder"]');
                    if (deleteBtn) {
                        e.preventDefault();
                        if (!this.requireAdmin('Удаление боулдера')) return;
                        this.deleteBoulder(Number(deleteBtn.dataset.boulderId));
                        return;
                    }
                    const row = e.target.closest('[data-open-climb="boulder"]');
                    if (row && !e.target.closest('[data-action]')) {
                        const oid = Number(row.dataset.openClimbId);
                        if (Number.isFinite(oid)) this.showClimbDetailDialog('boulder', oid);
                    }
                });

                document.getElementById('climbDetailMarkupBtn')?.addEventListener('click', () => {
                    const ctx = this._climbDetailContext;
                    if (!ctx) return;
                    const t = ctx.climbType;
                    const id = ctx.climbId;
                    const pid = ctx.shownPhotoId || ctx.photoId;
                    if (pid) {
                        this.openPhotoMarkupView(pid);
                    } else {
                        this.openClimbMarkupView(t, id);
                    }
                });
                document.getElementById('climbDetailSavePhotoBtn')?.addEventListener('click', () => {
                    void this.saveClimbDetailPhotoFromUserGesture();
                });
                document.getElementById('climbDetailMapBtn')?.addEventListener('click', () => {
                    const ctx = this._climbDetailContext;
                    if (!ctx) return;
                    void this.focusMapTarget(ctx.climbType, ctx.climbId);
                });
                document.getElementById('climbDetailEditBtn')?.addEventListener('click', () => {
                    const ctx = this._climbDetailContext;
                    if (!ctx) return;
                    if (ctx.climbType === 'route') {
                        this.hideDialog('climbDetailDialog');
                        this.showEditRouteDialog(Number(ctx.climbId));
                    } else {
                        this.hideDialog('climbDetailDialog');
                        this.showEditBoulderDialog(Number(ctx.climbId));
                    }
                });
                document.getElementById('climbDetailDeleteBtn')?.addEventListener('click', () => {
                    const ctx = this._climbDetailContext;
                    if (!ctx) return;
                    if (ctx.climbType === 'route') {
                        void this.deleteRoute(Number(ctx.climbId));
                    } else {
                        void this.deleteBoulder(Number(ctx.climbId));
                    }
                });
                this.setupClimbPhotoViewerListeners();

                document.getElementById('climbDetailOpenLogBtn')?.addEventListener('click', () => {
                    void this.openClimbLogDialog();
                });
                document.getElementById('climbTgLogConfirmBtn')?.addEventListener('click', () => {
                    void this.logClimbAscentFromDetail('send').catch((err) => this.showToast(err.message, true));
                });
                document.getElementById('climbLogConfirmBtn')?.addEventListener('click', () => {
                    void this.logClimbAscentFromDetail('send').catch((err) => this.showToast(err.message, true));
                });

                document.getElementById('photoAlbum')?.addEventListener('click', (e) => {
                    const deleteBtn = e.target.closest('[data-action="delete-photo"]');
                    const markupBtn = e.target.closest('[data-action="edit-markup"]');
                    if (deleteBtn) {
                        e.preventDefault();
                        if (!this.requireAdmin('Удаление фото')) return;
                        this.deletePhoto(deleteBtn.dataset.photoId);
                        return;
                    }
                    if (markupBtn) {
                        e.preventDefault();
                        if (!this.requireAdmin('Разметка фото')) return;
                        this.editPhotoMarkup(markupBtn.dataset.photoId);
                        return;
                    }
                    const tile = e.target.closest('[data-open-photo-id]');
                    if (tile && !e.target.closest('[data-action]')) {
                        e.preventDefault();
                        const ph = getPhotos().find((p) => String(p.id) === String(tile.dataset.openPhotoId));
                        if (ph && ph.climbId != null && ph.climbId !== '') {
                            this.showClimbDetailDialog(ph.type, ph.climbId, {
                                preferPhotoId: ph.id,
                                albumNav: true
                            });
                        } else {
                            this.openPhotoMarkupView(tile.dataset.openPhotoId);
                        }
                    }
                });

                window.addEventListener('resize', () => {
                    if (this.map) this.map.invalidateSize({ animate: false });
                    if (window.app && typeof window.app.refreshClimbDetailMarkupOverlayIfOpen === 'function') {
                        window.app.refreshClimbDetailMarkupOverlayIfOpen();
                    }
                    const viewerMount = document.getElementById('climbPhotoViewerMount');
                    const viewer = document.getElementById('climbPhotoViewer');
                    if (
                        viewer &&
                        !viewer.classList.contains('hidden') &&
                        window.app?._photoGallery?.entries?.length
                    ) {
                        const entry = window.app._photoGallery.entries[window.app._photoGallery.index];
                        if (entry && viewerMount) {
                            window.app.schedulePhotoMarkupOverlay(
                                viewerMount,
                                entry.photo.markup || null,
                                entry.climbType
                            );
                        }
                    }
                });
            }

            syncBodyDialogScreenLock() {
                const open = !!document.querySelector('.dialog-overlay:not(.hidden)');
                document.body.classList.toggle('dialog-screen-open', open);
            }

            showDialog(dialogId) {
                const el = document.getElementById(dialogId);
                if (!el) return;
                el.classList.remove('hidden');
                this.syncBodyDialogScreenLock();
                if (typeof window.applyTelegramMainButtonForDialog === 'function') {
                    window.applyTelegramMainButtonForDialog(dialogId);
                }
                if (typeof window.syncTelegramMiniAppUi === 'function') {
                    window.syncTelegramMiniAppUi();
                }
            }

            hideDialog(dialogId) {
                const el = document.getElementById(dialogId);
                if (!el || el.classList.contains('hidden')) return;
                el.classList.add('hidden');
                this.syncBodyDialogScreenLock();
                this.currentPhotoPreview = null;
                if (dialogId === 'routeLineMarkupDialog') {
                    this._routeLineMarkupAbort?.abort();
                    this._markupDialogViewOnly = false;
                    this.resetRouteMarkupDialogChrome();
                    this.refreshClimbDetailMarkupOverlayIfOpen();
                }
                if (dialogId === 'boulderHoldsMarkupDialog') {
                    this._boulderHoldsMarkupAbort?.abort();
                    this._markupDialogViewOnly = false;
                    this.resetBoulderMarkupDialogChrome();
                    this.refreshClimbDetailMarkupOverlayIfOpen();
                }
                if (dialogId === 'climbLogDialog') {
                    const formEl = document.getElementById('climbLogForm');
                    if (formEl) formEl.innerHTML = '';
                }
                if (dialogId === 'climbDetailDialog') {
                    this.closeClimbPhotoViewer();
                    const logDlg = document.getElementById('climbLogDialog');
                    if (logDlg && !logDlg.classList.contains('hidden')) {
                        this.hideDialog('climbLogDialog');
                    }
                    this._photoGallery = null;
                    this._climbDetailImgGen = (this._climbDetailImgGen || 0) + 1;
                    const detailType = this._climbDetailContext?.climbType || 'route';
                    this._climbDetailContext = null;
                    const img = document.getElementById('climbDetailImage');
                    if (img) {
                        img.onload = null;
                        img.onerror = null;
                        img.removeAttribute('src');
                    }
                    const mount = document.getElementById('climbDetailPhotoMount');
                    if (mount) this.applyPhotoPreviewMarkupOverlay(mount, null, detailType);
                    document.getElementById('climbDetailImageWrap')?.classList.add('hidden');
                    document.getElementById('climbDetailNoPhoto')?.classList.add('hidden');
                    document.getElementById('climbDetailSaveRow')?.classList.add('hidden');
                    document.getElementById('climbDetailSaveHint')?.classList.add('hidden');
                }
                if (typeof window.syncTelegramMiniAppUi === 'function') {
                    window.syncTelegramMiniAppUi();
                }
            }

            showToast(message, isError = false) {
                const toast = document.createElement('div');
                toast.className = `toast ${isError ? 'error' : 'success'}`;
                toast.textContent = message;
                document.body.appendChild(toast);

                setTimeout(() => {
                    toast.remove();
                }, 3000);
            }

            async deleteRoute(routeId) {
                if (!this.requireAdmin('Удаление трассы')) return;
                if (!confirm('Удалить эту трассу? Все связанные фотографии также будут удалены.')) {
                    return;
                }
                try {
                    await apiFetch(`/api/routes/${Number(routeId)}`, { method: 'DELETE' });
                    removeRouteFromLocalCache(routeId);
                } catch (err) {
                    this.showToast(`Ошибка удаления трассы: ${err.message}`, true);
                    return;
                }

                this.data = getClimbingData();
                this.renderRoutes();
                this.renderCatalog();
                this.updateMapMarkers();
                if (document.getElementById('photos')?.classList.contains('active')) {
                    const run = () => this.renderPhotoAlbum();
                    if (typeof requestAnimationFrame === 'function') {
                        requestAnimationFrame(() => requestAnimationFrame(run));
                    } else run();
                }
                void this.loadAscentSummary();
                void this.refreshProfileLogbookSection();
                if (this._climbDetailContext?.climbType === 'route' && Number(this._climbDetailContext.climbId) === Number(routeId)) {
                    this.hideDialog('climbDetailDialog');
                }
                this.showToast('Трасса удалена');
            }

            async deleteBoulder(boulderId) {
                if (!this.requireAdmin('Удаление боулдера')) return;
                if (!confirm('Удалить этот боулдеринг? Все связанные фотографии также будут удалены.')) {
                    return;
                }
                try {
                    await apiFetch(`/api/boulders/${Number(boulderId)}`, { method: 'DELETE' });
                    removeBoulderFromLocalCache(boulderId);
                } catch (err) {
                    this.showToast(`Ошибка удаления боулдера: ${err.message}`, true);
                    return;
                }

                this.data = getClimbingData();
                this.renderBoulders();
                this.renderCatalog();
                this.updateMapMarkers();
                if (document.getElementById('photos')?.classList.contains('active')) {
                    const run = () => this.renderPhotoAlbum();
                    if (typeof requestAnimationFrame === 'function') {
                        requestAnimationFrame(() => requestAnimationFrame(run));
                    } else run();
                }
                void this.loadAscentSummary();
                void this.refreshProfileLogbookSection();
                if (this._climbDetailContext?.climbType === 'boulder' && Number(this._climbDetailContext.climbId) === Number(boulderId)) {
                    this.hideDialog('climbDetailDialog');
                }
                this.showToast('Боулдеринг удален');
            }

            // Методы для работы с фотографиями
            handlePhotoPreview(event, previewContainerId, climbType = null, climbId = null) {
                if (!this.requireAdmin('Добавление фотографии')) {
                    event.target.value = '';
                    return;
                }
                const file = event.target.files[0];
                if (!file) return;

                if (!file.type.match('image.*')) {
                    this.showToast('Пожалуйста, выберите файл изображения', true);
                    return;
                }

                if (file.size > MAX_PHOTO_SIZE_BYTES) {
                    this.showToast(`Размер файла не должен превышать ${MAX_PHOTO_SIZE_MB}MB`, true);
                    return;
                }

                const reader = new FileReader();
                reader.onload = (e) => {
                    const previewContainer = document.getElementById(previewContainerId);

                    const previewItem = document.createElement('div');
                    previewItem.className = 'photo-preview-with-markup';

                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.alt = 'Preview';

                    const actionsDiv = document.createElement('div');
                    actionsDiv.className = 'photo-preview-actions';

                    const removeBtn = document.createElement('button');
                    removeBtn.type = 'button';
                    removeBtn.className = `remove-btn small ${this.isAdmin() ? '' : 'hidden-by-role'}`.trim();
                    removeBtn.innerHTML = '<i class="fas fa-times"></i> Удалить';
                    removeBtn.addEventListener('click', (removeEvent) => {
                        removeEvent.preventDefault();
                        removeEvent.stopPropagation();
                        previewItem.remove();
                        event.target.value = '';
                        this.currentPhotoPreview = null;
                    });

                    actionsDiv.appendChild(removeBtn);

                    // Добавляем кнопку разметки только если известен тип маршрута
                    if (climbType) {
                        const markupBtn = document.createElement('button');
                        markupBtn.type = 'button';
                        markupBtn.className = `markup-btn small ${climbType} ${this.isAdmin() ? '' : 'hidden-by-role'}`.trim();
                        markupBtn.innerHTML = `<i class="fas fa-draw-polygon"></i> Разметить`;
                        markupBtn.addEventListener('click', (markupEvent) => {
                            markupEvent.preventDefault();
                            markupEvent.stopPropagation();
                            // Для нового (ещё не сохранённого) фото используем временный id:
                            // тогда разметка пишется в превью и уйдёт в POST /api/photos вместе с фото.
                            const previewPayload = this.currentPhotoPreview || {
                                data: e.target.result,
                                fileName: file.name,
                                type: file.type,
                                climbType: climbType,
                                climbId: `temp-detail-${climbType}-${Date.now()}`,
                                markup: null
                            };
                            this.currentPhotoPreview = previewPayload;

                            if (climbType === 'route') {
                                this.showRouteLineMarkupDialog(previewPayload);
                            } else if (climbType === 'boulder') {
                                this.showBoulderHoldsMarkupDialog(previewPayload);
                            }
                        });

                        actionsDiv.appendChild(markupBtn);
                    }

                    previewItem.appendChild(img);
                    previewItem.appendChild(actionsDiv);

                    // Если есть старые превью, заменяем их
                    const oldItems = previewContainer.querySelectorAll('.photo-preview-with-markup');
                    oldItems.forEach(item => item.remove());

                    previewItem.dataset.climbType = climbType || '';

                    previewContainer.appendChild(previewItem);

                    // Сохраняем превью для последующего сохранения
                    this.currentPhotoPreview = {
                        data: e.target.result,
                        fileName: file.name,
                        type: file.type,
                        climbType: climbType,
                        climbId: `temp-detail-${climbType}-${Date.now()}`,
                        markup: null
                    };

                    this.applyPhotoPreviewMarkupOverlay(previewItem, this.currentPhotoPreview.markup, climbType);
                };
                reader.readAsDataURL(file);
            }

            buildPhotoMarkupOverlaySvg(markup, climbType, geom = null) {
                const NS = 'http://www.w3.org/2000/svg';
                const svg = document.createElementNS(NS, 'svg');
                svg.setAttribute('class', 'photo-markup-overlay');
                svg.setAttribute('viewBox', '0 0 1 1');
                svg.setAttribute('preserveAspectRatio', 'none');
                svg.setAttribute('aria-hidden', 'true');

                if (!markup) return svg;

                if (climbType === 'route' && markup.type === 'route-line') {
                    const pts = markup.points || [];
                    const starts = markup.startHolds || [];
                    appendTopoLineSvg(svg, NS, pts, geom);
                    starts.forEach((p, index) => appendTopoHoldSvg(svg, NS, p, index, geom));
                } else if (climbType === 'boulder' && markup.type === 'boulder-holds') {
                    const holds = markup.holds || [];
                    const linePts = markup.linePoints || [];
                    appendTopoLineSvg(svg, NS, linePts, geom);
                    holds.forEach((h, index) => appendTopoHoldSvg(svg, NS, h, index, geom));
                }

                return svg;
            }

            updatePreviewMarkupBadge(previewItem, hasMarkup) {
                let badge = previewItem.querySelector('.markup-badge');
                if (hasMarkup) {
                    if (!badge) {
                        badge = document.createElement('div');
                        badge.className = 'markup-badge';
                        badge.innerHTML = '<i class="fas fa-draw-polygon"></i> Размечено';
                        previewItem.appendChild(badge);
                    }
                } else if (badge) {
                    badge.remove();
                }
            }

            schedulePhotoMarkupOverlay(previewItem, markup, climbType) {
                if (!previewItem) return;
                const normalized = normalizePhotoMarkup(markup, climbType);
                const apply = () => this.applyPhotoPreviewMarkupOverlay(previewItem, normalized, climbType);
                const img = previewItem.querySelector('img');
                if (!img) {
                    apply();
                    return;
                }
                const run = () => requestAnimationFrame(() => requestAnimationFrame(apply));
                if (img._markupOverlayOnLoad) {
                    img.removeEventListener('load', img._markupOverlayOnLoad);
                }
                img._markupOverlayOnLoad = run;
                img.addEventListener('load', run);
                if (img.complete && img.naturalWidth > 0) {
                    run();
                }
            }

            applyPhotoPreviewMarkupOverlay(previewItem, markup, climbType) {
                if (!previewItem) return;
                previewItem.querySelectorAll('.photo-markup-overlay').forEach(el => el.remove());

                const normalized = normalizePhotoMarkup(markup, climbType);
                if (!normalized) {
                    this.updatePreviewMarkupBadge(previewItem, false);
                    return;
                }

                const geom = getMarkupStageGeometry(previewItem);
                if (!isMarkupStageReady(geom)) {
                    return;
                }
                let markupForSvg = normalized;
                if (climbType === 'route' && normalized.coordSpace !== 'image') {
                    markupForSvg = {
                        ...normalized,
                        points: (normalized.points || []).map((p) => boulderStoredToImageNorm(p, geom, false)),
                        startHolds: (normalized.startHolds || []).map((p) => boulderStoredToImageNorm(p, geom, false))
                    };
                } else if (climbType === 'boulder' && normalized.coordSpace !== 'image') {
                    markupForSvg = {
                        ...normalized,
                        holds: (normalized.holds || []).map((h) => boulderStoredToImageNorm(h, geom, false)),
                        linePoints: (normalized.linePoints || []).map((p) => boulderStoredToImageNorm(p, geom, false))
                    };
                }

                const svg = this.buildPhotoMarkupOverlaySvg(markupForSvg, climbType, geom);
                svg.style.left = `${geom.left}px`;
                svg.style.top = `${geom.top}px`;
                svg.style.width = `${geom.iw}px`;
                svg.style.height = `${geom.ih}px`;
                const img = previewItem.querySelector('img');
                if (img && svg.nextSibling !== img && img.parentNode === previewItem) {
                    previewItem.insertBefore(svg, img.nextSibling);
                } else {
                    const actions = previewItem.querySelector('.photo-preview-actions');
                    if (actions) {
                        previewItem.insertBefore(svg, actions);
                    } else {
                        previewItem.appendChild(svg);
                    }
                }

                this.updatePreviewMarkupBadge(previewItem, true);
            }

            syncMarkupButtonOnPreviewItem(previewItem, hasMarkup) {
                const btn = previewItem?.querySelector('.markup-btn');
                if (!btn) return;
                btn.innerHTML = `<i class="fas fa-draw-polygon"></i> ${hasMarkup ? 'Изменить' : 'Разметить'}`;
            }

            /** Превью в форме добавления: id нет или временный (temp / temp-…) */
            isFormTempPhotoMarkupId(photoId) {
                const s = photoId == null ? '' : String(photoId);
                return s === '' || s === 'temp' || s.startsWith('temp-');
            }

            refreshClimbDetailMarkupOverlayIfOpen() {
                const dlg = document.getElementById('climbDetailDialog');
                const ctx = this._climbDetailContext;
                if (!dlg || dlg.classList.contains('hidden') || !ctx) return;
                const mount = document.getElementById('climbDetailPhotoMount');
                if (!mount) return;
                const g = this._photoGallery;
                const fromGallery = g?.entries?.[g.index]?.photo;
                let photo = fromGallery;
                if (!photo) {
                    const idStr = String(ctx.climbId);
                    const photos = getPhotos().filter(
                        (p) => p.type === ctx.climbType && String(p.climbId) === idStr
                    );
                    photo = pickClimbDetailPhoto(photos, ctx.shownPhotoId || ctx.photoId);
                }
                this.schedulePhotoMarkupOverlay(mount, photo?.markup || null, ctx.climbType);
            }

            refreshDialogPhotoMarkupAfterMarkupSave() {
                if (!this.currentPhotoPreview) return;
                const boxId = this.currentPhotoPreview.previewBoxId
                    || (this.currentPhotoPreview.climbType === 'route' ? 'routePhotoPreview' : 'boulderPhotoPreview');
                const box = document.getElementById(boxId);
                const item = box?.querySelector('.photo-preview-with-markup');
                if (!item) return;
                this.schedulePhotoMarkupOverlay(
                    item,
                    this.currentPhotoPreview.markup,
                    this.currentPhotoPreview.climbType
                );
                this.syncMarkupButtonOnPreviewItem(item, !!this.currentPhotoPreview.markup);
                if (boxId === 'quickRoutePhotoPreview' && this.quickRoutePhotoData) {
                    this.quickRoutePhotoData.markup = this.currentPhotoPreview.markup || null;
                }
                if (boxId === 'quickBoulderPhotoPreview' && this.quickBoulderPhotoData) {
                    this.quickBoulderPhotoData.markup = this.currentPhotoPreview.markup || null;
                }
            }

            createPhotoPreviewItem(photo, previewContainer, climbType, climbId) {
                const previewItem = document.createElement('div');
                previewItem.className = 'photo-preview-with-markup';
                previewItem.dataset.climbType = climbType;
                previewItem.dataset.photoId = String(photo.id);

                const img = document.createElement('img');
                img.alt = photo.description || 'Фото маршрута';
                loadImageIntoElement(img, photo);

                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'photo-preview-actions';

                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = `remove-btn small ${this.isAdmin() ? '' : 'hidden-by-role'}`.trim();
                removeBtn.innerHTML = '<i class="fas fa-times"></i> Удалить';
                removeBtn.addEventListener('click', async (removeEvent) => {
                    removeEvent.preventDefault();
                    removeEvent.stopPropagation();
                    try {
                        await apiFetch(`/api/photos/${Number(photo.id)}`, { method: 'DELETE' });
                        removePhotoFromLocalCache(photo.id);
                        previewItem.remove();
                        this.showToast('Фотография удалена');
                        this.renderPhotoAlbum();
                    } catch (err) {
                        this.showToast(`Ошибка удаления фото: ${err.message}`, true);
                    }
                });

                actionsDiv.appendChild(removeBtn);

                // Добавляем кнопку разметки
                const markupBtn = document.createElement('button');
                markupBtn.type = 'button';
                markupBtn.className = `markup-btn small ${climbType} ${this.isAdmin() ? '' : 'hidden-by-role'}`.trim();
                markupBtn.innerHTML = `<i class="fas fa-draw-polygon"></i> ${photo.markup ? 'Изменить' : 'Разметить'}`;
                markupBtn.addEventListener('click', (markupEvent) => {
                    markupEvent.preventDefault();
                    markupEvent.stopPropagation();

                    if (climbType === 'route') {
                        this.showExistingPhotoRouteLineMarkup(photo, climbId, false);
                    } else if (climbType === 'boulder') {
                        this.showExistingPhotoBoulderHoldsMarkup(photo, climbId, false);
                    }
                });

                actionsDiv.appendChild(markupBtn);

                previewItem.appendChild(img);
                previewItem.appendChild(actionsDiv);

                previewContainer.appendChild(previewItem);
                this.schedulePhotoMarkupOverlay(previewItem, photo.markup, climbType);
            }

            async savePhoto(climbId, type) {
                if (!this.requireAdmin('Добавление фотографии')) return;
                if (!this.currentPhotoPreview) return;
                const payload = {
                    climb_type: type,
                    route_id: type === 'route' ? Number(climbId) : null,
                    boulder_id: type === 'boulder' ? Number(climbId) : null,
                    image_url: this.currentPhotoPreview.data,
                    description: `Фотография ${type === 'route' ? 'трассы' : 'боулдеринга'}`,
                    file_name: this.currentPhotoPreview.fileName || null,
                    mime_type: this.currentPhotoPreview.type || null,
                    markup: this.currentPhotoPreview.markup || null
                };
                try {
                    const created = await apiFetch('/api/photos', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    appendPhotoFromApiResponse(created);
                } catch (err) {
                    this.showToast(`Ошибка сохранения фото: ${err.message}`, true);
                    return;
                }

                this.currentPhotoPreview = null;
                this.renderPhotoAlbum();
                this.showToast('Фотография сохранена');
            }

            async deletePhoto(photoId) {
                if (!this.requireAdmin('Удаление фото')) return;
                if (!confirm('Удалить эту фотографию?')) {
                    return;
                }
                try {
                    await apiFetch(`/api/photos/${Number(photoId)}`, { method: 'DELETE' });
                    removePhotoFromLocalCache(photoId);
                    this.renderPhotoAlbum();
                    this.showToast('Фотография удалена');
                } catch (err) {
                    this.showToast(`Ошибка удаления фото: ${err.message}`, true);
                }
            }

            editPhotoMarkup(photoId) {
                if (!this.requireAdmin('Разметка фото')) return;
                const photo = getPhotos().find((p) => String(p.id) === String(photoId));
                if (!photo) return;

                if (photo.type === 'route') {
                    this.showExistingPhotoRouteLineMarkup(photo, photo.climbId, false);
                } else if (photo.type === 'boulder') {
                    this.showExistingPhotoBoulderHoldsMarkup(photo, photo.climbId, false);
                }
            }

            buildPhotoGalleryEntries(climbType, climbId, climbPhotos, opts = {}) {
                if (opts.albumNav && this._photoAlbumNavList?.length) {
                    return this._photoAlbumNavList
                        .map((nav) => {
                            const photo = getPhotos().find(
                                (p) =>
                                    String(p.id) === String(nav.photoId) &&
                                    photoHasDisplayImage(p)
                            );
                            return photo
                                ? {
                                      photo,
                                      climbType: nav.climbType,
                                      climbId: String(nav.climbId)
                                  }
                                : null;
                        })
                        .filter(Boolean);
                }
                return (climbPhotos || [])
                    .filter(photoHasDisplayImage)
                    .map((photo) => ({
                        photo,
                        climbType,
                        climbId: String(climbId)
                    }));
            }

            initPhotoGallery(entries, startPhotoId, source) {
                if (!entries?.length) return null;
                let index = 0;
                if (startPhotoId != null) {
                    const i = entries.findIndex(
                        (e) => String(e.photo.id) === String(startPhotoId)
                    );
                    if (i >= 0) index = i;
                }
                return { entries, index, source: source || 'climb' };
            }

            updateClimbDetailPhotoCounter() {
                const g = this._photoGallery;
                const counter = document.getElementById('climbDetailPhotoCounter');
                const hint = document.getElementById('climbDetailPhotoSwipeHint');
                const total = g?.entries?.length || 0;
                const multi = total > 1;
                if (counter) {
                    counter.classList.toggle('hidden', !multi);
                    counter.setAttribute('aria-hidden', multi ? 'false' : 'true');
                    counter.textContent = multi ? `${g.index + 1} / ${total}` : '';
                }
                if (hint) hint.classList.toggle('hidden', !multi);
            }

            updatePhotoViewerChrome() {
                const g = this._photoGallery;
                const entry = g?.entries?.[g.index];
                const titleEl = document.getElementById('climbPhotoViewerTitle');
                const counterEl = document.getElementById('climbPhotoViewerCounter');
                const climb = entry ? this.getPhotoClimbRecord(entry.photo) : null;
                if (titleEl) {
                    titleEl.textContent =
                        climb?.name || this._climbDetailContext?.climbName || '—';
                }
                const total = g?.entries?.length || 0;
                if (counterEl) {
                    counterEl.textContent = total > 1 ? `${g.index + 1} / ${total}` : '';
                }
            }

            setupClimbPhotoViewerListeners() {
                document
                    .getElementById('closeClimbPhotoViewerBtn')
                    ?.addEventListener('click', () => this.closeClimbPhotoViewer());

                const bindMount = (mount) => {
                    if (!mount) return;
                    bindPhotoTapAndSwipe(mount, {
                        onTap: () => {
                            const viewer = document.getElementById('climbPhotoViewer');
                            if (viewer && !viewer.classList.contains('hidden')) {
                                this.closeClimbPhotoViewer();
                            } else {
                                void this.openClimbPhotoViewer();
                            }
                        },
                        onSwipeLeft: () => this.navigatePhotoGallery(1),
                        onSwipeRight: () => this.navigatePhotoGallery(-1)
                    });
                };
                bindMount(document.getElementById('climbDetailPhotoMount'));
                bindMount(document.getElementById('climbPhotoViewerMount'));
            }

            async openClimbPhotoViewer() {
                const g = this._photoGallery;
                if (!g?.entries?.length) return;
                const viewer = document.getElementById('climbPhotoViewer');
                if (!viewer) return;
                const entry = g.entries[g.index];
                await hydratePhotosFromIndexedDb([entry.photo]);
                viewer.classList.remove('hidden');
                viewer.setAttribute('aria-hidden', 'false');
                document.body.classList.add('dialog-screen-open');
                this.updatePhotoViewerChrome();
                this.showClimbDetailPhotoInMount(
                    'viewer',
                    entry.photo,
                    this._climbDetailContext?.climbName || ''
                );
            }

            closeClimbPhotoViewer() {
                const viewer = document.getElementById('climbPhotoViewer');
                if (!viewer || viewer.classList.contains('hidden')) return;
                this._climbViewerImgGen = (this._climbViewerImgGen || 0) + 1;
                viewer.classList.add('hidden');
                viewer.setAttribute('aria-hidden', 'true');
                const img = document.getElementById('climbPhotoViewerImage');
                if (img) {
                    img.onload = null;
                    img.onerror = null;
                    img.removeAttribute('src');
                }
                const mount = document.getElementById('climbPhotoViewerMount');
                if (mount) {
                    this.applyPhotoPreviewMarkupOverlay(
                        mount,
                        null,
                        this._climbDetailContext?.climbType || 'route'
                    );
                }
                const detailHidden = document
                    .getElementById('climbDetailDialog')
                    ?.classList.contains('hidden');
                if (detailHidden) {
                    document.body.classList.remove('dialog-screen-open');
                } else {
                    this.syncBodyDialogScreenLock();
                }
            }

            navigatePhotoGallery(delta) {
                const g = this._photoGallery;
                if (!g?.entries?.length || g.entries.length < 2) return;
                const n = g.entries.length;
                g.index = (g.index + delta + n) % n;
                void this.applyPhotoGalleryIndex(g.index);
            }

            showClimbDetailPhotoInMount(which, photo, climbName) {
                const mountId =
                    which === 'viewer' ? 'climbPhotoViewerMount' : 'climbDetailPhotoMount';
                const mount = document.getElementById(mountId);
                const img =
                    which === 'viewer'
                        ? document.getElementById('climbPhotoViewerImage') ||
                          (() => {
                              const el = document.createElement('img');
                              el.id = 'climbPhotoViewerImage';
                              mount?.insertBefore(el, mount.firstChild);
                              return el;
                          })()
                        : this.ensureClimbDetailImageElement();
                if (!img || !mount || !photoMayHaveImage(photo)) return;
                const climbType =
                    this._climbDetailContext?.climbType || photo.type || 'route';
                const applyMarkup = () => {
                    this.schedulePhotoMarkupOverlay(mount, photo.markup || null, climbType);
                };
                this._setClimbDetailImageSrc(img, photo, climbName, applyMarkup, which);
            }

            async applyPhotoGalleryIndex(index) {
                const g = this._photoGallery;
                if (!g?.entries?.[index]) return;
                g.index = index;
                const entry = g.entries[index];
                await hydratePhotosFromIndexedDb([entry.photo]);
                const dlg = document.getElementById('climbDetailDialog');
                const detailOpen = dlg && !dlg.classList.contains('hidden');

                if (detailOpen) {
                    const ctx = this._climbDetailContext;
                    const sameClimb =
                        ctx &&
                        ctx.climbType === entry.climbType &&
                        String(ctx.climbId) === String(entry.climbId);
                    if (!sameClimb) {
                        await this.updateClimbDetailForGalleryItem(entry);
                    } else {
                        if (ctx) ctx.shownPhotoId = String(entry.photo.id);
                        this.showClimbDetailPhotoInMount(
                            'detail',
                            entry.photo,
                            ctx?.climbName || ''
                        );
                        this.refreshClimbDetailMarkupOverlayIfOpen();
                    }
                }

                const viewer = document.getElementById('climbPhotoViewer');
                if (viewer && !viewer.classList.contains('hidden')) {
                    this.updatePhotoViewerChrome();
                    this.showClimbDetailPhotoInMount(
                        'viewer',
                        entry.photo,
                        this._climbDetailContext?.climbName || ''
                    );
                }
                this.updateClimbDetailPhotoCounter();
            }

            async updateClimbDetailForGalleryItem(entry) {
                const { photo, climbType, climbId } = entry;
                const idStr = String(climbId);
                const climb =
                    climbType === 'route'
                        ? getRoutes().find((r) => String(r.id) === idStr)
                        : getBoulders().find((b) => String(b.id) === idStr);
                if (!climb) return;

                this._climbDetailContext = {
                    climbType,
                    climbId: idStr,
                    photoId: String(photo.id),
                    shownPhotoId: String(photo.id),
                    climbName: climb.name || ''
                };

                const titleEl = document.getElementById('climbDetailTitle');
                const metaEl = document.getElementById('climbDetailMeta');
                const descEl = document.getElementById('climbDetailDescription');
                if (titleEl) titleEl.textContent = climb.name || '—';
                const structLabel =
                    climb.sectorId != null ? this.getStructureLabel(climb.sectorId) : '';
                const structHtml = structLabel
                    ? `<br><span style="opacity:.92;font-size:13px">${this.escapeHtml(structLabel)}</span>`
                    : '';
                const grade =
                    climb.grade != null && climb.grade !== ''
                        ? this.escapeHtml(String(climb.grade))
                        : '—';
                const kindRu = climbType === 'route' ? 'Трасса' : 'Боулдеринг';
                let extraBits = '';
                if (climbType === 'route') {
                    if (climb.length != null && climb.length !== '') {
                        extraBits += ` · ${this.escapeHtml(String(climb.length))} м`;
                    }
                    if (climb.bolts != null && climb.bolts !== '') {
                        extraBits += ` · ${this.escapeHtml(String(climb.bolts))} болт.`;
                    }
                } else {
                    if (climb.height != null && climb.height !== '') {
                        extraBits += ` · выс. ${this.escapeHtml(String(climb.height))} м`;
                    }
                    if (climb.category) {
                        extraBits += ` · ${this.escapeHtml(String(climb.category))}`;
                    }
                }
                if (metaEl) {
                    metaEl.innerHTML = `${kindRu} · Категория: <strong>${grade}</strong>${extraBits}${structHtml}`;
                }
                const descRaw = climb.description != null ? String(climb.description).trim() : '';
                if (descEl) {
                    descEl.textContent = descRaw || 'Описание пока не указано.';
                }

                const wrap = document.getElementById('climbDetailImageWrap');
                wrap?.classList.remove('hidden');
                document.getElementById('climbDetailNoPhoto')?.classList.add('hidden');
                this.showClimbDetailPhotoInMount('detail', photo, climb.name || '');
                void this.refreshClimbDetailViewPanel(climbType, idStr).then(() => {
                    this.syncClimbDetailFooterActions();
                });
            }

            ensureClimbDetailImageElement() {
                const mount = document.getElementById('climbDetailPhotoMount');
                if (!mount) return null;
                let img = document.getElementById('climbDetailImage');
                if (!img || !mount.contains(img)) {
                    img = document.createElement('img');
                    img.id = 'climbDetailImage';
                    mount.insertBefore(img, mount.firstChild);
                }
                return img;
            }

            _setClimbDetailImageSrc(img, photo, climbName, onReady, channel = 'detail') {
                if (!img || !photoMayHaveImage(photo)) return;
                const genKey = channel === 'viewer' ? '_climbViewerImgGen' : '_climbDetailImgGen';
                const gen = ++this[genKey];
                img.alt = climbName || '';
                img.style.display = 'block';
                img.style.visibility = 'visible';
                loadImageIntoElement(img, photo, () => {
                    if (this[genKey] !== gen) return;
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            if (this[genKey] === gen && typeof onReady === 'function') onReady();
                        });
                    });
                });
            }

            async showClimbDetailDialog(climbType, climbId, opts = {}) {
                const idStr = String(climbId);
                const preferPhotoId = opts.preferPhotoId != null ? String(opts.preferPhotoId) : null;
                let photos = [];
                try {
                    photos = await ensureClimbPhotosForDetail(climbType, climbId);
                } catch (err) {
                    console.warn('climb detail photos load', err);
                }
                const climb = await this.ensureClimbInCatalog(climbType, idStr);
                if (!climb) {
                    this.showToast(
                        climbType === 'route' ? 'Трасса не найдена' : 'Боулдеринг не найден',
                        true
                    );
                    return;
                }
                const photo = pickClimbDetailPhoto(photos, preferPhotoId);

                this._climbDetailContext = {
                    climbType,
                    climbId: idStr,
                    photoId: preferPhotoId && photo && String(photo.id) === preferPhotoId ? preferPhotoId : null,
                    shownPhotoId: photo && photo.id != null && String(photo.id) !== '' ? String(photo.id) : '',
                    climbName: climb.name || ''
                };

                const galleryEntries = this.buildPhotoGalleryEntries(climbType, idStr, photos, {
                    albumNav: !!opts.albumNav
                });
                this._photoGallery = this.initPhotoGallery(
                    galleryEntries,
                    photo?.id,
                    opts.albumNav ? 'album' : 'climb'
                );

                const titleEl = document.getElementById('climbDetailTitle');
                const metaEl = document.getElementById('climbDetailMeta');
                const descEl = document.getElementById('climbDetailDescription');
                const wrap = document.getElementById('climbDetailImageWrap');
                const noPh = document.getElementById('climbDetailNoPhoto');
                const mkBtn = document.getElementById('climbDetailMarkupBtn');
                const saveRow = document.getElementById('climbDetailSaveRow');
                const saveHint = document.getElementById('climbDetailSaveHint');

                if (titleEl) titleEl.textContent = climb.name || '—';
                const structLabel =
                    climb.sectorId != null ? this.getStructureLabel(climb.sectorId) : '';
                const structHtml = structLabel ? `<br><span style="opacity:.92;font-size:13px">${this.escapeHtml(structLabel)}</span>` : '';
                const grade =
                    climb.grade != null && climb.grade !== '' ? this.escapeHtml(String(climb.grade)) : '—';
                const kindRu = climbType === 'route' ? 'Трасса' : 'Боулдеринг';
                let extraBits = '';
                if (climbType === 'route') {
                    if (climb.length != null && climb.length !== '') {
                        extraBits += ` · ${this.escapeHtml(String(climb.length))} м`;
                    }
                    if (climb.bolts != null && climb.bolts !== '') {
                        extraBits += ` · ${this.escapeHtml(String(climb.bolts))} болт.`;
                    }
                } else {
                    if (climb.height != null && climb.height !== '') {
                        extraBits += ` · выс. ${this.escapeHtml(String(climb.height))} м`;
                    }
                    if (climb.category) {
                        extraBits += ` · ${this.escapeHtml(String(climb.category))}`;
                    }
                }
                if (metaEl) {
                    metaEl.innerHTML = `${kindRu} · Категория: <strong>${grade}</strong>${extraBits}${structHtml}`;
                }
                const descRaw = climb.description != null ? String(climb.description).trim() : '';
                if (descEl) {
                    descEl.textContent = descRaw || 'Описание пока не указано.';
                }

                const mount = document.getElementById('climbDetailPhotoMount');
                const applyDetailMarkup = () => {
                    if (mount && photo && photoHasDisplayImage(photo)) {
                        this.schedulePhotoMarkupOverlay(mount, photo.markup || null, climbType);
                    } else if (mount) {
                        this.applyPhotoPreviewMarkupOverlay(mount, null, climbType);
                    }
                };

                this.showDialog('climbDetailDialog');

                if (photo && photoHasDisplayImage(photo)) {
                    saveRow?.classList.remove('hidden');
                    if (saveHint) {
                        const isTg = document.documentElement.classList.contains('tg-mini-app');
                        saveHint.classList.toggle('hidden', !isTg);
                    }
                    wrap?.classList.remove('hidden');
                    noPh?.classList.add('hidden');
                    const img = this.ensureClimbDetailImageElement();
                    if (img) {
                        this._setClimbDetailImageSrc(img, photo, climb.name || '', applyDetailMarkup);
                    }
                    if (mkBtn) mkBtn.style.display = '';
                    void this.tryAutoSaveOpenedMediaToDevice(photo, climbType, climb.name || '');
                } else {
                    saveRow?.classList.add('hidden');
                    saveHint?.classList.add('hidden');
                    wrap?.classList.add('hidden');
                    noPh?.classList.remove('hidden');
                    const img = document.getElementById('climbDetailImage');
                    if (img) {
                        img.onload = null;
                        img.onerror = null;
                        img.removeAttribute('src');
                    }
                    if (mkBtn) mkBtn.style.display = 'none';
                    applyDetailMarkup();
                }
                this.updateClimbDetailPhotoCounter();

                void this.refreshClimbDetailViewPanel(climbType, idStr).then(() => {
                    this.syncClimbDetailFooterActions();
                    this.refreshClimbDetailMarkupOverlayIfOpen();
                    if (typeof window.syncTelegramWebAppButtons === 'function') {
                        window.syncTelegramWebAppButtons('climbDetailDialog');
                    }
                });
            }

            syncClimbDetailFooterActions() {
                const logBtn = document.getElementById('climbDetailOpenLogBtn');
                if (!logBtn) return;
                const canLog = this.isLoggedIn() && this.isTelegramUser();
                logBtn.classList.toggle('hidden', !canLog);
            }

            openClimbMarkupView(climbType, climbId) {
                const idStr = String(climbId);
                const photos = getPhotos().filter(
                    (p) => p.type === climbType && String(p.climbId) === idStr
                );
                if (!photos.length) {
                    this.showToast(
                        'Для этой проблемы пока нет фотографии. Добавьте фото при создании или во вкладке «Фотоальбом».',
                        false
                    );
                    return;
                }
                const photo = pickClimbDetailPhoto(photos, null);
                const viewOnly = !this.isAdmin();
                if (climbType === 'route') {
                    this.showExistingPhotoRouteLineMarkup(photo, photo.climbId, viewOnly);
                } else {
                    this.showExistingPhotoBoulderHoldsMarkup(photo, photo.climbId, viewOnly);
                }
            }

            /** Открыть выбранное фото из альбома (конкретный снимок, не только «первый у трассы»). */
            openPhotoMarkupView(rawPhotoId) {
                const pid = String(rawPhotoId ?? '');
                const photo = getPhotos().find((p) => String(p.id) === pid);
                if (!photo) {
                    this.showToast('Фотография не найдена', true);
                    return;
                }
                const viewOnly = !this.isAdmin();
                if (photo.type === 'route') {
                    this.showExistingPhotoRouteLineMarkup(photo, photo.climbId, viewOnly);
                } else if (photo.type === 'boulder') {
                    this.showExistingPhotoBoulderHoldsMarkup(photo, photo.climbId, viewOnly);
                }
            }

            resetRouteMarkupDialogChrome() {
                const dlg = document.getElementById('routeLineMarkupDialog');
                if (!dlg) return;
                const title = dlg.querySelector('.dialog-title');
                const subtitle = dlg.querySelector('.dialog-subtitle');
                if (title) title.textContent = 'Трудность';
                if (subtitle) subtitle.textContent = 'Разметка на фото: старты и линия хода';
                ['clearRouteLineMarkupBtn', 'saveRouteLineMarkupBtn'].forEach((id) => {
                    const el = document.getElementById(id);
                    if (el) el.style.display = '';
                });
                dlg.querySelectorAll('.route-markup-mode-btn').forEach((btn) => {
                    btn.style.display = '';
                });
                const instr = dlg.querySelector('.markup-instructions');
                if (instr) instr.style.display = '';
            }

            resetBoulderMarkupDialogChrome() {
                const dlg = document.getElementById('boulderHoldsMarkupDialog');
                if (!dlg) return;
                const title = dlg.querySelector('.dialog-title');
                const subtitle = dlg.querySelector('.dialog-subtitle');
                if (title) title.textContent = 'Разметка боулдеринга на фотографии';
                if (subtitle) subtitle.textContent = 'Кружки и линия хода задаются отдельно (два режима)';
                ['clearBoulderHoldsMarkupBtn', 'saveBoulderHoldsMarkupBtn'].forEach((id) => {
                    const el = document.getElementById(id);
                    if (el) el.style.display = '';
                });
                dlg.querySelectorAll('.boulder-markup-mode-btn').forEach((btn) => {
                    btn.style.display = '';
                });
                const instr = dlg.querySelector('.markup-instructions');
                if (instr) instr.style.display = '';
            }

            applyRouteMarkupViewOnlyUi(viewOnly) {
                const dlg = document.getElementById('routeLineMarkupDialog');
                if (!dlg) return;
                if (viewOnly) {
                    const title = dlg.querySelector('.dialog-title');
                    const subtitle = dlg.querySelector('.dialog-subtitle');
                    if (title) title.textContent = 'Трасса на фото';
                    if (subtitle) subtitle.textContent = 'Просмотр линии и стартовых точек';
                }
                ['clearRouteLineMarkupBtn', 'saveRouteLineMarkupBtn'].forEach((id) => {
                    const el = document.getElementById(id);
                    if (el) el.style.display = viewOnly ? 'none' : '';
                });
                dlg.querySelectorAll('.route-markup-mode-btn').forEach((btn) => {
                    btn.style.display = viewOnly ? 'none' : '';
                });
                const instr = dlg.querySelector('.markup-instructions');
                if (instr) instr.style.display = viewOnly ? 'none' : '';
                dlg.classList.toggle('markup-dialog--view-only', !!viewOnly);
                if (typeof window.syncTelegramWebAppButtons === 'function') {
                    window.syncTelegramWebAppButtons('routeLineMarkupDialog');
                }
            }

            applyBoulderMarkupViewOnlyUi(viewOnly) {
                const dlg = document.getElementById('boulderHoldsMarkupDialog');
                if (!dlg) return;
                if (viewOnly) {
                    const title = dlg.querySelector('.dialog-title');
                    const subtitle = dlg.querySelector('.dialog-subtitle');
                    if (title) title.textContent = 'Боулдеринг на фото';
                    if (subtitle) subtitle.textContent = 'Просмотр зацепок и линии';
                }
                ['clearBoulderHoldsMarkupBtn', 'saveBoulderHoldsMarkupBtn'].forEach((id) => {
                    const el = document.getElementById(id);
                    if (el) el.style.display = viewOnly ? 'none' : '';
                });
                dlg.querySelectorAll('.boulder-markup-mode-btn').forEach((btn) => {
                    btn.style.display = viewOnly ? 'none' : '';
                });
                const instr = dlg.querySelector('.markup-instructions');
                if (instr) instr.style.display = viewOnly ? 'none' : '';
                dlg.classList.toggle('markup-dialog--view-only', !!viewOnly);
                if (typeof window.syncTelegramWebAppButtons === 'function') {
                    window.syncTelegramWebAppButtons('boulderHoldsMarkupDialog');
                }
            }

            syncRouteMarkupModeUI() {
                document.querySelectorAll('#routeLineMarkupDialog .route-markup-mode-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.mode === this.routeMarkupMode);
                });
            }

            // Методы для разметки трасс (линии + стартовые кружки), координаты 0–1 по видимой области фото
            showRouteLineMarkupDialog(photoData) {
                this._markupDialogViewOnly = false;
                this.resetRouteMarkupDialogChrome();
                this.routeMarkupMode = 'line';
                this.currentRouteLineMarkup = {
                    points: [],
                    startHolds: [],
                    photoId: photoData.climbId,
                    climbId: photoData.climbId
                };

                const img = document.getElementById('routeLineMarkupImage');
                this.showDialog('routeLineMarkupDialog');
                const afterImgReady = () => {
                    this.setupRouteLineMarkupEvents();
                    this.syncRouteMarkupModeUI();
                    this.renderRouteLineMarkup();
                };
                img.onload = () => {
                    img.onload = null;
                    afterImgReady();
                };
                img.src = photoData.data;
                if (img.complete && img.naturalWidth > 0) {
                    afterImgReady();
                }
            }

            showExistingPhotoRouteLineMarkup(photo, climbId, viewOnly = false) {
                this.resetRouteMarkupDialogChrome();
                this._markupDialogViewOnly = !!viewOnly;
                this.applyRouteMarkupViewOnlyUi(this._markupDialogViewOnly);

                this.routeMarkupMode = 'line';

                const img = document.getElementById('routeLineMarkupImage');
                this.showDialog('routeLineMarkupDialog');

                const applyLoadedMarkup = () => {
                    const container = document.getElementById('routeLineMarkupContainer');
                    const geom = getMarkupStageGeometry(container);
                    const m = normalizePhotoMarkup(photo.markup, 'route') || {
                        points: [],
                        startHolds: [],
                        coordSpace: 'image'
                    };
                    const imageCoords = m.coordSpace === 'image';
                    this.currentRouteLineMarkup = {
                        points: (m.points || []).map((p, i) => {
                            const n = boulderStoredToImageNorm(p, geom, imageCoords);
                            return { id: Date.now() + i, x: n.x, y: n.y };
                        }),
                        startHolds: (m.startHolds || []).map((p, i) => {
                            const n = boulderStoredToImageNorm(p, geom, imageCoords);
                            return { id: Date.now() + 10000 + i, x: n.x, y: n.y };
                        }),
                        photoId: photo.id,
                        climbId: climbId
                    };
                    if (!this._markupDialogViewOnly) {
                        this.setupRouteLineMarkupEvents();
                    }
                    this.syncRouteMarkupModeUI();
                    this.renderRouteLineMarkup();
                };

                const scheduleApply = () => {
                    requestAnimationFrame(() => requestAnimationFrame(applyLoadedMarkup));
                };

                loadImageIntoElement(img, photo, scheduleApply);
            }

            updateRouteLinePolyline() {
                const svg = document.getElementById('routeLineMarkupSvg');
                const container = document.getElementById('routeLineMarkupContainer');
                if (!svg || !container) return;

                while (svg.firstChild) {
                    svg.removeChild(svg.firstChild);
                }

                const geom = getMarkupStageGeometry(container);
                svg.style.left = `${geom.left}px`;
                svg.style.top = `${geom.top}px`;
                svg.style.width = `${geom.iw}px`;
                svg.style.height = `${geom.ih}px`;
                svg.setAttribute('viewBox', '0 0 1 1');
                svg.setAttribute('preserveAspectRatio', 'none');

                const pts = this.currentRouteLineMarkup?.points || [];
                appendTopoLineSvg(svg, 'http://www.w3.org/2000/svg', pts, geom);
            }

            deleteNearestRouteMarkupAt(x, y, geom) {
                const hitNorm = TOPO_MARKUP.hitRadiusPx / (geom.iw || 400);
                let best = { kind: null, index: -1, d: hitNorm };

                (this.currentRouteLineMarkup.points || []).forEach((point, index) => {
                    const d = Math.hypot(point.x - x, point.y - y);
                    if (d < best.d) {
                        best = { kind: 'point', index, d };
                    }
                });
                (this.currentRouteLineMarkup.startHolds || []).forEach((point, index) => {
                    const d = Math.hypot(point.x - x, point.y - y);
                    if (d < best.d) {
                        best = { kind: 'start', index, d };
                    }
                });

                if (best.kind === 'point' && best.index !== -1) {
                    this.currentRouteLineMarkup.points.splice(best.index, 1);
                    this.renderRouteLineMarkup();
                } else if (best.kind === 'start' && best.index !== -1) {
                    this.currentRouteLineMarkup.startHolds.splice(best.index, 1);
                    this.renderRouteLineMarkup();
                }
            }

            setupRouteLineMarkupEvents() {
                const container = document.getElementById('routeLineMarkupContainer');
                if (!container) return;

                this._routeLineMarkupAbort?.abort();
                this._routeLineMarkupAbort = new AbortController();
                const { signal } = this._routeLineMarkupAbort;

                const onStageResize = () => {
                    if (document.getElementById('routeLineMarkupDialog')?.classList.contains('hidden')) return;
                    this.renderRouteLineMarkup();
                };
                window.addEventListener('resize', onStageResize, { signal });

                container.addEventListener('click', (e) => {
                    if (this._markupDialogViewOnly) return;
                    if (e.target.closest('.hold-marker') || e.target.closest('.line-marker')) return;

                    const { x, y, geom } = markupNormFromClient(container, e.clientX, e.clientY);

                    if (e.ctrlKey || e.metaKey) {
                        this.deleteNearestRouteMarkupAt(x, y, geom);
                        return;
                    }

                    if (this.routeMarkupMode === 'starts') {
                        this.addRouteStartHold(x, y);
                    } else {
                        this.addRouteLinePoint(x, y);
                    }
                }, { signal });
            }

            addRouteLinePoint(x, y) {
                if (!this.currentRouteLineMarkup.points) {
                    this.currentRouteLineMarkup.points = [];
                }
                this.currentRouteLineMarkup.points.push({
                    id: Date.now(),
                    x,
                    y
                });
                this.renderRouteLineMarkup();
            }

            addRouteStartHold(x, y) {
                if (!this.currentRouteLineMarkup.startHolds) {
                    this.currentRouteLineMarkup.startHolds = [];
                }
                this.currentRouteLineMarkup.startHolds.push({
                    id: Date.now(),
                    x,
                    y
                });
                this.renderRouteLineMarkup();
            }

            renderRouteLineMarkup() {
                const container = document.getElementById('routeLineMarkupContainer');
                if (!container || !this.currentRouteLineMarkup) return;

                const geom = getMarkupStageGeometry(container);
                container.querySelectorAll('.hold-marker, .line-marker').forEach((marker) => marker.remove());

                const starts = this.currentRouteLineMarkup.startHolds || [];
                starts.forEach((hold, index) => {
                    const pos = markupPxFromNorm(hold.x, hold.y, geom);
                    const marker = document.createElement('div');
                    marker.className = 'hold-marker';
                    marker.style.left = `${pos.x}px`;
                    marker.style.top = `${pos.y}px`;
                    marker.dataset.index = String(index);

                    const number = document.createElement('div');
                    number.className = 'hold-number';
                    number.textContent = String(index + 1);
                    marker.appendChild(number);

                    container.appendChild(marker);
                });

                const pts = this.currentRouteLineMarkup.points || [];
                pts.forEach((point, index) => {
                    const pos = markupPxFromNorm(point.x, point.y, geom);
                    const marker = document.createElement('div');
                    marker.className = 'line-marker';
                    marker.style.left = `${pos.x}px`;
                    marker.style.top = `${pos.y}px`;
                    marker.dataset.index = String(index);
                    container.appendChild(marker);
                });

                this.updateRouteLinePolyline();
            }

            clearRouteLineMarkup() {
                if (confirm('Очистить всю разметку?')) {
                    this.currentRouteLineMarkup.points = [];
                    this.currentRouteLineMarkup.startHolds = [];
                    const container = document.getElementById('routeLineMarkupContainer');
                    container?.querySelectorAll('.hold-marker, .line-marker').forEach((marker) => marker.remove());
                    this.updateRouteLinePolyline();
                }
            }

            async saveRouteLineMarkup() {
                if (!this.requireAdmin('Сохранение разметки')) return;
                if ((this.currentRouteLineMarkup.points || []).length < 2) {
                    this.showToast('Добавьте хотя бы две точки линии (режим «Линия хода»). Стартовые кружки — по желанию.', true);
                    return;
                }

                const normalizedPoints = (this.currentRouteLineMarkup.points || []).map((point) => ({
                    x: point.x,
                    y: point.y
                }));

                const normalizedStarts = (this.currentRouteLineMarkup.startHolds || []).map((point) => ({
                    x: point.x,
                    y: point.y
                }));

                // Новое фото в форме (нет id маршрута или временный)
                if (this.currentPhotoPreview && this.isFormTempPhotoMarkupId(this.currentRouteLineMarkup.photoId)) {
                    this.currentPhotoPreview.markup = {
                        type: 'route-line',
                        coordSpace: 'image',
                        points: normalizedPoints,
                        startHolds: normalizedStarts,
                        savedAt: new Date().toISOString()
                    };

                    this.refreshDialogPhotoMarkupAfterMarkupSave();
                    this.refreshClimbDetailMarkupOverlayIfOpen();
                    this.showToast('Разметка сохранена');
                    this.hideDialog('routeLineMarkupDialog');
                    return;
                }

                // Обновляем разметку в существующем фото
                const photoId = Number(this.currentRouteLineMarkup.photoId);
                const newMarkup = {
                    type: 'route-line',
                    coordSpace: 'image',
                    points: normalizedPoints,
                    startHolds: normalizedStarts,
                    savedAt: new Date().toISOString()
                };
                try {
                    const updated = await apiFetch(`/api/photos/${photoId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ markup: newMarkup })
                    });
                    patchPhotoInLocalCacheFromApi(updated);
                    this.showToast('Разметка обновлена');
                    const pid = String(photoId);
                    const prev = document.querySelector(`.photo-preview-with-markup[data-photo-id="${pid}"]`);
                    if (prev) {
                        this.applyPhotoPreviewMarkupOverlay(prev, newMarkup, prev.dataset.climbType || 'route');
                        this.syncMarkupButtonOnPreviewItem(prev, true);
                    }
                } catch (err) {
                    this.showToast(`Ошибка сохранения разметки: ${err.message}`, true);
                }

                this.refreshClimbDetailMarkupOverlayIfOpen();
                this.hideDialog('routeLineMarkupDialog');
                this.renderPhotoAlbum();
            }

            syncBoulderMarkupModeUI() {
                document.querySelectorAll('#boulderHoldsMarkupDialog .boulder-markup-mode-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.mode === this.boulderMarkupMode);
                });
            }

            // Методы для разметки боулдеринга (кружки и линия раздельно)
            showBoulderHoldsMarkupDialog(photoData) {
                this._markupDialogViewOnly = false;
                this.resetBoulderMarkupDialogChrome();
                this.boulderMarkupMode = 'circles';
                this.currentBoulderHoldsMarkup = {
                    holds: [],
                    linePoints: [],
                    photoId: photoData.climbId,
                    climbId: photoData.climbId
                };

                const img = document.getElementById('boulderHoldsMarkupImage');
                this.showDialog('boulderHoldsMarkupDialog');
                const afterImgReady = () => {
                    this.setupBoulderHoldsMarkupEvents();
                    this.syncBoulderMarkupModeUI();
                    this.renderBoulderHoldsMarkup();
                };
                img.onload = () => {
                    img.onload = null;
                    afterImgReady();
                };
                img.src = photoData.data;
                if (img.complete && img.naturalWidth > 0) {
                    afterImgReady();
                }
            }

            showExistingPhotoBoulderHoldsMarkup(photo, climbId, viewOnly = false) {
                this.resetBoulderMarkupDialogChrome();
                this._markupDialogViewOnly = !!viewOnly;
                this.applyBoulderMarkupViewOnlyUi(this._markupDialogViewOnly);

                this.boulderMarkupMode = 'circles';

                const img = document.getElementById('boulderHoldsMarkupImage');
                this.showDialog('boulderHoldsMarkupDialog');

                const applyLoadedMarkup = () => {
                    const container = document.getElementById('boulderHoldsMarkupContainer');
                    const geom = getMarkupStageGeometry(container);
                    const m = normalizePhotoMarkup(photo.markup, 'boulder') || {
                        holds: [],
                        linePoints: [],
                        coordSpace: 'image'
                    };
                    const imageCoords = m.coordSpace === 'image';
                    this.currentBoulderHoldsMarkup = {
                        holds: (m.holds || []).map((h, i) => {
                            const n = boulderStoredToImageNorm(h, geom, imageCoords);
                            return {
                                id: Date.now() + i,
                                x: n.x,
                                y: n.y,
                                type: 'start',
                                color: this.getHoldColor()
                            };
                        }),
                        linePoints: (m.linePoints || []).map((p, i) => {
                            const n = boulderStoredToImageNorm(p, geom, imageCoords);
                            return {
                                id: Date.now() + 5000 + i,
                                x: n.x,
                                y: n.y
                            };
                        }),
                        photoId: photo.id,
                        climbId: climbId
                    };
                    if (!this._markupDialogViewOnly) {
                        this.setupBoulderHoldsMarkupEvents();
                    }
                    this.syncBoulderMarkupModeUI();
                    this.renderBoulderHoldsMarkup();
                };

                const scheduleApply = () => {
                    requestAnimationFrame(() => requestAnimationFrame(applyLoadedMarkup));
                };

                loadImageIntoElement(img, photo, scheduleApply);
            }

            deleteNearestBoulderMarkupAt(x, y, geom) {
                const hitNorm = TOPO_MARKUP.hitRadiusPx / (geom.iw || 400);
                let best = { kind: null, index: -1, d: hitNorm };

                (this.currentBoulderHoldsMarkup.holds || []).forEach((hold, index) => {
                    const d = Math.hypot(hold.x - x, hold.y - y);
                    if (d < best.d) {
                        best = { kind: 'hold', index, d };
                    }
                });
                (this.currentBoulderHoldsMarkup.linePoints || []).forEach((pt, index) => {
                    const d = Math.hypot(pt.x - x, pt.y - y);
                    if (d < best.d) {
                        best = { kind: 'line', index, d };
                    }
                });

                if (best.kind === 'hold' && best.index !== -1) {
                    this.currentBoulderHoldsMarkup.holds.splice(best.index, 1);
                    this.renderBoulderHoldsMarkup();
                } else if (best.kind === 'line' && best.index !== -1) {
                    this.currentBoulderHoldsMarkup.linePoints.splice(best.index, 1);
                    this.updateBoulderHoldsPolyline();
                }
            }

            setupBoulderHoldsMarkupEvents() {
                const container = document.getElementById('boulderHoldsMarkupContainer');
                if (!container) return;

                this._boulderHoldsMarkupAbort?.abort();
                this._boulderHoldsMarkupAbort = new AbortController();
                const { signal } = this._boulderHoldsMarkupAbort;

                const onStageResize = () => {
                    if (document.getElementById('boulderHoldsMarkupDialog')?.classList.contains('hidden')) return;
                    this.renderBoulderHoldsMarkup();
                };
                window.addEventListener('resize', onStageResize, { signal });

                container.addEventListener('click', (e) => {
                    if (this._markupDialogViewOnly) return;
                    if (e.target.closest('.hold-marker')) return;

                    const { x, y, geom } = markupNormFromClient(container, e.clientX, e.clientY);

                    if (e.ctrlKey || e.metaKey) {
                        this.deleteNearestBoulderMarkupAt(x, y, geom);
                        return;
                    }

                    if (this.boulderMarkupMode === 'line') {
                        this.addBoulderLinePoint(x, y);
                    } else {
                        this.addBoulderHold(x, y);
                    }
                }, { signal });
            }

            addBoulderHold(x, y) {
                const hold = {
                    id: Date.now(),
                    x: x,
                    y: y,
                    type: 'start',
                    color: this.getHoldColor()
                };

                this.currentBoulderHoldsMarkup.holds.push(hold);
                this.renderBoulderHoldsMarkup();
            }

            addBoulderLinePoint(x, y) {
                if (!this.currentBoulderHoldsMarkup.linePoints) {
                    this.currentBoulderHoldsMarkup.linePoints = [];
                }
                this.currentBoulderHoldsMarkup.linePoints.push({
                    id: Date.now(),
                    x,
                    y
                });
                this.updateBoulderHoldsPolyline();
            }

            getHoldColor() {
                return '#e53935';
            }

            updateBoulderHoldsPolyline() {
                const svg = document.getElementById('boulderHoldsMarkupSvg');
                const container = document.getElementById('boulderHoldsMarkupContainer');
                if (!svg || !container) return;

                while (svg.firstChild) {
                    svg.removeChild(svg.firstChild);
                }

                const geom = getMarkupStageGeometry(container);
                svg.style.left = `${geom.left}px`;
                svg.style.top = `${geom.top}px`;
                svg.style.width = `${geom.iw}px`;
                svg.style.height = `${geom.ih}px`;
                svg.setAttribute('viewBox', '0 0 1 1');
                svg.setAttribute('preserveAspectRatio', 'none');

                const pts = this.currentBoulderHoldsMarkup?.linePoints || [];
                appendBoulderLineSvg(svg, 'http://www.w3.org/2000/svg', pts, geom);
            }

            renderBoulderHoldsMarkup() {
                const container = document.getElementById('boulderHoldsMarkupContainer');
                if (!container || !this.currentBoulderHoldsMarkup) return;

                const geom = getMarkupStageGeometry(container);

                // Удаляем старые маркеры
                const oldMarkers = container.querySelectorAll('.hold-marker');
                oldMarkers.forEach(marker => marker.remove());

                // Добавляем новые маркеры
                this.currentBoulderHoldsMarkup.holds.forEach((hold, index) => {
                    const pos = markupPxFromNorm(hold.x, hold.y, geom);
                    const marker = document.createElement('div');
                    marker.className = 'hold-marker';
                    marker.style.left = `${pos.x}px`;
                    marker.style.top = `${pos.y}px`;
                    marker.dataset.index = index;

                    const number = document.createElement('div');
                    number.className = 'hold-number';
                    number.textContent = (index + 1).toString();

                    marker.appendChild(number);

                    if (!this._markupDialogViewOnly) {
                        this.makeHoldDraggable(marker, index);
                    }

                    container.appendChild(marker);
                });

                this.updateBoulderHoldsPolyline();
            }

            makeHoldDraggable(marker, index) {
                marker.addEventListener('pointerdown', (e) => {
                    if (e.pointerType === 'mouse' && e.button !== 0) return;
                    e.preventDefault();
                    e.stopPropagation();
                    marker.classList.add('active');
                    try {
                        marker.setPointerCapture(e.pointerId);
                    } catch (_) {
                        /* ignore */
                    }
                    this._boulderHoldDrag = { index, marker, pointerId: e.pointerId };
                });
            }

            clearBoulderHoldsMarkup() {
                if (confirm('Очистить всю разметку (кружки и линию)?')) {
                    this.currentBoulderHoldsMarkup.holds = [];
                    this.currentBoulderHoldsMarkup.linePoints = [];
                    const container = document.getElementById('boulderHoldsMarkupContainer');
                    const oldMarkers = container.querySelectorAll('.hold-marker');
                    oldMarkers.forEach(marker => marker.remove());
                    this.updateBoulderHoldsPolyline();
                }
            }

            async saveBoulderHoldsMarkup() {
                if (!this.requireAdmin('Сохранение разметки')) return;
                const holds = this.currentBoulderHoldsMarkup.holds || [];
                const linePts = this.currentBoulderHoldsMarkup.linePoints || [];
                const hasHolds = holds.length >= 1;
                const hasLine = linePts.length >= 2;
                if (!hasHolds && !hasLine) {
                    this.showToast('Добавьте хотя бы один кружок и/или линию из двух точек (режим «Линия»)', true);
                    return;
                }

                const normalizedHolds = holds.map((hold) => ({
                    x: hold.x,
                    y: hold.y,
                    type: 'start',
                    color: this.getHoldColor()
                }));

                const normalizedLine = linePts.map((p) => ({
                    x: p.x,
                    y: p.y
                }));

                // Новое фото в форме (нет id или временный)
                if (this.currentPhotoPreview && this.isFormTempPhotoMarkupId(this.currentBoulderHoldsMarkup.photoId)) {
                    this.currentPhotoPreview.markup = {
                        type: 'boulder-holds',
                        coordSpace: 'image',
                        holds: normalizedHolds,
                        linePoints: normalizedLine,
                        savedAt: new Date().toISOString()
                    };

                    this.refreshDialogPhotoMarkupAfterMarkupSave();
                    this.showToast('Разметка боулдеринга сохранена');
                    this.hideDialog('boulderHoldsMarkupDialog');
                    return;
                }

                // Обновляем разметку в существующем фото
                const photoId = Number(this.currentBoulderHoldsMarkup.photoId);
                const newMarkup = {
                    type: 'boulder-holds',
                    coordSpace: 'image',
                    holds: normalizedHolds,
                    linePoints: normalizedLine,
                    savedAt: new Date().toISOString()
                };
                try {
                    const updated = await apiFetch(`/api/photos/${photoId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ markup: newMarkup })
                    });
                    patchPhotoInLocalCacheFromApi(updated);
                    this.showToast('Разметка боулдеринга обновлена');
                    const pid = String(photoId);
                    const prev = document.querySelector(`.photo-preview-with-markup[data-photo-id="${pid}"]`);
                    if (prev) {
                        this.applyPhotoPreviewMarkupOverlay(prev, newMarkup, prev.dataset.climbType || 'boulder');
                        this.syncMarkupButtonOnPreviewItem(prev, true);
                    }
                } catch (err) {
                    this.showToast(`Ошибка сохранения разметки: ${err.message}`, true);
                }

                this.hideDialog('boulderHoldsMarkupDialog');
                this.renderPhotoAlbum();
            }

            setupCommunityListeners() {
                document.getElementById('openProfileBtn')?.addEventListener('click', () => {
                    document.querySelector('.tab-btn[data-tab="profile"]')?.click();
                    void this.renderProfileTab();
                });
                document.getElementById('hideSentRoutes')?.addEventListener('change', () => this.renderRoutes());
                document.getElementById('hideSentBoulders')?.addEventListener('change', () => this.renderBoulders());
                document.querySelector('.tab-btn[data-tab="profile"]')?.addEventListener('click', () => {
                    void this.renderProfileTab();
                });
                document.querySelector('.tab-btn[data-tab="ranking"]')?.addEventListener('click', () => {
                    void this.renderRankingTab();
                });
            }

            async logClimbAscentFromDetail(status) {
                const ctx = this._climbDetailContext;
                if (!ctx) {
                    throw new Error('Откройте трассу из каталога');
                }
                if (!this.isLoggedIn() || !this.isTelegramUser()) {
                    throw new Error('Войдите через Telegram Mini App');
                }
                const climbType = ctx.climbType;
                const climbId = ctx.climbId;
                const ascentStyle = status === 'send' ? (this.getSelectedAscentStyle() || null) : null;
                const fixedTriesStyle = ascentStyle === 'onsight' || ascentStyle === 'flash';
                const tries = fixedTriesStyle
                    ? 1
                    : Math.max(1, parseInt(document.getElementById('climbLogTries')?.value || '1', 10) || 1);
                const body = {
                    climb_type: climbType,
                    status,
                    tries,
                    route_id: climbType === 'route' ? Number(climbId) : null,
                    boulder_id: climbType === 'boulder' ? Number(climbId) : null,
                    ascent_style: ascentStyle
                };
                if (status === 'send' && !body.ascent_style) {
                    throw new Error('Выберите тип пролаза: онсайт, флэш или редпоинт');
                }
                if (typeof window.setTelegramMainButtonLoading === 'function') {
                    window.setTelegramMainButtonLoading(true);
                }
                try {
                    await apiFetch('/api/ascents', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });
                    await this.loadAscentSummary();
                    this.hideDialog('climbLogDialog');
                    await this.refreshClimbDetailViewPanel(climbType, climbId);
                    await this.refreshProfileLogbookSection();
                    if (!APP_BOULDER_ONLY) this.renderRoutes();
                    this.renderBoulders();
                    this.renderCatalog();
                    this.showToast('Пролаз записан в логбук');
                    if (typeof window.syncTelegramWebAppButtons === 'function') {
                        window.syncTelegramWebAppButtons('climbDetailDialog');
                    }
                } catch (err) {
                    if (err?.queued) {
                        this.hideDialog('climbLogDialog');
                        this.showToast('Пролаз сохранён локально — отправится при появлении сети', false);
                        return;
                    }
                    throw err;
                } finally {
                    if (typeof window.setTelegramMainButtonLoading === 'function') {
                        window.setTelegramMainButtonLoading(false);
                    }
                }
            }

            async fetchClimbCommunityStats(climbType, climbId) {
                const q = climbType === 'route'
                    ? `climb_type=route&route_id=${encodeURIComponent(climbId)}`
                    : `climb_type=boulder&boulder_id=${encodeURIComponent(climbId)}`;
                return apiFetch(`/api/climbs/stats?${q}`);
            }

            getSelectedAscentStyle() {
                const active = document.querySelector('#climbLogSendStylePicker .ascent-style-btn.active');
                const fromBtn = active?.dataset.style || '';
                const fromHidden = document.getElementById('climbLogSendStyle')?.value || '';
                const style = fromBtn || fromHidden;
                return ['onsight', 'flash', 'redpoint'].includes(style) ? style : '';
            }

            setAscentStyleSelection(picker, hidden, style) {
                const normalized = ['onsight', 'flash', 'redpoint'].includes(style) ? style : '';
                picker.querySelectorAll('.ascent-style-btn').forEach((btn) => {
                    const isActive = normalized && btn.dataset.style === normalized;
                    btn.classList.toggle('active', isActive);
                    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
                });
                if (hidden) hidden.value = normalized;
            }

            syncClimbLogTriesForStyle() {
                const style = this.getSelectedAscentStyle();
                const field = document.getElementById('climbLogTriesField');
                const input = document.getElementById('climbLogTries');
                if (!field || !input) return;
                const fixedTries = style === 'onsight' || style === 'flash';
                field.classList.toggle('hidden', fixedTries);
                field.setAttribute('aria-hidden', fixedTries ? 'true' : 'false');
                if (fixedTries) {
                    input.value = '1';
                    input.disabled = true;
                } else {
                    input.disabled = false;
                    if (!input.value || Number(input.value) < 1) input.value = '1';
                }
            }

            bindAscentStylePicker(initialStyle = 'redpoint') {
                const picker = document.getElementById('climbLogSendStylePicker');
                const hidden = document.getElementById('climbLogSendStyle');
                if (!picker) return;
                const style = ['onsight', 'flash', 'redpoint'].includes(initialStyle) ? initialStyle : '';
                this.setAscentStyleSelection(picker, hidden, style);
                picker.querySelectorAll('.ascent-style-btn').forEach((btn) => {
                    btn.addEventListener('click', () => {
                        const next = btn.dataset.style;
                        if (!next) return;
                        const current = this.getSelectedAscentStyle();
                        if (current === next) {
                            this.setAscentStyleSelection(picker, hidden, '');
                            this.syncClimbLogTriesForStyle();
                            return;
                        }
                        this.setAscentStyleSelection(picker, hidden, next);
                        this.syncClimbLogTriesForStyle();
                    });
                });
                this.syncClimbLogTriesForStyle();
            }

            renderCommunityStarPicker(container, selectedStars, onPick) {
                if (!container) return;
                container.innerHTML = '';
                const wrap = document.createElement('div');
                wrap.className = 'star-rating';
                wrap.setAttribute('role', 'group');
                wrap.setAttribute('aria-label', 'Ваша оценка');
                for (let i = 1; i <= 3; i += 1) {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = `star-btn${i <= selectedStars ? ' active' : ''}`;
                    btn.textContent = '★';
                    btn.setAttribute('aria-label', `${i} ${i === 1 ? 'звезда' : 'звезды'}`);
                    btn.setAttribute('aria-pressed', i <= selectedStars ? 'true' : 'false');
                    btn.addEventListener('click', () => onPick(i));
                    wrap.appendChild(btn);
                }
                container.appendChild(wrap);
            }

            climbRatingQuery(climbType, climbId) {
                return climbType === 'route'
                    ? `climb_type=route&route_id=${encodeURIComponent(climbId)}`
                    : `climb_type=boulder&boulder_id=${encodeURIComponent(climbId)}`;
            }

            async saveCommunityStarRating(climbType, climbId, starValue, currentStars) {
                const felt = (document.getElementById('climbLogFeltGrade')?.value || '').trim();
                if (currentStars === starValue) {
                    await apiFetch(`/api/ratings?${this.climbRatingQuery(climbType, climbId)}`, { method: 'DELETE' });
                    return 0;
                }
                await apiFetch('/api/ratings', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        climb_type: climbType,
                        route_id: climbType === 'route' ? Number(climbId) : null,
                        boulder_id: climbType === 'boulder' ? Number(climbId) : null,
                        stars: starValue,
                        felt_grade: felt || null
                    })
                });
                return starValue;
            }

            buildClimbCommunityStatsHtml(stats) {
                const parts = [];
                if (stats.my_status === 'send') {
                    parts.push('<span class="climb-sent-badge">вы пролазали</span>');
                }
                if (stats.felt_grades?.length) {
                    parts.push(`${parts.length ? ' · ' : ''}мнения: ${stats.felt_grades.map((g) => this.escapeHtml(g)).join(', ')}`);
                }
                return parts.length ? parts.join('') : '<span style="color:var(--light-text);">Пока нет данных от сообщества.</span>';
            }

            buildClimbCommunitySendItemHtml(s) {
                const style = s.ascent_style || '';
                const styleClass = style ? ` style-${style}` : '';
                const styleRu = style ? this.ascentStyleLabel(style) : '';
                const when = s.logged_at
                    ? new Date(s.logged_at).toLocaleString('ru-RU', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                    })
                    : '';
                const extra = styleRu ? ` · ${this.escapeHtml(styleRu)}` : '';
                return `<li class="${styleClass}"><strong>${this.escapeHtml(s.user_display_name)}</strong>${extra}<br><span style="color:var(--light-text);">${s.tries} поп. · ${when}</span></li>`;
            }

            buildClimbCommunitySendsHtml(stats) {
                const count = stats.send_count || 0;
                const recent = stats.recent_sends || [];
                if (!count) {
                    return '<p class="climb-community-sends-title">Пролазы</p><p class="climb-community-sends-empty">Пока никто не залогировал пролаз.</p>';
                }
                const items = recent.map((s) => this.buildClimbCommunitySendItemHtml(s)).join('');
                const more = count > recent.length
                    ? `<p class="climb-community-sends-empty" style="margin-top:8px;text-align:center;">и ещё ${count - recent.length}…</p>`
                    : '';
                const swipeHint = recent.length > 1
                    ? '<p class="climb-sends-swipe-hint">Свайп влево и вправо</p>'
                    : '';
                return `
                    <div class="climb-sends-block">
                        <button type="button" class="climb-sends-toggle btn btn-secondary" aria-expanded="false">
                            <span>Пролазы (${count})</span>
                            <i class="fas fa-chevron-down climb-sends-toggle-icon" aria-hidden="true"></i>
                        </button>
                        <div class="climb-sends-panel hidden">
                            <div class="climb-sends-swipe">
                                <ul class="climb-community-sends-list climb-sends-swipe-track">${items}</ul>
                            </div>
                            ${swipeHint}
                            ${more}
                        </div>
                    </div>
                `;
            }

            bindClimbSendsPanel(container) {
                const toggle = container?.querySelector('.climb-sends-toggle');
                const panel = container?.querySelector('.climb-sends-panel');
                if (!toggle || !panel) return;
                toggle.addEventListener('click', () => {
                    const willOpen = panel.classList.contains('hidden');
                    panel.classList.toggle('hidden');
                    toggle.classList.toggle('is-open', willOpen);
                    toggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
                });
            }

            async refreshProfileLogbookSection() {
                if (!this.isLoggedIn()) return;
                try {
                    if (!_offlineMode && typeof refreshCatalogFromApi === 'function') {
                        await refreshCatalogFromApi({ skipWake: true }).catch(() => {});
                    }
                    const [profile, ascents] = await Promise.all([
                        apiFetch('/api/users/me/profile'),
                        apiFetch('/api/me/ascents?status=send&limit=500')
                    ]);
                    this.renderProfileStatsGrid(profile, ascents);
                    const sendsDialog = document.getElementById('profileSendsDialog');
                    if (sendsDialog && !sendsDialog.classList.contains('hidden')) {
                        const listEl = document.getElementById('profileSendsList');
                        if (listEl) {
                            listEl.innerHTML = this.renderProfileLogbookByDays(ascents);
                            this.bindProfileLogbookClicks(listEl);
                        }
                    }
                    const stylesDialog = document.getElementById('profileStylesDialog');
                    if (stylesDialog && !stylesDialog.classList.contains('hidden')) {
                        const stylesList = document.getElementById('profileStylesList');
                        if (stylesList) {
                            const styled = ascents.filter((a) => ['onsight', 'flash', 'redpoint'].includes(a.ascent_style));
                            const order = { onsight: 0, flash: 1, redpoint: 2 };
                            styled.sort((x, y) => (order[x.ascent_style] ?? 9) - (order[y.ascent_style] ?? 9));
                            stylesList.innerHTML = styled.length
                                ? styled.map((a) => this.renderProfileAscentListItem(a)).join('')
                                : '<li style="padding:12px;color:var(--light-text);">Нет записей с типом онсайт / флэш / редпоинт.</li>';
                            this.bindProfileClimbListClicks(stylesList);
                        }
                    }
                } catch (err) {
                    console.warn('profile logbook refresh', err);
                }
            }

            async refreshClimbDetailViewPanel(climbType, climbId) {
                const panel = document.getElementById('climbDetailCommunity');
                const statsEl = document.getElementById('climbDetailCommunityStats');
                const sendsEl = document.getElementById('climbDetailCommunitySends');
                if (!panel || !statsEl) return;
                panel.classList.remove('hidden');
                statsEl.textContent = 'Загрузка…';
                if (sendsEl) sendsEl.innerHTML = '';
                try {
                    const stats = await this.fetchClimbCommunityStats(climbType, climbId);
                    this._climbCommunityStats = stats;
                    patchClimbRatingInLocalCache(climbType, climbId, stats.avg_stars);
                    statsEl.innerHTML = this.buildClimbCommunityStatsHtml(stats);
                    if (sendsEl) {
                        sendsEl.innerHTML = this.buildClimbCommunitySendsHtml(stats);
                        this.bindClimbSendsPanel(sendsEl);
                    }
                    this.syncClimbDetailFooterActions();
                } catch (err) {
                    statsEl.textContent = 'Не удалось загрузить статистику';
                    console.warn('community stats', err);
                }
            }

            fillClimbLogDialogHeader(climbType, climb) {
                const titleEl = document.getElementById('climbLogTitle');
                const metaEl = document.getElementById('climbLogMeta');
                if (!climb) return;
                const name = climb.name || (climbType === 'route' ? 'Трасса' : 'Боулдеринг');
                if (titleEl) titleEl.textContent = name;
                if (!metaEl) return;
                const grade = climb.grade != null && climb.grade !== '' ? String(climb.grade) : '—';
                const kindRu = climbType === 'route' ? 'Трасса' : 'Боулдеринг';
                metaEl.textContent = `${kindRu} · ${grade}`;
            }

            async openClimbLogDialog() {
                const ctx = this._climbDetailContext;
                if (!ctx) {
                    this.showToast('Откройте трассу из каталога', true);
                    return;
                }
                if (!this.isLoggedIn() || !this.isTelegramUser()) {
                    this.showToast('Войдите через Telegram Mini App', true);
                    return;
                }
                const climbType = ctx.climbType;
                const climbId = ctx.climbId;
                const climb = climbType === 'route'
                    ? getRoutes().find((r) => String(r.id) === String(climbId))
                    : getBoulders().find((b) => String(b.id) === String(climbId));
                this.fillClimbLogDialogHeader(climbType, climb);
                this.showDialog('climbLogDialog');
                await this.refreshClimbLogPanel(climbType, climbId);
                if (typeof window.syncTelegramWebAppButtons === 'function') {
                    window.syncTelegramWebAppButtons('climbLogDialog');
                }
            }

            async refreshClimbLogPanel(climbType, climbId) {
                const formEl = document.getElementById('climbLogForm');
                if (!formEl) return;
                formEl.innerHTML = '<p style="color:var(--light-text);margin:0;">Загрузка…</p>';
                try {
                    const stats = this._climbCommunityStats
                        || await this.fetchClimbCommunityStats(climbType, climbId);
                    this._climbCommunityStats = stats;
                    const triesVal = stats.my_tries || 1;
                    formEl.innerHTML = `
                        <div class="climb-log-field">
                            <span class="form-label">Тип пролаза</span>
                            <div class="climb-log-field-row">
                                <div class="ascent-style-picker" id="climbLogSendStylePicker" role="radiogroup" aria-label="Тип пролаза">
                                    <button type="button" class="ascent-style-btn" data-style="onsight" aria-pressed="false">Онсайт</button>
                                    <button type="button" class="ascent-style-btn" data-style="flash" aria-pressed="false">Флэш</button>
                                    <button type="button" class="ascent-style-btn active" data-style="redpoint" aria-pressed="true">Редпоинт</button>
                                </div>
                                <input type="hidden" id="climbLogSendStyle" value="redpoint">
                            </div>
                        </div>
                        <div class="climb-log-field" id="climbLogTriesField">
                            <span class="form-label">Попыток</span>
                            <div class="climb-log-field-row">
                                <input type="number" class="form-input" id="climbLogTries" min="1" max="99" value="${triesVal}">
                            </div>
                        </div>
                        <div class="climb-log-field">
                            <span class="form-label">Ваша категория</span>
                            <input type="text" class="form-input" id="climbLogFeltGrade" placeholder="Например, 7a" value="${this.escapeHtml(stats.my_felt_grade || '')}" maxlength="32">
                        </div>
                        <div class="climb-log-field">
                            <span class="form-label">Оценка качества</span>
                            <span id="climbLogUserStarsPicker"></span>
                        </div>
                    `;

                    this.bindAscentStylePicker('redpoint');

                    let pickedStars = Math.min(3, stats.my_stars || 0);
                    const starsWrap = document.getElementById('climbLogUserStarsPicker');
                    const starPickHandler = (n) => {
                        void (async () => {
                            try {
                                const next = await this.saveCommunityStarRating(climbType, climbId, n, pickedStars);
                                pickedStars = next;
                                this.renderCommunityStarPicker(starsWrap, pickedStars, starPickHandler);
                                const fresh = await this.fetchClimbCommunityStats(climbType, climbId);
                                this._climbCommunityStats = fresh;
                                patchClimbRatingInLocalCache(climbType, climbId, fresh.avg_stars);
                                await this.refreshClimbDetailViewPanel(climbType, climbId);
                                this.renderCatalog();
                                if (!APP_BOULDER_ONLY) this.renderRoutes();
                                this.renderBoulders();
                            } catch (err) {
                                this.showToast(err.message, true);
                            }
                        })();
                    };
                    this.renderCommunityStarPicker(starsWrap, pickedStars, starPickHandler);
                } catch (err) {
                    formEl.innerHTML = '<p style="color:var(--light-text);margin:0;">Не удалось загрузить форму.</p>';
                    console.warn('climb log form', err);
                }
            }

            /** @deprecated use refreshClimbDetailViewPanel */
            async refreshClimbCommunityPanel(climbType, climbId) {
                return this.refreshClimbDetailViewPanel(climbType, climbId);
            }

            profileAvatarInitials(name) {
                const cleaned = this.formatProfileDisplayName({ display_name: name });
                const parts = cleaned.split(/\s+/).filter(Boolean);
                if (!parts.length) return '?';
                if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
                return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
            }

            formatProfileDisplayName(user) {
                const raw = String(user?.display_name || '').trim();
                const cleaned = raw.replace(/\s*\(@[\w.]+\)\s*$/u, '').trim();
                return cleaned || 'Пользователь';
            }

            getTelegramUserPhotoUrl() {
                const photo = window.Telegram?.WebApp?.initDataUnsafe?.user?.photo_url;
                return photo ? String(photo).trim() : '';
            }

            async refreshTelegramProfile() {
                if (!window.isTelegramMiniApp?.() || !window.__TG_INIT_DATA) return null;
                try {
                    const tokenData = await apiFetch('/api/auth/telegram', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ init_data: window.__TG_INIT_DATA })
                    });
                    const auth = getAuthData();
                    auth.accessToken = tokenData.access_token || auth.accessToken;
                    auth.currentUser = tokenData.user || auth.currentUser;
                    if (!auth.currentUser && auth.accessToken) {
                        auth.currentUser = await apiFetch('/api/auth/me');
                    }
                    saveAuthData(auth);
                    this.auth = auth;
                    return auth.currentUser;
                } catch {
                    return null;
                }
            }

            updateProfileAvatar(user, profile) {
                const img = document.getElementById('profileAvatarImg');
                const fallback = document.getElementById('profileAvatarFallback');
                if (!img || !fallback) return;

                const photoUrl = (
                    profile?.telegram_photo_url
                    || user?.telegram_photo_url
                    || this.getTelegramUserPhotoUrl()
                    || ''
                ).trim();
                const initials = this.profileAvatarInitials(user?.display_name || 'П');

                img.onerror = () => {
                    img.classList.add('hidden');
                    img.removeAttribute('src');
                    fallback.textContent = initials;
                    fallback.classList.remove('hidden');
                    fallback.setAttribute('aria-hidden', 'false');
                };

                if (photoUrl) {
                    fallback.classList.add('hidden');
                    fallback.setAttribute('aria-hidden', 'true');
                    img.alt = this.formatProfileDisplayName(user);
                    if (img.src !== photoUrl) {
                        img.src = photoUrl;
                    }
                    img.classList.remove('hidden');
                } else {
                    img.classList.add('hidden');
                    img.removeAttribute('src');
                    fallback.textContent = initials;
                    fallback.classList.remove('hidden');
                    fallback.setAttribute('aria-hidden', 'false');
                }
            }

            renderProfileIdentity(user) {
                const nameEl = document.getElementById('profileDisplayName');
                const usernameEl = document.getElementById('profileUsername');
                if (!nameEl || !usernameEl) return;
                nameEl.textContent = this.formatProfileDisplayName(user);
                const un = user?.telegram_username ? `@${user.telegram_username}` : '';
                usernameEl.textContent = un;
            }

            formatRankingPoints(n) {
                const v = Number(n);
                if (!Number.isFinite(v)) return '—';
                return v.toLocaleString('ru-RU');
            }

            async renderRankingTab() {
                const wrap = document.getElementById('rankingTableWrap');
                const hint = document.getElementById('rankingHint');
                const myPlace = document.getElementById('rankingMyPlace');
                if (!wrap) return;
                wrap.innerHTML = `
                    <div class="loading">
                        <div class="loading-spinner"></div>
                        <p>Загрузка рейтинга…</p>
                    </div>`;
                try {
                    const data = await apiFetch('/api/ranking/leaderboard?top=10&months=12');
                    if (hint) {
                        hint.textContent = `Баллы по модели 8a.nu: сумма ${data.top_performances} лучших пролазов за ${data.months} мес. в каждой дисциплине. 8a = 1000, +50 за «+», бонусы: онсайт +147, флэш +53, второй заход +2.`;
                    }
                    if (myPlace) {
                        if (this.isLoggedIn() && data.my_row) {
                            myPlace.classList.remove('hidden');
                            myPlace.innerHTML = `Ваше место: <strong>#${data.my_rank}</strong> — трудность <strong>${this.formatRankingPoints(data.my_row.route_points)}</strong>, боулдеринг <strong>${this.formatRankingPoints(data.my_row.boulder_points)}</strong>, итого <strong>${this.formatRankingPoints(data.my_row.total_points)}</strong>`;
                        } else {
                            myPlace.classList.add('hidden');
                            myPlace.innerHTML = '';
                        }
                    }
                    if (!data.rows?.length) {
                        wrap.innerHTML = `
                            <div class="ranking-empty">
                                <i class="fas fa-trophy" style="font-size:28px;opacity:0.35;margin-bottom:8px;"></i>
                                <p>Пока никто не занёс пролазы в логбук.</p>
                                <p style="font-size:13px;margin-top:6px;">Отметьте пролаз на трассе или боулдере — и появитесь в рейтинге.</p>
                            </div>`;
                        return;
                    }
                    const currentId = this.getCurrentUser()?.id || '';
                    const rowsHtml = data.rows.map((row) => {
                        const isMe = currentId && row.user_id === currentId;
                        const topClass = row.rank === 1 ? ' ranking-row--top1' : '';
                        const meClass = isMe ? ' ranking-row--me' : '';
                        const handle = row.telegram_username
                            ? `<span class="ranking-user-handle">@${this.escapeHtml(row.telegram_username)}</span>`
                            : '';
                        return `
                            <tr class="ranking-row${topClass}${meClass}">
                                <td class="ranking-num">${row.rank}</td>
                                <td>
                                    <span class="ranking-user-name">${this.escapeHtml(row.display_name)}</span>
                                    ${handle}
                                </td>
                                <td class="ranking-points">${this.formatRankingPoints(row.route_points)}</td>
                                <td class="ranking-points">${this.formatRankingPoints(row.boulder_points)}</td>
                                <td class="ranking-points">${this.formatRankingPoints(row.total_points)}</td>
                            </tr>`;
                    }).join('');
                    wrap.innerHTML = `
                        <table class="ranking-table" aria-label="Рейтинг скалолазов по баллам">
                            <thead>
                                <tr>
                                    <th class="ranking-num" scope="col">#</th>
                                    <th scope="col">Скалолаз</th>
                                    <th class="ranking-points" scope="col">Трудность</th>
                                    <th class="ranking-points" scope="col">Боулдеринг</th>
                                    <th class="ranking-points" scope="col">Итого</th>
                                </tr>
                            </thead>
                            <tbody>${rowsHtml}</tbody>
                        </table>`;
                } catch (err) {
                    wrap.innerHTML = `<p style="color:var(--danger-color);padding:12px;">${this.escapeHtml(err.message || 'Не удалось загрузить рейтинг')}</p>`;
                }
            }

            async renderProfileTab() {
                const guest = document.getElementById('profileGuestBlock');
                const userBlock = document.getElementById('profileUserBlock');
                if (!guest || !userBlock) return;
                if (!this.isLoggedIn()) {
                    guest.classList.remove('hidden');
                    userBlock.classList.add('hidden');
                    return;
                }
                guest.classList.add('hidden');
                userBlock.classList.remove('hidden');

                let user = this.getCurrentUser();
                if (this.isTelegramUser()) {
                    const refreshed = await this.refreshTelegramProfile();
                    if (refreshed) user = refreshed;
                }
                this.renderProfileIdentity(user);

                try {
                    if (!_offlineMode && typeof refreshCatalogFromApi === 'function') {
                        await refreshCatalogFromApi({ skipWake: true }).catch(() => {});
                    }
                    const [profile, ascents] = await Promise.all([
                        apiFetch('/api/users/me/profile'),
                        apiFetch('/api/me/ascents?status=send&limit=500')
                    ]);
                    this.updateProfileAvatar(user, profile);
                    this.renderProfileStatsGrid(profile, ascents);
                } catch (err) {
                    const grid = document.getElementById('profileStatsGrid');
                    if (grid) {
                        grid.innerHTML = `<p style="color:var(--danger-color);">${this.escapeHtml(err.message)}</p>`;
                    }
                }
            }

            ascentStyleLabel(style) {
                const map = { onsight: 'Онсайт', flash: 'Флэш', redpoint: 'Редпоинт' };
                return map[style] || '';
            }

            normalizeAscentClimbType(a) {
                const raw = String(a?.climb_type || '').trim().toLowerCase();
                if (raw === 'route' || raw === 'boulder') return raw;
                if (a?.route_id != null && a?.boulder_id == null) return 'route';
                if (a?.boulder_id != null && a?.route_id == null) return 'boulder';
                return raw || 'route';
            }

            ascentClimbId(a) {
                if (!a) return null;
                const climbType = this.normalizeAscentClimbType(a);
                const id = climbType === 'route' ? a.route_id : a.boulder_id;
                const n = Number(id);
                return Number.isFinite(n) ? n : null;
            }

            findClimbInCatalog(climbType, climbId) {
                if (climbId == null) return null;
                const id = String(climbId);
                if (climbType === 'route') {
                    return getRoutes().find((r) => String(r.id) === id) || null;
                }
                return getBoulders().find((b) => String(b.id) === id) || null;
            }

            async ensureClimbInCatalog(climbType, climbId) {
                const id = String(climbId);
                const existing = this.findClimbInCatalog(climbType, id);
                if (existing) return existing;

                if (!_offlineMode && typeof refreshCatalogFromApi === 'function') {
                    await refreshCatalogFromApi({ skipWake: true }).catch(() => {});
                    const refreshed = this.findClimbInCatalog(climbType, id);
                    if (refreshed) return refreshed;
                }

                try {
                    if (climbType === 'route') {
                        const apiRoute = await apiFetch(`/api/routes/${encodeURIComponent(id)}`);
                        const route = mapApiRouteToUi(apiRoute);
                        saveRoutes([...getRoutes().filter((r) => String(r.id) !== id), route]);
                        return route;
                    }
                    const apiBoulder = await apiFetch(`/api/boulders/${encodeURIComponent(id)}`);
                    const boulder = mapApiBoulderToUi(apiBoulder);
                    saveBoulders([...getBoulders().filter((b) => String(b.id) !== id), boulder]);
                    return boulder;
                } catch (err) {
                    console.warn('ensure climb in catalog', err);
                    return null;
                }
            }

            ascentKindLabel(climbType) {
                return climbType === 'route' ? 'Трасса' : 'Боулдер';
            }

            resolveAscentDisplay(a) {
                const climbType = this.normalizeAscentClimbType(a);
                const climbId = this.ascentClimbId(a);
                let name = String(a?.climb_name ?? '').trim();
                let grade = String(a?.climb_grade ?? '').trim();
                let structure = String(a?.structure_label ?? '').trim();

                const climb = climbId != null ? this.findClimbInCatalog(climbType, climbId) : null;
                if (climb) {
                    const catalogName = String(climb.name ?? '').trim();
                    if (catalogName) name = name || catalogName;
                    if (!grade && climb.grade != null && climb.grade !== '') {
                        grade = String(climb.grade);
                    }
                    if (!structure && climb.sectorId != null) {
                        structure = String(this.getStructureLabel(climb.sectorId) || '').trim();
                    }
                }

                if (!name && climbId != null) name = `#${climbId}`;

                return {
                    climbId,
                    climbType,
                    name,
                    grade,
                    structure,
                    kind: this.ascentKindLabel(climbType)
                };
            }

            buildProfileSendsStatCardHtml(sendsCount, ascents) {
                const items = ascents || [];
                const previewHtml = items.length
                    ? `<div class="profile-sends-preview">${items.map((a) => {
                        const d = this.resolveAscentDisplay(a);
                        const kindClass = d.climbType === 'route' ? 'route' : 'boulder';
                        const style = a.ascent_style || '';
                        const styleBadge = style
                            ? `<span class="profile-style-badge style-${style}">${this.escapeHtml(this.ascentStyleLabel(style))}</span>`
                            : '';
                        const deleted = !!a.climb_deleted;
                        const openAttrs = deleted || d.climbId == null
                            ? ' type="button" disabled aria-disabled="true"'
                            : ` type="button" data-open-climb-type="${d.climbType}" data-open-climb-id="${d.climbId}"`;
                        return `<button class="profile-sends-preview-item${style ? ` style-${style}` : ''}${deleted ? ' is-deleted' : ''}"${openAttrs}>
                            <span class="profile-sends-preview-name">${this.escapeHtml(d.name)}</span>
                            ${d.grade ? `<span class="profile-sends-preview-grade">${this.escapeHtml(d.grade)}</span>` : ''}
                            <span class="profile-sends-preview-kind profile-sends-preview-kind--${kindClass}">${d.kind}</span>
                            ${styleBadge}
                        </button>`;
                    }).join('')}</div>`
                    : '<div class="profile-sends-preview profile-sends-preview--empty">Пока нет пролазов</div>';

                return `<div class="profile-stat-card profile-stat-card--sends" data-profile-stat="sends" aria-label="Мои пролазы">
                    <div class="profile-stat-card-head">
                        <strong>${sendsCount}</strong>
                        <span class="profile-stat-card-label">пролазов</span>
                    </div>
                    ${previewHtml}
                </div>`;
            }

            bindProfileSendsStatCardClicks(container) {
                if (!container) return;
                container.querySelectorAll('[data-open-climb-type]').forEach((el) => {
                    el.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const climbType = el.getAttribute('data-open-climb-type');
                        const climbId = Number(el.getAttribute('data-open-climb-id'));
                        if (!climbType || !Number.isFinite(climbId)) return;
                        void this.openAscentFromProfile(climbType, climbId);
                    });
                });
            }

            renderProfileStatsGrid(profile, ascents = []) {
                const grid = document.getElementById('profileStatsGrid');
                if (!grid) return;
                const stylesCount = profile.styles_count ?? profile.attempts_count ?? 0;
                grid.className = 'profile-stats-grid';
                grid.innerHTML = `
                    ${this.buildProfileSendsStatCardHtml(profile.sends_count ?? 0, ascents)}
                    <button type="button" class="profile-stat-card" data-profile-stat="styles" aria-label="Стили пролаза">
                        <strong>${stylesCount}</strong>
                        <span class="profile-stat-card-label">стилей</span>
                    </button>
                    <div class="profile-stat-card">
                        <strong>${profile.ratings_count ?? 0}</strong>
                        <span class="profile-stat-card-label">рейтинг</span>
                    </div>
                `;
                this.bindProfileSendsStatCardClicks(grid.querySelector('[data-profile-stat="sends"]'));
                grid.querySelector('[data-profile-stat="styles"]')?.addEventListener('click', () => {
                    void this.openProfileStylesDialog();
                });
            }

            isClimbInCatalog(climbType, climbId) {
                const id = String(climbId);
                if (climbType === 'route') {
                    return getRoutes().some((r) => String(r.id) === id);
                }
                return getBoulders().some((b) => String(b.id) === id);
            }

            formatAscentWhen(iso, { timeOnly } = {}) {
                if (!iso) return '';
                const d = new Date(iso);
                if (timeOnly) {
                    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                }
                return d.toLocaleString('ru-RU', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }

            buildAscentCardHtml(a, { compact }) {
                const display = this.resolveAscentDisplay(a);
                const climbId = display.climbId;
                const climbType = display.climbType;
                const kind = display.kind;
                const name = display.name || '—';
                const grade = display.grade;
                const structure = display.structure;
                const style = a.ascent_style || '';
                const styleClass = style ? ` style-${style}` : '';
                const deleted = !!a.climb_deleted;
                const deletedClass = deleted ? ' is-deleted' : '';
                const openAttrs = deleted || climbId == null
                    ? ' type="button" disabled aria-disabled="true"'
                    : ` type="button" data-open-climb-type="${climbType}" data-open-climb-id="${climbId}"`;
                const badge = style
                    ? `<span class="profile-style-badge style-${style}">${this.escapeHtml(this.ascentStyleLabel(style))}</span>`
                    : '';
                const gradeHtml = grade
                    ? `<span class="profile-ascent-grade">${this.escapeHtml(grade)}</span>`
                    : '';
                const structureHtml = structure
                    ? `<span class="profile-ascent-structure">${this.escapeHtml(structure)}</span>`
                    : '';
                const when = this.formatAscentWhen(a.logged_at, { timeOnly: compact });
                const tries = Math.max(1, Number(a.tries) || 1);
                const triesLabel = tries === 1 ? '1 попытка' : `${tries} поп.`;
                const removedHtml = deleted
                    ? '<div class="profile-ascent-removed">Удалена из каталога — данные обновятся у всех пользователей</div>'
                    : '';

                const titleInnerHtml = `<span class="profile-ascent-name">${this.escapeHtml(name)}</span>${gradeHtml}${badge}`;
                const metaHtml = `<div class="profile-ascent-meta">
                            <span class="profile-ascent-kind">${kind}</span>
                            ${structureHtml}
                            <span class="profile-ascent-tries">${triesLabel}</span>
                            ${when ? `<span class="profile-ascent-when">${when}</span>` : ''}
                        </div>`;

                if (compact) {
                    return `<button class="profile-log-item profile-logbook-entry profile-ascent-card${styleClass}${deletedClass}"${openAttrs}>
                        <div class="profile-ascent-title-row">${titleInnerHtml}</div>
                        ${metaHtml}
                        ${removedHtml}
                    </button>`;
                }

                return `<li class="profile-ascent-item">
                    <button class="profile-climb-list-item profile-ascent-card${styleClass}${deletedClass}"${openAttrs}>
                        <h4 class="profile-ascent-title-row profile-ascent-title">${titleInnerHtml}</h4>
                        ${metaHtml}
                        ${removedHtml}
                    </button>
                </li>`;
            }

            async openAscentFromProfile(climbType, climbId, ascentRow) {
                if (ascentRow?.climb_deleted) {
                    const label = this.ascentKindLabel(climbType).toLowerCase();
                    this.showToast(`${label.charAt(0).toUpperCase()}${label.slice(1)} удалена из каталога`, false);
                    return;
                }
                const climb = await this.ensureClimbInCatalog(climbType, climbId);
                if (!climb) {
                    this.showToast('Объект больше не в каталоге. Обновите данные.', false);
                    return;
                }
                this.hideDialog('profileSendsDialog');
                this.hideDialog('profileStylesDialog');
                await this.showClimbDetailDialog(climbType, climbId);
            }

            bindProfileClimbListClicks(container) {
                if (!container) return;
                container.querySelectorAll('[data-open-climb-type]').forEach((el) => {
                    el.addEventListener('click', () => {
                        const climbType = el.getAttribute('data-open-climb-type');
                        const climbId = Number(el.getAttribute('data-open-climb-id'));
                        if (!climbType || !Number.isFinite(climbId)) return;
                        void this.openAscentFromProfile(climbType, climbId);
                    });
                });
            }

            bindProfileLogbookClicks(container) {
                if (!container) return;
                container.querySelectorAll('[data-open-climb-type]').forEach((el) => {
                    el.addEventListener('click', () => {
                        const climbType = el.getAttribute('data-open-climb-type');
                        const climbId = Number(el.getAttribute('data-open-climb-id'));
                        if (!climbType || !Number.isFinite(climbId)) return;
                        void this.openAscentFromProfile(climbType, climbId);
                    });
                });
            }

            formatLogbookDayKey(iso) {
                if (!iso) return 'Без даты';
                const d = new Date(iso);
                const today = new Date();
                const yesterday = new Date(today);
                yesterday.setDate(today.getDate() - 1);
                if (d.toDateString() === today.toDateString()) return 'Сегодня';
                if (d.toDateString() === yesterday.toDateString()) return 'Вчера';
                return d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            }

            renderProfileLogbookItem(a) {
                return this.buildAscentCardHtml(a, { compact: true });
            }

            renderProfileLogbookByDays(ascents) {
                if (!ascents.length) {
                    return '<p style="color:var(--light-text);">Пока пусто — откройте трассу из каталога и нажмите «Пролаз».</p>';
                }
                const byDay = new Map();
                for (const a of ascents) {
                    const key = this.formatLogbookDayKey(a.logged_at);
                    if (!byDay.has(key)) byDay.set(key, []);
                    byDay.get(key).push(a);
                }
                let html = '';
                for (const [day, items] of byDay) {
                    html += `<section class="profile-logbook-day"><h4 class="profile-logbook-day-title">${this.escapeHtml(day)}</h4>`;
                    html += items.map((a) => this.renderProfileLogbookItem(a)).join('');
                    html += '</section>';
                }
                return html;
            }

            renderProfileAscentListItem(a) {
                return this.buildAscentCardHtml(a, { compact: false });
            }

            async openProfileSendsDialog() {
                if (!this.isLoggedIn()) {
                    this.showToast('Войдите через Telegram', true);
                    return;
                }
                const listEl = document.getElementById('profileSendsList');
                if (!listEl) return;
                listEl.innerHTML = '<p style="padding:12px;color:var(--light-text);margin:0;">Загрузка…</p>';
                this.showDialog('profileSendsDialog');
                try {
                    if (!_offlineMode && typeof refreshCatalogFromApi === 'function') {
                        await refreshCatalogFromApi({ skipWake: true }).catch(() => {});
                    }
                    const ascents = await apiFetch('/api/me/ascents?status=send&limit=500');
                    listEl.innerHTML = this.renderProfileLogbookByDays(ascents);
                    this.bindProfileLogbookClicks(listEl);
                } catch (err) {
                    listEl.innerHTML = `<p style="padding:12px;color:var(--danger-color);margin:0;">${this.escapeHtml(err.message)}</p>`;
                }
            }

            async openProfileStylesDialog() {
                if (!this.isLoggedIn()) {
                    this.showToast('Войдите через Telegram', true);
                    return;
                }
                const listEl = document.getElementById('profileStylesList');
                if (!listEl) return;
                listEl.innerHTML = '<li style="padding:12px;color:var(--light-text);">Загрузка…</li>';
                this.showDialog('profileStylesDialog');
                try {
                    const ascents = await apiFetch('/api/me/ascents?styles_only=true&limit=500');
                    if (!ascents.length) {
                        listEl.innerHTML = '<li style="padding:12px;color:var(--light-text);">Нет записей с типом онсайт / флэш / редпоинт. Укажите тип при пролазе.</li>';
                        return;
                    }
                    const order = { onsight: 0, flash: 1, redpoint: 2 };
                    ascents.sort((x, y) => (order[x.ascent_style] ?? 9) - (order[y.ascent_style] ?? 9));
                    listEl.innerHTML = ascents.map((a) => this.renderProfileAscentListItem(a)).join('');
                    this.bindProfileClimbListClicks(listEl);
                } catch (err) {
                    listEl.innerHTML = `<li style="padding:12px;color:var(--danger-color);">${this.escapeHtml(err.message)}</li>`;
                }
            }
        }

        async function bootstrapRemoteCatalog(hadLocalCatalog) {
            const bootWatchdog = setTimeout(() => {
                const statusEl = document.getElementById('appDataStatus');
                if (!statusEl || statusEl.classList.contains('hidden')) return;
                if (catalogHasContent(getClimbingData())) {
                    enterOfflineMode('Медленная сеть — показаны сохранённые данные.');
                } else {
                    setAppDataStatus(
                        'error',
                        'Сервер долго не отвечает. Проверьте сеть или нажмите «Повторить».',
                        { showRetry: true }
                    );
                }
            }, 10000);

            try {
                const online = navigator.onLine !== false;
                let awake = false;
                if (online) {
                    awake = await wakeApiServer({
                        attempts: hadLocalCatalog ? 1 : 2,
                        timeoutMs: 3500,
                        pauseMs: 400
                    });
                }
                if (!awake && catalogHasContent(getClimbingData())) {
                    enterOfflineMode('Офлайн — показаны сохранённые данные. Подключите сеть для обновления.');
                    void runTelegramAuthBootstrap();
                    return;
                }
                if (!awake) {
                    throw new Error('Сервер не отвечает');
                }
                await warnIfApiStorageNotPersistent();
                await refreshCatalogFromApi({ initial: true, skipWake: true });
                leaveOfflineMode();
                void flushOfflineOutbox();
                void runTelegramAuthBootstrap();
                void ensurePhotosLoadedFromApi().then(() => {
                    window.app?.renderPhotoAlbum?.();
                }).catch((err) => console.warn('background photos prefetch', err));
                if (typeof window.syncTelegramMiniAppUi === 'function') {
                    window.syncTelegramMiniAppUi();
                }
            } catch (err) {
                console.error('API load error', err);
                if (catalogHasContent(getClimbingData())) {
                    enterOfflineMode(
                        'Офлайн — показаны сохранённые данные. Подключите сеть и нажмите «Повторить».'
                    );
                    void runTelegramAuthBootstrap();
                    return;
                }
                setAppDataStatus(
                    'error',
                    `Не удалось загрузить данные: ${err.message || 'ошибка сети'}. Нажмите «Повторить».`,
                    { showRetry: true }
                );
            } finally {
                clearTimeout(bootWatchdog);
                if (typeof window.signalTelegramAppReady === 'function') window.signalTelegramAppReady();
            }
        }

        async function bootClimbingApp() {
            if (typeof window.signalTelegramAppReady === 'function') window.signalTelegramAppReady();
            void clearServiceWorkers();
            const hadLocalCatalog = bootstrapCatalogFromStorage();
            if (hadLocalCatalog) {
                await hydrateCatalogPhotosFromIndexedDb();
            }
            window.app = new ClimbingApp();
            if (typeof window.initTelegramWebApp === 'function') window.initTelegramWebApp();
            if (typeof window.syncTelegramMiniAppUi === 'function') {
                window.syncTelegramMiniAppUi();
            }
            if (hadLocalCatalog && shouldUseOfflineQueue()) {
                enterOfflineMode('Офлайн — показан сохранённый каталог.');
            } else if (!hadLocalCatalog) {
                setAppDataStatus('loading', 'Загрузка каталога…');
            }
            void bootstrapRemoteCatalog(hadLocalCatalog);
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => { void bootClimbingApp(); });
        } else {
            void bootClimbingApp();
        }

        window.addEventListener('online', () => {
            void (async () => {
                try {
                    const awake = await wakeApiServer({ attempts: 3, timeoutMs: 12000, pauseMs: 800 });
                    if (!awake) return;
                    if (offlineOutboxSize() > 0) {
                        setAppDataStatus('loading', 'Сеть восстановлена — синхронизация…');
                        await flushOfflineOutbox();
                    }
                    if (!window.app || !_appRemoteDataReady) return;
                    setAppDataStatus('loading', 'Сеть восстановлена — обновление каталога…');
                    await refreshCatalogFromApi({ force: true, skipWake: true });
                    leaveOfflineMode();
                    void ensurePhotosLoadedFromApi()
                        .then(() => window.app?.renderPhotoAlbum?.())
                        .catch((err) => console.warn('photos refresh after online', err));
                } catch (err) {
                    console.warn('online catalog refresh', err);
                }
            })();
        });

        window.addEventListener('offline', () => {
            if (catalogHasContent(getClimbingData())) {
                enterOfflineMode('Связь потеряна — показан сохранённый каталог.');
            }
        });

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState !== 'visible') return;
            if (shouldUseOfflineQueue() || offlineOutboxSize() === 0) return;
            void flushOfflineOutbox();
        });
