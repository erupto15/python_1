/* Service Worker: офлайн-оболочка Mini App и кэш публичных GET /api/* */
const SHELL_CACHE = 'guidebook-shell-v1';
const API_CACHE = 'guidebook-api-v1';
const SHELL_URLS = ['/', '/index.html'];

const API_PREFIXES = [
    '/api/areas',
    '/api/routes',
    '/api/boulders',
    '/api/photos',
    '/health'
];

function isApiCatalogRequest(url) {
    if (url.origin !== self.location.origin) return false;
    return API_PREFIXES.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`));
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(SHELL_CACHE)
            .then((cache) => cache.addAll(SHELL_URLS))
            .then(() => self.skipWaiting())
            .catch(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((k) => k !== SHELL_CACHE && k !== API_CACHE)
                    .map((k) => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

async function networkFirstShell(request) {
    const cache = await caches.open(SHELL_CACHE);
    try {
        const res = await fetch(request);
        if (res && res.ok) {
            cache.put(request, res.clone());
        }
        return res;
    } catch (_) {
        const cached = await cache.match(request);
        if (cached) return cached;
        const fallback = await cache.match('/index.html');
        if (fallback) return fallback;
        throw _;
    }
}

async function staleWhileRevalidateApi(request) {
    const cache = await caches.open(API_CACHE);
    const cached = await cache.match(request);
    const fetchPromise = fetch(request)
        .then((res) => {
            if (res && res.ok) {
                cache.put(request, res.clone());
            }
            return res;
        })
        .catch(() => null);

    if (cached) {
        void fetchPromise;
        return cached;
    }
    const fresh = await fetchPromise;
    if (fresh) return fresh;
    throw new Error('offline');
}

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    if (url.pathname === '/' || url.pathname === '/index.html') {
        event.respondWith(networkFirstShell(event.request));
        return;
    }
    if (isApiCatalogRequest(url)) {
        event.respondWith(staleWhileRevalidateApi(event.request));
    }
});
