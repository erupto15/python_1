import type { Page } from '@playwright/test';
import { test, expect, openApp, shot } from './helpers/fixtures';
import { ADMIN, registerViaApi, uniqueEmail } from './helpers/api';
import { expectGuest, expectLoggedIn, fillLogin, loginViaUi, openProfile } from './helpers/auth';

async function tapLogo(page: Page, times: number) {
  const logo = page.locator('header .site-logo');
  for (let i = 0; i < times; i += 1) await logo.click();
}

const isAdmin = (page: Page) => page.evaluate(() => (window as any).app.isAdmin());
const addAreaBtn = (page: Page) => page.locator('#catalogToolbar [data-catalog-act="add-area"]');

test.describe('hidden admin access', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await expect(page.locator('header .site-logo')).toBeVisible();
  });

  test('3 quick taps on the logo do nothing, the 4th opens the login dialog', async ({ page }) => {
    await tapLogo(page, 3);
    await expect(page.locator('#authLoginDialog')).toBeHidden();
    await tapLogo(page, 1);
    await expect(page.locator('#authLoginDialog')).toBeVisible();
    await expect(page.locator('#authLoginEmail')).toHaveValue('');
    await expect(page.locator('#authLoginPassword')).toHaveValue('');
  });

  test('admin login by short login enables admin UI; 2 taps on the logo exit', async ({ page }, testInfo) => {
    await expect(addAreaBtn(page)).toHaveCount(0);
    await tapLogo(page, 4);
    await expect(page.locator('#authLoginDialog')).toBeVisible();
    await fillLogin(page, ADMIN.login, ADMIN.password);
    await page.locator('#authLoginSubmitBtn').click();
    await expect(page.locator('#authLoginDialog')).toBeHidden();

    await expect.poll(() => isAdmin(page)).toBe(true);
    await expect(addAreaBtn(page)).toBeVisible();
    await expect(addAreaBtn(page)).toContainText('Добавить район');
    await shot(page, testInfo, 'admin-catalog');

    await tapLogo(page, 2);
    await expect.poll(() => isAdmin(page)).toBe(false);
    await expect(addAreaBtn(page)).toHaveCount(0);
    await openProfile(page);
    await expectGuest(page);
  });

  test('admin profile shows the «Администратор» badge', async ({ page }) => {
    await loginViaUi(page, ADMIN.login, ADMIN.password);
    await expectLoggedIn(page, ADMIN.email);
    await expect(page.locator('#profileRoleBadge')).toBeVisible();
    await expect(page.locator('#profileRoleBadge')).toContainText('Администратор');
  });

  test('regular user is not admin and gets no admin controls', async ({ page }) => {
    const email = uniqueEmail('notadmin');
    await registerViaApi(email, 'Secret123');
    await loginViaUi(page, email, 'Secret123');
    await expectLoggedIn(page, email);
    expect(await isAdmin(page)).toBe(false);
    await expect(page.locator('#profileRoleBadge')).toBeHidden();
    await page.locator('#appBottomNav [data-app-nav="catalog"]').click();
    await expect(addAreaBtn(page)).toHaveCount(0);
  });

  test('slow taps (> 4 s window) do not open the admin login', async ({ page }) => {
    await page.clock.install();
    const logo = page.locator('header .site-logo');
    for (let i = 0; i < 4; i += 1) {
      await logo.click();
      await page.clock.fastForward(4_100);
    }
    await expect(page.locator('#authLoginDialog')).toBeHidden();
  });
});
