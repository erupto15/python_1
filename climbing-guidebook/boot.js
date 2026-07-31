(function () {
    'use strict';

    function signalReady() {
        if (typeof window.signalTelegramAppReady === 'function') {
            window.signalTelegramAppReady();
            return;
        }
        try {
            if (window.TelegramWebviewProxy && typeof window.TelegramWebviewProxy.postEvent === 'function') {
                window.TelegramWebviewProxy.postEvent('web_app_ready', JSON.stringify(''));
                window.TelegramWebviewProxy.postEvent('web_app_expand', JSON.stringify(''));
            }
        } catch (_) {}
    }

    signalReady();

    function revealShell() {
        if (typeof window.hideTelegramBootOverlay === 'function') {
            window.hideTelegramBootOverlay();
        }
        signalReady();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', revealShell, { once: true });
    } else {
        revealShell();
    }

    const script = document.createElement('script');
    script.src = '/app.js';
    script.async = true;
    script.onload = function () {
        revealShell();
        signalReady();
    };
    script.onerror = function () {
        const overlay = document.getElementById('tgBootOverlay');
        if (overlay) {
            overlay.classList.remove('hidden');
            const label = overlay.querySelector('div:last-child');
            if (label) {
                label.textContent = 'Не удалось загрузить приложение. Проверьте сеть.';
            }
        }
        signalReady();
    };
    document.body.appendChild(script);

    // Если app.js долго не отвечает — всё равно показать оболочку.
    setTimeout(revealShell, 5000);
})();
