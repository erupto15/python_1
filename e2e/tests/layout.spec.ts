import type { Page, TestInfo } from '@playwright/test';
import { test, expect, navTo, openApp, shot } from './helpers/fixtures';
import { openArea, openSectorFromAreaMap, mapState } from './helpers/catalog';
import { registerViaApi, uniqueEmail } from './helpers/api';
import { readSeedState } from './helpers/data';
import { expectLoggedIn, loginViaUi, openLoginDialog, openRegisterDialog } from './helpers/auth';
import { auditAccessibleNames, horizontalOverflow, rectOf, within } from './helpers/layout';

type Screen = { name: string; open: (page: Page) => Promise<void> };

const SCREENS: Screen[] = [
  { name: 'catalog', open: async () => {} },
  { name: 'catalog-area', open: (page) => openArea(page, readSeedState().areaAlphaId) },
  {
    name: 'catalog-sector-sheet',
    open: async (page) => {
      const seed = readSeedState();
      await openArea(page, seed.areaAlphaId);
      await openSectorFromAreaMap(page, seed.sectorMixedId);
    },
  },
  {
    name: 'map',
    open: async (page) => {
      await navTo(page, 'map');
      await expect.poll(async () => (await mapState(page)).keys.length).toBeGreaterThan(0);
    },
  },
  { name: 'profile', open: (page) => navTo(page, 'profile') },
  { name: 'login-dialog', open: openLoginDialog },
  {
    name: 'register-dialog-with-error',
    open: async (page) => {
      await openRegisterDialog(page);
      await page.locator('#authRegisterName').fill('Очень Длинное Имя Пользователя Для Проверки Переноса');
      await page.locator('#authRegisterEmail').fill('very.long.email.address.for.layout.check@example-domain.com');
      await page.locator('#authRegisterSubmitBtn').click();
      await expect(page.locator('#authRegisterError')).toBeVisible();
    },
  },
  {
    name: 'reset-dialog',
    open: async (page) => {
      await openLoginDialog(page);
      await page.locator('#authLoginForgotBtn').click();
      await expect(page.locator('#authResetDialog')).toBeVisible();
    },
  },
  {
    name: 'search-screen',
    open: async (page) => {
      await page.locator('#appMenuBtn').click();
      await page.locator('#appMenuPanel [data-app-menu="search"]').click();
      await page.locator('#catalogSearch').fill('E2E');
      await expect(page.locator('#catalogSearchResults .global-search-item').first()).toBeVisible();
    },
  },
];

async function overflowCheck(page: Page, testInfo: TestInfo, name: string) {
  const o = await horizontalOverflow(page);
  await shot(page, testInfo, `layout-${testInfo.project.name}-${name}`);
  expect(o.scrollWidth, `horizontal overflow on «${name}»: ${o.offenders.join(', ')}`).toBeLessThanOrEqual(o.innerWidth);
}

test.describe('layout: mobile (390x844)', { tag: '@mobile-only' }, () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  for (const screen of SCREENS) {
    test(`no horizontal overflow: ${screen.name}`, async ({ page }, testInfo) => {
      await screen.open(page);
      await overflowCheck(page, testInfo, screen.name);
    });
  }

  test('no horizontal overflow: profile of a user with a long e-mail + change-password dialog', async ({ page }, testInfo) => {
    const email = uniqueEmail('a-really-long-local-part-for-the-profile-layout');
    await registerViaApi(email, 'Secret123', 'Александра Константинопольская-Длиннофамильная');
    await loginViaUi(page, email, 'Secret123');
    await expectLoggedIn(page, email);
    await overflowCheck(page, testInfo, 'profile-long-email');
    await page.locator('#profileChangePasswordBtn').click();
    await expect(page.locator('#authNewPasswordDialog')).toBeVisible();
    await overflowCheck(page, testInfo, 'change-password-dialog');
  });

  test('bottom nav is pinned to the bottom and has touch-friendly buttons', async ({ page }) => {
    const nav = await rectOf(page.locator('#appBottomNav'));
    const vh = await page.evaluate(() => window.innerHeight);
    expect(Math.abs(nav.bottom - vh)).toBeLessThanOrEqual(2);
    for (const btn of await page.locator('#appBottomNav [data-app-nav]').all()) {
      const r = await rectOf(btn);
      expect(r.height, 'nav button height').toBeGreaterThanOrEqual(44);
      expect(r.width, 'nav button width').toBeGreaterThanOrEqual(44);
    }
  });

  test('auth dialog fields are not hidden behind the bottom nav', async ({ page }) => {
    await openRegisterDialog(page);
    const submit = await rectOf(page.locator('#authRegisterSubmitBtn'));
    const vh = await page.evaluate(() => window.innerHeight);
    expect(submit.bottom).toBeLessThanOrEqual(vh);
    // The submit button must be the topmost element at its centre (not covered by nav/toast).
    const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('button')?.id, {
      x: submit.left + submit.width / 2,
      y: submit.top + submit.height / 2,
    });
    expect(hit).toBe('authRegisterSubmitBtn');
  });
});

test.describe('layout: desktop (1440x900)', { tag: '@desktop-only' }, () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  async function column(page: Page) {
    const body = await rectOf(page.locator('body'));
    const vw = await page.evaluate(() => window.innerWidth);
    return { body, vw };
  }

  test('body is a centered column of at most 480px', async ({ page }, testInfo) => {
    const { body, vw } = await column(page);
    expect(body.width).toBeLessThanOrEqual(481);
    expect(Math.abs(body.left - (vw - body.right))).toBeLessThanOrEqual(2);
    await shot(page, testInfo, 'layout-desktop-catalog');
  });

  test('bottom nav and map stay inside the column', async ({ page }, testInfo) => {
    const { body } = await column(page);
    expect(within(await rectOf(page.locator('#appBottomNav')), body), 'bottom nav').toBe(true);
    await navTo(page, 'map');
    await expect.poll(async () => (await mapState(page)).keys.length).toBeGreaterThan(0);
    const map = await rectOf(page.locator('#mapContainer'));
    expect(map.width).toBeGreaterThan(200);
    expect(within(map, body), `map ${JSON.stringify(map)} vs column ${JSON.stringify(body)}`).toBe(true);
    await shot(page, testInfo, 'layout-desktop-map');
  });

  test('catalog area map and sector sheet stay inside the column', async ({ page, seed }, testInfo) => {
    const { body } = await column(page);
    await openArea(page, seed.areaAlphaId);
    expect(within(await rectOf(page.locator('#catalogMapBlock')), body), 'catalog map').toBe(true);
    await openSectorFromAreaMap(page, seed.sectorMixedId);
    expect(within(await rectOf(page.locator('#mapBoulderSheet .map-boulder-sheet-panel')), body), 'sector sheet').toBe(true);
    await shot(page, testInfo, 'layout-desktop-sector-sheet');
  });

  for (const [name, open] of [
    ['login', openLoginDialog],
    ['register', openRegisterDialog],
  ] as const) {
    test(`${name} dialog stays inside the column`, async ({ page }, testInfo) => {
      const { body } = await column(page);
      await open(page);
      const overlay = page.locator('.dialog-overlay:not(.hidden)').last();
      const content = await rectOf(overlay.locator('.dialog-content'));
      expect(within(content, body), `dialog content ${JSON.stringify(content)} vs ${JSON.stringify(body)}`).toBe(true);
      expect(within(await rectOf(overlay), body), 'dialog overlay').toBe(true);
      await shot(page, testInfo, `layout-desktop-${name}-dialog`);
    });
  }

  test('climb detail dialog stays inside the column', async ({ page, seed }) => {
    const { body } = await column(page);
    await page.evaluate((id) => (window as any).app.showClimbDetailDialog('route', id), seed.routeBlueId);
    await expect(page.locator('#climbDetailDialog')).toBeVisible();
    expect(within(await rectOf(page.locator('#climbDetailDialog')), body)).toBe(true);
  });
});

test.describe('accessibility smoke', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  test('bottom nav buttons have accessible names', async ({ page }) => {
    await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toBeVisible();
    for (const name of ['Каталог', 'Карта', 'Профиль']) {
      await expect(page.locator('#appBottomNav').getByRole('button', { name })).toBeVisible();
    }
    const audit = await auditAccessibleNames(page, '#appBottomNav');
    expect(audit.unnamedButtons).toEqual([]);
  });

  test('header controls have accessible names', async ({ page }) => {
    const audit = await auditAccessibleNames(page, 'header');
    expect(audit.unnamedButtons).toEqual([]);
    expect(audit.unlabeledInputs).toEqual([]);
  });

  for (const [dialog, open] of [
    ['authLoginDialog', openLoginDialog],
    ['authRegisterDialog', openRegisterDialog],
    [
      'authResetDialog',
      async (page: Page) => {
        await openLoginDialog(page);
        await page.locator('#authLoginForgotBtn').click();
        await expect(page.locator('#authResetDialog')).toBeVisible();
      },
    ],
  ] as const) {
    test(`#${dialog}: buttons are named and inputs are labelled`, async ({ page }, testInfo) => {
      await open(page);
      const audit = await auditAccessibleNames(page, `#${dialog}`);
      if (audit.smallTargets.length) {
        testInfo.annotations.push({ type: 'small touch targets (<32px)', description: audit.smallTargets.join('; ') });
      }
      expect(audit.unnamedButtons, 'buttons without accessible name').toEqual([]);
      expect(audit.unlabeledInputs, 'inputs without label').toEqual([]);
      // Errors are announced.
      await expect(page.locator(`#${dialog} .auth-form-error`).first()).toHaveAttribute('role', 'alert');
    });
  }

  test('#authNewPasswordDialog: buttons are named and inputs are labelled', async ({ page }) => {
    const email = uniqueEmail('a11y');
    await registerViaApi(email, 'Secret123');
    await loginViaUi(page, email, 'Secret123');
    await expectLoggedIn(page, email);
    await page.locator('#profileChangePasswordBtn').click();
    await expect(page.locator('#authNewPasswordDialog')).toBeVisible();
    const audit = await auditAccessibleNames(page, '#authNewPasswordDialog');
    expect(audit.unnamedButtons).toEqual([]);
    expect(audit.unlabeledInputs).toEqual([]);
  });

  test('sector sheet climb rows are named buttons', async ({ page, seed }) => {
    await openArea(page, seed.areaAlphaId);
    await openSectorFromAreaMap(page, seed.sectorMixedId);
    const audit = await auditAccessibleNames(page, '#mapBoulderSheet');
    expect(audit.unnamedButtons).toEqual([]);
  });
});
