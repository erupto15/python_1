/* Service Worker: только оболочка Mini App (index.html). API не перехватываем — иначе зависает старт. */
const SHELL_CACHE = 'guidebook-shell-v2';
const SHELL_URLS = ['/', '/index.html'];

function fetchWithTimeout(request, ms) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return fetch(request, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function serveShell(request) {
    const cache = await caches.open(SHELL_CACHE);
    const cached = (await cache.match(request)) || (await cache.match('/index.html'));

    try {
        const res = await fetchWithTimeout(request, 8000);
        if (res && res.ok) {
            cache.put(request, res.clone());
        }
        return res;
    } catch (_) {
        if (cached) return cached;
        throw _;
    }
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(SHELL_CACHE)
            .then((cache) => Promise.allSettled(SHELL_URLS.map((url) => cache.add(url))))
            .then(() => self.skipWaiting())
            .catch(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    if (url.pathname === '/' || url.pathname === '/index.html') {
        event.respondWith(serveShell(event.request));
    }
});
