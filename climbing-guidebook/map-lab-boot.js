(function () {
    'use strict';

    async function start() {
        const role = document.body?.dataset?.mapLabRole === 'admin' ? 'admin' : 'view';
        if (window.MapLab && typeof window.MapLab.boot === 'function') {
            await window.MapLab.boot(role);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})();
