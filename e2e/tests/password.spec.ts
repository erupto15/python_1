import { test, expect, openApp, shot, waitForAppBooted, waitForAppReady } from './helpers/fixtures';
import { loginStatus, registerViaApi, uniqueEmail } from './helpers/api';
import { insertTempPassword } from './helpers/db';
import { expectGuest, expectLoggedIn, fillLogin, loginViaUi, openLoginDialog, openProfile, recordRequests } from './helpers/auth';

const ORIGINAL = 'Original123';
const TEMP = 'TempPass99';
const NEW = 'BrandNew456';

test.describe('forgot password', () => {
  test('without SMTP the request shows «временно недоступно»', async ({ page }, testInfo) => {
    await openApp(page);
    await openLoginDialog(page);
    const email = uniqueEmail('reset');
    await page.locator('#authLoginEmail').fill(email);
    await page.locator('#authLoginForgotBtn').click();

    await expect(page.locator('#authResetDialog')).toBeVisible();
    await expect(page.locator('#authLoginDialog')).toBeHidden();
    await expect(page.locator('#authResetEmail')).toHaveValue(email);

    const reqs = recordRequests(page, '/api/auth/password-reset/request');
    await page.locator('#authResetRequestSubmitBtn').click();
    await expect(page.locator('#authResetRequestError')).toHaveText('Восстановление пароля временно недоступно');
    expect(reqs).toHaveLength(1);
    expect((await reqs[0].response())?.status()).toBe(503);
    await expect(page.locator('#authResetSentBlock')).toBeHidden();
    await expect(page.locator('#authResetRequestSubmitBtn')).toBeEnabled();
    await shot(page, testInfo, 'reset-unavailable');
  });

  test('invalid e-mail is rejected on the client', async ({ page }) => {
    await openApp(page);
    await openLoginDialog(page);
    await page.locator('#authLoginForgotBtn').click();
    const reqs = recordRequests(page, '/api/auth/password-reset/request');
    await page.locator('#authResetEmail').fill('nope');
    await page.locator('#authResetRequestSubmitBtn').click();
    await expect(page.locator('#authResetRequestError')).toHaveText('Проверьте адрес почты');
    expect(reqs).toHaveLength(0);
    await page.locator('#authResetDialogCloseBtn').click();
    await expect(page.locator('#authResetDialog')).toBeHidden();
  });
});

test.describe('forced new password after a temporary one', () => {
  test('temp password login forces a new password; old and temp stop working', async ({ page }, testInfo) => {
    const email = uniqueEmail('forced');
    await registerViaApi(email, ORIGINAL);
    insertTempPassword(email, TEMP);

    await openApp(page);
    await loginViaUi(page, email, TEMP);

    const dialog = page.locator('#authNewPasswordDialog');
    await expect(dialog).toBeVisible();
    await expect(page.locator('#authNewPasswordTitle')).toHaveText('Новый пароль');
    await expect(page.locator('#authNewPasswordCurrentGroup')).toBeHidden();
    await expect(page.locator('#authNewPasswordDialogCloseBtn')).toBeHidden();
    await shot(page, testInfo, 'forced-new-password');

    // Reload keeps forcing (server says must_change_password); the dialog covers the shell, so no bottom nav.
    await page.reload();
    await waitForAppBooted(page);
    await expect(dialog).toBeVisible();
    await expect(page.locator('#appBottomNav')).toBeHidden();
    await expect(page.locator('#authNewPasswordCurrentGroup')).toBeHidden();
    await expect(page.locator('#authNewPasswordDialogCloseBtn')).toBeHidden();

    await page.locator('#authNewPassword').fill(NEW);
    await page.locator('#authNewPassword2').fill(`${NEW}-typo`);
    await page.locator('#authNewPasswordSubmitBtn').click();
    await expect(page.locator('#authNewPasswordError')).toHaveText('Пароли не совпадают');

    await page.locator('#authNewPassword').fill('123');
    await page.locator('#authNewPassword2').fill('123');
    await page.locator('#authNewPasswordSubmitBtn').click();
    await expect(page.locator('#authNewPasswordError')).toHaveText('Пароль должен быть не короче 6 символов');

    await page.locator('#authNewPassword').fill(NEW);
    await page.locator('#authNewPassword2').fill(NEW);
    await page.locator('#authNewPasswordSubmitBtn').click();
    await expect(dialog).toBeHidden();

    await page.reload();
    await waitForAppReady(page);
    await expect(dialog).toBeHidden();
    await openProfile(page);
    await expectLoggedIn(page, email);

    expect(await loginStatus(email, TEMP)).toBe(401);
    expect(await loginStatus(email, ORIGINAL)).toBe(401);
    expect(await loginStatus(email, NEW)).toBe(200);
  });

  test('forced dialog cannot be dismissed (Escape, system back, close button)', async ({ page }, testInfo) => {
    const email = uniqueEmail('forcedesc');
    await registerViaApi(email, ORIGINAL);
    insertTempPassword(email, TEMP);
    await openApp(page);
    await loginViaUi(page, email, TEMP);
    const dialog = page.locator('#authNewPasswordDialog');
    await expect(dialog).toBeVisible();
    await expect(page.locator('#authNewPasswordDialogCloseBtn')).toBeHidden();
    await expect(page.locator('#authNewPasswordLogoutBtn')).toBeVisible();

    await page.keyboard.press('Escape');
    await shot(page, testInfo, 'forced-new-password-after-escape');
    await expect(dialog).toBeVisible();

    await page.evaluate(() => {
      const w = window as any;
      w.closeTopTelegramOverlay?.();
      w.handleGuidebookSystemBack?.();
      w.app.hideDialog('authNewPasswordDialog');
      (document.getElementById('authNewPasswordDialogCloseBtn') as HTMLButtonElement | null)?.click();
    });
    await page.waitForTimeout(300);
    await expect(dialog).toBeVisible();
  });

  test('forced dialog offers «Выйти»: logs out and closes', async ({ page }) => {
    const email = uniqueEmail('forcedout');
    await registerViaApi(email, ORIGINAL);
    insertTempPassword(email, TEMP);
    await openApp(page);
    await loginViaUi(page, email, TEMP);
    const dialog = page.locator('#authNewPasswordDialog');
    await expect(dialog).toBeVisible();
    await page.locator('#authNewPasswordLogoutBtn').click();
    await expect(dialog).toBeHidden();
    await openProfile(page);
    await expectGuest(page);
    await page.reload();
    await waitForAppReady(page);
    await expect(dialog).toBeHidden();
  });

  test('the original password keeps working until the temp one is used', async ({ page }) => {
    const email = uniqueEmail('forced2');
    await registerViaApi(email, ORIGINAL);
    insertTempPassword(email, TEMP);
    await openApp(page);
    await loginViaUi(page, email, ORIGINAL);
    await expectLoggedIn(page, email);
    await expect(page.locator('#authNewPasswordDialog')).toBeHidden();
  });
});

test.describe('profile: change password', () => {
  let email: string;

  test.beforeEach(async ({ page }) => {
    email = uniqueEmail('chpw');
    await registerViaApi(email, ORIGINAL);
    await openApp(page);
    await loginViaUi(page, email, ORIGINAL);
    await expectLoggedIn(page, email);
    await page.locator('#profileChangePasswordBtn').click();
    await expect(page.locator('#authNewPasswordDialog')).toBeVisible();
  });

  test('dialog asks for the current password and can be closed', async ({ page }) => {
    await expect(page.locator('#authNewPasswordTitle')).toHaveText('Смена пароля');
    await expect(page.locator('#authNewPasswordCurrentGroup')).toBeVisible();
    await expect(page.locator('#authNewPasswordDialogCloseBtn')).toBeVisible();
    await expect(page.locator('#authNewPasswordLogoutBtn')).toBeHidden();
    await page.locator('#authNewPasswordSubmitBtn').click();
    await expect(page.locator('#authNewPasswordError')).toHaveText('Введите текущий пароль');
    await page.locator('#authNewPasswordDialogCloseBtn').click();
    await expect(page.locator('#authNewPasswordDialog')).toBeHidden();
  });

  test('wrong current password -> «Неверный текущий пароль»', async ({ page }, testInfo) => {
    await page.locator('#authNewPasswordCurrent').fill('not-my-password');
    await page.locator('#authNewPassword').fill(NEW);
    await page.locator('#authNewPassword2').fill(NEW);
    await page.locator('#authNewPasswordSubmitBtn').click();
    await expect(page.locator('#authNewPasswordError')).toHaveText('Неверный текущий пароль');
    await expect(page.locator('#authNewPasswordDialog')).toBeVisible();
    await shot(page, testInfo, 'change-password-wrong-current');
    expect(await loginStatus(email, ORIGINAL)).toBe(200);
  });

  test('new password equal to the current one is rejected', async ({ page }) => {
    await page.locator('#authNewPasswordCurrent').fill(ORIGINAL);
    await page.locator('#authNewPassword').fill(ORIGINAL);
    await page.locator('#authNewPassword2').fill(ORIGINAL);
    await page.locator('#authNewPasswordSubmitBtn').click();
    await expect(page.locator('#authNewPasswordError')).toContainText('совпадает с текущим');
  });

  test('successful change: dialog closes, old password rejected, new accepted', async ({ page }) => {
    await page.locator('#authNewPasswordCurrent').fill(ORIGINAL);
    await page.locator('#authNewPassword').fill(NEW);
    await page.locator('#authNewPassword2').fill(NEW);
    await page.locator('#authNewPasswordSubmitBtn').click();
    await expect(page.locator('#authNewPasswordDialog')).toBeHidden();
    await expectLoggedIn(page, email);

    expect(await loginStatus(email, ORIGINAL)).toBe(401);
    expect(await loginStatus(email, NEW)).toBe(200);

    // UI login with the new password after logout.
    await page.locator('#profileLogoutBtn').click();
    await openLoginDialog(page);
    await fillLogin(page, email, NEW);
    await page.locator('#authLoginSubmitBtn').click();
    await expectLoggedIn(page, email);
  });
});
