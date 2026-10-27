(function (global) {
    'use strict';

    let cachedConfig = null;
    let configPromise = null;

    async function ensureConfig() {
        if (cachedConfig) return cachedConfig;
        if (configPromise) return configPromise;
        configPromise = (async () => {
            try {
                const res = await fetch('/api/map-tiles-config', { cache: 'no-store' });
                if (res.ok) {
                    const data = await res.json();
                    cachedConfig = {
                        provider: data?.provider === 'carto' ? 'carto' : 'osm',
                        cartoBasemapsKey: String(data?.cartoBasemapsKey || '').trim()
                    };
                    return cachedConfig;
                }
            } catch (_) {}
            cachedConfig = { provider: 'osm', cartoBasemapsKey: '' };
            return cachedConfig;
        })();
        return configPromise;
    }

    function addBasemapLayer(map) {
        if (!global.L || !map) return null;
        const key = String(cachedConfig?.cartoBasemapsKey || global.CARTO_BASEMAPS_API_KEY || '').trim();
        if (key) {
            const url = `https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(key)}`;
            return global.L.tileLayer(url, {
                maxZoom: 20,
                subdomains: 'abcd',
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>'
            }).addTo(map);
        }
        return global.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 16,
            attribution: 'Tiles &copy; Esri'
        }).addTo(map);
    }

    global.GuidebookMapTiles = {
        ensureConfig,
        addBasemapLayer
    };
})(window);
