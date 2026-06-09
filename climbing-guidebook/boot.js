(function () {
    'use strict';

    function signalReady() {
        if (typeof window.signalTelegramAppReady === 'function') {
            window.signalTelegramAppReady();
        }
    }

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
    script.onload = signalReady;
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
})();
