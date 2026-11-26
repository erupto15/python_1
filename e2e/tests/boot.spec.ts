import { test, expect, installNetworkStubs, openApp, shot } from './helpers/fixtures';
import { SEED } from './helpers/data';

test.describe('boot', () => {
  test('app boots cleanly: splash hides, bottom nav and catalog render, API is same-origin', async ({ page, diagnostics }, testInfo) => {
    const apiHosts = new Set<string>();
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (url.pathname.startsWith('/api/')) apiHosts.add(url.host);
    });

    await openApp(page);

    expect(await page.evaluate(() => (window as any).app?.constructor?.name)).toBe('ClimbingApp');
    const nav = page.locator('#appBottomNav');
    await expect(nav.locator('[data-app-nav]')).toHaveCount(3);
    for (const tab of ['catalog', 'map', 'profile']) {
      await expect(nav.locator(`[data-app-nav="${tab}"]`)).toBeVisible();
    }
    await expect(nav.locator('[data-app-nav="catalog"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#catalog')).toHaveClass(/\bactive\b/);

    await expect(page.locator('#catalogList [data-catalog-go="area"]').filter({ hasText: SEED.areaAlpha.name })).toBeVisible();
    await shot(page, testInfo, 'boot-catalog');

    expect([...apiHosts], 'API must be called on the page origin, not on 127.0.0.1:8000').toEqual([new URL(page.url()).host]);
    expect(diagnostics.consoleErrors, 'console errors during boot').toEqual([]);
  });

  test.describe('without reduced motion', () => {
    test.use({ reducedMotion: 'no-preference' });

    test('splash screen is shown for a bounded time', async ({ page }, testInfo) => {
      await page.addInitScript(() => {
        document.addEventListener('DOMContentLoaded', () => {
          const el = document.getElementById('tgBootOverlay');
          if (!el) return;
          new MutationObserver(() => {
            if (el.classList.contains('hidden') && !(window as any).__splashHiddenAt) {
              (window as any).__splashHiddenAt = performance.now();
            }
          }).observe(el, { attributes: true, attributeFilter: ['class'] });
        });
      });
      await page.goto('/');
      const ms = await expect
        .poll(() => page.evaluate(() => (window as any).__splashHiddenAt as number | undefined), { timeout: 10_000 })
        .toBeGreaterThan(0)
        .then(() => page.evaluate(() => Math.round((window as any).__splashHiddenAt)));
      testInfo.annotations.push({ type: 'splash-ms (from navigation start)', description: String(ms) });
      // Hard-coded minimum is 2.7 s + 0.42 s fade (index.html hideTelegramBootOverlay); above 6 s means a hang.
      expect(ms).toBeGreaterThan(2_500);
      expect(ms).toBeLessThan(6_000);
    });
  });

  test.describe('on a non-persistent (SQLite) backend', () => {
    test.use({ persistentHealth: false });

    test('shows the temporary-DB warning toast to the user', async ({ page }, testInfo) => {
      await openApp(page);
      const toast = page.locator('.toast.error', { hasText: 'временную БД' });
      await expect(toast).toBeVisible();
      await shot(page, testInfo, 'boot-sqlite-warning-toast');
      await expect(toast).toBeHidden({ timeout: 6_000 });
    });
  });

  test('two browser tabs with the guide both stay usable', async ({ page, context }) => {
    // telegram-web-app.js defines window.Telegram.WebApp in any browser; the single-instance guard
    // must run only inside real Telegram (non-empty initData).
    await openApp(page);
    const tgState = await page.evaluate(() => ({
      hasWebApp: !!(window as any).Telegram?.WebApp,
      launch: (window as any).isTelegramMiniAppLaunch(),
      miniApp: (window as any).isTelegramMiniApp(),
      classes: document.documentElement.className,
    }));
    expect(tgState.launch).toBe(false);
    expect(tgState.miniApp).toBe(false);
    expect(tgState.classes).not.toMatch(/\btg-mini-app\b|\btg-webapp-buttons\b/);
    const second = await context.newPage();
    await installNetworkStubs(second);
    await second.goto('/');
    await expect(second.locator('#tgBootOverlay')).toBeHidden({ timeout: 15_000 });
    // Leader heartbeat is 750 ms; give the single-instance logic time to react.
    await page.waitForTimeout(2_000);
    for (const p of [page, second]) {
      await expect(p.locator('html')).not.toHaveClass(/tg-miniapp-duplicate/);
      await expect(p.locator('body')).toHaveCSS('visibility', 'visible');
    }
    await second.close();
  });

  test('a launch with tgWebAppData is treated as a Telegram Mini App', async ({ page }) => {
    const initData = 'query_id=AAE&user=%7B%22id%22%3A1%7D&auth_date=1700000000&hash=e2e';
    await page.goto(`/#tgWebAppData=${encodeURIComponent(initData)}&tgWebAppVersion=7.0&tgWebAppPlatform=android`);
    await expect(page.locator('#tgBootOverlay')).toBeHidden({ timeout: 15_000 });
    expect(await page.evaluate(() => (window as any).isTelegramMiniAppLaunch())).toBe(true);
    await expect(page.locator('html')).toHaveClass(/\btg-mini-app\b/);
    await expect(page.locator('html')).not.toHaveClass(/tg-miniapp-duplicate/);
    await expect(page.locator('#catalogList [data-catalog-go="area"]').first()).toBeVisible();
  });

  test('reload keeps the app working (no duplicate-instance lockout)', async ({ page }) => {
    await openApp(page);
    await page.reload();
    await expect(page.locator('#tgBootOverlay')).toBeHidden({ timeout: 15_000 });
    await expect(page.locator('#catalogList [data-catalog-go="area"]').first()).toBeVisible();
    await expect(page.locator('html')).not.toHaveClass(/tg-miniapp-duplicate/);
  });
});
