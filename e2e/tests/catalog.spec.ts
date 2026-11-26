import { test, expect, openApp, shot } from './helpers/fixtures';
import { SEED } from './helpers/data';
import { mapState, openArea, openSectorFromAreaMap, sheetSection } from './helpers/catalog';

test.describe('catalog', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  test('areas list renders a card per area', async ({ page, seed }) => {
    const cards = page.locator('#catalogList .catalog-area-card [data-catalog-go="area"]');
    await expect(cards.first()).toBeVisible();
    for (const [id, name] of [
      [seed.areaAlphaId, SEED.areaAlpha.name],
      [seed.areaBetaId, SEED.areaBeta.name],
    ] as const) {
      const card = page.locator(`#catalogList [data-catalog-go="area"][data-id="${id}"]`);
      await expect(card).toBeVisible();
      await expect(card).toHaveAttribute('aria-label', `Открыть район: ${name}`);
      await expect(card.locator('.catalog-row-title')).toHaveText(name);
    }
    await expect(page.locator('#catalogBreadcrumb')).toContainText('Районы');
    await expect(page.locator('#catalogNavBack')).toBeHidden();
  });

  test('open area -> sectors of that area on the embedded map; back returns to areas', async ({ page, seed }, testInfo) => {
    await openArea(page, seed.areaAlphaId);

    // Sector cards for the area (and only for it) are rendered into the catalog list.
    const sectorCards = page.locator('#catalogList [data-catalog-go="sector"]');
    await expect(sectorCards).toHaveCount(2);
    await expect(page.locator(`#catalogList [data-catalog-go="sector"][data-id="${seed.sectorMixedId}"]`))
      .toHaveAttribute('aria-label', `Открыть сектор: ${SEED.sectorMixed.name}`);
    await expect(page.locator(`#catalogList [data-catalog-go="sector"][data-id="${seed.sectorBetaId}"]`)).toHaveCount(0);

    // On the app shell the area opens as a full-screen map with sector markers.
    await expect(page.locator('#catalogMapBlock')).toBeVisible();
    await expect.poll(async () => (await mapState(page)).keys).toEqual(
      [`area:${seed.areaAlphaId}`, `sector:${seed.sectorBoulderId}`, `sector:${seed.sectorMixedId}`].sort(),
    );
    await shot(page, testInfo, 'catalog-area-map');

    const back = page.locator('#mapDrillBackBtn');
    await expect(back).toBeVisible();
    await expect(back).toHaveAttribute('aria-label', 'Назад к районам');
    await back.click();
    await expect.poll(async () => (await mapState(page)).catalog.view).toBe('areas');
    await expect(page.locator('#catalogMapBlock')).toBeHidden();
    await expect(page.locator(`#catalogList [data-catalog-go="area"][data-id="${seed.areaAlphaId}"]`)).toBeVisible();
  });

  test('sector with routes and boulders shows two separately numbered blocks', async ({ page, seed }, testInfo) => {
    await openArea(page, seed.areaAlphaId);
    await openSectorFromAreaMap(page, seed.sectorMixedId);

    const titles = page.locator('#mapBoulderSheetList .map-boulder-sheet-section-title');
    await expect(titles).toHaveText(['Трудность', 'Боулдеринг']);

    const routes = sheetSection(page, 'Трудность').locator('.map-boulder-sheet-item');
    const boulders = sheetSection(page, 'Боулдеринг').locator('.map-boulder-sheet-item');
    await expect(routes.locator('.map-climb-row-name')).toHaveText([SEED.routeBlue.name, SEED.routeRed.name]);
    await expect(routes.locator('.map-climb-row-num')).toHaveText(['1', '2']);
    await expect(boulders.locator('.map-climb-row-name')).toHaveText([SEED.boulderWind.name]);
    await expect(boulders.locator('.map-climb-row-num')).toHaveText(['1']);

    // The (hidden on app shell) catalog list follows the same rule.
    await expect(page.locator('#catalogList h4')).toHaveText(['Трудность', 'Боулдеринг']);
    await shot(page, testInfo, 'catalog-sector-sheet');
  });

  test('boulder-only sector lists only boulders, without a «Трудность» block', async ({ page, seed }) => {
    await openArea(page, seed.areaAlphaId);
    await openSectorFromAreaMap(page, seed.sectorBoulderId);
    const items = page.locator('#mapBoulderSheetList .map-boulder-sheet-item');
    await expect(items.locator('.map-climb-row-name')).toHaveText([SEED.boulderStone.name]);
    await expect(items.locator('.map-climb-row-num')).toHaveText(['1']);
    // A single discipline is rendered without section titles at all.
    await expect(sheetSection(page, 'Трудность')).toHaveCount(0);
    await expect(page.locator('#catalogList h4')).toHaveText(['Боулдеринг']);
  });

  test('sector sheet header (title, back, close) is visible while the page header stays hidden', async ({ page, seed }, testInfo) => {
    // The map-shell rules that hide the page <header> must not hit <header class="map-boulder-sheet-header">.
    await openArea(page, seed.areaAlphaId);
    await openSectorFromAreaMap(page, seed.sectorMixedId);
    await shot(page, testInfo, 'catalog-sector-sheet-header');
    await expect(page.locator('html')).toHaveClass(/\bcatalog-map-shell\b/);
    await expect(page.locator('.container > header')).toBeHidden();
    await expect(page.locator('#mapBoulderSheetTitle')).toBeVisible();
    await expect(page.locator('#mapBoulderSheetTitle')).toContainText(SEED.sectorMixed.name);
    await expect(page.locator('#mapBoulderSheet [data-map-boulder-sheet-back]').first()).toBeVisible();
    await expect(page.locator('#mapBoulderSheetCloseBtn')).toBeVisible();

    await page.locator('#mapBoulderSheetCloseBtn').click();
    await expect(page.locator('#mapBoulderSheet')).toBeHidden();
    await expect(page.locator('.container > header')).toBeHidden();

    await openSectorFromAreaMap(page, seed.sectorMixedId);
    await page.locator('#mapBoulderSheet [data-map-boulder-sheet-back]').first().click();
    await expect(page.locator('#mapBoulderSheet')).toBeHidden();
  });

  test('back navigation: sector sheet -> area map -> areas list', async ({ page, seed }) => {
    await openArea(page, seed.areaAlphaId);
    await openSectorFromAreaMap(page, seed.sectorMixedId);

    await page.keyboard.press('Escape');
    await expect(page.locator('#mapBoulderSheet')).toBeHidden();
    const back = page.locator('#mapDrillBackBtn');
    await expect(back).toBeVisible();
    await expect(back).toHaveAttribute('aria-label', 'Назад к секторам');
    await back.click();
    await expect.poll(async () => (await mapState(page)).catalog).toMatchObject({ view: 'sectors', areaId: seed.areaAlphaId });
    await expect(back).toHaveAttribute('aria-label', 'Назад к районам');
    await back.click();
    await expect.poll(async () => (await mapState(page)).catalog.view).toBe('areas');
    await expect(page.locator('#appBottomNav')).toBeVisible();
  });

  test('climb detail dialog opens from the sector sheet and closes', async ({ page, seed }, testInfo) => {
    await openArea(page, seed.areaAlphaId);
    await openSectorFromAreaMap(page, seed.sectorMixedId);
    await sheetSection(page, 'Трудность').locator('.map-boulder-sheet-item', { hasText: SEED.routeBlue.name }).click();

    const dialog = page.locator('#climbDetailDialog');
    await expect(dialog).toBeVisible();
    await expect(page.locator('#climbDetailTitle')).toHaveText(SEED.routeBlue.name);
    await expect(dialog).toContainText(SEED.routeBlue.description);
    await shot(page, testInfo, 'catalog-climb-detail');

    await page.locator('#climbDetailBackBtn').click();
    await expect(dialog).toBeHidden();
  });

  test('climb detail opens for a boulder too', async ({ page, seed }) => {
    await openArea(page, seed.areaAlphaId);
    await openSectorFromAreaMap(page, seed.sectorMixedId);
    await sheetSection(page, 'Боулдеринг').locator('.map-boulder-sheet-item', { hasText: SEED.boulderWind.name }).click();
    await expect(page.locator('#climbDetailDialog')).toBeVisible();
    await expect(page.locator('#climbDetailTitle')).toHaveText(SEED.boulderWind.name);
    await page.locator('#climbDetailBackBtn').click();
    await expect(page.locator('#climbDetailDialog')).toBeHidden();
  });
});
