/**
 * Редактор разметки в духе ClimbestAI route-editor-demo.
 * Координаты — нормализованные 0–1 по видимой области фото (coordSpace: image).
 */
(function (global) {
    'use strict';

    const SVG_NS = 'http://www.w3.org/2000/svg';
    const COLORS = {
        startFinish: '#FFD43B',
        hold: '#FF514B',
        feetOnly: '#FFD43B',
        mask: '#424242',
        line: '#FF514B'
    };
    const MIN_RADIUS_NORM = 0.012;
    const MIN_LINE_NORM = 0.008;
    const SNAP_PX = 18;

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function uid(prefix) {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    }

    function clamp01(v) {
        return Math.max(0, Math.min(1, v));
    }

    class MarkupEditor {
        constructor(options) {
            this.container = options.container;
            this.mode = options.mode === 'boulder' ? 'boulder' : 'route';
            this.viewOnly = !!options.viewOnly;
            this.clientToNorm = options.clientToNorm;
            this.getGeometry = options.getGeometry;
            this.onChange = typeof options.onChange === 'function' ? options.onChange : () => {};

            this.tool = 'move';
            this.objects = [];
            this.history = [];
            this.draft = null;
            this.pointers = new Map();

            this.svg = null;
            this.objectsLayer = null;
            this.previewLayer = null;
            this.toolbar = options.toolbarEl || null;
            this.toastEl = options.toastEl || null;
            this._toastTimer = null;
            this._abort = null;

            this._ensureSvg();
            if (!this.viewOnly) {
                this._bindToolbar();
                this._bindPointers();
            }
            this._render();
        }

        destroy() {
            this._abort?.abort();
            this._abort = null;
            this.pointers.clear();
            this.draft = null;
            if (this.svg?.parentNode) {
                this.svg.parentNode.removeChild(this.svg);
            }
            this.svg = null;
            this.container?.classList.remove('markup-draw-active', 'markup-editor-move');
        }

        chooseTool(tool) {
            if (this.viewOnly) return;
            this.tool = tool;
            this.toolbar?.querySelectorAll('[data-markup-tool]').forEach((btn) => {
                btn.classList.toggle('active', btn.dataset.markupTool === tool);
            });
            this._cancelDraft();
            this.container?.classList.toggle('markup-draw-active', tool !== 'move');
            this.container?.classList.toggle('markup-editor-move', tool === 'move');
        }

        undo() {
            if (!this.history.length) return;
            this.objects = this.history.pop();
            this._updateUndo();
            this._render();
            this.onChange();
        }

        clearAll() {
            if (this.objects.length) this._pushHistory();
            this.objects = [];
            this._updateUndo();
            this._render();
            this.onChange();
        }

        _pushHistory() {
            this.history.push(clone(this.objects));
            if (this.history.length > 40) this.history.shift();
            this._updateUndo();
        }

        _updateUndo() {
            const btn = this.toolbar?.querySelector('[data-markup-action="undo"]');
            if (btn) btn.disabled = this.history.length === 0;
        }

        _toast(message) {
            if (!this.toastEl) return;
            this.toastEl.textContent = message;
            this.toastEl.classList.add('show');
            clearTimeout(this._toastTimer);
            this._toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), 2200);
        }

        _svgHost() {
            return this.container?.querySelector('.photo-wrap .stage') || this.container;
        }

        _ensureSvg() {
            const host = this._svgHost();
            let svg = host.querySelector('.markup-editor-svg');
            if (!svg) {
                svg = document.createElementNS(SVG_NS, 'svg');
                svg.setAttribute('class', 'markup-editor-svg boulder-markup-line-svg');
                svg.setAttribute('aria-hidden', 'true');
                host.appendChild(svg);
            }
            this.svg = svg;
            while (svg.firstChild) svg.removeChild(svg.firstChild);
            this.objectsLayer = document.createElementNS(SVG_NS, 'g');
            this.objectsLayer.setAttribute('class', 'markup-editor-objects');
            this.previewLayer = document.createElementNS(SVG_NS, 'g');
            this.previewLayer.setAttribute('class', 'markup-editor-preview');
            svg.appendChild(this.objectsLayer);
            svg.appendChild(this.previewLayer);
        }

        _layoutSvg() {
            if (!this.svg || !this.container || typeof this.getGeometry !== 'function') return;
            const geom = this.getGeometry();
            if (!geom || !geom.iw) return;

            this.svg.style.position = 'absolute';
            this.svg.style.inset = 'auto';
            this.svg.style.pointerEvents = 'none';
            const stage = this.container.querySelector('.photo-wrap .stage');
            if (stage) {
                const ox = Number.isFinite(geom.stageOffsetX) ? geom.stageOffsetX : geom.left;
                const oy = Number.isFinite(geom.stageOffsetY) ? geom.stageOffsetY : geom.top;
                this.svg.style.left = `${ox}px`;
                this.svg.style.top = `${oy}px`;
            } else {
                this.svg.style.left = `${geom.left}px`;
                this.svg.style.top = `${geom.top}px`;
            }
            this.svg.style.width = `${geom.iw}px`;
            this.svg.style.height = `${geom.ih}px`;
            this.svg.setAttribute('viewBox', '0 0 1 1');
            this.svg.setAttribute('preserveAspectRatio', 'none');
        }

        _normFromEvent(event) {
            return this.clientToNorm(event.clientX, event.clientY);
        }

        _screenFromNorm(point) {
            const geom = this.getGeometry();
            const rect = this.container.getBoundingClientRect();
            return {
                x: rect.left + geom.left + point.x * geom.iw,
                y: rect.top + geom.top + point.y * geom.ih
            };
        }

        _distScreen(a, b) {
            return Math.hypot(a.x - b.x, a.y - b.y);
        }

        _endpoints(object) {
            if (object.type !== 'polyline' || object.closed || !object.points?.length) return [];
            const first = object.points[0];
            const last = object.points[object.points.length - 1];
            return [
                { object, index: 0, point: { x: first[0], y: first[1] } },
                { object, index: object.points.length - 1, point: { x: last[0], y: last[1] } }
            ];
        }

        _nearestEndpoint(screenPoint, excludedIds) {
            let best = null;
            for (const object of this.objects) {
                for (const candidate of this._endpoints(object)) {
                    if (excludedIds && excludedIds.has(candidate.object.id)) continue;
                    const sc = this._screenFromNorm(candidate.point);
                    const distance = this._distScreen(sc, screenPoint);
                    if (distance <= SNAP_PX && (!best || distance < best.distance)) {
                        best = { ...candidate, distance };
                    }
                }
            }
            return best;
        }

        _finishLine(start, end) {
            const startScreen = this._screenFromNorm(start);
            const endScreen = this._screenFromNorm(end);
            const startSnap = this._nearestEndpoint(startScreen);
            const excluded = startSnap ? new Set([startSnap.object.id]) : null;
            const endSnap = this._nearestEndpoint(endScreen, excluded);

            if (startSnap && endSnap && startSnap.object === endSnap.object) {
                const object = startSnap.object;
                if (object.points.length >= 3) {
                    this._pushHistory();
                    object.closed = true;
                    this._render();
                    this.onChange();
                    return;
                }
            }

            if (startSnap && endSnap && startSnap.object !== endSnap.object) {
                this._pushHistory();
                const first = startSnap.object;
                const second = endSnap.object;
                const firstPoints = startSnap.index === 0 ? [...first.points].reverse() : [...first.points];
                const secondPoints = endSnap.index === 0 ? [...second.points] : [...second.points].reverse();
                first.points = [...firstPoints, ...secondPoints];
                this.objects = this.objects.filter((item) => item !== second);
                this._render();
                this.onChange();
                return;
            }

            if (startSnap) {
                this._pushHistory();
                const object = startSnap.object;
                if (startSnap.index === 0) object.points.unshift([end.x, end.y]);
                else object.points.push([end.x, end.y]);
                this._render();
                this.onChange();
                return;
            }

            if (endSnap) {
                this._pushHistory();
                const object = endSnap.object;
                if (endSnap.index === 0) object.points.unshift([start.x, start.y]);
                else object.points.push([start.x, start.y]);
                this._render();
                this.onChange();
                return;
            }

            this._pushHistory();
            this.objects.push({
                id: uid('line'),
                type: 'polyline',
                points: [[start.x, start.y], [end.x, end.y]],
                closed: false
            });
            this._render();
            this.onChange();
        }

        _beginDraw(norm) {
            if (this.tool === 'line') {
                this.draft = { kind: 'line', start: { x: norm.x, y: norm.y }, current: { x: norm.x, y: norm.y } };
            } else if (this.tool !== 'move') {
                this.draft = {
                    kind: 'circle',
                    tool: this.tool,
                    start: { x: norm.x, y: norm.y },
                    radius: 0
                };
            }
        }

        _updateDraw(norm) {
            if (!this.draft) return;
            if (this.draft.kind === 'line') {
                this.draft.current = { x: norm.x, y: norm.y };
            } else {
                this.draft.radius = Math.hypot(norm.x - this.draft.start.x, norm.y - this.draft.start.y);
            }
            this._render();
        }

        _endDraw() {
            if (!this.draft) return;
            const draft = this.draft;
            this.draft = null;
            if (draft.kind === 'circle') {
                if (draft.radius >= MIN_RADIUS_NORM) {
                    this._pushHistory();
                    this.objects.push({
                        id: uid('circle'),
                        type: 'circle',
                        kind: draft.tool,
                        cx: draft.start.x,
                        cy: draft.start.y,
                        r: draft.radius
                    });
                    this.onChange();
                }
            } else if (Math.hypot(draft.current.x - draft.start.x, draft.current.y - draft.start.y) >= MIN_LINE_NORM) {
                this._finishLine(draft.start, draft.current);
            }
            this._render();
        }

        _cancelDraft() {
            this.draft = null;
            this._render();
        }

        _bindToolbar() {
            if (!this.toolbar) return;
            this.toolbar.addEventListener('click', (e) => {
                const toolBtn = e.target.closest('[data-markup-tool]');
                if (toolBtn) {
                    this.chooseTool(toolBtn.dataset.markupTool);
                    return;
                }
                const action = e.target.closest('[data-markup-action]')?.dataset.markupAction;
                if (action === 'undo') this.undo();
            });
            this.chooseTool('move');
        }

        _bindPointers() {
            this._abort = new AbortController();
            const { signal } = this._abort;
            const el = this.container;
            const wrap = el.querySelector('.photo-wrap');

            const refreshSoon = () => requestAnimationFrame(() => this.refreshLayout());
            if (wrap) {
                wrap.addEventListener('pointerup', refreshSoon, { signal });
                wrap.addEventListener('wheel', refreshSoon, { signal, passive: true });
                wrap.addEventListener('touchstart', refreshSoon, { signal, passive: true });
            }
            window.addEventListener('resize', refreshSoon, { signal });

            el.addEventListener('pointerdown', (e) => {
                if (this.viewOnly) return;
                if (e.target.closest('.markup-editor-toolbar')) return;
                if (this.tool === 'move') return;
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
                try {
                    el.setPointerCapture(e.pointerId);
                } catch (_) {
                    /* ignore */
                }
                if (this.pointers.size > 1) {
                    this._cancelDraft();
                    return;
                }
                const norm = this._normFromEvent(e);
                this._beginDraw(norm);
            }, { signal });

            el.addEventListener('pointermove', (e) => {
                if (!this.pointers.has(e.pointerId)) return;
                if (this.tool === 'move') return;
                this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
                if (this.pointers.size > 1) return;
                const norm = this._normFromEvent(e);
                this._updateDraw(norm);
            }, { signal });

            const end = (e) => {
                if (!this.pointers.has(e.pointerId)) return;
                this.pointers.delete(e.pointerId);
                try {
                    el.releasePointerCapture(e.pointerId);
                } catch (_) {
                    /* ignore */
                }
                if (this.pointers.size === 0 && this.tool !== 'move') this._endDraw();
            };
            el.addEventListener('pointerup', end, { signal });
            el.addEventListener('pointercancel', () => {
                this.pointers.clear();
                this._cancelDraft();
            }, { signal });
        }

        _svgEl(tag, attrs) {
            const node = document.createElementNS(SVG_NS, tag);
            Object.entries(attrs || {}).forEach(([k, v]) => node.setAttribute(k, String(v)));
            return node;
        }

        _renderObject(object) {
            const sw = '0.014';
            if (object.type === 'circle') {
                const kind = object.kind || 'hold';
                const stroke = COLORS[kind] || COLORS.hold;
                const node = this._svgEl('circle', {
                    cx: object.cx,
                    cy: object.cy,
                    r: object.r,
                    fill: kind === 'mask' ? COLORS.mask : 'none',
                    stroke: kind === 'mask' ? 'none' : stroke,
                    'stroke-width': kind === 'mask' ? 0 : sw,
                    'vector-effect': 'non-scaling-stroke'
                });
                if (kind === 'feetOnly') node.setAttribute('stroke-dasharray', '0.04 0.025');
                return node;
            }
            const pairs = (object.points || []).map((p) => `${p[0]},${p[1]}`).join(' ');
            return this._svgEl('polyline', {
                points: pairs,
                fill: 'none',
                stroke: COLORS.line,
                'stroke-width': sw,
                'stroke-linejoin': 'round',
                'stroke-linecap': 'round',
                'vector-effect': 'non-scaling-stroke'
            });
        }

        _render() {
            this._ensureSvg();
            this._layoutSvg();
            if (!this.objectsLayer || !this.previewLayer) return;
            this.objectsLayer.replaceChildren(...this.objects.map((o) => this._renderObject(o)));
            this.previewLayer.replaceChildren();
            if (this.draft) {
                if (this.draft.kind === 'circle') {
                    this.previewLayer.appendChild(this._renderObject({
                        type: 'circle',
                        kind: this.draft.tool,
                        cx: this.draft.start.x,
                        cy: this.draft.start.y,
                        r: this.draft.radius
                    }));
                } else {
                    this.previewLayer.appendChild(this._renderObject({
                        type: 'polyline',
                        points: [
                            [this.draft.start.x, this.draft.start.y],
                            [this.draft.current.x, this.draft.current.y]
                        ],
                        closed: false
                    }));
                }
            }
        }

        refreshLayout() {
            this._render();
        }

        loadRoutePoints(points) {
            const pts = (points || [])
                .map((p) => [clamp01(Number(p.x)), clamp01(Number(p.y))])
                .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
            this.objects = pts.length >= 2
                ? [{ id: uid('line'), type: 'polyline', points: pts, closed: false }]
                : [];
            this.history = [];
            this._updateUndo();
            this._render();
        }

        loadBoulderMarkup(markup) {
            this.objects = [];
            const m = markup || {};
            const addCircle = (pt, kind, r) => {
                if (!pt) return;
                this.objects.push({
                    id: uid('circle'),
                    type: 'circle',
                    kind,
                    cx: clamp01(Number(pt.x)),
                    cy: clamp01(Number(pt.y)),
                    r: r || 0.035
                });
            };
            addCircle(m.startHold, 'startFinish', 0.04);
            addCircle(m.finishHold, 'hold', 0.035);
            const lp = (m.linePoints || []).map((p) => [clamp01(Number(p.x)), clamp01(Number(p.y))]);
            if (lp.length >= 2) {
                this.objects.push({ id: uid('line'), type: 'polyline', points: lp, closed: false });
            }
            this.history = [];
            this._updateUndo();
            this._render();
        }

        exportRoutePoints() {
            const points = [];
            for (const obj of this.objects) {
                if (obj.type !== 'polyline') continue;
                for (const pt of obj.points) {
                    const p = { x: clamp01(pt[0]), y: clamp01(pt[1]) };
                    const last = points[points.length - 1];
                    if (last && Math.hypot(last.x - p.x, last.y - p.y) < 0.003) continue;
                    points.push(p);
                }
            }
            return points;
        }

        exportBoulderMarkup() {
            let startHold = null;
            let finishHold = null;
            const linePoints = [];
            for (const obj of this.objects) {
                if (obj.type === 'circle') {
                    const center = { x: clamp01(obj.cx), y: clamp01(obj.cy) };
                    if (obj.kind === 'startFinish' && !startHold) startHold = center;
                    else if (obj.kind === 'hold' && !finishHold) finishHold = center;
                    else if (obj.kind === 'startFinish' && !finishHold) finishHold = center;
                } else if (obj.type === 'polyline') {
                    for (const pt of obj.points) {
                        linePoints.push({ x: clamp01(pt[0]), y: clamp01(pt[1]) });
                    }
                }
            }
            return { startHold, finishHold, linePoints };
        }
    }

    global.MarkupEditor = MarkupEditor;
})(typeof window !== 'undefined' ? window : globalThis);
