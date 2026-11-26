import { test, expect, openApp, shot } from './helpers/fixtures';
import { SEED } from './helpers/data';
import type { Page } from '@playwright/test';

async function openSearchFromMenu(page: Page) {
  await page.locator('#appMenuBtn').click();
  await expect(page.locator('#appMenuPanel')).toBeVisible();
  await expect(page.locator('#appMenuBtn')).toHaveAttribute('aria-expanded', 'true');
  await page.locator('#appMenuPanel [data-app-menu="search"]').click();
  await expect(page.locator('html')).toHaveClass(/\bsearch-screen-open\b/);
  await expect(page.locator('#appMenuPanel')).toBeHidden();
  const input = page.locator('#catalogSearch');
  await expect(input).toBeVisible();
  return input;
}

test.describe('search', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  test('menu -> search: typing a route name shows it and opens the climb card', async ({ page }, testInfo) => {
    const input = await openSearchFromMenu(page);
    await input.fill('Синяя');
    const results = page.locator('#catalogSearchResults');
    await expect(results).toBeVisible();
    const hit = results.locator('.global-search-item', { hasText: SEED.routeBlue.name });
    await expect(hit).toBeVisible();
    await expect(hit.locator('.global-search-kind')).toHaveText('Трасса');
    await expect(hit).toContainText(SEED.areaAlpha.name);
    await shot(page, testInfo, 'search-results');

    await hit.locator('[data-global-open]').click();
    await expect(page.locator('#climbDetailDialog')).toBeVisible();
    await expect(page.locator('#climbDetailTitle')).toHaveText(SEED.routeBlue.name);
    await page.locator('#climbDetailBackBtn').click();
    await expect(page.locator('#climbDetailDialog')).toBeHidden();
  });

  test('search finds boulders, sectors and areas', async ({ page }) => {
    const input = await openSearchFromMenu(page);
    const hit = (title: string) => page.locator('#catalogSearchResults .global-search-item')
      .filter({ has: page.locator('strong').getByText(title, { exact: true }) });
    await input.fill('Ветра');
    await expect(hit(SEED.boulderWind.name).locator('.global-search-kind')).toHaveText('Боулдер');
    await input.fill('Камни');
    await expect(hit(SEED.sectorBoulder.name).locator('.global-search-kind')).toHaveText('Сектор');
    await input.fill('Бета');
    await expect(hit(SEED.areaBeta.name).locator('.global-search-kind')).toHaveText('Район');
  });

  test('unknown query shows the empty-state hint; one letter shows nothing', async ({ page }) => {
    const input = await openSearchFromMenu(page);
    await input.fill('ж');
    await expect(page.locator('#catalogSearchResults')).toBeHidden();
    await input.fill('zzzнетакойтрассы');
    await expect(page.locator('#catalogSearchResults .global-search-empty')).toContainText('Ничего не найдено');
  });

  test('closing the search screen restores the catalog', async ({ page, seed }) => {
    const input = await openSearchFromMenu(page);
    await input.fill('Синяя');
    await page.locator('#catalogSearchClearBtn').click();
    await expect(input).toHaveValue('');
    // Second press of × (empty input) closes the search screen.
    if (await page.locator('html').evaluate((el) => el.classList.contains('search-screen-open'))) {
      await page.locator('#catalogSearchClearBtn').click();
    }
    await expect(page.locator('html')).not.toHaveClass(/\bsearch-screen-open\b/);
    await expect(page.locator(`#catalogList [data-catalog-go="area"][data-id="${seed.areaAlphaId}"]`)).toBeVisible();
  });

  test('menu -> search puts the caret into the search field', async ({ page }) => {
    await openSearchFromMenu(page);
    await expect(page.locator('html')).toHaveClass(/\bsearch-screen-open\b/);
    await expect(page.locator('#catalogSearch')).toBeVisible();
    await expect(page.locator('#catalogSearch')).toBeFocused({ timeout: 2_000 });
    await page.keyboard.type('E2E');
    await expect(page.locator('#catalogSearch')).toHaveValue('E2E');
  });
});

test.describe('theme', () => {
  test('menu -> theme toggles light/dark and persists across reload', async ({ page }, testInfo) => {
    await openApp(page);
    const html = page.locator('html');
    await expect(html).toHaveClass(/\btheme-dark\b/);
    await expect(page.locator('#appMenuThemeLabel')).toHaveText('Светлая тема');

    await page.locator('#appMenuBtn').click();
    await page.locator('#appMenuPanel [data-app-menu="theme"]').click();
    await expect(html).toHaveClass(/\btheme-light\b/);
    await expect(html).not.toHaveClass(/\btheme-dark\b/);
    expect(await page.evaluate(() => localStorage.getItem('6a9a-theme'))).toBe('light');
    await shot(page, testInfo, 'theme-light-catalog');

    await page.reload();
    await expect(page.locator('#tgBootOverlay')).toBeHidden({ timeout: 15_000 });
    await expect(html).toHaveClass(/\btheme-light\b/);

    await page.locator('#appMenuBtn').click();
    await expect(page.locator('#appMenuThemeLabel')).toHaveText('Тёмная тема');
    await page.locator('#appMenuPanel [data-app-menu="theme"]').click();
    await expect(html).toHaveClass(/\btheme-dark\b/);
    await expect(html).not.toHaveClass(/\btheme-light\b/);
  });

  test('menu closes on outside click', async ({ page }) => {
    await openApp(page);
    await page.locator('#appMenuBtn').click();
    await expect(page.locator('#appMenuPanel')).toBeVisible();
    // The panel overlaps the catalog header; click the empty gutter left of the cards.
    const box = await page.locator('#catalogList').boundingBox();
    await page.mouse.click(Math.max(1, (box?.x ?? 8) - 4), (box?.y ?? 300) + 40);
    await expect(page.locator('#appMenuPanel')).toBeHidden();
    await expect(page.locator('#appMenuBtn')).toHaveAttribute('aria-expanded', 'false');
  });
});
