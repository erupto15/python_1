import type { Page } from '@playwright/test';
import { expect } from './fixtures';

export type MapState = {
  scope: { areaId: number; sectorId: number | null } | null;
  keys: string[];
  catalog: { view: string; areaId: number | null; sectorId: number | null };
};

export function mapState(page: Page): Promise<MapState> {
  return page.evaluate(() => {
    const app = (window as any).app;
    return {
      scope: app.mapCatalogScope ? { ...app.mapCatalogScope } : null,
      keys: app.mapMarkerIndex ? [...app.mapMarkerIndex.keys()].sort() : [],
      catalog: { ...app.catalog },
    };
  });
}

/** Leaflet markers are canvas/DOM icons that overlap; firing the marker's click is what a tap does. */
export async function clickMapMarker(page: Page, key: string): Promise<void> {
  await expect.poll(async () => (await mapState(page)).keys).toContain(key);
  await page.evaluate((k) => (window as any).app.mapMarkerIndex.get(k).marker.fire('click'), key);
}

export async function openArea(page: Page, areaId: number): Promise<void> {
  await page.locator(`#catalogList [data-catalog-go="area"][data-id="${areaId}"]`).click();
  await expect.poll(async () => (await mapState(page)).catalog).toMatchObject({ view: 'sectors', areaId });
}

export async function openSectorFromAreaMap(page: Page, sectorId: number): Promise<void> {
  await clickMapMarker(page, `sector:${sectorId}`);
  await expect.poll(async () => (await mapState(page)).catalog).toMatchObject({ view: 'problems', sectorId });
  await expect(page.locator('#mapBoulderSheet')).toBeVisible();
}

export function sheetSection(page: Page, title: string) {
  return page.locator('#mapBoulderSheetList .map-boulder-sheet-section').filter({
    has: page.locator('.map-boulder-sheet-section-title', { hasText: title }),
  });
}
