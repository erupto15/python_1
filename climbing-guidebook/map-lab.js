(function () {
    'use strict';

    const STORAGE_KEY = '6a9a_map_lab_state';
    const DEFAULT_VIEW = [55.7558, 37.6173];
    const DEFAULT_ZOOM = 5;

    let role = 'view';
    let map;
    let markerLayer;
    let clusterGroup;
    let polylineLayer;
    let drawPreviewLayer;
    let mode = 'idle';
    let draftLine = [];

    function canEdit() {
        return role === 'admin';
    }

    function emptyState() {
        return {
            markers: [],
            polyline: [],
            clusterEnabled: true,
            updatedAt: null
        };
    }

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return emptyState();
            const data = JSON.parse(raw);
            return {
                markers: Array.isArray(data.markers) ? data.markers : [],
                polyline: Array.isArray(data.polyline) ? data.polyline : [],
                clusterEnabled: data.clusterEnabled !== false,
                updatedAt: data.updatedAt || null
            };
        } catch (_) {
            return emptyState();
        }
    }

    let state = loadState();

    function saveState() {
        state.updatedAt = new Date().toISOString();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        renderStatus();
    }

    function setMode(next) {
        mode = next;
        document.querySelectorAll('[data-map-lab-mode]').forEach((btn) => {
            btn.classList.toggle('is-active', btn.dataset.mapLabMode === mode && mode !== 'idle');
        });
        const mapEl = document.getElementById('mapLabMap');
        if (mapEl) {
            mapEl.classList.toggle('map-lab-cursor-crosshair', mode === 'marker' || mode === 'line');
        }
        renderStatus();
    }

    function markerIcon(label) {
        return L.divIcon({
            className: 'map-lab-marker-wrap',
            html: `<div class="map-lab-marker-icon" aria-hidden="true"><span>${escapeHtml(String(label))}</span></div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 28]
        });
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function clearMarkerLayers() {
        if (markerLayer) {
            markerLayer.clearLayers();
            map.removeLayer(markerLayer);
            markerLayer = null;
        }
        if (clusterGroup) {
            clusterGroup.clearLayers();
            map.removeLayer(clusterGroup);
            clusterGroup = null;
        }
    }

    function renderMarkers() {
        clearMarkerLayers();
        const items = state.markers.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng));
        if (!items.length) return;

        if (state.clusterEnabled) {
            clusterGroup = L.markerClusterGroup({
                showCoverageOnHover: false,
                maxClusterRadius: 52,
                spiderfyOnMaxZoom: true
            });
            items.forEach((m, index) => {
                const marker = L.marker([m.lat, m.lng], {
                    icon: markerIcon(m.label || index + 1)
                });
                marker.bindPopup(`<strong>${escapeHtml(m.label || `Точка ${index + 1}`)}</strong><br>${m.lat.toFixed(5)}, ${m.lng.toFixed(5)}`);
                if (canEdit()) {
                    marker.on('contextmenu', (ev) => {
                        L.DomEvent.preventDefault(ev);
                        removeMarker(m.id);
                    });
                }
                clusterGroup.addLayer(marker);
            });
            clusterGroup.addTo(map);
        } else {
            markerLayer = L.layerGroup();
            items.forEach((m, index) => {
                const marker = L.marker([m.lat, m.lng], {
                    icon: markerIcon(m.label || index + 1)
                });
                marker.bindPopup(`<strong>${escapeHtml(m.label || `Точка ${index + 1}`)}</strong><br>${m.lat.toFixed(5)}, ${m.lng.toFixed(5)}`);
                if (canEdit()) {
                    marker.on('contextmenu', (ev) => {
                        L.DomEvent.preventDefault(ev);
                        removeMarker(m.id);
                    });
                }
                markerLayer.addLayer(marker);
            });
            markerLayer.addTo(map);
        }
    }

    function renderPolyline() {
        if (polylineLayer) {
            map.removeLayer(polylineLayer);
            polylineLayer = null;
        }
        const latlngs = (state.polyline || []).filter((p) => Array.isArray(p) && p.length >= 2);
        if (latlngs.length < 2) return;
        polylineLayer = L.polyline(latlngs, {
            color: '#5d9cff',
            weight: 4,
            opacity: 0.92
        }).addTo(map);
    }

    function renderDraftLine() {
        if (drawPreviewLayer) {
            map.removeLayer(drawPreviewLayer);
            drawPreviewLayer = null;
        }
        if (draftLine.length < 2) return;
        drawPreviewLayer = L.polyline(draftLine, {
            color: '#ffb347',
            weight: 3,
            dashArray: '6 8',
            opacity: 0.9
        }).addTo(map);
    }

    function fitMapToContent() {
        const bounds = [];
        state.markers.forEach((m) => {
            if (Number.isFinite(m.lat) && Number.isFinite(m.lng)) bounds.push([m.lat, m.lng]);
        });
        (state.polyline || []).forEach((p) => {
            if (Array.isArray(p) && p.length >= 2) bounds.push(p);
        });
        if (canEdit()) {
            draftLine.forEach((p) => bounds.push(p));
        }
        if (!bounds.length) {
            map.setView(DEFAULT_VIEW, DEFAULT_ZOOM);
            return;
        }
        if (bounds.length === 1) {
            map.setView(bounds[0], 14);
            return;
        }
        map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 });
    }

    function renderAll() {
        renderMarkers();
        renderPolyline();
        if (canEdit()) renderDraftLine();
        fitMapToContent();
        renderStatus();
        renderEmptyState();
    }

    function renderEmptyState() {
        const el = document.getElementById('mapLabEmpty');
        if (!el) return;
        const hasContent = state.markers.length > 0 || (state.polyline && state.polyline.length >= 2);
        el.classList.toggle('hidden', hasContent);
    }

    function nextMarkerLabel() {
        return String(state.markers.length + 1);
    }

    function addMarker(latlng) {
        state.markers.push({
            id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            lat: latlng.lat,
            lng: latlng.lng,
            label: nextMarkerLabel()
        });
        saveState();
        renderAll();
    }

    function removeMarker(id) {
        if (!canEdit()) return;
        state.markers = state.markers.filter((m) => m.id !== id);
        saveState();
        renderAll();
    }

    function toggleCluster() {
        state.clusterEnabled = !state.clusterEnabled;
        saveState();
        renderAll();
        const btn = document.getElementById('mapLabClusterBtn');
        if (btn) {
            btn.textContent = state.clusterEnabled ? 'Кластер: вкл' : 'Кластер: выкл';
            btn.classList.toggle('is-active', state.clusterEnabled);
        }
    }

    function finishLine() {
        if (draftLine.length < 2) {
            flashStatus('Нужно минимум 2 точки для линии');
            return;
        }
        state.polyline = draftLine.map((p) => [p[0], p[1]]);
        draftLine = [];
        saveState();
        setMode('idle');
        renderAll();
    }

    function undoLinePoint() {
        if (!draftLine.length) return;
        draftLine.pop();
        renderDraftLine();
        renderStatus();
    }

    function clearLine() {
        state.polyline = [];
        draftLine = [];
        saveState();
        setMode('idle');
        renderAll();
    }

    function clearMarkers() {
        state.markers = [];
        saveState();
        renderAll();
    }

    function clearAll() {
        if (!window.confirm('Удалить все маркеры и линию?')) return;
        state.markers = [];
        state.polyline = [];
        draftLine = [];
        saveState();
        setMode('idle');
        renderAll();
    }

    function flashStatus(text) {
        const el = document.getElementById('mapLabStatus');
        if (el) el.textContent = text;
    }

    function renderStatus() {
        const el = document.getElementById('mapLabStatus');
        if (!el) return;
        const markerCount = state.markers.length;
        const linePts = state.polyline.length;
        const draft = draftLine.length;
        const cluster = state.clusterEnabled ? 'кластер вкл' : 'кластер выкл';
        let modeLabel = 'только просмотр';
        if (canEdit()) {
            if (mode === 'marker') modeLabel = 'режим: маркеры (тап по карте)';
            else if (mode === 'line') modeLabel = 'режим: линия (тап — точка)';
            else modeLabel = 'редактирование';
        }
        const updated = state.updatedAt
            ? new Date(state.updatedAt).toLocaleString('ru-RU')
            : 'ещё не сохраняли';
        el.textContent = `${modeLabel} · маркеров: ${markerCount} · линия: ${linePts} точек${draft ? ` (+ черновик ${draft})` : ''} · ${cluster} · обновлено: ${updated}`;
    }

    function bindAdminUi() {
        document.getElementById('mapLabMarkerBtn')?.addEventListener('click', () => {
            setMode(mode === 'marker' ? 'idle' : 'marker');
        });
        document.getElementById('mapLabLineBtn')?.addEventListener('click', () => {
            if (mode === 'line') {
                setMode('idle');
                return;
            }
            draftLine = [];
            setMode('line');
            renderDraftLine();
        });
        document.getElementById('mapLabFinishLineBtn')?.addEventListener('click', finishLine);
        document.getElementById('mapLabUndoLineBtn')?.addEventListener('click', undoLinePoint);
        document.getElementById('mapLabClearLineBtn')?.addEventListener('click', clearLine);
        document.getElementById('mapLabClearMarkersBtn')?.addEventListener('click', () => {
            if (window.confirm('Удалить все маркеры?')) clearMarkers();
        });
        document.getElementById('mapLabClearAllBtn')?.addEventListener('click', clearAll);
        document.getElementById('mapLabClusterBtn')?.addEventListener('click', toggleCluster);

        const clusterBtn = document.getElementById('mapLabClusterBtn');
        if (clusterBtn) {
            clusterBtn.textContent = state.clusterEnabled ? 'Кластер: вкл' : 'Кластер: выкл';
            clusterBtn.classList.toggle('is-active', state.clusterEnabled);
        }
    }

    function bindStorageSync() {
        window.addEventListener('storage', (ev) => {
            if (ev.key !== STORAGE_KEY) return;
            state = loadState();
            renderAll();
        });
    }

    function initMap() {
        map = L.map('mapLabMap', {
            scrollWheelZoom: true,
            attributionControl: true
        }).setView(DEFAULT_VIEW, DEFAULT_ZOOM);

        if (window.GuidebookMapTiles?.addBasemapLayer) {
            window.GuidebookMapTiles.addBasemapLayer(map);
        } else {
            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map);
        }

        if (canEdit()) {
            map.on('click', (ev) => {
                if (mode === 'marker') {
                    addMarker(ev.latlng);
                    return;
                }
                if (mode === 'line') {
                    draftLine.push([ev.latlng.lat, ev.latlng.lng]);
                    renderDraftLine();
                    renderStatus();
                }
            });
        }

        renderAll();
        setTimeout(() => map.invalidateSize({ animate: false }), 120);
    }

    async function boot(nextRole) {
        role = nextRole === 'admin' ? 'admin' : 'view';
        if (window.GuidebookMapTiles?.ensureConfig) {
            await window.GuidebookMapTiles.ensureConfig();
        }
        if (canEdit()) bindAdminUi();
        bindStorageSync();
        initMap();
    }

    window.MapLab = { boot };
})();
