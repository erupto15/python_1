import { test, expect, installNetworkStubs, openApp, shot, waitForAppReady } from './helpers/fixtures';
import { registerViaApi, uniqueEmail } from './helpers/api';
import {
  expectGuest,
  expectLoggedIn,
  fillLogin,
  fillRegister,
  openLoginDialog,
  openProfile,
  openRegisterDialog,
  recordRequests,
  storedAuth,
} from './helpers/auth';

const PASSWORD = 'Secret123';

test.describe('auth: guest & register', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  test('guest sees register / login buttons on the profile tab', async ({ page }, testInfo) => {
    await openProfile(page);
    await expectGuest(page);
    await expect(page.locator('#profileRegisterBtn')).toHaveText('Регистрация');
    await expect(page.locator('#profileLoginBtn')).toHaveText('Вход');
    await shot(page, testInfo, 'profile-guest');
  });

  test('register form validates input on the client without calling the API', async ({ page }, testInfo) => {
    const posts = recordRequests(page, '/api/auth/register');
    await openRegisterDialog(page);
    const error = page.locator('#authRegisterError');
    const submit = page.locator('#authRegisterSubmitBtn');

    await submit.click();
    await expect(error).toHaveText('Введите имя');
    await expect(page.locator('#authRegisterName')).toBeFocused();

    await fillRegister(page, { email: 'not-an-email', password: PASSWORD });
    await submit.click();
    await expect(error).toHaveText('Проверьте адрес почты');
    await expect(page.locator('#authRegisterEmail')).toBeFocused();

    await fillRegister(page, { email: uniqueEmail('val'), password: '123' });
    await submit.click();
    await expect(error).toHaveText('Пароль должен быть не короче 6 символов');

    await fillRegister(page, { email: uniqueEmail('val'), password: PASSWORD, password2: `${PASSWORD}x` });
    await submit.click();
    await expect(error).toHaveText('Пароли не совпадают');
    await expect(page.locator('#authRegisterPassword2')).toBeFocused();
    await shot(page, testInfo, 'register-error-mismatch');

    expect(posts).toHaveLength(0);
    await expect(page.locator('#authRegisterDialog')).toBeVisible();
  });

  test('successful registration logs the user in and shows the profile', async ({ page }, testInfo) => {
    const email = uniqueEmail('reg');
    await openRegisterDialog(page);
    await fillRegister(page, { name: 'Ирина Тест', email: email.toUpperCase(), password: PASSWORD });
    await page.locator('#authRegisterSubmitBtn').click();

    await expect(page.locator('#authRegisterDialog')).toBeHidden();
    await expectLoggedIn(page, email);
    await expect(page.locator('#profileDisplayName')).toHaveText('Ирина Тест');
    const auth = await storedAuth(page);
    expect(auth.local?.accessToken).toBeTruthy();
    expect(auth.session).toBeNull();
    await shot(page, testInfo, 'profile-logged-in');

    // Session survives a reload.
    await page.reload();
    await waitForAppReady(page);
    await openProfile(page);
    await expectLoggedIn(page, email);
  });

  test('registering an existing e-mail shows the server error', async ({ page }) => {
    const email = uniqueEmail('dup');
    await registerViaApi(email, PASSWORD);
    await openRegisterDialog(page);
    await fillRegister(page, { email, password: PASSWORD });
    await page.locator('#authRegisterSubmitBtn').click();
    await expect(page.locator('#authRegisterError')).toHaveText('Пользователь с такой почтой уже зарегистрирован');
    await expect(page.locator('#authRegisterSubmitBtn')).toBeEnabled();
    await expect(page.locator('#authRegisterSubmitBtn')).toHaveText('Зарегистрироваться');
  });

  test('login and register dialogs link to each other and keep the typed e-mail', async ({ page }) => {
    const email = uniqueEmail('switch');
    await openLoginDialog(page);
    await page.locator('#authLoginEmail').fill(email);
    await page.locator('#authLoginToRegisterBtn').click();
    await expect(page.locator('#authRegisterDialog')).toBeVisible();
    await expect(page.locator('#authLoginDialog')).toBeHidden();
    await expect(page.locator('#authRegisterEmail')).toHaveValue(email);
    await page.locator('#authRegisterToLoginBtn').click();
    await expect(page.locator('#authLoginDialog')).toBeVisible();
    await page.locator('#authLoginDialogCloseBtn').click();
    await expect(page.locator('#authLoginDialog')).toBeHidden();
    await expectGuest(page);
  });
});

test.describe('auth: login & logout', () => {
  let email: string;

  test.beforeEach(async ({ page }) => {
    email = uniqueEmail('login');
    await registerViaApi(email, PASSWORD, 'Login User');
    await openApp(page);
  });

  test('wrong password shows an error and keeps the dialog open', async ({ page }, testInfo) => {
    await openLoginDialog(page);
    await fillLogin(page, email, 'wrong-password');
    await page.locator('#authLoginSubmitBtn').click();
    await expect(page.locator('#authLoginError')).toHaveText('Неверная почта или пароль');
    await expect(page.locator('#authLoginDialog')).toBeVisible();
    await shot(page, testInfo, 'login-error');
  });

  test('client-side validation: bad e-mail and empty password', async ({ page }) => {
    const posts = recordRequests(page, '/api/auth/login');
    await openLoginDialog(page);
    await fillLogin(page, 'bad@', PASSWORD);
    await page.locator('#authLoginSubmitBtn').click();
    await expect(page.locator('#authLoginError')).toHaveText('Проверьте адрес почты');
    await fillLogin(page, email, '');
    await page.locator('#authLoginSubmitBtn').click();
    await expect(page.locator('#authLoginError')).toHaveText('Введите пароль');
    expect(posts).toHaveLength(0);
  });

  test('login (remember me) then logout', async ({ page }) => {
    await openLoginDialog(page);
    await fillLogin(page, email, PASSWORD);
    await page.locator('#authLoginSubmitBtn').click();
    await expect(page.locator('#authLoginDialog')).toBeHidden();
    await expectLoggedIn(page, email);
    expect((await storedAuth(page)).local?.accessToken).toBeTruthy();

    await page.locator('#profileLogoutBtn').click();
    await expectGuest(page);
    const auth = await storedAuth(page);
    expect(auth.local?.accessToken ?? null).toBeNull();
    expect(auth.session?.accessToken ?? null).toBeNull();
  });

  test('"Запомнить меня" off keeps the token in sessionStorage only', async ({ page }) => {
    await openLoginDialog(page);
    await fillLogin(page, email, PASSWORD, { remember: false });
    await page.locator('#authLoginSubmitBtn').click();
    await expectLoggedIn(page, email);

    const auth = await storedAuth(page);
    expect(auth.session?.accessToken).toBeTruthy();
    expect(auth.local?.accessToken ?? null).toBeNull();

    // Same tab reload keeps the session (sessionStorage survives reloads)...
    await page.reload();
    await waitForAppReady(page);
    await openProfile(page);
    await expectLoggedIn(page, email);
  });

  test('"Запомнить меня" off: a new tab/app start is logged out', async ({ page, context }) => {
    await openLoginDialog(page);
    await fillLogin(page, email, PASSWORD, { remember: false });
    await page.locator('#authLoginSubmitBtn').click();
    await expectLoggedIn(page, email);

    // Close first and drop the leader key: two tabs trip the single-instance bug covered in boot.spec.
    await page.close();
    const fresh = await context.newPage();
    await installNetworkStubs(fresh);
    await fresh.addInitScript(() => localStorage.removeItem('6a9a_tg_miniapp_leader_v1'));
    await fresh.goto('/');
    await waitForAppReady(fresh);
    await openProfile(fresh);
    await expectGuest(fresh);
    await fresh.close();
  });

  test('double click on «Войти» sends exactly one POST', async ({ page }) => {
    const posts = recordRequests(page, '/api/auth/login');
    // Slow the response down so the second click lands while the first request is in flight.
    await page.route('**/api/auth/login', async (route) => {
      await new Promise((r) => setTimeout(r, 600));
      await route.continue();
    });
    await openLoginDialog(page);
    await fillLogin(page, email, PASSWORD);
    await page.locator('#authLoginSubmitBtn').dblclick();
    await expect(page.locator('#authLoginSubmitBtn')).toBeDisabled();
    await expectLoggedIn(page, email);
    expect(posts).toHaveLength(1);
  });

  test('double click on «Зарегистрироваться» sends exactly one POST', async ({ page }) => {
    const posts = recordRequests(page, '/api/auth/register');
    await page.route('**/api/auth/register', async (route) => {
      await new Promise((r) => setTimeout(r, 600));
      await route.continue();
    });
    const newEmail = uniqueEmail('dbl');
    await openRegisterDialog(page);
    await fillRegister(page, { email: newEmail, password: PASSWORD });
    await page.locator('#authRegisterSubmitBtn').dblclick();
    await expectLoggedIn(page, newEmail);
    expect(posts).toHaveLength(1);
  });

  test('login accepts e-mail in any case', async ({ page }) => {
    await openLoginDialog(page);
    await fillLogin(page, `  ${email.toUpperCase()} `, PASSWORD);
    await page.locator('#authLoginSubmitBtn').click();
    await expectLoggedIn(page, email);
  });
});
