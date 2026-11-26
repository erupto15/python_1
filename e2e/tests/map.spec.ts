import { test, expect, openApp, navTo, shot } from './helpers/fixtures';
import { clickMapMarker, mapState } from './helpers/catalog';
import { SEED } from './helpers/data';

test.describe('map tab', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await navTo(page, 'map');
    await expect.poll(async () => (await mapState(page)).keys.length, { timeout: 15_000 }).toBeGreaterThan(0);
  });

  test('overview shows only area markers', async ({ page, seed }, testInfo) => {
    const state = await mapState(page);
    expect(state.scope).toBeNull();
    expect(state.keys.every((k) => k.startsWith('area:')), `non-area markers: ${state.keys}`).toBe(true);
    expect(state.keys).toEqual(expect.arrayContaining([`area:${seed.areaAlphaId}`, `area:${seed.areaBetaId}`]));
    expect(await page.evaluate(() => (window as any).L?.version)).toBe('1.9.4');
    await expect(page.locator('#mapContainer')).toBeVisible();
    await expect(page.locator('html')).toHaveClass(/\bapp-shell-map-tab\b/);
    await expect(page.locator('.container > header')).toBeHidden();
    await expect(page.locator('#mapContainer .leaflet-marker-pane *:visible').first()).toBeVisible();
    await shot(page, testInfo, 'map-overview');
  });

  test('clicking an area marker drills into its sectors and climbs; back returns to overview', async ({ page, seed }, testInfo) => {
    await clickMapMarker(page, `area:${seed.areaAlphaId}`);
    await expect.poll(async () => (await mapState(page)).scope).toEqual({ areaId: seed.areaAlphaId, sectorId: null });

    const keys = (await mapState(page)).keys;
    expect(keys).toEqual(expect.arrayContaining([
      `sector:${seed.sectorMixedId}`,
      `sector:${seed.sectorBoulderId}`,
      `route:${seed.routeBlueId}`,
      `boulder:${seed.boulderWindId}`,
    ]));
    expect(keys, 'other areas must not be drawn while drilled in').not.toContain(`area:${seed.areaBetaId}`);
    expect(keys).not.toContain(`sector:${seed.sectorBetaId}`);
    await shot(page, testInfo, 'map-area-drill');

    const back = page.locator('#map > .map-overlay-back');
    await expect(back).toBeVisible();
    await back.click();
    await expect.poll(async () => (await mapState(page)).scope).toBeNull();
    const after = await mapState(page);
    expect(after.keys.every((k) => k.startsWith('area:'))).toBe(true);
    await expect(page.locator('#map')).toHaveClass(/\bactive\b/);
  });

  test('switching tabs away and back resets the map to the overview', async ({ page, seed }) => {
    await clickMapMarker(page, `area:${seed.areaAlphaId}`);
    await expect.poll(async () => (await mapState(page)).scope).not.toBeNull();

    await navTo(page, 'profile');
    await navTo(page, 'map');
    await expect.poll(async () => (await mapState(page)).scope).toBeNull();
    await expect.poll(async () => (await mapState(page)).keys.every((k) => k.startsWith('area:'))).toBe(true);
  });

  test('an area without coordinates is not drawn at (0, 0)', async ({ page, seed }, testInfo) => {
    // The demo seed area «Общий район» has latitude/longitude = null and no located sectors/climbs.
    test.skip(seed.demoAreaId == null, 'demo seed area is absent');
    await shot(page, testInfo, 'map-null-island');
    const pos = await page.evaluate((key) => {
      const entry = (window as any).app.mapMarkerIndex.get(key);
      return entry ? entry.marker.getLatLng() : null;
    }, `area:${seed.demoAreaId}`);
    expect(pos, `marker for an area without coordinates: ${JSON.stringify(pos)}`).toBeNull();
    const latLngs = await page.evaluate(() => [...(window as any).app.mapMarkerIndex.values()]
      .map((e: any) => e.marker.getLatLng()));
    for (const ll of latLngs) expect(Math.abs(ll.lat) + Math.abs(ll.lng)).toBeGreaterThan(1);
    // Overview fit spans only the real (Crimea) areas, not the Gulf of Guinea.
    await expect.poll(() => page.evaluate(() => (window as any).app.map.getZoom())).toBeGreaterThanOrEqual(6);
    expect(await page.evaluate(() => (window as any).app.validMapCoord(0, 0))).toBeNull();
    expect(await page.evaluate(() => (window as any).app.validMapCoord(null, null))).toBeNull();
    expect(await page.evaluate(() => (window as any).app.validMapCoord(44.6, 34.1))).toEqual({ lat: 44.6, lng: 34.1 });
  });

  test('an area without its own coordinates falls back to the centroid of its sectors', async ({ page, seed }) => {
    // Hide the area's own coordinates by making validMapCoord reject exactly that pair.
    const c = await page.evaluate(({ id, lat, lng }) => {
      const app = (window as any).app;
      const original = app.validMapCoord;
      app.validMapCoord = function (la: unknown, ln: unknown) {
        if (Number(la) === lat && Number(ln) === lng) return null;
        return original.call(this, la, ln);
      };
      try {
        return { coord: app.areaMapCoordinate(id) };
      } finally {
        app.validMapCoord = original;
      }
    }, { id: seed.areaAlphaId, lat: SEED.areaAlpha.latitude, lng: SEED.areaAlpha.longitude });
    expect(c.coord).not.toBeNull();
    expect(c.coord.lat).toBeCloseTo((SEED.sectorMixed.latitude + SEED.sectorBoulder.latitude) / 2, 4);
    expect(c.coord.lng).toBeCloseTo((SEED.sectorMixed.longitude + SEED.sectorBoulder.longitude) / 2, 4);
  });

  test('back button on the overview returns to the catalog tab', async ({ page }) => {
    await page.locator('#map > .map-overlay-back').click();
    await expect(page.locator('#catalog')).toHaveClass(/\bactive\b/);
    await expect(page.locator('#appBottomNav [data-app-nav="catalog"]')).toHaveAttribute('aria-current', 'page');
  });

  test('map filter "sectors" hides climb markers inside an area', async ({ page, seed }) => {
    // The filter toolbar is hidden on the app shell, so drive the same handler the buttons use.
    await clickMapMarker(page, `area:${seed.areaAlphaId}`);
    await expect.poll(async () => (await mapState(page)).keys).toContain(`route:${seed.routeBlueId}`);
    await page.evaluate(() => (window as any).app.setMapFilter('sectors'));
    await expect.poll(async () => (await mapState(page)).keys).not.toContain(`route:${seed.routeBlueId}`);
    expect((await mapState(page)).keys).toContain(`sector:${seed.sectorMixedId}`);
    await page.evaluate(() => (window as any).app.setMapFilter('all'));
    await expect.poll(async () => (await mapState(page)).keys).toContain(`route:${seed.routeBlueId}`);
  });
});
